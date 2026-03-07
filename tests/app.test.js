import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 파일 읽기를 모듈 스코프에서 1회만 수행
const appPath = path.resolve(__dirname, '../src/js/app.js');
const appCode = fs.readFileSync(appPath, 'utf-8')
  .replace(
    /document\.addEventListener\('DOMContentLoaded'.*?\n\}\);/s,
    '// removed for testing'
  )
  .replace(
    "let cachedPasswordHash = '';",
    "let cachedPasswordHash = globalThis.cachedPasswordHash || '';"
  );

const authPath = path.resolve(__dirname, '../src/js/auth.js');
const authCode = fs.readFileSync(authPath, 'utf-8')
  .replace('const SESSION_DURATION', 'globalThis.SESSION_DURATION')
  .replace('const AdminSession', 'globalThis.AdminSession');

function setupDOM() {
  document.body.innerHTML = `
    <div id="auth-modal" class="modal hidden">
      <input type="password" id="password-input">
      <button id="login-btn">로그인</button>
      <p id="auth-error" class="error hidden"></p>
    </div>
    <div id="admin-panel" class="hidden">
      <select id="sheet-select"><option value="2025">2025</option></select>
      <div class="mode-selector">
        <label><input type="radio" name="entry-mode" value="new" checked> 새로운 기록 추가</label>
        <label><input type="radio" name="entry-mode" value="edit"> 기존 기록 수정</label>
      </div>
      <div id="new-date-group">
        <input type="date" id="date-input">
      </div>
      <div id="edit-date-group" class="hidden">
        <select id="date-select"><option value="">-- 날짜 선택 --</option></select>
      </div>
      <input type="text" id="player-search">
      <div id="player-list"></div>
      <button id="save-btn" class="btn-primary" disabled>저장</button>
      <p id="save-status" class="hidden"></p>
    </div>
  `;
}

function addPlayerInputs(players) {
  const list = document.getElementById('player-list');
  list.innerHTML = players.map(p =>
    `<div class="player-input" data-name="${p.name}">
      <span class="player-number">#${p.number}</span>
      <span>${p.name}</span>
      <input type="number" data-player="${p.name}" value="${p.score ?? ''}">
    </div>`
  ).join('');
}

function setupGlobals() {
  globalThis.SHEET_ID = '__SHEET_ID__';
  globalThis.APPS_SCRIPT_URL = '__APPS_SCRIPT_URL__';
  globalThis.DEMO_MODE = true;
  globalThis.fetchSheetNames = vi.fn().mockResolvedValue(['2025']);
  globalThis.fetchSheetData = vi.fn().mockResolvedValue({ players: [], dates: [], scores: {} });
  globalThis.parseSheetData = vi.fn().mockReturnValue({ players: [{ name: 'Player1', number: 1, scores: [5] }, { name: 'Player2', number: 2, scores: [3] }], dates: ['1/4'], scores: {} });
  globalThis.submitScores = vi.fn().mockResolvedValue({ success: true, updated: 3 });
  globalThis.cachedPasswordHash = 'mock-hash';
  globalThis.verifyPassword = vi.fn().mockResolvedValue(true);
  globalThis.handleLogout = vi.fn();
  globalThis.AdminSession = { set: vi.fn(), clear: vi.fn(), check: vi.fn(() => true) };
  globalThis.currentSheetData = { players: [{ name: 'Player1', number: 1, scores: [5], totalScore: 5, attendCount: 1 }, { name: 'Player2', number: 2, scores: [3], totalScore: 3, attendCount: 1 }], dates: ['1/4'] };
  globalThis.CONFIG = { DEFAULT_SCORE: 5 };
}

function loadAppFunctions() {
  globalThis.eval(appCode);
}

