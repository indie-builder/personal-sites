#!/bin/bash
# check-greeting-layout.mjs 的 CI 入口：在已启动的模拟器上把应用带到
# 「关于我」页顶部，再执行布局检查。要求 adb 在 PATH（emulator-runner 会话）。
set -euo pipefail
cd "$(dirname "$0")/.."
ADB_BIN="${ADB:-$(command -v adb)}"
APP="cn.lovemyrmb.personalsite"

"$ADB_BIN" shell am force-stop "$APP" || true
"$ADB_BIN" shell am start -W -n "$APP/.MainActivity" >/dev/null
# 开场动画约 5.8 秒；系统动画被禁用时开场自行结束，多余等待无害。
sleep 10
# 开场任意点击即跳过。
"$ADB_BIN" shell input tap 160 320
sleep 2

# uiautomator 偶发拿不到 idle 状态，重试一次。
xml="$("$ADB_BIN" exec-out uiautomator dump /dev/tty || "$ADB_BIN" exec-out uiautomator dump /dev/tty)"
about="$(echo "$xml" | tr '>' '\n' | grep 'text="关于我"' | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | head -1)"
if [ -z "$about" ]; then
  echo "关于我 tab not found on home screen" >&2
  exit 1
fi
l="$(echo "$about" | sed -E 's/.*\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\].*/\1/')"
t="$(echo "$about" | sed -E 's/.*\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\].*/\2/')"
r="$(echo "$about" | sed -E 's/.*\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\].*/\3/')"
b="$(echo "$about" | sed -E 's/.*\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\].*/\4/')"
"$ADB_BIN" shell input tap "$(( (l + r) / 2 ))" "$(( (t + b) / 2 ))"
sleep 1
export ADB="$ADB_BIN"
node scripts/check-greeting-layout.mjs
