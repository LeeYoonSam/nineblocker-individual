# 농구 출석 체크 웹 - 개발 플랜 v3 (최종)

# 작업 개요

기존 구글 시트 구조(연도별 시트 / 선수×날짜 매트릭스 / 점수 직접 기입)를 그대로 유지하면서
웹 인터페이스를 추가한다. 새 시트 생성 없이 기존 데이터를 읽고, 관리자가 점수를 입력하면
해당 셀에 직접 write한다.

- 기존 구글 시트 구조 변경 없음
- 연도별 시트 탭 자동 인식
- 관리자: 날짜 컬럼 선택 → 선수별 점수 입력 → 셀에 직접 저장
- 일반 사용자: 시트 데이터 읽기 전용 조회

---

# 기존 시트 구조

```
[스프레드시트]
├── 2024 (탭)
│   행1(헤더): 이름 | 3/6 | 3/13 | 3/20 | 4/3 | ...
│   행2: 홍길동    |  3  |  3   |      |  3  | ...
│   행3: 김철수    |     |  3   |  3   |  3  | ...
│
└── 2025 (탭)
    행1(헤더): 이름 | 3/5 | 3/12 | 3/19 | 4/2 | ...
    행2: 홍길동    |  3  |      |  3   |  3  | ...
    행3: 김철수    |  3  |  3   |      |  3  | ...
```

**핵심 특징**
- 1행 = 헤더 (A1=이름, B1~=날짜)
- A열 = 선수 이름
- 셀 값: 숫자(점수) = 출석, 빈칸 = 결석
- 연도별로 시트 탭이 분리됨

---

# 아키텍처

## 데이터 흐름

```
[읽기 - 누구나]
브라우저 → Google Sheets API v4 (공개 읽기)
→ 시트 헤더(날짜 목록) + 전체 데이터 파싱
→ 선수별 합산 점수 / 매트릭스 렌더링

[쓰기 - 관리자]
브라우저(비밀번호 해시 인증)
→ Apps Script Web App (POST)
→ 특정 셀(선수 row × 날짜 col) setValue(점수)
→ 새 날짜 컬럼 추가도 Apps Script가 처리
```

## 보안 구조

```
소스코드(.js)        →  placeholder만 존재 (__SHEET_ID__ 등)
GitHub Secrets       →  실제값 저장
GitHub Actions       →  빌드 시 sed로 치환 후 dist/ 생성
GitHub Pages         →  dist/ 서빙
```

---

# 기술 스택

| 레이어 | 선택 | 이유 |
|--------|------|------|
| 호스팅 | GitHub Pages | 무료, 공개 레포 |
| 프론트엔드 | Vanilla JS (번들러 없음) | 빌드 복잡도 최소화 |
| 데이터 읽기 | Google Sheets API v4 REST | 공개 시트 Key-only 읽기 |
| 데이터 쓰기 | Google Apps Script Web App | 서버리스, 셀 직접 write |
| 인증 | SHA-256 비밀번호 해시 | 심플, 서버 불필요 |
| CI/CD | GitHub Actions | Secrets 주입 + 자동 배포 |

---

# 프로젝트 구조

```
basketball-attendance/
├── .github/
│   └── workflows/
│       └── deploy.yml          # Secrets 주입 + gh-pages 배포
├── src/
│   ├── index.html              # 조회 페이지 (누구나)
│   ├── admin.html              # 관리자 입력 페이지
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── config.js           # placeholder 상수 (빌드 시 치환)
│       ├── sheets.js           # Sheets API 읽기 + 구조 파싱
│       ├── appsscript.js       # Apps Script 쓰기 (셀 직접 입력)
│       ├── auth.js             # SHA-256 해시 인증 + sessionStorage
│       └── app.js              # 페이지별 진입점
├── scripts/
│   └── inject-env.sh           # placeholder → 실제값 sed 치환
├── apps-script/
│   └── Code.gs                 # Apps Script 참고용 (직접 붙여넣기용)
└── README.md
```

---

# 구현 사항

## 1. Apps Script (Code.gs)

기존 시트의 매트릭스 구조에 맞게 셀 좌표를 계산해서 직접 write.

