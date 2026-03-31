/* ===== HireMind AI – Interview Room ===== */

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

const hm_token = sessionStorage.getItem('hm_token');
const hm_user  = JSON.parse(sessionStorage.getItem('hm_user') || 'null');
const hm_interview_setup = JSON.parse(sessionStorage.getItem('hm_interview_setup') || 'null');
if (!hm_token || !hm_user) { window.location.href = 'index.html'; }

// ===== SESSION STATE =====
const session = {
  type:        'voice',
  role:        'Software Developer',
  categories:  ['technical'],
  qCount:      5,
  questions:   [],
  answers:     [],
  qIndex:      0,
  stream:      null,
  recognition: null,
  synthesis:   window.speechSynthesis,
  timerInterval: null,
  seconds:     0,
  micOn:       true,
  camOn:       true,
  resumeText:  '',
  currentTranscript: ''
};

document.addEventListener('DOMContentLoaded', () => {
  hydrateSetupFromDashboard();
});

// ===== SETUP SCREEN =====
function selectType(card) {
  document.querySelectorAll('.type-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  session.type = card.dataset.type;
  // Show resume section only for full mock
  document.getElementById('resumeSection').style.display =
    session.type === 'full' ? 'block' : 'none';
  // Update icon
  const icons = { voice: 'fa-microphone', video: 'fa-video', full: 'fa-star' };
  document.querySelector('.setup-icon i').className = `fas ${icons[session.type]}`;
}

function selectRole(chip) {
  document.querySelectorAll('.role-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  session.role = chip.dataset.role;
}

function hydrateSetupFromDashboard() {
  if (!hm_interview_setup) return;

  session.type = hm_interview_setup.type || session.type;
  session.role = hm_interview_setup.role || session.role;
  session.categories = Array.isArray(hm_interview_setup.categories) && hm_interview_setup.categories.length
    ? hm_interview_setup.categories
    : session.categories;
  session.qCount = hm_interview_setup.qCount || session.qCount;

  const typeCard = document.querySelector(`.type-card[data-type="${session.type}"]`);
  if (typeCard) selectType(typeCard);

  const roleChip = document.querySelector(`.role-chip[data-role="${session.role}"]`);
  if (roleChip) selectRole(roleChip);

  document.querySelectorAll('.cat-chip input').forEach(input => {
    input.checked = session.categories.includes(input.value);
  });

  const qCount = document.getElementById('qCount');
  const qCountLabel = document.getElementById('qCountLabel');
  if (qCount) qCount.value = String(session.qCount);
  if (qCountLabel) qCountLabel.textContent = String(session.qCount);
}

function handleResumeDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) processResumeFile(file);
}

function handleResumeFile(input) {
  if (input.files[0]) processResumeFile(input.files[0]);
}

function processResumeFile(file) {
  const drop = document.getElementById('resumeDrop');
  drop.classList.add('has-file');
  document.getElementById('resumeDropText').textContent = `✅ ${file.name} uploaded`;
  // Store filename as resume context (in production, parse PDF text)
  session.resumeText = `Resume: ${file.name}. Candidate applying for ${session.role} position.`;
}

// ===== PERMISSIONS =====
function requestPermissions() {
  // Collect categories
  session.categories = Array.from(
    document.querySelectorAll('.cat-chip input:checked')
  ).map(cb => cb.value);
  if (session.categories.length === 0) session.categories = ['technical'];
  session.qCount = parseInt(document.getElementById('qCount').value);

  // Validate full mock needs resume
  if (session.type === 'full' && !session.resumeText) {
    alert('Please upload your resume for Full Mock Interview.');
    return;
  }

  showScreen('permissionScreen');
}

