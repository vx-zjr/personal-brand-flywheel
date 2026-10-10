#!/usr/bin/env python3
"""个人品牌飞轮 · 构建与校验脚本（仅依赖 Python 3 标准库）。

用法：
    python3 scripts/build.py            校验 + 构建 dist/index.html 与 dist/artifact.html
    python3 scripts/build.py --check    只校验，不写文件
    python3 scripts/build.py --strict   把警告也当作错误（发布前建议使用）
    python3 scripts/build.py --stale    额外列出所有待复审的小节

产物：
    dist/index.html     完整 HTML 文档，可直接打开或上传到任意静态托管
    dist/artifact.html  Claude Artifact 版（无 doctype/html/head/body，发布时由平台包裹）
    dist/build-info.json 构建信息：版本、时间、统计、警告
    dist/<静态资源>      src/assets/ 中的文件原样复制（如社交分享图 og.png）

校验规则与内容模型见 agent.md §5、§7。新增区块类型或工具时，同步更新本文件中的
BLOCK_SCHEMA / DIAGRAM_KINDS，以及 src/js 中对应的渲染器。
"""
from __future__ import annotations

import datetime as dt
import html
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
SRC = ROOT / "src"
DIST = ROOT / "dist"

# 区块类型 → 必填字段
BLOCK_SCHEMA: dict[str, list[str]] = {
    "p": ["text"],
    "h": ["text"],
    "list": ["items"],
    "steps": ["items"],
    "cards": ["items"],
    "callout": ["text"],
    "table": ["head", "rows"],
    "quote": ["text"],
    "formula": ["text"],
    "compare": ["left", "right"],
    "pairs": ["items"],
    "templates": ["items"],
    "checklist": ["id", "items"],
    "diagram": ["kind", "data"],
    "tool": ["id"],
    "faq": ["items"],
}
DIAGRAM_KINDS = {
    "flywheel": ["stages"],
    "venn": ["circles", "center"],
    "funnel": ["stages"],
    "hourglass": ["stages"],
    "pyramid": ["levels"],
    "ladder": ["steps"],
    "hubspoke": ["hub", "spokes"],
}
CALLOUT_TONES = {"tip", "warn", "insight", "note"}
STAGES = {"build", "maintain", "leverage", "neutral"}
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")
LINK_RE = re.compile(r"\[\[([a-z0-9.\-]+)\|([^\]]+)\]\]")


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def err(self, where: str, msg: str) -> None:
        self.errors.append(f"{where}: {msg}")

    def warn(self, where: str, msg: str) -> None:
        self.warnings.append(f"{where}: {msg}")


def load_json(path: Path, rep: Report):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        rep.err(path.name, "文件不存在")
    except json.JSONDecodeError as e:
        rep.err(path.name, f"JSON 语法错误：第 {e.lineno} 行第 {e.colno} 列：{e.msg}")
    return None


def parse_date(s: str):
    try:
        return dt.date.fromisoformat(s)
    except (TypeError, ValueError):
        return None


def parse_changelog(text: str) -> list[dict]:
    """解析 Keep a Changelog 风格：## [x.y.z] - YYYY-MM-DD / ### 分组 / - 条目"""
    out: list[dict] = []
    cur = None
    group = None
    for line in text.splitlines():
        m = re.match(r"^##\s+\[?(\d+\.\d+\.\d+)\]?\s*-\s*(\d{4}-\d{2}-\d{2})", line)
        if m:
            cur = {"version": m.group(1), "date": m.group(2), "groups": []}
            out.append(cur)
            group = None
            continue
        if cur is None:
            continue
        m = re.match(r"^###\s+(.+)$", line)
        if m:
            group = {"title": m.group(1).strip(), "items": []}
            cur["groups"].append(group)
            continue
        m = re.match(r"^\s*[-*]\s+(.+)$", line)
        if m:
            if group is None:
                group = {"title": "", "items": []}
                cur["groups"].append(group)
            group["items"].append(m.group(1).strip())
    return out


def collect_strings(obj, acc: list[str]) -> list[str]:
    if isinstance(obj, str):
        acc.append(obj)
    elif isinstance(obj, list):
        for x in obj:
            collect_strings(x, acc)
    elif isinstance(obj, dict):
        for v in obj.values():
            collect_strings(v, acc)
    return acc


def js_tool_ids() -> set[str]:
    ids = set()
    for f in sorted((SRC / "js").glob("*.js")):
        ids.update(re.findall(r"PB\.tools\.([a-zA-Z0-9_]+)\s*=", f.read_text(encoding="utf-8")))
    return ids


