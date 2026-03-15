// 리그 시트 파싱 (다중 탭 기반 + 레거시 단일 탭 호환)

const LEAGUE_DEMO_DATA = {
  'DEMO_ALPHA': {
    '전체득점': [
      ['팀', '이름', '번호', '1R', '2R', '3R', '4R', '5R', '6R', '7R', '8R', '9R', '10R', '참석수', '총득점', '랭킹', '평균득점', '평균득점랭킹'],
      ['A'],
      ['', '남궁현', 11, 20, 18, 22, 15, 19, 21, 17, 20, 16, 17, 10, 185, 2, 18.5, 3],
      ['', '김정호', 32, 25, 22, 18, 20, 23, 19, 21, 24, 18, 20, 10, 210, 1, 21.0, 1],
      ['', '김돈규', 4, 18, 20, 17, 19, 16, 22, 18, 15, 20, '', 9, 165, 4, 18.3, 2],
      ['B'],
      ['', '강재훈', 93, 22, 19, 20, 18, 21, 17, 23, 20, 18, 17, 10, 195, 3, 19.5, 2],
      ['', '정희원', 20, 16, 18, 15, 20, 17, 19, 18, 17, '', '', 8, 140, 6, 17.5, 6],
      ['', '유지형', 24, 17, 16, 18, 15, 19, 17, 20, 18, 15, '', 9, 155, 5, 17.2, 5],
      ['C'],
      ['', '길을섭', 38, 18, 16, 15, 17, 19, 18, 17, '', '', '', 7, 120, 9, 17.1, 7],
      ['', '이윤삼', 22, 17, 15, 18, 16, 17, 19, 16, 17, '', '', 8, 135, 7, 16.9, 8],
      ['', '김동광', 30, 19, 18, 17, 16, 20, 18, 17, 19, 16, '', 9, 160, 5, 17.8, 4],
    ],
    '부가기록 계산': [
      ['이름', '번호', '리바운드누적', '리바운드평균', '어시누적', '어시평균', '스틸누적', '스틸평균', '블록누적', '블록평균', '3점슛누적', '3점슛평균'],
      ['남궁현', 11, 62, 6.2, 45, 4.5, 18, 1.8, 5, 0.5, 12, 1.2],
      ['김정호', 32, 55, 5.5, 38, 3.8, 22, 2.2, 8, 0.8, 18, 1.8],
      ['김돈규', 4, 48, 5.3, 52, 5.8, 15, 1.7, 3, 0.3, 8, 0.9],
      ['강재훈', 93, 70, 7.0, 42, 4.2, 20, 2.0, 12, 1.2, 15, 1.5],
      ['정희원', 20, 45, 5.6, 35, 4.4, 12, 1.5, 4, 0.5, 10, 1.3],
      ['유지형', 24, 52, 5.8, 48, 5.3, 16, 1.8, 6, 0.7, 14, 1.6],
      ['길을섭', 38, 38, 5.4, 28, 4.0, 10, 1.4, 2, 0.3, 6, 0.9],
      ['이윤삼', 22, 42, 5.3, 32, 4.0, 14, 1.8, 3, 0.4, 9, 1.1],
      ['김동광', 30, 50, 5.6, 40, 4.4, 18, 2.0, 5, 0.6, 11, 1.2],
    ],
    'GBL 승점': [
      ['[STANDINGS]'],
      ['팀', '승', '패', '승점'],
      ['A', 11, 9, 34],
      ['B', 10, 10, 30],
      ['C', 9, 11, 28],
      [''],
      ['[AWARDS]'],
      ['라운드', 'MOM', '더블더블', '득점왕'],
      ['1R', '김정호', '남궁현', '김정호'],
      ['2R', '강재훈', '김돈규', '강재훈'],
      ['3R', '남궁현', '김정호', '남궁현'],
      [''],
      ['[TRADES]'],
      ['라운드', '선수명', '원팀', '신팀'],
      ['3R', '김동광', 'A', 'C'],
      ['5R', '유지형', 'C', 'B'],
    ],
  },
  'DEMO_BETA': {
    '전체득점': [
      ['팀', '이름', '번호', '1R', '2R', '3R', '4R', '5R', '6R', '7R', '8R', '참석수', '총득점', '랭킹', '평균득점', '평균득점랭킹'],
      ['A'],
      ['', '남궁현', 11, 20, 18, 22, 15, 19, 21, 17, 18, 8, 150, 2, 18.8, 2],
      ['', '강재훈', 93, 19, 17, 20, 18, 16, 21, 19, '', 7, 130, 3, 18.6, 3],
      ['B'],
      ['', '김정호', 32, 22, 21, 19, 23, 20, 24, 22, 19, 8, 170, 1, 21.3, 1],
      ['', '김돈규', 4, 18, 17, 19, 16, 18, 20, 17, '', 7, 125, 4, 17.9, 4],
    ],
    '부가기록 계산': [
      ['이름', '번호', '리바운드누적', '리바운드평균', '어시누적', '어시평균', '스틸누적', '스틸평균', '블록누적', '블록평균', '3점슛누적', '3점슛평균'],
      ['남궁현', 11, 55, 6.9, 40, 5.0, 15, 1.9, 4, 0.5, 10, 1.3],
      ['김정호', 32, 48, 6.0, 32, 4.0, 18, 2.3, 6, 0.8, 14, 1.8],
      ['강재훈', 93, 60, 8.6, 35, 5.0, 17, 2.4, 10, 1.4, 12, 1.7],
      ['김돈규', 4, 40, 5.7, 42, 6.0, 12, 1.7, 2, 0.3, 7, 1.0],
    ],
  },
};