describe('updateSaveButtonState', () => {
  beforeEach(() => {
    setupDOM();
    setupGlobals();
    loadAppFunctions();
  });

  it('날짜 미입력 시 저장 버튼 disabled', () => {
    document.getElementById('date-input').value = '';
    addPlayerInputs([{ name: 'A', number: 1, score: 5 }]);

    updateSaveButtonState();

    expect(document.getElementById('save-btn').disabled).toBe(true);
  });

  it('날짜 입력 + 점수 0명 → disabled', () => {
    document.getElementById('date-input').value = '2025-01-04';
    addPlayerInputs([
      { name: 'A', number: 1, score: '' },
      { name: 'B', number: 2, score: '' },
    ]);

    updateSaveButtonState();

    expect(document.getElementById('save-btn').disabled).toBe(true);
  });

  it('날짜 입력 + 점수 1명 이상 → enabled', () => {
    document.getElementById('date-input').value = '2025-01-04';
    addPlayerInputs([
      { name: 'A', number: 1, score: 5 },
      { name: 'B', number: 2, score: '' },
    ]);

    updateSaveButtonState();

    expect(document.getElementById('save-btn').disabled).toBe(false);
  });

  it('기존 기록 모드 + 날짜 선택 + 점수 1명 → enabled', () => {
    document.querySelector('input[name="entry-mode"][value="edit"]').checked = true;
    document.querySelector('input[name="entry-mode"][value="new"]').checked = false;

    const dateSelect = document.getElementById('date-select');
    dateSelect.innerHTML = '<option value="1/4">1/4</option>';
    dateSelect.value = '1/4';

    addPlayerInputs([
      { name: 'A', number: 1, score: 3 },
      { name: 'B', number: 2, score: '' },
    ]);

    updateSaveButtonState();

    expect(document.getElementById('save-btn').disabled).toBe(false);
  });

  it('전원 결석 (전원 빈 점수) → disabled', () => {
    document.getElementById('date-input').value = '2025-01-04';
    addPlayerInputs([
      { name: 'A', number: 1, score: '' },
      { name: 'B', number: 2, score: '' },
      { name: 'C', number: 3, score: '' },
    ]);

    updateSaveButtonState();

    expect(document.getElementById('save-btn').disabled).toBe(true);
  });

  it('선수 목록 비어있을 때 → disabled', () => {
    document.getElementById('date-input').value = '2025-01-04';
    // player-list를 비워둠 (addPlayerInputs 호출 안 함)
    updateSaveButtonState();
    expect(document.getElementById('save-btn').disabled).toBe(true);
  });

  it('출석 버튼으로 점수 채워지면 상태 갱신', () => {
    document.getElementById('date-input').value = '2025-01-04';
    addPlayerInputs([
      { name: 'A', number: 1, score: '' },
      { name: 'B', number: 2, score: '' },
    ]);

    updateSaveButtonState();
    expect(document.getElementById('save-btn').disabled).toBe(true);

    document.querySelector('input[data-player="A"]').value = '5';
    updateSaveButtonState();
    expect(document.getElementById('save-btn').disabled).toBe(false);
  });
});

describe('handleEntryModeChange', () => {
  beforeEach(() => {
    setupDOM();
    setupGlobals();
    loadAppFunctions();
  });

  it('기존 기록 수정 → 새로운 기록 추가 전환 시 날짜 입력 초기화', () => {
    const dateInput = document.getElementById('date-input');
    dateInput.value = '2025-01-04';
    dateInput.disabled = true;

    document.querySelector('input[name="entry-mode"][value="new"]').checked = true;
    document.querySelector('input[name="entry-mode"][value="edit"]').checked = false;
    handleEntryModeChange();

    expect(dateInput.value).toBe('');
    expect(dateInput.disabled).toBe(false);
  });

  it('새로운 기록 추가 → 기존 기록 수정 전환 시 날짜 선택 초기화', () => {
    const dateSelect = document.getElementById('date-select');
    dateSelect.innerHTML = '<option value="">-- 날짜 선택 --</option><option value="1/4">1/4</option>';
    dateSelect.value = '1/4';

    document.querySelector('input[name="entry-mode"][value="edit"]').checked = true;
    document.querySelector('input[name="entry-mode"][value="new"]').checked = false;
    handleEntryModeChange();

    expect(dateSelect.value).toBe('');
  });
});

describe('handleSheetChange', () => {
  beforeEach(() => {
    setupDOM();
    setupGlobals();
    loadAppFunctions();
  });

  it('연도 변경 시 모드가 새 기록 추가로 리셋', async () => {
    // edit 모드로 설정
    document.querySelector('input[name="entry-mode"][value="edit"]').checked = true;
    document.querySelector('input[name="entry-mode"][value="new"]').checked = false;
    document.getElementById('new-date-group').classList.add('hidden');
    document.getElementById('edit-date-group').classList.remove('hidden');

    await handleSheetChange();

    const newRadio = document.querySelector('input[name="entry-mode"][value="new"]');
    expect(newRadio.checked).toBe(true);
    expect(document.getElementById('new-date-group').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('edit-date-group').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('date-input').value).toBe('');
    expect(document.getElementById('date-input').disabled).toBe(false);
  });
});