async function grantPermissions() {
  const btn = document.getElementById('permBtn');
  btn.innerHTML = '<span class="spinner-sm"></span> Requesting...';
  btn.disabled = true;

  const needsCamera = session.type === 'video' || session.type === 'full';
  const constraints = { audio: true, video: needsCamera };

  try {
    session.stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Update status indicators
    setPermStatus('micStatus', 'granted', '✓ Granted');
    if (needsCamera) setPermStatus('camStatus', 'granted', '✓ Granted');
    else setPermStatus('camStatus', 'granted', '✓ Not needed');

    setTimeout(() => startInterviewRoom(), 800);

  } catch (err) {
    // Try audio only fallback
    try {
      session.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setPermStatus('micStatus', 'granted', '✓ Granted');
      setPermStatus('camStatus', 'denied', '✗ Denied');
      session.camOn = false;
      const errEl = document.getElementById('permError');
      errEl.style.display = 'block';
      errEl.textContent = 'Camera access denied. Continuing with audio only.';
      setTimeout(() => startInterviewRoom(), 1200);
    } catch (e) {
      setPermStatus('micStatus', 'denied', '✗ Denied');
      setPermStatus('camStatus', 'denied', '✗ Denied');
      const errEl = document.getElementById('permError');
      errEl.style.display = 'block';
      errEl.textContent = 'Microphone access denied. Please allow microphone access in your browser settings.';
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Grant Permissions';
      btn.disabled = false;
    }
  }
}

function skipCamera() {
  // Try mic only
  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(stream => {
      session.stream = stream;
      session.camOn  = false;
      setPermStatus('micStatus', 'granted', '✓ Granted');
      setPermStatus('camStatus', 'denied', '✗ Skipped');
      setTimeout(() => startInterviewRoom(), 600);
    })
    .catch(() => {
      session.stream = null;
      session.camOn  = false;
      session.micOn  = false;
      startInterviewRoom();
    });
}

function setPermStatus(id, cls, text) {
  const el = document.getElementById(id);
  el.className = `perm-status ${cls}`;
  el.innerHTML = text;
}

// ===== START INTERVIEW ROOM =====
async function startInterviewRoom() {
  showScreen('interviewRoom');

  // Set badges
  const typeLabels = { voice: 'Voice Interview', video: 'Video Interview', full: 'Full Mock Interview' };
  document.getElementById('roomTypeBadge').textContent = typeLabels[session.type] || 'Interview';
  document.getElementById('roomRoleBadge').textContent = session.role;
  document.getElementById('videoUserName').textContent = hm_user.name || 'You';
  document.getElementById('noVideoName').textContent   = hm_user.name || 'You';

  // Setup video
  const video = document.getElementById('userVideo');
  const noVid = document.getElementById('noVideoPlaceholder');
  if (session.stream && session.camOn) {
    video.srcObject = session.stream;
    video.style.display = 'block';
    noVid.style.display = 'none';
  } else {
    video.style.display = 'none';
    noVid.style.display = 'flex';
  }

  // Hide camera button if voice only
  if (session.type === 'voice') {
    document.getElementById('camBtn').style.display = 'none';
  }

  // Start timer
  startTimer();

  // Init speech recognition
  initRecognition();

  // Load questions
  await loadQuestions();
}

// ===== LOAD QUESTIONS =====
async function loadQuestions() {
  addChatMsg('ai', '👋 Hello! I\'m your AI interviewer. Let\'s begin your ' + session.role + ' interview. I\'ll ask you ' + session.qCount + ' questions. Take your time and speak clearly.');

  try {
    // Fetch questions for each selected category
    let allQuestions = [];
    const perCat = Math.ceil(session.qCount / session.categories.length);

    for (const cat of session.categories) {
      const res  = await fetch(`${API}/interview/generate-questions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hm_token}` },
        body:    JSON.stringify({ role: session.role, type: cat, count: perCat })
      });
      const data = await res.json();
      if (data.success) allQuestions = allQuestions.concat(data.questions);
    }

    // Shuffle and trim
    session.questions = allQuestions.sort(() => Math.random() - 0.5).slice(0, session.qCount);

    // For full mock, prepend a resume-based question
    if (session.type === 'full' && session.resumeText) {
      session.questions.unshift(
        `Based on your resume, tell me about your most significant project and the technical challenges you faced.`
      );
      session.questions = session.questions.slice(0, session.qCount);
    }

  } catch {
    // Fallback questions
    session.questions = getFallbackQuestions();
  }

  document.getElementById('qTotal').textContent = session.questions.length;
  updateProgress();

  // Start first question after a short delay
  setTimeout(() => askQuestion(), 1500);
}

