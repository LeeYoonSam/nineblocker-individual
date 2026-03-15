import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const utilsCode = fs.readFileSync(path.resolve(__dirname, '../../src/v2/js/utils.js'), 'utf-8');
const sheetsCode = fs.readFileSync(path.resolve(__dirname, '../../src/v2/js/sheets.js'), 'utf-8');
const sheetsLeagueCode = fs.readFileSync(path.resolve(__dirname, '../../src/v2/js/sheets-league.js'), 'utf-8');

function setupGlobals() {
  globalThis.CONFIG = {
    DEMO_MODE: true,
    SHEET_ID: '__TEST__',
    API_KEY: '__TEST__',
    DEFAULT_SCORE: 3,
  };
  globalThis.showError = vi.fn();
  globalThis.fetch = vi.fn();
}

function loadFunctions() {
  globalThis.eval(utilsCode);
  globalThis.eval(sheetsCode);
  globalThis.eval(sheetsLeagueCode);
}

// --- 다중 탭 파싱 테스트 ---

describe('parseScoresTab', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('빈 데이터 시 빈 배열 반환', () => {
    expect(parseScoresTab(null)).toEqual([]);
    expect(parseScoresTab([])).toEqual([]);
    expect(parseScoresTab([['헤더']])).toEqual([]);
  });

  it('팀 그룹 헤더 기반으로 선수 팀 할당', () => {
    const raw = [
      ['팀', '이름', '번호', '1R', '2R', '참석수', '총득점', '랭킹', '평균득점', '평균득점랭킹'],
      ['A'],
      ['', '남궁현', 11, 20, 18, 2, 38, 1, 19.0, 1],
      ['', '김정호', 32, 15, 22, 2, 37, 2, 18.5, 2],
      ['B'],
      ['', '강재훈', 93, 18, 16, 2, 34, 3, 17.0, 3],
    ];
    const mapping = { team: 0, name: 1, number: 2, roundStart: 3 };

    const players = parseScoresTab(raw, mapping);

    expect(players).toHaveLength(3);
    expect(players[0].name).toBe('남궁현');
    expect(players[0].team).toBe('A');
    expect(players[0].number).toBe(11);
    expect(players[1].name).toBe('김정호');
    expect(players[1].team).toBe('A');
    expect(players[2].name).toBe('강재훈');
    expect(players[2].team).toBe('B');
  });

  it('요약 컬럼 (참석수, 총득점, 평균득점) 올바르게 파싱', () => {
    const raw = [
      ['팀', '이름', '번호', '1R', '참석수', '총득점', '랭킹', '평균득점', '평균득점랭킹'],
      ['A'],
      ['', '남궁현', 11, 20, 1, 20, 1, 20.0, 1],
    ];
    const mapping = { team: 0, name: 1, number: 2, roundStart: 3 };

    const players = parseScoresTab(raw, mapping);

    expect(players[0].attendance).toBe(1);
    expect(players[0].totalScore).toBe(20);
    expect(players[0].avgScore).toBe(20.0);
    expect(players[0].ranking).toBe(1);
  });

  it('라운드 득점 추출 (빈 라운드는 null)', () => {
    const raw = [
      ['팀', '이름', '번호', '1R', '2R', '3R', '참석수', '총득점', '랭킹', '평균득점', '평균득점랭킹'],
      ['A'],
      ['', '남궁현', 11, 20, '', 18, 2, 38, 1, 19.0, 1],
    ];
    const mapping = { team: 0, name: 1, number: 2, roundStart: 3 };

    const players = parseScoresTab(raw, mapping);

    expect(players[0].roundScores).toEqual([20, null, 18]);
  });

  it('빈 행 무시', () => {
    const raw = [
      ['팀', '이름', '번호', '1R', '참석수', '총득점', '랭킹', '평균득점', '평균득점랭킹'],
      ['A'],
      ['', '남궁현', 11, 20, 1, 20, 1, 20.0, 1],
      ['', '', '', '', '', '', '', '', ''],
      ['', '김정호', 32, 15, 1, 15, 2, 15.0, 2],
    ];
    const mapping = { team: 0, name: 1, number: 2, roundStart: 3 };

    const players = parseScoresTab(raw, mapping);
    expect(players).toHaveLength(2);
  });
});

