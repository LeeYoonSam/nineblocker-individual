import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const configCode = fs.readFileSync(path.resolve(__dirname, '../../src/v2/js/config.js'), 'utf-8');
const utilsCode = fs.readFileSync(path.resolve(__dirname, '../../src/v2/js/utils.js'), 'utf-8');
const registryCode = fs.readFileSync(path.resolve(__dirname, '../../src/v2/js/registry.js'), 'utf-8');

function setupGlobals() {
  globalThis.CONFIG = {
    DEMO_MODE: true,
    SHEET_ID: '__TEST__',
    API_KEY: '__TEST__',
    APPS_SCRIPT_URL: '__TEST__',
    ADMIN_HASH: '__TEST__',
    GEMINI_API_KEY: '__TEST__',
    DEFAULT_SCORE: 3,
  };
  globalThis.fetch = vi.fn();
  globalThis.sessionStorage = {
    _store: {},
    getItem(key) { return this._store[key] ?? null; },
    setItem(key, val) { this._store[key] = String(val); },
    removeItem(key) { delete this._store[key]; },
    clear() { this._store = {}; },
  };
}

function loadFunctions() {
  globalThis.eval(utilsCode);
  // Reset cache
  globalThis._registryCache = null;
  globalThis.eval(registryCode);
}

describe('fetchLeagueRegistry', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('데모 모드에서 DEMO_LEAGUES 반환', async () => {
    const result = await fetchLeagueRegistry();
    expect(result.leagues).toBeDefined();
    expect(result.leagues.length).toBeGreaterThan(0);
    expect(result.leagues[0].id).toBe('league-individual');
  });

  it('데모 모드에서 개인승점 리그 포함', async () => {
    const result = await fetchLeagueRegistry();
    const individual = result.leagues.find(l => l.type === 'individual');
    expect(individual).toBeDefined();
    expect(individual.name).toBe('개인 승점제');
  });

  it('데모 모드에서 리그 타입 리그 포함', async () => {
    const result = await fetchLeagueRegistry();
    const leagues = result.leagues.filter(l => l.type === 'league');
    expect(leagues.length).toBeGreaterThanOrEqual(2);
  });
});

describe('getLeagueById', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('캐시가 없으면 null 반환', () => {
    expect(getLeagueById('league-individual')).toBeNull();
  });

  it('캐시에서 ID로 리그 검색', async () => {
    await fetchLeagueRegistry(); // 캐시 로드
    const league = getLeagueById('league-individual');
    expect(league).not.toBeNull();
    expect(league.name).toBe('개인 승점제');
  });

  it('존재하지 않는 ID에 null 반환', async () => {
    await fetchLeagueRegistry();
    expect(getLeagueById('nonexistent')).toBeNull();
  });
});

describe('clearRegistryCache', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('캐시 초기화 후 getLeagueById가 null 반환', async () => {
    await fetchLeagueRegistry();
    expect(getLeagueById('league-individual')).not.toBeNull();

    clearRegistryCache();
    expect(getLeagueById('league-individual')).toBeNull();
  });
});

describe('generateId', () => {
  beforeEach(() => {
    setupGlobals();
    loadFunctions();
  });

  it('league- 접두사를 가진 고유 ID 생성', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).toMatch(/^league-[a-z0-9]+$/);
    expect(id2).toMatch(/^league-[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });
});
