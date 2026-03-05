// 실제 시트 구조:
// A=이름, B=넘버, C=개인승점(SUM), D=실시간순위(RANK), E~=날짜별 점수
const DATE_COL_START = 4; // E열 = index 4

// 데모 모드 테스트 데이터 (실제 시트 구조와 동일)
const DEMO_DATA = {
  '25-01': [
    ['이름','넘버','개인 승점','실시간 순위','1/4','1/7','1/11','1/14','1/21','1/25','2/1','2/4','2/8','2/11'],
    ['남궁현','11',41,1, 3,3,3,3,3,'',3,5,'',3],
    ['김정호','32',36,2, 3,'',3,3,3,3,'',3,'',3],
    ['김돈규','4',30,3,  3,3,3,3,'',3,'','',3,''],
    ['강재훈','93',12,4, 3,'','',3,'','','',3,'',''],
    ['정희원','20',17,5, 3,'',3,'','','','',5,3,''],
    ['이윤삼','22',21,6, 3,'',3,'','',3,3,'','',''],
    ['유지형','24',21,7, 3,3,3,'','','','',3,'',''],
    ['권기현','21',24,8, 3,'',3,'',3,3,3,'','',3],
  ],
  '26-01': [
    ['이름','넘버','개인 승점','실시간 순위','1월 6일','1월 13일','1월 20일','1월 27일'],
    ['김돈규','4',12,1,  3,3,'',''],
    ['김정호','32',6,2,  3,3,'',''],
    ['유지형','24',6,3,  3,3,'',''],
    ['강재훈','93',3,4,  3,'','',''],
    ['김혜미','99',3,5,  3,'','',''],
    ['손재민','25',3,6,  3,'','',''],
    ['정희원','20',3,7,  '',3,'',''],
    ['김동광','30',3,8,  '',3,'',''],
  ],
};

function isDemoMode() {
  return CONFIG.DEMO_MODE;
}

async function fetchSheetNames() {
  if (isDemoMode()) {
    return Object.keys(DEMO_DATA);
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}`
    + `?key=${CONFIG.API_KEY}&fields=sheets.properties.title`;

  const res = await fetch(url);
  const json = await res.json();
  return json.sheets.map(s => s.properties.title);
}

async function fetchSheetData(sheetName) {
  if (isDemoMode()) {
    return DEMO_DATA[sheetName] || [];
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}`
    + `/values/${encodeURIComponent(sheetName)}`
    + `?key=${CONFIG.API_KEY}`;

  const res = await fetch(url);
  const json = await res.json();
  return json.values || [];
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

  // E열(index 4)부터 날짜
  const dates = headerRow.slice(DATE_COL_START).filter(d => d !== undefined && d !== '');

  const players = dataRows
    .filter(row => row[0] && row[0] !== '')
    .map(row => {
      const scoreValues = dates.map((_, i) => {
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

  return { dates, players };
}
