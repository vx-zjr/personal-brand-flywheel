/* 36-search.js — 全文搜索：章节、小节、区块文字、角色路线、工具、术语、常见问题、书籍。 */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;
  let index = null;

  function blockText(b) {
    const parts = [];
    const push = (v) => { if (typeof v === "string") parts.push(PB.plain(v)); };
    ["text", "title", "caption", "note", "by"].forEach((k) => push(b[k]));
    if (Array.isArray(b.items)) b.items.forEach((it) => {
      if (typeof it === "string") push(it);
      else if (Array.isArray(it)) it.forEach(push);
      else if (it && typeof it === "object") ["title", "text", "q", "a", "tag"].forEach((k) => push(it[k]));
    });
    if (b.head) b.head.forEach(push);
    if (b.rows) b.rows.forEach((r) => r.forEach(push));
    if (b.left && b.left.items) { push(b.left.title); b.left.items.forEach(push); }
    if (b.right && b.right.items) { push(b.right.title); b.right.items.forEach(push); }
    if (b.data) {
      const d = b.data;
      ["stages", "circles", "levels", "steps", "spokes"].forEach((k) => (d[k] || []).forEach((x) => { push(x.label || x.title); push(x.text); (x.items || []).forEach(push); }));
      if (d.hub) { push(d.hub.label); push(d.hub.text); }
    }
    return parts.join(" ");
  }

  function build() {
    const C = PB.content;
    const out = [];
    C.site.chapters.forEach((cid) => {
      const ch = C.chapters[cid];
      out.push({ route: cid, path: "章节", title: ch.title + " · " + ch.en, text: ch.summary });
      ch.sections.forEach((s) => out.push({ route: cid + "." + s.id, path: ch.title, title: s.title, text: [s.lead || ""].concat(s.blocks.map(blockText)).join(" ") }));
    });
    C.playbooks.personas.forEach((p) => out.push({ route: "playbooks." + p.id, path: "角色路线", title: p.name, text: [p.who, p.example, p.positioning].concat(p.platforms, p.pillars, p.actions, p.leverage, p.pitfalls).join(" ") }));
    C.tools.catalog.forEach((t) => out.push({ route: t.id === "plan" ? "plan" : "tools." + t.id, path: "工具", title: t.name, text: t.desc }));
    C.tools.platforms.forEach((p) => out.push({ route: "tools.platform", path: "平台图谱", title: p.name, text: [p.strengths, p.watch, p.monetize].join(" ") }));
    C.resources.glossary.forEach((g) => out.push({ route: "resources.glossary", path: "术语表", title: g.term + "（" + g.en + "）", text: g.def }));
    C.resources.faq.forEach((f) => out.push({ route: "resources.faq", path: "常见问题", title: f.q, text: PB.plain(f.a) }));
    C.resources.books.forEach((b) => out.push({ route: "resources.books", path: "书籍", title: (b.zh ? "《" + b.zh + "》" : b.title), text: [b.title, b.author, b.why, b.tag].join(" ") }));
    return out.map((e) => Object.assign(e, { lt: e.title.toLowerCase(), lx: e.text.toLowerCase() }));
  }

  function snippet(text, q) {
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return text.slice(0, 80);
    const start = Math.max(0, i - 28), end = Math.min(text.length, i + q.length + 52);
    return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
  }
  function highlight(el, text, q) {
    const lower = text.toLowerCase();
    let pos = 0;
    while (q) {
      const i = lower.indexOf(q, pos);
      if (i < 0) break;
      el.append(text.slice(pos, i), h("mark", { text: text.slice(i, i + q.length) }));
      pos = i + q.length;
    }
    el.append(text.slice(pos));
    return el;
  }

  function search(q) {
    if (!index) index = build();
    const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const res = [];
    index.forEach((e) => {
      let score = 0;
      for (const t of terms) {
        const inTitle = e.lt.indexOf(t) >= 0, inText = e.lx.indexOf(t) >= 0;
        if (!inTitle && !inText) { score = -1; break; }
        score += (inTitle ? 10 : 0) + (inText ? 2 : 0);
      }
      if (score > 0) res.push({ e, score });
    });
    res.sort((a, b) => b.score - a.score);
    return res.slice(0, 30).map((r) => r.e);
  }

  let overlay = null, input = null, list = null, active = 0, results = [];
  function render() {
    PB.clear(list);
    const q = input.value.trim().toLowerCase();
    results = search(q);
    if (!q) { list.append(h("div", { class: "search-empty", text: "输入关键词，例如：定位、简介、小红书、危机、变现" })); return; }
    if (!results.length) { list.append(h("div", { class: "search-empty", text: "没有找到相关内容，换个关键词试试" })); return; }
    active = PB.clamp(active, 0, results.length - 1);
    const first = q.split(/\s+/)[0];
    results.forEach((e, i) => {
      const a = h("a", { class: "search-hit" + (i === active ? " active" : ""), href: "#" + e.route, role: "option", "aria-selected": i === active ? "true" : "false" },
        h("span", { class: "path", text: e.path }),
        highlight(h("strong", {}), e.title, first),
        highlight(h("span", { class: "snip" }), snippet(e.text, first), first));
      a.addEventListener("click", () => close());
      list.append(a);
    });
  }
  function open() {
    if (!overlay) {
      input = h("input", { type: "text", inputmode: "search", enterkeyhint: "search", id: "pb-search-input", placeholder: "搜索全部内容…", "aria-label": "搜索", autocomplete: "off" });
      list = h("div", { class: "search-results", role: "listbox", "aria-label": "搜索结果" });
      overlay = h("div", { class: "search-overlay", role: "dialog", "aria-modal": "true", "aria-label": "搜索", hidden: true },
        h("div", { class: "search-panel" }, h("div", { class: "search-input-row" }, PB.icon("search"), input, h("button", { class: "icon-btn", type: "button", "aria-label": "关闭搜索", onclick: () => close() }, PB.icon("x"))), list));
      overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
      input.addEventListener("input", () => { active = 0; render(); });
      input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") { active = Math.min(results.length - 1, active + 1); render(); e.preventDefault(); }
        else if (e.key === "ArrowUp") { active = Math.max(0, active - 1); render(); e.preventDefault(); }
        else if (e.key === "Enter" && results[active]) { location.hash = results[active].route; close(); e.preventDefault(); }
        else if (e.key === "Escape") { close(); }
      });
      document.body.append(overlay);
    }
    overlay.hidden = false;
    render();
    setTimeout(() => input.focus(), 0);
  }
  function close() { if (overlay) overlay.hidden = true; }
  PB.search = { open, close, run: search, rebuild: () => { index = null; } };

  document.addEventListener("keydown", (e) => {
    const typing = /input|textarea|select/i.test((e.target && e.target.tagName) || "") || (e.target && e.target.isContentEditable);
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open(); }
    else if (e.key === "/" && !typing) { e.preventDefault(); open(); }
    else if (e.key === "Escape" && overlay && !overlay.hidden) close();
  });
})();
