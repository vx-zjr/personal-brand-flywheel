/* 42-tool-canvas.js — 定位画布：11 个字段 → 定位陈述、三种简介、电梯演讲；可请 Claude 诊断。
   存储键 canvas = { fields: { <fieldId>: string } }。模板在 content/tools.json → canvas.outputs。 */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;
  const len = (s) => Array.from(String(s || "")).length;

  // 用字段值填充模板；缺失字段显示为【字段名】
  PB.canvasOutputs = function canvasOutputs(fields, useExample) {
    const cfg = PB.content.tools.canvas;
    const vals = {};
    cfg.fields.forEach((f) => {
      const v = (fields && fields[f.id] ? String(fields[f.id]) : "").trim();
      vals[f.id] = v || (useExample ? f.example : "【" + f.label + "】");
    });
    return cfg.outputs.map((o) => ({ ...o, text: o.template.replace(/\{(\w+)\}/g, (m, k) => (vals[k] !== undefined ? vals[k] : m)).replace(/。。/g, "。") }));
  };

  PB.tools.canvas = {
    mount(shell) {
      const cfg = PB.content.tools.canvas;
      const get = () => PB.store.get("canvas", { fields: {} });
      const form = h("div", { class: "panel" });
      const outBox = h("div", { class: "panel tint", "aria-live": "polite" });
      const ai = PB.aiPanel("Claude 的定位诊断");
      shell.body.append(h("div", { class: "tool-split" }, form, h("div", { style: { display: "grid", gap: "14px" } }, outBox, ai.el)));
      const inputs = {};
      let local = Object.assign({}, get().fields);
      const persist = PB.debounce(() => PB.store.set("canvas", { fields: Object.assign({}, local) }), 350);

      form.append(h("div", { class: "panel-title" }, h("span", { text: "填写你的定位信息" }), h("span", { class: "muted small", text: "自动保存" })));
      const grid = h("div", { style: { display: "grid", gap: "10px" } });
      cfg.fields.forEach((f) => {
        const id = "cv-" + f.id;
        const multi = f.id === "proof" || f.id === "mission";
        const el = multi
          ? h("textarea", { class: "textarea", id, rows: "2", placeholder: "例：" + f.example, style: { minHeight: "60px" } })
          : h("input", { class: "input", id, type: "text", placeholder: "例：" + f.example, autocomplete: "off" });
        el.value = local[f.id] || "";
        el.addEventListener("input", () => { local[f.id] = el.value; persist(); renderOut(); });
        inputs[f.id] = el;
        grid.append(h("div", { class: "field" }, h("label", { for: id, text: f.label }), el));
      });
      form.append(grid);
      const fillExample = () => { cfg.fields.forEach((f) => { local[f.id] = f.example; inputs[f.id].value = f.example; }); PB.store.set("canvas", { fields: Object.assign({}, local) }); renderOut(); };
      const clearAll = () => { cfg.fields.forEach((f) => { local[f.id] = ""; inputs[f.id].value = ""; }); PB.store.set("canvas", { fields: {} }); renderOut(); };
      const aiBtn = h("button", { class: "btn sm ai", type: "button", "data-cap": "sample", hidden: true }, PB.icon("sparkle", "sm"), "让 Claude 诊断我的定位");
      aiBtn.addEventListener("click", runAi);
      form.append(h("div", { class: "btn-row" },
        h("button", { class: "btn sm", type: "button", onclick: fillExample }, "填入示例"),
        PB.confirmBtn("清空", "再点一次清空", clearAll),
        aiBtn));

      function renderOut() {
        const filled = cfg.fields.some((f) => (local[f.id] || "").trim());
        const outs = PB.canvasOutputs(local, !filled);
        PB.clear(outBox);
        PB.clear(shell.badges);
        if (!filled) shell.badges.append(PB.exampleBadge("示例输出"));
        outBox.append(h("div", { class: "panel-title" }, h("span", { text: filled ? "实时生成的表达" : "示例输出：基于" + cfg.exampleName }), h("span", { class: "muted small", text: "【】表示尚未填写" })));
        let group = null;
        outs.forEach((o) => {
          if (o.group !== group) { group = o.group; outBox.append(h("div", { class: "out-group-title", text: group })); }
          const n = len(o.text.replace(/【[^】]*】/g, ""));
          const over = o.limit && n > o.limit;
          const textEl = h("div", { class: "out-text", html: PB.markSlots(o.text) });
          outBox.append(h("div", { class: "out" },
            h("div", { class: "out-head" }, h("span", { class: "out-title", text: o.title }),
              h("span", { class: "out-meta" }, h("span", { class: "out-count" + (over ? " over" : ""), text: n + (o.limit ? " / " + o.limit + " 字" : " 字") }), PB.copyBtn(() => o.text, "复制", textEl))),
            textEl,
            over ? h("div", { class: "note", text: "超过建议长度，试着删去修饰语或合并信息。" }) : null));
        });
      }

      function runAi() {
        const text = cfg.fields.map((f) => f.label + "：" + ((local[f.id] || "").trim() || "（未填写）")).join("\n");
        const prompt = PB.fill(PB.content.tools.ai.canvasReview, { canvas: text });
        ai.run((signal) => PB.cap.sample.json(prompt, { signal }), (res, out) => {
          if (!res || typeof res !== "object") { out.append(h("p", { text: "没有得到有效的结果，请再试一次。" })); return; }
          const list = (title, arr) => Array.isArray(arr) && arr.length ? h("div", {}, h("div", { class: "out-group-title", text: title }), h("ul", {}, arr.map((t) => h("li", { text: String(t) })))) : null;
          out.append(h("div", { class: "result-head" },
            h("div", {}, h("div", { class: "small muted", text: "定位清晰度与独特性" }), h("div", { class: "big-number", text: String(res.score !== undefined ? res.score : "—") }, h("span", { class: "unit", text: "/ 100" }))),
            res.verdict ? h("div", { class: "level-name", style: { fontSize: "18px", maxWidth: "260px", textAlign: "right" }, text: String(res.verdict) }) : null));
          const strengths = list("优点", res.strengths), issues = list("问题", res.issues);
          if (strengths) out.append(strengths);
          if (issues) out.append(issues);
          if (Array.isArray(res.statements) && res.statements.length) {
            out.append(h("div", { class: "out-group-title", text: "改进后的一句话定位" }));
            res.statements.forEach((t) => { const te = h("div", { class: "out-text", text: String(t) }); out.append(h("div", { class: "out" }, te, h("div", { class: "btn-row" }, PB.copyBtn(String(t), "复制", te)))); });
          }
          if (res.bio) { const te = h("div", { class: "out-text", text: String(res.bio) }); out.append(h("div", { class: "out-group-title", text: "一句话简介" }), h("div", { class: "out" }, te, h("div", { class: "btn-row" }, PB.copyBtn(String(res.bio), "复制", te)))); }
          const next = list("下一步", res.next);
          if (next) out.append(next);
        });
      }

      renderOut();
    }
  };
})();
