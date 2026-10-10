# agent.md · 个人品牌飞轮 · 智能体协作手册

> 本文件是这个项目的“操作系统”。任何 AI 智能体（Claude Code、Codex、Cursor、Gemini CLI 等）或人类维护者，**修改项目之前先完整读一遍**。
>
> - 规范文件：`agent.md`（本文件）。`AGENTS.md` 是指向它的符号链接；`CLAUDE.md` 通过 `@agent.md` 导入它。只改 `agent.md`。
> - 工作语言：简体中文（代码标识符用英文）。
> - 项目任务：用**详细、全面、可交互、可视化、可托管、可迭代**的方式回答“如何建立、维护、利用个人品牌”。

---

## 0. 30 秒上手

```bash
python3 scripts/build.py            # 校验 content/ 并生成 dist/index.html 与 dist/artifact.html
python3 scripts/build.py --check    # 只校验
python3 scripts/build.py --strict   # 发布前用：警告也算失败
python3 -m http.server 8765 --directory dist   # 本地预览 http://localhost:8765
```

改内容的标准流程：**改 `content/*.json` → 构建 → 预览 → 更新版本号与 CHANGELOG → 提交并推送 GitHub（自动部署公开在线版）→ 发布到同一个 Artifact 链接 → 在 §15 记一笔**。

绝对不要手改 `dist/` 里的文件，它们每次构建都会被覆盖。

---

## 1. 使命与边界

**使命**：给中文读者一套能直接执行的个人品牌系统，覆盖“建立 → 维护 → 利用”的完整飞轮，并配有工具把方法落到读者自己身上。

**读者**：职场专业人士、开发者、自由职业者、内容创作者、创业者、学生、企业高管、转型者。

**六项质量要求与对应机制**

| 要求 | 机制 |
|---|---|
| 详细 | 22 个小节，每节都有方法、清单或模板；约 2.3 万字正文 |
| 全面 | 三阶段 × 6 主题 + 总览 + 8 条角色路线 + 资源与术语 |
| 可交互 | 12 个工具、11 份可勾选清单、全文搜索、阅读进度、数据导入导出 |
| 可视化 | 飞轮、四圈交集、中心辐射、内容金字塔、指标漏斗、营销沙漏、价值阶梯；雷达图、趋势图、甘特条 |
| 可托管 | 零外部依赖的单文件；公开在线版（GitHub Pages，推送即自动部署）+ Artifact 版 + 任意静态托管 |
| 可迭代 | 内容与代码分离、构建校验、语义化版本、CHANGELOG、内容保鲜期、评论与 GitHub Issue 反馈 → 本手册流程 |

**不做的事**：不替某个真实的人做“人设包装”；不提供法律、税务、投资建议（只做一般提示并注明）；不承诺涨粉数字；不编造数据、案例或引用；不加第三方统计与追踪。

---

## 2. 当前状态

> 每次发布后更新本节。

| 项目 | 值 |
|---|---|
| 版本 | 1.1.0（2026-10-10） |
| 托管 | Claude Artifact：https://claude.ai/artifact/UbqsbHxqpcMHA5SuEhywqs （私有，分享由所有者在页面分享菜单中设置） |
| 公开在线版 | https://vx-zjr.github.io/personal-brand-flywheel/ （GitHub Pages，从 `gh-pages` 分支发布，由工作流自动更新） |
| 源码仓库 | GitHub（公开）：https://github.com/vx-zjr/personal-brand-flywheel ，分支 `main`，版本标签 `vX.Y.Z` |
| 许可证 | 内容 CC BY 4.0（`LICENSE-CONTENT`），代码 MIT（`LICENSE`），版权人 vx-zjr |
| 内容规模 | 4 章 22 节 · 183 个区块 · 11 份清单 · 7 张概念图 · 12 个工具 · 22 个平台 · 8 条角色路线 · 19 本书 · 26 个术语 |
| 页面能力（在 Claude 中打开时） | `db`、`user`（每位用户的私有工作簿）、`sample`（AI 功能）、`downloads`（保存文件）、`comments`（仅打开评论框） |

**发布记录**

| 日期 | 版本 | 地址 | 说明 |
|---|---|---|---|
| 2026-10-10 | 1.0.0 | https://claude.ai/artifact/UbqsbHxqpcMHA5SuEhywqs | 首次发布（Artifact 版本 1）；已验证私有存储路径 data/users/<id>/ 可读写 |
| 2026-10-10 | 1.0.0 | https://github.com/vx-zjr/personal-brand-flywheel | 推送到 GitHub 公开仓库，标签 v1.0.0 |
| 2026-10-10 | 1.1.0 | https://vx-zjr.github.io/personal-brand-flywheel/ | 公开在线版上线；许可证；README 重写；Artifact 同步更新 |

---

## 3. 目录结构

