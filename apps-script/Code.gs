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

// =====================
// GET: 리그 레지스트리 반환
// =====================

function doGet(e) {
  try {
    const registry = getLeagueRegistry();
    return jsonResponse(registry);
  } catch (err) {
    return jsonResponse({ leagues: [], error: err.message });
  }
}

// =====================
// POST: 액션 라우팅
// =====================

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action || 'submitScores';

    // 인증 필요 액션
    const adminHash = getAdminHash();
    if (!adminHash || params.passwordHash !== adminHash) {
      return jsonResponse({ success: false, error: 'Unauthorized' });
    }

    switch (action) {
      case 'submitScores':
        return handleSubmitScores(params);
      case 'submitLeagueScores':
        return handleSubmitLeagueScores(params);
      case 'addLeague':
        return handleAddLeague(params);
      case 'updateLeague':
        return handleUpdateLeague(params);
      case 'deleteLeague':
        return handleDeleteLeague(params);
      default:
        return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// =====================
// 기존 개인승점 점수 저장
// =====================

function handleSubmitScores(params) {
  params.sheetId = SPREADSHEET_ID;
  return handleSubmitLeagueScores(params);
}

// =====================
// 리그별 점수 저장 (sheetId 기반)
// =====================

function handleSubmitLeagueScores(params) {
  if (!params.sheetId) {
    return jsonResponse({ success: false, error: 'sheetId is required' });
  }

  const ss = SpreadsheetApp.openById(params.sheetId);
  const sheet = ss.getSheetByName(params.sheetName);
  if (!sheet) return jsonResponse({ success: false, error: 'Sheet not found' });

  return writeScores(sheet, params);
}

// =====================
// 점수 기록 공통 로직
// =====================

function writeScores(sheet, params) {
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
    const headerStr = (h instanceof Date) ? formatDate(h) : String(h);
    if (headerStr === params.date) {
      colIndex = i;
      break;
    }
  }

  // 새 날짜 컬럼 추가 (마지막 데이터 열 뒤에)
  if (colIndex === -1) {
    let lastCol = DATE_COL_START;
    for (let i = DATE_COL_START; i < headers.length; i++) {
      if (headers[i] !== null && headers[i] !== undefined && headers[i] !== '') {
        lastCol = i;
      }
    }
    colIndex = lastCol + 1;
    sheet.getRange(headerRowIdx + 1, colIndex + 1).setValue(params.date);
  }

  // name→row 인덱스 맵 구축 (O(1) 룩업)
  const nameToRow = new Map();
  for (let i = headerRowIdx + 1; i < data.length; i++) {
    if (data[i][0]) nameToRow.set(data[i][0], i);
  }

  // 선수별 점수를 배열에 모아서 배치 기록
  if (!Array.isArray(params.entries) || params.entries.length === 0) {
    return jsonResponse({ success: false, error: 'entries array is required' });
  }

  const results = [];
  const batchValues = [];
  const batchRows = [];

  params.entries.forEach(({ playerName, score }) => {
    const rowIndex = nameToRow.get(playerName);
    if (rowIndex === undefined) return;

    batchRows.push(rowIndex);
    batchValues.push(score !== null && score !== '' ? Number(score) : '');
    results.push({ playerName, status: 'ok' });
  });

  // 배치 기록: 연속 행이면 setValues, 아니면 개별 setValue
  if (batchValues.length > 0) {
    batchRows.forEach((rowIndex, i) => {
      const cell = sheet.getRange(rowIndex + 1, colIndex + 1);
      if (batchValues[i] === '') {
        cell.clearContent();
      } else {
        cell.setValue(batchValues[i]);
      }
    });
  }

  return jsonResponse({ success: true, updated: results.length });
}

// =====================
// 리그 CRUD
// =====================

function getLeagueRegistry() {
  const json = PropertiesService.getScriptProperties().getProperty('LEAGUE_REGISTRY');
  return json ? JSON.parse(json) : { leagues: [] };
}

function saveLeagueRegistry(registry) {
  PropertiesService.getScriptProperties().setProperty('LEAGUE_REGISTRY', JSON.stringify(registry));
}

function handleAddLeague(params) {
  if (!params.league || !params.league.id) {
    return jsonResponse({ success: false, error: 'league.id is required' });
  }
  const registry = getLeagueRegistry();
  registry.leagues.push(params.league);
  saveLeagueRegistry(registry);
  return jsonResponse({ success: true });
}

function handleUpdateLeague(params) {
  const registry = getLeagueRegistry();
  const idx = registry.leagues.findIndex(l => l.id === params.league.id);
  if (idx === -1) return jsonResponse({ success: false, error: 'League not found' });
  registry.leagues[idx] = params.league;
  saveLeagueRegistry(registry);
  return jsonResponse({ success: true });
}

function handleDeleteLeague(params) {
  const registry = getLeagueRegistry();
  const idx = registry.leagues.findIndex(l => l.id === params.leagueId);
  if (idx === -1) return jsonResponse({ success: false, error: 'League not found' });
  registry.leagues.splice(idx, 1);
  saveLeagueRegistry(registry);
  return jsonResponse({ success: true });
}

// =====================
// 유틸리티
// =====================

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