```javascript
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // Apps Script 내부에서만 사용
const ADMIN_PASSWORD_HASH = 'SHA256_HASH_HERE';

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);

    // 인증
    if (params.passwordHash !== ADMIN_PASSWORD_HASH) {
      return jsonResponse({ success: false, error: 'Unauthorized' });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetName = params.sheetName; // 예: "2026"
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return jsonResponse({ success: false, error: 'Sheet not found' });

    const data = sheet.getDataRange().getValues();
    const headers = data[0]; // 1행: ["이름", "3/5", "3/12", ...]

    // 날짜 컬럼 인덱스 찾기 (없으면 새 컬럼 추가)
    let colIndex = headers.indexOf(params.date);
    if (colIndex === -1) {
      colIndex = headers.length;
      sheet.getRange(1, colIndex + 1).setValue(params.date);
    }

    // 선수별 점수 입력
    const results = [];
    params.entries.forEach(({ playerName, score }) => {
      // 선수 행 찾기
      const rowIndex = data.findIndex((row, i) => i > 0 && row[0] === playerName);
      if (rowIndex === -1) return;

      const cell = sheet.getRange(rowIndex + 1, colIndex + 1);
      if (score !== null && score !== '') {
        cell.setValue(Number(score));
      } else {
        cell.clearContent(); // 빈값 = 결석 처리
      }
      results.push({ playerName, status: 'ok' });
    });

    return jsonResponse({ success: true, updated: results.length });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 2. config.js (placeholder)

```javascript
// src/js/config.js
// ⚠️ 이 파일의 __PLACEHOLDER__ 값은 GitHub Actions 빌드 시 자동 치환됨
// 로컬 개발 시 .env.local을 참고하여 직접 수정 (git에 커밋 금지)

const CONFIG = {
  SHEET_ID: '__SHEET_ID__',
  API_KEY: '__API_KEY__',              // 읽기 전용 제한 Key
  APPS_SCRIPT_URL: '__APPS_SCRIPT_URL__',
  ADMIN_HASH: '__ADMIN_HASH__',        // SHA-256(비밀번호)
  DEFAULT_SCORE: 3,                    // 출석 기본 점수
};
```

## 3. sheets.js (읽기 + 파싱)

기존 매트릭스 구조를 JavaScript 객체로 변환.

```javascript
// src/js/sheets.js

// 특정 연도 시트 전체 데이터 읽기
async function fetchSheetData(sheetName) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}`
    + `/values/${encodeURIComponent(sheetName)}`
    + `?key=${CONFIG.API_KEY}`;

  const res = await fetch(url);
  const json = await res.json();
  return json.values || [];  // 2D 배열 반환
}

// 2D 배열 → 구조화된 객체로 변환
function parseSheetData(rawValues) {
  if (!rawValues || rawValues.length < 2) return { dates: [], players: [] };

  const [headerRow, ...dataRows] = rawValues;
  const dates = headerRow.slice(1);  // A1 제외, 날짜 목록

  const players = dataRows
    .filter(row => row[0])  // 이름 없는 행 제외
    .map(row => ({
      name: row[0],
      scores: dates.map((_, i) => {
        const val = row[i + 1];
        return val !== undefined && val !== '' ? Number(val) : null;
      }),
      totalScore: row.slice(1).reduce((sum, v) => sum + (Number(v) || 0), 0),
      attendCount: row.slice(1).filter(v => v !== undefined && v !== '').length,
    }));

  return { dates, players };
}

// 스프레드시트의 모든 시트 탭 목록 가져오기
async function fetchSheetNames() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}`
    + `?key=${CONFIG.API_KEY}&fields=sheets.properties.title`;

  const res = await fetch(url);
  const json = await res.json();
  return json.sheets.map(s => s.properties.title);
}
```

## 4. auth.js

```javascript
// src/js/auth.js
async function sha256(str) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyAdmin(password) {
  const hash = await sha256(password);
  return hash === CONFIG.ADMIN_HASH;
}

const AdminSession = {
  set: () => sessionStorage.setItem('admin', '1'),
  clear: () => sessionStorage.removeItem('admin'),
  check: () => sessionStorage.getItem('admin') === '1',
};
```

## 5. 관리자 UI 흐름 (admin.html)

```
1. 페이지 로드 → 비밀번호 모달 표시
2. 비밀번호 입력 → SHA-256 해시 비교
3. 인증 성공 → 모달 닫힘, 입력 폼 활성화
4. 연도 탭 선택 → 해당 시트 선수 목록 로드
5. 날짜 입력 (기존 날짜 선택 or 새 날짜 추가)
6. 선수별 점수 입력 (기본값 3, 빈칸=결석)
7. 저장 → Apps Script POST → 해당 셀 직접 write
```

## 6. 조회 UI 구조 (index.html)

```
[헤더] 🏀 B팀 출석 현황   [연도 탭: 2024 | 2025 | 2026]

