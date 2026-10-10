/* 90-main.js — 启动：读取内嵌内容、连接外壳控件、初始化能力与路由。 */
(function () {
  "use strict";
  const PB = window.PB;

  function injectFonts() {
    // 异步加载标题与数据字体；被拦截时自动回退到系统字体，不阻塞渲染。
    try {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@700;900&family=JetBrains+Mono:wght@400;600&display=swap";
      (document.head || document.documentElement).appendChild(l);
    } catch (e) { /* 忽略 */ }
  }

  const THEMES = [
    { id: "auto", icon: "auto", label: "主题：跟随系统" },
    { id: "light", icon: "sun", label: "主题：浅色" },
    { id: "dark", icon: "moon", label: "主题：深色" }
  ];
  function applyTheme(id) {
    const root = document.documentElement;
    if (id === "light" || id === "dark") root.setAttribute("data-theme", id);
    else root.removeAttribute("data-theme");
    const btn = document.getElementById("pb-theme");
    if (btn) {
      const t = THEMES.find((x) => x.id === id) || THEMES[0];
      btn.replaceChildren(PB.icon(t.icon));
      btn.setAttribute("aria-label", t.label);
      btn.title = t.label;
    }
  }

  function boot() {
    const raw = document.getElementById("pb-content");
    try { PB.content = JSON.parse(raw.textContent); } catch (e) {
      document.getElementById("view").textContent = "内容加载失败，请重新构建页面。";
      console.error(e);
      return;
    }
    injectFonts();
    const menu = document.getElementById("pb-menu");
    menu.replaceChildren(PB.icon("menu"));
    menu.addEventListener("click", PB.toggleRail);
    document.getElementById("pb-scrim").addEventListener("click", PB.closeRail);
    const sb = document.getElementById("pb-search-btn");
    sb.prepend(PB.icon("search", "sm"));
    sb.addEventListener("click", () => PB.search.open());
    const kbd = sb.querySelector(".kbd");
    if (kbd && !/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) kbd.textContent = "Ctrl K";
    // 独立托管时提供主题切换；在 Claude 中由宿主决定主题
    const themeBtn = document.getElementById("pb-theme");
    if (!PB.inClaude && themeBtn) {
      themeBtn.hidden = false;
      let cur = PB.prefs.get("theme", "auto");
      applyTheme(cur);
      themeBtn.addEventListener("click", () => {
        const i = THEMES.findIndex((t) => t.id === cur);
        cur = THEMES[(i + 1) % THEMES.length].id;
        PB.prefs.set("theme", cur);
        applyTheme(cur);
      });
    }
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") PB.closeRail(); });
    window.addEventListener("hashchange", () => PB.navigate());
    PB.on("store:replaced", () => PB.navigate("keep"));
    PB.on("sync", () => PB.renderRail());
    PB.initCaps();
    PB.navigate(true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
