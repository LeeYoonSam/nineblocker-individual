// v2 페이지 컨트롤러

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('hub-page')) {
    initHubPage();
  } else if (document.getElementById('year-tabs')) {
    initIndividualPage();
  } else if (document.getElementById('auth-modal')) {
    initAdminPage();
  }
});

// =====================
// 허브 페이지
// =====================

async function initHubPage() {
  const grid = document.getElementById('league-grid');
  if (!grid) return;

  grid.innerHTML = '<p class="loading">리그 목록을 불러오는 중...</p>';

  const registry = await fetchLeagueRegistry();
  renderLeagueGrid(registry.leagues);
}

function renderLeagueGrid(leagues) {
  const grid = document.getElementById('league-grid');
  if (!grid) return;

  grid.innerHTML = leagues.map(league => {
    const isIndividual = league.type === 'individual';
    const cardClass = isIndividual ? 'league-card-individual' : 'league-card-league';
    const icon = isIndividual ? '🏀' : '🏆';
    const href = isIndividual ? 'individual.html' : `league.html?id=${league.id}`;

    return `
      <a href="${href}" class="glass-card league-card ${cardClass}" style="text-decoration:none;color:inherit;">
        <div class="league-icon">${icon}</div>
        <div class="league-name">${league.name}</div>
        <div class="league-desc">${league.description || ''}</div>
        <div class="league-meta">
          <span>${isIndividual ? '개인전' : '팀 리그'}</span>
        </div>
      </a>
    `;
  }).join('');
}

// =====================
// 개인승점 페이지
// =====================

async function initIndividualPage() {
  const saved = localStorage.getItem('selectedSheet');
  if (saved) {
    document.getElementById('sheet-selector-btn').textContent = saved + ' ▾';
  }

  const tabs = await fetchSheetNames();
  renderSheetSelector(tabs);
  if (tabs.length > 0) {
    const target = saved && tabs.includes(saved) ? saved : (getLatestSheet(tabs) || tabs[0]);
    loadSheet(target);
  }
}

function renderSheetSelector(sheetNames) {
  const btn = document.getElementById('sheet-selector-btn');
  const dropdown = document.getElementById('sheet-dropdown');

  dropdown.innerHTML = sheetNames.map(name =>
    `<div class="sheet-dropdown-item" data-sheet="${name}">${name}</div>`
  ).join('');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });

  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.sheet-dropdown-item');
    if (!item) return;
    loadSheet(item.dataset.sheet);
    dropdown.classList.add('hidden');
  });

  document.addEventListener('click', () => {
    dropdown.classList.add('hidden');
  });
}

function updateSelectorState(sheetName) {
  const btn = document.getElementById('sheet-selector-btn');
  btn.textContent = sheetName + ' ▾';
  document.querySelectorAll('.sheet-dropdown-item').forEach(item => {
    item.classList.toggle('active', item.dataset.sheet === sheetName);
  });
}

async function loadSheet(sheetName) {
  localStorage.setItem('selectedSheet', sheetName);
  const loading = document.getElementById('loading');
  const summarySection = document.getElementById('summary-section');
  const matrixSection = document.getElementById('matrix-section');

  loading.textContent = '데이터를 불러오는 중...';
  loading.classList.remove('hidden');
  summarySection.classList.add('hidden');
  matrixSection.classList.add('hidden');

  updateSelectorState(sheetName);

  const rawData = await fetchSheetData(sheetName);
  const { dates, players } = parseSheetData(rawData);

  loading.classList.add('hidden');
  summarySection.classList.remove('hidden');
  matrixSection.classList.remove('hidden');

  renderSummaryCards(players);
  renderMatrix(dates, players);
}

function highlightMatrixRow(tr, toggle) {
  const table = document.getElementById('matrix-table');
  const wasHighlighted = tr && tr.classList.contains('highlight');
  table.querySelectorAll('tbody tr.highlight').forEach(r => r.classList.remove('highlight'));
  if (tr && (!toggle || !wasHighlighted)) tr.classList.add('highlight');
}

