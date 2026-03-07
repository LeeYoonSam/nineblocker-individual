import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  const appPath = path.resolve(__dirname, '../src/js/app.js');
  let code = fs.readFileSync(appPath, 'utf-8');

  // DOMContentLoaded 리스너 제거
  code = code.replace(
    /document\.addEventListener\('DOMContentLoaded'.*?\n\}\);/s,
    '// removed for testing'
  );

  // cachedPasswordHash를 mock 값으로 초기화
  code = code.replace(
    "let cachedPasswordHash = '';",
    "let cachedPasswordHash = globalThis.cachedPasswordHash || '';"
  );

  // eval을 통해 전역 스코프에 함수 등록
  // eslint-disable-next-line no-eval
  globalThis.eval(code);
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
    document.getElementById('date-input').value = '2025-01-04';
    addPlayerInputs([{ name: 'A', number: 1, score: 5 }]);
    globalThis.cachedPasswordHash = '';

    const alertMock = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    let hrefSet = null;
    const originalLocation = window.location;
    delete window.location;
    window.location = {
      ...originalLocation,
      get href() { return 'http://localhost/admin.html'; },
      set href(val) { hrefSet = val; },
    };

    loadAppFunctions();
    await handleSave();
    expect(alertMock).toHaveBeenCalledWith('세션이 만료되었습니다. 다시 로그인해주세요.');
    expect(hrefSet).toBe('index.html');

    alertMock.mockRestore();
    window.location = originalLocation;
  });
});

function loadAuthFunctions() {
  const authPath = path.resolve(__dirname, '../src/js/auth.js');
  let authCode = fs.readFileSync(authPath, 'utf-8');
  // const를 globalThis 할당으로 변환
  authCode = authCode.replace('const SESSION_DURATION', 'globalThis.SESSION_DURATION');
  authCode = authCode.replace('const AdminSession', 'globalThis.AdminSession');
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
