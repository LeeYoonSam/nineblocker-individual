async function submitScores({ sheetName, date, entries, passwordHash }) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ sheetName, date, entries, passwordHash }),
  });
  return await res.json();
}

async function submitLeagueScores({ sheetId, sheetName, date, entries, passwordHash }) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'submitLeagueScores',
      sheetId,
      sheetName,
      date,
      entries,
      passwordHash,
    }),
  });
  return await res.json();
}

async function addLeague({ league, passwordHash }) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'addLeague', league, passwordHash }),
  });
  return await res.json();
}

async function updateLeague({ league, passwordHash }) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'updateLeague', league, passwordHash }),
  });
  return await res.json();
}

async function deleteLeague({ leagueId, passwordHash }) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'deleteLeague', leagueId, passwordHash }),
  });
  return await res.json();
}
