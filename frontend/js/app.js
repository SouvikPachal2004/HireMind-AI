// @ts-nocheck
/* ===== HireMind AI – app.js ===== */

// Smart API base — works from Express (/api) or file:// (absolute)
const API = (() => {
  const { protocol, hostname, port } = window.location;
  const isLocalFile = protocol === 'file:';
  const isBackendOrigin =
    (hostname === 'localhost' || hostname === '127.0.0.1') &&
    (port === '3000' || port === '');
  return isLocalFile || !isBackendOrigin
    ? 'http://localhost:3000/api'
    : '/api';
})();

// ===== AUTH GUARD =====
const hm_token = sessionStorage.getItem('hm_token');
const hm_user  = safelyParseUser(sessionStorage.getItem('hm_user')) || getUserFromToken(hm_token);

if (!hm_token || !hm_user) {
  window.location.href = window.location.pathname.replace('dashboard.html', 'index.html');
}

function safelyParseUser(rawUser) {
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser);
  } catch (error) {
    console.warn('Invalid user payload found in sessionStorage:', error.message);
    sessionStorage.removeItem('hm_user');
    return null;
  }
}

function getUserFromToken(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload || (!payload.name && !payload.email)) return null;
    return {
      id: payload.id || payload._id || '',
      name: payload.name || '',
      email: payload.email || '',
      role: payload.role || 'Software Developer'
    };
  } catch (error) {
    console.warn('Could not decode auth token:', error.message);
    return null;
  }
}

// Authenticated fetch helper
function authFetch(url, opts = {}) {
  const isFormData = opts.body instanceof FormData;
  const headers = { 'Authorization': `Bearer ${hm_token}` };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  return fetch(url, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
}

// ===== STATE =====
const state = {
  user:             hm_user ? { ...hm_user } : { name: '', email: '', role: 'Software Developer' },
  interviewType:    'technical',
  currentQuestion:  null,
  questionIndex:    0,
  sessionQuestions: [],
  sessionAnswers:   [],
  isRecording:      false,
  recordTimer:      null,
  recordSeconds:    0,
  recognition:      null,
  transcript:       '',
  charts:           {},
  theme:            'dark',
  currentVoiceQuestion: ''
};

if (hm_user) {
  sessionStorage.setItem('hm_user', JSON.stringify(hm_user));
}

// Restore saved theme before page renders
(function () {
  const saved = localStorage.getItem('hm_dash_theme');
  if (saved === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    state.theme = 'light';
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
  }
})();

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  // Sync theme icon
  if (localStorage.getItem('hm_dash_theme') === 'light') {
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = 'fas fa-sun';
  }
  applyUserToUI();
  await refreshUserFromBackend();
  pruneDashboardContent();
  loadUserStats();
  loadSkillGap();
  if (document.getElementById('problemSelect')) loadProblem();
  initCharts();
  loadTimeline();
  initSpeechRecognition();
  hydrateInterviewSetup();
  bindDashboardInteractions();
  animateSections();
});

// ===== APPLY USER TO UI =====
function applyUserToUI() {
  const name  = state.user.name  || '';
  const email = state.user.email || '';
  const role  = state.user.role  || 'Software Developer';
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  setEl('welcomeName',        name || 'User');
  setEl('navName',            name || 'User');
  setEl('navAvatar',          initials);
  setEl('profileName',        name || 'User');
  setEl('profileEmail',       email);
  setEl('profileRole',        role);
  setEl('profileAvatarLarge', initials);

  const editName  = document.getElementById('editName');
  const editEmail = document.getElementById('editEmail');
  const editRole  = document.getElementById('editRole');
  if (editName)  editName.value  = name;
  if (editEmail) editEmail.value = email;
  if (editRole)  editRole.value  = role;
}

// Fetch real user from backend and update UI
async function refreshUserFromBackend() {
  if (!hm_token || hm_token === 'demo_token') return;
  try {
    const res  = await authFetch(`${API}/auth/me`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && data.user) {
      state.user.name  = data.user.name;
      state.user.email = data.user.email;
      state.user.role  = data.user.role || state.user.role;
      // Persist fresh data to sessionStorage
      sessionStorage.setItem('hm_user', JSON.stringify({
        id:    data.user._id || data.user.id,
        name:  data.user.name,
        email: data.user.email,
        role:  data.user.role
      }));
      applyUserToUI();
    }
  } catch (e) {
    console.warn('Could not refresh user from backend:', e.message);
  }
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function animateSections() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity    = '1';
        e.target.style.transform  = 'translateY(0)';
      }
    });
  }, { threshold: 0.05 });
  document.querySelectorAll('.dashboard-section').forEach(s => {
    s.style.opacity   = '0';
    s.style.transform = 'translateY(20px)';
    s.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    obs.observe(s);
  });
}

function pruneDashboardContent() {
  ['coding', 'voice'].forEach(id => {
    const section = document.getElementById(id);
    if (section) section.remove();
  });
}

// ===== NAVIGATION =====
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateActiveNav(id);
  }
}
function toggleSidebar() {
  const sb   = document.getElementById('sidebar');
  const main = document.getElementById('mainContent');
  sb.classList.toggle('collapsed');
  sb.classList.toggle('open');
  main.classList.toggle('expanded');
}

