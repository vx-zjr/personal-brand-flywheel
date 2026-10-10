# 个人品牌飞轮

如何建立、维护、利用个人品牌：一套可执行、可度量、可迭代的系统。

- **内容**：总览 + 建立 / 维护 / 利用三章（共 22 节）、8 条角色路线、资源与术语。
- **工具**：品牌体检、品牌原型、定位画布、领域评估、平台选择器、内容日历、90 天计划、指标仪表盘、危机应对、变现计算器、品牌顾问（AI）、我的方案（汇总导出）。
- **托管**：`dist/index.html` 是零依赖的单文件，可直接打开或上传到任意静态托管；`dist/artifact.html` 用于发布为 Claude Artifact。

## 快速开始

```bash
python3 scripts/build.py                        # 校验并构建
python3 -m http.server 8765 --directory dist    # 预览：http://localhost:8765
```

## 如何更新

所有维护规则都写在 [agent.md](agent.md)：目录结构、内容模型、常见任务配方、发布与版本流程、编辑准则。
让 AI 智能体维护时，直接说“先读 agent.md，再……”即可（Claude Code 会通过 CLAUDE.md 自动加载它）。

版本历史见 [CHANGELOG.md](CHANGELOG.md)。