function renderSummaryCards(players) {
  const container = document.getElementById('summary-cards');
  const sorted = assignRanks([...players].sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name, 'ko')));
  const top10 = sorted.filter(p => p.totalScore > 0).slice(0, 10);

  container.innerHTML = top10.map(p => {
    const medalClass = getMedalClass(p.rank);
    const emoji = getMedalEmoji(p.rank);
    return `
    <div class="card${medalClass}" data-player-name="${p.name}" style="cursor:pointer">
      <span class="rank">${emoji}${p.rank}위</span>
      <strong class="name">${p.name}</strong>
    </div>
  `;
  }).join('');

  container.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.dataset.playerName;
      const row = document.querySelector(`#matrix-table .name-cell[data-name="${name}"]`);
      if (row) {
        highlightMatrixRow(row.closest('tr'));
        row.closest('tr').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
}

function renderMatrix(dates, players) {
  const table = document.getElementById('matrix-table');
  const sorted = [...players].sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name, 'ko'));
  const reversedDates = [...dates].reverse();

  const headerRow = '<tr>'
    + '<th class="sticky-rank sticky-header">랭킹</th>'
    + '<th class="sticky-name sticky-header">이름</th>'
    + '<th class="sticky-number sticky-header">No.</th>'
    + reversedDates.map(d => `<th class="date-col">${d}</th>`).join('')
    + '<th class="sticky-total sticky-header">합계</th>'
    + '</tr>';

  assignRanks(sorted);

  const bodyRows = sorted.map(p => {
    const emoji = getMedalEmoji(p.rank);
    const reversedScores = [...p.scores].reverse();
    const cells = reversedScores.map(s =>
      `<td class="date-col ${s !== null ? 'present' : 'absent'}">${s !== null ? s : '-'}</td>`
    ).join('');
    return '<tr>'
      + `<td class="sticky-rank rank-cell">${emoji}${p.rank}</td>`
      + `<td class="sticky-name name-cell" data-name="${p.name}">${p.name}</td>`
      + `<td class="sticky-number number-cell">${p.number}</td>`
      + cells
      + `<td class="sticky-total total">${p.totalScore}</td>`
      + '</tr>';
  }).join('');

  table.innerHTML = `<thead>${headerRow}</thead><tbody>${bodyRows}</tbody>`;

  table.querySelector('tbody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    highlightMatrixRow(tr, true);
  });
}

// =====================
// 관리자 페이지
// =====================

let cachedPasswordHash = '';
let currentSheetData = null;
let sessionTimer = null;

function cleanupSession() {
  if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null; }
  AdminSession.clear();
  cachedPasswordHash = '';
}

function startSessionTimer() {
  if (sessionTimer) clearInterval(sessionTimer);
  sessionTimer = setInterval(() => {
    if (!AdminSession.check()) {
      handleSessionExpired();
    }
  }, 60 * 1000);
}

function handleSessionExpired() {
  cleanupSession();
  alert('세션이 만료되었습니다. 다시 로그인해주세요.');
  window.location.href = 'index.html';
}

