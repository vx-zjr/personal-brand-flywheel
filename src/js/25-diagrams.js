/* 25-diagrams.js — 概念图：飞轮、四圈交集、漏斗、沙漏、金字塔、价值阶梯、中心辐射。
   需要缩放的图（飞轮、四圈）用内联 SVG，只放短标签；其余用 HTML/CSS，便于在手机上换行。
   新增图类型：在 PB.diagrams 中注册 kind → function(data) 返回元素，并在 agent.md §5.4 记录数据形状。 */
(function () {
  "use strict";
  const PB = window.PB;
  const { h, s } = PB;
  const rad = (deg) => (deg * Math.PI) / 180;
  const STAGES = ["build", "maintain", "leverage"];

  function flywheelSvg(data, opts) {
    const o = opts || {};
    const C = 160, R = 108, gap = 5;
    const svg = s("svg", { viewBox: "0 0 320 320", class: "fly-svg", role: "img", "aria-label": "飞轮：" + data.stages.map((st) => st.title).join(" → ") + " → 回到" + data.stages[0].title + "，中心是" + (data.center || "") });
    const P = (deg, r) => [C + Math.cos(rad(deg)) * (r || R), C + Math.sin(rad(deg)) * (r || R)];
    svg.append(s("circle", { cx: C, cy: C, r: R + 22, class: "fly-track" }));
    svg.append(s("circle", { cx: C, cy: C, r: R - 22, class: "fly-track" }));
    data.stages.forEach((st, i) => {
      const a0 = -90 + i * 120 + gap, a1 = -90 + (i + 1) * 120 - gap;
      const [x0, y0] = P(a0), [x1, y1] = P(a1);
      const cls = STAGES[i] || "build";
      svg.append(s("path", { d: "M" + x0.toFixed(2) + "," + y0.toFixed(2) + " A" + R + "," + R + " 0 0 1 " + x1.toFixed(2) + "," + y1.toFixed(2), class: "fly-ring " + cls }));
      // 顺时针方向的箭头
      const tipDeg = a1 + (15 / R) * (180 / Math.PI);
      const [tx, ty] = P(tipDeg);
      const [b1x, b1y] = P(a1, R + 17), [b2x, b2y] = P(a1, R - 17);
      svg.append(s("polygon", { points: [b1x, b1y, tx, ty, b2x, b2y].map((v) => v.toFixed(2)).join(","), class: "fly-arrow " + cls }));
      const mid = -90 + i * 120 + 60;
      const [lx, ly] = P(mid, R + 34);
      const anchor = Math.abs(lx - C) < 10 ? "middle" : lx > C ? "start" : "end";
      svg.append(s("text", { x: lx.toFixed(1), y: (ly + 5).toFixed(1), "text-anchor": anchor, class: "fly-label", text: st.title }));
    });
    svg.append(s("text", { x: C, y: C + 6, "text-anchor": "middle", class: "fly-center", text: data.center || "" }));
    if (data.centerSub) svg.append(s("text", { x: C, y: C + 28, "text-anchor": "middle", class: "fly-center-sub", text: data.centerSub }));
    if (!o.still) {
      const g = s("g", { class: "fly-orbit" });
      g.append(s("circle", { cx: C, cy: C - R, r: 6 }));
      svg.append(g);
    }
    return svg;
  }
  PB.flywheelSvg = flywheelSvg;

  function linkFor(stageId, title) {
    const ch = PB.content.chapters[stageId];
    if (!ch) return null;
    const sec = ch.sections.find((x) => x.title === title || title.indexOf(x.title) === 0 || x.title.indexOf(title) === 0);
    return sec ? "#" + stageId + "." + sec.id : "#" + stageId;
  }

  const diagrams = {
    flywheel(data) {
      return h("div", { class: "dg-box" }, h("div", { class: "fly-wrap" },
        flywheelSvg(data),
        h("div", { class: "fly-legend" }, data.stages.map((st, i) => h("div", { class: "fly-stage" },
          h("div", { class: "fly-stage-title" }, h("i", { class: "swatch " + (STAGES[i] || "build") }), h("a", { href: "#" + st.id, style: { color: "inherit", textDecoration: "none" }, text: st.title }), h("span", { class: "en", text: st.en || "" })),
          h("div", { class: "fly-stage-items" }, (st.items || []).map((it) => h("a", { href: linkFor(st.id, it) || "#" + st.id, text: it })))
        )))
      ));
    },
    venn(data) {
      const svg = s("svg", { viewBox: "0 0 340 330", class: "venn-svg", role: "img", "aria-label": "四圈交集：" + data.circles.map((c) => c.label).join("、") + "，交集为" + data.center });
      const cs = [[132, 128], [208, 128], [132, 204], [208, 204]];
      const lp = [[92, 92], [248, 92], [92, 248], [248, 248]];
      data.circles.slice(0, 4).forEach((c, i) => svg.append(s("circle", { cx: cs[i][0], cy: cs[i][1], r: 80, class: "venn-c c" + i })));
      data.circles.slice(0, 4).forEach((c, i) => svg.append(s("text", { x: lp[i][0], y: lp[i][1] + 6, "text-anchor": "middle", class: "venn-label", text: c.label })));
      svg.append(s("rect", { x: 128, y: 150, width: 84, height: 32, rx: 16, class: "venn-center-bg" }));
      svg.append(s("text", { x: 170, y: 171, "text-anchor": "middle", class: "venn-center", text: data.center }));
      const sw = ["build", "maintain", "leverage", "neutral"];
      return h("div", { class: "dg-box" }, h("div", { class: "venn-wrap" }, svg,
        h("ul", { class: "dg-list" }, data.circles.map((c, i) => h("li", {}, h("i", { class: "swatch " + sw[i] }), h("span", {}, h("strong", { text: c.label }), c.text))))
      ));
    },
    funnel(data) {
      const n = data.stages.length;
      return h("div", { class: "dg-box" }, h("div", { class: "funnel" }, data.stages.map((st, i) => {
        const w = 100 - (n > 1 ? (i * 54) / (n - 1) : 0);
        const ord = 1 + Math.round((i * 4) / Math.max(1, n - 1));
        return h("div", { class: "funnel-row", style: { "--w": w + "%", "--fill": "var(--ord-" + ord + ")", "--fg": "var(--ord-fg-" + ord + ")" } }, h("strong", { text: st.label }), h("span", { text: st.text || "" }));
      })));
    },
    hourglass(data) {
      const n = data.stages.length, pv = PB.clamp(data.pivot !== undefined ? data.pivot : Math.floor(n / 2), 1, n - 1);
      return h("div", { class: "dg-box" }, h("div", { class: "funnel" }, data.stages.map((st, i) => {
        const w = i <= pv ? 100 - (i * 58) / pv : 42 + ((i - pv) * 58) / Math.max(1, n - 1 - pv);
        const ord = 1 + Math.round((i * 4) / Math.max(1, n - 1));
        return h("div", { class: "funnel-row", style: { "--w": w + "%", "--fill": "var(--ord-" + ord + ")", "--fg": "var(--ord-fg-" + ord + ")" } }, h("strong", { text: st.label }), h("span", { text: st.text || "" }));
      })));
    },
    pyramid(data) {
      const n = data.levels.length;
      return h("div", { class: "dg-box" }, h("div", { class: "pyramid" }, data.levels.map((lv, i) => {
        const w = n > 1 ? 44 + (i * 56) / (n - 1) : 100;
        const ord = 5 - Math.round((i * 3) / Math.max(1, n - 1));
        return h("div", { class: "pyr-row", style: { "--w": w + "%", "--fill": "var(--ord-" + ord + ")", "--fg": "var(--ord-fg-" + ord + ")" } },
          h("strong", {}, lv.label, lv.count ? h("span", { class: "count", text: "× " + lv.count }) : null),
          h("span", { text: lv.text || "" }));
      })));
    },
    ladder(data) {
      const n = data.steps.length;
      return h("div", { class: "dg-box" }, h("div", { class: "ladder", style: { "--n": String(n) } }, data.steps.map((st, i) => {
        const ord = 1 + Math.round((i * 4) / Math.max(1, n - 1));
        return h("div", { class: "ladder-step", style: { "--h": (92 + i * 34) + "px", "--i": String(i), "--fill": "var(--ord-" + ord + ")", "--fg": "var(--ord-fg-" + ord + ")" } },
          h("span", { class: "price", text: st.price || "" }), h("strong", { text: st.label }), h("span", { text: st.text || "" }));
      })));
    },
    hubspoke(data) {
      return h("div", { class: "dg-box" }, h("div", { class: "hub" },
        h("div", { class: "hub-center" }, h("strong", { text: data.hub.label }), h("span", { text: data.hub.text || "" })),
        data.spokes.slice(0, 4).map((sp, i) => h("div", { class: "hub-node n" + i },
          h("strong", { text: sp.label }), h("span", { text: sp.text || "" }), sp.flow ? h("em", { class: "flow", text: sp.flow }) : null))
      ));
    }
  };
  PB.diagrams = diagrams;
  PB.diagramKinds = Object.keys(diagrams);
})();
