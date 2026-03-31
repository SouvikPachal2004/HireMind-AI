/* ===== HireMind AI – landing.js ===== */

// Smart API base — works both when served by Express and opened as file://
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

// Redirect if already logged in
if (sessionStorage.getItem('hm_token')) {
  window.location.href = window.location.pathname.replace('index.html','dashboard.html?v=20260331-4');
}

// ===== LOAD REAL STATS =====
async function loadPublicStats() {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setVal('statUsers', '...'); setVal('statInterviews', '...'); setVal('statSuccess', '...');
  try {
    const res  = await fetch(`${API}/stats/public`);
    const data = await res.json();
    if (!data.success) throw new Error();
    setVal('statUsers',      data.stats.totalUsers);
    setVal('statInterviews', data.stats.totalInterviews);
    setVal('statSuccess',    data.stats.successRate + '%');
  } catch {
    setVal('statUsers', '0'); setVal('statInterviews', '0'); setVal('statSuccess', '0%');
  }
}
loadPublicStats();

// ===== THEME TOGGLE =====
function toggleLandingTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  const icon    = document.getElementById('landingThemeIcon');
  if (icon) icon.className = isLight ? 'fas fa-moon' : 'fas fa-sun';
  localStorage.setItem('hm_landing_theme', isLight ? 'light' : 'dark');
}

// Restore saved theme on load
(function () {
  const saved = localStorage.getItem('hm_landing_theme');
  if (saved === 'light') {
    document.body.classList.add('light-theme');
    const icon = document.getElementById('landingThemeIcon');
    if (icon) icon.className = 'fas fa-moon';
  }
})();

// Navbar scroll effect
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
});

// Mobile nav toggle
function toggleMobileNav() {
  const nav  = document.getElementById('mobileNav');
  const icon = document.getElementById('hamburger').querySelector('i');
  nav.classList.toggle('open');
  icon.className = nav.classList.contains('open') ? 'fas fa-times' : 'fas fa-bars';
}

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  });
});

// Scroll animations
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.07 });

document.querySelectorAll('.feature-card, .step-card, .role-card, .tcard').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(28px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

// ===== MODALS =====
function openModal(id) {
  document.getElementById(id).style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
  document.body.style.overflow = '';
}
function handleOverlayClick(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}
function switchModal(from, to) {
  closeModal(from);
  setTimeout(() => openModal(to), 150);
}

// ===== LOGIN =====
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn      = e.target.querySelector('button[type="submit"]');
  const errEl    = document.getElementById('loginError');

  if (errEl) errEl.textContent = '';
  if (!email || !password) { showFormError('loginError', 'Please fill in all fields.'); return; }

  btn.innerHTML = '<span class="spinner-sm"></span> Logging in...';
  btn.disabled  = true;

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!data.success) {
      showFormError('loginError', data.error || 'Invalid email or password.');
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Log In';
      btn.disabled  = false;
      return;
    }

    sessionStorage.setItem('hm_token', data.token);
    sessionStorage.setItem('hm_user',  JSON.stringify(data.user));
    showToast(`Welcome back, ${data.user.name}!`, 'success');
    setTimeout(() => { window.location.href = window.location.pathname.replace('index.html','dashboard.html?v=20260331-4'); }, 800);

  } catch (err) {
    // Network error / backend offline — demo mode
    const demoUser = { name: email.split('@')[0], email, role: 'Software Developer' };
    sessionStorage.setItem('hm_token', 'demo_token');
    sessionStorage.setItem('hm_user',  JSON.stringify(demoUser));
    showToast(`Welcome, ${demoUser.name}! (Demo mode)`, 'success');
    setTimeout(() => { window.location.href = window.location.pathname.replace('index.html','dashboard.html?v=20260331-4'); }, 800);
  }
}

// ===== SIGNUP =====
async function handleSignup(e) {
  e.preventDefault();
  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const btn      = e.target.querySelector('button[type="submit"]');

  if (document.getElementById('signupError')) document.getElementById('signupError').textContent = '';
  if (!name || !email || !password) { showFormError('signupError', 'Please fill in all fields.'); return; }
  if (password.length < 6)          { showFormError('signupError', 'Password must be at least 6 characters.'); return; }

  btn.innerHTML = '<span class="spinner-sm"></span> Creating account...';
  btn.disabled  = true;

  try {
    const res  = await fetch(`${API}/auth/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password })
    });
    const data = await res.json();

    if (!data.success) {
      showFormError('signupError', data.error || 'Registration failed.');
      btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Free Account';
      btn.disabled  = false;
      return;
    }

    sessionStorage.setItem('hm_token', data.token);
    sessionStorage.setItem('hm_user',  JSON.stringify(data.user));
    showToast(`Account created! Welcome, ${data.user.name}!`, 'success');
    setTimeout(() => { window.location.href = window.location.pathname.replace('index.html','dashboard.html'); }, 800);

  } catch (e) {
    showFormError('signupError', 'Cannot connect to server. Make sure the backend is running.');
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Free Account';
    btn.disabled  = false;
  }
}

// ===== PASSWORD TOGGLE =====
function togglePassword(inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  iconEl.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
}

// ===== FORM ERROR =====
function showFormError(elId, msg) {
  const el = document.getElementById(elId);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  else showToast(msg, 'error');
}

// ===== TOAST =====
function showToast(msg, type = 'info') {
  const t = document.getElementById('landingToast');
  t.textContent = msg;
  t.className   = `landing-toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3500);
}

// Spinner style
const s = document.createElement('style');
s.textContent = `.spinner-sm{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`;
document.head.appendChild(s);