def js_block_and_diagram_names() -> tuple[set[str], set[str]]:
    blocks_src = (SRC / "js" / "30-blocks.js").read_text(encoding="utf-8")
    diag_src = (SRC / "js" / "25-diagrams.js").read_text(encoding="utf-8")
    m = re.search(r"const BLOCKS = \{(.*?)\n  \};", blocks_src, re.S)
    blocks = set(re.findall(r"^\s{4}([a-z]+)(?::|,)", m.group(1), re.M)) if m else set()
    m = re.search(r"const diagrams = \{(.*?)\n  \};", diag_src, re.S)
    diags = set(re.findall(r"^\s{4}([a-z]+)\(data\)", m.group(1), re.M)) if m else set()
    return blocks, diags


def validate(rep: Report, stale_list: bool) -> dict | None:
    site = load_json(CONTENT / "site.json", rep)
    tools = load_json(CONTENT / "tools.json", rep)
    playbooks = load_json(CONTENT / "playbooks.json", rep)
    resources = load_json(CONTENT / "resources.json", rep)
    if not all([site, tools, playbooks, resources]):
        return None

    # ---- site ----
    for k in ["title", "version", "updated", "chapters", "nav", "hero", "about", "disclaimer"]:
        if k not in site:
            rep.err("site.json", f"缺少字段 {k}")
    if not SEMVER_RE.match(str(site.get("version", ""))):
        rep.err("site.json", "version 必须是语义化版本号 x.y.z")
    if not parse_date(site.get("updated", "")):
        rep.err("site.json", "updated 必须是 YYYY-MM-DD 日期")
    for k in ["repo", "online"]:
        if k in site and not str(site[k]).startswith("https://"):
            rep.err("site.json", f"{k} 必须是 https:// 开头的完整地址")
    lic = site.get("license")
    if lic is not None:
        for k in ["content", "contentUrl", "code", "codeUrl"]:
            if not lic.get(k):
                rep.err("site.json", f"license 缺少 {k}")

    chapters: dict[str, dict] = {}
    for cid in site.get("chapters", []):
        ch = load_json(CONTENT / f"{cid}.json", rep)
        if ch is None:
            continue
        if ch.get("id") != cid:
            rep.err(f"{cid}.json", f"id 应为 {cid}")
        chapters[cid] = ch

    catalog_ids = [t.get("id") for t in tools.get("catalog", [])]
    persona_ids = [p.get("id") for p in playbooks.get("personas", [])]
    routes = {"home", "playbooks", "tools", "resources", "plan", "about",
              "resources.books", "resources.essays", "resources.glossary", "resources.faq",
              "about.changelog", "about.host"}
    routes.update(f"tools.{t}" for t in catalog_ids if t)
    routes.update(f"playbooks.{p}" for p in persona_ids if p)
    for cid, ch in chapters.items():
        routes.add(cid)
        for s in ch.get("sections", []):
            routes.add(f"{cid}.{s.get('id')}")

    impl_tools = js_tool_ids()
    js_blocks, js_diags = js_block_and_diagram_names()
    for b in BLOCK_SCHEMA:
        if js_blocks and b not in js_blocks:
            rep.err("build.py", f"区块类型 {b} 在 BLOCK_SCHEMA 中登记，但 30-blocks.js 没有渲染器")
    for b in js_blocks:
        if b not in BLOCK_SCHEMA:
            rep.warn("30-blocks.js", f"渲染器 {b} 未在 build.py 的 BLOCK_SCHEMA 中登记")
    for d in DIAGRAM_KINDS:
        if js_diags and d not in js_diags:
            rep.err("build.py", f"图示 {d} 在 DIAGRAM_KINDS 中登记，但 25-diagrams.js 没有实现")

    today = dt.date.today()
    fresh_days = int(site.get("freshnessDays", 180))
    volatile_days = int(site.get("volatileDays", 90))
    checklist_ids: dict[str, str] = {}
    stale: list[str] = []
    used_tools: set[str] = set()

    def check_blocks(where: str, blocks: list) -> None:
        for i, b in enumerate(blocks):
            w = f"{where} · 区块 {i + 1}"
            t = b.get("type")
            if t not in BLOCK_SCHEMA:
                rep.err(w, f"未知区块类型 {t!r}")
                continue
            for f in BLOCK_SCHEMA[t]:
                if f not in b or b[f] in (None, "", []):
                    rep.err(w, f"{t} 缺少必填字段 {f}")
            if t == "callout" and b.get("tone") not in CALLOUT_TONES:
                rep.err(w, f"callout.tone 必须是 {sorted(CALLOUT_TONES)} 之一")
            if t == "table":
                n = len(b.get("head", []))
                for r, row in enumerate(b.get("rows", [])):
                    if len(row) != n:
                        rep.err(w, f"表格第 {r + 1} 行有 {len(row)} 列，表头有 {n} 列")
            if t == "steps":
                for it in b.get("items", []):
                    if not isinstance(it, dict) or not it.get("title"):
                        rep.err(w, "steps 的每一项都需要 title")
            if t == "cards":
                for it in b.get("items", []):
                    if not isinstance(it, dict) or not it.get("title"):
                        rep.err(w, "cards 的每一项都需要 title")
                if b.get("cols") not in (None, 2, 3, 4):
                    rep.err(w, "cards.cols 只能是 2、3、4")
            if t == "pairs":
                for it in b.get("items", []):
                    if not (isinstance(it, list) and len(it) == 2):
                        rep.err(w, "pairs 的每一项必须是 [误区, 正解] 两个字符串")
            if t == "compare":
                for side in ("left", "right"):
                    sd = b.get(side) or {}
                    if not sd.get("title") or not sd.get("items"):
                        rep.err(w, f"compare.{side} 需要 title 和 items")
            if t == "templates":
                for it in b.get("items", []):
                    if not it.get("title") or not it.get("text"):
                        rep.err(w, "templates 的每一项需要 title 和 text")
            if t == "checklist":
                cid_ = b.get("id", "")
                if not ID_RE.match(cid_):
                    rep.err(w, f"checklist.id {cid_!r} 只能用小写字母、数字和连字符")
                if cid_ in checklist_ids:
                    rep.err(w, f"checklist.id {cid_!r} 与 {checklist_ids[cid_]} 重复（用户勾选状态以此为键）")
                checklist_ids[cid_] = w
            if t == "diagram":
                kind = b.get("kind")
                if kind not in DIAGRAM_KINDS:
                    rep.err(w, f"未知图示 {kind!r}，可选：{sorted(DIAGRAM_KINDS)}")
                else:
                    for f in DIAGRAM_KINDS[kind]:
                        if f not in (b.get("data") or {}):
                            rep.err(w, f"图示 {kind} 的 data 缺少 {f}")
                if not b.get("caption"):
                    rep.warn(w, "图示缺少 caption（图注是无障碍描述的一部分）")
            if t == "tool":
                tid = b.get("id")
                used_tools.add(tid)
                if tid not in catalog_ids:
                    rep.err(w, f"工具 {tid!r} 不在 tools.json 的 catalog 中")
                if tid not in impl_tools:
                    rep.err(w, f"工具 {tid!r} 没有 JS 实现（PB.tools.{tid}）")

    for cid, ch in chapters.items():
        where = f"{cid}.json"
        for k in ["title", "en", "stage", "kicker", "summary", "reviewed", "sections"]:
            if k not in ch:
                rep.err(where, f"缺少字段 {k}")
        if ch.get("stage") not in STAGES:
            rep.err(where, f"stage 必须是 {sorted(STAGES)} 之一")
        seen = set()
        for s in ch.get("sections", []):
            sid = s.get("id", "")
            sw = f"{cid}.{sid}"
            if not ID_RE.match(sid):
                rep.err(sw, "小节 id 只能用小写字母、数字和连字符")
            if sid in seen:
                rep.err(sw, "小节 id 重复")
            seen.add(sid)
            for k in ["title", "lead", "reviewed", "blocks"]:
                if k not in s:
                    rep.err(sw, f"缺少字段 {k}")
            d = parse_date(s.get("reviewed", ""))
            if not d:
                rep.err(sw, "reviewed 必须是 YYYY-MM-DD")
            else:
                limit = volatile_days if s.get("volatile") else fresh_days
                age = (today - d).days
                if age > limit:
                    stale.append(f"{sw}（{s.get('title')}）已 {age} 天未复审，上限 {limit} 天")
            check_blocks(sw, s.get("blocks", []))

    # 站内链接
    all_text = collect_strings([site, list(chapters.values()), playbooks, tools, resources], [])
    for txt in all_text:
        for m in LINK_RE.finditer(txt):
            if m.group(1) not in routes:
                rep.err("站内链接", f"[[{m.group(1)}|{m.group(2)}]] 指向不存在的路由")

    # ---- tools.json ----
    tw = "tools.json"
    if len(set(catalog_ids)) != len(catalog_ids):
        rep.err(tw, "catalog 中有重复的工具 id")
    for t in tools.get("catalog", []):
        if t.get("id") not in impl_tools:
            rep.err(tw, f"catalog 工具 {t.get('id')!r} 没有 JS 实现")
        if t.get("stage") not in STAGES:
            rep.err(tw, f"工具 {t.get('id')} 的 stage 无效")
        home = t.get("home")
        if home and home not in routes:
            rep.err(tw, f"工具 {t.get('id')} 的 home 路由 {home!r} 不存在")
    for tid in impl_tools:
        if tid not in catalog_ids:
            rep.warn(tw, f"JS 工具 {tid!r} 未登记在 catalog 中")
    audit = tools.get("audit", {})
    dim_ids = [d.get("id") for d in audit.get("dimensions", [])]
    for d in audit.get("dimensions", []):
        if len(d.get("questions", [])) != 3:
            rep.warn(tw, f"体检维度 {d.get('id')} 建议保持 3 道题（当前 {len(d.get('questions', []))}）")
        if d.get("link") not in routes:
            rep.err(tw, f"体检维度 {d.get('id')} 的 link 路由不存在")
    if set(audit.get("example", {})) != set(dim_ids):
        rep.err(tw, "audit.example 的维度必须与 dimensions 一致")
    if len(audit.get("scale", [])) != 5:
        rep.err(tw, "audit.scale 需要 5 个刻度说明")
    q = tools.get("platformQuiz", {})
    opts = {k: {o["id"] for o in q.get(k, [])} for k in ["formats", "audiences", "goals"]}
    pids = set()
    for p in tools.get("platforms", []):
        pw = f"{tw} · 平台 {p.get('id')}"
        if p.get("id") in pids:
            rep.err(pw, "平台 id 重复")
        pids.add(p.get("id"))
        if p.get("region") not in {"cn", "global", "any"}:
            rep.err(pw, "region 必须是 cn / global / any")
        for k in ["formats", "audiences", "goals"]:
            bad = set(p.get(k, [])) - opts[k]
            if bad:
                rep.err(pw, f"{k} 含未定义的选项 {sorted(bad)}")
        if not 1 <= int(p.get("effort", 0)) <= 5:
            rep.err(pw, "effort 必须在 1–5 之间")
        for k in ["strengths", "watch", "monetize"]:
            if not p.get(k):
                rep.err(pw, f"缺少 {k}")
    ex = q.get("example", {})
    for k in ["formats", "audiences", "goals"]:
        if set(ex.get(k, [])) - opts[k]:
            rep.err(tw, f"platformQuiz.example.{k} 含未定义的选项")
    cal = tools.get("calendar", {}).get("example", {})
    pnames = {p["name"] for p in cal.get("pillars", [])}
    for t in cal.get("topics", []):
        if t.get("pillar") not in pnames:
            rep.err(tw, f"日历示例选题《{t.get('title')}》的 pillar 不在示例支柱中")
    for ch_ in cal.get("channels", []):
        if ch_.get("format") not in tools.get("calendar", {}).get("formats", []):
            rep.err(tw, f"日历示例平台 {ch_.get('name')} 的 format 不在 formats 列表中")
    task_ids = set()
    for ph in tools.get("roadmap", {}).get("phases", []):
        if ph.get("stage") not in STAGES:
            rep.err(tw, f"90 天计划阶段 {ph.get('id')} 的 stage 无效")
        w = ph.get("weeks", [])
        if not (len(w) == 2 and 1 <= w[0] <= w[1] <= 12):
            rep.err(tw, f"90 天计划阶段 {ph.get('id')} 的 weeks 必须是 [起始周, 结束周]，范围 1–12")
        for t in ph.get("tasks", []):
            if t.get("id") in task_ids:
                rep.err(tw, f"90 天任务 id {t.get('id')} 重复（用户勾选状态以此为键）")
            task_ids.add(t.get("id"))
            if t.get("link") and t["link"] not in routes:
                rep.err(tw, f"90 天任务 {t.get('id')} 的 link 路由不存在")
    cr = tools.get("crisis", {})
    nodes, outs = cr.get("nodes", {}), cr.get("outcomes", {})
    if cr.get("start") not in nodes:
        rep.err(tw, "crisis.start 必须是 nodes 中的一个节点")
    reach = set()
    stack = [cr.get("start")]
    while stack:
        n = stack.pop()
        if n in reach:
            continue
        reach.add(n)
        for o in nodes.get(n, {}).get("options", []):
            nx = o.get("next")
            if nx not in nodes and nx not in outs:
                rep.err(tw, f"crisis 节点 {n} 的选项指向不存在的 {nx!r}")
            elif nx in nodes:
                stack.append(nx)
            else:
                reach.add(nx)
    for k in list(nodes) + list(outs):
        if k not in reach:
            rep.warn(tw, f"crisis 节点 {k} 从起点不可达")
    ai = tools.get("ai", {})
    for k, need in {"canvasReview": "{canvas}", "topics": "{profile}", "auditPlan": "{scores}", "crisisDraft": "{situation}", "advisor": "{profile}"}.items():
        if need not in ai.get(k, ""):
            rep.err(tw, f"ai.{k} 提示词缺少占位符 {need}")
    fields = {f["id"] for f in tools.get("canvas", {}).get("fields", [])}
    for o in tools.get("canvas", {}).get("outputs", []):
        bad = set(re.findall(r"\{(\w+)\}", o.get("template", ""))) - fields
        if bad:
            rep.err(tw, f"定位画布输出 {o.get('id')} 引用了不存在的字段 {sorted(bad)}")
    crit = {c["id"] for c in tools.get("niche", {}).get("criteria", [])}
    for t in tools.get("niche", {}).get("example", []):
        if set(t.get("scores", {})) != crit:
            rep.err(tw, f"领域评估示例《{t.get('name')}》的评分项与 criteria 不一致")

    # ---- playbooks / resources ----
    if len(set(persona_ids)) != len(persona_ids):
        rep.err("playbooks.json", "角色 id 重复")
    for p in playbooks.get("personas", []):
        for k in ["id", "name", "who", "goal", "time", "example", "positioning", "platforms", "pillars", "actions", "leverage", "pitfalls"]:
            if not p.get(k):
                rep.err("playbooks.json", f"角色 {p.get('id')} 缺少 {k}")
        if not ID_RE.match(p.get("id", "")):
            rep.err("playbooks.json", f"角色 id {p.get('id')!r} 只能用小写字母、数字和连字符")
    for b in resources.get("books", []):
        for k in ["title", "author", "year", "why", "tag"]:
            if not b.get(k):
                rep.err("resources.json", f"书籍《{b.get('title')}》缺少 {k}")
    for g in resources.get("glossary", []):
        if not (g.get("term") and g.get("def")):
            rep.err("resources.json", "术语需要 term 和 def")

    # 未嵌入任何章节的工具（advisor、plan 等独立工具除外）是允许的，只做提示
    for t in catalog_ids:
        if t not in used_tools and t not in {"advisor", "plan", "audit"}:
            rep.warn("tools.json", f"工具 {t} 没有嵌入任何章节，只能从工具箱进入")

    if stale:
        for s in stale:
            rep.warn("内容保鲜", s)
    if stale_list and not stale:
        print("所有小节都在复审周期内。")

    changelog_path = ROOT / "CHANGELOG.md"
    changelog = parse_changelog(changelog_path.read_text(encoding="utf-8")) if changelog_path.exists() else []
    if not changelog:
        rep.err("CHANGELOG.md", "没有解析到任何版本记录")
    elif changelog[0]["version"] != site.get("version"):
        rep.err("CHANGELOG.md", f"最新版本 {changelog[0]['version']} 与 site.json 的 version {site.get('version')} 不一致")

    return {
        "site": site,
        "chapters": chapters,
        "playbooks": playbooks,
        "tools": tools,
        "resources": resources,
        "changelog": changelog,
    }


