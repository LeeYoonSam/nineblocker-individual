# 사전 작업 가이드 (코드 개발 전 수동 진행)

## 개요
농구 출석 체크 웹 프로젝트를 시작하기 전에 아래 5단계를 순서대로 완료해야 합니다.
각 단계에서 얻는 값들은 마지막 GitHub Secrets 등록에 사용됩니다.

---

## Step 1. 구글 시트 공개 읽기 설정

1. 대상 구글 시트 열기
2. 우측 상단 **공유** 버튼 클릭
3. "일반 액세스" → **링크가 있는 모든 사용자** 선택
4. 역할: **뷰어** (읽기 전용)
5. 시트 URL에서 `SHEET_ID` 기록:
   ```
   https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit
                                          ^^^^^^^^^^^
   ```

**기록할 값**: `SHEET_ID`

---

## Step 2. Google Cloud Console - API 키 발급

1. https://console.cloud.google.com 접속
2. 상단 프로젝트 선택 → **새 프로젝트** 생성 (예: `basketball-attendance`)
3. 좌측 메뉴 → **API 및 서비스** → **라이브러리**
4. "Google Sheets API" 검색 → **사용** 클릭
5. 좌측 메뉴 → **사용자 인증 정보** → **+ 사용자 인증 정보 만들기** → **API 키**
6. 생성된 API 키 → **키 제한** 클릭:
   - **애플리케이션 제한사항**: HTTP 리퍼러
     - 추가: `https://{username}.github.io/*`
     - 로컬 테스트용: `http://localhost:*` (나중에 제거)
   - **API 제한사항**: **키 제한** → Google Sheets API만 선택
7. **저장**

**기록할 값**: `API_KEY`

---

## Step 3. Apps Script 배포

1. 대상 구글 시트 → **확장 프로그램** → **Apps Script**
2. 기본 `Code.gs` 파일의 내용을 모두 삭제
3. 아래 코드를 붙여넣기 (또는 `apps-script/Code.gs` 파일 내용 복사):

```javascript
const SPREADSHEET_ID = 'Step1에서_기록한_SHEET_ID';
const ADMIN_PASSWORD_HASH = 'Step4에서_생성할_해시값';

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);

    if (params.passwordHash !== ADMIN_PASSWORD_HASH) {
      return jsonResponse({ success: false, error: 'Unauthorized' });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(params.sheetName);
    if (!sheet) return jsonResponse({ success: false, error: 'Sheet not found' });

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    let colIndex = headers.indexOf(params.date);
    if (colIndex === -1) {
      colIndex = headers.length;
      sheet.getRange(1, colIndex + 1).setValue(params.date);
    }

    const results = [];
    params.entries.forEach(({ playerName, score }) => {
      const rowIndex = data.findIndex((row, i) => i > 0 && row[0] === playerName);
      if (rowIndex === -1) return;

      const cell = sheet.getRange(rowIndex + 1, colIndex + 1);
      if (score !== null && score !== '') {
        cell.setValue(Number(score));
      } else {
        cell.clearContent();
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

4. 상단 **배포** → **새 배포**
5. 유형: **웹 앱**
6. 설정:
   - 설명: `basketball-attendance`
   - 실행 계정: **나** (본인 계정)
   - 액세스 권한: **모든 사용자**
7. **배포** 클릭 → 생성된 URL 복사

**기록할 값**: `APPS_SCRIPT_URL`

> 주의: Apps Script를 수정할 때마다 **새 배포 버전**을 만들어야 변경사항이 반영됩니다.

---

## Step 4. 관리자 비밀번호 해시 생성

macOS/Linux 터미널에서 실행:
```bash
echo -n "원하는비밀번호" | shasum -a 256
```

예시:
```bash
echo -n "mypassword123" | shasum -a 256
# 출력: ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f  -
```

- 출력에서 해시값만 복사 (공백과 `-` 제외)
- **이 값을 Step 3의 Apps Script `ADMIN_PASSWORD_HASH`에도 설정**

**기록할 값**: `ADMIN_HASH`

---

## Step 5. GitHub Secrets 등록

1. GitHub 레포지토리 → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 으로 4개 등록:

| Secret 이름 | 값 | 출처 |
|---|---|---|
| `SHEET_ID` | 구글 시트 ID | Step 1 |
| `API_KEY` | Google Cloud API 키 | Step 2 |
| `APPS_SCRIPT_URL` | Apps Script 배포 URL | Step 3 |
| `ADMIN_HASH` | SHA-256 해시값 | Step 4 |

3. **Settings** → **Pages** → Source: **GitHub Actions** 선택

---

## 확인 사항

### 날짜 형식 확인 (중요)
현재 시트에서 캘린더로 날짜를 입력하고 있으므로, 날짜가 **날짜 타입**으로 저장됩니다.
- 시트의 날짜 셀 선택 → 메뉴 **서식** → **숫자** → 현재 적용된 형식 확인
- 코드에서 Sheets API 읽기 시 `FORMATTED_VALUE` 기준으로 파싱 처리 예정

### 체크리스트
- [ ] 구글 시트가 "링크가 있는 모든 사용자 - 뷰어"로 공유됨
- [ ] Google Sheets API가 활성화됨
- [ ] API 키에 리퍼러 제한 + API 제한 설정됨
- [ ] Apps Script가 "모든 사용자" 접근으로 배포됨
- [ ] Apps Script 내 SPREADSHEET_ID, ADMIN_PASSWORD_HASH 설정됨
- [ ] GitHub Secrets 4개 등록 완료
- [ ] GitHub Pages 활성화 (Source: GitHub Actions)