```
personal_brand/
├── agent.md              ★ 本手册（唯一规范来源）
├── AGENTS.md -> agent.md  符号链接，供遵循 AGENTS.md 约定的工具读取
├── CLAUDE.md             仅一行 @agent.md，供 Claude Code 自动加载
├── README.md             给人看的项目主页（横幅、徽章、截图、内容地图、工具表）
├── CHANGELOG.md          版本记录（构建时解析并显示在页面“关于与更新”）
├── LICENSE               MIT（代码）
├── LICENSE-CONTENT       CC BY 4.0（内容），开头写明适用范围与署名方式
├── content/              ★ 内容的唯一来源（JSON）
│   ├── site.json         站点元信息：标题、版本、导航、首页文案、关于页区块、免责声明
│   ├── overview.json     第 0 章 总览（4 节）
│   ├── build.json        第 1 章 建立（6 节，sequential: true，小节显示序号）
│   ├── maintain.json     第 2 章 维护（6 节）
│   ├── leverage.json     第 3 章 利用（6 节）
│   ├── playbooks.json    8 条角色路线
│   ├── tools.json        工具数据：目录、体检题库、原型、画布模板、评估标准、平台库、
│   │                     日历示例、90 天任务、指标字段、变现参数、危机决策树、AI 提示词
│   └── resources.json    书籍、文章、术语、常见问题
├── src/
│   ├── assets/og.png     社交分享预览图（构建时复制到 dist/，在线版 og:image 使用）
│   ├── shell.html        页面外壳（顶栏、导航栏、主区域）
│   ├── css/styles.css    设计令牌与全部样式
│   └── js/               按文件名顺序拼接
│       ├── 00-core.js        命名空间 PB、DOM 工具、图标、行内标记、提示、复制、下载
│       ├── 10-store.js       数据存储（localStorage + db 私有同步）、能力初始化、AI 封装
│       ├── 20-charts.js      雷达图、折线图（小多图）、横向条形图、悬停提示
│       ├── 25-diagrams.js    概念图
│       ├── 30-blocks.js      区块渲染器、工具外壳、AI 输出面板
│       ├── 35-views.js       首页、章节、角色路线、工具箱、资源、关于、方案；路由与导航栏
│       ├── 36-search.js      全文搜索
│       ├── 40–51-tool-*.js   12 个工具
│       └── 90-main.js        启动
├── scripts/
│   ├── build.py          校验 + 打包（仅 Python 标准库）
│   ├── make_assets.sh    用无头 Chrome 重新生成横幅、分享图与 README 截图
│   └── brand_card.html   横幅与分享图的渲染模板
├── docs/assets/          README 用的横幅（浅色 / 深色）与 screenshots/ 截图
├── .github/workflows/pages.yml  推送到 main 后：校验 → 构建 → 发布到 gh-pages
├── dist/                 构建产物（勿手改）
│   ├── index.html        独立托管版（完整 HTML 文档）
│   ├── artifact.html     Artifact 版（无 doctype/head/body，由平台包裹）
│   ├── build-info.json   版本、构建时间、统计、警告
│   └── og.png            由 src/assets/ 复制
└── .claude/launch.json   本地预览服务器配置（端口 8765）
```

---

## 4. 架构

### 4.1 数据流

```
content/*.json ─┐
CHANGELOG.md ───┼─► scripts/build.py ──► 校验（结构、链接、ID、保鲜期）
src/css, src/js ┤        │
src/shell.html ─┘        ├─► dist/index.html     （<!doctype html> 完整文档，window.PB_HOST="standalone"）
                         └─► dist/artifact.html  （片段，window.PB_HOST="artifact"）
页面运行时：
  <script id="pb-content" type="application/json"> 内嵌全部内容
  → 90-main.js 读取 → 路由 #view.anchor → 视图渲染区块 → 工具挂载
  → 用户数据：PB.store（localStorage「pb:v1」⇄ db「data/users/<id>/workbook」）
```

### 4.2 关键设计决策

| 决策 | 理由 |
|---|---|
| 内容用 JSON，与代码分离 | 智能体改内容无需碰代码；构建时可做结构校验；区块化让页面能渲染丰富的组件 |
| 单文件、零外部依赖 | 任何静态托管都能直接放；国内网络也能打开；离线可用。唯一的外部请求是可选的 Google Fonts（异步加载，失败自动回退系统字体） |
| 不用框架、不用打包工具 | 降低维护门槛；构建只需 Python 3 |
| 两个产物 | Artifact 平台会自动包裹文档骨架，所以 Artifact 版是片段；独立托管需要完整文档 |
| 纯锚点路由 `#chapter.section` | Artifact 链接只透传字母、数字和 `. _ ~ -` 组成的锚点 |
| 示例数据优先 | 工具首次打开就展示“示例”状态（带黄色“示例”徽章），用户一编辑即转为自己的数据 |
| 本地 + 云端私有同步 | localStorage 保证随处可用；在 Claude 中登录后同步到每位用户私有的 db 文档（含页面所有者在内的其他人不可读） |
| 渐进增强 | 所有 `window.claude` 能力都可能为 null，功能按能力显示或隐藏，独立托管版照常可用 |

