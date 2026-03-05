#!/bin/bash
set -e

mkdir -p dist
cp -r src/* dist/

sed -i'' -e "s|__SHEET_ID__|${SHEET_ID}|g"           dist/js/config.js
sed -i'' -e "s|__API_KEY__|${API_KEY}|g"             dist/js/config.js
sed -i'' -e "s|__APPS_SCRIPT_URL__|${APPS_SCRIPT_URL}|g" dist/js/config.js
sed -i'' -e "s|__ADMIN_HASH__|${ADMIN_HASH}|g"       dist/js/config.js

echo "Secrets injected into dist/"