describe('handleSave', () => {
  beforeEach(() => {
    setupDOM();
    setupGlobals();
    loadAppFunctions();
    // app.js의 let cachedPasswordHash = '' 재선언 이후 덮어쓰기
    globalThis.cachedPasswordHash = 'mock-hash';
  });

  it('성공 시 alert 호출 + location.href 변경', async () => {
    document.getElementById('date-input').value = '2025-01-04';
    addPlayerInputs([{ name: 'A', number: 1, score: 5 }]);

    globalThis.submitScores = vi.fn().mockResolvedValue({ success: true, updated: 1 });

    const alertMock = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});

    let hrefSet = null;
    const originalLocation = window.location;
    delete window.location;
    window.location = {
      ...originalLocation,
      get href() { return 'http://localhost/admin.html'; },
      set href(val) { hrefSet = val; },
    };

    await handleSave();

    expect(alertMock).toHaveBeenCalledWith('1명의 점수가 저장되었습니다.');
    expect(hrefSet).toBe('index.html');

    alertMock.mockRestore();
    window.location = originalLocation;
  });

  it('실패 시 에러 메시지 표시 + 버튼 상태 복원', async () => {
    document.getElementById('date-input').value = '2025-01-04';
    addPlayerInputs([{ name: 'A', number: 1, score: 5 }]);

    globalThis.submitScores = vi.fn().mockResolvedValue({ success: false, error: '서버 오류' });

    await handleSave();

    const status = document.getElementById('save-status');
    expect(status.textContent).toBe('저장 실패: 서버 오류');
    expect(status.className).toBe('error');
    expect(document.getElementById('save-btn').disabled).toBe(false);
  });

  it('날짜 미입력 시 에러 메시지 표시 후 리턴', async () => {
    document.getElementById('date-input').value = '';
    addPlayerInputs([{ name: 'A', number: 1, score: 5 }]);
    await handleSave();
    const status = document.getElementById('save-status');
    expect(status.textContent).toBe('날짜를 입력해주세요.');
    expect(status.className).toBe('error');
    expect(globalThis.submitScores).not.toHaveBeenCalled();
  });

  it('세션 만료 시 handleSessionExpired 호출', async () => {
    // cachedPasswordHash를 빈 문자열로 재설정하여 재로드
    globalThis.cachedPasswordHash = '';
    loadAppFunctions();

    document.getElementById('date-input').value = '2025-01-04';
    addPlayerInputs([{ name: 'A', number: 1, score: 5 }]);

    const alertMock = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    let hrefSet = null;
    const originalLocation = window.location;
    delete window.location;
    window.location = {
      ...originalLocation,
      get href() { return 'http://localhost/admin.html'; },
      set href(val) { hrefSet = val; },
    };

    await handleSave();
    expect(alertMock).toHaveBeenCalledWith('세션이 만료되었습니다. 다시 로그인해주세요.');
    expect(hrefSet).toBe('index.html');

    alertMock.mockRestore();
    window.location = originalLocation;
  });
});

function loadAuthFunctions() {
  globalThis.eval(authCode);
}

describe('AdminSession 만료', () => {
  beforeEach(() => {
    sessionStorage.clear();
    loadAuthFunctions();
  });

  it('만료 시간 이전이면 check()가 true 반환', () => {
    AdminSession.set();
    expect(AdminSession.check()).toBe(true);
  });

  it('만료 시간 이후면 check()가 false 반환', () => {
    AdminSession.set();
    // 만료 시간을 과거로 설정
    sessionStorage.setItem('admin_expires', String(Date.now() - 1000));
    expect(AdminSession.check()).toBe(false);
  });

  it('admin 키가 없으면 check()가 false 반환', () => {
    expect(AdminSession.check()).toBe(false);
  });

  it('clear() 호출 시 admin과 admin_expires 모두 제거', () => {
    AdminSession.set();
    expect(sessionStorage.getItem('admin')).toBe('1');
    expect(sessionStorage.getItem('admin_expires')).not.toBeNull();

    AdminSession.clear();
    expect(sessionStorage.getItem('admin')).toBeNull();
    expect(sessionStorage.getItem('admin_expires')).toBeNull();
  });
});