### 4.3 运行时模块约定

- 全局命名空间 `window.PB`；每个 JS 文件是一个自执行函数，只通过 `PB` 交互。
- `PB.h(tag, props, ...kids)` 创建元素：会展开数组、跳过 null/false。**原生 `el.append()` 不会**：给 `append` 传数组或 null 会变成 “[object …]” 或 “null” 文字，要么用 `...展开`，要么包进 `PB.h`。
- 文本一律用 `text`/`textContent` 或 `PB.md()`（先转义再加标记）写入，禁止把用户输入拼进 `innerHTML`。
- 需要能力的元素加 `data-cap="sample|no-sample|save|comments"`，由 `PB.applyCaps()` 统一显隐。
- Artifact 环境里 `alert/confirm/prompt`、`window.print()`、`<a download>` 都无效：确认用 `PB.confirmBtn`（两次点击），下载用 `PB.saveFile`（走 `downloads` 能力），复制用 `PB.copy`（失败时选中文本）。

---

## 5. 内容模型

### 5.1 章节文件（overview / build / maintain / leverage）

```json
{
  "id": "build",                 // 与文件名一致
  "title": "建立", "en": "Build",
  "stage": "build",              // build | maintain | leverage | neutral（决定配色）
  "kicker": "第一阶段 · 从 0 到 1",
  "summary": "一句话说明本章",
  "sequential": true,            // true 时小节显示 01、02… 序号（只有真正有先后顺序时才设）
  "reviewed": "2026-10-10",      // 本章最近一次整体复审
  "sections": [
    {
      "id": "position",          // 小写字母、数字、连字符；会成为路由 #build.position
      "title": "定位", "en": "Position",
      "lead": "一两句导语，≤ 60 字",
      "reviewed": "2026-10-10",  // 本节最近复审日期（保鲜期从这里算）
      "volatile": false,         // true = 含法规、平台规则等易变信息，复审周期 90 天
      "blocks": [ … ]            // 见 5.2
    }
  ]
}
```

### 5.2 区块类型

| type | 必填字段 | 可选字段 | 说明 |
|---|---|---|---|
| `p` | text | | 段落，支持行内标记 |
| `h` | text | | 小标题（h3） |
| `list` | items[] | style: `bullet`/`number`/`check` | 列表；check 显示为对勾样式（不可勾选） |
| `steps` | items[{title, text?}] | | **有先后顺序**的步骤，带编号与连线 |
| `cards` | items[{title, text?, tag?}] | cols: 2/3/4 | 卡片网格；手机上自动变一列 |
| `callout` | tone, text | title | tone：`tip` 提示 / `warn` 注意 / `insight` 洞见 / `note` 说明 |
| `table` | head[], rows[][] | caption | 每行列数必须等于表头列数；首列加粗 |
| `quote` | text | by | 引语；归属存疑时 by 写“常被认为出自……（出处存疑）” |
| `formula` | text | note | 公式或核心等式 |
| `compare` | left{title, items}, right{title, items} | mode: `neutral` | 默认左列 ×、右列 ✓；neutral 两列都用圆点 |
| `pairs` | items[[误区, 正解]] | left, right（列标题） | 误区与正解逐行对照 |
| `templates` | items[{title, text}] | | 可复制模板；`【占位符】`会被高亮 |
| `checklist` | id, items[] | title | **可勾选并持久化**；id 全局唯一，见 5.6 |
| `diagram` | kind, data | title, caption | 概念图，见 5.4；caption 必填（兼作无障碍描述） |
| `tool` | id | | 嵌入交互工具，id 必须在 tools.json → catalog 中 |
| `faq` | items[{q, a}] | | 折叠问答 |

### 5.3 行内标记

| 写法 | 效果 |
|---|---|
| `**粗体**` | 粗体 |
| `` `代码` `` | 代码样式 |
| `[[build.position\|定位]]` | 站内链接，路由必须存在（构建会检查） |
| `[文字](https://…)` | 外链（新窗口打开）。只放核实过的链接 |
| 换行符 `\n` | 换行 |

可用路由：`home`、`overview`、`build`、`maintain`、`leverage`、`<章>.<节>`、`playbooks`、`playbooks.<角色id>`、`tools`、`tools.<工具id>`、`resources`、`resources.books|essays|glossary|faq`、`plan`、`about`、`about.changelog`、`about.host`。

### 5.4 图示（diagram.kind）

