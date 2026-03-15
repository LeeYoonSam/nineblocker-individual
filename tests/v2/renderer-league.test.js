import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const utilsCode = fs.readFileSync(path.resolve(__dirname, '../../src/v2/js/utils.js'), 'utf-8');
const rendererCode = fs.readFileSync(path.resolve(__dirname, '../../src/v2/js/renderer-league.js'), 'utf-8');

function setupDOM() {
  document.body.innerHTML = `
    <div id="league-table-container"></div>
    <input type="text" id="league-search">
  `;
}

function setupGlobals() {
  globalThis.CONFIG = { DEFAULT_SCORE: 3, DEMO_MODE: true };
}

function loadFunctions() {
  globalThis.eval(utilsCode);
  globalThis.eval(rendererCode);
}

const samplePlayers = [
  { name: '김정호', number: 32, team: 'A', attendance: 10, stats: { '득점': { cumulative: 210, average: 21.0 }, '어시스트': { cumulative: 38, average: 3.8 } }, totalPoints: 351 },
  { name: '강재훈', number: 93, team: 'B', attendance: 10, stats: { '득점': { cumulative: 195, average: 19.5 }, '어시스트': { cumulative: 42, average: 4.2 } }, totalPoints: 354 },
  { name: '남궁현', number: 11, team: 'A', attendance: 10, stats: { '득점': { cumulative: 185, average: 18.5 }, '어시스트': { cumulative: 45, average: 4.5 } }, totalPoints: 327 },
  { name: '길을섭', number: 38, team: 'C', attendance: 7, stats: { '득점': { cumulative: 120, average: 17.1 }, '어시스트': { cumulative: 28, average: 4.0 } }, totalPoints: 204 },
];

const sampleMapping = {
  name: 2,
  number: 0,
  team: 1,
  attendance: 3,
  statsStart: 4,
  statColumns: ['득점', '어시스트'],
};

describe('renderLeagueTable', () => {
  beforeEach(() => {
    setupDOM();
    setupGlobals();
    loadFunctions();
  });

  it('테이블이 올바르게 렌더링됨', () => {
    renderLeagueTable(samplePlayers, sampleMapping);

    const table = document.getElementById('league-stats-table');
    expect(table).not.toBeNull();

    const headers = table.querySelectorAll('thead th');
    // rank + name + team + attendance + (2 stats × 2) + total = 9
    expect(headers.length).toBe(9);
  });

  it('종합포인트 내림차순 기본 정렬', () => {
    renderLeagueTable(samplePlayers, sampleMapping);

    const rows = document.querySelectorAll('#league-stats-table tbody tr');
    expect(rows.length).toBe(4);

    // 강재훈(354) > 김정호(351) > 남궁현(327) > 길을섭(204)
    const names = Array.from(rows).map(r => r.querySelector('.col-name').textContent);
    expect(names[0]).toBe('강재훈');
    expect(names[1]).toBe('김정호');
    expect(names[2]).toBe('남궁현');
    expect(names[3]).toBe('길을섭');
  });

  it('메달 이모지가 상위 3위에 표시됨', () => {
    renderLeagueTable(samplePlayers, sampleMapping);

    const ranks = document.querySelectorAll('#league-stats-table tbody .col-rank');
    expect(ranks[0].textContent).toContain('🥇');
    expect(ranks[1].textContent).toContain('🥈');
    expect(ranks[2].textContent).toContain('🥉');
    expect(ranks[3].textContent).not.toContain('🥇');
  });

  it('팀 배지가 올바르게 표시됨', () => {
    renderLeagueTable(samplePlayers, sampleMapping);

    const badges = document.querySelectorAll('#league-stats-table .team-badge');
    expect(badges.length).toBe(4);
    // 강재훈은 B팀
    expect(badges[0].textContent).toBe('B');
    expect(badges[0].classList.contains('team-badge-b')).toBe(true);
  });
});

describe('getTeamBadgeClass', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('팀 A -> team-badge-a', () => {
    expect(getTeamBadgeClass('A')).toBe('team-badge-a');
  });

  it('팀 B -> team-badge-b', () => {
    expect(getTeamBadgeClass('B')).toBe('team-badge-b');
  });

  it('팀 C -> team-badge-c', () => {
    expect(getTeamBadgeClass('C')).toBe('team-badge-c');
  });

  it('소문자도 동작', () => {
    expect(getTeamBadgeClass('a')).toBe('team-badge-a');
  });
});

describe('sortLeaguePlayers', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('종합포인트 내림차순 정렬', () => {
    const sorted = sortLeaguePlayers(samplePlayers, 'totalPoints', false);
    expect(sorted[0].name).toBe('강재훈');
    expect(sorted[3].name).toBe('길을섭');
  });

  it('이름 오름차순 정렬', () => {
    const sorted = sortLeaguePlayers(samplePlayers, 'name', true);
    expect(sorted[0].name).toBe('강재훈');
    expect(sorted[1].name).toBe('길을섭');
    expect(sorted[2].name).toBe('김정호');
    expect(sorted[3].name).toBe('남궁현');
  });

  it('통계 누적치 기준 정렬', () => {
    const sorted = sortLeaguePlayers(samplePlayers, '득점-cum', false);
    expect(sorted[0].name).toBe('김정호'); // 210
    expect(sorted[1].name).toBe('강재훈'); // 195
  });

  it('통계 평균치 기준 정렬', () => {
    const sorted = sortLeaguePlayers(samplePlayers, '어시스트-avg', false);
    expect(sorted[0].name).toBe('남궁현'); // 4.5
    expect(sorted[1].name).toBe('강재훈'); // 4.2
  });

  it('출석 기준 정렬', () => {
    const sorted = sortLeaguePlayers(samplePlayers, 'attendance', false);
    // 10, 10, 10, 7 -> 길을섭(7)이 마지막
    expect(sorted[3].name).toBe('길을섭');
  });
});

describe('setTeamFilter', () => {
  beforeEach(() => {
    setupDOM();
    setupGlobals();
    loadFunctions();
    // team-filter 버튼 추가
    const container = document.createElement('div');
    container.innerHTML = `
      <button class="team-filter-btn active" data-team="all">전체</button>
      <button class="team-filter-btn" data-team="A">A팀</button>
      <button class="team-filter-btn" data-team="B">B팀</button>
    `;
    document.body.appendChild(container);

    window._currentColumnMapping = sampleMapping;
    renderLeagueTable(samplePlayers, sampleMapping);
  });

  it('팀 필터 적용 시 해당 팀만 표시', () => {
    setTeamFilter('A');

    const rows = document.querySelectorAll('#league-stats-table tbody tr');
    const names = Array.from(rows).map(r => r.querySelector('.col-name').textContent);
    expect(names).toContain('김정호');
    expect(names).toContain('남궁현');
    expect(names).not.toContain('강재훈');
    expect(names).not.toContain('길을섭');
  });

  it('전체 필터 시 모든 팀 표시', () => {
    setTeamFilter('A');
    setTeamFilter('all');

    const rows = document.querySelectorAll('#league-stats-table tbody tr');
    expect(rows.length).toBe(4);
  });
});