// =====================
// 조회 페이지 함수 테스트
// =====================

function setupIndexDOM() {
  document.body.innerHTML = `
    <div id="year-tabs"></div>
    <button id="sheet-selector-btn"></button>
    <div id="sheet-dropdown"></div>
    <div id="loading" class="hidden"></div>
    <div id="summary-section" class="hidden">
      <div id="summary-cards"></div>
    </div>
    <div id="matrix-section" class="hidden">
      <table id="matrix-table"></table>
    </div>
    <input type="text" id="player-search">
  `;
}

describe('initIndexPage - 시트 선택 유지', () => {
  let mockStorage;

  beforeEach(() => {
    setupIndexDOM();
    setupGlobals();
    mockStorage = {};
    globalThis.localStorage = {
      getItem: vi.fn(key => mockStorage[key] ?? null),
      setItem: vi.fn((key, val) => { mockStorage[key] = String(val); }),
      removeItem: vi.fn(key => { delete mockStorage[key]; }),
    };
  });

  it('저장된 시트가 탭 목록에 있으면 해당 시트 로드', async () => {
    globalThis.fetchSheetNames = vi.fn().mockResolvedValue(['2024', '2025']);
    globalThis.fetchSheetData = vi.fn().mockResolvedValue({});
    globalThis.parseSheetData = vi.fn().mockReturnValue({ dates: [], players: [] });
    mockStorage.selectedSheet = '2024';

    loadAppFunctions();
    await initIndexPage();

    expect(globalThis.fetchSheetData).toHaveBeenCalledWith('2024');
  });

  it('저장된 시트가 탭 목록에 없으면 마지막 시트 로드', async () => {
    globalThis.fetchSheetNames = vi.fn().mockResolvedValue(['2024', '2025']);
    globalThis.fetchSheetData = vi.fn().mockResolvedValue({});
    globalThis.parseSheetData = vi.fn().mockReturnValue({ dates: [], players: [] });
    mockStorage.selectedSheet = '2023';

    loadAppFunctions();
    await initIndexPage();

    expect(globalThis.fetchSheetData).toHaveBeenCalledWith('2025');
  });

  it('저장된 시트가 없으면 마지막 시트 로드', async () => {
    globalThis.fetchSheetNames = vi.fn().mockResolvedValue(['2024', '2025']);
    globalThis.fetchSheetData = vi.fn().mockResolvedValue({});
    globalThis.parseSheetData = vi.fn().mockReturnValue({ dates: [], players: [] });

    loadAppFunctions();
    await initIndexPage();

    expect(globalThis.fetchSheetData).toHaveBeenCalledWith('2025');
  });

  it('loadSheet 호출 시 localStorage에 시트 이름 저장', async () => {
    globalThis.fetchSheetData = vi.fn().mockResolvedValue({});
    globalThis.parseSheetData = vi.fn().mockReturnValue({ dates: [], players: [] });

    loadAppFunctions();
    await loadSheet('2024');

    expect(mockStorage.selectedSheet).toBe('2024');
  });
});

describe('assignRanks', () => {
  beforeEach(() => {
    setupGlobals();
    loadAppFunctions();
  });

  it('점수 내림차순 정렬된 배열에 올바른 rank 부여', () => {
    const players = [
      { name: 'A', totalScore: 10 },
      { name: 'B', totalScore: 7 },
      { name: 'C', totalScore: 3 },
    ];
    const ranked = assignRanks(players);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].rank).toBe(3);
  });

  it('동점자 동일 rank 부여', () => {
    const players = [
      { name: 'A', totalScore: 10 },
      { name: 'B', totalScore: 10 },
      { name: 'C', totalScore: 5 },
    ];
    const ranked = assignRanks(players);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1);
    expect(ranked[2].rank).toBe(3);
  });

  it('단일 플레이어', () => {
    const players = [{ name: 'A', totalScore: 5 }];
    const ranked = assignRanks(players);
    expect(ranked[0].rank).toBe(1);
  });
});

