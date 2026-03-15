// Gemini AI 챗봇

let chatHistory = [];
let chatSystemPrompt = '';
let geminiModel = null;

function initChatbot() {
  const toggleBtn = document.getElementById('chatbot-toggle');
  const panel = document.getElementById('chatbot-panel');
  const closeBtn = document.getElementById('chatbot-close');
  const sendBtn = document.getElementById('chatbot-send');
  const input = document.getElementById('chatbot-input');

  if (!toggleBtn || !panel) return;

  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      input.focus();
      checkApiKey();
    }
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.add('hidden');
  });

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function checkApiKey() {
  const key = localStorage.getItem('gemini_api_key') || CONFIG.GEMINI_API_KEY;
  if (!key || key.startsWith('__')) {
    showApiKeyModal();
  }
}

function showApiKeyModal() {
  const existing = document.getElementById('apikey-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'apikey-modal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Gemini API 키 입력</h2>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:0.75rem;">AI 챗봇 이용을 위해 Gemini API 키가 필요합니다.</p>
      <input type="password" id="apikey-input" placeholder="API 키 입력">
      <button class="btn btn-primary" style="width:100%" onclick="saveApiKey()">저장</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('apikey-input').focus();
}

function saveApiKey() {
  const input = document.getElementById('apikey-input');
  if (input && input.value.trim()) {
    localStorage.setItem('gemini_api_key', input.value.trim());
    const modal = document.getElementById('apikey-modal');
    if (modal) modal.remove();
  }
}

function setChatContext(players, leagueName, seasonName) {
  chatHistory = [];
  const playerSummary = players.slice(0, 20).map(p => {
    const statsStr = Object.entries(p.stats || {})
      .map(([k, v]) => `${k}: 누적 ${v.cumulative}, 평균 ${v.average}`)
      .join(', ');
    return `- ${p.name} (#${p.number}, ${p.team}팀): 출석 ${p.attendance}회, ${statsStr}, 종합 ${p.totalPoints}점`;
  }).join('\n');

  chatSystemPrompt = `당신은 나인블로커스 ${leagueName}의 ${seasonName} 시즌 데이터 분석 전문가입니다.

현재 시즌 선수 데이터:
${playerSummary}

규칙:
- 한국어로 답변
- 구체적 수치를 근거로 분석
- 간결하고 핵심적으로 답변
- 마크다운 형식 사용 (테이블, 리스트, 볼드)`;

  const messagesDiv = document.getElementById('chatbot-messages');
  if (messagesDiv) {
    messagesDiv.innerHTML = '<div class="chat-system">시즌 데이터가 로드되었습니다. 질문해 주세요!</div>';
  }
}

async function sendMessage() {
  const input = document.getElementById('chatbot-input');
  const messagesDiv = document.getElementById('chatbot-messages');
  if (!input || !messagesDiv) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  appendMessage('user', text);

  const apiKey = localStorage.getItem('gemini_api_key') || CONFIG.GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith('__')) {
    showApiKeyModal();
    return;
  }

  chatHistory.push({ role: 'user', parts: [{ text }] });

  try {
    appendMessage('assistant', '...');
    const lastBubble = messagesDiv.querySelector('.chat-bubble:last-child');

    const response = await callGemini(apiKey, chatSystemPrompt, chatHistory);
    chatHistory.push({ role: 'model', parts: [{ text: response }] });

    if (lastBubble) lastBubble.innerHTML = markdownToHtml(response);
  } catch (e) {
    console.error('Gemini API 오류:', e);
    const lastBubble = messagesDiv.querySelector('.chat-bubble:last-child');
    if (lastBubble) lastBubble.innerHTML = '<span style="color:var(--error)">응답 생성에 실패했습니다.</span>';
  }

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function appendMessage(role, text) {
  const messagesDiv = document.getElementById('chatbot-messages');
  if (!messagesDiv) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-${role}`;
  bubble.innerHTML = role === 'user' ? escapeHtml(text) : markdownToHtml(text);
  messagesDiv.appendChild(bubble);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function callGemini(apiKey, systemPrompt, history) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: '네, 데이터를 분석할 준비가 되었습니다.' }] },
    ...history,
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '응답을 생성할 수 없습니다.';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function markdownToHtml(md) {
  if (!md) return '';
  let html = escapeHtml(md);

  // 테이블
  html = html.replace(/^(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)*)/gm, (match, header, sep, body) => {
    const ths = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map(row => {
      const tds = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    return `<table class="chat-table"><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // 볼드
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 리스트
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  // 줄바꿈
  html = html.replace(/\n/g, '<br>');

  return html;
}