// --- 다중 탭 파싱 함수 ---

function parseScoresTab(rawData, scoresMapping) {
  if (!rawData || rawData.length < 2) return [];

  const header = rawData[0];
  const cm = scoresMapping || { team: 0, name: 1, number: 2, roundStart: 3 };

  // 헤더에서 요약 컬럼 시작 위치 감지
  const summaryLabels = ['참석수', '총득점', '랭킹', '평균득점', '평균득점랭킹'];
  let summaryStart = header.length;
  for (let i = cm.roundStart; i < header.length; i++) {
    if (summaryLabels.includes(String(header[i]))) {
      summaryStart = i;
      break;
    }
  }

  const players = [];
  let currentTeam = '';

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const firstCell = String(row[cm.team] || '').trim();
    const nameCell = row[cm.name];

    // 팀 그룹 헤더 감지: A열에만 값이 있고 이름 열이 비어있는 행
    if (firstCell && (!nameCell || String(nameCell).trim() === '')) {
      currentTeam = firstCell;
      continue;
    }

    // 선수 행
    const name = row[cm.name];
    if (!name || String(name).trim() === '') continue;

    const number = row[cm.number] !== undefined ? row[cm.number] : '';

    // 라운드별 득점 추출
    const roundScores = [];
    for (let j = cm.roundStart; j < summaryStart; j++) {
      const val = row[j];
      roundScores.push(val !== undefined && val !== '' ? Number(val) : null);
    }

    // 요약 컬럼 추출
    const summaryValues = {};
    for (let j = summaryStart; j < header.length; j++) {
      const label = String(header[j] || '');
      summaryValues[label] = row[j] !== undefined && row[j] !== '' ? Number(row[j]) : 0;
    }

    players.push({
      name: String(name).trim(),
      number,
      team: currentTeam,
      attendance: summaryValues['참석수'] || 0,
      totalScore: summaryValues['총득점'] || 0,
      avgScore: summaryValues['평균득점'] || 0,
      ranking: summaryValues['랭킹'] || 0,
      roundScores,
    });
  }

  return players;
}

function parseStatsTab(rawData, statsMapping) {
  if (!rawData || rawData.length < 2) return [];

  const header = rawData[0];
  const cm = statsMapping || { name: 0, number: 1, statsStart: 2 };
  const statsStart = cm.statsStart || 2;

  // 헤더에서 스탯 이름 추출 (누적/평균 쌍)
  const statNames = [];
  for (let i = statsStart; i < header.length; i += 2) {
    const label = String(header[i] || '');
    const name = label.replace(/누적$/, '');
    if (name && !statNames.includes(name)) {
      statNames.push(name);
    }
  }

  const players = [];
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    const name = row[cm.name];
    if (!name || String(name).trim() === '') continue;

    const stats = {};
    statNames.forEach((statName, idx) => {
      const cumIdx = statsStart + idx * 2;
      const avgIdx = statsStart + idx * 2 + 1;
      stats[statName] = {
        cumulative: row[cumIdx] !== undefined && row[cumIdx] !== '' ? Number(row[cumIdx]) : 0,
        average: row[avgIdx] !== undefined && row[avgIdx] !== '' ? Number(row[avgIdx]) : 0,
      };
    });

    players.push({
      name: String(name).trim(),
      number: row[cm.number] !== undefined ? row[cm.number] : '',
      stats,
    });
  }

  return players;
}

function parseStandingsTab(rawData) {
  return parseMetadata(rawData);
}

function mergeLeagueData(scorePlayers, statPlayers, metadata) {
  // 이름 기준 스탯 매핑
  const statsMap = {};
  statPlayers.forEach(p => {
    statsMap[p.name] = p.stats;
  });

  const players = scorePlayers.map(p => {
    const extraStats = statsMap[p.name] || {};

    // 득점은 scores 탭에서, 나머지는 stats 탭에서
    const stats = {
      '득점': {
        cumulative: p.totalScore,
        average: p.avgScore,
      },
    };

    // 부가기록 스탯 병합 (어시스트 = 어시, 키 매핑)
    const keyMap = { '어시': '어시스트' };
    Object.keys(extraStats).forEach(key => {
      const displayKey = keyMap[key] || key;
      stats[displayKey] = extraStats[key];
    });

    return {
      name: p.name,
      number: p.number,
      team: p.team,
      attendance: p.attendance,
      stats,
      totalPoints: p.totalScore,
    };
  });

  return { players, metadata: metadata || { standings: [], awards: [], trades: [] } };
}

