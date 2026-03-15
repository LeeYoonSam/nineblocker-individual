// 리그 레지스트리: Apps Script에서 리그 목록 관리

const DEMO_LEAGUES = [
  {
    id: 'league-individual',
    name: '개인 승점제',
    description: '나인블로커스 개인 승점 랭킹',
    type: 'individual',
    sheetId: '',  // 실제 ID는 config.js의 SHEET_ID 사용
    columnMapping: {
      name: 0,
      number: 1,
      totalScore: 2,
      rank: 3,
      statsStart: 4,
    },
  },
  {
    id: 'league-demo-alpha',
    name: '알파 리그 (데모)',
    description: '3팀 리그전 데모',
    type: 'league',
    sheetId: 'DEMO_ALPHA',
    tabs: {
      scores: '전체득점',
      stats: '부가기록 계산',
      standings: 'GBL 승점',
    },
    seasons: ['현재 시즌'],
    scoresMapping: {
      team: 0,
      name: 1,
      number: 2,
      roundStart: 3,
    },
    statsMapping: {
      name: 0,
      number: 1,
      statsStart: 2,
    },
    columnMapping: {
      statColumns: ['득점', '어시스트', '리바운드', '스틸', '블록', '3점슛'],
    },
    hasMetadata: true,
  },
  {
    id: 'league-demo-beta',
    name: '베타 리그 (데모)',
    description: '2팀 리그전 데모',
    type: 'league',
    sheetId: 'DEMO_BETA',
    tabs: {
      scores: '전체득점',
      stats: '부가기록 계산',
    },
    seasons: ['현재 시즌'],
    scoresMapping: {
      team: 0,
      name: 1,
      number: 2,
      roundStart: 3,
    },
    statsMapping: {
      name: 0,
      number: 1,
      statsStart: 2,
    },
    columnMapping: {
      statColumns: ['득점', '어시스트', '리바운드', '스틸', '블록', '3점슛'],
    },
    hasMetadata: false,
  },
];

let _registryCache = null;

async function fetchLeagueRegistry() {
  if (_registryCache) return _registryCache;

  // sessionStorage 캐시 확인
  const cached = sessionStorage.getItem('leagueRegistry');
  if (cached) {
    try {
      _registryCache = JSON.parse(cached);
      return _registryCache;
    } catch (e) {
      sessionStorage.removeItem('leagueRegistry');
    }
  }

  if (CONFIG.DEMO_MODE) {
    _registryCache = { leagues: DEMO_LEAGUES };
    return _registryCache;
  }

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _registryCache = data;
    sessionStorage.setItem('leagueRegistry', JSON.stringify(data));
    return data;
  } catch (e) {
    console.error('리그 레지스트리 로드 실패:', e);
    _registryCache = { leagues: DEMO_LEAGUES };
    return _registryCache;
  }
}

function getLeagueById(id) {
  if (!_registryCache) return null;
  return _registryCache.leagues.find(l => l.id === id) || null;
}

function clearRegistryCache() {
  _registryCache = null;
  sessionStorage.removeItem('leagueRegistry');
}
