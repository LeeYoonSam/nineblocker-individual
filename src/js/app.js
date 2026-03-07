// 페이지 판별 후 초기화
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('year-tabs')) {
    initIndexPage();
  } else if (document.getElementById('auth-modal')) {
    initAdminPage();
  }
});

// =====================
// 조회 페이지 (index.html)
// =====================

async function initIndexPage() {
  const tabs = await fetchSheetNames();
  renderSheetSelector(tabs);
  if (tabs.length > 0) {
    const saved = localStorage.getItem('selectedSheet');
    const target = saved && tabs.includes(saved) ? saved : tabs[tabs.length - 1];
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

function assignRanks(sortedPlayers) {
  let currentRank = 1;
  sortedPlayers.forEach((p, i) => {
    if (i > 0 && p.totalScore < sortedPlayers[i - 1].totalScore) currentRank = i + 1;
    p.rank = currentRank;
  });
  return sortedPlayers;
}

function getMedalEmoji(rank) {
  if (rank === 1) return '\u{1F947} ';
  if (rank === 2) return '\u{1F948} ';
  if (rank === 3) return '\u{1F949} ';
  return '';
}

function highlightMatrixRow(tr, toggle = false) {
  const table = document.getElementById('matrix-table');
  const wasHighlighted = tr && tr.classList.contains('highlight');
  table.querySelectorAll('tbody tr.highlight').forEach(r => r.classList.remove('highlight'));
  if (tr && (!toggle || !wasHighlighted)) tr.classList.add('highlight');
}

function getMedalClass(rank) {
  if (rank === 1) return ' card-gold';
  if (rank === 2) return ' card-silver';
  if (rank === 3) return ' card-bronze';
  return '';
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

  // 카드 클릭 → 매트릭스 row 이동
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

  // 날짜 내림차순 (최근 날짜가 먼저)
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
// 관리자 페이지 (admin.html)
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

  // 이벤트 리스너를 항상 먼저 등록
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

  // 모드 선택 라디오 버튼 이벤트
  document.querySelectorAll('input[name="entry-mode"]').forEach(radio => {
    radio.addEventListener('change', handleEntryModeChange);
  });

  // 세션 체크
  if (AdminSession.check()) {
    panel.classList.remove('hidden');
    startSessionTimer();
    await loadAdminData();
  } else {
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
    select.value = sheetNames[sheetNames.length - 1];
    await handleSheetChange();
  }
}

async function handleSheetChange() {
  const sheetName = document.getElementById('sheet-select').value;
  const rawData = await fetchSheetData(sheetName);
  currentSheetData = parseSheetData(rawData);
  const { dates, players } = currentSheetData;

  const dateSelect = document.getElementById('date-select');
  dateSelect.innerHTML = '<option value="">-- 날짜 선택 --</option>'
    + dates.map(d => `<option value="${d}">${d}</option>`).join('');

  // 연도 변경 시 모드를 새 기록으로 리셋
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
    // 기존 날짜 -> ISO 포맷으로 변환하여 date input에 표시
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
    // 새 날짜: 전체 결석(빈 값)으로 초기화
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
    // 날짜 입력 초기화
    const dateInput = document.getElementById('date-input');
    dateInput.value = '';
    dateInput.disabled = false;
    // 새 기록 모드: 빈 점수로 초기화
    if (currentSheetData) {
      renderPlayerInputs(currentSheetData.players, null);
    }
  } else {
    newDateGroup.classList.add('hidden');
    editDateGroup.classList.remove('hidden');
    // 날짜 선택 초기화 후 로드
    document.getElementById('date-select').value = '';
    handleDateSelect();
  }
  updateSaveButtonState();
}

function handleDateInputChange() {
  const dateInput = document.getElementById('date-input');
  // 새 날짜 입력 시 점수 영역 갱신
  if (dateInput.value && currentSheetData) {
    renderPlayerInputs(currentSheetData.players, null);
  }
  updateSaveButtonState();
}

function renderPlayerInputs(players, existingDateIdx) {
  const container = document.getElementById('player-list');

  // 정렬: 기존 기록 수정 시 출석자 우선+점수 오름차순, 새 기록 시 랭킹순
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
    let isAbsent = true;

    if (existingDateIdx !== null && existingDateIdx >= 0) {
      const existing = p.scores[existingDateIdx];
      if (existing !== null) {
        value = existing;
        isAbsent = false;
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

  // 검색 필터 초기화
  const searchInput = document.getElementById('player-search');
  if (searchInput) searchInput.value = '';

  updateSaveButtonState();
}

function updateSaveButtonState() {
  const saveBtn = document.getElementById('save-btn');
  const mode = document.querySelector('input[name="entry-mode"]:checked').value;

  // 날짜 확인
  let hasDate = false;
  if (mode === 'new') {
    hasDate = !!document.getElementById('date-input').value;
  } else {
    hasDate = !!document.getElementById('date-select').value;
  }

  // 최소 1명 이상 점수 입력 확인
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

// 날짜 포맷 변환 유틸리티
function sheetDateToISO(sheetDate) {
  const now = new Date();
  const currentYear = now.getFullYear();

  // "1/4" 형식
  let m = sheetDate.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    return `${currentYear}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  // "1월 6일" 형식
  m = sheetDate.match(/^(\d{1,2})월\s*(\d{1,2})일$/);
  if (m) {
    return `${currentYear}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return '';
}

function isoToSheetDate(isoDate, formatHint) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  // formatHint로 기존 시트의 날짜 포맷 감지
  if (formatHint && formatHint.includes('월')) {
    return `${month}월 ${day}일`;
  }
  return `${month}/${day}`;
}

async function handleSave() {
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('save-status');
  const sheetName = document.getElementById('sheet-select').value;
  const dateInput = document.getElementById('date-input');
  const dateSelect = document.getElementById('date-select');

  // 모드에 따라 날짜 결정
  const mode = document.querySelector('input[name="entry-mode"]:checked').value;
  let date;
  if (mode === 'edit' && dateSelect.value) {
    date = dateSelect.value;
  } else {
    const isoVal = dateInput.value;
    if (!isoVal) {
      status.textContent = '날짜를 입력해주세요.';
      status.className = 'error';
      status.classList.remove('hidden');
      return;
    }
    // 기존 날짜 포맷 감지
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
  status.textContent = '저장 중...';
  status.className = '';
  status.classList.remove('hidden');

  if (!cachedPasswordHash) {
    handleSessionExpired();
    return;
  }

  const result = await submitScores({
    sheetName,
    date,
    entries,
    passwordHash: cachedPasswordHash,
  });

  if (result.success) {
    alert(`${result.updated}명의 점수가 저장되었습니다.`);
    window.location.href = 'index.html';
    return;
  } else {
    status.textContent = `저장 실패: ${result.error}`;
    status.className = 'error';
  }

  saveBtn.disabled = false;
  updateSaveButtonState();
}
