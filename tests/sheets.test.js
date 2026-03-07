import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function setupGlobals() {
  globalThis.CONFIG = {
    DEMO_MODE: true,
    SHEET_ID: '__TEST__',
    API_KEY: '__TEST__',
    DEFAULT_SCORE: 5,
  };
  globalThis.showError = vi.fn();
  globalThis.fetch = vi.fn();
}

// 파일 읽기를 모듈 스코프에서 1회만 수행
const sheetsCode = fs.readFileSync(path.resolve(__dirname, '../src/js/sheets.js'), 'utf-8');

function loadSheetsFunctions() {
  globalThis.eval(sheetsCode);
}

describe('findHeaderRow', () => {
  beforeEach(() => {
    setupGlobals();
    loadSheetsFunctions();
  });

  it("'이름'이 첫 행에 있는 경우 0 반환", () => {
    const rows = [
      ['이름', '넘버', '개인 승점', '실시간 순위', '1/4'],
      ['김돈규', 4, 6, 1, 3],
    ];
    expect(findHeaderRow(rows)).toBe(0);
  });

  it("'이름'이 두 번째 행에 있는 경우 1 반환", () => {
    const rows = [
      ['', '', '', '', '참석: 2점'],
      ['이름', '넘버', '개인 승점', '실시간 순위', '8/2'],
      ['남궁현', '11', 47, 1, 2],
    ];
    expect(findHeaderRow(rows)).toBe(1);
  });

  it('5행 내에 없으면 0 반환', () => {
    const rows = [
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
      ['g', 'h'],
      ['i', 'j'],
      ['이름', '넘버'],
    ];
    expect(findHeaderRow(rows)).toBe(0);
  });
});

describe('parseSheetData', () => {
  beforeEach(() => {
    setupGlobals();
    loadSheetsFunctions();
  });

  it('빈 데이터 시 빈 결과 반환', () => {
    expect(parseSheetData(null)).toEqual({ dates: [], players: [] });
    expect(parseSheetData([])).toEqual({ dates: [], players: [] });
    expect(parseSheetData([['이름']])).toEqual({ dates: [], players: [] });
  });

  it('정상 데이터에서 players/dates 올바르게 파싱', () => {
    const raw = [
      ['이름', '넘버', '개인 승점', '실시간 순위', '1/4', '1/7'],
      ['김돈규', 4, 6, 1, 3, 3],
      ['김정호', '32', 3, 2, 3, ''],
    ];
    const { dates, players } = parseSheetData(raw);

    expect(dates).toEqual(['1/4', '1/7']);
    expect(players).toHaveLength(2);
    expect(players[0].name).toBe('김돈규');
    expect(players[0].number).toBe(4);
    expect(players[1].name).toBe('김정호');
    expect(players[1].number).toBe('32');
  });

  it('빈 셀 -> null, 숫자 셀 -> Number 변환', () => {
    const raw = [
      ['이름', '넘버', '개인 승점', '실시간 순위', '1/4', '1/7'],
      ['김돈규', 4, 6, 1, 3, ''],
      ['김정호', '32', 3, 2, '', 3],
    ];
    const { players } = parseSheetData(raw);

    // 김돈규: 1/4=3, 1/7=null
    expect(players[0].scores[0]).toBe(3);
    expect(players[0].scores[1]).toBeNull();
    // 김정호: 1/4=null, 1/7=3
    expect(players[1].scores[0]).toBeNull();
    expect(players[1].scores[1]).toBe(3);
  });

  it('totalScore, attendCount 정확히 계산', () => {
    const raw = [
      ['이름', '넘버', '개인 승점', '실시간 순위', '1/4', '1/7', '1/11'],
      ['김돈규', 4, 8, 1, 3, '', 5],
    ];
    const { players } = parseSheetData(raw);

    expect(players[0].totalScore).toBe(8);
    expect(players[0].attendCount).toBe(2);
  });

  it('데이터 없는 날짜 필터링', () => {
    const raw = [
      ['이름', '넘버', '개인 승점', '실시간 순위', '1/4', '1/7', '1/11'],
      ['김돈규', 4, 3, 1, 3, '', ''],
      ['김정호', '32', 0, 2, '', '', ''],
    ];
    const { dates } = parseSheetData(raw);

    // 1/7, 1/11은 모든 플레이어가 빈 값이므로 필터링됨
    expect(dates).toEqual(['1/4']);
  });

  it('빈 날짜 헤더 필터링', () => {
    const raw = [
      ['이름', '넘버', '개인 승점', '실시간 순위', '1/4', '', '1/11'],
      ['김돈규', 4, 6, 1, 3, 3, 3],
    ];
    const { dates } = parseSheetData(raw);

    // 빈 헤더는 필터링
    expect(dates).toEqual(['1/4', '1/11']);
  });

  it('첫 행이 설명행인 경우 헤더 자동 감지 (22-08 시트)', () => {
    const raw = [
      ['', '', '', '', '참석: 2점, 경기 승리당: 1점'],
      ['이름', '넘버', '개인 승점', '실시간 순위', '8/2', '8/9'],
      ['남궁현', '11', 47, 1, 2, 2],
      ['김동광', '30', 43, 2, '', 2],
    ];
    const { dates, players } = parseSheetData(raw);

    expect(dates).toEqual(['8/2', '8/9']);
    expect(players).toHaveLength(2);
    expect(players[0].name).toBe('남궁현');
    expect(players[0].scores).toEqual([2, 2]);
  });

  it('이름이 빈 행은 무시', () => {
    const raw = [
      ['이름', '넘버', '개인 승점', '실시간 순위', '1/4'],
      ['김돈규', 4, 3, 1, 3],
      ['', '', '', '', ''],
      ['김정호', '32', 3, 2, 3],
    ];
    const { players } = parseSheetData(raw);

    expect(players).toHaveLength(2);
  });
});