[요약 카드]
  홍길동  총점 42점  출석 14회
  김철수  총점 39점  출석 13회
  ...

[전체 매트릭스 테이블]
         | 3/5 | 3/12 | 3/19 | ... | 합계
홍길동   |  3  |  3   |  -   | ... |  42
김철수   |  -  |  3   |  3   | ... |  39
```

---

# inject-env.sh

```bash
#!/bin/bash
set -e

mkdir -p dist
cp -r src/* dist/

# placeholder 치환
sed -i "s|__SHEET_ID__|${SHEET_ID}|g"           dist/js/config.js
sed -i "s|__API_KEY__|${API_KEY}|g"             dist/js/config.js
sed -i "s|__APPS_SCRIPT_URL__|${APPS_SCRIPT_URL}|g" dist/js/config.js
sed -i "s|__ADMIN_HASH__|${ADMIN_HASH}|g"       dist/js/config.js

echo "✅ Secrets injected into dist/"
```

# GitHub Actions (deploy.yml)

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Inject secrets
        env:
          SHEET_ID: ${{ secrets.SHEET_ID }}
          API_KEY: ${{ secrets.API_KEY }}
          APPS_SCRIPT_URL: ${{ secrets.APPS_SCRIPT_URL }}
          ADMIN_HASH: ${{ secrets.ADMIN_HASH }}
        run: bash scripts/inject-env.sh

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

# GitHub Secrets 등록 목록

| Secret | 값 얻는 방법 |
|--------|------------|
| `SHEET_ID` | 시트 URL `/d/` 와 `/edit` 사이의 문자열 |
| `API_KEY` | Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → 키 생성 후 Sheets API + HTTP 리퍼러 제한 |
| `APPS_SCRIPT_URL` | Apps Script 편집기 → 배포 → 웹 앱 배포 후 생성되는 URL |
| `ADMIN_HASH` | 터미널에서 `echo -n "비밀번호" \| sha256sum` 실행 결과 |

---

# 수동 작업 순서 (코드 개발 전)

```
Step 1. 구글 시트 공개 읽기 설정
        → 공유 → 링크가 있는 모든 사용자 → 뷰어

Step 2. Google Cloud Console
        → 새 프로젝트 → Sheets API 활성화
        → API 키 생성 → 제한: HTTP 리퍼러(본인 GitHub Pages 도메인) + API: Sheets API

Step 3. Apps Script 작성
        → 구글 시트 → 확장 → Apps Script
        → Code.gs 붙여넣기 (SPREADSHEET_ID, ADMIN_PASSWORD_HASH 설정)
        → 배포 → 웹 앱 → 실행: 나, 액세스: 모든 사용자 → URL 복사

Step 4. ADMIN_HASH 생성
        → 터미널: echo -n "your_password" | sha256sum

Step 5. GitHub 레포 생성 → Settings → Secrets → 4개 등록
```

---

# oh-my-claudecode 프롬프트 플랜

## Phase 1: 스캐폴딩
```
autopilot: 농구 출석 관리 웹 프로젝트를 생성해줘.
GitHub Pages 배포용이고 번들러 없는 순수 Vanilla JS야.
구조: src/{index.html, admin.html, css/style.css, js/{config.js, sheets.js, appsscript.js, auth.js, app.js}}
scripts/inject-env.sh, .github/workflows/deploy.yml, apps-script/Code.gs, README.md 포함.
config.js에는 __SHEET_ID__, __API_KEY__, __APPS_SCRIPT_URL__, __ADMIN_HASH__ placeholder 사용.
```

## Phase 2: 핵심 모듈 병렬
```
ulw: 다음 4개를 동시에 구현해줘
1. sheets.js: Sheets API v4로 시트 탭 목록 조회, 선택 탭 전체 데이터 fetch,
   1행=날짜헤더 / A열=선수이름 / 셀값=점수(빈칸=결석) 구조 파싱
2. auth.js: Web Crypto SHA-256 해시, CONFIG.ADMIN_HASH 비교, sessionStorage 세션
3. appsscript.js: Apps Script URL로 POST
   body: {passwordHash, sheetName, date, entries:[{playerName, score}]}
4. Code.gs: 위 body 받아서 해당 셀에 setValue, 날짜 컬럼 없으면 신규 추가
```

## Phase 3: UI
```
autopilot: index.html과 admin.html을 구현해줘.

index.html:
- 상단 연도 탭 (시트 탭 목록 동적 생성)
- 선수별 합산 점수 + 출석 횟수 요약 카드
- 전체 매트릭스 테이블 (선수×날짜, 빈칸은 - 표시)
- 농구 테마, 모바일 반응형

admin.html:
- 페이지 진입 시 비밀번호 모달 (sessionStorage로 세션 유지)
- 연도/시트 선택 드롭다운
- 날짜 입력 (text, 예: 3/5) + 기존 날짜 선택 가능
- 선수 목록 + 점수 input (기본값 3, 비워두면 결석)
- 저장 버튼 → Apps Script POST
```

## Phase 4: 검증
```
ralph: 다음 케이스를 검증하고 모두 통과할 때까지 수정해줘.
1. 새 날짜 입력 시 시트에 컬럼 추가 확인
2. 기존 날짜 재입력 시 기존 셀 덮어쓰기 확인
3. 점수 비워두면 clearContent (결석 처리) 확인
4. 잘못된 비밀번호 → 저장 불가 확인
5. config.js에 __PLACEHOLDER__ 남아있는지 체크
6. inject-env.sh 실행 후 dist/js/config.js 값 치환 확인
```

---

# 작업 항목

| 항목 | 상세 | 우선순위 | 공수 |
|------|------|---------|------|
| 수동: 구글 시트 공개 설정 | 뷰어 공개 + API Key 발급 | P0 | 20분 |
| 수동: Apps Script 배포 | Code.gs 작성 + 웹 앱 배포 | P0 | 30분 |
| 수동: GitHub Secrets 등록 | 4개 Secret 값 등록 | P0 | 10분 |
| 스캐폴딩 | 프로젝트 구조 + 빌드 스크립트 | P0 | 30분 |
| 핵심 모듈 4개 | sheets.js / auth.js / appsscript.js / Code.gs | P0 | 2h |
| 조회 UI | 연도 탭 + 매트릭스 테이블 + 점수 카드 | P0 | 2h |
| 관리자 UI | 인증 모달 + 점수 입력 폼 | P0 | 1.5h |
| CI/CD 설정 | deploy.yml + inject-env.sh | P0 | 30분 |
| 검증 + 버그 수정 | 엣지 케이스 전체 | P1 | 1h |
| 반응형 CSS | 모바일 최적화 | P1 | 1h |

**총 예상 공수**: 수동 1시간 + 코드 8~9시간

---

# 기술 검토 사항

**필수 확인**
- 구글 시트 날짜 헤더 형식 통일: `3/5` vs `03/05` vs `2026-03-05` → 하나로 통일 필요
- Apps Script 배포 시 "모든 사용자" 설정 확인 (익명 접근 허용)
- API Key HTTP 리퍼러 제한에 `https://{username}.github.io/*` 추가
- 로컬 개발 시 `src/js/config.js`에 실제값 직접 입력 (git에 커밋 금지 → .gitignore)

**보안 평가**
| 시나리오 | 대응 |
|---------|------|
| 소스에서 API Key 추출 | 읽기 전용 + 도메인 제한, 쓰기 불가 |
| 소스에서 Admin Hash 추출 | 강한 비밀번호면 Rainbow table 공격 어려움 |
| Apps Script URL 직접 POST | Hash 없으면 Unauthorized |
| 구글 시트 직접 접근 | 공개 설정이므로 읽기 허용 (의도적) |

**날짜 컬럼 신규 추가 시 주의**
- 기존 날짜 순서와 맞게 삽입 vs 맨 끝에 추가 선택 필요
- 맨 끝 추가가 구현 단순, 날짜 정렬은 프론트에서 처리 권장

---

# 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|---------|
| 2026-03-05 | 1.0 | 초안 |
| 2026-03-05 | 2.0 | GitHub Pages + Apps Script 아키텍처 |
| 2026-03-05 | 3.0 | 기존 시트 구조(선수×날짜 매트릭스) 반영, 점수 직접 입력 방식으로 전면 재설계 |
