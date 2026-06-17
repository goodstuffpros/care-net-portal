// ── /office — Standalone Admin Office ─────────────────────────────────────
// Completely separate from the portal. Own login, own token (localStorage: office_token),
// own visual design. Uses Authorization: Bearer — does not touch the portal cookie.

export function getOfficeHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Care Net Portal — Admin Office</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0f1117;
  --sidebar: #161b27;
  --card: #1c2133;
  --border: #2a3045;
  --accent: #1a8c83;
  --accent-light: #20a89d;
  --text: #e8eaf0;
  --muted: #8490a8;
  --danger: #e05050;
  --warn: #d97706;
  --success: #22c55e;
  --sidebar-w: 220px;
}
html, body { height: 100%; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif; font-size: 14px; }

/* ── LOGIN ── */
#login-screen {
  display: flex; align-items: center; justify-content: center; min-height: 100vh;
  background: radial-gradient(ellipse at 30% 40%, #1a3a38 0%, #0f1117 60%);
}
.login-box {
  background: var(--card); border: 1px solid var(--border); border-radius: 16px;
  padding: 40px 36px; width: 360px; box-shadow: 0 24px 60px rgba(0,0,0,.5);
}
.login-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
.login-logo-icon {
  width: 38px; height: 38px; background: var(--accent); border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
}
.login-logo-icon svg { width: 20px; height: 20px; fill: white; }
.login-logo-text { font-size: 15px; font-weight: 700; color: var(--text); line-height: 1.2; }
.login-logo-sub { font-size: 11px; color: var(--muted); font-weight: 400; }
.login-box h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
.login-box p { font-size: 13px; color: var(--muted); margin-bottom: 24px; }
.field { margin-bottom: 14px; }
.field label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
.field input {
  width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font-size: 14px; padding: 10px 12px; outline: none; transition: border-color .15s;
}
.field input:focus { border-color: var(--accent); }
.btn-login {
  width: 100%; background: var(--accent); color: white; border: none; border-radius: 8px;
  padding: 12px; font-size: 14px; font-weight: 700; cursor: pointer; margin-top: 8px;
  transition: background .15s;
}
.btn-login:hover { background: var(--accent-light); }
.login-error { color: var(--danger); font-size: 13px; margin-top: 10px; display: none; }

/* ── SHELL ── */
#app { display: none; height: 100vh; }
#app.visible { display: flex; }
.sidebar {
  width: var(--sidebar-w); background: var(--sidebar); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden;
}
.sidebar-logo {
  display: flex; align-items: center; gap: 10px; padding: 20px 16px 16px;
  border-bottom: 1px solid var(--border);
}
.sidebar-logo-icon {
  width: 32px; height: 32px; background: var(--accent); border-radius: 8px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.sidebar-logo-icon svg { width: 17px; height: 17px; fill: white; }
.sidebar-logo-text { font-size: 13px; font-weight: 700; color: var(--text); line-height: 1.3; }
.sidebar-logo-sub { font-size: 10px; color: var(--muted); }
nav { flex: 1; padding: 12px 8px; }
.nav-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px;
  color: var(--muted); font-size: 13px; font-weight: 500; cursor: pointer; transition: all .15s;
  margin-bottom: 2px; user-select: none;
}
.nav-item:hover { background: var(--card); color: var(--text); }
.nav-item.active { background: rgba(26,140,131,.15); color: var(--accent-light); }
.nav-item svg { width: 16px; height: 16px; flex-shrink: 0; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.nav-badge { margin-left: auto; background: var(--accent); color: white; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px; }
.sidebar-footer { padding: 12px 8px; border-top: 1px solid var(--border); }
.sidebar-user { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; }
.sidebar-avatar { width: 28px; height: 28px; background: var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; flex-shrink: 0; }
.sidebar-user-info { flex: 1; overflow: hidden; }
.sidebar-user-name { font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-user-role { font-size: 10px; color: var(--muted); }
.btn-signout { padding: 6px 10px; background: transparent; border: 1px solid var(--border); border-radius: 6px; color: var(--muted); font-size: 11px; cursor: pointer; margin-top: 6px; width: 100%; transition: all .15s; }
.btn-signout:hover { border-color: var(--danger); color: var(--danger); }

/* ── MAIN CONTENT ── */
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.topbar {
  height: 52px; background: var(--sidebar); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 20px; gap: 12px; flex-shrink: 0;
}
.topbar-title { font-size: 15px; font-weight: 700; color: var(--text); }
.topbar-sub { font-size: 12px; color: var(--muted); }
.topbar-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.btn-refresh {
  padding: 6px 12px; background: transparent; border: 1px solid var(--border); border-radius: 6px;
  color: var(--muted); font-size: 12px; cursor: pointer; transition: all .15s;
}
.btn-refresh:hover { border-color: var(--accent); color: var(--accent); }
.content { flex: 1; overflow-y: auto; padding: 20px; }

/* ── VIEWS ── */
.view { display: none; }
.view.active { display: block; }

/* ── STAT CARDS ── */
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px 16px; }
.stat-label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 8px; }
.stat-num { font-size: 28px; font-weight: 700; color: var(--text); }
.stat-sub { font-size: 11px; color: var(--muted); margin-top: 4px; }
.stat-accent { color: var(--accent-light); }
.stat-warn { color: var(--warn); }
.stat-success { color: var(--success); }

