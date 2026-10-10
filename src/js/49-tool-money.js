/* 49-tool-money.js — 变现计算器：A. 铁杆粉丝测算（正算 + 反算）；B. 价值阶梯月收入估算。
   存储键 money = { fans, spend, target, reach, tiers: [{name, price, rate}] } */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;

  PB.moneyLadder = function moneyLadder(m) {
    let base = +m.reach || 0;
    return (m.tiers || []).map((t) => {
      const buyers = base * ((+t.rate || 0) / 100);
      const revenue = buyers * (+t.price || 0);
      base = buyers;
      return { t, buyers, revenue };
    });
  };

  PB.tools.money = {
    mount(shell) {
      const def = PB.content.tools.money;
      const isExample = () => !PB.store.has("money");
      const get = () => PB.store.get("money", { fans: def.fans, spend: def.spend, target: 300000, reach: def.reach, tiers: JSON.parse(JSON.stringify(def.tiers)) });
      const save = (st) => PB.store.set("money", st);
      const fansBox = h("div", { class: "panel" });
      const ladderBox = h("div", { class: "panel" });
      shell.body.append(h("div", { class: "tool-split" }, fansBox, ladderBox));

      function numField(label, key, min, max, step, onChange) {
        const st = get();
        const id = PB.uid("mn");
        const val = st[key];
        const range = h("input", { type: "range", id, min: String(min), max: String(max), step: String(step), value: String(PB.clamp(val, min, max)), "aria-label": label });
        const num = h("input", { class: "input num", type: "number", min: "0", step: String(step), value: String(val), style: { maxWidth: "120px" }, "aria-label": label + "（数字）" });
        const apply = (v) => { const cur = get(); cur[key] = Math.max(0, +v || 0); save(cur); onChange(); };
        range.addEventListener("input", () => { num.value = range.value; apply(range.value); });
        num.addEventListener("change", () => { range.value = String(PB.clamp(+num.value || 0, min, max)); apply(num.value); });
        return h("div", { class: "field" }, h("label", { for: id, class: "field-label", text: label }), h("div", { style: { display: "flex", gap: "10px", alignItems: "center" } }, range, num));
      }

      function renderFans() {
        PB.clear(fansBox);
        const out = h("div", { "aria-live": "polite", style: { display: "grid", gap: "6px" } });
        const reverse = h("div", { class: "rec" });
        const update = () => {
          const st = get();
          const annual = st.fans * st.spend;
          PB.clear(out).append(
            h("div", { class: "small muted", text: "预计年收入" }),
            h("div", { class: "big-number", text: PB.money(annual) }),
            h("div", { class: "small muted", text: "约合每月 " + PB.money(annual / 12) + " · " + PB.fmt(st.fans) + " 位铁杆粉丝 × 每人每年 " + PB.money(st.spend) }));
          const need = st.spend > 0 ? Math.ceil(st.target / st.spend) : 0;
          const tId = PB.uid("mn-target");
          const target = h("input", { class: "input num", type: "number", min: "0", step: "10000", id: tId, value: String(st.target), style: { maxWidth: "160px" } });
          target.addEventListener("change", () => { const cur = get(); cur.target = Math.max(0, +target.value || 0); save(cur); update(); });
          PB.clear(reverse).append(h("label", { for: tId, class: "field-label", text: "反过来算：想要的年收入" }), target,
            h("p", { class: "small", html: PB.md("按每人每年 " + PB.money(st.spend) + " 计算，需要 **" + PB.fmt(need) + "** 位铁杆粉丝。") }));
          PB.clear(shell.badges);
          if (isExample()) shell.badges.append(PB.exampleBadge("示例参数"));
        };
        fansBox.append(h("div", { class: "panel-title", text: "A. 铁杆粉丝测算" }),
          numField("铁杆粉丝数", "fans", 100, 10000, 50, update),
          numField("每人每年在你身上的花费（元）", "spend", 50, 5000, 10, update),
          out, reverse,
          h("p", { class: "note", text: "Kevin Kelly 的原始设定是 1000 人 × 每年 100 美元。关键是“直接关系”：你能直接联系到他们，他们也愿意持续为你付费。" }));
        update();
      }

      function renderLadder() {
        PB.clear(ladderBox);
        const st = get();
        const rows = h("div", { style: { display: "grid", gap: "8px" } });
        const result = h("div", { "aria-live": "polite", style: { display: "grid", gap: "10px" } });
        const reachId = PB.uid("mn-reach");
        const reach = h("input", { class: "input num", type: "number", min: "0", step: "1000", id: reachId, value: String(st.reach), style: { maxWidth: "160px" } });
        reach.addEventListener("change", () => { const cur = get(); cur.reach = Math.max(0, +reach.value || 0); save(cur); calc(); });
        const calc = () => {
          const cur = get();
          const res = PB.moneyLadder(cur);
          PB.clear(rows).append(h("div", { class: "tier-row head" }, h("span", { text: "层级" }), h("span", { text: "价格（元）" }), h("span", { text: "转化率（%）" }), h("span", { style: { textAlign: "right" }, text: "人数 · 月收入" })));
          res.forEach((r, i) => {
            const name = h("input", { class: "input", type: "text", value: r.t.name, "aria-label": "层级名称" });
            name.addEventListener("change", () => { const c = get(); c.tiers[i].name = name.value; save(c); calc(); });
            const price = h("input", { class: "input num", type: "number", min: "0", value: String(r.t.price), "aria-label": r.t.name + " 价格" });
            price.addEventListener("change", () => { const c = get(); c.tiers[i].price = Math.max(0, +price.value || 0); save(c); calc(); });
            const rate = h("input", { class: "input num", type: "number", min: "0", max: "100", step: "0.5", value: String(r.t.rate), "aria-label": r.t.name + " 转化率" });
            rate.addEventListener("change", () => { const c = get(); c.tiers[i].rate = PB.clamp(+rate.value || 0, 0, 100); save(c); calc(); });
            rows.append(h("div", { class: "tier-row" }, name, price, rate, h("span", { class: "tier-out", text: PB.fmt(r.buyers, 1) + " 人 · " + PB.money(r.revenue) })));
          });
          const total = res.reduce((n, r) => n + r.revenue, 0);
          PB.clear(result).append(
            h("div", { class: "result-head" }, h("div", {}, h("div", { class: "small muted", text: "预计月收入" }), h("div", { class: "big-number", text: PB.money(total) })), h("div", { class: "small muted", style: { textAlign: "right" }, text: "约合年收入 " + PB.money(total * 12) })),
            PB.hbars(res.filter((r) => r.t.price > 0).map((r) => ({ label: r.t.name, value: r.revenue, display: PB.money(r.revenue) }))),
            h("p", { class: "note", text: "每一层的转化率以上一层的人数为基数：月触达 → 关注/订阅 → 引流品 → 核心产品 → 高端服务。数字只用于理解结构，真实转化率需要用你自己的数据校准。" }));
        };
        ladderBox.append(h("div", { class: "panel-title", text: "B. 价值阶梯月收入" }),
          h("div", { class: "field" }, h("label", { for: reachId, class: "field-label", text: "每月触达人数（内容覆盖的独立用户）" }), reach),
          rows, result,
          h("div", { class: "btn-row" }, PB.confirmBtn("恢复默认参数", "再点一次恢复", () => { PB.store.remove("money"); renderFans(); renderLadder(); })));
        calc();
      }

      renderFans();
      renderLadder();
    }
  };
})();