// ===== THEME =====
function toggleTheme() {
  const isLight = !document.body.classList.contains('light-theme');
  document.body.classList.toggle('light-theme', isLight);
  document.body.classList.toggle('dark-theme', !isLight);
  state.theme = isLight ? 'light' : 'dark';
  const icon = document.getElementById('themeIcon');
  if (icon) icon.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
  localStorage.setItem('hm_dash_theme', state.theme);
  showToast('Switched to ' + state.theme + ' theme', 'info');
}

function updateActiveNav(sectionId) {
  const navTargets = new Map([
    ['overview', ['Dashboard']],
    ['mock-interview', ['Mock Interview']],
    ['resume', ['Resume', 'ATS Checker']],
    ['progress', ['Progress']],
    ['profile', ['Profile']]
  ]);

  document.querySelectorAll('.nav-tab').forEach(tab => {
    const shouldBeActive = (navTargets.get(sectionId) || []).includes(tab.textContent.trim());
    tab.classList.toggle('active', shouldBeActive);
  });

  document.querySelectorAll('.sidebar-item').forEach(item => {
    const shouldBeActive = (navTargets.get(sectionId) || []).includes(item.textContent.trim());
    item.classList.toggle('active', shouldBeActive);
  });
}

// ===== LOAD USER STATS =====
async function loadUserStats() {
  try {
    const res  = await authFetch(`${API}/user/stats`);
    const data = await res.json();
    if (data.success) {
      animateCounter('totalSessions',       data.totalSessions       || 0);
      animateCounter('completedInterviews', data.completedInterviews || 0);
      setEl('avgScore',  (data.averageScore || 0) + '%');
      setEl('dayStreak', data.streak || 1);
      setEl('streakCount', data.streak || 1);
      setEl('pTotalSessions', data.totalSessions || 0);
      setEl('pAvgScore',  (data.averageScore || 0) + '%');
      setEl('pStreak',    data.streak || 1);
    }
  } catch (e) {
    animateCounter('totalSessions', 0);
    animateCounter('completedInterviews', 0);
    setEl('avgScore', '0%');
  }
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el || target === 0) { if (el) el.textContent = 0; return; }
  let cur = 0;
  const step  = Math.ceil(target / 30);
  const timer = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(timer);
  }, 40);
}

// ===== ROLE SELECTION =====
function selectRole(card) {
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  state.user.role = card.dataset.role;
  persistInterviewSetup();
  loadSkillGap();
  showToast(`Role set to ${state.user.role}`, 'success');
}

// ===== INTERVIEW =====
function setInterviewType(btn) {
  document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  state.interviewType = btn.dataset.type;
  persistInterviewSetup();
}

async function startInterview() {
  persistInterviewSetup();
  window.location.href = 'interview-room.html';
}

function getDemoQuestions() {
  const q = {
    technical: ['Explain the difference between stack and heap memory.','What is the time complexity of quicksort?','Describe the SOLID principles.'],
    behavioral:['Tell me about a time you resolved a conflict.','Describe a challenging project.'],
    hr:        ['Why do you want to work here?','Where do you see yourself in 5 years?']
  };
  return q[state.interviewType] || q.technical;
}

function askNextQuestion() {
  if (state.questionIndex >= state.sessionQuestions.length) { endInterview(); return; }
  state.currentQuestion = state.sessionQuestions[state.questionIndex];
  addChatMessage('ai', `<strong>Q${state.questionIndex + 1}:</strong> ${state.currentQuestion}`);
  const inp = document.getElementById('answerInput');
  if (inp) { inp.value = ''; }
  setEl('wordCount', '0 words');
  inp?.addEventListener('input', updateWordCount);
}

