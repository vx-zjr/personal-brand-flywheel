/* 30-blocks.js — 内容区块渲染器。content/*.json 中每个 block 的 type 对应这里的一个函数。
   新增区块类型：在 BLOCKS 中注册渲染函数，同时在 scripts/build.py 的 BLOCK_SCHEMA 中登记必填字段，
   并更新 agent.md §5.2 的区块表。 */
(function () {
  "use strict";
  const PB = window.PB;
  const { h } = PB;

  const TONE_LABEL = { tip: "提示", warn: "注意", insight: "洞见", note: "说明" };

  function checklist(b) {
    const key = "check:" + b.id;
    const box = h("div", { class: "b-checklist", "data-check": b.id });
    const countEl = h("span", { class: "chk-count num" });
    const list = h("div", { class: "chk-list" });
    const render = () => {
      const st = PB.store.get(key, {});
      PB.clear(list);
      let done = 0;
      b.items.forEach((text, i) => {
        const on = !!st[i];
        if (on) done++;
        const id = "chk-" + b.id + "-" + i;
        const input = h("input", { type: "checkbox", id, checked: on });
        input.addEventListener("change", () => {
          PB.store.update(key, (cur) => { const next = Object.assign({}, cur); if (input.checked) next[i] = 1; else delete next[i]; return next; }, {});
          render();
        });
        list.append(h("label", { class: "chk-item" + (on ? " on" : ""), for: id }, input, h("span", { html: PB.md(text) })));
      });
      countEl.textContent = done + " / " + b.items.length;
    };
    box.append(h("div", { class: "chk-head" }, h("h4", {}, PB.icon("check", "sm"), b.title || "清单"), countEl), list);
    render();
    return box;
  }

  const BLOCKS = {
    p: (b) => h("p", { class: "b-p", html: PB.md(b.text) }),
    h: (b) => h("h3", { class: "b-h", text: b.text }),
    list: (b) => {
      const tag = b.style === "number" ? "ol" : "ul";
      return h(tag, { class: "b-list" + (b.style === "check" ? " check" : "") }, b.items.map((it) => h("li", { html: PB.md(it) })));
    },
    steps: (b) => h("ol", { class: "b-steps" }, b.items.map((it) => h("li", {}, h("div", {}, h("div", { class: "step-title", html: PB.md(it.title) }), it.text ? h("div", { class: "step-text", html: PB.md(it.text) }) : null)))),
    cards: (b) => h("div", { class: "b-cards", style: { "--cols": String(b.cols || 3) } }, b.items.map((it) => h("div", { class: "card" },
      h("div", { class: "card-title" }, h("span", { html: PB.md(it.title) }), it.tag ? h("span", { class: "card-tag", text: it.tag }) : null),
      it.text ? h("div", { class: "card-text", html: PB.md(it.text) }) : null))),
    callout: (b) => h("aside", { class: "b-callout tone-" + (b.tone || "note") },
      h("span", { class: "callout-label" }, PB.icon(b.tone || "note", "sm"), TONE_LABEL[b.tone] || "说明"),
      b.title ? h("div", { class: "callout-title", html: PB.md(b.title) }) : null,
      h("div", { class: "callout-text", html: PB.md(b.text) })),
    table: (b) => h("div", { class: "table-wrap" }, h("table", { class: "b-table" },
      b.caption ? h("caption", { text: b.caption }) : null,
      h("thead", {}, h("tr", {}, b.head.map((c) => h("th", { scope: "col", text: c })))),
      h("tbody", {}, b.rows.map((r) => h("tr", {}, r.map((c) => h("td", { html: PB.md(c) }))))))),
    quote: (b) => h("figure", { class: "b-quote" }, h("blockquote", { text: "“" + b.text + "”" }), b.by ? h("figcaption", { text: "—— " + b.by }) : null),
    formula: (b) => h("div", { class: "b-formula" }, h("div", { class: "formula-text", text: b.text }), b.note ? h("div", { class: "formula-note", html: PB.md(b.note) }) : null),
    compare: (b) => {
      const neutral = b.mode === "neutral";
      return h("div", { class: "b-compare" },
        h("div", { class: "compare-col " + (neutral ? "neu" : "neg") }, h("h4", { text: b.left.title }), h("ul", {}, b.left.items.map((it) => h("li", { html: PB.md(it) })))),
        h("div", { class: "compare-col " + (neutral ? "neu" : "pos") }, h("h4", { text: b.right.title }), h("ul", {}, b.right.items.map((it) => h("li", { html: PB.md(it) })))));
    },
    pairs: (b) => h("div", { class: "b-pairs" },
      h("div", { class: "pairs-head" }, h("div", { text: b.left || "误区" }), h("div", { text: b.right || "正解" })),
      b.items.map((pr) => h("div", { class: "pair" }, h("div", { class: "myth", html: PB.md(pr[0]) }), h("div", { class: "fact", html: PB.md(pr[1]) })))),
    templates: (b) => h("div", { class: "b-templates" }, b.items.map((t) => {
      const textEl = h("div", { class: "tpl-text", html: PB.markSlots(t.text) });
      return h("div", { class: "tpl" }, h("div", { class: "tpl-title", text: t.title }), textEl, PB.copyBtn(t.text, "复制", textEl));
    })),
    checklist,
    diagram: (b) => {
      const fn = PB.diagrams[b.kind];
      const fig = h("figure", { class: "b-diagram" });
      if (b.title) fig.append(h("div", { class: "diagram-title", text: b.title }));
      fig.append(fn ? fn(b.data) : h("div", { class: "empty", text: "未知图示：" + b.kind }));
      if (b.caption) fig.append(h("figcaption", { html: PB.md(b.caption) }));
      return fig;
    },
    tool: (b) => PB.mountTool(b.id, { embedded: true }),
    faq: (b) => h("div", { class: "b-faq" }, b.items.map((it) => h("details", {}, h("summary", {}, h("span", { text: it.q }), PB.icon("chevron", "sm")), h("div", { class: "faq-a", html: PB.md(it.a) }))))
  };
  PB.blocks = BLOCKS;
  PB.blockTypes = Object.keys(BLOCKS);

  PB.renderBlocks = function renderBlocks(blocks) {
    return blocks.map((b) => {
      const fn = BLOCKS[b.type];
      if (!fn) return h("div", { class: "empty", text: "未知区块类型：" + b.type });
      try { return fn(b); } catch (e) { console.error("区块渲染失败", b, e); return h("div", { class: "empty", text: "此区块渲染失败（" + b.type + "）" }); }
    });
  };

  /* 工具外壳：图标 + 标题 + 描述 + 徽章 + 主体 */
  PB.toolShell = function toolShell(id, opts) {
    const meta = PB.content.tools.catalog.find((t) => t.id === id) || { name: id, desc: "", icon: "grid", stage: "neutral" };
    const badges = h("span", { class: "tool-badges" });
    const actions = h("div", { class: "btn-row" });
    const body = h("div", { class: "tool-body" });
    const titleRow = h("div", { class: "tool-name" }, meta.name, badges);
    const titles = h("div", { class: "tool-titles" }, titleRow, h("div", { class: "tool-desc", text: meta.desc }));
    if (opts && opts.embedded) {
      titleRow.append(h("a", { class: "small", href: "#tools." + id, style: { fontWeight: "400", marginLeft: "4px" }, text: "全屏打开" }));
    }
    // 全屏工具页已有页头，这里只保留徽章与操作按钮
    const head = opts && opts.full
      ? h("div", { class: "tool-head compact" }, badges, actions)
      : h("div", { class: "tool-head" }, h("span", { class: "tool-icon " + (meta.stage || "") }, PB.icon(meta.icon, "lg")), titles, actions);
    const el = h("section", { class: "tool", "data-tool": id, "aria-label": meta.name }, head, body);
    return { el, body, badges, actions, meta };
  };
  PB.exampleBadge = (text) => h("span", { class: "badge example", text: text || "示例" });

  PB.mountTool = function mountTool(id, opts) {
    const tool = PB.tools[id];
    if (!tool) return h("div", { class: "empty", text: "未知工具：" + id });
    const shell = PB.toolShell(id, opts);
    try { tool.mount(shell, opts || {}); } catch (e) { console.error("工具加载失败", id, e); shell.body.append(h("div", { class: "empty", text: "工具加载失败，请刷新页面重试。" })); }
    PB.applyCaps(shell.el);
    return shell.el;
  };

  /* AI 输出区：返回 {el, run(promiseFactory)} —— 统一处理 Thinking、停止、错误 */
  PB.aiPanel = function aiPanel(title) {
    const out = h("div", { class: "ai-out" });
    const err = h("div", { class: "ai-error", hidden: true });
    const stopBtn = h("button", { class: "btn sm ghost", type: "button", hidden: true }, PB.icon("stop", "sm"), "停止");
    const el = h("div", { class: "ai-box", hidden: true }, h("div", { class: "panel-title" }, h("span", {}, title || "Claude 的建议"), stopBtn), out, err);
    let ctl = null;
    stopBtn.addEventListener("click", () => { if (ctl) ctl.abort(); });
    return {
      el, out,
      async run(fn, render) {
        el.hidden = false;
        err.hidden = true;
        PB.clear(out).append(h("div", { class: "ai-thinking", text: "Claude 正在思考……" }));
        ctl = new AbortController();
        stopBtn.hidden = false;
        try {
          const result = await fn(ctl.signal, (partial) => { out.innerHTML = PB.mdBlock(partial); });
          PB.clear(out);
          render(result, out);
          return result;
        } catch (e) {
          if (e && e.code === "cancelled") { if (!out.textContent.trim() || out.querySelector(".ai-thinking")) PB.clear(out).append(h("div", { class: "muted small", text: "已停止。" })); }
          else {
            if (e && e.text && e.code !== "refused" && e.code !== "invalid_json") out.innerHTML = PB.mdBlock(e.text); else PB.clear(out);
            err.textContent = PB.aiErrorText(e);
            err.hidden = false;
            PB.aiHandleError(e);
          }
          return null;
        } finally {
          stopBtn.hidden = true;
          ctl = null;
        }
      }
    };
  };
})();