async function initAdminPage() {
  const modal = document.getElementById('auth-modal');
  const panel = document.getElementById('admin-panel');

  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('password-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('sheet-select').addEventListener('change', handleSheetChange);
  document.getElementById('date-select').addEventListener('change', handleDateSelect);
  document.getElementById('date-input').addEventListener('change', handleDateInputChange);
  document.getElementById('save-btn').addEventListener('click', handleSave);
  document.getElementById('save-btn').disabled = true;
  document.getElementById('player-list').addEventListener('input', updateSaveButtonState);

  const searchInput = document.getElementById('player-search');
  if (searchInput) {
    searchInput.addEventListener('input', handlePlayerSearch);
  }

  document.querySelectorAll('input[name="entry-mode"]').forEach(radio => {
    radio.addEventListener('change', handleEntryModeChange);
  });

  // 리그 관리 탭 초기화
  initLeagueManagement();

  if (AdminSession.check() && cachedPasswordHash) {
    panel.classList.remove('hidden');
    startSessionTimer();
    await loadAdminData();
  } else {
    AdminSession.clear();
    modal.classList.remove('hidden');
  }
}

async function handleLogin() {
  const input = document.getElementById('password-input');
  const error = document.getElementById('auth-error');
  const password = input.value;

  const valid = await verifyAdmin(password);
  if (valid) {
    cachedPasswordHash = await sha256(password);
    AdminSession.set();
    startSessionTimer();
    document.getElementById('auth-modal').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
    error.classList.add('hidden');
    await loadAdminData();
  } else {
    error.classList.remove('hidden');
    input.value = '';
    input.focus();
  }
}

function handleLogout() {
  cleanupSession();
  window.location.href = 'index.html';
}

async function loadAdminData() {
  const sheetNames = await fetchSheetNames();
  const select = document.getElementById('sheet-select');
  select.innerHTML = sheetNames.map(name =>
    `<option value="${name}">${name}</option>`
  ).join('');

  if (sheetNames.length > 0) {
    select.value = getLatestSheet(sheetNames) || sheetNames[0];
    await handleSheetChange();
  }

  // 리그 목록 로드
  await loadLeagueList();
}

async function handleSheetChange() {
  const sheetName = document.getElementById('sheet-select').value;
  const rawData = await fetchSheetData(sheetName);
  currentSheetData = parseSheetData(rawData);
  const { dates } = currentSheetData;

  const dateSelect = document.getElementById('date-select');
  dateSelect.innerHTML = '<option value="">-- 날짜 선택 --</option>'
    + dates.map(d => `<option value="${d}">${d}</option>`).join('');

  const newRadio = document.querySelector('input[name="entry-mode"][value="new"]');
  if (newRadio) {
    newRadio.checked = true;
  }
  handleEntryModeChange();
}

function handleDateSelect() {
  const dateSelect = document.getElementById('date-select');
  const dateInput = document.getElementById('date-input');

  if (dateSelect.value) {
    const isoDate = sheetDateToISO(dateSelect.value);
    dateInput.value = isoDate || '';
    dateInput.disabled = true;
    if (currentSheetData) {
      const dateIdx = currentSheetData.dates.indexOf(dateSelect.value);
      renderPlayerInputs(currentSheetData.players, dateIdx);
    }
  } else {
    dateInput.value = '';
    dateInput.disabled = false;
    if (currentSheetData) {
      renderPlayerInputs(currentSheetData.players, null);
    }
  }
  updateSaveButtonState();
}

function handleEntryModeChange() {
  const mode = document.querySelector('input[name="entry-mode"]:checked').value;
  const newDateGroup = document.getElementById('new-date-group');
  const editDateGroup = document.getElementById('edit-date-group');

  if (mode === 'new') {
    newDateGroup.classList.remove('hidden');
    editDateGroup.classList.add('hidden');
    const dateInput = document.getElementById('date-input');
    dateInput.value = '';
    dateInput.disabled = false;
    if (currentSheetData) {
      renderPlayerInputs(currentSheetData.players, null);
    }
  } else {
    newDateGroup.classList.add('hidden');
    editDateGroup.classList.remove('hidden');
    document.getElementById('date-select').value = '';
    handleDateSelect();
  }
  updateSaveButtonState();
}

function handleDateInputChange() {
  const dateInput = document.getElementById('date-input');
  if (dateInput.value && currentSheetData) {
    renderPlayerInputs(currentSheetData.players, null);
  }
  updateSaveButtonState();
}

function renderPlayerInputs(players, existingDateIdx) {
  const container = document.getElementById('player-list');

  let sortedPlayers = [...players];
  if (existingDateIdx !== null && existingDateIdx >= 0) {
    sortedPlayers.sort((a, b) => {
      const aScore = a.scores[existingDateIdx];
      const bScore = b.scores[existingDateIdx];
      const aPresent = aScore !== null;
      const bPresent = bScore !== null;
      if (aPresent && !bPresent) return -1;
      if (!aPresent && bPresent) return 1;
      if (aPresent && bPresent) return aScore - bScore;
      return a.name.localeCompare(b.name, 'ko');
    });
  } else {
    sortedPlayers.sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name, 'ko'));
  }

  container.innerHTML = sortedPlayers.map(p => {
    let value = '';
    if (existingDateIdx !== null && existingDateIdx >= 0) {
      const existing = p.scores[existingDateIdx];
      if (existing !== null) {
        value = existing;
      }
    }
    return `
    <div class="player-input" data-name="${p.name}">
      <label><span class="player-number">#${p.number}</span> ${p.name}</label>
      <input type="number" data-player="${p.name}" value="${value}" min="0" max="10">
      <button class="btn-attend" onclick="this.parentElement.querySelector('input').value=${CONFIG.DEFAULT_SCORE};updateSaveButtonState()">출석</button>
      <button class="btn-absent" onclick="this.parentElement.querySelector('input').value='';updateSaveButtonState()">결석</button>
    </div>
  `;
  }).join('');

  const searchInput = document.getElementById('player-search');
  if (searchInput) searchInput.value = '';
  updateSaveButtonState();
}