function addChatMessage(role, text, extra = '') {
  const container = document.getElementById('chatContainer');
  const div = document.createElement('div');
  div.className = `chat-message ${role}`;
  const avatar = role === 'ai' ? '🤖' : (state.user.name || 'U').split(' ').map(n=>n[0]).join('').slice(0,2);
  div.innerHTML = `<div class="chat-avatar">${avatar}</div><div><div class="chat-bubble">${text}</div>${extra}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById('chatContainer');
  const div = document.createElement('div');
  div.className = 'chat-message ai'; div.id = 'typingIndicator';
  div.innerHTML = `<div class="chat-avatar">🤖</div><div class="chat-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}
function removeTyping() { document.getElementById('typingIndicator')?.remove(); }

function updateWordCount() {
  const val   = document.getElementById('answerInput')?.value.trim() || '';
  const count = val ? val.split(/\s+/).length : 0;
  setEl('wordCount', `${count} word${count !== 1 ? 's' : ''}`);
}

async function submitAnswer() {
  const answer = document.getElementById('answerInput')?.value.trim();
  if (!answer) { showToast('Please write an answer first', 'error'); return; }
  addChatMessage('user', answer);
  showTyping();
  try {
    const res  = await authFetch(`${API}/interview/evaluate-answer`, {
      method: 'POST',
      body:   JSON.stringify({ question: state.currentQuestion, answer, role: state.user.role })
    });
    const data = await res.json();
    removeTyping();
    const extra = `<div class="chat-feedback">${data.feedback}</div><div class="chat-score"><i class="fas fa-star"></i> Score: ${data.score}/100</div>`;
    addChatMessage('ai', 'Here\'s my feedback:', extra);
    state.sessionAnswers.push({ question: state.currentQuestion, answer, feedback: data.feedback, score: data.score });
  } catch (e) {
    removeTyping();
    const score = 60 + Math.floor(Math.random() * 30);
    addChatMessage('ai', 'Good answer! Keep practicing.', `<div class="chat-score"><i class="fas fa-star"></i> Score: ${score}/100</div>`);
    state.sessionAnswers.push({ question: state.currentQuestion, answer, feedback: 'Good attempt.', score });
  }
  state.questionIndex++;
  setTimeout(() => {
    if (state.questionIndex < state.sessionQuestions.length) {
      addChatMessage('ai', `Next question (${state.questionIndex + 1}/${state.sessionQuestions.length}):`);
      setTimeout(askNextQuestion, 400);
    } else {
      addChatMessage('ai', '🎉 Interview complete! Check your Performance Analytics for insights.');
      document.getElementById('chatInputArea').style.display = 'none';
      resetInterviewBtn();
      saveSession('mock');
    }
  }, 700);
}

function skipQuestion() {
  state.questionIndex++;
  if (state.questionIndex < state.sessionQuestions.length) {
    addChatMessage('ai', 'Skipped. Next question:');
    setTimeout(askNextQuestion, 300);
  } else endInterview();
}

function endInterview() {
  document.getElementById('chatInputArea').style.display = 'none';
  resetInterviewBtn();
  if (state.sessionAnswers.length > 0) {
    addChatMessage('ai', '✅ Session ended. Review your answers above.');
    saveSession('mock');
  }
}

function resetInterviewBtn() {
  const btn = document.getElementById('startInterviewBtn');
  btn.innerHTML = '<i class="fas fa-play"></i> Start Interview';
  btn.disabled  = false;
  btn.onclick   = startInterview;
}

async function saveSession(type) {
  if (!hm_token || hm_token === 'demo_token') return;
  const scores = state.sessionAnswers.map(a => a.score);
  const avg    = scores.length ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : 0;
  try {
    await authFetch(`${API}/interview/save-session`, {
      method: 'POST',
      body:   JSON.stringify({
        type, role: state.user.role, score: avg,
        questions: state.sessionAnswers
      })
    });
    loadUserStats();
  } catch (e) {}
}

function persistInterviewSetup() {
  sessionStorage.setItem('hm_interview_setup', JSON.stringify({
    type: 'voice',
    role: state.user.role || 'Software Developer',
    categories: [state.interviewType || 'technical'],
    qCount: 5,
    source: 'dashboard'
  }));
}

function hydrateInterviewSetup() {
  persistInterviewSetup();
}

// ===== RESUME UPLOAD =====
function handleDrop(e) { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) processResume(f); }
function uploadResume(input) { if (input.files[0]) processResume(input.files[0]); }

