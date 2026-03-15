#!/bin/bash
set -e

# .env 파일 로드
if [ ! -f .env ]; then
  echo "❌ .env 파일이 없습니다. 아래 형식으로 생성해주세요:"
  echo ""
  echo "SHEET_ID=실제_스프레드시트_ID"
  echo "API_KEY=실제_Google_API_키"
  echo "APPS_SCRIPT_URL=실제_Apps_Script_URL"
  echo "ADMIN_HASH=실제_관리자_해시"
  echo "GEMINI_API_KEY=실제_Gemini_API_키(선택)"
  exit 1
fi

set -a; source .env; set +a

# 임시 빌드 디렉토리
DEV_DIR="/tmp/nineblocker-dev"
rm -rf "$DEV_DIR"
cp -r src "$DEV_DIR"

# 기존 config.js 시크릿 주입
sed -i'' -e "s|__SHEET_ID__|${SHEET_ID}|g"              "$DEV_DIR/js/config.js"
sed -i'' -e "s|__API_KEY__|${API_KEY}|g"                "$DEV_DIR/js/config.js"
sed -i'' -e "s|__APPS_SCRIPT_URL__|${APPS_SCRIPT_URL}|g" "$DEV_DIR/js/config.js"
sed -i'' -e "s|__ADMIN_HASH__|${ADMIN_HASH}|g"          "$DEV_DIR/js/config.js"

# v2 config.js 시크릿 주입
if [ -f "$DEV_DIR/v2/js/config.js" ]; then
  sed -i'' -e "s|__SHEET_ID__|${SHEET_ID}|g"              "$DEV_DIR/v2/js/config.js"
  sed -i'' -e "s|__API_KEY__|${API_KEY}|g"                "$DEV_DIR/v2/js/config.js"
  sed -i'' -e "s|__APPS_SCRIPT_URL__|${APPS_SCRIPT_URL}|g" "$DEV_DIR/v2/js/config.js"
  sed -i'' -e "s|__ADMIN_HASH__|${ADMIN_HASH}|g"          "$DEV_DIR/v2/js/config.js"
  sed -i'' -e "s|__GEMINI_API_KEY__|${GEMINI_API_KEY:-}|g" "$DEV_DIR/v2/js/config.js"
fi

echo "✅ 시크릿 주입 완료"
echo "🚀 로컬 서버 시작: http://localhost:3000"
echo ""
echo "  기존 사이트:  http://localhost:3000/"
echo "  v2 허브:     http://localhost:3000/v2/"
echo "  v2 개인승점:  http://localhost:3000/v2/individual.html"
echo "  v2 리그:     http://localhost:3000/v2/league.html"
echo "  v2 관리자:   http://localhost:3000/v2/admin.html"
echo ""
npx serve "$DEV_DIR" -l 3000
