async function submitScores({ sheetName, date, entries, passwordHash }) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ sheetName, date, entries, passwordHash }),
  });
  return await res.json();
}