function updateSaveButtonState() {
  const saveBtn = document.getElementById('save-btn');
  const mode = document.querySelector('input[name="entry-mode"]:checked').value;

  let hasDate = false;
  if (mode === 'new') {
    hasDate = !!document.getElementById('date-input').value;
  } else {
    hasDate = !!document.getElementById('date-select').value;
  }

  const inputs = document.querySelectorAll('#player-list input[data-player]');
  const hasAnyScore = inputs.length > 0 && Array.from(inputs).some(input => input.value !== '');

  saveBtn.disabled = !(hasDate && hasAnyScore);
}

let searchTimer = null;

function handlePlayerSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const query = document.getElementById('player-search').value.trim().toLowerCase();
    document.querySelectorAll('.player-input').forEach(el => {
      const name = (el.dataset.name || '').toLowerCase();
      const numberEl = el.querySelector('.player-number');
      const number = numberEl ? numberEl.textContent.replace('#', '').trim() : '';
      el.style.display = (!query || name.includes(query) || number.includes(query)) ? '' : 'none';
    });
  }, 300);
}

async function handleSave() {
  const saveBtn = document.getElementById('save-btn');
  const overlay = document.getElementById('save-overlay');
  const sheetName = document.getElementById('sheet-select').value;
  const dateInput = document.getElementById('date-input');
  const dateSelect = document.getElementById('date-select');

  const mode = document.querySelector('input[name="entry-mode"]:checked').value;
  let date;
  if (mode === 'edit' && dateSelect.value) {
    date = dateSelect.value;
  } else {
    const isoVal = dateInput.value;
    if (!isoVal) {
      alert('날짜를 입력해주세요.');
      return;
    }
    const formatHint = currentSheetData && currentSheetData.dates.length > 0
      ? currentSheetData.dates[0] : '';
    date = isoToSheetDate(isoVal, formatHint);
  }

  const inputs = document.querySelectorAll('#player-list input[data-player]');
  const entries = Array.from(inputs).map(input => ({
    playerName: input.dataset.player,
    score: input.value === '' ? null : input.value,
  }));

  saveBtn.disabled = true;
  if (overlay) overlay.classList.remove('hidden');

  function endSaveLoading() {
    if (overlay) overlay.classList.add('hidden');
    updateSaveButtonState();
  }

  if (!cachedPasswordHash) {
    endSaveLoading();
    handleSessionExpired();
    return;
  }

  let result;
  try {
    result = await submitScores({
      sheetName,
      date,
      entries,
      passwordHash: cachedPasswordHash,
    });
  } catch (err) {
    endSaveLoading();
    alert('저장 실패: 서버와 통신할 수 없습니다.');
    return;
  }

  endSaveLoading();

  if (result.success) {
    alert(`${result.updated}명의 점수가 저장되었습니다.`);
    window.location.href = 'index.html';
    return;
  } else {
    alert(`저장 실패: ${result.error}`);
    if (result.error === 'Unauthorized') {
      handleSessionExpired();
      return;
    }
  }
}