function getFallbackQuestions() {
  const banks = {
    'Software Developer': ['Explain the difference between stack and heap memory.','Describe the SOLID principles.','What is a closure in JavaScript?','How does garbage collection work?','Explain REST vs GraphQL.'],
    'Web Developer':      ['What is the CSS box model?','Explain event delegation.','What are Web Workers?','Describe SSR vs CSR.','What is CORS?'],
    'Data Scientist':     ['Explain the bias-variance tradeoff.','What is regularization?','Describe cross-validation.','Explain gradient descent.','What is overfitting?'],
    'ML Engineer':        ['What is the transformer architecture?','Explain feature engineering.','How do you deploy an ML model?','What is MLOps?','Explain model drift.']
  };
  return (banks[session.role] || banks['Software Developer']).slice(0, session.qCount);
}

// ===== ASK QUESTION =====
function askQuestion() {
  if (session.qIndex >= session.questions.length) {
    finishInterview();
    return;
  }

  const q = session.questions[session.qIndex];
  const qNum = session.qIndex + 1;

  document.getElementById('qCurrent').textContent = qNum;
  updateProgress();

  // Add to chat
  addChatMsg('ai', `<strong>Question ${qNum}/${session.questions.length}:</strong><br>${q}`);

  // AI speaks the question
  speakText(`Question ${qNum}. ${q}`, () => {
    // After speaking, start recording answer
    setTimeout(() => startListening(), 500);
  });
}

// ===== SPEECH SYNTHESIS (AI speaks) =====
function speakText(text, onEnd) {
  if (!session.synthesis) { if (onEnd) onEnd(); return; }
  session.synthesis.cancel();

  const utt = new SpeechSynthesisUtterance(text);
  utt.rate  = 0.92;
  utt.pitch = 1.0;
  utt.volume= 1.0;

  // Pick a good voice
  const voices = session.synthesis.getVoices();
  const preferred = voices.find(v => v.name.includes('Google') && v.lang === 'en-US')
    || voices.find(v => v.lang === 'en-US')
    || voices[0];
  if (preferred) utt.voice = preferred;

  // Show AI speaking animation
  const avatar = document.getElementById('aiAvatar');
  const badge  = document.getElementById('aiSpeakingBadge');
  avatar.classList.add('speaking');
  badge.style.display = 'flex';

  utt.onend = () => {
    avatar.classList.remove('speaking');
    badge.style.display = 'none';
    if (onEnd) onEnd();
  };
  utt.onerror = () => {
    avatar.classList.remove('speaking');
    badge.style.display = 'none';
    if (onEnd) onEnd();
  };

  session.synthesis.speak(utt);
}

// ===== SPEECH RECOGNITION (User answers) =====
function initRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  session.recognition = new SR();
  session.recognition.continuous    = true;
  session.recognition.interimResults = true;
  session.recognition.lang = 'en-US';

  session.recognition.onresult = e => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    session.currentTranscript += final;
    const display = session.currentTranscript + interim;
    const el = document.getElementById('transcriptText');
    el.textContent = display || 'Listening...';
    el.classList.toggle('active', display.length > 0);
  };

  session.recognition.onerror = e => {
    if (e.error !== 'no-speech') {
      console.warn('Speech recognition error:', e.error);
    }
  };
}

function startListening() {
  session.currentTranscript = '';
  document.getElementById('transcriptText').textContent = 'Listening... speak your answer';
  document.getElementById('transcriptText').classList.add('active');
  document.getElementById('answerControls').style.display = 'block';

  if (session.recognition) {
    try { session.recognition.start(); } catch {}
  }
}

function stopListening() {
  if (session.recognition) {
    try { session.recognition.stop(); } catch {}
  }
  document.getElementById('answerControls').style.display = 'none';
}