| kind | data 形状 | 渲染 |
|---|---|---|
| `flywheel` | `{center, centerSub?, stages:[{id, title, en?, items[]}] ×3}` | SVG 三段环 + 图例（items 自动链接到同名小节） |
| `venn` | `{center, circles:[{label, text}] ×4}` | SVG 四圈 + 说明列表；label 保持 2–3 个字 |
| `funnel` | `{stages:[{label, text}]}` | 逐级变窄的条，顺序色阶 |
| `hourglass` | `{pivot, stages:[{label, text}]}` | 先变窄后变宽；pivot 为最窄处的下标 |
| `pyramid` | `{levels:[{label, count?, text}]}` | 上窄下宽 |
| `ladder` | `{steps:[{label, text, price?}]}` | 逐级升高的台阶 |
| `hubspoke` | `{hub:{label, text}, spokes:[{label, text, flow?}] ×≤4}` | 中心辐射，flow 是连线上的标签 |

新增图示：在 `src/js/25-diagrams.js` 的 `diagrams` 对象注册 `kind(data)`，在 `scripts/build.py` 的 `DIAGRAM_KINDS` 登记必填字段，并更新本表。

### 5.5 工具与 tools.json

| 工具 id | 文件 | 数据位置 | 存储键 |
|---|---|---|---|
| audit 品牌体检 | 40-tool-audit.js | `audit`（维度、题目、等级、示例分） | `audit` |
| archetype 品牌原型 | 41-tool-archetype.js | `archetypes` | `archetype` |
| canvas 定位画布 | 42-tool-canvas.js | `canvas.fields`、`canvas.outputs`（模板用 `{字段id}`） | `canvas` |
| niche 领域评估 | 43-tool-niche.js | `niche.criteria`（含权重）、`niche.example` | `niche` |
| platform 平台选择器 | 44-tool-platform.js | `platformQuiz`、`platforms` | `platform` |
| calendar 内容日历 | 45-tool-calendar.js | `calendar.example`、`calendar.formats` | `calendar` |
| roadmap 90 天计划 | 46-tool-roadmap.js | `roadmap.phases[].tasks[]` | `roadmap` |
| metrics 指标仪表盘 | 47-tool-metrics.js | `metrics.fields`、`metrics.example` | `metrics` |
| crisis 危机应对 | 48-tool-crisis.js | `crisis.nodes`、`crisis.outcomes` | （不保存） |
| money 变现计算器 | 49-tool-money.js | `money` | `money` |
| advisor 品牌顾问 | 50-tool-advisor.js | `ai.advisor`、`ai.suggestions` | `advisor` |
| plan 我的方案 | 51-tool-plan.js | 汇总所有存储键 | — |

此外：阅读进度存于 `progress`（`{"build.position": 1}`），清单勾选存于 `check:<清单id>`。

平台选择器评分（44-tool-platform.js 顶部注释）：基础 10 + 形式 ≤35 + 人群 ≤30 + 目标 ≤25；时间不足按 effort 扣分；不出镜时对 `face: true` 的平台扣 14。调整权重时同步更新注释与本段。

AI 提示词全部在 `tools.json → ai`，用 `{占位符}` 注入数据：`canvasReview` 需 `{canvas}`，`topics` 需 `{profile}`，`auditPlan` 需 `{scores}`，`crisisDraft` 需 `{situation}`，`advisor` 需 `{profile}`（构建会检查）。JSON 类提示词要写清字段名与类型，页面会容错解析。

### 5.6 ID 规则（重要）

用户数据以 ID 为键：小节 ID（阅读进度）、清单 ID（勾选状态）、90 天任务 ID、工具 ID、角色 ID。**改名会让用户已有的进度丢失**。

- 新增可以随意；**重命名或删除前先在 §15 记录原因**，并在 CHANGELOG 的“变更”中说明。
- 需要改名时，优先只改 `title`，保留 `id`。
- 构建会拒绝重复的清单 ID 与任务 ID。

---

## 6. 常见任务配方

### R1 修改或新增一段内容
1. 在对应 `content/<章>.json` 找到小节，增改 `blocks`。
2. 内容涉及事实、年份、法规、平台规则时，按 §10 核实并写明出处。
3. 把该小节的 `reviewed` 改为今天。
4. `python3 scripts/build.py`，预览该页面。
5. 按 §9 提升 PATCH 或 MINOR 版本，写 CHANGELOG。

### R2 新增一个小节
1. 在章节的 `sections` 中按阅读顺序插入，`id` 用新的短英文词。
2. 至少包含：`lead`、2 个以上区块、1 个可执行产出（清单、模板或工具）。
3. 如果其他地方要链接它，用 `[[章.新id|标题]]`。
4. 构建、预览；MINOR 版本。

### R3 新增区块类型
1. 在 `src/js/30-blocks.js` 的 `BLOCKS` 注册渲染函数（返回一个元素）。
2. 在 `scripts/build.py` 的 `BLOCK_SCHEMA` 登记必填字段；需要额外校验时写在 `check_blocks()`。
3. 在 `src/css/styles.css` 添加 `.b-<类型>` 样式（只用设计令牌，见 §11）。
4. 如需被搜索，在 `36-search.js` 的 `blockText()` 中提取文字。
5. 更新本手册 §5.2。MINOR 版本。

