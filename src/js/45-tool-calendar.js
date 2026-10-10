/* 45-tool-calendar.js — 内容日历：内容支柱（占比）× 发布节奏 → 4 周日历；选题池（ICE 排序）；AI 生成选题。
   存储键 calendar = { pillars: [{id,name,ratio}], channels: [{id,name,perWeek,format}], start: "YYYY-MM-DD",
                       topics: [{id,title,pillar,impact,confidence,ease,done}] } */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;
  const WD = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const ice = (t) => (+t.impact || 0) * (+t.confidence || 0) * (+t.ease || 0);
  PB.ice = ice;

  function parseDate(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
  function nextMonday() { const d = new Date(); const m = mondayOf(d); if (m.getTime() < new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) m.setDate(m.getDate() + 7); return m; }

  PB.calendarSchedule = function schedule(cal) {
    const start = mondayOf(parseDate(cal.start) || nextMonday());
    const slots = [];
    (cal.channels || []).forEach((ch) => {
      const n = PB.clamp(parseInt(ch.perWeek, 10) || 0, 0, 14);
      for (let w = 0; w < 4; w++) for (let k = 0; k < n; k++) slots.push({ day: w * 7 + Math.min(6, Math.floor(((k + 0.5) * 7) / n)), ch });
    });
    slots.sort((a, b) => a.day - b.day);
    const pillars = (cal.pillars || []).filter((p) => (p.name || "").trim() && +p.ratio > 0);
    const total = pillars.reduce((n, p) => n + +p.ratio, 0);
    const assigned = pillars.map(() => 0);
    slots.forEach((s, idx) => {
      if (!pillars.length) return;
      let best = 0, bestDef = -Infinity;
      pillars.forEach((p, i) => { const def = ((idx + 1) * +p.ratio) / total - assigned[i]; if (def > bestDef + 1e-9) { bestDef = def; best = i; } });
      assigned[best]++;
      s.pillar = pillars[best];
    });
    const pool = (cal.topics || []).filter((t) => !t.done).slice().sort((a, b) => ice(b) - ice(a));
    const used = {};
    slots.forEach((s) => {
      if (!s.pillar) return;
      const t = pool.find((x) => !used[x.id] && x.pillar === s.pillar.name);
      if (t) { used[t.id] = 1; s.topic = t; }
      const d = new Date(start); d.setDate(d.getDate() + s.day); s.date = d;
    });
    slots.forEach((s) => { if (!s.date) { const d = new Date(start); d.setDate(d.getDate() + s.day); s.date = d; } });
    return { start, slots, pillars };
  };

  function toMarkdown(plan) {
    const rows = plan.slots.map((s) => "| " + ymd(s.date) + " | " + WD[(s.date.getDay() + 6) % 7] + " | " + (s.ch.name || "") + " | " + (s.ch.format || "") + " | " + (s.pillar ? s.pillar.name : "") + " | " + (s.topic ? s.topic.title : "") + " |");
    return "| 日期 | 星期 | 平台 | 形式 | 内容支柱 | 选题 |\n|---|---|---|---|---|---|\n" + rows.join("\n");
  }
  function toCsv(plan) {
    const q = (v) => '"' + String(v || "").replace(/"/g, '""') + '"';
    const rows = plan.slots.map((s) => [ymd(s.date), WD[(s.date.getDay() + 6) % 7], s.ch.name, s.ch.format, s.pillar ? s.pillar.name : "", s.topic ? s.topic.title : ""].map(q).join(","));
    return "\ufeff" + ["日期", "星期", "平台", "形式", "内容支柱", "选题"].map(q).join(",") + "\n" + rows.join("\n");
  }
  PB.calendarMarkdown = toMarkdown;

  PB.tools.calendar = {
    mount(shell) {
      const ex = PB.content.tools.calendar.example;
      const formats = PB.content.tools.calendar.formats;
      const isExample = () => !PB.store.has("calendar");
      const fresh = () => ({
        pillars: ex.pillars.map((p, i) => ({ id: "p" + i, name: p.name, ratio: p.ratio })),
        channels: ex.channels.map((c, i) => ({ id: "c" + i, name: c.name, perWeek: c.perWeek, format: c.format })),
        start: ymd(nextMonday()),
        topics: ex.topics.map((t, i) => ({ id: "t" + i, title: t.title, pillar: t.pillar, impact: t.impact, confidence: t.confidence, ease: t.ease, done: false }))
      });
      const get = () => PB.store.get("calendar", fresh());
      const save = (st) => PB.store.set("calendar", st);
      const setup = h("div", { class: "tool-split" });
      const calBox = h("div", { class: "panel" });
      const topicBox = h("div", { class: "panel" });
      const ai = PB.aiPanel("Claude 生成的选题");
      shell.body.append(setup, calBox, h("div", { class: "tool-split" }, topicBox, ai.el));
      const pcIndex = (st, name) => Math.max(0, st.pillars.findIndex((p) => p.name === name)) % 6 + 1;

      function renderSetup() {
        const st = get();
        PB.clear(setup);
        PB.clear(shell.badges);
        if (isExample()) shell.badges.append(PB.exampleBadge("示例计划"));
        const pBox = h("div", { class: "panel" });
        const sum = st.pillars.reduce((n, p) => n + (+p.ratio || 0), 0);
        pBox.append(h("div", { class: "panel-title" }, h("span", { text: "内容支柱与占比" }), h("span", { class: "mono small" + (sum !== 100 ? " muted" : ""), text: "合计 " + sum + "%" + (sum !== 100 ? "（将按比例换算）" : "") })));
        st.pillars.forEach((p, i) => {
          const name = h("input", { class: "input", type: "text", value: p.name, placeholder: "支柱名称", "aria-label": "支柱名称" });
          name.addEventListener("change", () => { const cur = get(); const old = cur.pillars[i].name; cur.pillars[i].name = name.value.trim(); cur.topics.forEach((t) => { if (t.pillar === old) t.pillar = cur.pillars[i].name; }); save(cur); renderAll(); });
          const ratio = h("input", { class: "input num", type: "number", min: "0", max: "100", step: "5", value: String(p.ratio), "aria-label": "占比（%）" });
          ratio.addEventListener("change", () => { const cur = get(); cur.pillars[i].ratio = PB.clamp(+ratio.value || 0, 0, 100); save(cur); renderAll(); });
          const del = h("button", { class: "btn sm ghost", type: "button", "aria-label": "删除支柱", disabled: st.pillars.length <= 1 }, PB.icon("x", "sm"));
          del.addEventListener("click", () => { const cur = get(); cur.pillars.splice(i, 1); save(cur); renderAll(); });
          pBox.append(h("div", { class: "pillar-row" }, h("div", { style: { display: "flex", gap: "8px", alignItems: "center" } }, h("i", { class: "pc-dot", style: { background: "var(--pc-" + ((i % 6) + 1) + ")" } }), name), ratio, del));
        });
        const addP = h("button", { class: "btn sm", type: "button", disabled: st.pillars.length >= 6 }, PB.icon("plus", "sm"), "添加支柱");
        addP.addEventListener("click", () => { const cur = get(); cur.pillars.push({ id: PB.uid("p"), name: "新支柱" + (cur.pillars.length + 1), ratio: 10 }); save(cur); renderAll(); });
        pBox.append(h("div", { class: "btn-row" }, addP));

        const cBox = h("div", { class: "panel" });
        cBox.append(h("div", { class: "panel-title", text: "发布节奏" }));
        const dl = h("datalist", { id: "pb-plat-names" }, PB.content.tools.platforms.map((p) => h("option", { value: p.name })));
        cBox.append(dl);
        cBox.append(h("div", { class: "channel-row small muted" }, h("span", { text: "平台" }), h("span", { text: "每周条数" }), h("span", { text: "形式" }), h("span", {})));
        st.channels.forEach((c, i) => {
          const name = h("input", { class: "input", type: "text", value: c.name, list: "pb-plat-names", placeholder: "平台", "aria-label": "平台" });
          name.addEventListener("change", () => { const cur = get(); cur.channels[i].name = name.value.trim(); save(cur); renderCal(); });
          const per = h("input", { class: "input num", type: "number", min: "0", max: "14", value: String(c.perWeek), "aria-label": "每周条数" });
          per.addEventListener("change", () => { const cur = get(); cur.channels[i].perWeek = PB.clamp(parseInt(per.value, 10) || 0, 0, 14); save(cur); renderCal(); });
          const fmt = h("select", { class: "select", "aria-label": "内容形式" }, formats.map((f) => h("option", { value: f, selected: f === c.format ? true : null, text: f })));
          fmt.addEventListener("change", () => { const cur = get(); cur.channels[i].format = fmt.value; save(cur); renderCal(); });
          const del = h("button", { class: "btn sm ghost", type: "button", "aria-label": "删除平台", disabled: st.channels.length <= 1 }, PB.icon("x", "sm"));
          del.addEventListener("click", () => { const cur = get(); cur.channels.splice(i, 1); save(cur); renderAll(); });
          cBox.append(h("div", { class: "channel-row" }, name, per, fmt, del));
        });
        const addC = h("button", { class: "btn sm", type: "button", disabled: st.channels.length >= 5 }, PB.icon("plus", "sm"), "添加平台");
        addC.addEventListener("click", () => { const cur = get(); cur.channels.push({ id: PB.uid("c"), name: "", perWeek: 1, format: formats[0] }); save(cur); renderAll(); });
        const startId = PB.uid("cal-start");
        const start = h("input", { class: "input", type: "date", id: startId, value: st.start || ymd(nextMonday()), style: { maxWidth: "180px" } });
        start.addEventListener("change", () => { const cur = get(); cur.start = start.value; save(cur); renderCal(); });
        cBox.append(h("div", { class: "btn-row" }, addC, h("label", { for: startId, class: "small muted", text: "起始周" }), start));
        setup.append(pBox, cBox);
      }

      function renderCal() {
        const st = get();
        const plan = PB.calendarSchedule(st);
        PB.clear(calBox);
        const total = plan.slots.length;
        calBox.append(h("div", { class: "panel-title" }, h("span", { text: "4 周内容日历（共 " + total + " 条）" }),
          h("span", { class: "btn-row" }, PB.copyBtn(() => toMarkdown(plan), "复制为表格"), PB.saveBtn("保存 CSV", "content-calendar.csv", () => toCsv(plan), "text/csv"))));
        if (!total) { calBox.append(h("div", { class: "empty", text: "还没有发布节奏。在上方添加平台并设置每周条数。" })); return; }
        const grid = h("div", { class: "cal-grid", role: "table", "aria-label": "4 周内容日历" });
        grid.append(h("div", { class: "cal-h", role: "columnheader" }), ...WD.map((d) => h("div", { class: "cal-h", role: "columnheader", text: d })));
        for (let w = 0; w < 4; w++) {
          grid.append(h("div", { class: "cal-wk", role: "rowheader", text: "第 " + (w + 1) + " 周" }));
          for (let d = 0; d < 7; d++) {
            const day = w * 7 + d;
            const date = new Date(plan.start); date.setDate(date.getDate() + day);
            const items = plan.slots.filter((s) => s.day === day);
            grid.append(h("div", { role: "cell" }, h("span", { class: "cal-date", text: (date.getMonth() + 1) + "/" + date.getDate() }),
              items.map((s) => h("div", { class: "cal-item", title: s.topic ? s.topic.title : "" },
                h("b", {}, s.pillar ? h("i", { class: "pc-dot", style: { background: "var(--pc-" + pcIndex(st, s.pillar.name) + ")" } }) : null, (s.ch.name || "平台") + " · " + (s.ch.format || "")),
                h("span", { text: s.topic ? s.topic.title : s.pillar ? s.pillar.name : "未设支柱" })))));
          }
        }
        calBox.append(h("div", { class: "cal-scroll" }, grid));
        const counts = plan.pillars.map((p) => ({ p, n: plan.slots.filter((s) => s.pillar === p).length }));
        calBox.append(h("div", { class: "chart-legend" }, counts.map((c, i) => h("span", {}, h("i", { class: "pc-dot", style: { background: "var(--pc-" + ((st.pillars.indexOf(c.p) % 6) + 1) + ")", width: "10px", height: "10px" } }), c.p.name + " " + c.n + " 条"))));
        calBox.append(h("p", { class: "note", text: "日历按占比自动分配支柱，并从选题池中按 ICE 分数（影响 × 把握 × 难易）填入对应支柱的选题。没有选题的格子只显示支柱名称。" }));
      }

      function renderTopics() {
        const st = get();
        PB.clear(topicBox);
        const pool = st.topics.slice().sort((a, b) => (a.done - b.done) || ice(b) - ice(a));
        topicBox.append(h("div", { class: "panel-title" }, h("span", { text: "选题池（" + st.topics.filter((t) => !t.done).length + " 个待写）" }), h("span", { class: "muted small", text: "ICE = 影响 × 把握 × 难易" })));
        const title = h("input", { class: "input", type: "text", placeholder: "新选题，例如：3 个让周报更有说服力的图表", "aria-label": "新选题" });
        const pillarSel = h("select", { class: "select", "aria-label": "所属支柱", style: { maxWidth: "150px" } }, st.pillars.map((p) => h("option", { value: p.name, text: p.name })));
        const add = h("button", { class: "btn sm primary", type: "button" }, PB.icon("plus", "sm"), "加入");
        const doAdd = () => { const t = title.value.trim(); if (!t) { title.focus(); return; } const cur = get(); cur.topics.push({ id: PB.uid("t"), title: t, pillar: pillarSel.value, impact: 3, confidence: 3, ease: 3, done: false }); save(cur); renderTopics(); renderCal(); };
        add.addEventListener("click", doAdd);
        title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doAdd(); } });
        topicBox.append(h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, h("div", { style: { flex: "1 1 220px", minWidth: "0" } }, title), pillarSel, add));
        if (!pool.length) topicBox.append(h("div", { class: "empty", text: "选题池是空的。把灵感随手记在这里，日历会自动取用。" }));
        const list = h("div", {});
        pool.forEach((t) => {
          const cb = h("input", { type: "checkbox", checked: !!t.done, "aria-label": "标记为已完成" });
          cb.addEventListener("change", () => { const cur = get(); const x = cur.topics.find((y) => y.id === t.id); if (x) x.done = cb.checked; save(cur); renderTopics(); renderCal(); });
          const scoreSel = (k, label) => {
            const s = h("select", { class: "select", "aria-label": label, title: label, style: { width: "auto", padding: "2px 4px", fontSize: "12px" } }, [1, 2, 3, 4, 5].map((v) => h("option", { value: String(v), selected: +t[k] === v ? true : null, text: label.slice(0, 1) + v })));
            s.addEventListener("change", () => { const cur = get(); const x = cur.topics.find((y) => y.id === t.id); if (x) x[k] = +s.value; save(cur); renderTopics(); renderCal(); });
            return s;
          };
          const del = h("button", { class: "btn sm ghost", type: "button", "aria-label": "删除选题" }, PB.icon("x", "sm"));
          del.addEventListener("click", () => { const cur = get(); cur.topics = cur.topics.filter((y) => y.id !== t.id); save(cur); renderTopics(); renderCal(); });
          list.append(h("div", { class: "topic-row" + (t.done ? " done" : "") }, cb,
            h("span", { class: "topic-title" }, h("span", { text: t.title }), h("span", { class: "small muted", style: { marginLeft: "6px" } }, h("i", { class: "pc-dot", style: { background: "var(--pc-" + pcIndex(st, t.pillar) + ")", width: "7px", height: "7px", marginRight: "4px" } }), t.pillar || "")),
            h("span", { style: { display: "flex", gap: "4px" } }, scoreSel("impact", "影响"), scoreSel("confidence", "把握"), scoreSel("ease", "难易")),
            h("span", { class: "ice", text: String(ice(t)) }), del));
        });
        topicBox.append(list);
        const aiBtn = h("button", { class: "btn sm ai", type: "button", "data-cap": "sample", hidden: true }, PB.icon("sparkle", "sm"), "让 Claude 生成 10 个选题");
        aiBtn.addEventListener("click", runAi);
        topicBox.append(h("div", { class: "btn-row" }, aiBtn, PB.confirmBtn("恢复示例", "再点一次恢复", () => { PB.store.remove("calendar"); renderAll(); })));
        PB.applyCaps(topicBox);
      }

      function runAi() {
        const st = get();
        const prompt = PB.fill(PB.content.tools.ai.topics, {
          profile: PB.profileText(),
          pillars: st.pillars.map((p) => p.name + "（" + p.ratio + "%）").join("、"),
          channels: st.channels.map((c) => c.name + "·" + c.format + "·每周 " + c.perWeek + " 条").join("；"),
          existing: st.topics.slice(0, 30).map((t) => t.title).join("；") || "无"
        });
        ai.run((signal) => PB.cap.sample.json(prompt, { signal }), (res, out) => {
          const arr = Array.isArray(res) ? res : (res && Array.isArray(res.topics) ? res.topics : []);
          if (!arr.length) { out.append(h("p", { text: "没有得到有效的选题，请再试一次。" })); return; }
          const names = get().pillars.map((p) => p.name);
          const items = arr.filter((x) => x && x.title).slice(0, 12).map((x) => ({ title: String(x.title).slice(0, 60), pillar: names.indexOf(String(x.pillar)) >= 0 ? String(x.pillar) : names[0], format: x.format ? String(x.format) : "", hook: x.hook ? String(x.hook) : "" }));
          const addAll = h("button", { class: "btn sm primary", type: "button" }, PB.icon("plus", "sm"), "全部加入选题池");
          addAll.addEventListener("click", () => {
            const cur = get();
            items.forEach((x) => cur.topics.push({ id: PB.uid("t"), title: x.title, pillar: x.pillar, impact: 3, confidence: 3, ease: 3, done: false }));
            save(cur); renderTopics(); renderCal(); PB.toast("已加入 " + items.length + " 个选题"); addAll.disabled = true;
          });
          out.append(h("ol", {}, items.map((x) => h("li", {}, h("strong", { text: x.title }), h("div", { class: "small muted", text: [x.pillar, x.format].filter(Boolean).join(" · ") }), x.hook ? h("div", { class: "small", text: "开头：" + x.hook }) : null))), h("div", { class: "btn-row" }, addAll));
        });
      }


      function renderAll() { renderSetup(); renderCal(); renderTopics(); PB.applyCaps(shell.el); }
      renderAll();
    }
  };
})();