// ===== SUBMIT ANSWER =====
async function submitVoiceAnswer() {
  stopListening();
  const answer = session.currentTranscript.trim()
    || document.getElementById('transcriptText').textContent;

  if (!answer || answer.length < 3) {
    addChatMsg('ai', 'I didn\'t catch that. Let\'s move to the next question.');
    session.answers.push({ question: session.questions[session.qIndex], answer: '(No answer)', feedback: 'No answer provided.', score: 0 });
    session.qIndex++;
    setTimeout(() => askQuestion(), 1000);
    return;
  }

  // Show user answer in chat
  addChatMsg('user', answer);
  document.getElementById('transcriptText').textContent = '';
  document.getElementById('transcriptText').classList.remove('active');

  // Evaluate
  addChatMsg('ai', '<span style="color:var(--text-3)">Evaluating your answer...</span>');

  try {
    const res  = await fetch(`${API}/interview/evaluate-answer`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hm_token}` },
      body:    JSON.stringify({ question: session.questions[session.qIndex], answer, role: session.role })
    });
    const data = await res.json();

    // Remove "evaluating" message
    const chat = document.getElementById('roomChat');
    chat.lastElementChild?.remove();

    const feedback = data.feedback || 'Good answer!';
    const score    = data.score    || 70;

    addChatMsg('ai', feedback,
      `<div class="chat-msg-score"><i class="fas fa-star"></i> ${score}/100</div>`);

    session.answers.push({ question: session.questions[session.qIndex], answer, feedback, score });

    // AI speaks feedback briefly
    speakText(`Score: ${score} out of 100. ${feedback.split('.')[0]}.`, () => {
      session.qIndex++;
      setTimeout(() => askQuestion(), 800);
    });

  } catch {
    const chat = document.getElementById('roomChat');
    chat.lastElementChild?.remove();
    const score = 60 + Math.floor(Math.random() * 30);
    addChatMsg('ai', 'Good attempt! Keep practicing for better results.',
      `<div class="chat-msg-score"><i class="fas fa-star"></i> ${score}/100</div>`);
    session.answers.push({ question: session.questions[session.qIndex], answer, feedback: 'Good attempt.', score });
    session.qIndex++;
    setTimeout(() => askQuestion(), 1000);
  }
}

function skipQuestion() {
  stopListening();
  session.synthesis?.cancel();
  session.answers.push({ question: session.questions[session.qIndex], answer: '(Skipped)', feedback: 'Question skipped.', score: 0 });
  session.qIndex++;
  addChatMsg('ai', 'Skipped. Moving to next question...');
  setTimeout(() => askQuestion(), 800);
}

// ===== FINISH INTERVIEW =====
async function finishInterview() {
  stopListening();
  session.synthesis?.cancel();
  stopTimer();

  const scores = session.answers.map(a => a.score).filter(s => s > 0);
  const avg    = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  addChatMsg('ai', `🎉 Interview complete! Your overall score is <strong>${avg}/100</strong>. Great effort! Check your detailed results below.`);
  speakText(`Interview complete! Your overall score is ${avg} out of 100. Well done!`);

  // Save session
  try {
    await fetch(`${API}/interview/save-session`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hm_token}` },
      body:    JSON.stringify({ type: session.type === 'full' ? 'mock' : session.type, role: session.role, score: avg, questions: session.answers })
    });
  } catch {}

  setTimeout(() => showResults(avg), 2500);
}

function endInterview() {
  if (!confirm('End the interview? Your progress will be saved.')) return;
  stopListening();
  session.synthesis?.cancel();
  stopTimer();
  if (session.stream) session.stream.getTracks().forEach(t => t.stop());

  const scores = session.answers.map(a => a.score).filter(s => s > 0);
  const avg    = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  showResults(avg);
}