def stats(content: dict) -> dict:
    chapters = content["chapters"]
    blocks = [b for ch in chapters.values() for s in ch["sections"] for b in s["blocks"]]
    text = "".join(collect_strings(content, []))
    return {
        "chapters": len(chapters),
        "sections": sum(len(ch["sections"]) for ch in chapters.values()),
        "blocks": len(blocks),
        "checklists": sum(1 for b in blocks if b["type"] == "checklist"),
        "checklistItems": sum(len(b["items"]) for b in blocks if b["type"] == "checklist"),
        "diagrams": sum(1 for b in blocks if b["type"] == "diagram"),
        "embeddedTools": sum(1 for b in blocks if b["type"] == "tool"),
        "tools": len(content["tools"]["catalog"]),
        "platforms": len(content["tools"]["platforms"]),
        "personas": len(content["playbooks"]["personas"]),
        "books": len(content["resources"]["books"]),
        "glossary": len(content["resources"]["glossary"]),
        "cjkChars": len(re.findall(r"[一-鿿]", text)),
    }


def bundle(content: dict, host: str) -> str:
    site = content["site"]
    css = "\n".join(p.read_text(encoding="utf-8") for p in sorted((SRC / "css").glob("*.css")))
    js_parts = []
    for p in sorted((SRC / "js").glob("*.js")):
        js_parts.append(f"/* ==== {p.name} ==== */\n" + p.read_text(encoding="utf-8"))
    js = "\n".join(js_parts).replace("</script", "<\\/script")
    shell = (SRC / "shell.html").read_text(encoding="utf-8")
    shell = shell.replace("{{TITLE}}", site["title"]).replace("{{VERSION}}", site["version"])
    payload = {
        "site": site,
        "chapters": content["chapters"],
        "playbooks": content["playbooks"],
        "tools": content["tools"],
        "resources": content["resources"],
        "changelog": content["changelog"][:12],
    }
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    title = site["title"]
    body = (
        f"{shell}\n"
        f'<script id="pb-content" type="application/json">{data}</script>\n'
        f'<script>window.PB_HOST = "{host}";</script>\n'
        f"<script>\n{js}\n</script>\n"
    )
    if host == "artifact":
        return f"<title>{title}</title>\n<style>\n{css}\n</style>\n{body}"
    desc = html.escape(site.get("description", ""), quote=True)
    online = site.get("online", "")
    meta = [
        f'<meta name="description" content="{desc}">',
        '<meta name="theme-color" content="#f2f4f7" media="(prefers-color-scheme: light)">',
        '<meta name="theme-color" content="#0e1217" media="(prefers-color-scheme: dark)">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:title" content="{title}">',
        f'<meta property="og:description" content="{desc}">',
        '<meta name="twitter:card" content="summary_large_image">',
    ]
    if online:
        meta += [
            f'<link rel="canonical" href="{online}">',
            f'<meta property="og:url" content="{online}">',
        ]
        if (SRC / "assets" / "og.png").exists():
            meta.append(f'<meta property="og:image" content="{online}og.png">')
    meta_html = "\n".join(meta) + "\n"
    return (
        "<!doctype html>\n"
        f'<html lang="{site.get("lang", "zh-CN")}">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        f"<title>{title}</title>\n"
        f"{meta_html}"
        f"<style>\n{css}\n</style>\n"
        "</head>\n<body>\n"
        f"{body}"
        "</body>\n</html>\n"
    )