async function processResume(file) {
  const zone = document.getElementById('uploadZone');
  zone.innerHTML = '<i class="fas fa-spinner fa-spin"></i><p>Analyzing your resume...</p>';
  const fd = new FormData();
  fd.append('resume', file);
  try {
    const res  = await fetch(`${API}/resume/upload-resume`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${hm_token}` },
      body: fd
    });
    const data = await res.json();
    if (data.success) showResumeResults(data); else throw new Error(data.error);
  } catch (e) {
    showResumeResults({
      skills: ['JavaScript','React','Node.js','MongoDB','CSS','Git','REST API','Python'],
      score: 72,
      suggestions: ['Add quantifiable achievements','Include a professional summary','Tailor keywords to job descriptions','Add GitHub/portfolio links'],
      missingSkills: ['Docker','Kubernetes','TypeScript','GraphQL']
    });
  }
  zone.innerHTML = `<i class="fas fa-check-circle" style="color:#34d399"></i><p>Resume analyzed! <span class="accent">Upload another</span></p><input type="file" id="resumeFile" accept=".pdf,.doc,.docx" style="display:none" onchange="uploadResume(this)" />`;
}

function showResumeResults(data) {
  const results = document.getElementById('resumeResults');
  results.style.display = 'grid';
  const score = data.score;
  setEl('atsScoreValue', score);
  const circ = 2 * Math.PI * 50;
  setTimeout(() => {
    const ring = document.getElementById('atsRing');
    if (ring) ring.style.strokeDasharray = `${(score / 100) * circ} ${circ}`;
  }, 100);
  document.getElementById('skillsList').innerHTML    = data.skills.map(s => `<span class="skill-tag">${s}</span>`).join('');
  document.getElementById('suggestionsList').innerHTML = data.suggestions.map(s => `<li>${s}</li>`).join('');
  document.getElementById('missingSkillsList').innerHTML = data.missingSkills.map(s => `<span class="skill-tag">${s}</span>`).join('');
  showToast('Resume analyzed!', 'success');
}

// ===== SKILL GAP =====
const skillGapData = {
  'Software Developer': {
    missing:   ['System Design','Kubernetes','Microservices','Redis'],
    topics:    ['Data Structures','Algorithms','Design Patterns','Cloud Architecture'],
    questions: ['Explain CAP theorem','Design a URL shortener','What is eventual consistency?']
  },
  'Web Developer': {
    missing:   ['WebAssembly','Web Workers','PWA','Performance Optimization'],
    topics:    ['Core Web Vitals','Accessibility','Security','Testing'],
    questions: ['How does the browser render a page?','Explain the event loop','What is CORS?']
  },
  'Data Scientist': {
    missing:   ['MLflow','Feature Store','A/B Testing','Causal Inference'],
    topics:    ['Statistics','Model Evaluation','Data Pipeline','Visualization'],
    questions: ['Explain p-value','What is overfitting?','Describe your EDA process']
  },
  'ML Engineer': {
    missing:   ['Kubeflow','Model Quantization','ONNX','Distributed Training'],
    topics:    ['MLOps','Model Serving','Monitoring','CI/CD for ML'],
    questions: ['How do you handle model drift?','Explain transformer attention','What is feature drift?']
  }
};

function loadSkillGap() {
  const data = skillGapData[state.user.role] || skillGapData['Software Developer'];
  document.getElementById('gapMissing').innerHTML    = data.missing.map(s => `<span class="gap-tag missing">${s}</span>`).join('');
  document.getElementById('gapTopics').innerHTML     = data.topics.map(t => `<span class="gap-tag topic">${t}</span>`).join('');
  document.getElementById('gapQuestions').innerHTML  = data.questions.map(q => `<li>${q}</li>`).join('');
}

// ===== CODING EDITOR =====
const problems = {
  twoSum: {
    title: 'Two Sum', difficulty: 'easy',
    desc: 'Given an array of integers <code>nums</code> and an integer <code>target</code>, return indices of the two numbers that add up to target.',
    example: 'Input: nums=[2,7,11,15], target=9 → Output: [0,1]',
    starter: `function twoSum(nums, target) {\n  // Your solution here\n  \n}`
  },
  reverseString: {
    title: 'Reverse String', difficulty: 'easy',
    desc: 'Write a function that reverses a string in-place.',
    example: 'Input: ["h","e","l","l","o"] → Output: ["o","l","l","e","h"]',
    starter: `function reverseString(s) {\n  // Your solution here\n  \n}`
  },
  fibonacci: {
    title: 'Fibonacci Number', difficulty: 'medium',
    desc: 'Given n, calculate F(n) where F(n) = F(n-1) + F(n-2), F(0)=0, F(1)=1.',
    example: 'Input: n=5 → Output: 5',
    starter: `function fib(n) {\n  // Your solution here\n  \n}`
  }
};

function loadProblem() {
  const problemDesc = document.getElementById('problemDesc');
  const codeEditor = document.getElementById('codeEditor');
  if (!problemDesc || !codeEditor) return;
  const key = document.getElementById('problemSelect')?.value || 'twoSum';
  const p   = problems[key];
  if (!p) return;
  problemDesc.innerHTML = `<h4>${p.title}</h4><span class="difficulty ${p.difficulty}">${p.difficulty.toUpperCase()}</span><p>${p.desc}</p><br><strong>Example:</strong><br><code>${p.example}</code>`;
  codeEditor.value = p.starter;
  const lang = document.getElementById('langSelect')?.value || 'javascript';
  setEl('editorLang', lang.charAt(0).toUpperCase() + lang.slice(1));
}

function bindDashboardInteractions() {
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.addEventListener('change', () => {
      const lang = langSelect.value || 'javascript';
      setEl('editorLang', lang.charAt(0).toUpperCase() + lang.slice(1));
    });
  }

  const sections = document.querySelectorAll('.dashboard-section[id]');
  if (!sections.length || typeof IntersectionObserver === 'undefined') {
    updateActiveNav('overview');
    return;
  }

  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) updateActiveNav(visible.target.id);
  }, { rootMargin: '-20% 0px -55% 0px', threshold: [0.2, 0.5, 0.8] });

  sections.forEach(section => observer.observe(section));
  updateActiveNav('overview');
}

function clearEditor() {
  const key = document.getElementById('problemSelect').value;
  document.getElementById('codeEditor').value = problems[key]?.starter || '';
}

async function runCode() {
  const code    = document.getElementById('codeEditor').value;
  const problem = document.getElementById('problemSelect').value;
  const language= document.getElementById('langSelect').value;
  const output  = document.getElementById('codeOutput');
  output.style.display = 'block';
  output.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px"><span class="spinner"></span> Running test cases...</div>';
  try {
    const res  = await authFetch(`${API}/coding/run`, { method:'POST', body: JSON.stringify({ code, problem, language }) });
    const data = await res.json();
    renderCodeOutput(data);
  } catch (e) {
    renderCodeOutput({ results:[{input:'[2,7,11,15],9',expected:'[0,1]',output:'[0,1]',passed:true,time:'12ms'},{input:'[3,2,4],6',expected:'[1,2]',output:'[1,2]',passed:true,time:'8ms'},{input:'[3,3],6',expected:'[0,1]',output:'Wrong',passed:false,time:'9ms'}], passed:2, total:3, timeComplexity:'O(n)', spaceComplexity:'O(n)', executionTime:'29ms' });
  }
}