/* ── SECTION HEADERS ── */
.section-hdr { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
.section-hdr span { font-size: 11px; color: var(--muted); font-weight: 400; }

/* ── TABLES ── */
.table-wrap { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 20px; }
table { width: 100%; border-collapse: collapse; }
thead th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--border); background: rgba(255,255,255,.02); cursor: pointer; user-select: none; white-space: nowrap; }
thead th:hover { color: var(--text); }
tbody tr { border-bottom: 1px solid var(--border); transition: background .1s; }
tbody tr:last-child { border-bottom: none; }
tbody tr:hover { background: rgba(255,255,255,.025); }
tbody td { padding: 10px 14px; font-size: 13px; color: var(--text); vertical-align: middle; }
.td-muted { color: var(--muted); font-size: 12px; }
.td-email { color: var(--muted); font-size: 12px; }
.role-chip {
  display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em;
}
.role-caregiver { background: rgba(26,140,131,.15); color: var(--accent-light); }
.role-primary_family { background: rgba(99,130,210,.15); color: #7b9dde; }
.role-secondary_family { background: rgba(160,100,200,.15); color: #c090e0; }
.role-self_care { background: rgba(240,160,50,.15); color: #f0a040; }
.tier-active { color: var(--success); font-size: 11px; font-weight: 600; }
.tier-moderate { color: var(--warn); font-size: 11px; font-weight: 600; }
.tier-quiet { color: var(--muted); font-size: 11px; }
.action-btns { display: flex; gap: 6px; }
.btn-action { padding: 4px 10px; border-radius: 5px; font-size: 11px; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all .15s; }
.btn-deactivate { border-color: var(--border); color: var(--muted); background: transparent; }
.btn-deactivate:hover { border-color: var(--danger); color: var(--danger); }
.btn-approve { border-color: var(--accent); color: var(--accent); background: transparent; }
.btn-approve:hover { background: var(--accent); color: white; }
.btn-deny { border-color: var(--border); color: var(--muted); background: transparent; }
.btn-deny:hover { border-color: var(--danger); color: var(--danger); }

/* ── SEARCH BAR ── */
.search-row { display: flex; gap: 10px; margin-bottom: 14px; align-items: center; }
.search-input {
  flex: 1; background: var(--card); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font-size: 13px; padding: 8px 12px; outline: none; transition: border-color .15s;
  max-width: 320px;
}
.search-input:focus { border-color: var(--accent); }
.sort-select {
  background: var(--card); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font-size: 12px; padding: 8px 10px; outline: none; cursor: pointer;
}

/* ── PORTAL GROUPS ── */
.portal-group { background: var(--card); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 14px; overflow: hidden; }
.portal-group-hdr { padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,.02); }
.portal-group-name { font-size: 14px; font-weight: 700; color: var(--text); }
.portal-group-meta { font-size: 12px; color: var(--muted); margin-left: auto; }
.portal-health { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.health-active { background: var(--success); box-shadow: 0 0 6px var(--success); }
.health-moderate { background: var(--warn); }
.health-quiet { background: var(--muted); }

/* ── ACTIVITY FEED ── */
.activity-list { display: flex; flex-direction: column; gap: 6px; }
.activity-item { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; display: flex; align-items: flex-start; gap: 10px; }
.activity-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex-shrink: 0; margin-top: 4px; }
.activity-text { font-size: 13px; color: var(--text); line-height: 1.4; }
.activity-time { font-size: 11px; color: var(--muted); white-space: nowrap; margin-left: auto; }

/* ── STATUS CHIPS ── */
.status-chip { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.status-pending { background: rgba(217,119,6,.15); color: var(--warn); }
.status-approved { background: rgba(34,197,94,.15); color: var(--success); }
.status-denied { background: rgba(224,80,80,.15); color: var(--danger); }
.status-active { background: rgba(26,140,131,.15); color: var(--accent-light); }
.status-inactive { background: rgba(132,144,168,.1); color: var(--muted); }

/* ── EMAIL STATUS ── */
.email-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.email-verified { background: rgba(34,197,94,.12); color: var(--success); }
.email-unverified { background: rgba(217,119,6,.12); color: var(--warn); }

/* ── LOADING ── */
.loading { color: var(--muted); font-size: 13px; padding: 40px; text-align: center; }
.empty { color: var(--muted); font-size: 13px; padding: 30px; text-align: center; }

/* ── TOAST ── */
.toast {
  position: fixed; bottom: 24px; right: 24px; background: var(--card); border: 1px solid var(--border);
  border-radius: 10px; padding: 12px 16px; font-size: 13px; color: var(--text);
  box-shadow: 0 8px 32px rgba(0,0,0,.5); z-index: 200; transform: translateY(80px);
  opacity: 0; transition: all .3s; max-width: 320px; pointer-events: none;
}
.toast.show { transform: translateY(0); opacity: 1; }
.toast.success { border-color: var(--success); }
.toast.error { border-color: var(--danger); }
</style>
</head>
<body>

<!-- LOGIN -->
<div id="login-screen">
  <div class="login-box">
    <div class="login-logo">
      <div class="login-logo-icon">
        <svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="transparent"/><path d="M16 8a5 5 0 0 1 5 5c0 4-5 11-5 11S11 17 11 13a5 5 0 0 1 5-5z" fill="white"/><circle cx="16" cy="13" r="2" fill="#1a8c83"/></svg>
      </div>
      <div>
        <div class="login-logo-text">Care Net Portal</div>
        <div class="login-logo-sub">Admin Office</div>
      </div>
    </div>
    <h1>Sign In</h1>
    <p>Admin access only. This is a separate session from the portal.</p>
    <div class="field">
      <label>Email</label>
      <input type="email" id="login-email" autocomplete="email" placeholder="your@email.com" />
    </div>
    <div class="field">
      <label>Password</label>
      <input type="password" id="login-password" autocomplete="current-password" placeholder="••••••••" />
    </div>
    <button class="btn-login" id="btn-login">Sign In to Admin Office</button>
    <div class="login-error" id="login-error"></div>
  </div>
</div>

<!-- APP SHELL -->
<div id="app">
  <div class="sidebar">
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">
        <svg viewBox="0 0 32 32"><path d="M16 8a5 5 0 0 1 5 5c0 4-5 11-5 11S11 17 11 13a5 5 0 0 1 5-5z" fill="white"/><circle cx="16" cy="13" r="2" fill="#1a8c83"/></svg>
      </div>
      <div>
        <div class="sidebar-logo-text">Admin Office</div>
        <div class="sidebar-logo-sub">Care Net Portal</div>
      </div>
    </div>
    <nav>
      <div class="nav-item active" data-view="dashboard">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        Dashboard
      </div>
      <div class="nav-item" data-view="portals">
        <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        Portals
      </div>
      <div class="nav-item" data-view="users">
        <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Users
      </div>
      <div class="nav-item" data-view="queue">
        <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        Queue
        <span class="nav-badge" id="queue-badge" style="display:none"></span>
      </div>
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-avatar" id="sidebar-initials">—</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name" id="sidebar-name">Loading...</div>
          <div class="sidebar-user-role">Admin</div>
        </div>
      </div>
      <button class="btn-signout" id="btn-signout">Sign Out</button>
    </div>
  </div>

  <div class="main">
    <div class="topbar">
      <div>
        <div class="topbar-title" id="topbar-title">Dashboard</div>
        <div class="topbar-sub" id="topbar-sub">Overview of all portals and users</div>
      </div>
      <div class="topbar-right">
        <button class="btn-refresh" id="btn-refresh">Refresh</button>
      </div>
    </div>
    <div class="content">

      <!-- DASHBOARD VIEW -->
      <div class="view active" id="view-dashboard">
        <div class="stat-grid" id="stat-grid">
          <div class="stat-card"><div class="stat-label">Total Users</div><div class="stat-num" id="stat-total">—</div><div class="stat-sub">non-demo accounts</div></div>
          <div class="stat-card"><div class="stat-label">Active Portals</div><div class="stat-num stat-accent" id="stat-portals">—</div><div class="stat-sub">distinct client circles</div></div>
          <div class="stat-card"><div class="stat-label">Active This Week</div><div class="stat-num stat-success" id="stat-active">—</div><div class="stat-sub">logged in 7 days</div></div>
          <div class="stat-card"><div class="stat-label">Pending Queue</div><div class="stat-num stat-warn" id="stat-queue">—</div><div class="stat-sub">awaiting review</div></div>
        </div>

        <div class="section-hdr">Recent Signups <span>users sorted by last login</span></div>
        <div class="table-wrap" id="dash-recent-wrap">
          <div class="loading">Loading...</div>
        </div>

        <div class="section-hdr" style="margin-top:20px">Signup Queue <span>pending applications</span></div>
        <div class="table-wrap" id="dash-queue-wrap">
          <div class="loading">Loading...</div>
        </div>
      </div>

      <!-- PORTALS VIEW -->
      <div class="view" id="view-portals">
        <div id="portals-list"><div class="loading">Loading portals...</div></div>
      </div>

      <!-- USERS VIEW -->
      <div class="view" id="view-users">
        <div class="search-row">
          <input class="search-input" id="users-search" placeholder="Search name or email..." />
          <select class="sort-select" id="users-sort">
            <option value="login">Sort: Last Login</option>
            <option value="signup">Sort: Signup Date</option>
            <option value="name">Sort: Name</option>
            <option value="entries">Sort: Activity</option>
          </select>
        </div>
        <div class="table-wrap" id="users-table-wrap">
          <div class="loading">Loading...</div>
        </div>
      </div>

      <!-- QUEUE VIEW -->
      <div class="view" id="view-queue">
        <div class="table-wrap" id="queue-table-wrap">
          <div class="loading">Loading queue...</div>
        </div>
      </div>

    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
// ── Token management ──────────────────────────────────────────────────────
const TOKEN_KEY = 'office_token';
let token = null;
let currentUser = null;
let engagementData = [];
let applicationsData = [];
let portalsData = [];
let sortField = 'login';

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); token = t; }
function clearToken() { localStorage.removeItem(TOKEN_KEY); token = null; }

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() };
}

