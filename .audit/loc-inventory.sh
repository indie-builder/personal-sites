#!/usr/bin/env bash
# LOC inventory for the simplification campaign scope.
# Usage: .audit/loc-inventory.sh [--baseline]  (writes .audit/loc-baseline.txt with --baseline)
set -euo pipefail
cd "$(dirname "$0")/.."
count() { find "$@" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mjs' -o -name '*.mts' \) -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/dist/*' -not -path '*/.turbo/*' -not -path '*/build/*' -exec cat {} + 2>/dev/null | wc -l | tr -d ' '; }
web_src=$(count apps/web/app apps/web/components apps/web/lib)
web_test=$(count apps/web/tests apps/web/e2e)
tools_src=$(count tools/content/lib tools/content/scripts)
tools_test=$(count tools/content/tests)
pkg=$(count packages/effect/src packages/effect/tests packages/public-data/src packages/public-data/tests)
total=$((web_src + web_test + tools_src + tools_test + pkg))
{
  echo "web_src=$web_src web_test=$web_test tools_src=$tools_src tools_test=$tools_test packages=$pkg total=$total"
  echo "target_total_for_30pct=$((total * 70 / 100))"
}
if [ "${1:-}" = "--baseline" ]; then cp /dev/stdin .audit/loc-baseline.txt < <({ echo "web_src=$web_src web_test=$web_test tools_src=$tools_src tools_test=$tools_test packages=$pkg total=$total"; echo "target_total_for_30pct=$((total * 70 / 100))"; }); fi
