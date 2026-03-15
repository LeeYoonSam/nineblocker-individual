// 공유 유틸리티

function getLatestSheet(tabs) {
  return tabs.reduce((latest, tab) => {
    if (!latest) return tab;
    const [aY, aM] = latest.split('-').map(Number);
    const [bY, bM] = tab.split('-').map(Number);
    if (isNaN(bY) || isNaN(bM)) return latest;
    if (isNaN(aY) || isNaN(aM)) return tab;
    return (bY > aY || (bY === aY && bM > aM)) ? tab : latest;
  }, null);
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

function getMedalClass(rank) {
  if (rank === 1) return ' card-gold';
  if (rank === 2) return ' card-silver';
  if (rank === 3) return ' card-bronze';
  return '';
}

function sheetDateToISO(sheetDate) {
  const now = new Date();
  const currentYear = now.getFullYear();

  let m = sheetDate.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    return `${currentYear}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
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

  if (formatHint && formatHint.includes('월')) {
    return `${month}월 ${day}일`;
  }
  return `${month}/${day}`;
}

function showError(message) {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.textContent = message;
    loading.classList.remove('hidden');
  }
}

function generateId() {
  return 'league-' + Math.random().toString(36).substring(2, 10);
}