describe('parseStatsTab', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('빈 데이터 시 빈 배열 반환', () => {
    expect(parseStatsTab(null)).toEqual([]);
    expect(parseStatsTab([])).toEqual([]);
    expect(parseStatsTab([['헤더']])).toEqual([]);
  });

  it('누적/평균 쌍으로 부가기록 파싱', () => {
    const raw = [
      ['이름', '번호', '리바운드누적', '리바운드평균', '어시누적', '어시평균'],
      ['남궁현', 11, 62, 6.2, 45, 4.5],
      ['김정호', 32, 55, 5.5, 38, 3.8],
    ];
    const mapping = { name: 0, number: 1, statsStart: 2 };

    const players = parseStatsTab(raw, mapping);

    expect(players).toHaveLength(2);
    expect(players[0].name).toBe('남궁현');
    expect(players[0].stats['리바운드']).toEqual({ cumulative: 62, average: 6.2 });
    expect(players[0].stats['어시']).toEqual({ cumulative: 45, average: 4.5 });
  });

  it('빈 값은 0으로 처리', () => {
    const raw = [
      ['이름', '번호', '리바운드누적', '리바운드평균'],
      ['남궁현', 11, '', ''],
    ];
    const mapping = { name: 0, number: 1, statsStart: 2 };

    const players = parseStatsTab(raw, mapping);

    expect(players[0].stats['리바운드']).toEqual({ cumulative: 0, average: 0 });
  });

  it('빈 이름 행은 무시', () => {
    const raw = [
      ['이름', '번호', '리바운드누적', '리바운드평균'],
      ['남궁현', 11, 62, 6.2],
      ['', '', '', ''],
      ['김정호', 32, 55, 5.5],
    ];
    const mapping = { name: 0, number: 1, statsStart: 2 };

    const players = parseStatsTab(raw, mapping);
    expect(players).toHaveLength(2);
  });
});

describe('mergeLeagueData', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('scores와 stats 데이터를 이름 기준으로 병합', () => {
    const scorePlayers = [
      { name: '남궁현', number: 11, team: 'A', attendance: 10, totalScore: 185, avgScore: 18.5, roundScores: [] },
      { name: '강재훈', number: 93, team: 'B', attendance: 10, totalScore: 195, avgScore: 19.5, roundScores: [] },
    ];
    const statPlayers = [
      { name: '남궁현', number: 11, stats: { '리바운드': { cumulative: 62, average: 6.2 }, '어시': { cumulative: 45, average: 4.5 } } },
      { name: '강재훈', number: 93, stats: { '리바운드': { cumulative: 70, average: 7.0 }, '어시': { cumulative: 42, average: 4.2 } } },
    ];
    const meta = { standings: [], awards: [], trades: [] };

    const { players } = mergeLeagueData(scorePlayers, statPlayers, meta);

    expect(players).toHaveLength(2);
    expect(players[0].name).toBe('남궁현');
    expect(players[0].team).toBe('A');
    expect(players[0].totalPoints).toBe(185);
    expect(players[0].stats['득점']).toEqual({ cumulative: 185, average: 18.5 });
    expect(players[0].stats['리바운드']).toEqual({ cumulative: 62, average: 6.2 });
    expect(players[0].stats['어시스트']).toEqual({ cumulative: 45, average: 4.5 });
  });

  it('stats에 없는 선수는 득점만 포함', () => {
    const scorePlayers = [
      { name: '남궁현', number: 11, team: 'A', attendance: 10, totalScore: 185, avgScore: 18.5, roundScores: [] },
    ];
    const statPlayers = [];
    const meta = { standings: [], awards: [], trades: [] };

    const { players } = mergeLeagueData(scorePlayers, statPlayers, meta);

    expect(players[0].stats['득점']).toEqual({ cumulative: 185, average: 18.5 });
    expect(Object.keys(players[0].stats)).toEqual(['득점']);
  });

  it('메타데이터가 그대로 전달됨', () => {
    const meta = {
      standings: [{ team: 'A', wins: 11, losses: 9, points: 34 }],
      awards: [{ round: '1R', mom: '김정호', doubleDouble: '', topScorer: '' }],
      trades: [],
    };

    const { metadata } = mergeLeagueData([], [], meta);

    expect(metadata.standings).toHaveLength(1);
    expect(metadata.standings[0].team).toBe('A');
  });
});