### R4 新增交互工具
1. 新建 `src/js/5x-tool-<id>.js`，实现 `PB.tools.<id> = { mount(shell, opts) { … } }`。
   - `shell.body` 放内容，`shell.badges` 放“示例”等徽章，`shell.actions` 放右上角按钮。
   - 数据用 `PB.store.get/set("<id>", …)`；未保存时展示示例数据并加 `PB.exampleBadge()`。
   - AI 按钮加 `data-cap="sample"`，用 `PB.aiPanel()` 处理思考中、停止和错误。
2. 在 `tools.json → catalog` 登记 `{id, name, icon, stage, desc, home}`；数据放进 `tools.json`。
3. 如要嵌入章节，加 `{ "type": "tool", "id": "<id>" }`。
4. 在 `51-tool-plan.js` 的 `buildPlanMarkdown()` 中输出它的结果。
5. 更新 §5.5 表格。MINOR 版本。

### R5 新增或调整平台
1. 在 `tools.json → platforms` 增加对象：`id, name, region(cn|global|any), formats[], audiences[], goals[], effort(1–5), lifespan(短|中|长), face, strengths, watch, monetize`。
2. formats / audiences / goals 只能用 `platformQuiz` 中定义的选项（构建会检查）。
3. 平台信息属于易变内容：措辞保持定性，避免具体用户数等会过时的数字；同时把 `build.platform` 小节的 `reviewed` 更新为今天。

### R6 调整体检题目
- 每个维度保持 3 题（构建会警告）；题目写成“我……”的自评陈述句，避免一题问两件事。
- 改动维度 ID 会让用户历史记录无法对比，除非必要不要改。

### R7 年度 / 季度内容刷新
1. `python3 scripts/build.py --stale` 列出超过保鲜期的小节（默认 180 天，`volatile` 小节 90 天）。
2. 重点核查：法规生效日期与新规、平台规则与官方商单平台名称、AI 内容标识要求、趋势判断（`overview.why`）、书目与文章。
3. 用网络搜索核实；改完把对应小节 `reviewed` 设为当天。
4. 更新 `site.json` 的 `updated`；MINOR 版本；CHANGELOG 写“刷新”。

### R8 处理用户反馈
反馈来源：Artifact 评论（读者点“对本节提建议”会把评论锚定到对应小节）、GitHub Issue（公开在线版每节末尾的“去 GitHub 提建议”会预填页面位置，标题以“[建议]”开头）、用户在对话中直接提出。
1. 用 `ArtifactComments` 读取 Artifact 的评论线程；GitHub Issue 在本机网络下无法用 `gh` 读取，可抓取 https://github.com/vx-zjr/personal-brand-flywheel/issues 网页，或请用户转述。
2. 分诊：事实错误（最高优先）→ 体验问题 / Bug → 内容补充 → 新功能。
3. 小改直接处理；大改先在 §14 路线图登记，再和用户确认。
4. 处理后在评论线程回复处理结果与版本号（Issue 由用户在网页上回复或关闭），并在 §15 记录。

### R9 发布、回滚
见 §8。回滚时用 Artifact 的历史版本，或用 git 检出旧版本重新构建发布；同时在 CHANGELOG 记录回滚原因。

### R10 翻译或多语言（规划中）
建议做法：复制 `content/` 为 `content/en/`，`build.py` 增加 `--lang` 参数，分别输出 `dist/en/index.html`；界面文字目前写在 JS 中，需要先抽成 `site.json → ui` 字典。动手前先在 §14 写方案。

### R11 更新 README 截图与分享图
界面或统计数字明显变化后：`python3 scripts/build.py` → 启动本地预览 → `./scripts/make_assets.sh`（读取 `dist/build-info.json` 的统计数字，重新生成 `docs/assets/` 横幅、截图和 `src/assets/og.png`）→ 再构建一次，让 `dist/og.png` 同步。用 Read 工具逐张检查截图不是空白；无头模式下带小节锚点的路由会截成空白，只用不滚动的路由。

---

## 7. 构建、校验与预览

### 7.1 构建脚本检查什么
- JSON 语法；必填字段；`stage`、`tone`、`cols` 等枚举值。
- 区块类型与图示类型都已注册，且 JS 中确有对应实现。
- 站内链接 `[[路由|文字]]` 全部可达；工具、任务、体检维度引用的路由存在。
- 清单 ID、90 天任务 ID、平台 ID、角色 ID 不重复。
- 平台选项、日历示例、画布模板字段、领域评估示例与定义一致；危机决策树没有断链和不可达节点。
- AI 提示词包含必要的占位符。
- 保鲜期：超过周期未复审的小节给出警告。
- `CHANGELOG.md` 最新版本必须等于 `site.json` 的 `version`。

### 7.2 本地预览
- 启动：`python3 -m http.server 8765 --directory dist`，打开 `http://localhost:8765`。在 Claude Code 桌面版中可以直接用 `.claude/launch.json` 里的 `personal-brand` 配置。
- 修改后要**刷新页面**（只改锚点不会重新加载脚本）。

