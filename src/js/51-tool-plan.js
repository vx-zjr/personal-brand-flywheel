/* 51-tool-plan.js — 我的方案：把各工具的数据汇总成 Markdown 品牌战略书；数据备份、导入与清空。 */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;

  PB.buildPlanMarkdown = function buildPlanMarkdown() {
    const C = PB.content, T = C.tools, S = PB.store;
    const L = [];
    const todo = (tool, route) => "> 尚未填写，去「" + tool + "」完成（本页路径：#" + route + "）。";
    L.push("# 个人品牌战略书", "", "> 生成于 " + PB.today() + " · 来源：" + C.site.title + " v" + C.site.version, "");

    L.push("## 1. 定位");
    const cv = S.get("canvas");
    const filled = cv && cv.fields && T.canvas.fields.some((f) => (cv.fields[f.id] || "").trim());
    if (filled) {
      T.canvas.fields.forEach((f) => { const v = (cv.fields[f.id] || "").trim(); if (v) L.push("- **" + f.label + "**：" + v); });
      L.push("");
      const outs = PB.canvasOutputs(cv.fields, false);
      outs.forEach((o) => L.push("### " + o.title, "", o.text, ""));
    } else L.push("", todo("定位画布", "tools.canvas"), "");

    L.push("## 2. 品牌个性");
    const ar = S.get("archetype");
    if (ar && ar.primary) {
      const p = T.archetypes.find((a) => a.id === ar.primary), s2 = T.archetypes.find((a) => a.id === ar.secondary);
      L.push("- **品牌原型**：" + p.name + (s2 ? " + " + s2.name : ""), "- **语调关键词**：" + p.voice.concat(s2 ? s2.voice : []).join("、"), "- **内容方向**：" + p.content + (s2 ? "；" + s2.content : ""), "- **需要警惕**：" + p.watch + (s2 ? "；" + s2.watch : ""), "");
    } else L.push("", todo("品牌原型", "tools.archetype"), "");

    L.push("## 3. 领域评估");
    const ni = S.get("niche");
    if (ni && ni.topics && ni.topics.length) {
      L.push("", "| 领域 | 加权得分 |", "|---|---|");
      ni.topics.map((t) => ({ t, s: PB.nicheScore(t) })).sort((a, b) => b.s - a.s).forEach((x) => L.push("| " + (x.t.name || "（未命名）") + " | " + x.s + " |"));
      L.push("");
    } else L.push("", todo("领域评估", "tools.niche"), "");

    L.push("## 4. 平台策略");
    const pl = S.get("platform");
    if (pl) {
      const r = PB.platformRank(pl), rented = r.filter((x) => !x.owned), owned = r.filter((x) => x.owned)[0];
      if (rented[0]) L.push("- **主阵地**：" + rented[0].p.name + "（匹配度 " + rented[0].score + "）——" + rented[0].p.strengths);
      if (rented[1]) L.push("- **分发阵地**：" + rented[1].p.name + "（匹配度 " + rented[1].score + "）");
      if (owned) L.push("- **自有阵地**：" + owned.p.name + "——" + owned.p.strengths);
      L.push("");
    } else L.push("", todo("平台选择器", "tools.platform"), "");

    L.push("## 5. 内容策略");
    const cal = S.get("calendar");
    if (cal) {
      L.push("- **内容支柱**：" + cal.pillars.map((p) => p.name + " " + p.ratio + "%").join("、"));
      L.push("- **发布节奏**：" + cal.channels.map((c) => (c.name || "平台") + " 每周 " + c.perWeek + " 条" + c.format).join("；"));
      const top = cal.topics.filter((t) => !t.done).sort((a, b) => PB.ice(b) - PB.ice(a)).slice(0, 10);
      if (top.length) { L.push("", "### 选题池（按 ICE 排序）", ""); top.forEach((t, i) => L.push((i + 1) + ". " + t.title + "（" + t.pillar + "，ICE " + PB.ice(t) + "）")); }
      L.push("", "### 4 周内容日历", "", PB.calendarMarkdown(PB.calendarSchedule(cal)), "");
    } else L.push("", todo("内容日历", "tools.calendar"), "");

    L.push("## 6. 90 天计划");
    const rm = S.get("roadmap");
    if (rm && (rm.start || Object.keys(rm.done || {}).length)) {
      const all = T.roadmap.phases.reduce((a, p) => a.concat(p.tasks.map((t) => ({ p, t }))), []);
      const done = all.filter((x) => rm.done[x.t.id]).length;
      L.push("- 开始日期：" + (rm.start || "未设置") + "；进度：" + done + " / " + all.length, "");
      T.roadmap.phases.forEach((p) => { L.push("### " + p.name + "（第 " + p.weeks[0] + "–" + p.weeks[1] + " 周）"); p.tasks.forEach((t) => L.push("- [" + (rm.done[t.id] ? "x" : " ") + "] " + t.text)); L.push(""); });
    } else L.push("", todo("90 天计划", "tools.roadmap"), "");

    L.push("## 7. 品牌体检");
    const au = S.get("audit");
    if (au && au.history && au.history.length) {
      const last = au.history[au.history.length - 1];
      L.push("- 最近一次：" + last.date + "，" + last.total + " 分（" + last.level + "）", "", "| 维度 | 得分（满分 5） |", "|---|---|");
      T.audit.dimensions.forEach((d) => L.push("| " + d.name + " | " + (last.scores[d.id] ? last.scores[d.id].toFixed(1) : "—") + " |"));
      if (au.history.length > 1) { const first = au.history[0]; L.push("", "- 与首次（" + first.date + "，" + first.total + " 分）相比：" + (last.total - first.total >= 0 ? "+" : "") + (last.total - first.total) + " 分"); }
      L.push("");
    } else L.push("", todo("品牌体检（完成后点“保存本次结果”）", "tools.audit"), "");

    L.push("## 8. 指标");
    const me = S.get("metrics");
    if (me && me.rows && me.rows.length) {
      const f = T.metrics.fields;
      L.push("", "| 月份 | " + f.map((x) => x.name).join(" | ") + " |", "|" + "---|".repeat(f.length + 1));
      me.rows.forEach((r) => L.push("| " + r.month + " | " + f.map((x) => (r[x.id] === null || r[x.id] === undefined ? "" : r[x.id])).join(" | ") + " |"));
      const star = f.find((x) => x.id === me.star);
      if (star) L.push("", "- 北极星指标：" + star.name);
      L.push("");
    } else L.push("", todo("指标仪表盘", "tools.metrics"), "");

    L.push("## 9. 变现规划");
    const mo = S.get("money");
    if (mo) {
      L.push("- 铁杆粉丝测算：" + PB.fmt(mo.fans) + " 人 × 每年 " + PB.money(mo.spend) + " = " + PB.money(mo.fans * mo.spend) + " / 年");
      const lad = PB.moneyLadder(mo);
      L.push("- 价值阶梯（月触达 " + PB.fmt(mo.reach) + " 人）：");
      lad.forEach((x) => L.push("  - " + x.t.name + "：¥" + x.t.price + "，转化 " + x.t.rate + "% → " + PB.fmt(x.buyers, 1) + " 人，" + PB.money(x.revenue) + " / 月"));
      L.push("- 合计约 " + PB.money(lad.reduce((n, x) => n + x.revenue, 0)) + " / 月", "");
    } else L.push("", todo("变现计算器", "tools.money"), "");

    L.push("## 10. 行动清单完成情况", "");
    C.site.chapters.forEach((cid) => C.chapters[cid].sections.forEach((s) => s.blocks.forEach((b) => {
      if (b.type !== "checklist") return;
      const st = S.get("check:" + b.id, {});
      const n = Object.keys(st).length;
      if (n) L.push("- " + C.chapters[cid].title + " · " + s.title + " · " + b.title + "：" + n + " / " + b.items.length);
    })));
    L.push("", "---", "", "*本文件由「" + C.site.title + "」自动生成，可作为品牌手册初稿，交给团队或 AI 工具保持输出一致。*");
    return L.join("\n");
  };

  PB.tools.plan = {
    mount(shell) {
      const preview = h("div", { class: "plan-preview" });
      const raw = h("textarea", { class: "textarea copy-area", readonly: true, "aria-label": "Markdown 原文" });
      const dataBox = h("div", { class: "panel" });
      shell.body.append(
        h("div", { class: "btn-row" },
          h("button", { class: "btn primary sm", type: "button", onclick: () => PB.copy(raw.value, raw) }, PB.icon("copy", "sm"), "复制 Markdown"),
          PB.saveBtn("保存为 .md", () => "个人品牌战略书-" + PB.today() + ".md", () => raw.value, "text/markdown"),
          h("button", { class: "btn sm ghost", type: "button", onclick: render }, PB.icon("refresh", "sm"), "重新生成")),
        h("div", { class: "tool-split wide-left" }, preview, h("div", { style: { display: "grid", gap: "12px", alignContent: "start" } }, h("details", { class: "panel" }, h("summary", { class: "panel-title", style: { cursor: "pointer" } }, "Markdown 原文"), raw), dataBox)));

      function render() {
        const md = PB.buildPlanMarkdown();
        raw.value = md;
        preview.innerHTML = PB.mdBlock(md);
      }

      function renderData() {
        PB.clear(dataBox);
        const st = PB.store.status;
        const keys = Object.keys(PB.store.all().items);
        dataBox.append(h("div", { class: "panel-title", text: "数据管理" }),
          h("p", { class: "small", html: PB.md("当前保存位置：**" + (st.mode === "cloud" ? "本浏览器 + 你的 Claude 账户（仅你可见）" : "本浏览器") + "**。共 " + keys.length + " 项数据，约 " + Math.ceil(PB.store.size() / 1024) + " KB。") }));
        if (st.remoteError) dataBox.append(h("p", { class: "note", text: st.remoteError }));
        const exportText = () => JSON.stringify({ app: "personal-brand-flywheel", exported: new Date().toISOString(), data: PB.store.all() }, null, 2);
        const exportArea = h("textarea", { class: "textarea copy-area", readonly: true, hidden: true, "aria-label": "导出的数据" });
        dataBox.append(h("div", { class: "btn-row" },
          h("button", { class: "btn sm", type: "button", onclick: () => { exportArea.value = exportText(); exportArea.hidden = false; PB.copy(exportArea.value, exportArea); } }, PB.icon("copy", "sm"), "复制备份（JSON）"),
          PB.saveBtn("保存备份文件", () => "personal-brand-backup-" + PB.today() + ".json", exportText, "application/json")), exportArea);
        const fileId = PB.uid("imp");
        const file = h("input", { type: "file", id: fileId, accept: ".json,application/json", class: "sr-only" });
        const paste = h("textarea", { class: "textarea", rows: "3", placeholder: "或把备份 JSON 粘贴到这里", "aria-label": "粘贴备份 JSON" });
        const msg = h("p", { class: "note", "aria-live": "polite" });
        const doImport = (text) => {
          try {
            const obj = JSON.parse(text);
            const data = obj && obj.data && obj.data.items ? obj.data : obj && obj.items ? obj : null;
            if (!data) throw new Error("格式不对");
            PB.store.replaceAll(data);
            msg.textContent = "已导入 " + Object.keys(data.items).length + " 项数据。";
            PB.toast("导入成功");
          } catch (e) { msg.textContent = "导入失败：请确认这是从本页面导出的备份文件（JSON）。"; }
        };
        file.addEventListener("change", () => { const f = file.files && file.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => doImport(String(r.result || "")); r.readAsText(f); file.value = ""; });
        dataBox.append(h("div", { class: "field-label", text: "导入备份（会覆盖当前数据）" }),
          h("div", { class: "btn-row" }, h("label", { for: fileId, class: "btn sm", tabindex: "0", role: "button", onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } } }, PB.icon("upload", "sm"), "选择文件"), file,
            h("button", { class: "btn sm", type: "button", onclick: () => { if (paste.value.trim()) doImport(paste.value); else paste.focus(); } }, "导入粘贴的内容")),
          paste, msg,
          h("div", { class: "field-label", text: "清空所有数据" }),
          h("div", { class: "btn-row" }, PB.confirmBtn("清空全部数据", "再点一次永久清空", () => { PB.store.clear(); PB.toast("已清空"); })),
          h("p", { class: "note", text: "清空会删除本浏览器和云端私有存储中的全部工具数据，无法恢复。建议先保存备份。" }));
      }
      render();
      renderData();
      PB.on("store:replaced", () => { if (document.body.contains(preview)) { render(); renderData(); } });
      PB.on("sync", () => { if (document.body.contains(dataBox)) renderData(); });
    }
  };
})();