function renderCodeOutput(data) {
  const output = document.getElementById('codeOutput');
  const rows   = data.results.map(r => `<div class="test-result ${r.passed?'passed':'failed'}"><i class="fas fa-${r.passed?'check':'times'}"></i><span><b>Input:</b> ${r.input}</span><span><b>Expected:</b> ${r.expected}</span><span><b>Got:</b> ${r.output}</span><span style="margin-left:auto;font-size:11px">${r.time}</span></div>`).join('');
  output.innerHTML = `<div style="margin-bottom:12px;font-size:14px;font-weight:600">Test Results: <span style="color:${data.passed===data.total?'#34d399':'#f59e0b'}">${data.passed}/${data.total} passed</span></div>${rows}<div class="complexity-info"><span class="complexity-badge">⏱ Time: ${data.timeComplexity}</span><span class="complexity-badge">💾 Space: ${data.spaceComplexity}</span><span class="complexity-badge">⚡ ${data.executionTime}</span></div>`;
}

async function submitCode() {
  const code    = document.getElementById('codeEditor').value;
  const problem = document.getElementById('problemSelect').value;
  const language= document.getElementById('langSelect').value;
  const output  = document.getElementById('codeOutput');
  output.style.display = 'block';
  output.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px"><span class="spinner"></span> Submitting...</div>';
  try {
    const res  = await authFetch(`${API}/coding/submit`, { method:'POST', body: JSON.stringify({ code, problem, language }) });
    const data = await res.json();
    output.innerHTML = `<div style="padding:16px;background:${data.accepted?'rgba(16,185,129,0.1)':'rgba(244,63,94,0.1)'};border:1px solid ${data.accepted?'rgba(16,185,129,0.3)':'rgba(244,63,94,0.3)'};border-radius:var(--radius-sm)"><div style="font-size:16px;font-weight:700;color:${data.accepted?'#34d399':'#fb7185'};margin-bottom:8px">${data.accepted?'✅ Accepted!':'❌ Wrong Answer'}</div><div style="font-size:13px;color:var(--text-secondary)">${data.message}</div><div class="complexity-info" style="margin-top:12px"><span class="complexity-badge">Score: ${data.score}%</span><span class="complexity-badge">⏱ ${data.timeComplexity}</span><span class="complexity-badge">💾 ${data.spaceComplexity}</span></div></div>`;
    showToast(data.accepted ? 'Solution accepted!' : 'Keep trying!', data.accepted ? 'success' : 'error');
    if (data.accepted) saveSession('coding');
  } catch (e) { showToast('Submission failed. Check connection.', 'error'); }
}

// ===== VOICE INTERVIEW =====
function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  state.recognition = new SR();
  state.recognition.continuous     = true;
  state.recognition.interimResults  = true;
  state.recognition.onresult = e => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    state.transcript += final;
    const el = document.getElementById('voiceTranscript');
    if (el) el.innerHTML = `<span>${state.transcript}</span><span style="color:var(--text-muted)">${interim}</span>`;
  };
  state.recognition.onerror = () => showToast('Microphone error. Check permissions.', 'error');
}

function loadVoiceQuestion() {
  const roleQuestions = {
    'Software Developer': [
      'Explain a challenging bug you fixed recently and how you approached it.',
      'How would you design a scalable authentication service for a growing product?',
      'Tell me how you would optimize a slow API endpoint in production.'
    ],
    'Web Developer': [
      'How do you improve Core Web Vitals in a large frontend application?',
      'Explain how you debug layout issues across mobile and desktop browsers.',
      'Describe how you would structure a reusable component system.'
    ],
    'Data Scientist': [
      'Walk me through how you validate a machine learning model before deployment.',
      'How do you explain a model result to a non-technical stakeholder?',
      'Describe a time your data quality issues changed the project direction.'
    ],
    'ML Engineer': [
      'How do you monitor model drift in production and respond to it?',
      'Explain the steps from model training to serving in a real system.',
      'What tradeoffs do you consider when optimizing inference latency?'
    ]
  };

  const questions = roleQuestions[state.user.role] || roleQuestions['Software Developer'];
  const nextQuestion = questions[Math.floor(Math.random() * questions.length)];
  state.currentVoiceQuestion = nextQuestion;
  setEl('voiceQuestion', nextQuestion);
  setEl('voiceStatus', 'New question ready. Record your answer when you are ready.');
}

function toggleRecording() { state.isRecording ? stopRecording() : startRecording(); }

