# NineBlockers

농구 동호회 출석 및 점수 관리 시스템. 공개 조회 페이지와 관리자 페이지로 구성되어 있다.

## 주요 기능

- **랭킹 조회** — 출석/점수 기반 멤버 랭킹
- **점수 매트릭스** — 멤버 간 1:1 점수 매트릭스 테이블
- **시트 선택** — 날짜별 시트(탭) 전환
- **관리자 점수 입력** — 비밀번호 인증 후 점수 입력/수정

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Vanilla JS, HTML5, CSS3 |
| Backend (읽기) | Google Sheets API |
| Backend (쓰기) | Google Apps Script |
| Deployment | GitHub Pages + GitHub Actions |
| Testing | Vitest + jsdom |

## 프로젝트 구조

```
nineblocker-individual/
├── src/
│   ├── index.html          # 공개 조회 페이지
│   ├── admin.html          # 관리자 페이지
│   ├── css/style.css
│   └── js/
│       ├── config.js       # 설정 (API 키, 시트 ID 등)
│       ├── app.js          # 메인 앱 로직
│       ├── sheets.js       # Google Sheets 데이터 파싱
│       ├── auth.js         # 관리자 인증
│       └── appsscript.js   # Apps Script 연동
├── apps-script/
│   └── Code.gs             # Google Apps Script 서버 코드
├── tests/
│   ├── app.test.js         # app.js 테스트
│   └── sheets.test.js      # sheets.js 테스트
├── scripts/
│   └── inject-env.sh       # 빌드 시 환경변수 주입
├── docs/
│   └── prerequisite-guide.md  # 초기 설정 가이드
├── .github/workflows/
│   └── deploy.yml          # CI/CD 파이프라인
├── package.json
└── vitest.config.js
```

## 시작하기

### 사전 준비

Google Sheets API 키, Apps Script 배포 등 초기 설정은 [사전 준비 가이드](docs/prerequisite-guide.md)를 참조한다.

### 설치 & 테스트

```bash
npm install
npm test
```

### 로컬 개발 (데모 모드)

`src/js/config.js`의 플레이스홀더(`__SHEET_ID__` 등)가 치환되지 않으면 자동으로 **데모 모드**로 동작한다. 별도의 API 키 없이 샘플 데이터로 UI를 확인할 수 있다.

`src/index.html`을 브라우저에서 직접 열거나 로컬 서버를 사용한다:

```bash
npx serve src
```

### 배포

`main` 브랜치에 push하면 GitHub Actions가 자동으로 배포한다:

1. `scripts/inject-env.sh`가 GitHub Secrets 값을 `config.js`에 주입
2. `dist/` 디렉터리 생성
3. GitHub Pages에 배포

필요한 GitHub Secrets:
- `SHEET_ID` — Google Sheets 문서 ID
- `API_KEY` — Google Sheets API 키
- `APPS_SCRIPT_URL` — Apps Script 웹앱 URL
- `ADMIN_HASH` — 관리자 비밀번호 SHA-256 해시

## 관리자 비밀번호 변경

비밀번호는 SHA-256 해시로 관리되며, **두 곳**을 반드시 동일하게 업데이트해야 한다.

### Step 1: 새 해시 생성

```bash
echo -n "새비밀번호" | shasum -a 256
```

출력된 해시값(공백 앞부분)을 복사한다.

### Step 2: GitHub Secrets 업데이트

GitHub 저장소 → Settings → Secrets and variables → Actions → `ADMIN_HASH` 값을 새 해시로 수정한다.

### Step 3: GitHub Actions 재배포

`main` 브랜치에 push하거나, Actions 탭에서 수동으로 워크플로우를 실행한다.

### Step 4: Apps Script 속성 업데이트

1. Apps Script 에디터에서 `Code.gs`의 `setupAdminHash()` 함수 내 해시값을 새 해시로 수정한다.
2. `setupAdminHash()` 함수를 실행하여 스크립트 속성에 반영한다.

> **주의:** GitHub Secrets와 Apps Script 속성의 해시값이 다르면 관리자 인증이 실패한다. 두 곳을 반드시 동일하게 맞춘다.

## 시트 추가

Google Sheets에 새 시트 탭을 추가하면 앱에 자동으로 반영된다. 기존 시트와 동일한 형식(헤더, 열 구조)을 유지해야 한다.

## 테스트

```bash
npm test
```

테스트 파일:
- `tests/app.test.js` — 앱 로직, 조회/관리자 UI 테스트
- `tests/sheets.test.js` — Google Sheets 데이터 파싱 테스트

## 라이선스

MIT