describe('parseStandingsTab', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('parseMetadata와 동일하게 동작', () => {
    const raw = [
      ['[STANDINGS]'],
      ['팀', '승', '패', '승점'],
      ['A', 11, 9, 34],
      [''],
      ['[AWARDS]'],
      ['라운드', 'MOM', '더블더블', '득점왕'],
      ['1R', '김정호', '남궁현', '김정호'],
    ];

    const result = parseStandingsTab(raw);
    expect(result.standings).toHaveLength(1);
    expect(result.standings[0].team).toBe('A');
    expect(result.awards).toHaveLength(1);
    expect(result.awards[0].mom).toBe('김정호');
  });
});

// --- 레거시 파싱 테스트 (하위 호환) ---

describe('parseLeagueData (레거시)', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('빈 데이터 시 빈 결과 반환', () => {
    expect(parseLeagueData(null, {})).toEqual({ players: [], headers: [] });
    expect(parseLeagueData([], {})).toEqual({ players: [], headers: [] });
    expect(parseLeagueData([['헤더']], {})).toEqual({ players: [], headers: [] });
  });

  it('컬럼 매핑 기반으로 선수 데이터 파싱', () => {
    const raw = [
      ['번호','팀','이름','출석','득점누적','득점평균','어시누적','어시평균','종합포인트'],
      [11,'A','남궁현',10,185,18.5,45,4.5,327],
      [32,'A','김정호',10,210,21.0,38,3.8,351],
    ];
    const mapping = {
      name: 2,
      number: 0,
      team: 1,
      attendance: 3,
      statsStart: 4,
      statColumns: ['득점', '어시스트'],
    };

    const { players } = parseLeagueData(raw, mapping);

    expect(players).toHaveLength(2);
    expect(players[0].name).toBe('남궁현');
    expect(players[0].number).toBe(11);
    expect(players[0].team).toBe('A');
    expect(players[0].attendance).toBe(10);
    expect(players[0].stats['득점'].cumulative).toBe(185);
    expect(players[0].stats['득점'].average).toBe(18.5);
    expect(players[0].stats['어시스트'].cumulative).toBe(45);
    expect(players[0].stats['어시스트'].average).toBe(4.5);
  });

  it('종합포인트(마지막 컬럼) 올바르게 파싱', () => {
    const raw = [
      ['번호','팀','이름','출석','득점누적','득점평균','종합포인트'],
      [11,'A','남궁현',10,185,18.5,327],
    ];
    const mapping = {
      name: 2,
      number: 0,
      team: 1,
      attendance: 3,
      statsStart: 4,
      statColumns: ['득점'],
    };

    const { players } = parseLeagueData(raw, mapping);
    expect(players[0].totalPoints).toBe(327);
  });

  it('빈 이름 행은 무시', () => {
    const raw = [
      ['번호','팀','이름','출석','종합포인트'],
      [11,'A','남궁현',10,100],
      ['','','','',''],
      [32,'A','김정호',10,200],
    ];
    const mapping = { name: 2, number: 0, team: 1, attendance: 3, statsStart: 4 };

    const { players } = parseLeagueData(raw, mapping);
    expect(players).toHaveLength(2);
  });
});

