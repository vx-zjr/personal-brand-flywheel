/* 10-store.js — 用户数据存储与运行时能力。
   数据形状：{ v: 1, updated: <毫秒时间戳>, items: { <key>: <value> } }
   1) 始终写入 localStorage（键 pb:v1）；2) 在 Claude 中打开且已登录时，
   同步到 db 的 data/users/<id>/workbook（每位用户私有，含页面所有者在内的其他人不可读）。
   修改存储结构时：提升 SCHEMA_VERSION，并在 migrate() 中写迁移逻辑（见 agent.md §12）。 */
(function () {
  "use strict";
  const PB = window.PB;
  const LS_KEY = "pb:v1";
  const PREF_KEY = "pb:prefs";
  const SCHEMA_VERSION = 1;
  const MAX_REMOTE_BYTES = 240 * 1024;

  PB.inClaude = !!(window.claude && typeof window.claude.use === "function");
  PB.cap = { db: null, user: null, uid: null, sample: null, downloads: null, comments: null };

  function readLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (e) { return null; }
  }
  function writeLocal(state) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }
  function migrate(state) {
    if (!state || typeof state !== "object") return { v: SCHEMA_VERSION, updated: 0, items: {} };
    if (!state.items || typeof state.items !== "object") state.items = {};
    if (!state.v) state.v = 1;
    // 未来版本：if (state.v < 2) { ...; state.v = 2; }
    state.v = SCHEMA_VERSION;
    return state;
  }

  let state = migrate(readLocal());
  const status = { mode: "local", remoteError: null };

  const store = {
    status,
    get(key, fallback) {
      return Object.prototype.hasOwnProperty.call(state.items, key) ? state.items[key] : fallback;
    },
    has(key) { return Object.prototype.hasOwnProperty.call(state.items, key); },
    set(key, value) {
      state.items[key] = value;
      touch();
    },
    update(key, fn, fallback) {
      const cur = store.get(key, fallback);
      const next = fn(cur === undefined ? fallback : cur);
      store.set(key, next);
      return next;
    },
    remove(key) {
      if (store.has(key)) { delete state.items[key]; touch(); }
    },
    all() { return JSON.parse(JSON.stringify(state)); },
    replaceAll(next) {
      state = migrate(JSON.parse(JSON.stringify(next)));
      state.updated = Date.now();
      writeLocal(state);
      scheduleRemote();
      PB.emit("store:replaced");
    },
    clear() {
      state = { v: SCHEMA_VERSION, updated: Date.now(), items: {} };
      writeLocal(state);
      scheduleRemote();
      PB.emit("store:replaced");
    },
    size() { try { return new Blob([JSON.stringify(state)]).size; } catch (e) { return JSON.stringify(state).length; } }
  };
  PB.store = store;

  const saveLocalSoon = PB.debounce(() => writeLocal(state), 300);
  function touch() {
    state.updated = Date.now();
    saveLocalSoon();
    scheduleRemote();
    PB.emit("store:changed");
  }

  /* ---------- 偏好（仅本机，不同步） ---------- */
  PB.prefs = {
    get(key, fallback) {
      try { const p = JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); return key in p ? p[key] : fallback; } catch (e) { return fallback; }
    },
    set(key, value) {
      try { const p = JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); p[key] = value; localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) { /* 忽略 */ }
    }
  };

  /* ---------- 远端同步（db，私有） ---------- */
  let remoteRef = null;
  let remoteBusy = false;
  let remoteDirty = false;
  let remoteDisabled = false;

  const scheduleRemote = PB.debounce(() => { remoteDirty = true; flushRemote(); }, 1500);

  async function flushRemote() {
    if (!remoteRef || remoteDisabled || remoteBusy || !remoteDirty) return;
    const body = JSON.parse(JSON.stringify(state));
    const bytes = JSON.stringify(body).length * 3; // 粗略上限（UTF-8 中文最多 3 字节）
    if (bytes > MAX_REMOTE_BYTES && store.size() > MAX_REMOTE_BYTES) {
      status.remoteError = "数据超过云端单个文档上限，仅保存在本浏览器";
      PB.emit("sync");
      return;
    }
    remoteBusy = true;
    remoteDirty = false;
    try {
      await remoteRef.set(body);
      status.mode = "cloud";
      status.remoteError = null;
    } catch (e) {
      const code = e && e.code;
      if (code === "invalid_argument" || code === "not_granted" || code === "revoked" || code === "capability_disabled" || code === "capability_removed") {
        remoteDisabled = true;
        status.mode = "local";
        status.remoteError = "当前账户无法写入云端，数据仅保存在本浏览器";
      } else if (code === "quota_exceeded") {
        status.remoteError = "云端存储已满，数据仅保存在本浏览器";
      } else {
        remoteDirty = true;
        setTimeout(flushRemote, 4000 + Math.random() * 3000);
      }
    } finally {
      remoteBusy = false;
      PB.emit("sync");
      if (remoteDirty && !remoteDisabled) setTimeout(flushRemote, 800);
    }
  }

  async function initRemote() {
    if (!PB.inClaude) return;
    let db = null, user = null;
    try { [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]); } catch (e) { return; }
    PB.cap.db = db; PB.cap.user = user;
    if (!db || !user) return;
    let uid = null;
    try { uid = await user.id(); } catch (e) { uid = null; }
    if (!uid) return;
    PB.cap.uid = uid;
    try { remoteRef = db.doc("data/users/" + uid + "/workbook"); } catch (e) { remoteRef = null; return; }
    try {
      const snap = await remoteRef.get();
      const remote = snap && snap.exists ? snap.data() : null;
      if (remote && remote.items && (remote.updated || 0) > (state.updated || 0)) {
        state = migrate(JSON.parse(JSON.stringify(remote)));
        writeLocal(state);
        status.mode = "cloud";
        PB.emit("store:replaced");
      } else if (Object.keys(state.items).length) {
        remoteDirty = true;
        status.mode = "cloud";
        flushRemote();
      } else {
        status.mode = "cloud";
      }
    } catch (e) {
      status.remoteError = "暂时无法连接云端，数据先保存在本浏览器";
    }
    PB.emit("sync");
  }

  /* ---------- 其他能力 ---------- */
  function useCap(name) {
    if (!PB.inClaude) return Promise.resolve(null);
    try { return window.claude.use(name).catch(() => null); } catch (e) { return Promise.resolve(null); }
  }
  PB.initCaps = function initCaps() {
    useCap("sample").then((v) => { PB.cap.sample = v; PB.applyCaps(); });
    useCap("downloads").then((v) => { PB.cap.downloads = v; PB.applyCaps(); });
    useCap("comments").then((v) => { PB.cap.comments = v; PB.applyCaps(); });
    initRemote();
  };
  // 根据能力显示或隐藏带 data-cap 的元素。
  PB.applyCaps = function applyCaps(root) {
    const scope = root || document;
    PB.$$("[data-cap]", scope).forEach((el) => {
      const need = el.getAttribute("data-cap");
      let ok = false;
      if (need === "sample") ok = !!PB.cap.sample && !PB.aiDisabled;
      else if (need === "no-sample") ok = !PB.cap.sample || !!PB.aiDisabled;
      else if (need === "save") ok = PB.canSave();
      else if (need === "comments") ok = !!PB.cap.comments && !PB.commentsDisabled;
      el.hidden = !ok;
    });
    PB.emit("caps");
  };

  /* ---------- AI 调用封装 ---------- */
  const AI_ERRORS = {
    not_granted: "未获授权在此页面使用 Claude。",
    sampling_disabled: "当前账户无法使用 Claude。",
    not_declared: "此页面版本不支持调用 Claude。",
    capability_disabled: "此视图中无法调用 Claude。",
    capability_removed: "此视图中无法调用 Claude。",
    rate_limited: "请求太频繁，或已达到用量上限，请稍后再试。",
    session_expired: "登录已过期，请重新登录 Claude 后再试。",
    refused: "Claude 无法处理这个请求，请调整内容后再试。",
    empty_completion: "没有得到回答，请简化问题后再试。",
    invalid_json: "返回格式不完整，请再试一次。",
    prompt_too_large: "内容太长，请精简后再试。",
    upstream_error: "连接中断，请稍后重试。"
  };
  const AI_PERMANENT = ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"];
  PB.aiErrorText = (e) => AI_ERRORS[(e && e.code) || "upstream_error"] || AI_ERRORS.upstream_error;
  PB.aiHandleError = (e) => {
    if (e && AI_PERMANENT.indexOf(e.code) >= 0) { PB.aiDisabled = true; PB.applyCaps(); }
  };
  PB.fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ""));

  // 汇总用户的品牌档案，供 AI 提示词使用
  PB.profileText = function profileText() {
    const lines = [];
    const canvas = store.get("canvas");
    const T = PB.content.tools;
    if (canvas && canvas.fields) {
      T.canvas.fields.forEach((f) => { const v = (canvas.fields[f.id] || "").trim(); if (v) lines.push(f.label + "：" + v); });
    }
    const arch = store.get("archetype");
    if (arch && arch.primary) {
      const find = (id) => T.archetypes.find((a) => a.id === id);
      const p = find(arch.primary), s2 = arch.secondary && find(arch.secondary);
      lines.push("品牌原型：" + (p ? p.name : "") + (s2 ? "（辅：" + s2.name + "）" : ""));
    }
    const plat = store.get("platform");
    if (plat && PB.platformRank) {
      const top = PB.platformRank(plat).slice(0, 3).map((r) => r.p.name);
      if (top.length) lines.push("推荐平台：" + top.join("、"));
    }
    const audit = store.get("audit");
    if (audit && audit.history && audit.history.length) {
      const last = audit.history[audit.history.length - 1];
      lines.push("最近一次体检总分：" + last.total + "（" + last.date + "）");
    }
    return lines.length ? lines.join("\n") : "（用户尚未填写品牌档案）";
  };
})();
