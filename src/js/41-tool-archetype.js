/* 41-tool-archetype.js — 品牌原型：12 张卡片，选择主原型与辅原型，汇总语调关键词。
   存储键 archetype = { primary: id|null, secondary: id|null, focus: id } */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;

  PB.tools.archetype = {
    mount(shell) {
      const list = PB.content.tools.archetypes;
      const get = () => PB.store.get("archetype", { primary: null, secondary: null, focus: list[0].id });
      const save = (st) => PB.store.set("archetype", st);
      const grid = h("div", { class: "arch-grid", role: "list" });
      const detail = h("div", { class: "panel tint", "aria-live": "polite" });
      const summary = h("div", { class: "panel" });
      shell.body.append(grid, h("div", { class: "tool-split" }, detail, summary));

      function render() {
        const st = get();
        const focus = list.find((a) => a.id === st.focus) || list[0];
        PB.clear(grid);
        list.forEach((a) => {
          const tag = st.primary === a.id ? "主" : st.secondary === a.id ? "辅" : null;
          const card = h("button", { type: "button", class: "arch-card" + (focus.id === a.id ? " focus" : ""), role: "listitem", "aria-pressed": focus.id === a.id ? "true" : "false" },
            h("span", { class: "en", text: a.en }), h("strong", { text: a.name }), h("span", { class: "d", text: a.desire }),
            tag ? h("span", { class: "badge " + (tag === "主" ? "build" : "maintain"), text: tag }) : null);
          card.addEventListener("click", () => { save(Object.assign({}, get(), { focus: a.id })); render(); });
          grid.append(card);
        });
        PB.clear(detail);
        const setRole = (role) => {
          const cur = Object.assign({}, get());
          if (role === "primary") { if (cur.secondary === focus.id) cur.secondary = null; cur.primary = cur.primary === focus.id ? null : focus.id; }
          else { if (cur.primary === focus.id) cur.primary = null; cur.secondary = cur.secondary === focus.id ? null : focus.id; }
          save(cur); render();
        };
        detail.append(
          h("div", { class: "panel-title" }, h("span", {}, focus.name + " · " + focus.en)),
          h("p", { class: "small", html: PB.md("**核心渴望**：" + focus.desire) }),
          h("p", { class: "small", html: PB.md("**语调关键词**：" + focus.voice.join("、")) }),
          h("p", { class: "small", html: PB.md("**适合的内容**：" + focus.content) }),
          h("p", { class: "small", html: PB.md("**需要警惕**：" + focus.watch) }),
          h("div", { class: "btn-row" },
            h("button", { class: "btn sm" + (st.primary === focus.id ? " primary" : ""), type: "button", onclick: () => setRole("primary") }, st.primary === focus.id ? "取消主原型" : "设为主原型"),
            h("button", { class: "btn sm", type: "button", onclick: () => setRole("secondary") }, st.secondary === focus.id ? "取消辅原型" : "设为辅原型")));
        PB.clear(summary);
        PB.clear(shell.badges);
        const p = list.find((a) => a.id === st.primary), s2 = list.find((a) => a.id === st.secondary);
        if (!p) {
          summary.append(h("div", { class: "panel-title", text: "你的品牌个性" }), h("p", { class: "note", text: "点选卡片查看详情，再设为主原型或辅原型。一般主原型决定 70% 的语调，辅原型补充 30% 的个性。" }),
            h("p", { class: "note", html: PB.md("例如：**智者 + 照顾者** = 理性深刻又温暖耐心的“专业陪伴者”；**反叛者 + 弄臣** = 犀利又幽默的行业观察者。") }));
          return;
        }
        const voice = p.voice.concat(s2 ? s2.voice.slice(0, 2) : []);
        summary.append(
          h("div", { class: "panel-title", text: "你的品牌个性" }),
          h("div", { class: "level-name", text: p.name + (s2 ? " + " + s2.name : "") }),
          h("div", { class: "chips" }, voice.map((v) => h("span", { class: "chip", text: v }))),
          h("p", { class: "small", html: PB.md("**内容方向**：" + p.content + (s2 ? "；辅以" + s2.content : "")) }),
          h("p", { class: "small", html: PB.md("**提醒自己**：" + p.watch + (s2 ? "；" + s2.watch : "")) }),
          PB.copyBtn(() => "品牌原型：" + p.name + (s2 ? " + " + s2.name : "") + "\n语调关键词：" + voice.join("、") + "\n内容方向：" + p.content + (s2 ? "；" + s2.content : "") + "\n需要警惕：" + p.watch + (s2 ? "；" + s2.watch : ""), "复制个性描述"));
      }
      render();
    }
  };
})();