describe('parseMetadata', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('빈 데이터 시 빈 결과 반환', () => {
    expect(parseMetadata(null)).toEqual({ standings: [], awards: [], trades: [] });
    expect(parseMetadata([])).toEqual({ standings: [], awards: [], trades: [] });
  });

  it('STANDINGS 섹션 올바르게 파싱', () => {
    const raw = [
      ['[STANDINGS]'],
      ['팀','승','패','승점'],
      ['A',11,9,34],
      ['B',10,10,30],
    ];

    const { standings } = parseMetadata(raw);
    expect(standings).toHaveLength(2);
    expect(standings[0]).toEqual({ team: 'A', wins: 11, losses: 9, points: 34 });
    expect(standings[1]).toEqual({ team: 'B', wins: 10, losses: 10, points: 30 });
  });

  it('AWARDS 섹션 올바르게 파싱', () => {
    const raw = [
      ['[AWARDS]'],
      ['라운드','MOM','더블더블','득점왕'],
      ['1R','김정호','남궁현','김정호'],
    ];

    const { awards } = parseMetadata(raw);
    expect(awards).toHaveLength(1);
    expect(awards[0].round).toBe('1R');
    expect(awards[0].mom).toBe('김정호');
    expect(awards[0].doubleDouble).toBe('남궁현');
    expect(awards[0].topScorer).toBe('김정호');
  });

  it('TRADES 섹션 올바르게 파싱', () => {
    const raw = [
      ['[TRADES]'],
      ['라운드','선수명','원팀','신팀'],
      ['3R','김동광','A','C'],
    ];

    const { trades } = parseMetadata(raw);
    expect(trades).toHaveLength(1);
    expect(trades[0]).toEqual({ round: '3R', playerName: '김동광', fromTeam: 'A', toTeam: 'C' });
  });

  it('복합 메타데이터 (모든 섹션) 파싱', () => {
    const raw = [
      ['[STANDINGS]'],
      ['팀','승','패','승점'],
      ['A',11,9,34],
      [''],
      ['[AWARDS]'],
      ['라운드','MOM','더블더블','득점왕'],
      ['1R','김정호','남궁현','김정호'],
      ['2R','강재훈','김돈규','강재훈'],
      [''],
      ['[TRADES]'],
      ['라운드','선수명','원팀','신팀'],
      ['3R','김동광','A','C'],
      ['5R','유지형','C','B'],
    ];

    const { standings, awards, trades } = parseMetadata(raw);
    expect(standings).toHaveLength(1);
    expect(awards).toHaveLength(2);
    expect(trades).toHaveLength(2);
  });
});

// --- fetch 함수 테스트 ---

describe('fetchLeagueSheetNames', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('tabs 설정이 있는 리그 객체에서 seasons 반환', async () => {
    const league = { tabs: { scores: '전체득점' }, seasons: ['26-01'] };
    const names = await fetchLeagueSheetNames(league);
    expect(names).toEqual(['26-01']);
  });

  it('tabs 설정이 있지만 seasons가 없으면 기본값 반환', async () => {
    const league = { tabs: { scores: '전체득점' } };
    const names = await fetchLeagueSheetNames(league);
    expect(names).toEqual(['현재 시즌']);
  });

  it('문자열 sheetId로 호출 시 데모 데이터 탭 반환', async () => {
    const names = await fetchLeagueSheetNames('DEMO_ALPHA');
    expect(names).toContain('전체득점');
    expect(names).toContain('부가기록 계산');
    expect(names).toContain('GBL 승점');
  });

  it('존재하지 않는 sheetId에 빈 배열 반환', async () => {
    const names = await fetchLeagueSheetNames('NONEXISTENT');
    expect(names).toEqual([]);
  });
});

