// 리그 통계 테이블 렌더링

let currentSortCol = null;
let currentSortAsc = true;
let currentTeamFilter = 'all';
let allLeaguePlayers = [];

function getTeamBadgeClass(team) {
  const t = String(team).toUpperCase();
  if (t === 'A') return 'team-badge-a';
  if (t === 'B') return 'team-badge-b';
  if (t === 'C') return 'team-badge-c';
  if (t === 'D') return 'team-badge-d';
  return 'team-badge-a';
}

function renderLeagueTable(players, columnMapping) {
  allLeaguePlayers = players;
  const container = document.getElementById('league-table-container');
  if (!container) return;

  const statCols = columnMapping.statColumns || [];

  // 헤더 생성
  let headerHtml = '<tr>';
  headerHtml += '<th class="col-rank" data-sort="rank">순위 <span class="sort-arrow">▼</span></th>';
  headerHtml += '<th class="col-name" data-sort="name">이름 <span class="sort-arrow">▼</span></th>';
  headerHtml += '<th class="col-team" data-sort="team">팀 <span class="sort-arrow">▼</span></th>';
  headerHtml += '<th data-sort="attendance">출석 <span class="sort-arrow">▼</span></th>';

  statCols.forEach(stat => {
    headerHtml += `<th class="stat-col" data-sort="${stat}-cum">${stat} <span class="stat-header-group">누적</span> <span class="sort-arrow">▼</span></th>`;
    headerHtml += `<th class="stat-col" data-sort="${stat}-avg">${stat} <span class="stat-header-group">평균</span> <span class="sort-arrow">▼</span></th>`;
  });

  headerHtml += '<th class="col-total" data-sort="totalPoints">종합 <span class="sort-arrow">▼</span></th>';
  headerHtml += '</tr>';

  // 테이블 생성
  container.innerHTML = `
    <div class="league-table-wrapper">
      <table class="league-table" id="league-stats-table">
        <thead>${headerHtml}</thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  // 정렬 이벤트
  container.querySelectorAll('thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const sortKey = th.dataset.sort;
      if (currentSortCol === sortKey) {
        currentSortAsc = !currentSortAsc;
      } else {
        currentSortCol = sortKey;
        currentSortAsc = false; // 기본 내림차순
        if (sortKey === 'name' || sortKey === 'team') currentSortAsc = true;
      }
      updateLeagueTableBody(columnMapping);
      updateSortIndicators();
    });
  });

  // 초기 정렬: 종합포인트 내림차순
  currentSortCol = 'totalPoints';
  currentSortAsc = false;
  updateLeagueTableBody(columnMapping);
  updateSortIndicators();
}

function updateSortIndicators() {
  const table = document.getElementById('league-stats-table');
  if (!table) return;
  table.querySelectorAll('thead th').forEach(th => {
    th.classList.remove('sorted');
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) arrow.textContent = '▼';
  });
  if (currentSortCol) {
    const th = table.querySelector(`thead th[data-sort="${currentSortCol}"]`);
    if (th) {
      th.classList.add('sorted');
      const arrow = th.querySelector('.sort-arrow');
      if (arrow) arrow.textContent = currentSortAsc ? '▲' : '▼';
    }
  }
}

function sortLeaguePlayers(players, sortKey, asc) {
  return [...players].sort((a, b) => {
    let va, vb;

    if (sortKey === 'rank' || sortKey === 'totalPoints') {
      va = a.totalPoints; vb = b.totalPoints;
    } else if (sortKey === 'name') {
      return asc ? a.name.localeCompare(b.name, 'ko') : b.name.localeCompare(a.name, 'ko');
    } else if (sortKey === 'team') {
      return asc ? String(a.team).localeCompare(String(b.team)) : String(b.team).localeCompare(String(a.team));
    } else if (sortKey === 'attendance') {
      va = a.attendance; vb = b.attendance;
    } else if (sortKey.endsWith('-cum')) {
      const stat = sortKey.replace('-cum', '');
      va = (a.stats[stat] && a.stats[stat].cumulative) || 0;
      vb = (b.stats[stat] && b.stats[stat].cumulative) || 0;
    } else if (sortKey.endsWith('-avg')) {
      const stat = sortKey.replace('-avg', '');
      va = (a.stats[stat] && a.stats[stat].average) || 0;
      vb = (b.stats[stat] && b.stats[stat].average) || 0;
    } else {
      va = 0; vb = 0;
    }

    const diff = asc ? va - vb : vb - va;
    return diff !== 0 ? diff : a.name.localeCompare(b.name, 'ko');
  });
}

function updateLeagueTableBody(columnMapping) {
  const tbody = document.querySelector('#league-stats-table tbody');
  if (!tbody) return;

  let filtered = allLeaguePlayers;
  if (currentTeamFilter !== 'all') {
    filtered = filtered.filter(p => String(p.team).toUpperCase() === currentTeamFilter.toUpperCase());
  }

  // 검색 필터
  const searchInput = document.getElementById('league-search');
  if (searchInput && searchInput.value.trim()) {
    const q = searchInput.value.trim().toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) || String(p.number).includes(q)
    );
  }

  const sorted = sortLeaguePlayers(filtered, currentSortCol, currentSortAsc);

  // 랭크 부여
  let rank = 1;
  sorted.forEach((p, i) => {
    if (i > 0 && p.totalPoints < sorted[i - 1].totalPoints) rank = i + 1;
    p.rank = rank;
  });

  const statCols = columnMapping.statColumns || [];

  tbody.innerHTML = sorted.map(p => {
    const medalEmoji = getMedalEmoji(p.rank);
    const badgeClass = getTeamBadgeClass(p.team);

    let row = '<tr>';
    row += `<td class="col-rank">${medalEmoji}${p.rank}</td>`;
    row += `<td class="col-name">${p.name}</td>`;
    row += `<td class="col-team"><span class="team-badge ${badgeClass}">${p.team}</span></td>`;
    row += `<td>${p.attendance}</td>`;

    statCols.forEach(stat => {
      const s = p.stats[stat] || { cumulative: 0, average: 0 };
      row += `<td class="stat-col">${s.cumulative}</td>`;
      row += `<td class="stat-col">${s.average.toFixed(1)}</td>`;
    });

    row += `<td class="col-total">${p.totalPoints}</td>`;
    row += '</tr>';
    return row;
  }).join('');
}

function setTeamFilter(team) {
  currentTeamFilter = team;
  document.querySelectorAll('.team-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.team === team);
  });
  updateLeagueTableBody(window._currentColumnMapping || {});
}

function initLeagueSearch(columnMapping) {
  const searchInput = document.getElementById('league-search');
  if (!searchInput) return;

  let timer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      updateLeagueTableBody(columnMapping);
    }, 300);
  });
}