// =====================
// 리그 관리 (관리자)
// =====================

function initLeagueManagement() {
  const addBtn = document.getElementById('add-league-btn');
  if (addBtn) {
    addBtn.addEventListener('click', showAddLeagueModal);
  }
}

async function loadLeagueList() {
  const container = document.getElementById('league-list');
  if (!container) return;

  const registry = await fetchLeagueRegistry();
  const leagues = registry.leagues.filter(l => l.type === 'league');

  if (leagues.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:0.5rem;">등록된 리그가 없습니다.</p>';
    return;
  }

  container.innerHTML = leagues.map(l => `
    <div class="league-row" style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid var(--border);">
      <strong style="flex:1;">${l.name}</strong>
      <span style="color:var(--text-muted);font-size:0.8rem;">${l.sheetId ? l.sheetId.substring(0, 12) + '...' : 'N/A'}</span>
      <button class="btn btn-secondary" style="font-size:0.8rem;padding:0.2rem 0.5rem;" onclick="showEditLeagueModal('${l.id}')">수정</button>
      <button class="btn btn-danger" style="font-size:0.8rem;padding:0.2rem 0.5rem;" onclick="confirmDeleteLeague('${l.id}','${l.name}')">삭제</button>
    </div>
  `).join('');
}

function showAddLeagueModal(editLeague) {
  const existing = document.getElementById('league-modal');
  if (existing) existing.remove();

  const isEdit = !!editLeague;
  const title = isEdit ? '리그 수정' : '리그 추가';
  const btnText = isEdit ? '저장' : '추가';
  const btnAction = isEdit ? `handleAddLeague('${editLeague.id}')` : 'handleAddLeague()';

  const modal = document.createElement('div');
  modal.id = 'league-modal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:480px;text-align:left;">
      <h2 style="text-align:center;margin-bottom:1rem;">${title}</h2>
      <div class="form-group">
        <label>리그 이름</label>
        <input type="text" id="league-name-input" placeholder="예: 알파 리그" value="${isEdit ? editLeague.name : ''}">
      </div>
      <div class="form-group">
        <label>설명</label>
        <input type="text" id="league-desc-input" placeholder="예: 3팀 리그전" value="${isEdit ? (editLeague.description || '') : ''}">
      </div>
      <div class="form-group">
        <label>Google Sheet ID</label>
        <input type="text" id="league-sheetid-input" placeholder="스프레드시트 ID 입력" value="${isEdit ? (editLeague.sheetId || '') : ''}">
      </div>
      <hr style="border-color:var(--border);margin:0.75rem 0;">
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.5rem;">탭 설정 (다중 탭 리그)</p>
      <div class="form-group">
        <label>전체득점 탭</label>
        <input type="text" id="league-tab-scores-input" placeholder="전체득점" value="${isEdit && editLeague.tabs ? (editLeague.tabs.scores || '') : '전체득점'}">
      </div>
      <div class="form-group">
        <label>부가기록 탭</label>
        <input type="text" id="league-tab-stats-input" placeholder="부가기록 계산" value="${isEdit && editLeague.tabs ? (editLeague.tabs.stats || '') : '부가기록 계산'}">
      </div>
      <div class="form-group">
        <label>GBL 승점 탭 <span style="font-size:0.75rem;color:var(--text-muted);">(선택)</span></label>
        <input type="text" id="league-tab-standings-input" placeholder="GBL 승점 (비워두면 제외)" value="${isEdit && editLeague.tabs && editLeague.tabs.standings ? editLeague.tabs.standings : ''}">
      </div>
      <hr style="border-color:var(--border);margin:0.75rem 0;">
      <div class="form-group">
        <label>통계 컬럼 (쉼표 구분)</label>
        <input type="text" id="league-stats-input" value="${isEdit && editLeague.columnMapping && editLeague.columnMapping.statColumns ? editLeague.columnMapping.statColumns.join(',') : '득점,어시스트,리바운드,스틸,블록,3점슛'}" placeholder="득점,어시스트,...">
      </div>
      <div style="display:flex;gap:0.5rem;margin-top:1rem;">
        <button class="btn btn-primary" style="flex:1;" onclick="${btnAction}">${btnText}</button>
        <button class="btn btn-secondary" style="flex:1;" onclick="this.closest('.modal').remove()">취소</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
  document.getElementById('league-name-input').focus();
}

