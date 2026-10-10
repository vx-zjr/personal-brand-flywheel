/* 43-tool-niche.js — 领域评估矩阵：为最多 6 个候选领域按 6 项加权标准打分并排序。
   存储键 niche = { topics: [{id, name, scores: {criterionId: 1..5}}] } */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;

  PB.nicheScore = function nicheScore(t) {
    const C = PB.content.tools.niche.criteria;
    const sum = C.reduce((n, c) => n + (+t.scores[c.id] || 0) * c.weight, 0);
    const max = C.reduce((n, c) => n + 5 * c.weight, 0);
    return Math.round((sum / max) * 100);
  };

  PB.tools.niche = {
    mount(shell) {
      const cfg = PB.content.tools.niche;
      const isExample = () => !PB.store.has("niche");
      const get = () => PB.store.get("niche", { topics: cfg.example.map((t, i) => ({ id: "ex" + i, name: t.name, scores: Object.assign({}, t.scores) })) });
      const save = (st) => PB.store.set("niche", st);
      const left = h("div", { style: { display: "grid", gap: "10px" } });
      const right = h("div", { class: "panel tint", "aria-live": "polite" });
      shell.body.append(h("div", { class: "tool-split wide-left" }, left, right));

      function renderLeft() {
        const st = get();
        PB.clear(left);
        st.topics.forEach((t, ti) => {
          const nameId = "nc-name-" + t.id;
          const name = h("input", { class: "input", id: nameId, type: "text", value: t.name, placeholder: "领域名称，如：职场数据分析", "aria-label": "领域名称" });
          name.addEventListener("input", PB.debounce(() => { const cur = get(); cur.topics[ti].name = name.value; save(cur); renderRight(); }, 300));
          const del = h("button", { class: "btn sm ghost", type: "button", "aria-label": "删除这个领域", disabled: st.topics.length <= 1 }, PB.icon("trash", "sm"));
          del.addEventListener("click", () => { const cur = get(); cur.topics.splice(ti, 1); save(cur); renderLeft(); renderRight(); });
          const sliders = h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px 14px" } });
          cfg.criteria.forEach((c) => {
            const id = "nc-" + t.id + "-" + c.id;
            const val = h("span", { class: "mono small", text: String(t.scores[c.id] || 3) });
            const range = h("input", { type: "range", id, min: "1", max: "5", step: "1", value: String(t.scores[c.id] || 3), "aria-label": t.name + " · " + c.name });
            range.addEventListener("input", () => { val.textContent = range.value; const cur = get(); cur.topics[ti].scores[c.id] = +range.value; save(cur); renderRight(); });
            sliders.append(h("div", { class: "field" }, h("label", { for: id, class: "field-label", style: { display: "flex", justifyContent: "space-between" } }, h("span", { text: c.name + (c.weight !== 1 ? " ×" + c.weight : "") }), val), range, h("span", { class: "field-hint", text: c.hint })));
          });
          left.append(h("div", { class: "panel" }, h("div", { style: { display: "flex", gap: "8px", alignItems: "center" } }, name, del), sliders));
        });
        const add = h("button", { class: "btn sm", type: "button", disabled: st.topics.length >= 6 }, PB.icon("plus", "sm"), "添加候选领域");
        add.addEventListener("click", () => {
          const cur = get();
          const scores = {};
          cfg.criteria.forEach((c) => { scores[c.id] = 3; });
          cur.topics.push({ id: PB.uid("t"), name: "", scores });
          save(cur); renderLeft(); renderRight();
          const inputs = PB.$$("input[type=text]", left);
          if (inputs.length) inputs[inputs.length - 1].focus();
        });
        left.append(h("div", { class: "btn-row" }, add, PB.confirmBtn("恢复示例", "再点一次恢复", () => { PB.store.remove("niche"); renderLeft(); renderRight(); })));
      }

      function renderRight() {
        const st = get();
        PB.clear(right);
        PB.clear(shell.badges);
        if (isExample()) shell.badges.append(PB.exampleBadge("示例数据"));
        const ranked = st.topics.map((t) => ({ t, score: PB.nicheScore(t) })).sort((a, b) => b.score - a.score);
        right.append(h("div", { class: "panel-title" }, h("span", { text: "加权得分排名" }), h("span", { class: "muted small", text: "满分 100" })));
        right.append(PB.hbars(ranked.map((r, i) => ({ label: r.t.name || "（未命名）", value: r.score, display: String(r.score), strong: i === 0 })), 100));
        const top = ranked[0], second = ranked[1];
        if (top) {
          const gap = second ? top.score - second.score : 100;
          const weak = PB.content.tools.niche.criteria.filter((c) => (+top.t.scores[c.id] || 0) <= 2).map((c) => c.name);
          right.append(h("div", { class: "rec" },
            h("strong", { text: "建议：" + (top.t.name || "排名第一的领域") }),
            h("p", { class: "small", text: gap < 5 && second ? "前两名非常接近（相差 " + gap + " 分）。可以考虑把“" + (top.t.name || "第一名") + "”与“" + (second.t.name || "第二名") + "”组合成一个交叉定位，或先各发 5 篇内容，用真实反馈决定。" : "领先第二名 " + gap + " 分，可以作为起步定位。" }),
            weak.length ? h("p", { class: "small", text: "需要留意的短板：" + weak.join("、") + "。想清楚如何弥补，或用技能叠加找到切口。" }) : null));
        }
        right.append(h("p", { class: "note", html: PB.md("得分 = Σ（分数 × 权重）÷ Σ（5 × 权重）。“需求”权重最高，因为没有需求的热爱很难成为品牌；评估之后，回到 [[tools.canvas|定位画布]] 写出一句话定位。") }));
      }

      renderLeft();
      renderRight();
    }
  };
})();