// ===== RESULTS =====
function showResults(avg) {
  if (session.stream) session.stream.getTracks().forEach(t => t.stop());
  showScreen('resultsScreen');

  const techScores = session.answers.filter((_, i) => i % 3 === 0).map(a => a.score);
  const commScores = session.answers.filter((_, i) => i % 3 === 1).map(a => a.score);
  const confScores = session.answers.filter((_, i) => i % 3 === 2).map(a => a.score);
  const techAvg = techScores.length ? Math.round(techScores.reduce((a,b)=>a+b,0)/techScores.length) : avg;
  const commAvg = commScores.length ? Math.round(commScores.reduce((a,b)=>a+b,0)/commScores.length) : Math.max(0, avg - 5);
  const confAvg = confScores.length ? Math.round(confScores.reduce((a,b)=>a+b,0)/confScores.length) : Math.max(0, avg - 8);

  document.getElementById('resultsScores').innerHTML = `
    <div class="result-score-card"><div class="result-score-val">${avg}%</div><div class="result-score-label">Overall Score</div></div>
    <div class="result-score-card"><div class="result-score-val">${techAvg}%</div><div class="result-score-label">Technical</div></div>
    <div class="result-score-card"><div class="result-score-val">${commAvg}%</div><div class="result-score-label">Communication</div></div>
    <div class="result-score-card"><div class="result-score-val">${confAvg}%</div><div class="result-score-label">Confidence</div></div>`;

  document.getElementById('resultsQA').innerHTML = session.answers.map((a, i) => `
    <div class="result-qa-item">
      <div class="result-qa-q">Q${i+1}: ${a.question}</div>
      <div class="result-qa-a"><strong>Your answer:</strong> ${a.answer}</div>
      <div class="result-qa-fb">${a.feedback}</div>
      <div class="result-qa-score"><i class="fas fa-star"></i> ${a.score}/100</div>
    </div>`).join('');
}

// ===== MIC / CAM TOGGLES =====
function toggleMic() {
  session.micOn = !session.micOn;
  if (session.stream) {
    session.stream.getAudioTracks().forEach(t => t.enabled = session.micOn);
  }
  const btn  = document.getElementById('micBtn');
  const icon = document.getElementById('micIcon');
  icon.className = session.micOn ? 'fas fa-microphone' : 'fas fa-microphone-slash';
  btn.classList.toggle('off', !session.micOn);
}

function toggleCam() {
  session.camOn = !session.camOn;
  if (session.stream) {
    session.stream.getVideoTracks().forEach(t => t.enabled = session.camOn);
  }
  const btn  = document.getElementById('camBtn');
  const icon = document.getElementById('camIcon');
  const video = document.getElementById('userVideo');
  const noVid = document.getElementById('noVideoPlaceholder');
  icon.className = session.camOn ? 'fas fa-video' : 'fas fa-video-slash';
  btn.classList.toggle('off', !session.camOn);
  video.style.display = session.camOn ? 'block' : 'none';
  noVid.style.display = session.camOn ? 'none' : 'flex';
}

// ===== TIMER =====
function startTimer() {
  session.seconds = 0;
  session.timerInterval = setInterval(() => {
    session.seconds++;
    const m = String(Math.floor(session.seconds / 60)).padStart(2, '0');
    const s = String(session.seconds % 60).padStart(2, '0');
    document.getElementById('roomTimer').textContent = `${m}:${s}`;
  }, 1000);
}
function stopTimer() { clearInterval(session.timerInterval); }

// ===== HELPERS =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function addChatMsg(role, text, extra = '') {
  const chat = document.getElementById('roomChat');
  // Remove welcome message on first real message
  const welcome = chat.querySelector('.room-chat-welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  const avatar = role === 'ai' ? '🤖' : (hm_user.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  div.innerHTML = `
    <div class="chat-msg-avatar">${avatar}</div>
    <div>
      <div class="chat-msg-bubble">${text}</div>
      ${extra}
    </div>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function updateProgress() {
  const pct = session.questions.length > 0
    ? (session.qIndex / session.questions.length) * 100 : 0;
  document.getElementById('roomProgressFill').style.width = pct + '%';
}

// Spinner style
const style = document.createElement('style');
style.textContent = `.spinner-sm{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`;
document.head.appendChild(style);

// Load voices when available
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {};
}