def main(argv: list[str]) -> int:
    check_only = "--check" in argv
    strict = "--strict" in argv
    stale_list = "--stale" in argv
    rep = Report()
    content = validate(rep, stale_list)
    for w in rep.warnings:
        print(f"  ⚠ {w}")
    for e in rep.errors:
        print(f"  ✗ {e}")
    if content is None or rep.errors or (strict and rep.warnings):
        print(f"\n校验未通过：{len(rep.errors)} 个错误，{len(rep.warnings)} 个警告。")
        return 1
    st = stats(content)
    print(
        f"✓ 校验通过（{len(rep.warnings)} 个警告） · v{content['site']['version']} · "
        f"{st['chapters']} 章 {st['sections']} 节 · {st['blocks']} 个区块 · {st['tools']} 个工具 · "
        f"{st['checklists']} 份清单 · {st['diagrams']} 张图 · 约 {st['cjkChars']:,} 个汉字"
    )
    if check_only:
        return 0
    DIST.mkdir(exist_ok=True)
    outputs = {"index.html": bundle(content, "standalone"), "artifact.html": bundle(content, "artifact")}
    for name, page in outputs.items():
        (DIST / name).write_text(page, encoding="utf-8")
        print(f"  → dist/{name}  {len(page.encode('utf-8')) / 1024:.0f} KB")
    assets = SRC / "assets"
    if assets.is_dir():
        for f in sorted(assets.iterdir()):
            if f.is_file():
                shutil.copy2(f, DIST / f.name)
                print(f"  → dist/{f.name}  {f.stat().st_size / 1024:.0f} KB（静态资源）")
    info = {
        "version": content["site"]["version"],
        "contentUpdated": content["site"]["updated"],
        "builtAt": dt.datetime.now().isoformat(timespec="seconds"),
        "stats": st,
        "warnings": rep.warnings,
    }
    (DIST / "build-info.json").write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
