#!/bin/bash
# check-greeting-layout.mjs 的 CI 入口：在已启动的模拟器上把应用带到
# 「关于我」页顶部，再执行布局检查。要求 adb 在 PATH（emulator-runner 会话）。
set -euo pipefail
cd "$(dirname "$0")/.."
# CI 由 emulator-runner 把 adb 放进 PATH（不设 ADB）；本地可显式传 ADB。
ADB_BIN="${ADB:-}"
if [ -z "$ADB_BIN" ]; then
  ADB_BIN="$(command -v adb || true)"
fi
if [ -z "$ADB_BIN" ]; then
  echo "adb not found：CI 应由 emulator-runner 提供 PATH；本地请显式传 ADB=..." >&2
  exit 1
fi
# 单设备假设：mjs 半程（check-greeting-layout.mjs）读同一 ANDROID_SERIAL。
export ANDROID_SERIAL="${ANDROID_SERIAL:-emulator-5554}"
APP="cn.lovemyrmb.personalsite"

"$ADB_BIN" shell am force-stop "$APP" || true
# connectedDebugAndroidTest 结束后 AGP 会卸载应用，先重装再启动。
"$ADB_BIN" install -r app/build/outputs/apk/debug/app-debug.apk >/dev/null || {
  echo "app install failed" >&2
  exit 1
}
"$ADB_BIN" shell am start -W -n "$APP/.MainActivity" >/dev/null || {
  echo "app start failed" >&2
  exit 1
}
# 开场动画约 5.8 秒；系统动画被禁用时开场自行结束，多余等待无害。
sleep 10
# 开场任意点击即跳过。
"$ADB_BIN" shell input tap 160 320
sleep 2

# uiautomator 偶发拿不到 idle 状态，间隔重试一次。
xml="$("$ADB_BIN" exec-out uiautomator dump /dev/tty || true)"
if [ -z "$xml" ]; then
  sleep 2
  xml="$("$ADB_BIN" exec-out uiautomator dump /dev/tty || true)"
fi
# 管道以 || true 收口：pipefail 下「找不到关于我」不应静默退出，须走友好报错。
about="$(echo "$xml" | tr '>' '\n' | grep 'text="关于我"' | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | head -1 || true)"
if [ -z "$about" ]; then
  echo "关于我 tab not found on home screen" >&2
  echo "$xml" | head -c 500 >&2
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
