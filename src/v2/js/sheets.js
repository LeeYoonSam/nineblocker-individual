// 시트 데이터 fetch + 파싱 (sheetId 파라미터 지원)
const DATE_COL_START = 4; // E열 = index 4

// 데모 모드 테스트 데이터 (기존과 동일)
const DEMO_DATA = {
  '22-08': [
    ['','','','','참석: 2점, 경기 승리당: 1점 (게스트가 더 많으면 3점 일괄)','','','','','','','','','','','','','','','','','',''],
    ['이름','넘버','개인 승점','실시간 순위','8/2','8/9','8/13','8/16','8/20','8/23','8/30','9/6','9/13','9/20','9/27','10/4','10/18','11/1','11/15','11/22','11/29','12/6','12/13'],
    ['남궁현','11',47,1,2,2,'',3,'',3,3,4,3,3,'',3,3,3,3,3,3,3,3],
    ['김동광','30',43,2,'',2,'','','',3,3,2,3,3,3,3,3,3,3,3,3,3,3],
    ['정희원','20',42,3,2,2,'',3,3,'',3,2,3,3,3,3,'',3,3,3,3,'',3],
  ],
  '26-01': [
    ['이름','넘버','개인 승점','실시간 순위','1월 6일','1월 13일'],
    ['김돈규',4,6,1,3,3],
    ['김정호','32',6,1,3,3],
    ['유지형','24',6,1,3,3],
    ['강재훈','93',3,4,3,''],
    ['남궁현','11',0,10,'',''],
  ],
};

function isDemoMode() {
  return CONFIG.DEMO_MODE;
}

async function fetchSheetNames(sheetId) {
  const targetId = sheetId || CONFIG.SHEET_ID;

  if (isDemoMode() && !sheetId) {
    return Object.keys(DEMO_DATA);
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${targetId}`
      + `?key=${CONFIG.API_KEY}&fields=sheets.properties.title`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.sheets.map(s => s.properties.title);
  } catch (e) {
    console.error('시트 목록 로드 실패:', e);
    showError('시트 목록을 불러올 수 없습니다. 네트워크를 확인해주세요.');
    return [];
  }
}

async function fetchSheetData(sheetName, sheetId) {
  const targetId = sheetId || CONFIG.SHEET_ID;

  if (isDemoMode() && !sheetId) {
    return DEMO_DATA[sheetName] || [];
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${targetId}`
      + `/values/${encodeURIComponent(sheetName)}`
      + `?key=${CONFIG.API_KEY}&valueRenderOption=FORMATTED_VALUE`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.values || [];
  } catch (e) {
    console.error('시트 데이터 로드 실패:', e);
    showError(`"${sheetName}" 데이터를 불러올 수 없습니다.`);
    return [];
  }
}

function findHeaderRow(rawValues) {
  for (let i = 0; i < Math.min(rawValues.length, 5); i++) {
    if (rawValues[i] && rawValues[i][0] === '이름') return i;
  }
  return 0;
}

function parseSheetData(rawValues) {
  if (!rawValues || rawValues.length < 2) return { dates: [], players: [] };

  const headerIdx = findHeaderRow(rawValues);
  const headerRow = rawValues[headerIdx];
  const dataRows = rawValues.slice(headerIdx + 1);

  const allDates = headerRow.slice(DATE_COL_START).map(d => d ?? '');

  const players = dataRows
    .filter(row => row[0] && row[0] !== '')
    .map(row => {
      const scoreValues = allDates.map((_, i) => {
        const val = row[DATE_COL_START + i];
        return val !== undefined && val !== '' ? Number(val) : null;
      });

      return {
        name: row[0],
        number: row[1] || '',
        scores: scoreValues,
        totalScore: scoreValues.reduce((sum, v) => sum + (v || 0), 0),
        attendCount: scoreValues.filter(v => v !== null).length,
      };
    });

  const visibleIndices = [];
  const dates = [];
  allDates.forEach((d, i) => {
    if (d === '') return;
    const hasAnyScore = players.some(p => p.scores[i] !== null);
    if (!hasAnyScore) return;
    dates.push(d);
    visibleIndices.push(i);
  });

  players.forEach(p => {
    p.scores = visibleIndices.map(i => p.scores[i]);
  });

  return { dates, players };
}