describe('getMedalEmoji', () => {
  beforeEach(() => {
    setupGlobals();
    loadAppFunctions();
  });

  it('rank 1 -> 금메달', () => {
    expect(getMedalEmoji(1)).toBe('\u{1F947} ');
  });

  it('rank 2 -> 은메달', () => {
    expect(getMedalEmoji(2)).toBe('\u{1F948} ');
  });

  it('rank 3 -> 동메달', () => {
    expect(getMedalEmoji(3)).toBe('\u{1F949} ');
  });

  it('rank 4 이상 -> 빈 문자열', () => {
    expect(getMedalEmoji(4)).toBe('');
    expect(getMedalEmoji(10)).toBe('');
  });
});

describe('getMedalClass', () => {
  beforeEach(() => {
    setupGlobals();
    loadAppFunctions();
  });

  it('rank 1 -> card-gold', () => {
    expect(getMedalClass(1)).toBe(' card-gold');
  });

  it('rank 2 -> card-silver', () => {
    expect(getMedalClass(2)).toBe(' card-silver');
  });

  it('rank 3 -> card-bronze', () => {
    expect(getMedalClass(3)).toBe(' card-bronze');
  });

  it('rank 4 이상 -> 빈 문자열', () => {
    expect(getMedalClass(4)).toBe('');
  });
});

describe('sheetDateToISO', () => {
  beforeEach(() => {
    setupGlobals();
    loadAppFunctions();
  });

  it('"1/4" -> "YYYY-01-04"', () => {
    const year = new Date().getFullYear();
    expect(sheetDateToISO('1/4')).toBe(`${year}-01-04`);
  });

  it('"12/25" -> "YYYY-12-25"', () => {
    const year = new Date().getFullYear();
    expect(sheetDateToISO('12/25')).toBe(`${year}-12-25`);
  });

  it('"1월 6일" -> "YYYY-01-06"', () => {
    const year = new Date().getFullYear();
    expect(sheetDateToISO('1월 6일')).toBe(`${year}-01-06`);
  });

  it('"12월 25일" -> "YYYY-12-25"', () => {
    const year = new Date().getFullYear();
    expect(sheetDateToISO('12월 25일')).toBe(`${year}-12-25`);
  });

  it('인식 불가 포맷 -> ""', () => {
    expect(sheetDateToISO('2025-01-04')).toBe('');
    expect(sheetDateToISO('invalid')).toBe('');
  });
});

describe('isoToSheetDate', () => {
  beforeEach(() => {
    setupGlobals();
    loadAppFunctions();
  });

  it("formatHint에 '월' 포함 -> 'M월 D일' 포맷", () => {
    expect(isoToSheetDate('2025-01-06', '1월 6일')).toBe('1월 6일');
    expect(isoToSheetDate('2025-12-25', '3월 1일')).toBe('12월 25일');
  });

  it("formatHint 없음 -> 'M/D' 포맷", () => {
    expect(isoToSheetDate('2025-01-04', '1/4')).toBe('1/4');
    expect(isoToSheetDate('2025-12-25', '')).toBe('12/25');
    expect(isoToSheetDate('2025-01-04')).toBe('1/4');
  });

  it('빈 입력 -> ""', () => {
    expect(isoToSheetDate('', '1/4')).toBe('');
    expect(isoToSheetDate(null)).toBe('');
    expect(isoToSheetDate(undefined)).toBe('');
  });
});

describe('renderSummaryCards', () => {
  beforeEach(() => {
    setupIndexDOM();
    setupGlobals();
    loadAppFunctions();
  });

  it('상위 10명 카드 렌더링, 점수 0인 플레이어 제외', () => {
    const players = [];
    for (let i = 1; i <= 12; i++) {
      players.push({ name: `P${i}`, number: i, scores: [i], totalScore: i, attendCount: 1 });
    }
    players.push({ name: 'Zero', number: 0, scores: [0], totalScore: 0, attendCount: 0 });

    renderSummaryCards(players);

    const cards = document.querySelectorAll('#summary-cards .card');
    expect(cards.length).toBe(10);
    // 점수 0인 플레이어 제외 확인
    const names = Array.from(cards).map(c => c.dataset.playerName);
    expect(names).not.toContain('Zero');
  });

  it('메달 클래스 정확히 적용', () => {
    const players = [
      { name: 'A', number: 1, scores: [10], totalScore: 10, attendCount: 1 },
      { name: 'B', number: 2, scores: [7], totalScore: 7, attendCount: 1 },
      { name: 'C', number: 3, scores: [5], totalScore: 5, attendCount: 1 },
      { name: 'D', number: 4, scores: [3], totalScore: 3, attendCount: 1 },
    ];

    renderSummaryCards(players);

    const cards = document.querySelectorAll('#summary-cards .card');
    expect(cards[0].classList.contains('card-gold')).toBe(true);
    expect(cards[1].classList.contains('card-silver')).toBe(true);
    expect(cards[2].classList.contains('card-bronze')).toBe(true);
    expect(cards[3].classList.contains('card-gold')).toBe(false);
    expect(cards[3].classList.contains('card-silver')).toBe(false);
    expect(cards[3].classList.contains('card-bronze')).toBe(false);
  });
});