### 7.3 手动验收清单（发布前）
- [ ] `python3 scripts/build.py --strict` 通过
- [ ] 首页、四章、角色路线、工具箱、资源、我的方案、关于页逐一打开，控制台无错误
- [ ] 至少操作 3 个工具（体检答题并保存、画布填写、日历加选题），刷新后数据仍在
- [ ] 375px 手机宽度下无横向滚动；导航抽屉可开合
- [ ] 深色模式（独立托管版右上角切换）文字清晰、图表可读
- [ ] 搜索能找到新加的内容
- [ ] 改了存储结构时：旧数据能被迁移（见 §12）

---

## 8. 发布与托管

### 8.1 Claude Artifact
- 发布文件：`dist/artifact.html`；固定地址：https://claude.ai/artifact/UbqsbHxqpcMHA5SuEhywqs 。
- **更新时必须发布到同一个链接**（§2 发布记录里的地址）：在同一会话中用同一路径重新发布；在新会话中先用 Artifact 工具 `read` 该链接，再带 `url` 发布。
- 首次发布时声明的能力（之后重新发布时省略 `capabilities` 即沿用）：

```json
{ "db": {}, "user": {}, "sample": {}, "downloads": true, "comments": { "composer_only": true } }
```

- Artifact 默认私有；是否分享由用户在页面右上角的分享菜单中决定。
- 页面打开着的读者会在下一个空闲时刻自动收到新版本。

### 8.2 公开在线版（GitHub Pages，自动部署）
- 地址：https://vx-zjr.github.io/personal-brand-flywheel/ ，深链接同样可用（如 `#tools.audit`）。
- 机制：推送到 `main` 触发 `.github/workflows/pages.yml`：运行 `python3 scripts/build.py`（有错误就停止部署，警告不阻断）→ 把 `dist/index.html`、`dist/og.png`、`dist/build-info.json` 和 `.nojekyll` 强制推送到 `gh-pages` 分支 → GitHub Pages 从 `gh-pages` 根目录发布，通常一两分钟生效。
- 不要手动改 `gh-pages` 分支，它每次部署都会被整体覆盖。
- 验证：`curl -s https://vx-zjr.github.io/personal-brand-flywheel/build-info.json` 查看线上版本号；部署失败时在仓库 Actions 页面查看日志。若 Pages 被关闭，请用户在 Settings → Pages 把来源设为 `gh-pages` 分支的根目录。
- 公开版没有 AI、云端同步和评论功能（这些依赖 Claude 运行时），其余全部可用；反馈入口换成 GitHub Issue 链接。

### 8.3 GitHub 仓库与版本控制
- 仓库：https://github.com/vx-zjr/personal-brand-flywheel （公开）。`dist/` 纳入版本控制，便于直接托管。
- 每次发布：构建通过后 `git add -A`，提交信息用“vX.Y.Z：一句话说明”，然后 `git tag -a vX.Y.Z -m "vX.Y.Z"`，`git push --follow-tags`。小修改可以只提交不打标签。
- 提交作者用 GitHub 的 noreply 邮箱（仓库内 `git config user.email` 已设置），不要把个人邮箱写进提交记录。
- 推送走 SSH（`git@github.com:vx-zjr/personal-brand-flywheel.git`，密钥 `~/.ssh/id_ed25519`）。在当前这台机器的网络下 `api.github.com` 连不通，`gh` 命令行不可用；github.com 网页与 SSH 正常。需要建仓库、改仓库设置等 API 操作时，请用户在网页上完成。
- 公开仓库里不要提交：密钥、令牌、读者导出的个人数据（`personal-brand-backup-*.json` 已在 `.gitignore` 中）。

### 8.4 其他静态托管
`dist/index.html` 是完整的单文件，可以直接上传到 Vercel、Netlify、Cloudflare Pages、任意对象存储或服务器。新增任何公开托管都属于公开行为，必须先得到用户明确同意。

---

## 9. 版本与迭代机制

### 9.1 语义化版本
- **MAJOR**：存储结构不兼容、ID 大规模重命名、信息架构重组。
- **MINOR**：新增小节、工具、区块类型、角色路线、季度内容刷新。
- **PATCH**：错别字、措辞、事实小修正、样式与 Bug 修复。

每次发布同时更新：`content/site.json` 的 `version` 与 `updated`、`CHANGELOG.md`（新增条目放最上面，分组用“新增 / 变更 / 修复 / 刷新 / 移除”）、本手册 §2 与 §15；然后按 §8.3 提交、打标签并推送到 GitHub（公开在线版随之自动更新），再把 `dist/artifact.html` 发布到同一个 Artifact 链接。界面变化明显时按 R11 更新 README 截图。

### 9.2 迭代循环

