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
  renderYearTabs(tabs);
  if (tabs.length > 0) {
    loadSheet(tabs[tabs.length - 1]);
  }
}

function renderYearTabs(sheetNames) {
  const container = document.getElementById('year-tabs');
  container.innerHTML = '';
  sheetNames.forEach(name => {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.className = 'tab-btn';
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadSheet(name);
    });
    container.appendChild(btn);
  });
}

async function loadSheet(sheetName) {
  const loading = document.getElementById('loading');
  const summarySection = document.getElementById('summary-section');
  const matrixSection = document.getElementById('matrix-section');

  loading.classList.remove('hidden');
  summarySection.classList.add('hidden');
  matrixSection.classList.add('hidden');

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === sheetName);
  });

  const rawData = await fetchSheetData(sheetName);
  const { dates, players } = parseSheetData(rawData);

  loading.classList.add('hidden');
  summarySection.classList.remove('hidden');
  matrixSection.classList.remove('hidden');

  renderSummaryCards(players);
  renderMatrix(dates, players);
}

function renderSummaryCards(players) {
  const container = document.getElementById('summary-cards');
  const sorted = [...players].sort((a, b) => b.totalScore - a.totalScore);

  container.innerHTML = sorted.map((p, i) => `
    <div class="card">
      <span class="rank">${i + 1}위</span>
      <strong class="name">${p.name}</strong>
      <span class="number">#${p.number}</span>
      <span class="score">${p.totalScore}점</span>
      <span class="attend">출석 ${p.attendCount}회</span>
    </div>
  `).join('');
}

function renderMatrix(dates, players) {
  const table = document.getElementById('matrix-table');

  const headerRow = '<tr><th>이름</th><th>No.</th>'
    + dates.map(d => `<th>${d}</th>`).join('')
    + '<th>합계</th></tr>';

  const bodyRows = players.map(p => {
    const cells = p.scores.map(s =>
      `<td class="${s !== null ? 'present' : 'absent'}">${s !== null ? s : '-'}</td>`
    ).join('');
    return `<tr><td class="name-cell">${p.name}</td><td class="number-cell">${p.number}</td>${cells}<td class="total">${p.totalScore}</td></tr>`;
  }).join('');

  table.innerHTML = `<thead>${headerRow}</thead><tbody>${bodyRows}</tbody>`;
}

// =====================
// 관리자 페이지 (admin.html)
// =====================

let cachedPasswordHash = '';
let currentSheetData = null; // 기존 데이터 수정용 캐시

async function initAdminPage() {
  const modal = document.getElementById('auth-modal');
  const panel = document.getElementById('admin-panel');

  if (AdminSession.check()) {
    modal.classList.add('hidden');
    panel.classList.remove('hidden');
    await loadAdminData();
    return;
  }

  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('password-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('sheet-select').addEventListener('change', handleSheetChange);
  document.getElementById('date-select').addEventListener('change', handleDateSelect);
  document.getElementById('save-btn').addEventListener('click', handleSave);
}

async function handleLogin() {
  const input = document.getElementById('password-input');
  const error = document.getElementById('auth-error');
  const password = input.value;

  const valid = await verifyAdmin(password);
  if (valid) {
    cachedPasswordHash = await sha256(password);
    AdminSession.set();
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
  AdminSession.clear();
  cachedPasswordHash = '';
  document.getElementById('auth-modal').classList.remove('hidden');
  document.getElementById('admin-panel').classList.add('hidden');
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
  dateSelect.innerHTML = '<option value="">-- 새 날짜 입력 --</option>'
    + dates.map(d => `<option value="${d}">${d}</option>`).join('');

  document.getElementById('date-input').value = '';
  document.getElementById('date-input').disabled = false;

  renderPlayerInputs(players, null);
}

function handleDateSelect() {
  const dateSelect = document.getElementById('date-select');
  const dateInput = document.getElementById('date-input');

  if (dateSelect.value) {
    dateInput.value = dateSelect.value;
    dateInput.disabled = true;

    // 기존 데이터 수정 모드: 선택한 날짜의 점수를 input에 채우기
    if (currentSheetData) {
      const dateIdx = currentSheetData.dates.indexOf(dateSelect.value);
      renderPlayerInputs(currentSheetData.players, dateIdx);
    }
  } else {
    dateInput.value = '';
    dateInput.disabled = false;
    dateInput.focus();
    // 새 날짜: 기본값으로 초기화
    if (currentSheetData) {
      renderPlayerInputs(currentSheetData.players, null);
    }
  }
}

function renderPlayerInputs(players, existingDateIdx) {
  const container = document.getElementById('player-list');
  container.innerHTML = players.map(p => {
    let value = CONFIG.DEFAULT_SCORE;
    let isAbsent = false;

    if (existingDateIdx !== null && existingDateIdx >= 0) {
      const existing = p.scores[existingDateIdx];
      if (existing !== null) {
        value = existing;
      } else {
        value = '';
        isAbsent = true;
      }
    }

    return `
    <div class="player-input">
      <label><span class="player-number">#${p.number}</span> ${p.name}</label>
      <input type="number" data-player="${p.name}" value="${value}" min="0" max="10">
      <button class="btn-absent" onclick="this.previousElementSibling.value=''">${isAbsent ? '결석' : '결석'}</button>
    </div>
  `;
  }).join('');
}

async function handleSave() {
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('save-status');
  const sheetName = document.getElementById('sheet-select').value;
  const date = document.getElementById('date-input').value.trim();

  if (!date) {
    status.textContent = '날짜를 입력해주세요.';
    status.className = 'error';
    status.classList.remove('hidden');
    return;
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
    status.textContent = '세션이 만료되었습니다. 다시 로그인해주세요.';
    status.className = 'error';
    saveBtn.disabled = false;
    handleLogout();
    return;
  }

  const result = await submitScores({
    sheetName,
    date,
    entries,
    passwordHash: cachedPasswordHash,
  });

  if (result.success) {
    status.textContent = `${result.updated}명의 점수가 저장되었습니다.`;
    status.className = 'success';
    await handleSheetChange();
  } else {
    status.textContent = `저장 실패: ${result.error}`;
    status.className = 'error';
  }

  saveBtn.disabled = false;
}