async function handleAddLeague(editId) {
  const name = document.getElementById('league-name-input').value.trim();
  const description = document.getElementById('league-desc-input').value.trim();
  const sheetId = document.getElementById('league-sheetid-input').value.trim();
  const statsRaw = document.getElementById('league-stats-input').value.trim();
  const scoresTab = document.getElementById('league-tab-scores-input').value.trim();
  const statsTab = document.getElementById('league-tab-stats-input').value.trim();
  const standingsTab = document.getElementById('league-tab-standings-input').value.trim();

  if (!name || !sheetId) {
    alert('리그 이름과 Sheet ID는 필수입니다.');
    return;
  }

  const statColumns = statsRaw.split(',').map(s => s.trim()).filter(Boolean);

  const tabs = {
    scores: scoresTab || '전체득점',
    stats: statsTab || '부가기록 계산',
  };
  if (standingsTab) {
    tabs.standings = standingsTab;
  }

  const league = {
    id: editId || generateId(),
    name,
    description,
    type: 'league',
    sheetId,
    tabs,
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
      statColumns,
    },
    hasMetadata: !!standingsTab,
  };

  if (CONFIG.DEMO_MODE) {
    alert('데모 모드에서는 리그를 추가할 수 없습니다.');
    const modal = document.getElementById('league-modal');
    if (modal) modal.remove();
    return;
  }

  try {
    const action = editId ? updateLeague : addLeague;
    const result = await action({ league, passwordHash: cachedPasswordHash });
    if (result.success) {
      alert(editId ? '리그가 수정되었습니다.' : '리그가 추가되었습니다.');
      clearRegistryCache();
      await loadLeagueList();
    } else {
      alert(`${editId ? '수정' : '추가'} 실패: ${result.error}`);
    }
  } catch (e) {
    alert('서버 통신 실패');
  }

  const modal = document.getElementById('league-modal');
  if (modal) modal.remove();
}

function showEditLeagueModal(leagueId) {
  const league = getLeagueById(leagueId);
  if (!league) {
    alert('리그를 찾을 수 없습니다.');
    return;
  }
  showAddLeagueModal(league);
}

async function confirmDeleteLeague(id, name) {
  if (!confirm(`"${name}" 리그를 삭제하시겠습니까?`)) return;

  if (CONFIG.DEMO_MODE) {
    alert('데모 모드에서는 리그를 삭제할 수 없습니다.');
    return;
  }

  try {
    const result = await deleteLeague({ leagueId: id, passwordHash: cachedPasswordHash });
    if (result.success) {
      alert('리그가 삭제되었습니다.');
      clearRegistryCache();
      await loadLeagueList();
    } else {
      alert(`삭제 실패: ${result.error}`);
    }
  } catch (e) {
    alert('서버 통신 실패');
  }
}
