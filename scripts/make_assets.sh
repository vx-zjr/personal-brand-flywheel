#!/usr/bin/env bash
# 重新生成 README 横幅、社交分享图（src/assets/og.png）与 README 截图。
# 依赖：google-chrome（或用 CHROME=... 指定）；截图前先构建并启动本地预览：
#   python3 scripts/build.py && python3 -m http.server 8765 --directory dist
# 注意：无头模式下带小节锚点（如 #build.position）的页面会截成空白，截图只用不滚动的路由。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="${CHROME:-google-chrome}"
PORT="${PORT:-8765}"
PROFILE="$(mktemp -d)"   # 独立的临时配置，避免连到正在使用的浏览器
trap 'rm -rf "$PROFILE"' EXIT

shot() { # 用法：shot 缩放 宽,高 输出文件 地址 [额外参数]
  "$CHROME" --headless=new --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check \
    --disable-gpu --hide-scrollbars ${5:-} --force-device-scale-factor="$1" --window-size="$2" \
    --virtual-time-budget=9000 --screenshot="$3" "$4" >/dev/null 2>&1
  echo "  → ${3#"$ROOT"/}"
}

stats="sections=22&tools=12&personas=8&checklists=11"
if [ -f "$ROOT/dist/build-info.json" ]; then
  stats=$(python3 -c 'import json,sys; s=json.load(open(sys.argv[1]))["stats"]; print("sections=%d&tools=%d&personas=%d&checklists=%d" % (s["sections"], s["tools"], s["personas"], s["checklists"]))' "$ROOT/dist/build-info.json")
fi
card="file://$ROOT/scripts/brand_card.html"
echo "横幅与分享图（$stats）："
mkdir -p "$ROOT/docs/assets" "$ROOT/src/assets"
shot 2 1280,420 "$ROOT/docs/assets/banner-light.png" "$card#theme=light&mode=banner&$stats"
shot 2 1280,420 "$ROOT/docs/assets/banner-dark.png" "$card#theme=dark&mode=banner&$stats"
shot 1 1200,630 "$ROOT/src/assets/og.png" "$card#theme=light&mode=og&$stats"

base="http://localhost:$PORT/"
if curl -fsS -o /dev/null "$base"; then
  echo "截图（来自 $base）："
  S="$ROOT/docs/assets/screenshots"; mkdir -p "$S"
  shot 1 1440,900  "$S/home-light.png"          "$base#home"
  shot 1 1440,900  "$S/home-dark.png"           "$base#home" --force-dark-mode
  shot 1 1440,900  "$S/tool-audit.png"          "$base#tools.audit"
  shot 1 1440,900  "$S/tool-metrics-dark.png"   "$base#tools.metrics" --force-dark-mode
  shot 1 1440,900  "$S/tool-platform.png"       "$base#tools.platform"
  shot 1 1440,1500 "$S/chapter-leverage.png"    "$base#leverage"
  shot 2 390,844   "$S/mobile-home.png"         "$base#home"
  shot 2 390,844   "$S/mobile-chapter-dark.png" "$base#build" --force-dark-mode
else
  echo "跳过截图：本地预览未运行（python3 -m http.server $PORT --directory dist）"
fi
echo "完成。改了 og.png 记得重新运行 python3 scripts/build.py。"
