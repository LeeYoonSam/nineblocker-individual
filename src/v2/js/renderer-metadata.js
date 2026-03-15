// 메타데이터 렌더링 (팀 순위, 어워드, 트레이드)

function renderStandings(standings) {
  const container = document.getElementById('standings-container');
  if (!container || standings.length === 0) {
    if (container) container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  // 승점 내림차순 정렬
  const sorted = [...standings].sort((a, b) => b.points - a.points);

  container.innerHTML = `
    <h3 class="section-title">팀 순위</h3>
    <div class="standings-grid">
      ${sorted.map((s, i) => {
        const medal = getMedalEmoji(i + 1);
        const badgeClass = getTeamBadgeClass(s.team);
        return `
          <div class="glass-card standings-card">
            <div class="team-name">${medal}<span class="team-badge ${badgeClass}">${s.team}팀</span></div>
            <div class="record">${s.wins}승 ${s.losses}패</div>
            <div class="points">${s.points}점</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderAwards(awards) {
  const container = document.getElementById('awards-container');
  if (!container || awards.length === 0) {
    if (container) container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  container.innerHTML = `
    <h3 class="section-title">어워드</h3>
    <div class="awards-grid">
      ${awards.map(a => `
        <div class="glass-card award-card">
          <div class="round">${a.round}</div>
          <div class="award-items">
            ${a.mom ? `<div><span class="award-label">MOM</span> ${a.mom}</div>` : ''}
            ${a.doubleDouble ? `<div><span class="award-label">더블더블</span> ${a.doubleDouble}</div>` : ''}
            ${a.topScorer ? `<div><span class="award-label">득점왕</span> ${a.topScorer}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTradeButton(trades) {
  const btn = document.getElementById('trades-btn');
  if (!btn) return;

  if (trades.length === 0) {
    btn.classList.add('hidden');
    return;
  }

  btn.classList.remove('hidden');
  btn.textContent = `트레이드 내역 (${trades.length})`;
  btn.onclick = () => showTradeModal(trades);
}

function showTradeModal(trades) {
  // 기존 모달 제거
  const existing = document.getElementById('trade-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'trade-modal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:480px;text-align:left;">
      <h2 style="text-align:center;margin-bottom:1rem;">트레이드 내역</h2>
      <div class="trades-list">
        ${trades.map(t => `
          <div class="trade-item">
            <span style="color:var(--text-muted);width:40px;">${t.round}</span>
            <strong>${t.playerName}</strong>
            <span class="team-badge ${getTeamBadgeClass(t.fromTeam)}">${t.fromTeam}</span>
            <span class="trade-arrow">→</span>
            <span class="team-badge ${getTeamBadgeClass(t.toTeam)}">${t.toTeam}</span>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-secondary" style="width:100%;margin-top:1rem;" onclick="this.closest('.modal').remove()">닫기</button>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
}
