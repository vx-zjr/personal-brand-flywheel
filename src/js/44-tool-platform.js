/* 44-tool-platform.js — 平台选择器：6 个问题 → 22 个平台的匹配度排序 + 自有阵地建议 + 平台图谱。
   存储键 platform = { region, formats[], audiences[], goals[], time, face }。
   评分规则（便于在 agent.md 中调整）：基础 10 分 + 形式最多 35 + 人群最多 30 + 目标最多 25；
   时间不足时按制作难度扣分；不出镜时对依赖出镜的平台扣 14 分。 */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;
  const OWNED = ["website", "newsletter", "zsxq"];

  PB.platformRank = function platformRank(ans) {
    const P = PB.content.tools.platforms;
    const a = Object.assign({ region: "both", formats: [], audiences: [], goals: [], time: "mid", face: "yes" }, ans || {});
    const out = [];
    P.forEach((p) => {
      if (a.region === "cn" && p.region === "global") return;
      if (a.region === "global" && p.region === "cn") return;
      const fm = p.formats.filter((f) => a.formats.indexOf(f) >= 0);
      const au = p.audiences.filter((x) => a.audiences.indexOf(x) >= 0);
      const go = p.goals.filter((g) => a.goals.indexOf(g) >= 0);
      let score = 10;
      score += a.formats.length ? Math.min(1, fm.length / Math.min(a.formats.length, 2)) * 35 : 17;
      score += a.audiences.length ? Math.min(1, au.length / Math.min(a.audiences.length, 2)) * 30 : 15;
      score += a.goals.length ? (go.length / a.goals.length) * 25 : 12;
      if (a.formats.length && !fm.length) score -= 10;
      if (a.time === "low") score -= p.effort >= 4 ? 18 : p.effort === 3 ? 6 : 0;
      if (a.time === "mid") score -= p.effort >= 5 ? 8 : p.effort === 4 ? 4 : 0;
      if (a.face === "no" && p.face) score -= 14;
      out.push({ p, score: PB.clamp(Math.round(score), 0, 100), fm, au, go, owned: OWNED.indexOf(p.id) >= 0 });
    });
    out.sort((x, y) => y.score - x.score || x.p.effort - y.p.effort);
    return out;
  };

  PB.tools.platform = {
    mount(shell) {
      const Q = PB.content.tools.platformQuiz;
      const isExample = () => !PB.store.has("platform");
      const get = () => PB.store.get("platform", JSON.parse(JSON.stringify(Q.example)));
      const save = (st) => PB.store.set("platform", st);
      const quiz = h("div", { class: "panel" });
      const res = h("div", { class: "panel tint", "aria-live": "polite" });
      const lib = h("details", { class: "panel" });
      shell.body.append(h("div", { class: "tool-split" }, quiz, res), lib);
      const nameOf = (list, id) => (list.find((x) => x.id === id) || {}).name || id;

      function chipGroup(label, list, key, multi, hint) {
        const st = get();
        const wrap = h("div", { class: "quiz-block" }, h("div", { class: "field-label" }, h("span", { text: label }), hint ? h("span", { class: "muted small", style: { fontWeight: "400" }, text: hint }) : null));
        const chips = h("div", { class: "chips", role: multi ? "group" : "radiogroup", "aria-label": label });
        list.forEach((it) => {
          const on = multi ? st[key].indexOf(it.id) >= 0 : st[key] === it.id;
          const c = h("button", { type: "button", class: "chip", "aria-pressed": on ? "true" : "false", text: it.name });
          c.addEventListener("click", () => {
            const cur = get();
            if (multi) { const i = cur[key].indexOf(it.id); if (i >= 0) cur[key].splice(i, 1); else cur[key].push(it.id); }
            else cur[key] = it.id;
            save(cur); renderQuiz(); renderRes();
          });
          chips.append(c);
        });
        wrap.append(chips);
        return wrap;
      }
      function renderQuiz() {
        PB.clear(quiz);
        quiz.append(h("div", { class: "panel-title", text: "回答 6 个问题" }),
          chipGroup("1. 你的受众主要在哪里？", Q.regions, "region", false),
          chipGroup("2. 你擅长或愿意尝试的表达形式", Q.formats, "formats", true, "可多选"),
          chipGroup("3. 你的目标受众", Q.audiences, "audiences", true, "可多选"),
          chipGroup("4. 你最想要的结果", Q.goals, "goals", true, "可多选"),
          chipGroup("5. 每周能投入的时间", Q.times, "time", false),
          chipGroup("6. 是否愿意出镜", Q.faces, "face", false));
      }
      function detailRow(r, role) {
        const p = r.p;
        const why = [];
        if (r.fm.length) why.push("形式匹配：" + r.fm.map((x) => nameOf(Q.formats, x)).join("、"));
        if (r.au.length) why.push("人群匹配：" + r.au.map((x) => nameOf(Q.audiences, x)).join("、"));
        if (r.go.length) why.push("目标匹配：" + r.go.map((x) => nameOf(Q.goals, x)).join("、"));
        return h("div", { class: "plat-row" + (role === "主阵地" ? " top" : "") },
          h("div", { class: "plat-top" },
            h("div", { class: "plat-name" }, p.name, role ? h("span", { class: "badge " + (role === "主阵地" ? "build" : role === "自有阵地" ? "maintain" : ""), text: role }) : null),
            h("div", { class: "plat-score" }, h("span", { text: "匹配度 " + r.score }), h("span", { class: "meter" }, h("span", { style: { width: r.score + "%" } })))),
          h("div", { class: "plat-why", text: (why.join("；") || "与你的选择匹配度较低") + "。制作难度 " + p.effort + "/5，内容寿命" + p.lifespan + "。" }),
          h("div", { class: "plat-detail" },
            h("div", {}, h("b", { text: "优势" }), p.strengths),
            h("div", {}, h("b", { text: "注意" }), p.watch),
            h("div", {}, h("b", { text: "变现方式" }), p.monetize)));
      }
      function renderRes() {
        const st = get();
        const ranked = PB.platformRank(st);
        PB.clear(res);
        PB.clear(shell.badges);
        if (isExample()) shell.badges.append(PB.exampleBadge("示例选择"));
        const rented = ranked.filter((r) => !r.owned);
        const owned = ranked.filter((r) => r.owned)[0];
        res.append(h("div", { class: "panel-title" }, h("span", { text: "推荐组合" }), h("span", { class: "muted small", text: "1 主阵地 + 1 分发 + 1 自有" })));
        res.append(h("div", { class: "plat-results" },
          rented[0] ? detailRow(rented[0], "主阵地") : null,
          rented[1] ? detailRow(rented[1], "分发阵地") : null,
          owned ? detailRow(owned, "自有阵地") : null));
        const more = rented.slice(2, 6);
        if (more.length) {
          res.append(h("div", { class: "panel-title", text: "备选" }));
          res.append(PB.hbars(more.map((r) => ({ label: r.p.name, value: r.score, display: String(r.score) })), 100));
        }
        res.append(h("p", { class: "note", text: "匹配度只是起点：先在主阵地连续发布 8–12 周，再用真实数据决定是否调整。" }));
        renderLib(st);
      }
      function renderLib(st) {
        PB.clear(lib);
        const P = PB.content.tools.platforms.filter((p) => st.region === "both" || p.region === "any" || p.region === st.region);
        lib.append(h("summary", { class: "panel-title", style: { cursor: "pointer" } }, h("span", { text: "平台图谱（" + P.length + " 个，按你的地区筛选）" }), PB.icon("chevron", "sm")));
        lib.append(h("div", { class: "plat-lib" }, P.map((p) => h("article", { class: "plat-card" },
          h("strong", { text: p.name }),
          h("div", { class: "plat-tags" }, p.formats.map((f) => h("span", { class: "badge", text: nameOf(Q.formats, f) }))),
          h("span", { text: p.strengths }),
          h("span", { class: "small muted", text: "注意：" + p.watch }),
          h("span", { class: "small muted", text: "变现：" + p.monetize })))));
      }
      renderQuiz();
      renderRes();
    }
  };
})();