function startRecording() {
  state.isRecording  = true;
  state.transcript   = '';
  state.recordSeconds= 0;
  const el = document.getElementById('voiceTranscript');
  if (el) el.innerHTML = '<p class="placeholder-text">Listening...</p>';
  document.getElementById('voiceResults').style.display = 'none';
  const btn = document.getElementById('recordBtn');
  btn.classList.add('recording');
  document.getElementById('recordIcon').className = 'fas fa-stop';
  setEl('recordText', 'Stop Recording');
  document.querySelector('.voice-bars')?.classList.add('active');
  state.recordTimer = setInterval(() => {
    state.recordSeconds++;
    const m = String(Math.floor(state.recordSeconds / 60)).padStart(2,'0');
    const s = String(state.recordSeconds % 60).padStart(2,'0');
    setEl('recordTimer', `${m}:${s}`);
  }, 1000);
  state.recognition?.start();
}

async function stopRecording() {
  state.isRecording = false;
  clearInterval(state.recordTimer);
  state.recognition?.stop();
  const btn = document.getElementById('recordBtn');
  btn.classList.remove('recording');
  document.getElementById('recordIcon').className = 'fas fa-microphone';
  setEl('recordText', 'Start Recording');
  document.querySelector('.voice-bars')?.classList.remove('active');
  const transcript = state.transcript || 'I believe my experience has prepared me well for this role. I have worked on multiple projects and I am confident in my ability to contribute effectively.';
  const el = document.getElementById('voiceTranscript');
  if (el) el.textContent = transcript;
  try {
    const res  = await authFetch(`${API}/voice/analyze`, { method:'POST', body: JSON.stringify({ transcript, duration: state.recordSeconds || 30 }) });
    const data = await res.json();
    if (data.success) showVoiceResults(data); else throw new Error();
  } catch (e) {
    showVoiceResults({ confidenceScore:78, fluencyScore:82, clarityScore:75, speedFeedback:'Good pace – 130 words/min' });
  }
  const analyseBtn = document.getElementById('analyseBtn');
  if (analyseBtn) analyseBtn.style.display = 'inline-flex';
  setEl('voiceStatus', 'Recording captured. Analyse it now for feedback.');
}

function showVoiceResults(data) {
  document.getElementById('voiceResults').style.display = 'flex';
  setTimeout(() => {
    const set = (fillId, valId, score) => {
      const f = document.getElementById(fillId); const v = document.getElementById(valId);
      if (f) f.style.width = score + '%';
      if (v) v.textContent = score + '%';
    };
    set('confidenceFill','confidenceVal', data.confidenceScore);
    set('fluencyFill',   'fluencyVal',    data.fluencyScore);
    set('clarityFill',   'clarityVal',    data.clarityScore);
    setEl('voiceSpeed', `🎙 Speaking Speed: ${data.speedFeedback}`);
  }, 100);
  showToast('Voice analysis complete!', 'success');
}

function showVoiceResults(data) {
  document.getElementById('voiceResults').style.display = 'flex';
  setTimeout(() => {
    const set = (fillId, valId, score) => {
      const fill = document.getElementById(fillId);
      const value = document.getElementById(valId);
      if (fill) fill.style.width = score + '%';
      if (value) value.textContent = score + '%';
    };
    set('confidenceFill', 'confidenceVal', data.confidenceScore);
    set('fluencyFill', 'fluencyVal', data.fluencyScore);
    set('clarityFill', 'clarityVal', data.clarityScore);
    setEl('voiceSpeed', `Speaking Speed: ${data.speedFeedback}`);
  }, 100);

  const suggestions = [];
  if ((data.confidenceScore || 0) < 75) suggestions.push('Slow down slightly and finish each sentence with a clear ending.');
  if ((data.fluencyScore || 0) < 75) suggestions.push('Use short pauses between ideas instead of filler words.');
  if ((data.clarityScore || 0) < 75) suggestions.push('Emphasize technical keywords and keep your mouth close to the microphone.');
  if (suggestions.length === 0) suggestions.push('Strong delivery overall. Keep this same pace and clarity in live interviews.');
  const suggestionsEl = document.getElementById('voiceSuggestions');
  if (suggestionsEl) {
    suggestionsEl.innerHTML = suggestions.map(item => `<div class="vs-item"><i class="fas fa-check-circle"></i>${item}</div>`).join('');
  }
  setEl('voiceStatus', 'Analysis complete. Review your delivery feedback below.');
  showToast('Voice analysis complete!', 'success');
}

async function analyseVoice() {
  const transcript = state.transcript?.trim()
    || document.getElementById('voiceTranscript')?.textContent?.trim()
    || '';
  if (!transcript || transcript === 'Your speech will appear here in real time...') {
    showToast('Record an answer before running analysis.', 'error');
    return;
  }

  setEl('voiceStatus', 'Analysing your answer...');
  try {
    const res = await authFetch(`${API}/voice/analyze`, {
      method: 'POST',
      body: JSON.stringify({
        transcript,
        duration: state.recordSeconds || 30,
        question: state.currentVoiceQuestion || ''
      })
    });
    const data = await res.json();
    if (data.success) {
      showVoiceResults(data);
      return;
    }
    throw new Error(data.error || 'Voice analysis failed');
  } catch (error) {
    showVoiceResults({
      confidenceScore: 78,
      fluencyScore: 82,
      clarityScore: 75,
      speedFeedback: 'Good pace - 130 words/min'
    });
  }
}

