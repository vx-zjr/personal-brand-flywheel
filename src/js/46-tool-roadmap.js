/* 46-tool-roadmap.js — 90 天计划：12 周甘特条 + 当前周标记 + 四阶段任务清单。
   存储键 roadmap = { start: "YYYY-MM-DD"|null, done: { <taskId>: 1 } } */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;

  PB.roadmapWeek = function roadmapWeek(start) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start || "");
    if (!m) return 1;
    const s = new Date(+m[1], +m[2] - 1, +m[3]);
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((today - s) / (7 * 864e5)) + 1;
  };

  PB.tools.roadmap = {
    mount(shell) {
      const phases = PB.content.tools.roadmap.phases;
      const get = () => PB.store.get("roadmap", { start: null, done: {} });
      const save = (st) => PB.store.set("roadmap", st);
      const head = h("div", { class: "panel tint" });
      const grid = h("div", { class: "phase-grid" });
      shell.body.append(head, grid);

      function render() {
        const st = get();
        const start = st.start || PB.today();
        const week = PB.roadmapWeek(start);
        const total = phases.reduce((n, p) => n + p.tasks.length, 0);
        const done = phases.reduce((n, p) => n + p.tasks.filter((t) => st.done[t.id]).length, 0);
        PB.clear(head);
        const dateId = PB.uid("rm-start");
        const date = h("input", { class: "input", type: "date", id: dateId, value: start, style: { maxWidth: "180px" } });
        date.addEventListener("change", () => { const cur = get(); cur.start = date.value || null; save(cur); render(); });
        const weekText = week < 1 ? "计划将于 " + start + " 开始" : week > 12 ? "12 周已结束，记得写复盘、做一次体检" : "现在是第 " + week + " 周";
        head.append(h("div", { class: "result-head" },
          h("div", {}, h("div", { class: "small muted", text: "总进度" }), h("div", { class: "big-number", text: Math.round((done / total) * 100) + "%" }, h("span", { class: "unit", text: done + " / " + total + " 项" }))),
          h("div", { style: { display: "grid", gap: "6px", justifyItems: "end" } }, h("strong", { text: weekText }), h("div", { class: "btn-row" }, h("label", { for: dateId, class: "small muted", text: "开始日期" }), date))));
        const gantt = h("div", { class: "gantt", role: "img", "aria-label": "12 周路线图，" + weekText });
        for (let w = 1; w <= 12; w++) gantt.append(h("span", { class: "gantt-wk", style: { left: ((w - 0.5) / 12) * 100 + "%", transform: "translateX(-50%)" }, text: "W" + w }));
        phases.forEach((p) => {
          const pd = p.tasks.filter((t) => st.done[t.id]).length;
          gantt.append(h("div", { class: "gantt-bar " + p.stage, style: { gridColumn: p.weeks[0] + " / " + (p.weeks[1] + 1) }, title: p.name + "：完成 " + pd + "/" + p.tasks.length },
            h("i", { style: { width: (pd / p.tasks.length) * 100 + "%" } }), h("span", { text: p.name + " " + pd + "/" + p.tasks.length })));
        });
        if (week >= 1 && week <= 12) gantt.append(h("span", { class: "gantt-now", "data-label": "本周", style: { left: "calc(" + ((week - 0.5) / 12) * 100 + "% - 1px)" } }));
        head.append(gantt);
        PB.clear(grid);
        phases.forEach((p) => {
          const pd = p.tasks.filter((t) => st.done[t.id]).length;
          const isCur = week >= p.weeks[0] && week <= p.weeks[1];
          grid.append(h("div", { class: "phase" + (isCur ? " current" : "") },
            h("div", { class: "phase-head" }, h("strong", {}, h("i", { class: "swatch " + p.stage, style: { width: "10px", height: "10px", borderRadius: "3px", display: "inline-block" } }), p.name, isCur ? h("span", { class: "badge build", text: "进行中" }) : null),
              h("span", { class: "muted", text: "第 " + p.weeks[0] + "–" + p.weeks[1] + " 周 · " + pd + "/" + p.tasks.length })),
            p.tasks.map((t) => {
              const id = "rm-" + t.id;
              const cb = h("input", { type: "checkbox", id, checked: !!st.done[t.id] });
              cb.addEventListener("change", () => { const cur = get(); const d2 = Object.assign({}, cur.done); if (cb.checked) d2[t.id] = 1; else delete d2[t.id]; cur.done = d2; if (!cur.start) cur.start = start; save(cur); render(); });
              return h("label", { class: "task" + (st.done[t.id] ? " on" : ""), for: id }, cb, h("span", {}, h("span", { class: "task-text", text: t.text }), t.link ? h("a", { href: "#" + t.link, text: "→" , "aria-label": "相关内容：" + PB.routeTitle(t.link) }) : null));
            })));
        });
        shell.actions.textContent = "";
        shell.actions.append(PB.confirmBtn("重置进度", "再点一次重置", () => { save({ start: st.start, done: {} }); render(); }));
      }
      render();
    }
  };
})();