describe('renderMatrix', () => {
  beforeEach(() => {
    setupIndexDOM();
    setupGlobals();
    loadAppFunctions();
  });

  it('테이블 헤더에 날짜 역순 표시', () => {
    const dates = ['1/4', '1/7', '1/11'];
    const players = [
      { name: 'A', number: 1, scores: [3, 2, 1], totalScore: 6, attendCount: 3 },
    ];

    renderMatrix(dates, players);

    const ths = document.querySelectorAll('#matrix-table thead th.date-col');
    const headerTexts = Array.from(ths).map(th => th.textContent);
    expect(headerTexts).toEqual(['1/11', '1/7', '1/4']);
  });

  it('플레이어 행에 점수/결석 표시', () => {
    const dates = ['1/4', '1/7'];
    const players = [
      { name: 'A', number: 1, scores: [3, null], totalScore: 3, attendCount: 1 },
    ];

    renderMatrix(dates, players);

    const tds = document.querySelectorAll('#matrix-table tbody td.date-col');
    // 역순: 1/7(null) -> 1/4(3)
    expect(tds[0].textContent).toBe('-');
    expect(tds[0].classList.contains('absent')).toBe(true);
    expect(tds[1].textContent).toBe('3');
    expect(tds[1].classList.contains('present')).toBe(true);
  });

  it('sticky 컬럼 클래스 적용', () => {
    const dates = ['1/4'];
    const players = [
      { name: 'A', number: 1, scores: [3], totalScore: 3, attendCount: 1 },
    ];

    renderMatrix(dates, players);

    expect(document.querySelector('th.sticky-rank')).not.toBeNull();
    expect(document.querySelector('th.sticky-name')).not.toBeNull();
    expect(document.querySelector('th.sticky-number')).not.toBeNull();
    expect(document.querySelector('th.sticky-total')).not.toBeNull();
    expect(document.querySelector('td.sticky-rank')).not.toBeNull();
    expect(document.querySelector('td.sticky-name')).not.toBeNull();
    expect(document.querySelector('td.sticky-total')).not.toBeNull();
  });
});

describe('highlightMatrixRow', () => {
  beforeEach(() => {
    setupIndexDOM();
    setupGlobals();
    loadAppFunctions();

    const dates = ['1/4'];
    const players = [
      { name: 'A', number: 1, scores: [3], totalScore: 3, attendCount: 1 },
      { name: 'B', number: 2, scores: [2], totalScore: 2, attendCount: 1 },
    ];
    renderMatrix(dates, players);
  });

  it('행 하이라이트 추가', () => {
    const rows = document.querySelectorAll('#matrix-table tbody tr');
    highlightMatrixRow(rows[0]);
    expect(rows[0].classList.contains('highlight')).toBe(true);
  });

  it('다른 행 하이라이트 시 기존 제거', () => {
    const rows = document.querySelectorAll('#matrix-table tbody tr');
    highlightMatrixRow(rows[0]);
    highlightMatrixRow(rows[1]);
    expect(rows[0].classList.contains('highlight')).toBe(false);
    expect(rows[1].classList.contains('highlight')).toBe(true);
  });

  it('toggle 모드 동작', () => {
    const rows = document.querySelectorAll('#matrix-table tbody tr');
    highlightMatrixRow(rows[0], true);
    expect(rows[0].classList.contains('highlight')).toBe(true);
    highlightMatrixRow(rows[0], true);
    expect(rows[0].classList.contains('highlight')).toBe(false);
  });
});