describe('fetchLeagueData', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('데모 데이터에서 전체득점 탭 반환', async () => {
    const data = await fetchLeagueData('DEMO_ALPHA', '전체득점');
    expect(data.length).toBeGreaterThan(1);
    expect(data[0][0]).toBe('팀');
    expect(data[0][1]).toBe('이름');
  });

  it('데모 데이터에서 부가기록 탭 반환', async () => {
    const data = await fetchLeagueData('DEMO_ALPHA', '부가기록 계산');
    expect(data.length).toBeGreaterThan(1);
    expect(data[0][0]).toBe('이름');
  });

  it('존재하지 않는 탭에 빈 배열 반환', async () => {
    const data = await fetchLeagueData('DEMO_ALPHA', '없는탭');
    expect(data).toEqual([]);
  });
});

describe('fetchMetadata', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('GBL 승점 탭에서 메타데이터 반환', async () => {
    const data = await fetchMetadata('DEMO_ALPHA', 'GBL 승점');
    expect(data.length).toBeGreaterThan(0);
    expect(data[0][0]).toBe('[STANDINGS]');
  });

  it('메타데이터 없는 리그에 빈 배열 반환', async () => {
    const data = await fetchMetadata('DEMO_BETA');
    expect(data).toEqual([]);
  });
});

// --- 통합 테스트: 데모 데이터 전체 파이프라인 ---

describe('데모 데이터 통합 파싱', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('DEMO_ALPHA 전체 파이프라인 (scores + stats + standings 병합)', async () => {
    const scoresRaw = await fetchLeagueData('DEMO_ALPHA', '전체득점');
    const statsRaw = await fetchLeagueData('DEMO_ALPHA', '부가기록 계산');
    const standingsRaw = await fetchLeagueData('DEMO_ALPHA', 'GBL 승점');

    const scorePlayers = parseScoresTab(scoresRaw, { team: 0, name: 1, number: 2, roundStart: 3 });
    const statPlayers = parseStatsTab(statsRaw, { name: 0, number: 1, statsStart: 2 });
    const meta = parseStandingsTab(standingsRaw);

    expect(scorePlayers).toHaveLength(9);
    expect(statPlayers).toHaveLength(9);
    expect(meta.standings).toHaveLength(3);
    expect(meta.awards).toHaveLength(3);
    expect(meta.trades).toHaveLength(2);

    const { players, metadata } = mergeLeagueData(scorePlayers, statPlayers, meta);

    expect(players).toHaveLength(9);

    // 남궁현 검증
    const ngm = players.find(p => p.name === '남궁현');
    expect(ngm.team).toBe('A');
    expect(ngm.attendance).toBe(10);
    expect(ngm.totalPoints).toBe(185);
    expect(ngm.stats['득점'].cumulative).toBe(185);
    expect(ngm.stats['득점'].average).toBe(18.5);
    expect(ngm.stats['리바운드'].cumulative).toBe(62);
    expect(ngm.stats['어시스트'].cumulative).toBe(45);

    // 팀별 선수 수 검증
    const teamA = players.filter(p => p.team === 'A');
    const teamB = players.filter(p => p.team === 'B');
    const teamC = players.filter(p => p.team === 'C');
    expect(teamA).toHaveLength(3);
    expect(teamB).toHaveLength(3);
    expect(teamC).toHaveLength(3);

    // 메타데이터 검증
    expect(metadata.standings[0].team).toBe('A');
    expect(metadata.standings[0].wins).toBe(11);
  });

  it('DEMO_BETA 파이프라인 (standings 없이)', async () => {
    const scoresRaw = await fetchLeagueData('DEMO_BETA', '전체득점');
    const statsRaw = await fetchLeagueData('DEMO_BETA', '부가기록 계산');

    const scorePlayers = parseScoresTab(scoresRaw, { team: 0, name: 1, number: 2, roundStart: 3 });
    const statPlayers = parseStatsTab(statsRaw, { name: 0, number: 1, statsStart: 2 });

    expect(scorePlayers).toHaveLength(4);
    expect(statPlayers).toHaveLength(4);

    const { players } = mergeLeagueData(scorePlayers, statPlayers, null);

    expect(players).toHaveLength(4);
    const kjh = players.find(p => p.name === '김정호');
    expect(kjh.team).toBe('B');
    expect(kjh.totalPoints).toBe(170);
  });
});
