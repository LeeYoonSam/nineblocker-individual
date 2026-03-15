#!/bin/bash
set -e

mkdir -p dist
cp -r src/* dist/

inject_secrets() {
  local target="$1"
  sed -i'' -e "s|__SHEET_ID__|${SHEET_ID}|g" \
           -e "s|__API_KEY__|${API_KEY}|g" \
           -e "s|__APPS_SCRIPT_URL__|${APPS_SCRIPT_URL}|g" \
           -e "s|__ADMIN_HASH__|${ADMIN_HASH}|g" \
           "$target"
}

# 기존 config.js 시크릿 주입
inject_secrets dist/js/config.js

# v2 config.js 시크릿 주입
if [ -f dist/v2/js/config.js ]; then
  inject_secrets dist/v2/js/config.js
  sed -i'' -e "s|__GEMINI_API_KEY__|${GEMINI_API_KEY}|g" dist/v2/js/config.js
fi

echo "Secrets injected into dist/"
