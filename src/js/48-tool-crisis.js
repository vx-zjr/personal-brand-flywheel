/* 48-tool-crisis.js — 危机应对决策树：问题 → 选项 → 结论（步骤 + 声明模板），可请 Claude 起草回应。
   不保存任何内容（情况描述不会写入存储）。决策树数据在 content/tools.json → crisis。 */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;

  PB.tools.crisis = {
    mount(shell) {
      const cfg = PB.content.tools.crisis;
      let path = [];
      let node = cfg.start;
      const box = h("div", { class: "panel" });
      const ai = PB.aiPanel("Claude 起草的回应（发布前请务必核对）");
      shell.body.append(box);

      function render() {
        PB.clear(box);
        const trail = h("div", { class: "crisis-path" }, h("strong", { text: "路径：" }), path.length ? path.map((p) => h("span", { text: p.label })) : h("span", { text: "开始" }));
        box.append(trail);
        const q = cfg.nodes[node];
        if (q) {
          box.append(h("div", { class: "crisis-q", text: q.q }));
          box.append(h("div", { class: "crisis-options" }, q.options.map((o) => {
            const b = h("button", { type: "button", class: "crisis-opt" }, h("span", { text: o.label }), PB.icon("arrowRight", "sm"));
            b.addEventListener("click", () => { path.push({ node, label: o.label }); node = o.next; render(); const first = box.querySelector(".crisis-opt, .btn"); if (first) first.focus(); });
            return b;
          })));
        } else {
          const out = cfg.outcomes[node];
          box.append(h("aside", { class: "b-callout tone-" + (out.tone || "note") }, h("span", { class: "callout-label" }, PB.icon(out.tone || "note", "sm"), "建议做法"), h("div", { class: "callout-title", text: out.title })));
          box.append(PB.blocks.steps({ items: out.steps.map((s) => ({ title: s })) }));
          if (out.template) box.append(PB.blocks.templates({ items: [{ title: "声明模板（替换【】中的内容）", text: out.template }] }));
          if (out.note) box.append(h("p", { class: "note", text: out.note }));
          const sitId = PB.uid("crisis-sit");
          const sit = h("textarea", { class: "textarea", id: sitId, rows: "3", maxlength: "1500", placeholder: "简要描述发生了什么、目前的影响、你已经做了什么（只用于这次生成，不会被保存）" });
          const go = h("button", { class: "btn sm ai", type: "button" }, PB.icon("sparkle", "sm"), "让 Claude 起草回应");
          go.addEventListener("click", () => {
            const situation = sit.value.trim();
            if (!situation) { sit.focus(); PB.toast("先简单描述一下情况"); return; }
            const prompt = PB.fill(PB.content.tools.ai.crisisDraft, { path: path.map((p) => p.label).join(" → ") + " → " + out.title, situation });
            ai.run((signal, partial) => PB.cap.sample(prompt, { signal, cache: false, onText: ({ text }) => partial(text) }), (res, o) => { o.innerHTML = PB.mdBlock(res.text); });
          });
          box.append(h("div", { class: "panel", "data-cap": "sample", hidden: true }, h("label", { for: sitId, class: "field-label", text: "需要一份更贴合情况的初稿？" }), sit, h("div", { class: "btn-row" }, go)), ai.el);
        }
        box.append(h("div", { class: "btn-row" },
          path.length ? h("button", { class: "btn sm", type: "button", onclick: () => { const last = path.pop(); node = last.node; render(); } }, PB.icon("arrowLeft", "sm"), "上一步") : null,
          path.length ? h("button", { class: "btn sm ghost", type: "button", onclick: () => { path = []; node = cfg.start; ai.el.hidden = true; render(); } }, PB.icon("refresh", "sm"), "重新开始") : null));
        PB.applyCaps(box);
      }
      render();
    }
  };
})();
