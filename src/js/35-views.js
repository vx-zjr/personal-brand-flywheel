/* 35-views.js — 页面视图与外壳：导航栏、路由、首页、章节页、角色路线、工具箱、资源、关于。
   路由用纯锚点（Artifact 链接只透传字母数字和 . _ ~ -）：#build、#build.position、#tools.audit。 */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;
  const STAGE_CLASS = { build: "build", maintain: "maintain", leverage: "leverage" };

  /* ---------- 进度与统计 ---------- */
  PB.progress = {
    get: () => PB.store.get("progress", {}),
    isDone: (route) => !!PB.store.get("progress", {})[route],
    toggle(route) {
      PB.store.update("progress", (cur) => { const n = Object.assign({}, cur); if (n[route]) delete n[route]; else n[route] = 1; return n; }, {});
    },
    chapter(chId) {
      const ch = PB.content.chapters[chId];
      const p = PB.store.get("progress", {});
      const done = ch.sections.filter((s) => p[chId + "." + s.id]).length;
      return { done, total: ch.sections.length };
    }
  };
  function allChecklists() {
    const out = [];
    PB.content.site.chapters.forEach((cid) => PB.content.chapters[cid].sections.forEach((s) => s.blocks.forEach((b) => { if (b.type === "checklist") out.push(b); })));
    return out;
  }
  PB.stats = function stats() {
    const C = PB.content;
    const main = ["build", "maintain", "leverage"];
    return {
      stages: main.length,
      topics: main.reduce((n, id) => n + C.chapters[id].sections.length, 0),
      tools: C.tools.catalog.length,
      personas: C.playbooks.personas.length,
      checklists: allChecklists().length
    };
  };

  /* ---------- 导航栏 ---------- */
  function railLink(item, route) {
    const ch = PB.content.chapters[item.id];
    const active = route.view === item.id || (item.id === "tools" && route.view === "tools");
    const kids = [];
    if (ch) kids.push(h("i", { class: "rail-dot " + (STAGE_CLASS[ch.stage] || "") }));
    else kids.push(PB.icon(item.icon, "sm"));
    kids.push(h("span", { text: item.title }));
    if (ch) { const p = PB.progress.chapter(item.id); kids.push(h("span", { class: "rail-count", text: p.done + "/" + p.total })); }
    const a = h("a", { class: "rail-link" + (active ? " active" : ""), href: "#" + item.id, "aria-current": active ? "page" : null }, kids);
    const frag = [a];
    if (ch && active) {
      const prog = PB.progress.get();
      frag.push(h("div", { class: "rail-sub" }, ch.sections.map((s, i) => h("a", { href: "#" + ch.id + "." + s.id, "data-sec": ch.id + "." + s.id },
        h("span", { text: (ch.sequential ? (i + 1) + ". " : "") + s.title }),
        prog[ch.id + "." + s.id] ? h("span", { class: "done" }, PB.icon("check", "sm")) : null))));
    }
    return frag;
  }
  PB.renderRail = function renderRail() {
    const rail = document.getElementById("pb-rail");
    if (!rail) return;
    const route = PB.route || { view: "home" };
    const nav = PB.content.site.nav;
    const groups = [
      { label: "指南", ids: ["home", "overview", "build", "maintain", "leverage"] },
      { label: "实践", ids: ["playbooks", "tools", "plan"] },
      { label: "参考", ids: ["resources", "about"] }
    ];
    PB.clear(rail);
    groups.forEach((g) => {
      rail.append(h("nav", { class: "rail-group", "aria-label": g.label }, h("div", { class: "rail-label", text: g.label }), g.ids.map((id) => nav.find((n) => n.id === id)).filter(Boolean).map((it) => railLink(it, route))));
    });
    const st = PB.store.status;
    rail.append(h("div", { class: "rail-foot" },
      h("div", {}, "v" + PB.content.site.version + " · 更新于 " + PB.content.site.updated),
      h("div", { class: "sync-pill" + (st.mode === "cloud" ? " cloud" : "") }, st.mode === "cloud" ? "数据已同步到你的 Claude 账户" : "数据保存在本浏览器")));
    PB.markCurrentSection();
  };

  /* ---------- 首页 ---------- */
  function homeView() {
    const C = PB.content, site = C.site, st = PB.stats();
    const view = h("div", { class: "view wide" });
    view.append(h("section", { class: "hero" },
      h("div", { class: "hero-copy" },
        h("div", { class: "eyebrow" }, h("span", { class: "dot" }), site.hero.kicker, h("span", { class: "muted", text: "v" + site.version })),
        h("h1", { class: "hero-title", text: site.hero.title }),
        h("p", { class: "hero-text", text: site.hero.text }),
        h("div", { class: "btn-row" },
          h("a", { class: "btn primary", href: "#tools.audit" }, PB.icon("radar", "sm"), "开始品牌体检（约 5 分钟）"),
          h("a", { class: "btn", href: "#overview" }, "从总览读起", PB.icon("arrowRight", "sm"))),
        h("div", { class: "stats-strip" },
          h("span", {}, h("b", { text: String(st.stages) }), "个阶段"),
          h("span", {}, h("b", { text: String(st.topics) }), "个主题"),
          h("span", {}, h("b", { text: String(st.tools) }), "个交互工具"),
          h("span", {}, h("b", { text: String(st.personas) }), "条角色路线"),
          h("span", {}, h("b", { text: String(st.checklists) }), "份行动清单"))),
      h("div", { class: "hero-figure" }, PB.flywheelSvg(C.chapters.overview.sections.find((s) => s.id === "flywheel").blocks.find((b) => b.type === "diagram").data))
    ));

    // 我的进度
    const totalSec = site.chapters.reduce((n, id) => n + C.chapters[id].sections.length, 0);
    const doneSec = Object.keys(PB.progress.get()).length;
    const audit = PB.store.get("audit", null);
    const lastAudit = audit && audit.history && audit.history.length ? audit.history[audit.history.length - 1] : null;
    const rm = PB.store.get("roadmap", { done: {} });
    const rmTotal = C.tools.roadmap.phases.reduce((n, p) => n + p.tasks.length, 0);
    const rmDone = Object.keys(rm.done || {}).length;
    const cls = allChecklists();
    const ckTotal = cls.reduce((n, b) => n + b.items.length, 0);
    const ckDone = cls.reduce((n, b) => n + Object.keys(PB.store.get("check:" + b.id, {})).length, 0);
    const tile = (label, value, sub, href, pct) => h("a", { class: "stat", href, style: { textDecoration: "none", color: "inherit" } },
      h("span", { class: "stat-label", text: label }), h("span", { class: "stat-value", text: value }), h("span", { class: "small muted", text: sub }),
      pct !== undefined ? h("span", { class: "meter", style: { marginTop: "6px" } }, h("span", { style: { width: pct + "%" } })) : null);
    view.append(h("section", { class: "home-section" },
      h("h2", {}, "我的进度", h("span", { class: "muted", text: "数据只保存在你自己的空间" })),
      h("div", { class: "my-progress" },
        tile("阅读进度", Math.round((doneSec / totalSec) * 100) + "%", "已读 " + doneSec + " / " + totalSec + " 节", "#overview", (doneSec / totalSec) * 100),
        tile("最近体检", lastAudit ? lastAudit.total + " 分" : "未体检", lastAudit ? lastAudit.date + " · " + lastAudit.level : "去做第一次体检", "#tools.audit"),
        tile("90 天计划", Math.round((rmDone / rmTotal) * 100) + "%", "完成 " + rmDone + " / " + rmTotal + " 项任务", "#tools.roadmap", (rmDone / rmTotal) * 100),
        tile("行动清单", ckDone + " 项", "共 " + ckTotal + " 项，分布在各章节", "#build", ckTotal ? (ckDone / ckTotal) * 100 : 0))));

    // 三阶段
    view.append(h("section", { class: "home-section" },
      h("h2", {}, "三个阶段", h("span", { class: "muted", text: "建立 → 维护 → 利用 → 回到建立" })),
      h("div", { class: "stage-cards" }, ["build", "maintain", "leverage"].map((id) => {
        const ch = C.chapters[id], p = PB.progress.chapter(id), prog = PB.progress.get();
        return h("article", { class: "stage-card" },
          h("span", { class: "stage-mark" }, h("i", { class: "swatch " + id }), ch.kicker),
          h("h3", {}, h("a", { href: "#" + id, text: ch.title }), h("span", { class: "en", text: ch.en })),
          h("p", { text: ch.summary }),
          h("ol", {}, ch.sections.map((s, i) => h("li", {}, h("a", { href: "#" + id + "." + s.id }, h("span", { class: "n", text: ch.sequential ? String(i + 1).padStart(2, "0") : "·" }), h("span", { text: s.title }), prog[id + "." + s.id] ? h("span", { class: "done" }, PB.icon("check", "sm")) : null)))),
          h("div", { class: "progress-bar", title: "已读 " + p.done + "/" + p.total }, h("span", { style: { width: (p.done / p.total) * 100 + "%", background: "var(--" + id + ")" } })));
      }))));

    // 角色
    view.append(h("section", { class: "home-section" },
      h("h2", {}, "按角色开始", h("span", { class: "muted", text: "不同身份，打法不同" })),
      h("div", { class: "persona-grid" }, C.playbooks.personas.map((p) => h("a", { class: "persona-card", href: "#playbooks." + p.id }, h("strong", { text: p.name }), h("span", { text: p.who }))))));

    // 工具
    view.append(h("section", { class: "home-section" },
      h("h2", {}, "工具箱", h("span", { class: "muted", text: "填写的数据会自动保存" })),
      toolGrid()));

    view.append(h("section", { class: "home-section" },
      h("aside", { class: "b-callout tone-note" },
        h("span", { class: "callout-label" }, PB.icon("refresh", "sm"), "持续更新"),
        h("div", { class: "callout-text", html: PB.md("这份指南按 agent.md 的流程持续迭代：内容与代码分离、每次更新都有版本号和更新日志。当前版本 **v" + site.version + "**（" + site.updated + "）。查看 [[about|关于与更新]]。") }))));
    return view;
  }

  function toolGrid() {
    return h("div", { class: "tool-grid" }, PB.content.tools.catalog.map((t) => h("a", { class: "tool-card", href: t.id === "plan" ? "#plan" : "#tools." + t.id },
      h("span", { class: "tool-icon " + (t.stage || "") }, PB.icon(t.icon)),
      h("span", {}, h("strong", { text: t.name }), h("span", { text: t.desc })))));
  }

  /* ---------- 章节页 ---------- */
  function sectionEl(ch, sec, idx) {
    const route = ch.id + "." + sec.id;
    const done = PB.progress.isDone(route);
    const el = h("section", { class: "section", id: "s-" + ch.id + "-" + sec.id, "data-route": route });
    el.append(h("header", { class: "section-head" },
      h("div", { class: "section-kicker" }, ch.sequential ? h("span", { class: "section-num", text: String(idx + 1).padStart(2, "0") }) : null, h("span", { text: sec.en || "" })),
      h("h2", { class: "section-title", text: sec.title }),
      sec.lead ? h("p", { class: "section-lead", html: PB.md(sec.lead) }) : null));
    el.append(h("div", { class: "section-body" }, PB.renderBlocks(sec.blocks)));
    const readBtn = h("button", { class: "btn sm" + (done ? "" : " primary"), type: "button", "aria-pressed": done ? "true" : "false" }, PB.icon("check", "sm"), done ? "已读" : "标记为已读");
    readBtn.addEventListener("click", () => {
      PB.progress.toggle(route);
      const now = PB.progress.isDone(route);
      readBtn.className = "btn sm" + (now ? "" : " primary");
      readBtn.setAttribute("aria-pressed", now ? "true" : "false");
      readBtn.lastChild.textContent = now ? "已读" : "标记为已读";
      PB.renderRail();
      PB.updateChapterMeta && PB.updateChapterMeta();
    });
    const commentBtn = h("button", { class: "btn sm ghost", type: "button", "data-cap": "comments", hidden: true }, PB.icon("message", "sm"), "对本节提建议");
    commentBtn.addEventListener("click", () => openComposer(el));
    const issue = !PB.inClaude ? PB.issueUrl(route, ch.title + " › " + sec.title) : null;
    const issueLink = issue ? h("a", { class: "btn sm ghost", href: issue, target: "_blank", rel: "noopener noreferrer" }, PB.icon("message", "sm"), "去 GitHub 提建议") : null;
    el.append(h("footer", { class: "section-foot" }, readBtn, commentBtn, issueLink, h("span", { class: "muted", text: "内容复审于 " + (sec.reviewed || ch.reviewed) })));
    return el;
  }
  async function openComposer(el) {
    if (!PB.cap.comments) return;
    try {
      const r = await PB.cap.comments.openComposer({ element: el });
      if (r && r.opened === false) PB.toast("请先点击页面，再打开评论");
    } catch (e) {
      const code = e && e.code;
      if (code === "rate_limited") PB.toast("操作太频繁，请稍后再试");
      else { PB.commentsDisabled = true; PB.applyCaps(); PB.toast("当前视图无法发表评论"); }
    }
  }

  function chapterView(chId) {
    const C = PB.content, ch = C.chapters[chId];
    const view = h("div", { class: "view chapter stage-" + (ch.stage || "neutral") });
    const p = PB.progress.chapter(chId);
    const meta = h("div", { class: "chapter-meta" });
    const fillMeta = () => {
      const pr = PB.progress.chapter(chId);
      PB.clear(meta).append(
        h("span", { class: "progress-bar" }, h("span", { style: { width: (pr.done / pr.total) * 100 + "%" } })),
        h("span", { text: "已读 " + pr.done + " / " + pr.total + " 节" }),
        h("span", { text: "复审于 " + ch.reviewed }));
    };
    fillMeta();
    PB.updateChapterMeta = fillMeta;
    view.append(h("header", { class: "page-head" },
      h("div", { class: "eyebrow" }, h("span", { class: "dot" }), ch.kicker, h("span", { text: "· " + ch.sections.length + " 节" })),
      h("h1", { class: "page-title" }, ch.title, h("span", { class: "en", text: ch.en })),
      h("p", { class: "page-sub", text: ch.summary }),
      meta,
      h("nav", { class: "toc-chips", "aria-label": "本章小节" }, ch.sections.map((s, i) => h("a", { class: "toc-chip", href: "#" + chId + "." + s.id }, ch.sequential ? h("span", { class: "n", text: String(i + 1).padStart(2, "0") }) : null, s.title)))));
    ch.sections.forEach((sec, i) => view.append(sectionEl(ch, sec, i)));
    const order = C.site.chapters, idx = order.indexOf(chId);
    const prev = idx > 0 ? C.chapters[order[idx - 1]] : null, next = idx < order.length - 1 ? C.chapters[order[idx + 1]] : null;
    view.append(h("nav", { class: "chapter-nav", "aria-label": "章节切换" },
      prev ? h("a", { href: "#" + prev.id }, h("span", { class: "muted", text: "← 上一章" }), h("strong", { text: prev.title })) : null,
      next ? h("a", { class: "next", href: "#" + next.id }, h("span", { class: "muted", text: "下一章 →" }), h("strong", { text: next.title })) : h("a", { class: "next", href: "#playbooks" }, h("span", { class: "muted", text: "继续 →" }), h("strong", { text: "选择你的角色路线" }))));
    void p;
    return view;
  }

  /* ---------- 角色路线 ---------- */
  function playbooksView(anchor) {
    const P = PB.content.playbooks;
    const current = P.personas.find((x) => x.id === anchor) || P.personas.find((x) => x.id === PB.prefs.get("persona")) || P.personas[0];
    const view = h("div", { class: "view wide" });
    view.append(h("header", { class: "page-head" },
      h("div", { class: "eyebrow" }, h("span", { class: "dot" }), P.kicker),
      h("h1", { class: "page-title" }, P.title, h("span", { class: "en", text: P.en })),
      h("p", { class: "page-sub", text: P.summary })));
    const grid = h("div", { class: "persona-grid", role: "group", "aria-label": "选择角色", style: { marginTop: "24px" } }, P.personas.map((p) => h("a", { class: "persona-card", href: "#playbooks." + p.id, "aria-pressed": p.id === current.id ? "true" : "false" }, h("strong", { text: p.name }), h("span", { text: p.who }))));
    view.append(grid);
    PB.prefs.set("persona", current.id);
    const list = (title, items) => h("div", { class: "pd-block" }, h("h4", { text: title }), h("ul", {}, items.map((t) => h("li", { html: PB.md(t) }))));
    view.append(h("section", { class: "persona-detail section", id: "persona-" + current.id },
      h("div", { class: "section-head" },
        h("div", { class: "section-kicker", text: "角色路线" }),
        h("h2", { class: "section-title", text: current.name }),
        h("p", { class: "section-lead", text: current.who }),
        h("div", { class: "pd-meta" }, h("span", { class: "badge build", text: "目标：" + current.goal }), h("span", { class: "badge", text: "投入：" + current.time }))),
      h("aside", { class: "b-callout tone-note" }, h("span", { class: "callout-label" }, PB.icon("persona", "sm"), "示例（虚构）"), h("div", { class: "callout-text", text: current.example })),
      h("div", { class: "b-formula" }, h("div", { class: "formula-note", text: "定位公式" }), h("div", { class: "formula-text", text: current.positioning })),
      h("div", { class: "pd-grid" },
        list("推荐平台组合", current.platforms),
        list("内容支柱", current.pillars),
        list("利用路径", current.leverage),
        list("常见陷阱", current.pitfalls)),
      PB.blocks.checklist({ id: "persona-" + current.id, title: "关键动作（勾选跟踪）", items: current.actions }),
      h("div", { class: "btn-row" },
        h("a", { class: "btn primary", href: "#tools.canvas" }, PB.icon("target", "sm"), "用定位画布写出你的定位"),
        h("a", { class: "btn", href: "#tools.platform" }, PB.icon("layers", "sm"), "用平台选择器验证"),
        h("a", { class: "btn", href: "#tools.roadmap" }, PB.icon("flag", "sm"), "开始 90 天计划"))));
    return view;
  }

  /* ---------- 工具箱 ---------- */
  function toolsView(anchor) {
    const T = PB.content.tools;
    if (anchor && PB.tools[anchor]) {
      const meta = T.catalog.find((t) => t.id === anchor) || { name: anchor, desc: "" };
      const home = meta.home && meta.home !== "tools" ? meta.home : null;
      const homeTitle = home ? routeTitle(home) : null;
      const view = h("div", { class: "view wide" });
      view.append(h("header", { class: "page-head" },
        h("div", { class: "eyebrow" }, h("a", { href: "#tools", text: "← 工具箱" }), homeTitle ? h("span", {}, "· 相关章节：", h("a", { href: "#" + home, text: homeTitle })) : null),
        h("h1", { class: "page-title", text: meta.name }),
        h("p", { class: "page-sub", text: meta.desc })));
      const holder = h("div", { style: { marginTop: "24px" } }, PB.mountTool(anchor, { full: true }));
      view.append(holder);
      return view;
    }
    const view = h("div", { class: "view wide" });
    view.append(h("header", { class: "page-head" },
      h("div", { class: "eyebrow" }, h("span", { class: "dot" }), "动手做"),
      h("h1", { class: "page-title" }, "工具箱", h("span", { class: "en", text: "Toolkit" })),
      h("p", { class: "page-sub", text: "12 个交互工具，覆盖从定位到变现的全过程。你填写的内容会自动保存，并可以在“我的方案”中汇总导出。" })));
    view.append(h("div", { style: { marginTop: "24px" } }, toolGrid()));
    return view;
  }
  function routeTitle(route) {
    const [v, a] = route.split(".");
    const ch = PB.content.chapters[v];
    if (ch) { const s = a ? ch.sections.find((x) => x.id === a) : null; return ch.title + (s ? " · " + s.title : ""); }
    const nav = PB.content.site.nav.find((n) => n.id === v);
    return nav ? nav.title : route;
  }
  PB.routeTitle = routeTitle;

  /* ---------- 资源 ---------- */
  function resourcesView() {
    const R = PB.content.resources;
    const view = h("div", { class: "view wide" });
    view.append(h("header", { class: "page-head" },
      h("div", { class: "eyebrow" }, h("span", { class: "dot" }), R.kicker),
      h("h1", { class: "page-title" }, R.title, h("span", { class: "en", text: R.en })),
      h("p", { class: "page-sub", text: R.summary }),
      h("nav", { class: "toc-chips" }, [["books", "书籍"], ["essays", "文章"], ["glossary", "术语表"], ["faq", "常见问题"]].map(([id, t]) => h("a", { class: "toc-chip", href: "#resources." + id, text: t })))));
    const sec = (id, title, lead, body) => h("section", { class: "section", id: "s-resources-" + id, "data-route": "resources." + id },
      h("header", { class: "section-head" }, h("h2", { class: "section-title", text: title }), lead ? h("p", { class: "section-lead", text: lead }) : null), body);
    view.append(sec("books", "书籍", "按主题标注；有中文版的同时给出中文书名。", h("div", { class: "book-grid" }, R.books.map((b) => h("article", { class: "book" },
      h("span", { class: "badge", text: b.tag }), h("strong", { text: b.zh ? "《" + b.zh + "》" : b.title }), h("span", { class: "meta", text: (b.zh ? b.title + " · " : "") + b.author + " · " + b.year }), h("p", { text: b.why }))))));
    view.append(sec("essays", "文章与论文", "本指南引用的经典文章，可按标题与作者检索原文。", h("div", { class: "book-grid" }, R.essays.map((e) => h("article", { class: "book" },
      h("strong", { text: e.title }), h("span", { class: "meta", text: e.author + " · " + e.source + (e.year ? " · " + e.year : "") }), h("p", { text: e.why }))))));
    view.append(sec("glossary", "术语表", null, h("dl", { class: "glossary" }, R.glossary.map((g) => h("div", { class: "gl-item" }, h("dt", {}, g.term, h("span", { text: g.en })), h("dd", { text: g.def }))))));
    view.append(sec("faq", "常见问题", null, PB.blocks.faq({ items: R.faq })));
    return view;
  }

  /* ---------- 关于 ---------- */
  function aboutView() {
    const C = PB.content, site = C.site;
    const view = h("div", { class: "view prose" });
    view.append(h("header", { class: "page-head" },
      h("div", { class: "eyebrow" }, h("span", { class: "dot" }), "版本 v" + site.version + " · 更新于 " + site.updated),
      h("h1", { class: "page-title" }, "关于与更新", h("span", { class: "en", text: "About" })),
      h("p", { class: "page-sub", text: site.tagline })));
    view.append(h("section", { class: "section" }, h("div", { class: "section-body" }, PB.renderBlocks(site.about))));
    view.append(h("section", { class: "section", id: "s-about-changelog", "data-route": "about.changelog" },
      h("header", { class: "section-head" }, h("h2", { class: "section-title", text: "更新日志" })),
      h("div", { class: "changelog" }, (C.changelog || []).map((v) => h("article", { class: "changelog-item" },
        h("h4", {}, "v" + v.version, h("span", { text: v.date })),
        v.groups.map((g) => [g.title ? h("h5", { text: g.title }) : null, h("ul", {}, g.items.map((t) => h("li", { html: PB.md(t) })))]))))));
    const env = PB.inClaude ? "Claude Artifact（私有托管，可分享）" : "公开在线版 / 独立托管";
    const lic = site.license || {};
    const linkCell = (href, text) => h("td", {}, h("a", { href, target: "_blank", rel: "noopener noreferrer", text: text || href }));
    view.append(h("section", { class: "section", id: "s-about-host", "data-route": "about.host" },
      h("header", { class: "section-head" }, h("h2", { class: "section-title", text: "托管与运行环境" })),
      h("div", { class: "section-body" },
        h("div", { class: "table-wrap" }, h("table", { class: "b-table" }, h("tbody", {},
          h("tr", {}, h("td", { text: "当前环境" }), h("td", { text: env })),
          h("tr", {}, h("td", { text: "数据存储" }), h("td", { text: PB.store.status.mode === "cloud" ? "本浏览器 + Claude 账户私有存储" : "本浏览器" })),
          h("tr", {}, h("td", { text: "AI 能力" }), h("td", { text: PB.cap.sample ? "可用（调用时会请求你的授权，消耗你的 Claude 用量）" : "不可用（仅在 Claude 中打开时提供）" })),
          h("tr", {}, h("td", { text: "内容规模" }), h("td", { text: PB.stats().topics + " 个主题 · " + PB.stats().checklists + " 份清单 · " + C.tools.catalog.length + " 个工具" })),
          site.online ? h("tr", {}, h("td", { text: "公开在线版" }), linkCell(site.online)) : null,
          site.repo ? h("tr", {}, h("td", { text: "源码仓库" }), linkCell(site.repo)) : null,
          lic.content ? h("tr", {}, h("td", { text: "许可证" }), h("td", {}, "内容采用 ", h("a", { href: lic.contentUrl, target: "_blank", rel: "noopener noreferrer", text: lic.content }), "，代码采用 ", h("a", { href: lic.codeUrl, target: "_blank", rel: "noopener noreferrer", text: lic.code }), "。转载或改编请注明出处并附上源码链接。")) : null))),
        h("p", { class: "b-p", html: PB.md("页面是一个零外部依赖的单文件：公开在线版由 GitHub Pages 托管，每次推送到 GitHub 后自动更新；也可以发布为 Claude Artifact，或上传到 Vercel、Netlify、Cloudflare Pages 等任何静态托管服务。") }),
        h("aside", { class: "b-callout tone-warn" }, h("span", { class: "callout-label" }, PB.icon("warn", "sm"), "免责声明"), h("div", { class: "callout-text", text: site.disclaimer })))));
    return view;
  }

  /* ---------- 我的方案 ---------- */
  function planView() {
    const view = h("div", { class: "view wide" });
    view.append(h("header", { class: "page-head" },
      h("div", { class: "eyebrow" }, h("span", { class: "dot" }), "汇总与导出"),
      h("h1", { class: "page-title" }, "我的方案", h("span", { class: "en", text: "My plan" })),
      h("p", { class: "page-sub", text: "把定位画布、品牌原型、平台选择、内容日历、90 天计划、体检与指标汇总成一份个人品牌战略书。也可以在这里备份、导入或清空数据。" })));
    view.append(h("div", { style: { marginTop: "24px" } }, PB.mountTool("plan", { full: true })));
    return view;
  }

  PB.views = { home: homeView, chapter: chapterView, playbooks: playbooksView, tools: toolsView, resources: resourcesView, about: aboutView, plan: planView };

  /* ---------- 路由 ---------- */
  function parseHash() {
    let raw = "";
    try { raw = decodeURIComponent((location.hash || "").replace(/^#/, "")); } catch (e) { raw = ""; }
    if (!raw) return { view: "home", anchor: null };
    const parts = raw.split(".");
    return { view: parts[0], anchor: parts.slice(1).join(".") || null };
  }
  let currentKey = null;
  PB.navigate = function navigate(force) {
    const r = parseHash();
    const C = PB.content;
    const known = ["home", "playbooks", "tools", "resources", "about", "plan"].concat(C.site.chapters);
    if (known.indexOf(r.view) < 0) { r.view = "home"; r.anchor = null; }
    const isChapter = !!C.chapters[r.view];
    const key = r.view === "tools" || r.view === "playbooks" ? r.view + "." + (r.anchor || "") : r.view;
    PB.route = r;
    const main = document.getElementById("view");
    if (force || key !== currentKey) {
      PB.tip.hide();
      PB.clear(main);
      let v;
      if (isChapter) v = PB.views.chapter(r.view);
      else v = PB.views[r.view](r.anchor);
      main.append(v, siteFoot());
      PB.applyCaps(main);
      currentKey = key;
      const title = isChapter ? C.chapters[r.view].title : (C.site.nav.find((n) => n.id === r.view) || {}).title;
      document.title = (r.view === "home" ? "" : (title ? title + " · " : "")) + C.site.title;
      setupScrollSpy();
    }
    PB.renderRail();
    closeRail();
    if (force === "keep") return;
    const target = r.anchor && (isChapter ? document.getElementById("s-" + r.view + "-" + r.anchor) : (r.view === "resources" || r.view === "about") ? document.getElementById("s-" + r.view + "-" + r.anchor) : null);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    else window.scrollTo(0, 0);
  };

  function siteFoot() {
    const site = PB.content.site, lic = site.license || {};
    const ext = (href, text) => h("a", { href, target: "_blank", rel: "noopener noreferrer", text });
    return h("footer", { class: "site-foot" },
      h("span", { text: site.title + " v" + site.version }),
      h("span", { text: "内容更新于 " + site.updated }),
      h("a", { href: "#about", text: "更新日志与托管说明" }),
      h("a", { href: "#plan", text: "备份与导出数据" }),
      lic.content ? h("span", {}, "内容 ", ext(lic.contentUrl, lic.content), " · 代码 ", ext(lic.codeUrl, lic.code)) : null,
      site.repo ? ext(site.repo, "GitHub 源码") : null,
      site.online && PB.inClaude ? ext(site.online, "公开在线版") : null);
  }
  // 公开版（不在 Claude 中）用 GitHub Issue 收集反馈，标题与正文预填页面位置
  PB.issueUrl = function issueUrl(route, title) {
    const site = PB.content.site;
    if (!site.repo) return null;
    const t = "[建议] " + (title || route);
    const body = "页面位置：" + title + "（#" + route + "）\n版本：v" + site.version + "\n\n我的建议：\n";
    return site.repo + "/issues/new?title=" + encodeURIComponent(t) + "&body=" + encodeURIComponent(body);
  };

  /* ---------- 当前小节高亮 ---------- */
  // 取“顶部已越过阅读线”的最后一个小节作为当前小节
  let spyTicking = false;
  function updateCurrentSection() {
    spyTicking = false;
    const secs = PB.$$(".section[data-route]");
    if (!secs.length) return;
    let cur = null;
    for (const el of secs) { if (el.getBoundingClientRect().top <= 140) cur = el; else break; }
    const route = (cur || secs[0]).getAttribute("data-route");
    if (route !== PB.currentSection) { PB.currentSection = route; PB.markCurrentSection(); }
  }
  window.addEventListener("scroll", () => { if (!spyTicking) { spyTicking = true; requestAnimationFrame(updateCurrentSection); } }, { passive: true });
  function setupScrollSpy() { PB.currentSection = null; requestAnimationFrame(updateCurrentSection); }
  PB.markCurrentSection = function markCurrentSection() {
    PB.$$(".rail-sub a").forEach((a) => a.classList.toggle("current", a.getAttribute("data-sec") === PB.currentSection));
  };

  /* ---------- 移动端抽屉 ---------- */
  function closeRail() {
    const rail = document.getElementById("pb-rail"), scrim = document.getElementById("pb-scrim");
    if (rail) rail.classList.remove("open");
    if (scrim) scrim.hidden = true;
    const btn = document.getElementById("pb-menu");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  PB.toggleRail = function toggleRail() {
    const rail = document.getElementById("pb-rail"), scrim = document.getElementById("pb-scrim");
    const open = !rail.classList.contains("open");
    rail.classList.toggle("open", open);
    scrim.hidden = !open;
    document.getElementById("pb-menu").setAttribute("aria-expanded", open ? "true" : "false");
  };
  PB.closeRail = closeRail;
})();
