/* 20-charts.js — 轻量 SVG 图表：雷达图、单序列折线图（小多图）、横向条形图，以及共享的悬停提示。
   规范（来自数据可视化准则）：2px 线、≥8px 端点、10% 面积填充、细网格、文字只用墨色、
   单序列不加图例、两个以上序列必须有图例、提示只做增强（数值另有直接标注或表格）。 */
(function () {
  "use strict";
  const PB = window.PB;
  const { h, s } = PB;

  /* ---------- 悬停提示 ---------- */
  const tip = {
    el: null,
    show(rows, x, y, head) {
      if (!this.el) { this.el = h("div", { class: "tooltip", role: "tooltip" }); document.body.append(this.el); }
      PB.clear(this.el);
      if (head) this.el.append(h("div", { class: "tt-head", text: head }));
      rows.forEach((r) => this.el.append(h("div", { class: "tt-row" }, r.key ? h("i", { class: "tt-key " + (r.key === "b" ? "b" : "") }) : null, h("span", { class: "tt-val", text: r.value }), r.label ? h("span", { text: r.label }) : null)));
      this.el.hidden = false;
      const w = this.el.offsetWidth, hgt = this.el.offsetHeight;
      let left = x + 14, top = y - hgt - 10;
      if (left + w > window.innerWidth - 8) left = x - w - 14;
      if (top < 8) top = y + 16;
      this.el.style.left = Math.max(8, left) + "px";
      this.el.style.top = top + "px";
    },
    hide() { if (this.el) this.el.hidden = true; }
  };
  PB.tip = tip;
  window.addEventListener("scroll", () => tip.hide(), { passive: true });

  function niceMax(v) {
    if (!(v > 0)) return 1;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / exp;
    const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nf * exp;
  }
  PB.niceMax = niceMax;

  /* ---------- 雷达图 ----------
     opts: { dims: [{id, name}], series: [{name, values: {dimId: number}, cls: "a"|"b"}], max: 5 } */
  PB.radar = function radar(opts) {
    const W = 380, H = 330, cx = W / 2, cy = 168, R = 112;
    const dims = opts.dims, n = dims.length, max = opts.max || 5;
    const ang = (i) => (-90 + (i * 360) / n) * (Math.PI / 180);
    const pt = (i, v) => [cx + Math.cos(ang(i)) * (R * v) / max, cy + Math.sin(ang(i)) * (R * v) / max];
    const svg = s("svg", { viewBox: "0 0 " + W + " " + H, class: "chart radar", role: "img", "aria-label": opts.label || "品牌雷达图" });
    for (let lv = 1; lv <= max; lv++) {
      const pts = dims.map((d, i) => pt(i, lv).map((x) => x.toFixed(1)).join(",")).join(" ");
      svg.append(s("polygon", { points: pts, class: "grid" }));
    }
    dims.forEach((d, i) => {
      const [x, y] = pt(i, max);
      svg.append(s("line", { x1: cx, y1: cy, x2: x.toFixed(1), y2: y.toFixed(1), class: "grid" }));
      const [lx, ly] = [cx + Math.cos(ang(i)) * (R + 22), cy + Math.sin(ang(i)) * (R + 20)];
      const anchor = Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
      svg.append(s("text", { x: lx.toFixed(1), y: ly.toFixed(1), "text-anchor": anchor, "dominant-baseline": "middle", class: "label-dim", text: d.name }));
    });
    for (let lv = 1; lv <= max; lv++) {
      svg.append(s("text", { x: cx + 5, y: (cy - (R * lv) / max + 3).toFixed(1), "font-size": "10", text: String(lv) }));
    }
    const ordered = opts.series.slice().sort((a, b) => (a.cls === "b" ? -1 : 1) - (b.cls === "b" ? -1 : 1));
    ordered.forEach((ser) => {
      const pts = dims.map((d, i) => pt(i, PB.clamp(+ser.values[d.id] || 0, 0, max)).map((x) => x.toFixed(1)).join(",")).join(" ");
      svg.append(s("polygon", { points: pts, class: "area-" + ser.cls }));
      svg.append(s("polygon", { points: pts, class: "line series-" + ser.cls, fill: "none" }));
      dims.forEach((d, i) => {
        const [x, y] = pt(i, PB.clamp(+ser.values[d.id] || 0, 0, max));
        svg.append(s("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: 4, class: "dot series-" + ser.cls }));
      });
    });
    // 每个维度一个扇形命中区：悬停或聚焦时显示所有序列在该维度的值
    dims.forEach((d, i) => {
      const a0 = ang(i - 0.5), a1 = ang(i + 0.5), rr = R + 14;
      const pts = [[cx, cy], [cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr], [cx + Math.cos(ang(i)) * rr, cy + Math.sin(ang(i)) * rr], [cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr]];
      const wedge = s("polygon", { points: pts.map((p) => p.map((x) => x.toFixed(1)).join(",")).join(" "), class: "hit", tabindex: "0", "aria-label": d.name + "：" + opts.series.map((se) => se.name + " " + PB.fmt(se.values[d.id], 1)).join("，") });
      const show = (ev) => {
        const rect = wedge.getBoundingClientRect();
        const x = ev && ev.clientX !== undefined ? ev.clientX : rect.left + rect.width / 2;
        const y = ev && ev.clientY !== undefined ? ev.clientY : rect.top + rect.height / 2;
        tip.show(opts.series.map((se) => ({ key: se.cls, value: PB.fmt(se.values[d.id], 1), label: se.name })), x, y, d.name);
      };
      wedge.addEventListener("pointermove", show);
      wedge.addEventListener("focus", () => show());
      wedge.addEventListener("pointerleave", () => tip.hide());
      wedge.addEventListener("blur", () => tip.hide());
      svg.append(wedge);
    });
    const wrap = h("div", { class: "radar-wrap" }, svg);
    if (opts.series.length > 1) {
      wrap.append(h("div", { class: "chart-legend" }, opts.series.map((se) => h("span", {}, h("i", { class: se.cls === "b" ? "b" : "" }), se.name))));
    }
    return wrap;
  };

  /* ---------- 单序列折线图 ----------
     opts: { points: [{label, value}], unit, title, star } */
  PB.lineChart = function lineChart(opts) {
    const W = 300, H = 132, L = 36, Rr = 34, T = 12, B = 22;
    const pts = opts.points.filter((p) => p.value !== null && p.value !== undefined && p.value !== "" && !isNaN(p.value));
    const svg = s("svg", { viewBox: "0 0 " + W + " " + H, class: "chart line-chart", role: "img", "aria-label": (opts.title || "") + "趋势" });
    if (pts.length === 0) {
      svg.append(s("text", { x: W / 2, y: H / 2, "text-anchor": "middle", text: "暂无数据" }));
      return svg;
    }
    const maxV = niceMax(Math.max(...pts.map((p) => +p.value)) || 1);
    const pw = W - L - Rr, ph = H - T - B;
    const xAt = (i) => L + (pts.length === 1 ? pw / 2 : (i * pw) / (pts.length - 1));
    const yAt = (v) => T + ph - (v / maxV) * ph;
    [0, maxV / 2, maxV].forEach((tv) => {
      const y = yAt(tv).toFixed(1);
      svg.append(s("line", { x1: L, x2: W - Rr, y1: y, y2: y, class: tv === 0 ? "axis" : "grid" }));
      svg.append(s("text", { x: L - 6, y: +y + 4, "text-anchor": "end", "font-size": "10.5", text: PB.compact(tv) }));
    });
    const labelIdx = pts.length <= 3 ? pts.map((p, i) => i) : [0, pts.length - 1];
    labelIdx.forEach((i) => svg.append(s("text", { x: xAt(i), y: H - 6, "text-anchor": i === 0 && pts.length > 1 ? "start" : i === pts.length - 1 && pts.length > 1 ? "end" : "middle", "font-size": "10.5", text: pts[i].label })));
    const d = pts.map((p, i) => (i ? "L" : "M") + xAt(i).toFixed(1) + "," + yAt(+p.value).toFixed(1)).join(" ");
    if (pts.length > 1) {
      svg.append(s("path", { d: d + " L" + xAt(pts.length - 1).toFixed(1) + "," + yAt(0).toFixed(1) + " L" + xAt(0).toFixed(1) + "," + yAt(0).toFixed(1) + " Z", class: "area-a" }));
      svg.append(s("path", { d, class: "line series-a", fill: "none" }));
    }
    const last = pts[pts.length - 1];
    const lx = xAt(pts.length - 1), ly = yAt(+last.value);
    svg.append(s("circle", { cx: lx.toFixed(1), cy: ly.toFixed(1), r: 4, class: "dot series-a" }));
    svg.append(s("text", { x: (lx + 6).toFixed(1), y: (ly + 4).toFixed(1), class: "label-strong", "font-size": "11.5", text: PB.compact(+last.value) + (opts.unit === "%" ? "%" : "") }));
    const cross = s("line", { x1: 0, x2: 0, y1: T, y2: T + ph, class: "crosshair", visibility: "hidden" });
    const hover = s("circle", { r: 4, class: "dot series-a", visibility: "hidden" });
    svg.append(cross, hover);
    const hit = s("rect", { x: L, y: T, width: pw, height: ph, class: "hit", tabindex: "0", "aria-label": (opts.title || "") + "：" + pts.map((p) => p.label + " " + PB.fmt(p.value)).join("，") });
    const at = (i, ev) => {
      const p = pts[i];
      const x = xAt(i), y = yAt(+p.value);
      cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
      hover.setAttribute("cx", x); hover.setAttribute("cy", y); hover.setAttribute("visibility", "visible");
      const rect = svg.getBoundingClientRect();
      const cxp = ev ? ev.clientX : rect.left + (x / W) * rect.width;
      const cyp = ev ? ev.clientY : rect.top + (y / H) * rect.height;
      tip.show([{ key: "a", value: PB.fmt(p.value) + (opts.unit || ""), label: opts.title || "" }], cxp, cyp, p.full || p.label);
    };
    let kIdx = pts.length - 1;
    hit.addEventListener("pointermove", (ev) => {
      const rect = svg.getBoundingClientRect();
      const vx = ((ev.clientX - rect.left) / rect.width) * W;
      let best = 0, bd = Infinity;
      pts.forEach((p, i) => { const dd = Math.abs(xAt(i) - vx); if (dd < bd) { bd = dd; best = i; } });
      kIdx = best;
      at(best, ev);
    });
    const off = () => { cross.setAttribute("visibility", "hidden"); hover.setAttribute("visibility", "hidden"); tip.hide(); };
    hit.addEventListener("pointerleave", off);
    hit.addEventListener("blur", off);
    hit.addEventListener("focus", () => at(kIdx));
    hit.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowLeft") { kIdx = Math.max(0, kIdx - 1); at(kIdx); ev.preventDefault(); }
      if (ev.key === "ArrowRight") { kIdx = Math.min(pts.length - 1, kIdx + 1); at(kIdx); ev.preventDefault(); }
    });
    svg.append(hit);
    return svg;
  };

  /* ---------- 横向条形图（HTML） ----------
     items: [{label, value, display, strong}], max */
  PB.hbars = function hbars(items, max) {
    const m = max || Math.max(...items.map((i) => +i.value || 0), 1);
    return h("div", { class: "hbar" }, items.map((it) =>
      h("div", { class: "hbar-row" + (it.strong ? " top" : "") },
        h("span", { class: "hbar-label", title: it.label, text: it.label }),
        h("span", { class: "hbar-track" }, h("span", { class: "hbar-fill", style: { width: PB.clamp(((+it.value || 0) / m) * 100, 0, 100) + "%" } })),
        h("span", { class: "hbar-val", text: it.display !== undefined ? it.display : PB.fmt(it.value) })
      )
    ));
  };
})();
