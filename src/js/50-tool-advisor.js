/* 50-tool-advisor.js — 品牌顾问：带着用户的品牌档案向 Claude 提问（流式输出、可停止）。
   仅在 Claude 中打开、且 sample 能力可用时出现；其他环境显示说明。
   存储键 advisor = { turns: [{role:"user"|"assistant", content}], withProfile: true }（保留最近 30 条） */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;

  PB.tools.advisor = {
    mount(shell) {
      const cfgA = PB.content.tools.ai;
      const get = () => PB.store.get("advisor", { turns: [], withProfile: true });
      const save = (st) => { st.turns = st.turns.slice(-30); PB.store.set("advisor", st); };
      const unavailable = h("div", { class: "unavailable", "data-cap": "no-sample" },
        h("strong", { text: "在 Claude 中打开本页面时可用" }),
        h("span", { text: "品牌顾问会调用你自己的 Claude 账户回答问题，并自动带上你在定位画布、品牌原型、平台选择器和体检中填写的信息。独立托管的版本不包含这项功能，其余工具都可以正常使用。" }),
        h("span", { class: "small muted", html: PB.md("想先整理自己的档案？去 [[tools.canvas|定位画布]] 和 [[tools.audit|品牌体检]]。") }));
      const chat = h("div", { class: "chat", "data-cap": "sample", hidden: true });
      shell.body.append(unavailable, chat);

      const log = h("div", { class: "chat-log", "aria-live": "polite" });
      const inputId = PB.uid("adv-in");
      const input = h("textarea", { class: "textarea", id: inputId, rows: "2", placeholder: "问一个关于你个人品牌的问题，Enter 发送，Shift + Enter 换行", maxlength: "2000" });
      const send = h("button", { class: "btn primary", type: "button" }, PB.icon("send", "sm"), "发送");
      const stop = h("button", { class: "btn", type: "button", hidden: true }, PB.icon("stop", "sm"), "停止");
      const withProfileId = PB.uid("adv-pf");
      const withProfile = h("input", { type: "checkbox", id: withProfileId, checked: get().withProfile !== false });
      withProfile.addEventListener("change", () => { const st = get(); st.withProfile = withProfile.checked; save(st); });
      const sugg = h("div", { class: "chips" });
      const err = h("div", { class: "ai-error", hidden: true });
      chat.append(log, sugg, err,
        h("div", { class: "chat-input" }, h("div", { class: "field" }, h("label", { for: inputId, class: "sr-only", text: "你的问题" }), input), h("div", { class: "btn-row" }, stop, send)),
        h("div", { class: "btn-row" },
          h("label", { for: withProfileId, class: "small", style: { display: "inline-flex", gap: "6px", alignItems: "center" } }, withProfile, "附带我的品牌档案"),
          PB.confirmBtn("清空对话", "再点一次清空", () => { const st = get(); st.turns = []; save(st); render(); }),
          h("span", { class: "note", text: "每次提问会消耗你自己的 Claude 用量；首次使用时会请求授权。" })));

      let ctl = null, busy = false;
      function bubble(role, text) {
        const el = h("div", { class: "msg " + role });
        if (role === "assistant") el.innerHTML = PB.mdBlock(text); else el.textContent = text;
        return el;
      }
      function render() {
        const st = get();
        PB.clear(log);
        if (!st.turns.length) log.append(h("div", { class: "msg assistant", html: PB.mdBlock("你好！我可以帮你打磨定位、构思选题、规划平台和变现。你可以直接提问，或者点下面的常见问题开始。") }));
        st.turns.forEach((t) => log.append(bubble(t.role, t.content)));
        PB.clear(sugg);
        if (!st.turns.length) cfgA.suggestions.forEach((q) => sugg.append(h("button", { class: "chip", type: "button", text: q, onclick: () => { input.value = q; ask(); } })));
        log.scrollTop = log.scrollHeight;
      }
      async function ask() {
        const q = input.value.trim();
        if (!q || busy || !PB.cap.sample) return;
        busy = true; err.hidden = true;
        const st = get();
        st.turns.push({ role: "user", content: q });
        save(st);
        input.value = "";
        render();
        const live = h("div", { class: "msg assistant" }, h("span", { class: "ai-thinking", text: "Claude 正在思考……" }));
        log.append(live); log.scrollTop = log.scrollHeight;
        const rules = PB.fill(cfgA.advisor, { profile: withProfile.checked ? PB.profileText() : "（用户选择不附带档案）" });
        const turns = [{ role: "user", content: rules }].concat(st.turns.slice(-12));
        ctl = new AbortController();
        send.disabled = true; stop.hidden = false;
        try {
          const res = await PB.cap.sample(turns, { cache: false, signal: ctl.signal, onText: ({ text }) => { live.innerHTML = PB.mdBlock(text); log.scrollTop = log.scrollHeight; } });
          const cur = get();
          cur.turns.push({ role: "assistant", content: res.text + (res.truncated ? "\n\n（回答被截断，可以让我分段继续。）" : "") });
          save(cur);
        } catch (e) {
          if (e && e.text && e.code !== "refused") { const cur = get(); cur.turns.push({ role: "assistant", content: e.text + "\n\n（回答中断）" }); save(cur); }
          if (!e || e.code !== "cancelled") { err.textContent = PB.aiErrorText(e); err.hidden = false; PB.aiHandleError(e); }
        } finally {
          busy = false; ctl = null; send.disabled = false; stop.hidden = true;
          render();
        }
      }
      send.addEventListener("click", ask);
      stop.addEventListener("click", () => { if (ctl) ctl.abort(); });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(); } });
      render();
    }
  };
})();