// --- 데이터 fetch 함수 ---

async function fetchLeagueSheetNames(leagueOrSheetId) {
  // tabs 설정이 있는 리그 객체 → seasons 반환
  if (typeof leagueOrSheetId === 'object' && leagueOrSheetId.tabs) {
    return leagueOrSheetId.seasons || ['현재 시즌'];
  }

  const sheetId = typeof leagueOrSheetId === 'object' ? leagueOrSheetId.sheetId : leagueOrSheetId;

  if (isDemoMode() && LEAGUE_DEMO_DATA[sheetId]) {
    return Object.keys(LEAGUE_DEMO_DATA[sheetId]).filter(name => !name.startsWith('_'));
  }

  const allNames = await fetchSheetNames(sheetId);
  return allNames.filter(name => !name.startsWith('_'));
}

async function fetchLeagueData(sheetId, tabName) {
  if (isDemoMode() && LEAGUE_DEMO_DATA[sheetId]) {
    return LEAGUE_DEMO_DATA[sheetId][tabName] || [];
  }
  console.log(`[League] Fetching: sheetId=${sheetId}, tab=${tabName}`);
  try {
    const result = await fetchSheetData(tabName, sheetId);
    console.log(`[League] ${tabName}: ${result.length} rows`);
    return result;
  } catch (e) {
    console.error(`[League] Fetch failed: sheetId=${sheetId}, tab=${tabName}`, e);
    throw e;
  }
}

async function fetchMetadata(sheetId, tabName) {
  const metaTab = tabName || '_metadata';
  if (isDemoMode() && LEAGUE_DEMO_DATA[sheetId]) {
    return LEAGUE_DEMO_DATA[sheetId][metaTab] || [];
  }
  return await fetchSheetData(metaTab, sheetId);
}

// --- 레거시 단일 탭 파싱 (하위 호환) ---

function parseLeagueData(rawData, columnMapping) {
  if (!rawData || rawData.length < 2) return { players: [], headers: [] };

  const headerRow = rawData[0];
  const dataRows = rawData.slice(1);

  const headers = headerRow;
  const cm = columnMapping;

  const players = dataRows
    .filter(row => row[cm.name] && row[cm.name] !== '')
    .map(row => {
      const statsStart = cm.statsStart || 4;
      const statValues = row.slice(statsStart);
      const stats = {};

      if (cm.statColumns) {
        cm.statColumns.forEach((statName, idx) => {
          const cumIdx = idx * 2;
          const avgIdx = idx * 2 + 1;
          stats[statName] = {
            cumulative: statValues[cumIdx] !== undefined && statValues[cumIdx] !== '' ? Number(statValues[cumIdx]) : 0,
            average: statValues[avgIdx] !== undefined && statValues[avgIdx] !== '' ? Number(statValues[avgIdx]) : 0,
          };
        });
      }

      const lastVal = row[row.length - 1];
      const totalPoints = lastVal !== undefined && lastVal !== '' ? Number(lastVal) : 0;

      return {
        name: row[cm.name],
        number: row[cm.number] !== undefined ? row[cm.number] : '',
        team: cm.team !== undefined ? (row[cm.team] || '') : '',
        attendance: cm.attendance !== undefined ? Number(row[cm.attendance] || 0) : 0,
        stats,
        totalPoints,
      };
    });

  return { players, headers };
}

function parseMetadata(rawData) {
  if (!rawData || rawData.length === 0) {
    return { standings: [], awards: [], trades: [] };
  }

  let section = null;
  const standings = [];
  const awards = [];
  const trades = [];
  let headerSkipped = false;

  for (const row of rawData) {
    const cell = String(row[0] || '').trim();

    if (cell === '[STANDINGS]') { section = 'standings'; headerSkipped = false; continue; }
    if (cell === '[AWARDS]') { section = 'awards'; headerSkipped = false; continue; }
    if (cell === '[TRADES]') { section = 'trades'; headerSkipped = false; continue; }
    if (cell === '') { continue; }

    if (!headerSkipped) { headerSkipped = true; continue; }

    if (section === 'standings') {
      standings.push({
        team: row[0],
        wins: Number(row[1] || 0),
        losses: Number(row[2] || 0),
        points: Number(row[3] || 0),
      });
    } else if (section === 'awards') {
      awards.push({
        round: row[0],
        mom: row[1] || '',
        doubleDouble: row[2] || '',
        topScorer: row[3] || '',
      });
    } else if (section === 'trades') {
      trades.push({
        round: row[0],
        playerName: row[1] || '',
        fromTeam: row[2] || '',
        toTeam: row[3] || '',
      });
    }
  }

  return { standings, awards, trades };
}
