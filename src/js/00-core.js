/* 00-core.js — 命名空间、DOM 工具、图标、行内标记、提示、复制与下载。
   所有模块通过全局 PB 通信；build.py 按文件名顺序拼接 src/js/*.js。 */
(function () {
  "use strict";
  const PB = (window.PB = window.PB || {});
  PB.host = window.PB_HOST || "standalone";
  PB.tools = {};
  PB.views = {};

  /* ---------- 事件 ---------- */
  const listeners = {};
  PB.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); };
  PB.emit = (evt, data) => { (listeners[evt] || []).slice().forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); };

  /* ---------- DOM ---------- */
  function appendKids(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k === null || k === undefined || k === false) continue;
      el.append(k instanceof Node ? k : String(k));
    }
  }
  PB.h = function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const key of Object.keys(props)) {
        const v = props[key];
        if (v === null || v === undefined || v === false) continue;
        if (key === "class") el.className = v;
        else if (key === "text") el.textContent = v;
        else if (key === "html") el.innerHTML = v;
        else if (key === "style" && typeof v === "object") {
          for (const sk of Object.keys(v)) {
            if (sk.startsWith("--")) el.style.setProperty(sk, v[sk]);
            else el.style[sk] = v[sk];
          }
        } else if (key === "dataset") Object.assign(el.dataset, v);
        else if (key.startsWith("on") && typeof v === "function") el.addEventListener(key.slice(2), v);
        else if (key === "value" && ("value" in el)) el.value = v;
        else if (key === "checked") el.checked = !!v;
        else if (v === true) el.setAttribute(key, "");
        else el.setAttribute(key, v);
      }
    }
    appendKids(el, kids);
    return el;
  };
  const SVGNS = "http://www.w3.org/2000/svg";
  PB.s = function s(tag, attrs, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    if (attrs) {
      for (const key of Object.keys(attrs)) {
        const v = attrs[key];
        if (v === null || v === undefined || v === false) continue;
        if (key === "text") el.textContent = v;
        else if (key.startsWith("on") && typeof v === "function") el.addEventListener(key.slice(2), v);
        else el.setAttribute(key, v);
      }
    }
    for (const k of kids.flat(Infinity)) if (k) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return el;
  };
  PB.$ = (sel, root) => (root || document).querySelector(sel);
  PB.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  PB.clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  PB.uid = (p) => (p || "id") + Math.random().toString(36).slice(2, 9);
  PB.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  PB.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  PB.today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  PB.fmt = (n, digits) => {
    if (n === null || n === undefined || n === "" || isNaN(n)) return "—";
    const d = digits === undefined ? (Math.abs(n) < 10 && n % 1 ? 1 : 0) : digits;
    return Number(n).toLocaleString("zh-CN", { maximumFractionDigits: d, minimumFractionDigits: 0 });
  };
  PB.money = (n) => "¥" + PB.fmt(Math.round(n), 0);
  PB.compact = (n) => {
    if (n === null || n === undefined || isNaN(n)) return "—";
    const a = Math.abs(n);
    if (a >= 1e8) return PB.fmt(n / 1e8, 1) + "亿";
    if (a >= 1e4) return PB.fmt(n / 1e4, 1) + "万";
    return PB.fmt(n);
  };

  /* ---------- 文本 ---------- */
  PB.esc = (str) => String(str === null || str === undefined ? "" : str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // 行内标记：**粗体**、`代码`、[[路由|文字]] 站内链接、[文字](https://…) 外链、换行。先转义，再替换。
  PB.md = function md(text) {
    let out = PB.esc(text);
    out = out.replace(/\[\[([a-z0-9.\-]+)\|([^\]]+)\]\]/g, (m, route, label) => '<a class="ilink" href="#' + route + '">' + label + "</a>");
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + "</a>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\n/g, "<br>");
    return out;
  };
  PB.plain = (text) => String(text || "").replace(/\[\[[a-z0-9.\-]+\|([^\]]+)\]\]/g, "$1").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
  // 高亮模板中的【占位符】
  PB.markSlots = (text) => PB.esc(text).replace(/【([^】]*)】/g, "<mark>【$1】</mark>");

  // 块级 Markdown（用于渲染 AI 回答与方案预览）：标题、列表、表格、代码块、段落。
  PB.mdBlock = function mdBlock(src) {
    const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
    const html = [];
    let i = 0;
    const inline = (t) => {
      let o = PB.esc(t);
      o = o.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, l, u) => '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + l + "</a>");
      o = o.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
      return o;
    };
    while (i < lines.length) {
      const line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }
      if (/^```/.test(line)) {
        const buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        html.push("<pre><code>" + PB.esc(buf.join("\n")) + "</code></pre>");
        continue;
      }
      const hm = line.match(/^(#{1,4})\s+(.*)$/);
      if (hm) { const lv = Math.min(4, hm[1].length + 1); html.push("<h" + lv + ">" + inline(hm[2]) + "</h" + lv + ">"); i++; continue; }
      if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        const row = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const head = row(line); i += 2;
        const body = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) body.push(row(lines[i++]));
        html.push("<table><thead><tr>" + head.map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>" + body.map((r) => "<tr>" + r.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table>");
        continue;
      }
      if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
        const ordered = /^\s*\d+[.)]\s+/.test(line);
        const items = [];
        while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
          i++;
        }
        const tag = ordered ? "ol" : "ul";
        html.push("<" + tag + ">" + items.map((t) => "<li>" + inline(t) + "</li>").join("") + "</" + tag + ">");
        continue;
      }
      const buf = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4})\s/.test(lines[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]) && !/^```/.test(lines[i]) && !/^\s*\|/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      html.push("<p>" + buf.map(inline).join("<br>") + "</p>");
    }
    return html.join("");
  };

  /* ---------- 图标 ---------- */
  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 15l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>',
    message: '<path d="M4 5h16v11H10l-5 4v-4H4z"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
    home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    sprout: '<path d="M12 21v-8"/><path d="M12 13C12 8.6 8.9 5.5 4.5 5.5c0 4.4 3.1 7.5 7.5 7.5z"/><path d="M12 15c0-3.3 2.7-6 6.5-6 0 3.3-2.7 6-6.5 6z"/>',
    cycle: '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1L19.5 9"/><path d="M19.5 4v5h-5"/><path d="M19.5 12a7.5 7.5 0 0 1-13 5.1L4.5 15"/><path d="M4.5 20v-5h5"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    map: '<path d="M3 6.5l6-3 6 3 6-3v14l-6 3-6-3-6 3z"/><path d="M9 3.5v14M15 6.5v14"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    book: '<path d="M4 4.5h5.5A2.5 2.5 0 0 1 12 7v13a2 2 0 0 0-2-2H4z"/><path d="M20 4.5h-5.5A2.5 2.5 0 0 0 12 7v13a2 2 0 0 1 2-2h6z"/>',
    file: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    radar: '<path d="M12 3l8.5 6.2-3.2 10H6.7L3.5 9.2z"/><path d="M12 8l4 2.9-1.5 4.6h-5L8 10.9z"/>',
    persona: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    bars: '<path d="M4 20h16M7 20v-6M12 20V6M17 20v-9"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
    chart: '<path d="M4 4v16h16"/><path d="M7.5 15l3.5-4 3 2.5 5-6"/>',
    coins: '<ellipse cx="12" cy="6.5" rx="7.5" ry="3"/><path d="M4.5 6.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5"/><path d="M4.5 11.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5"/>',
    shield: '<path d="M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    chat: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    tip: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    insight: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
    note: '<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/>'
  };
  PB.icon = function icon(name, cls) {
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "icon" + (cls ? " " + cls : ""));
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = ICONS[name] || ICONS.info;
    return svg;
  };

  /* ---------- 提示 ---------- */
  let toastTimer;
  PB.toast = function toast(msg) {
    let el = document.getElementById("pb-toast");
    if (!el) {
      el = PB.h("div", { id: "pb-toast", class: "toast", role: "status", "aria-live": "polite" });
      document.body.append(el);
    }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  };

  /* ---------- 复制 ---------- */
  // 必须在点击事件中同步调用；失败时退回到选中文本，提示手动复制。
  PB.copy = function copy(text, selectEl) {
    const ok = () => PB.toast("已复制");
    const fallback = () => {
      let done = false;
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "0";
        ta.style.opacity = "0";
        document.body.append(ta);
        ta.select();
        done = document.execCommand && document.execCommand("copy");
        ta.remove();
      } catch (e) { done = false; }
      if (done) return ok();
      if (selectEl) {
        try {
          if (selectEl.select) selectEl.select();
          else { const r = document.createRange(); r.selectNodeContents(selectEl); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
        } catch (e) { /* ignore */ }
      }
      PB.toast("无法自动复制，已选中文本，请按 Ctrl/⌘ + C");
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, fallback);
        return;
      }
    } catch (e) { /* fall through */ }
    fallback();
  };
  PB.copyBtn = function copyBtn(getText, label, selectEl) {
    return PB.h("button", { class: "btn sm", type: "button", onclick: () => PB.copy(typeof getText === "function" ? getText() : getText, typeof selectEl === "function" ? selectEl() : selectEl) }, PB.icon("copy", "sm"), label || "复制");
  };

  /* ---------- 下载 ---------- */
  // Artifact 中只能通过 downloads 能力保存文件；独立托管时用普通下载链接。
  PB.canSave = () => !!(PB.cap && PB.cap.downloads) || !PB.inClaude;
  PB.saveFile = async function saveFile(filename, data, mime) {
    if (PB.cap && PB.cap.downloads) {
      try {
        await PB.cap.downloads.save({ filename, data });
        PB.toast("已保存 " + filename);
        return true;
      } catch (e) {
        if (e && e.code === "declined") return false;
        if (e && e.code === "rate_limited") PB.toast("已有一个保存请求，请稍后再试");
        else PB.toast("当前环境无法保存文件，请改用复制");
        return false;
      }
    }
    if (PB.inClaude) { PB.toast("当前环境无法保存文件，请改用复制"); return false; }
    const blob = new Blob([data], { type: (mime || "text/plain") + ";charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return true;
  };
  PB.saveBtn = function saveBtn(label, filename, getData, mime) {
    return PB.h("button", { class: "btn sm", type: "button", "data-cap": "save", hidden: !PB.canSave(), onclick: () => PB.saveFile(typeof filename === "function" ? filename() : filename, getData(), mime) }, PB.icon("download", "sm"), label);
  };

  /* 两步确认按钮（Artifact 中 confirm() 不可用） */
  PB.confirmBtn = function confirmBtn(label, armedLabel, onConfirm, cls) {
    let armed = false, timer;
    const btn = PB.h("button", { class: "btn sm danger " + (cls || ""), type: "button" }, PB.icon("trash", "sm"), label);
    btn.addEventListener("click", () => {
      if (!armed) {
        armed = true;
        btn.classList.add("armed");
        btn.lastChild.textContent = armedLabel || "再点一次确认";
        timer = setTimeout(() => { armed = false; btn.classList.remove("armed"); btn.lastChild.textContent = label; }, 3500);
        return;
      }
      clearTimeout(timer);
      armed = false;
      btn.classList.remove("armed");
      btn.lastChild.textContent = label;
      onConfirm();
    });
    return btn;
  };
})();