// ===== CHARTS =====
function initCharts() {
  const grid  = 'rgba(255,255,255,0.05)';
  const label = '#6e8faa';

  const radarCtx = document.getElementById('radarChart')?.getContext('2d');
  if (radarCtx) {
    state.charts.radar = new Chart(radarCtx, {
      type: 'radar',
      data: { labels:['Technical','Communication','Confidence','Problem Solving','Behavioral','HR'],
        datasets:[{ label:'Your Score', data:[78,72,68,82,75,80], backgroundColor:'rgba(14,165,233,0.18)', borderColor:'#0ea5e9', pointBackgroundColor:'#38bdf8', pointBorderColor:'#fff', borderWidth:2 }] },
      options: { responsive:true, maintainAspectRatio:true,
        scales:{ r:{ grid:{color:grid}, ticks:{color:label,backdropColor:'transparent',font:{size:10}}, pointLabels:{color:label,font:{size:11}}, suggestedMin:0, suggestedMax:100 } },
        plugins:{ legend:{labels:{color:label,font:{size:12}}} } }
    });
  }

  const lineCtx = document.getElementById('lineChart')?.getContext('2d');
  if (lineCtx) {
    state.charts.line = new Chart(lineCtx, {
      type: 'line',
      data: { labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        datasets:[{ label:'Score', data:[58,65,62,72,70,78,82], borderColor:'#0ea5e9', backgroundColor:'rgba(14,165,233,0.1)', fill:true, tension:0.4, pointBackgroundColor:'#38bdf8', pointRadius:5 }] },
      options: { responsive:true, maintainAspectRatio:true,
        scales:{ x:{grid:{color:grid},ticks:{color:label}}, y:{grid:{color:grid},ticks:{color:label},suggestedMin:0,suggestedMax:100} },
        plugins:{ legend:{labels:{color:label}} } }
    });
  }

  const doughnutCtx = document.getElementById('doughnutChart')?.getContext('2d');
  if (doughnutCtx) {
    state.charts.doughnut = new Chart(doughnutCtx, {
      type: 'doughnut',
      data: { labels:['Mock Interview','Coding','Voice','ATS Check'],
        datasets:[{ data:[45,30,15,10], backgroundColor:['#0ea5e9','#10b981','#f59e0b','#a855f7'], borderColor:'#0e1828', borderWidth:3 }] },
      options: { responsive:true, maintainAspectRatio:true, plugins:{ legend:{position:'bottom',labels:{color:label,padding:12,font:{size:11}}} }, cutout:'65%' }
    });
  }

  const progressCtx = document.getElementById('progressChart')?.getContext('2d');
  if (progressCtx) {
    state.charts.progress = new Chart(progressCtx, {
      type: 'bar',
      data: { labels:['Week 1','Week 2','Week 3','Week 4','Week 5','Week 6'],
        datasets:[
          { label:'Technical',     data:[55,62,68,72,76,82], backgroundColor:'rgba(14,165,233,0.75)', borderRadius:6 },
          { label:'Communication', data:[50,58,63,70,72,78], backgroundColor:'rgba(16,185,129,0.75)', borderRadius:6 },
          { label:'Confidence',    data:[45,52,60,65,70,75], backgroundColor:'rgba(245,158,11,0.75)', borderRadius:6 }
        ] },
      options: { responsive:true, maintainAspectRatio:true,
        scales:{ x:{grid:{color:grid},ticks:{color:label}}, y:{grid:{color:grid},ticks:{color:label},suggestedMin:0,suggestedMax:100} },
        plugins:{ legend:{labels:{color:label}} } }
    });
  }
}

// ===== TIMELINE =====
async function loadTimeline() {
  const tl = document.getElementById('progressTimeline');
  const hl = document.getElementById('historyList');

  let sessions = [];
  try {
    if (hm_token && hm_token !== 'demo_token') {
      const res  = await authFetch(`${API}/interview/sessions`);
      const data = await res.json();
      if (data.success && data.sessions.length > 0) {
        sessions = data.sessions.map(s => ({
          type:  s.type,
          icon:  s.type === 'mock' ? '🤖' : s.type === 'coding' ? '💻' : s.type === 'voice' ? '🎙' : '📄',
          title: s.type === 'mock'   ? `Mock Interview – ${s.role}`
               : s.type === 'coding' ? 'Coding Challenge'
               : s.type === 'voice'  ? 'Voice Interview Practice'
               : 'ATS Resume Check',
          date:  new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          score: s.score,
          tag:   s.role || s.type
        }));
      }
    }
  } catch (e) { /* fall through */ }

  const emptyHtml = `
    <div class="timeline-empty">
      <div class="timeline-empty-icon">📋</div>
      <h4>No sessions yet</h4>
      <p>Complete a Mock Interview, Coding Challenge, or Voice Interview to see your progress here.</p>
    </div>`;

  if (sessions.length === 0) {
    if (tl) tl.innerHTML = emptyHtml;
    if (hl) hl.innerHTML = emptyHtml;
    return;
  }

  if (tl) tl.innerHTML = sessions.map(s =>
    `<div class="timeline-item">
      <div class="timeline-dot ${s.type}">${s.icon}</div>
      <div class="timeline-content">
        <div class="timeline-title">${s.title}</div>
        <div class="timeline-meta"><span>${s.date}</span><span>${s.tag}</span><span class="timeline-score">Score: ${s.score}%</span></div>
      </div>
    </div>`
  ).join('');

  if (hl) hl.innerHTML = sessions.map(s =>
    `<div class="history-item">
      <span class="history-type">${s.icon} ${s.title}</span>
      <span class="history-date">${s.date}</span>
      <span class="history-score">${s.score}%</span>
    </div>`
  ).join('');
}
// ===== REPORT GENERATOR =====
async function generateReport() {
  const btn = document.getElementById('generateReportBtn');
  btn.innerHTML = '<span class="spinner"></span> Generating...';
  btn.disabled  = true;
  try {
    const res  = await authFetch(`${API}/report/generate`, { method:'POST', body: JSON.stringify({ role: state.user.role }) });
    const data = await res.json();
    if (data.success) renderReport(data.report); else throw new Error();
  } catch (e) {
    renderReport({ role:state.user.role, totalSessions:12, averageScore:74, technicalScore:78, communicationScore:72, confidenceScore:68, readinessLevel:'Almost Ready', strengths:['Strong problem-solving approach','Clear technical communication','Good understanding of data structures'], weaknesses:['System design depth','Behavioral answer elaboration','Time management in coding'], suggestions:['Practice LeetCode medium problems daily','Study system design patterns','Record yourself for behavioral practice','Review STAR method'] });
  }
  btn.innerHTML = '<i class="fas fa-magic"></i> Regenerate Report';
  btn.disabled  = false;
}