async function api(method, path, body) {
  const opts = { method, headers: authHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || r.statusText);
  return data;
}

// ── Toast ─────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 3000);
}

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return days + 'd ago';
  if (days < 30) return Math.floor(days / 7) + 'w ago';
  return Math.floor(days / 30) + 'mo ago';
}
function roleChip(role) {
  const labels = { caregiver: 'CG', primary_family: 'MC', secondary_family: 'Family', self_care: 'Self' };
  return '<span class="role-chip role-' + role + '">' + (labels[role] || role) + '</span>';
}
function tierBadge(tier) {
  return '<span class="tier-' + tier + '">' + tier.charAt(0).toUpperCase() + tier.slice(1) + '</span>';
}
function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase();
}

// ── Login ─────────────────────────────────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', handleLogin);
document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
document.getElementById('login-email').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-password').focus(); });

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Signing in...';
  try {
    const data = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    }).then(r => r.json());

    if (!data.token) throw new Error(data.message || 'Login failed');
    // Verify admin status
    const whoami = await fetch('/api/admin/whoami', {
      headers: { 'Authorization': 'Bearer ' + data.token }
    }).then(r => r.json());
    if (!whoami.isAdmin) throw new Error('This account does not have admin access.');

    setToken(data.token);
    currentUser = whoami;
    showApp();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In to Admin Office';
  }
}