```
收集（评论、对话、--stale 报告、数据）
  → 分诊（事实错误 > Bug > 体验 > 补充 > 新功能）
  → 计划（大改先写进 §14 并和用户确认）
  → 实施（按 §6 配方）
  → 校验（build --strict + §7.3 验收）
  → 发布（同一 Artifact 链接 + 推送 GitHub 并打标签）
  → 记录（CHANGELOG、§2、§15）
```

### 9.3 内容保鲜
- 每个小节都有 `reviewed`；含法规、平台规则、趋势判断的小节标 `volatile: true`。
- 保鲜期在 `site.json`：`freshnessDays`（默认 180）、`volatileDays`（默认 90）。
- 目前标为 volatile 的小节：`overview.why`、`build.platform`、`maintain.reputation`、`maintain.sustain`。

---

## 10. 内容与编辑准则

**准确性**
- 不编造统计数字、案例和引语。引用写清作者、作品、年份；不确定的不写。
- 归属存疑的名言标注“常被认为出自……（出处存疑）”。
- 法规写明名称与生效日期，并注明“一般性提示，不构成法律意见”。当前引用：《互联网广告管理办法》（2023-05-01 施行）、《网络暴力信息治理规定》（2024-08-01 施行）、《人工智能生成合成内容标识办法》（2025-09-01 施行）、欧盟《人工智能法》第 50 条透明度义务（2026-08-02 起适用，部分既有系统的机器可读标记义务有过渡期）、美国 FTC《背书指南》与 2024 年消费者评价规则、《个人信息保护法》。
- 不用真实的个人做正面或负面案例；示例人物用虚构人物并标注“虚构”。
- 许可证：内容以 CC BY 4.0 发布，新增内容必须是原创或与 CC BY 4.0 兼容的材料；不要整段搬运受版权保护的文字，引用保持简短并注明出处。代码以 MIT 发布。
- 平台信息保持定性描述（“女性用户占比较高”而不是具体百分比），避免会快速过时的数字。

**实用性**
- 每个小节至少给一个读完就能做的动作：清单、模板、工具或步骤。
- 优先用列表、卡片、表格；段落不超过 120 字；导语不超过 60 字。

**语言风格**
- 简体中文，专业而不晦涩，直接，少形容词、多动词。用读者熟悉的说法（“订阅”而不是“邮件营销自动化”）。
- 中文标点；中文与英文、数字之间加空格（如“3 个月”“AI 助手”）。
- 避免空洞句式：“值得注意的是”“不是……而是……”的滥用、成串的破折号插入语。
- 序号只用于真正有先后顺序的内容（`steps`、`sequential` 章节）。

**无障碍**
- 每张图都要有 `caption`；图表数值另有直接标注或表格；颜色从不单独承载含义。

---

## 11. 设计系统

- 布局：顶栏 + 左侧导航栏（≤980px 时变成抽屉）+ 主区域。章节页文字列 720px，工具、图示、表格可放宽到 880–1100px。
- 字体：标题 `Noto Serif SC`（思源宋体，异步加载，回退宋体）；正文为系统中文黑体；数据和标签用 `JetBrains Mono`。
- 颜色令牌（都在 `src/css/styles.css` 顶部，浅色在 `:root`，深色在 `prefers-color-scheme` 与 `[data-theme="dark"]` 两处，**两处必须同步修改**）：
  - 中性：`--bg --surface --surface-2 --surface-3 --ink --ink-2 --ink-3 --line --line-2`
  - 阶段色：`--build`（钴蓝）`--maintain`（青绿）`--leverage`（琥珀），各有 `-ink`（文字用）与 `-soft`（底色用）
  - 交互：`--accent --accent-ink --accent-soft --on-accent`
  - 状态：`--good --warn --bad`（只表示好 / 坏，不当系列色用）
  - 顺序色阶：`--ord-1…5` 与对应文字色 `--ord-fg-1…5`（漏斗、阶梯、金字塔）
  - 内容支柱色：`--pc-1…6`（日历中区分支柱，始终配合文字标签）
- 三个阶段色已用数据可视化校验脚本检查过色盲区分度与对比度；改色后要重新校验。
- 组件只用令牌，不写只在一种主题下可读的字面颜色。
- 避免：所有元素统一圆角加阴影、卡片侧边色条、emoji 当图标、紫蓝渐变大标题。

---

## 12. 用户数据与隐私

- 存储形状：`{ v: 1, updated: <毫秒时间戳>, items: { <key>: <value> } }`。
- 本地：localStorage 键 `pb:v1`（数据）与 `pb:prefs`（主题、上次选的角色等偏好，不同步）。所有读写都包在 try/catch 中，存储不可用时页面照常工作。
- 云端（仅在 Claude 中且已登录）：db 文档 `data/users/<用户id>/workbook`，属于平台规定的私有路径，**页面所有者也读不到其他用户的数据**；单文档上限 256 KiB，超过时只存本地并提示。
- 冲突策略：加载时比较 `updated`，取较新的一方。
- 读者可以在“我的方案”页导出 / 导入 JSON 备份或清空全部数据。
- **修改存储结构**：提升 `10-store.js` 中的 `SCHEMA_VERSION`，在 `migrate()` 中把旧结构转换为新结构；导入旧备份时也会经过 `migrate()`。这属于 MAJOR 版本。
- 不添加任何第三方统计、追踪或外部请求（Google Fonts 除外）。

