// 리그 페이지 컨트롤러

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('league-page')) {
    initLeaguePage();
  }
});

let currentLeague = null;
let currentSeasonData = null;

async function initLeaguePage() {
  const params = new URLSearchParams(window.location.search);
  const leagueId = params.get('id');

  if (!leagueId) {
    window.location.href = 'index.html';
    return;
  }

  const loading = document.getElementById('loading');
  loading.classList.remove('hidden');

  const registry = await fetchLeagueRegistry();
  currentLeague = registry.leagues.find(l => l.id === leagueId);

  if (!currentLeague) {
    loading.textContent = '리그를 찾을 수 없습니다.';
    return;
  }

  // 리그 이름 표시
  const titleEl = document.getElementById('league-title');
  if (titleEl) titleEl.textContent = currentLeague.name;
  const subtitleEl = document.getElementById('league-subtitle');
  if (subtitleEl) subtitleEl.textContent = currentLeague.description || '';
  document.title = `${currentLeague.name} - NineBlockers`;

  // 시즌 탭 로드
  const seasonNames = await fetchLeagueSheetNames(currentLeague);
  if (seasonNames.length === 0) {
    loading.textContent = '시즌 데이터가 없습니다.';
    return;
  }

  renderSeasonTabs(seasonNames);

  // 최신 시즌 로드
  const latestSeason = getLatestSheet(seasonNames) || seasonNames[0];
  await loadSeason(latestSeason);

  // 팀 필터 초기화
  initTeamFilters();

  // 검색 초기화
  initLeagueSearch(currentLeague.columnMapping);

  // 챗봇 초기화
  initChatbot();

  loading.classList.add('hidden');
  document.getElementById('league-content').classList.remove('hidden');
}

function renderSeasonTabs(seasonNames) {
  const container = document.getElementById('season-tabs');
  if (!container) return;

  container.innerHTML = seasonNames.map(name =>
    `<button class="segment-btn" data-season="${name}">${name}</button>`
  ).join('');

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('.segment-btn');
    if (!btn) return;
    await loadSeason(btn.dataset.season);
  });
}

function updateSeasonTabState(seasonName) {
  document.querySelectorAll('#season-tabs .segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.season === seasonName);
  });
}

async function loadSeason(seasonName) {
  updateSeasonTabState(seasonName);

  let players;
  let meta = { standings: [], awards: [], trades: [] };

  try {
    if (currentLeague.tabs) {
      // 다중 탭 리그: 병렬 fetch 후 병합
      const fetches = [
        fetchLeagueData(currentLeague.sheetId, currentLeague.tabs.scores),
        fetchLeagueData(currentLeague.sheetId, currentLeague.tabs.stats),
      ];
      if (currentLeague.tabs.standings) {
        fetches.push(fetchLeagueData(currentLeague.sheetId, currentLeague.tabs.standings));
      }

      const results = await Promise.all(fetches);
      const scoresRaw = results[0];
      const statsRaw = results[1];
      const standingsRaw = results[2] || [];

      const scorePlayers = parseScoresTab(scoresRaw, currentLeague.scoresMapping);
      const statPlayers = parseStatsTab(statsRaw, currentLeague.statsMapping);
      if (standingsRaw.length > 0) {
        meta = parseStandingsTab(standingsRaw);
      }

      const merged = mergeLeagueData(scorePlayers, statPlayers, meta);
      players = merged.players;
      meta = merged.metadata;
    } else {
      // 레거시 단일 탭 모드
      const rawData = await fetchLeagueData(currentLeague.sheetId, seasonName);
      const result = parseLeagueData(rawData, currentLeague.columnMapping);
      players = result.players;

      if (currentLeague.hasMetadata) {
        const metaRaw = await fetchMetadata(currentLeague.sheetId);
        meta = parseMetadata(metaRaw);
      }
    }

    if (!players || players.length === 0) {
      showError('데이터를 불러올 수 없습니다. 시트 공유 설정과 API 키를 확인해주세요.');
      return;
    }
  } catch (e) {
    console.error('시즌 로드 실패:', e);
    showError('데이터 로드 실패: ' + e.message);
    return;
  }

  currentSeasonData = players;
  window._currentColumnMapping = currentLeague.columnMapping;

  // 리그 테이블 렌더링
  renderLeagueTable(players, currentLeague.columnMapping);

  // 메타데이터 렌더링 (있는 경우)
  if (meta.standings.length > 0) {
    renderStandings(meta.standings);
    renderAwards(meta.awards);
    renderTradeButton(meta.trades);
  }

  // 챗봇 컨텍스트 업데이트
  if (typeof setChatContext === 'function') {
    setChatContext(players, currentLeague.name, seasonName);
  }

  // 스크린샷 버튼 설정
  const screenshotBtn = document.getElementById('screenshot-btn');
  if (screenshotBtn) {
    screenshotBtn.onclick = () => {
      captureScreenshot('league-table-container', `${currentLeague.name}-${seasonName}.png`);
    };
  }
}

function initTeamFilters() {
  const container = document.getElementById('team-filters');
  if (!container) return;

  // 팀 목록 추출
  const teams = new Set();
  if (currentSeasonData) {
    currentSeasonData.forEach(p => {
      if (p.team) teams.add(p.team);
    });
  }

  let html = '<button class="team-filter-btn active" data-team="all">전체</button>';
  Array.from(teams).sort().forEach(team => {
    html += `<button class="team-filter-btn" data-team="${team}">${team}팀</button>`;
  });
  container.innerHTML = html;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.team-filter-btn');
    if (!btn) return;
    setTeamFilter(btn.dataset.team);
  });
}