describe('handlePlayerSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupDOM();
    setupGlobals();
    loadAppFunctions();
    addPlayerInputs([
      { name: '김돈규', number: 4, score: 3 },
      { name: '김정호', number: 32, score: 3 },
      { name: '남궁현', number: 11, score: '' },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('이름 검색 시 매칭 플레이어만 표시', () => {
    const search = document.getElementById('player-search');
    search.value = '김돈';
    handlePlayerSearch();
    vi.advanceTimersByTime(300);
    const items = document.querySelectorAll('.player-input');
    const visible = Array.from(items).filter(el => el.style.display !== 'none');
    expect(visible.length).toBe(1);
    expect(visible[0].dataset.name).toBe('김돈규');
  });

  it('번호 검색 시 매칭 플레이어만 표시', () => {
    const search = document.getElementById('player-search');
    search.value = '32';
    handlePlayerSearch();
    vi.advanceTimersByTime(300);
    const items = document.querySelectorAll('.player-input');
    const visible = Array.from(items).filter(el => el.style.display !== 'none');
    expect(visible.length).toBe(1);
    expect(visible[0].dataset.name).toBe('김정호');
  });

  it('빈 검색어 -> 전체 표시', () => {
    const search = document.getElementById('player-search');
    search.value = '김돈';
    handlePlayerSearch();
    vi.advanceTimersByTime(300);

    search.value = '';
    handlePlayerSearch();
    vi.advanceTimersByTime(300);
    const items = document.querySelectorAll('.player-input');
    const visible = Array.from(items).filter(el => el.style.display !== 'none');
    expect(visible.length).toBe(3);
  });
});

describe('renderPlayerInputs', () => {
  beforeEach(() => {
    setupDOM();
    setupGlobals();
    loadAppFunctions();
  });

  it('기존 기록 수정 시 출석자 우선 정렬', () => {
    const players = [
      { name: 'A', number: 1, scores: [null, 3], totalScore: 3, attendCount: 1 },
      { name: 'B', number: 2, scores: [5, null], totalScore: 5, attendCount: 1 },
      { name: 'C', number: 3, scores: [null, null], totalScore: 0, attendCount: 0 },
    ];
    renderPlayerInputs(players, 1);

    const names = Array.from(document.querySelectorAll('.player-input')).map(el => el.dataset.name);
    // dateIdx=1에서 A(3점)가 출석, B와 C는 결석
    expect(names[0]).toBe('A');
  });

  it('새 기록 시 랭킹순(totalScore 내림차순) 정렬', () => {
    const players = [
      { name: 'Low', number: 1, scores: [], totalScore: 1, attendCount: 1 },
      { name: 'High', number: 2, scores: [], totalScore: 10, attendCount: 3 },
      { name: 'Mid', number: 3, scores: [], totalScore: 5, attendCount: 2 },
    ];
    renderPlayerInputs(players, null);

    const names = Array.from(document.querySelectorAll('.player-input')).map(el => el.dataset.name);
    expect(names[0]).toBe('High');
    expect(names[1]).toBe('Mid');
    expect(names[2]).toBe('Low');
  });

  it('기존 점수 값 올바르게 표시', () => {
    const players = [
      { name: 'A', number: 1, scores: [3, 5], totalScore: 8, attendCount: 2 },
      { name: 'B', number: 2, scores: [null, 2], totalScore: 2, attendCount: 1 },
    ];
    renderPlayerInputs(players, 0);

    const inputA = document.querySelector('input[data-player="A"]');
    const inputB = document.querySelector('input[data-player="B"]');
    expect(inputA.value).toBe('3');
    expect(inputB.value).toBe('');
  });
});

describe('handleSessionExpired', () => {
  beforeEach(() => {
    setupDOM();
    setupGlobals();
    // 실제 AdminSession 사용
    loadAuthFunctions();
    loadAppFunctions();
  });

  it('세션 정리 + alert + 조회 페이지로 리디렉션', () => {
    AdminSession.set();
    expect(AdminSession.check()).toBe(true);

    const alertMock = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    let hrefSet = null;
    const originalLocation = window.location;
    delete window.location;
    window.location = {
      ...originalLocation,
      get href() { return 'http://localhost/admin.html'; },
      set href(val) { hrefSet = val; },
    };

    handleSessionExpired();

    expect(alertMock).toHaveBeenCalledWith('세션이 만료되었습니다. 다시 로그인해주세요.');
    expect(hrefSet).toBe('index.html');
    expect(AdminSession.check()).toBe(false);

    alertMock.mockRestore();
    window.location = originalLocation;
  });
});