---

## 13. 页面能力（Artifact runtime）

| 能力 | 用途 | 不可用时 |
|---|---|---|
| `db` + `user` | 每位用户的私有工作簿同步 | 只存本地 |
| `sample` | 定位诊断、选题生成、30 天计划、危机声明初稿、品牌顾问对话。消耗**读者自己**的 Claude 用量，首次调用会请求授权 | 隐藏 AI 按钮；品牌顾问显示说明 |
| `downloads` | 保存 .md / .csv / .json 文件 | 只提供复制 |
| `comments`（composer_only） | 每节末尾“对本节提建议”，打开平台的评论框并锚定到该节 | 隐藏按钮 |

相关代码集中在 `10-store.js`（`PB.initCaps`、`PB.applyCaps`、AI 错误处理）。新增能力前先读 `artifact-capabilities` 技能的类型定义，并更新本表与 §8.1 的声明。

---

## 14. 路线图

- [ ] 英文版（见 R10）
- [ ] 更多角色路线：医生、律师、教师、设计师、销售
- [ ] 经授权的真实案例库（需要当事人书面同意）
- [ ] 内容日历导出 iCal（.ics）
- [ ] 体检结果的分享卡片（生成图片）
- [ ] “品牌手册”独立页：从定位画布与原型自动生成“是 / 而不是”语调规范
- [ ] 平台库按年度刷新机制（字段加 `reviewed`）
- [ ] 打开即用的“14 天冲刺”轻量路线，给时间更少的读者

---

## 15. 迭代日志

> 只追加，不改写。格式：日期 · 版本 · 执行者 · 做了什么 · 关键决定。

- 2026-10-10 · 1.0.0 · Claude（Opus 5.5）· 从零搭建项目：四章 22 节内容、12 个工具、8 条角色路线、资源页；构建与校验脚本；Artifact 版与独立托管版。决定：内容 JSON 化、零依赖单文件、纯锚点路由、本地 + 私有云端同步、示例数据优先。法规与 AI 标识信息已于当日联网核实。
- 2026-10-10 · 1.0.0 · Claude（Opus 5.5）· 初始化 git 仓库并推送到 GitHub 公开仓库 vx-zjr/personal-brand-flywheel，打标签 v1.0.0。发现本机网络下 api.github.com 不通（gh 登录卡在最后一步），改用 SSH 推送；仓库由用户在网页上创建。
- 2026-10-10 · 1.1.0 · Claude（Opus 5.5）· 加入许可证（内容 CC BY 4.0 + 代码 MIT）；页脚与关于页显示许可证、源码与在线版本；公开版每节加“去 GitHub 提建议”；新增 GitHub Pages 自动部署工作流（gh-pages 分支）；README 重写（横幅、徽章、截图、内容地图、工具表、架构图）；新增 `scripts/make_assets.sh` 与 `scripts/brand_card.html`；构建加入 og:image、canonical 与静态资源复制。决定：Pages 用 gh-pages 分支而不是官方 Pages Actions，因为本机无法调用 API 修改 Pages 设置，而推送 gh-pages 分支可自动启用。

---

## 16. 给智能体的工作约定

**要做**
- 先读本手册，再读要改的 `content/*.json` 或源文件。
- 小步修改，每步都跑 `python3 scripts/build.py`。
- 涉及事实先核实；不确定就标注或不写。
- 改完更新版本号、CHANGELOG、§2、§15。
- 和用户沟通用中文；需要用户决定的事（大改、公开发布、删除）先问。

**不要做**
- 手改 `dist/`。
- 随意重命名或删除 ID（见 5.6）。
- 引入外部依赖、CDN 脚本、统计代码。
- 编造数据、引语或真实人物案例。
- 把内容写进 JS（内容属于 `content/`），或把界面逻辑写进 JSON。
- 未经同意把页面发布到公开网站（含启用 GitHub Pages），或修改 Artifact 的分享设置。
- 在公开仓库里提交密钥、令牌或任何读者的个人数据。
- 删除或改动许可证文件、页面上的许可证与署名信息。
- 手动修改 `gh-pages` 分支（它由工作流生成）。

---

## 附录：可以直接对智能体说的话

- “按 agent.md 的 R7，刷新所有 volatile 小节，并发布新版本。”
- “读取这个 Artifact 的评论，按 R8 处理，处理完回复每条评论。”
- “按 R4 新增一个‘个人网站检查器’工具，嵌入 build.platform 小节。”
- “按 R5 加入一个新平台：……”
- “给‘利用’章新增一节‘出海与跨文化品牌’，要求有清单和一个图示。”
- “把指标仪表盘增加‘播放量’字段，注意旧数据兼容。”
