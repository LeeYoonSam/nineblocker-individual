const CONFIG = {
  SHEET_ID: '__SHEET_ID__',
  API_KEY: '__API_KEY__',
  APPS_SCRIPT_URL: '__APPS_SCRIPT_URL__',
  ADMIN_HASH: '__ADMIN_HASH__',
  DEFAULT_SCORE: 3,
  get DEMO_MODE() {
    return !this.SHEET_ID || this.SHEET_ID.startsWith('__');
  },
};
