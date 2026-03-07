const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';
const DATE_COL_START = 4; // E열 = 0-based index 4

function getAdminHash() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH');
}

// Apps Script 에디터에서 수동 실행하여 해시 설정
function setupAdminHash() {
  const hash = 'YOUR_SHA256_HASH_HERE'; // 여기에 해시값 입력 후 실행
  if (hash === 'YOUR_SHA256_HASH_HERE') {
    throw new Error('hash 변수를 실제 SHA256 해시값으로 변경 후 실행하세요.');
  }
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_HASH', hash);
  Logger.log('Admin hash가 설정되었습니다.');
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);

    const adminHash = getAdminHash();
    if (!adminHash || params.passwordHash !== adminHash) {
      return jsonResponse({ success: false, error: 'Unauthorized' });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(params.sheetName);
    if (!sheet) return jsonResponse({ success: false, error: 'Sheet not found' });

    const data = sheet.getDataRange().getValues();

    // 헤더행 자동 감지 (A열이 "이름"인 행)
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(data.length, 5); i++) {
      if (data[i][0] === '이름') {
        headerRowIdx = i;
        break;
      }
    }
    const headers = data[headerRowIdx];

    // 날짜 컬럼 검색 (E열부터)
    let colIndex = -1;
    for (let i = DATE_COL_START; i < headers.length; i++) {
      const h = headers[i];
      if (h === null || h === undefined || h === '') continue;
      // datetime인 경우 FORMATTED_VALUE와 비교를 위해 문자열 변환
      const headerStr = (h instanceof Date) ? formatDate(h) : String(h);
      if (headerStr === params.date) {
        colIndex = i;
        break;
      }
    }

    // 새 날짜 컬럼 추가 (마지막 데이터 열 뒤에)
    if (colIndex === -1) {
      // 마지막으로 값이 있는 열 찾기
      let lastCol = DATE_COL_START;
      for (let i = DATE_COL_START; i < headers.length; i++) {
        if (headers[i] !== null && headers[i] !== undefined && headers[i] !== '') {
          lastCol = i;
        }
      }
      colIndex = lastCol + 1;
      // 1-based row/col for getRange
      sheet.getRange(headerRowIdx + 1, colIndex + 1).setValue(params.date);
    }

    // 선수별 점수 입력
    const results = [];
    params.entries.forEach(({ playerName, score }) => {
      // 선수 행 찾기 (헤더행 이후)
      const rowIndex = data.findIndex((row, i) => i > headerRowIdx && row[0] === playerName);
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

function formatDate(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return m + '/' + day;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
