/* 40-tool-audit.js — 品牌体检：7 维度 × 3 题，雷达图 + 等级 + 短板建议 + 历史对比 + AI 30 天计划。
   存储键 audit = { answers: {"<dim>-<i>": 1..5}, history: [{date, total, level, scores: {dim: avg}}], compare: index|null } */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;

  function compute(cfg, answers) {
    const scores = {};
    let answered = 0, total = 0;
    cfg.dimensions.forEach((d) => {
      const vals = d.questions.map((q, i) => answers[d.id + "-" + i]).filter((v) => v >= 1 && v <= 5);
      answered += vals.length;
      total += d.questions.length;
      scores[d.id] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    const filled = Object.values(scores).filter((v) => v !== null);
    const avg = filled.length ? filled.reduce((a, b) => a + b, 0) / filled.length : 0;
    const score100 = Math.round(((avg - 1) / 4) * 100);
    return { scores, answered, total, complete: answered === total, score100: Math.max(0, score100) };
  }
  function levelFor(cfg, s) {
    let lv = cfg.levels[0];
    cfg.levels.forEach((l) => { if (s >= l.min) lv = l; });
    return lv;
  }
  PB.auditCompute = compute;

  PB.tools.audit = {
    mount(shell) {
      const cfg = PB.content.tools.audit;
      const body = shell.body;
      const get = () => PB.store.get("audit", { answers: {}, history: [], compare: null });
      const save = (st) => PB.store.set("audit", st);
      const quiz = h("div", { class: "panel" });
      const result = h("div", { class: "panel tint", "aria-live": "polite" });
      const ai = PB.aiPanel("Claude 的 30 天改进计划");
      body.append(h("div", { class: "tool-split wide-left" }, quiz, h("div", { style: { display: "grid", gap: "14px" } }, result, ai.el)));

      function renderQuiz() {
        const st = get();
        PB.clear(quiz);
        const c = compute(cfg, st.answers);
        const counter = h("span", { class: "mono small", text: c.answered + " / " + c.total });
        const bar = h("span", { style: { width: (c.answered / c.total) * 100 + "%" } });
        quiz.append(h("div", { class: "panel-title" }, h("span", { text: "21 道自评题（1 = 完全不符合，5 = 完全符合）" }), counter));
        quiz.append(h("div", { class: "meter" }, bar));
        cfg.dimensions.forEach((d) => {
          const block = h("div", { class: "quiz-dim" }, h("div", { class: "quiz-dim-head" }, h("strong", { text: d.name }), h("span", { class: "muted", text: d.desc })));
          d.questions.forEach((q, i) => {
            const key = d.id + "-" + i;
            const seg = h("div", { class: "seg", role: "radiogroup", "aria-label": q });
            const btns = [];
            for (let v = 1; v <= 5; v++) {
              const on = st.answers[key] === v;
              const b = h("button", { type: "button", role: "radio", "aria-checked": on ? "true" : "false", "aria-pressed": on ? "true" : "false", title: cfg.scale[v - 1], text: String(v) });
              b.addEventListener("click", () => {
                const cur = get();
                const answers = Object.assign({}, cur.answers);
                answers[key] = v;
                save(Object.assign({}, cur, { answers }));
                btns.forEach((x, xi) => { const o = xi + 1 === v; x.setAttribute("aria-pressed", o ? "true" : "false"); x.setAttribute("aria-checked", o ? "true" : "false"); });
                const cc = compute(cfg, answers);
                counter.textContent = cc.answered + " / " + cc.total;
                bar.style.width = (cc.answered / cc.total) * 100 + "%";
                renderResult();
              });
              btns.push(b);
              seg.append(b);
            }
            block.append(h("div", { class: "quiz-q" }, h("p", { text: q }), seg));
          });
          quiz.append(block);
        });
        quiz.append(h("div", { class: "btn-row" },
          h("button", { class: "btn sm ghost", type: "button", onclick: () => { const cur = get(); save(Object.assign({}, cur, { answers: {} })); renderQuiz(); renderResult(); } }, PB.icon("refresh", "sm"), "清空答案")));
      }

      function renderResult() {
        const st = get();
        const c = compute(cfg, st.answers);
        PB.clear(result);
        const isExample = c.answered === 0;
        const scores = isExample ? cfg.example : c.scores;
        const filled = Object.values(scores).filter((v) => v !== null && v !== undefined);
        const avg = filled.length ? filled.reduce((a, b) => a + b, 0) / filled.length : 0;
        const score100 = Math.max(0, Math.round(((avg - 1) / 4) * 100));
        const lv = levelFor(cfg, score100);
        PB.clear(shell.badges);
        if (isExample) shell.badges.append(PB.exampleBadge("示例结果"));
        result.append(h("div", { class: "result-head" },
          h("div", {}, h("div", { class: "small muted", text: isExample ? "示例结果（虚构），答题后显示你的结果" : c.complete ? "你的品牌健康度" : "已答 " + c.answered + " 题，以下为当前估算" }),
            h("div", { class: "big-number", text: String(score100) }, h("span", { class: "unit", text: "/ 100" }))),
          h("div", { style: { textAlign: "right" } }, h("div", { class: "level-name", text: lv.name }), h("div", { class: "small muted", style: { maxWidth: "240px" }, text: lv.text }))));
        const series = [{ name: isExample ? "示例" : "当前", values: scores, cls: "a" }];
        const cmp = !isExample && st.compare !== null && st.compare !== undefined && st.history[st.compare];
        if (cmp) series.push({ name: cmp.date, values: cmp.scores, cls: "b" });
        result.append(PB.radar({ dims: cfg.dimensions.map((d) => ({ id: d.id, name: d.name })), series, max: 5, label: "品牌体检雷达图" }));
        const sorted = cfg.dimensions.map((d) => ({ d, v: scores[d.id] })).filter((x) => x.v !== null && x.v !== undefined).sort((a, b) => a.v - b.v);
        const lowIds = sorted.slice(0, 2).map((x) => x.d.id);
        result.append(h("div", { class: "dim-bars" }, cfg.dimensions.map((d) => {
          const v = scores[d.id];
          return h("div", { class: "dim-bar" + (lowIds.indexOf(d.id) >= 0 ? " low" : "") },
            h("span", { text: d.name }), h("span", { class: "meter" }, h("span", { style: { width: v ? ((v - 1) / 4) * 100 + "%" : "0%" } })), h("span", { class: "val", text: v ? v.toFixed(1) : "—" }));
        })));
        if (sorted.length) {
          result.append(h("div", { class: "panel-title", text: "优先补齐的短板" }));
          sorted.slice(0, 2).forEach((x) => result.append(h("div", { class: "rec" },
            h("strong", {}, x.d.name + "（" + x.v.toFixed(1) + "）"),
            h("ul", {}, x.d.tips.map((t) => h("li", { text: t }))),
            h("a", { class: "small", href: "#" + x.d.link, text: "去看：" + PB.routeTitle(x.d.link) + " →" }))));
        }
        const actions = h("div", { class: "btn-row" });
        if (c.complete) {
          actions.append(h("button", { class: "btn primary sm", type: "button", onclick: () => {
            const cur = get();
            const entry = { date: PB.today(), total: score100, level: lv.name, scores: Object.assign({}, c.scores) };
            const history = (cur.history || []).filter((x) => x.date !== entry.date).concat([entry]).slice(-24);
            save(Object.assign({}, cur, { history }));
            PB.toast("已保存到体检历史");
            renderResult();
          } }, PB.icon("check", "sm"), "保存本次结果"));
        }
        const aiBtn = h("button", { class: "btn sm ai", type: "button", "data-cap": "sample", hidden: true }, PB.icon("sparkle", "sm"), "让 Claude 生成 30 天计划");
        aiBtn.addEventListener("click", () => runAi(scores));
        if (!isExample) actions.append(aiBtn);
        result.append(actions);
        if (st.history && st.history.length) {
          result.append(h("div", { class: "panel-title", text: "体检历史（点选一次与当前对比）" }));
          result.append(h("div", { class: "history" }, st.history.slice().reverse().map((e, ri) => {
            const idx = st.history.length - 1 - ri;
            const on = st.compare === idx;
            const del = h("button", { class: "btn sm ghost", type: "button", "aria-label": "删除这条记录" }, PB.icon("x", "sm"));
            del.addEventListener("click", (ev) => {
              ev.stopPropagation();
              const cur = get();
              const history = cur.history.filter((x, i) => i !== idx);
              save(Object.assign({}, cur, { history, compare: null }));
              renderResult();
            });
            const row = h("div", { class: "history-item" + (on ? " on" : ""), role: "button", tabindex: "0", "aria-pressed": on ? "true" : "false" },
              h("span", { text: e.date + " · " + e.level }), h("span", { class: "mono", text: e.total + " 分" }), del);
            const toggle = () => { const cur = get(); save(Object.assign({}, cur, { compare: on ? null : idx })); renderResult(); };
            row.addEventListener("click", toggle);
            row.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } });
            return row;
          })));
        }
        PB.applyCaps(result);
      }

      function runAi(scores) {
        const cfgA = PB.content.tools.ai;
        const lines = cfg.dimensions.map((d) => d.name + "：" + (scores[d.id] ? scores[d.id].toFixed(1) : "未作答"));
        const prompt = PB.fill(cfgA.auditPlan, { scores: lines.join("\n"), profile: PB.profileText() });
        ai.run((signal, partial) => PB.cap.sample(prompt, { signal, onText: ({ text }) => partial(text) }), (res, out) => { out.innerHTML = PB.mdBlock(res.text); });
      }

      renderQuiz();
      renderResult();
    }
  };
})();
