/* 47-tool-metrics.js — 指标仪表盘：按月记录 6 项指标 → 指标卡（环比）+ 小多图 + 可编辑数据表 + 北极星指标。
   存储键 metrics = { rows: [{month:"YYYY-MM", <fieldId>: number|null}], star: fieldId }。
   每个指标单独成图（不同量纲不共用坐标轴）。 */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;

  function nextMonth(m) {
    const mm = /^(\d{4})-(\d{2})$/.exec(m || "");
    const d = mm ? new Date(+mm[1], +mm[2], 1) : new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }
  const monthLabel = (m) => { const mm = /^(\d{4})-(\d{2})$/.exec(m || ""); return mm ? +mm[2] + "月" : m; };

  PB.tools.metrics = {
    mount(shell) {
      const cfg = PB.content.tools.metrics;
      const isExample = () => !PB.store.has("metrics");
      const get = () => PB.store.get("metrics", { rows: JSON.parse(JSON.stringify(cfg.example)), star: "opportunities" });
      const save = (st) => { st.rows.sort((a, b) => String(a.month).localeCompare(String(b.month))); PB.store.set("metrics", st); };
      const tiles = h("div", { class: "stat-grid" });
      const charts = h("div", { class: "small-multiples" });
      const table = h("div", { class: "panel" });
      shell.body.append(tiles, charts, table);

      function render() {
        const st = get();
        const rows = st.rows;
        PB.clear(shell.badges);
        if (isExample()) shell.badges.append(PB.exampleBadge("示例数据"));
        PB.clear(tiles); PB.clear(charts);
        if (!rows.length) {
          tiles.append(h("div", { class: "empty", style: { gridColumn: "1 / -1" }, text: "还没有数据。点击下方“添加月份”，记录第一个月的关注者、订阅、机会与收入。" }));
        }
        const last = rows[rows.length - 1], prev = rows[rows.length - 2];
        if (last) cfg.fields.forEach((f) => {
          const v = last[f.id], pv = prev ? prev[f.id] : null;
          let delta = null, cls = "flat";
          if (v !== null && v !== undefined && pv !== null && pv !== undefined && pv !== 0) { delta = ((v - pv) / Math.abs(pv)) * 100; cls = delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat"; }
          else if (pv === 0 && v > 0) { cls = "up"; }
          const star = st.star === f.id;
          const tile = h("button", { type: "button", class: "stat selectable" + (star ? " star" : ""), "aria-pressed": star ? "true" : "false", title: "设为北极星指标" },
            h("span", { class: "stat-label" }, h("span", { text: f.name }), star ? h("span", { class: "badge build" }, PB.icon("star", "sm"), "北极星") : null),
            h("span", { class: "stat-value" }, f.id === "revenue" ? PB.money(v || 0) : PB.fmt(v), f.unit && f.id !== "revenue" ? h("span", { class: "unit", text: f.unit }) : null),
            h("span", { class: "delta " + cls, text: delta === null ? (pv === 0 && v > 0 ? "较上月：从 0 起步" : "较上月：—") : "较上月 " + (delta > 0 ? "+" : "") + delta.toFixed(1) + "%" }));
          tile.addEventListener("click", () => { const cur = get(); cur.star = f.id; save(cur); render(); });
          tiles.append(tile);
        });
        if (rows.length) cfg.fields.forEach((f) => {
          charts.append(h("div", { class: "sm-chart" + (st.star === f.id ? " star" : "") },
            h("div", { class: "sm-chart-title" }, h("span", { text: f.name }), h("span", { class: "muted", text: monthLabel(rows[0].month) + "–" + monthLabel(rows[rows.length - 1].month) })),
            PB.lineChart({ title: f.name, unit: f.unit, points: rows.map((r) => ({ label: monthLabel(r.month), full: r.month, value: r[f.id] })) })));
        });
        renderTable(st);
      }

      function renderTable(st) {
        PB.clear(table);
        table.append(h("div", { class: "panel-title" }, h("span", { text: "数据表（直接编辑，自动保存）" }),
          h("span", { class: "btn-row" }, PB.copyBtn(() => toCsv(st), "复制 CSV"), PB.saveBtn("保存 CSV", "brand-metrics.csv", () => toCsv(get()), "text/csv"))));
        const thead = h("tr", {}, h("th", { text: "月份" }), cfg.fields.map((f) => h("th", { text: f.name + (f.unit ? "（" + f.unit + "）" : "") })), h("th", {}));
        const tbody = h("tbody", {});
        st.rows.forEach((r, ri) => {
          const month = h("input", { type: "month", value: r.month, "aria-label": "月份" });
          month.addEventListener("change", () => { const cur = get(); cur.rows[ri].month = month.value; save(cur); render(); });
          const cells = cfg.fields.map((f) => {
            const inp = h("input", { type: "number", step: f.unit === "%" ? "0.1" : "1", value: r[f.id] === null || r[f.id] === undefined ? "" : String(r[f.id]), "aria-label": r.month + " " + f.name });
            inp.addEventListener("change", () => { const cur = get(); cur.rows[ri][f.id] = inp.value === "" ? null : +inp.value; save(cur); render(); });
            return h("td", {}, inp);
          });
          const del = h("button", { class: "btn sm ghost", type: "button", "aria-label": "删除 " + r.month }, PB.icon("x", "sm"));
          del.addEventListener("click", () => { const cur = get(); cur.rows.splice(ri, 1); save(cur); render(); });
          tbody.append(h("tr", {}, h("td", {}, month), cells, h("td", {}, del)));
        });
        table.append(h("div", { class: "table-wrap" }, h("table", { class: "data-table" }, h("thead", {}, thead), tbody)));
        const add = h("button", { class: "btn sm primary", type: "button" }, PB.icon("plus", "sm"), "添加月份");
        add.addEventListener("click", () => {
          const cur = get();
          const lastRow = cur.rows[cur.rows.length - 1];
          const row = { month: lastRow ? nextMonth(lastRow.month) : PB.today().slice(0, 7) };
          cfg.fields.forEach((f) => { row[f.id] = null; });
          cur.rows.push(row);
          save(cur); render();
        });
        table.append(h("div", { class: "btn-row" }, add,
          isExample() ? h("button", { class: "btn sm", type: "button", onclick: () => { save({ rows: [], star: get().star }); render(); } }, "清空示例，开始记录") : PB.confirmBtn("清空数据", "再点一次清空", () => { save({ rows: [], star: get().star }); render(); }),
          h("span", { class: "note", text: "点击上方指标卡可以设定北极星指标。" })));
      }
      function toCsv(st) {
        const head = ["月份"].concat(cfg.fields.map((f) => f.name));
        return head.join(",") + "\n" + st.rows.map((r) => [r.month].concat(cfg.fields.map((f) => (r[f.id] === null || r[f.id] === undefined ? "" : r[f.id]))).join(",")).join("\n");
      }
      render();
    }
  };
})();