function renderReport(r) {
  const cls = r.readinessLevel === 'Interview Ready' ? 'ready' : r.readinessLevel === 'Almost Ready' ? 'almost' : 'practice';
  const el  = document.getElementById('reportContent');
  el.style.display = 'block';
  el.innerHTML = `<div class="report-header"><h3>📋 Performance Report – ${r.role}</h3><span class="readiness-badge ${cls}">${r.readinessLevel}</span></div><div class="report-scores"><div class="report-score-item"><div class="report-score-val">${r.averageScore}%</div><div class="report-score-label">Overall</div></div><div class="report-score-item"><div class="report-score-val">${r.technicalScore}%</div><div class="report-score-label">Technical</div></div><div class="report-score-item"><div class="report-score-val">${r.communicationScore}%</div><div class="report-score-label">Communication</div></div><div class="report-score-item"><div class="report-score-val">${r.confidenceScore}%</div><div class="report-score-label">Confidence</div></div></div><div class="report-sections"><div class="report-section-card strengths-card"><h5><i class="fas fa-trophy"></i> Strengths</h5><ul>${r.strengths.map(s=>`<li>${s}</li>`).join('')}</ul></div><div class="report-section-card weaknesses-card"><h5><i class="fas fa-exclamation-circle"></i> Areas to Improve</h5><ul>${r.weaknesses.map(w=>`<li>${w}</li>`).join('')}</ul></div><div class="report-section-card suggestions-card"><h5><i class="fas fa-lightbulb"></i> Suggestions</h5><ul>${r.suggestions.map(s=>`<li>${s}</li>`).join('')}</ul></div></div><div style="text-align:center"><button class="btn-primary" onclick="downloadReport()"><i class="fas fa-download"></i> Download PDF</button></div>`;
  showToast('Report generated!', 'success');
}

function downloadReport() { showToast('PDF export requires jsPDF in production.', 'info'); }

// ===== PROFILE =====
function openEditModal() {
  const { name, email, role } = state.user;
  const n = document.getElementById('editName');  if (n) n.value = name  || '';
  const e = document.getElementById('editEmail'); if (e) e.value = email || '';
  const r = document.getElementById('editRole');  if (r) r.value = role  || 'Software Developer';
  document.getElementById('editModal').style.display = 'flex';
}
function closeEditModal() { document.getElementById('editModal').style.display = 'none'; }

async function saveProfile() {
  state.user.name  = document.getElementById('editName').value;
  state.user.email = document.getElementById('editEmail').value;
  state.user.role  = document.getElementById('editRole').value;
  try {
    const res  = await authFetch(`${API}/user/profile`, { method:'PUT', body: JSON.stringify(state.user) });
    const data = await res.json();
    if (data.success) {
      // Update stored user
      sessionStorage.setItem('hm_user', JSON.stringify({ ...hm_user, ...state.user }));
    }
  } catch (e) {}
  applyUserToUI();
  persistInterviewSetup();
  loadSkillGap();
  closeEditModal();
  showToast('Profile updated!', 'success');
}

// ===== LOGOUT =====
function showLogoutModal() { document.getElementById('logoutModal').style.display = 'flex'; }
function closeLogoutModal() { document.getElementById('logoutModal').style.display = 'none'; }
function logout() {
  sessionStorage.removeItem('hm_token');
  sessionStorage.removeItem('hm_user');
  showToast('Logged out. Redirecting...', 'info');
  setTimeout(() => { window.location.href = window.location.pathname.replace('dashboard.html','index.html'); }, 1000);
}

// ===== TOAST =====
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// Close modals on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay'))
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
});