// ── Show app ──────────────────────────────────────────────────────────────
function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  const app = document.getElementById('app');
  app.classList.add('visible');

  const name = currentUser?.name || currentUser?.email || 'Admin';
  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('sidebar-initials').textContent = initials(name);

  loadAllData();
}

// ── Sign out ──────────────────────────────────────────────────────────────
document.getElementById('btn-signout').addEventListener('click', () => {
  api('POST', '/api/auth/logout').catch(() => {});
  clearToken();
  location.reload();
});

// ── Navigation ────────────────────────────────────────────────────────────
const viewTitles = {
  dashboard: ['Dashboard', 'Overview of all portals and users'],
  portals: ['Portals', 'All active care circles'],
  users: ['Users', 'All registered accounts'],
  queue: ['Queue', 'Pending signup applications'],
};

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const view = item.dataset.view;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + view).classList.add('active');
    const [title, sub] = viewTitles[view];
    document.getElementById('topbar-title').textContent = title;
    document.getElementById('topbar-sub').textContent = sub;
  });
});

document.getElementById('btn-refresh').addEventListener('click', loadAllData);

// ── Load all data ─────────────────────────────────────────────────────────
async function loadAllData() {
  try {
    const [eng, apps] = await Promise.all([
      api('GET', '/api/admin/engagement'),
      api('GET', '/api/admin/applications'),
    ]);
    engagementData = eng;
    applicationsData = apps;
    renderDashboard();
    renderPortals();
    renderUsers();
    renderQueue();
  } catch (e) {
    toast('Load error: ' + e.message, 'error');
  }
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────
function renderDashboard() {
  const total = engagementData.length;
  const activeThisWeek = engagementData.filter(u => u.daysSinceLogin <= 7).length;
  const pending = applicationsData.filter(a => a.status === 'pending').length;
  const clientIds = new Set(engagementData.map(u => u.clientId).filter(Boolean));

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-portals').textContent = clientIds.size;
  document.getElementById('stat-active').textContent = activeThisWeek;
  document.getElementById('stat-queue').textContent = pending;

  // Queue badge
  const badge = document.getElementById('queue-badge');
  if (pending > 0) { badge.textContent = pending; badge.style.display = ''; }
  else { badge.style.display = 'none'; }

  // Recent users table
  const sorted = [...engagementData].sort((a, b) => a.daysSinceLogin - b.daysSinceLogin).slice(0, 10);
  renderEngagementTable('dash-recent-wrap', sorted, false);

  // Queue preview
  const pendingApps = applicationsData.filter(a => a.status === 'pending').slice(0, 5);
  renderQueueTable('dash-queue-wrap', pendingApps, true);
}

// ── PORTALS ───────────────────────────────────────────────────────────────
function renderPortals() {
  // Group users by clientId
  const groups = {};
  const noClient = [];
  engagementData.forEach(u => {
    if (u.clientId) {
      if (!groups[u.clientId]) groups[u.clientId] = [];
      groups[u.clientId].push(u);
    } else {
      noClient.push(u);
    }
  });

  const container = document.getElementById('portals-list');
  if (!Object.keys(groups).length) {
    container.innerHTML = '<div class="empty">No portals found.</div>';
    return;
  }

  let html = '';
  Object.entries(groups).forEach(([clientId, members]) => {
    const mc = members.find(u => u.role === 'primary_family');
    const cg = members.find(u => u.role === 'caregiver');
    const allTiers = members.map(u => u.tier);
    const health = allTiers.includes('active') ? 'active' : allTiers.includes('moderate') ? 'moderate' : 'quiet';
    const lastLogin = members.map(u => u.lastLoginAt).filter(Boolean).sort().reverse()[0];

    const portalLabel = mc ? (mc.name || 'Portal ' + clientId) : (cg ? (cg.name + ' (CG)') : 'Portal ' + clientId);

    html += '<div class="portal-group">';
    html += '<div class="portal-group-hdr">';
    html += '<div class="portal-health health-' + health + '"></div>';
    html += '<div class="portal-group-name">' + esc(portalLabel) + '</div>';
    html += '<div class="portal-group-meta">Portal #' + clientId + ' &nbsp;|&nbsp; ' + members.length + ' member' + (members.length !== 1 ? 's' : '') + ' &nbsp;|&nbsp; Last active ' + fmtAgo(lastLogin) + '</div>';
    html += '</div>';
    html += '<table><thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Last Login</th><th>Activity</th><th>Status</th></tr></thead><tbody>';
    members.forEach(u => {
      html += '<tr>';
      html += '<td>' + esc(u.name || '—') + '</td>';
      html += '<td>' + roleChip(u.role) + '</td>';
      html += '<td class="td-email">' + esc(u.email || '—') + '</td>';
      html += '<td class="td-muted">' + fmtAgo(u.lastLoginAt) + '</td>';
      html += '<td class="td-muted">' + u.totalEntries + ' entries</td>';
      html += '<td>' + tierBadge(u.tier) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  });

  container.innerHTML = html;
}

// ── USERS ─────────────────────────────────────────────────────────────────
function renderUsers() {
  const wrap = document.getElementById('users-table-wrap');
  let data = [...engagementData];

  const q = document.getElementById('users-search').value.toLowerCase();
  if (q) data = data.filter(u => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));

  const sort = document.getElementById('users-sort').value;
  if (sort === 'login') data.sort((a, b) => a.daysSinceLogin - b.daysSinceLogin);
  else if (sort === 'name') data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  else if (sort === 'entries') data.sort((a, b) => b.totalEntries - a.totalEntries);

  if (!data.length) { wrap.innerHTML = '<div class="empty">No users found.</div>'; return; }

  let html = '<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Portal</th><th>Last Login</th><th>Activity</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
  data.forEach(u => {
    html += '<tr>';
    html += '<td><strong>' + esc(u.name || '—') + '</strong></td>';
    html += '<td class="td-email">' + esc(u.email || '—') + '</td>';
    html += '<td>' + roleChip(u.role) + '</td>';
    html += '<td class="td-muted">' + (u.clientId ? '#' + u.clientId : '—') + '</td>';
    html += '<td class="td-muted">' + fmtAgo(u.lastLoginAt) + '</td>';
    html += '<td class="td-muted">' + u.totalEntries + '</td>';
    html += '<td>' + tierBadge(u.tier) + '</td>';
    html += '<td><div class="action-btns"><button class="btn-action btn-deactivate" onclick="deactivateUser(' + JSON.stringify(u.email) + ')">Deactivate</button></div></td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

document.getElementById('users-search').addEventListener('input', renderUsers);
document.getElementById('users-sort').addEventListener('change', renderUsers);

// ── QUEUE ─────────────────────────────────────────────────────────────────
function renderQueue() {
  const all = applicationsData.filter(a => a.status === 'pending');
  renderQueueTable('queue-table-wrap', all, false);
}

function renderQueueTable(wrapperId, apps, compact) {
  const wrap = document.getElementById(wrapperId);
  if (!apps.length) { wrap.innerHTML = '<div class="empty">No pending applications.</div>'; return; }

  let html = '<table><thead><tr><th>Name</th><th>Email</th><th>Applied</th><th>Email Verified</th><th>Status</th>';
  if (!compact) html += '<th>Actions</th>';
  html += '</tr></thead><tbody>';

  apps.forEach(a => {
    html += '<tr>';
    html += '<td><strong>' + esc(a.name || '—') + '</strong></td>';
    html += '<td class="td-email">' + esc(a.email || '—') + '</td>';
    html += '<td class="td-muted">' + fmtDate(a.createdAt) + '</td>';
    const emailClass = a.emailVerified ? 'email-verified' : 'email-unverified';
    const emailLabel = a.emailVerified ? '✓ Verified' : '✗ Not verified';
    html += '<td><span class="email-chip ' + emailClass + '">' + emailLabel + '</span></td>';
    html += '<td><span class="status-chip status-' + (a.status || 'pending') + '">' + (a.status || 'pending') + '</span></td>';
    if (!compact) {
      html += '<td><div class="action-btns">' +
        '<button class="btn-action btn-approve" onclick="approveApp(' + a.id + ')">Approve</button>' +
        '<button class="btn-action btn-deny" onclick="denyApp(' + a.id + ')">Deny</button>' +
        '</div></td>';
    }
    html += '</tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function renderEngagementTable(wrapperId, data, compact) {
  const wrap = document.getElementById(wrapperId);
  if (!data.length) { wrap.innerHTML = '<div class="empty">No users found.</div>'; return; }

  let html = '<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Activity</th><th>Status</th></tr></thead><tbody>';
  data.forEach(u => {
    html += '<tr>';
    html += '<td><strong>' + esc(u.name || '—') + '</strong></td>';
    html += '<td class="td-email">' + esc(u.email || '—') + '</td>';
    html += '<td>' + roleChip(u.role) + '</td>';
    html += '<td class="td-muted">' + fmtAgo(u.lastLoginAt) + '</td>';
    html += '<td class="td-muted">' + u.totalEntries + ' entries</td>';
    html += '<td>' + tierBadge(u.tier) + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

// ── Actions ───────────────────────────────────────────────────────────────
async function approveApp(id) {
  try {
    await api('POST', '/api/admin/applications/' + id + '/approve');
    toast('Approved — invite sent', 'success');
    await loadAllData();
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function denyApp(id) {
  if (!confirm('Deny this application?')) return;
  try {
    await api('POST', '/api/admin/applications/' + id + '/deny');
    toast('Application denied', 'success');
    await loadAllData();
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function deactivateUser(email) {
  if (!confirm('Deactivate account for ' + email + '?')) return;
  try {
    await api('POST', '/api/admin/users/deactivate', { email });
    toast('Account deactivated', 'success');
    await loadAllData();
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────
(async function init() {
  const saved = getToken();
  if (saved) {
    try {
      const whoami = await fetch('/api/admin/whoami', { headers: { 'Authorization': 'Bearer ' + saved } }).then(r => r.json());
      if (whoami.isAdmin) {
        currentUser = whoami;
        showApp();
        return;
      }
    } catch (e) {}
  }
  // Show login
  document.getElementById('login-screen').style.display = 'flex';
})();
</script>
</body>
</html>`;
}
