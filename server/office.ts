// ── /office — Standalone Admin Office ─────────────────────────────────────
// Top-tab layout. Full-width content. Works on phone and desktop.

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
  --surface: #161b27;
  --card: #1c2133;
  --border: #2a3045;
  --accent: #1a8c83;
  --accent-light: #20a89d;
  --text: #e8eaf0;
  --muted: #8490a8;
  --danger: #e05050;
  --warn: #d97706;
  --success: #22c55e;
}
html, body { height: 100%; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif; font-size: 14px; }

/* ── LOGIN ── */
#login-screen {
  display: flex; align-items: center; justify-content: center; min-height: 100vh;
  background: radial-gradient(ellipse at 30% 40%, #1a3a38 0%, #0f1117 60%);
  padding: 16px;
}
.login-box {
  background: var(--card); border: 1px solid var(--border); border-radius: 16px;
  padding: 36px 28px; width: 100%; max-width: 380px; box-shadow: 0 24px 60px rgba(0,0,0,.5);
}
.login-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
.login-logo-icon {
  width: 36px; height: 36px; background: var(--accent); border-radius: 9px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.login-logo-icon svg { width: 18px; height: 18px; }
.login-logo-text { font-size: 14px; font-weight: 700; color: var(--text); line-height: 1.2; }
.login-logo-sub { font-size: 11px; color: var(--muted); }
.login-box h1 { font-size: 20px; font-weight: 700; margin-bottom: 5px; }
.login-box p { font-size: 13px; color: var(--muted); margin-bottom: 22px; line-height: 1.4; }
.field { margin-bottom: 13px; }
.field label { display: block; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 5px; }
.field input {
  width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font-size: 15px; padding: 11px 12px; outline: none; transition: border-color .15s;
}
.field input:focus { border-color: var(--accent); }
.btn-login {
  width: 100%; background: var(--accent); color: white; border: none; border-radius: 8px;
  padding: 13px; font-size: 14px; font-weight: 700; cursor: pointer; margin-top: 6px; transition: background .15s;
}
.btn-login:hover { background: var(--accent-light); }
.btn-login:disabled { opacity: .6; cursor: default; }
.login-error { color: var(--danger); font-size: 13px; margin-top: 10px; display: none; }

/* ── APP SHELL ── */
#app { display: none; flex-direction: column; min-height: 100vh; }
#app.visible { display: flex; }

/* ── HEADER ── */
.header {
  background: var(--surface); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 16px; height: 52px; gap: 10px; flex-shrink: 0;
}
.header-logo { display: flex; align-items: center; gap: 8px; }
.header-logo-icon {
  width: 28px; height: 28px; background: var(--accent); border-radius: 7px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.header-logo-icon svg { width: 14px; height: 14px; }
.header-logo-text { font-size: 13px; font-weight: 700; color: var(--text); white-space: nowrap; }
.header-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.header-user { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
.btn-signout {
  padding: 5px 10px; background: transparent; border: 1px solid var(--border); border-radius: 6px;
  color: var(--muted); font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all .15s;
}
.btn-signout:hover { border-color: var(--danger); color: var(--danger); }

/* ── TABS ── */
.tabs {
  background: var(--surface); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 8px; gap: 2px; flex-shrink: 0; overflow-x: auto;
  scrollbar-width: none;
}
.tabs::-webkit-scrollbar { display: none; }
.tab {
  display: flex; align-items: center; gap: 7px; padding: 12px 14px; white-space: nowrap;
  font-size: 13px; font-weight: 500; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent;
  transition: all .15s; user-select: none; flex-shrink: 0;
}
.tab:hover { color: var(--text); }
.tab.active { color: var(--accent-light); border-bottom-color: var(--accent); font-weight: 600; }
.tab svg { width: 15px; height: 15px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
.tab-badge { background: var(--accent); color: white; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 8px; }

/* ── TOOLBAR ── */
.toolbar { display: flex; align-items: center; gap: 8px; padding: 12px 16px; flex-shrink: 0; flex-wrap: wrap; }
.toolbar-title { font-size: 15px; font-weight: 700; color: var(--text); }
.toolbar-sub { font-size: 12px; color: var(--muted); }
.toolbar-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.btn-refresh {
  padding: 6px 12px; background: transparent; border: 1px solid var(--border); border-radius: 6px;
  color: var(--muted); font-size: 12px; cursor: pointer; transition: all .15s; white-space: nowrap;
}
.btn-refresh:hover { border-color: var(--accent); color: var(--accent); }

/* ── CONTENT ── */
.content { flex: 1; overflow-y: auto; padding: 12px 16px 24px; }

/* ── VIEWS ── */
.view { display: none; }
.view.active { display: block; }

/* ── STAT CARDS ── */
.stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 18px; }
@media (min-width: 600px) { .stat-grid { grid-template-columns: repeat(4, 1fr); } }
.stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px 14px; }
.stat-label { font-size: 10px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
.stat-num { font-size: 26px; font-weight: 700; color: var(--text); }
.stat-sub { font-size: 11px; color: var(--muted); margin-top: 3px; }
.stat-accent { color: var(--accent-light); }
.stat-warn { color: var(--warn); }
.stat-success { color: var(--success); }

/* ── SECTION HEADER ── */
.section-hdr { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin: 16px 0 8px; }

/* ── TABLE ── */
.table-wrap { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow-x: auto; margin-bottom: 16px; }
table { width: 100%; border-collapse: collapse; min-width: 480px; }
thead th {
  padding: 9px 12px; text-align: left; font-size: 10px; font-weight: 700; color: var(--muted);
  text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,.02); white-space: nowrap; cursor: pointer; user-select: none;
}
thead th:hover { color: var(--text); }
tbody tr { border-bottom: 1px solid var(--border); transition: background .1s; }
tbody tr:last-child { border-bottom: none; }
tbody tr:hover { background: rgba(255,255,255,.025); }
tbody td { padding: 9px 12px; font-size: 13px; color: var(--text); vertical-align: middle; }
.td-muted { color: var(--muted); font-size: 12px; }
.td-email { color: var(--muted); font-size: 12px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── CHIPS ── */
.role-chip { display: inline-block; padding: 2px 7px; border-radius: 9px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
.role-caregiver { background: rgba(26,140,131,.15); color: var(--accent-light); }
.role-primary_family { background: rgba(99,130,210,.15); color: #7b9dde; }
.role-secondary_family { background: rgba(160,100,200,.15); color: #c090e0; }
.role-self_care { background: rgba(240,160,50,.15); color: #f0a040; }

.tier-active { color: var(--success); font-size: 11px; font-weight: 600; }
.tier-moderate { color: var(--warn); font-size: 11px; font-weight: 600; }
.tier-quiet { color: var(--muted); font-size: 11px; }

.status-chip { display: inline-block; padding: 2px 7px; border-radius: 9px; font-size: 10px; font-weight: 700; }
.status-pending { background: rgba(217,119,6,.15); color: var(--warn); }
.status-approved { background: rgba(34,197,94,.15); color: var(--success); }
.status-denied { background: rgba(224,80,80,.15); color: var(--danger); }

.email-chip { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 9px; font-size: 10px; font-weight: 700; white-space: nowrap; }
.email-verified { background: rgba(34,197,94,.12); color: var(--success); }
.email-unverified { background: rgba(217,119,6,.12); color: var(--warn); }

/* ── ACTIONS ── */
.action-btns { display: flex; gap: 5px; }
.btn-action { padding: 4px 9px; border-radius: 5px; font-size: 11px; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all .15s; white-space: nowrap; }
.btn-deactivate { border-color: var(--border); color: var(--muted); background: transparent; }
.btn-deactivate:hover { border-color: var(--danger); color: var(--danger); }
.btn-approve { border-color: var(--accent); color: var(--accent); background: transparent; }
.btn-approve:hover { background: var(--accent); color: white; }
.btn-deny { border-color: var(--border); color: var(--muted); background: transparent; }
.btn-deny:hover { border-color: var(--danger); color: var(--danger); }

/* ── SEARCH ROW ── */
.search-row { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.search-input {
  flex: 1; min-width: 160px; background: var(--card); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font-size: 13px; padding: 8px 12px; outline: none; transition: border-color .15s;
}
.search-input:focus { border-color: var(--accent); }
.sort-select {
  background: var(--card); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font-size: 12px; padding: 8px 10px; outline: none; cursor: pointer;
}

/* ── PORTAL GROUPS ── */
.portal-group { background: var(--card); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 12px; overflow: hidden; }
.portal-group-hdr { padding: 12px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,.02); flex-wrap: wrap; gap: 8px; }
.portal-group-name { font-size: 14px; font-weight: 700; color: var(--text); }
.portal-group-meta { font-size: 11px; color: var(--muted); margin-left: auto; white-space: nowrap; }
.portal-health { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.health-active { background: var(--success); box-shadow: 0 0 5px var(--success); }
.health-moderate { background: var(--warn); }
.health-quiet { background: var(--muted); }

/* ── LOADING / EMPTY ── */
.loading { color: var(--muted); font-size: 13px; padding: 36px; text-align: center; }
.empty { color: var(--muted); font-size: 13px; padding: 28px; text-align: center; }

/* ── TOAST ── */
.toast {
  position: fixed; bottom: 20px; right: 16px; left: 16px; max-width: 360px; margin: 0 auto;
  background: var(--card); border: 1px solid var(--border); border-radius: 10px;
  padding: 11px 14px; font-size: 13px; color: var(--text); box-shadow: 0 8px 32px rgba(0,0,0,.5);
  z-index: 200; transform: translateY(80px); opacity: 0; transition: all .25s; pointer-events: none;
}
.toast.show { transform: translateY(0); opacity: 1; }
.toast.success { border-color: var(--success); }
.toast.error { border-color: var(--danger); }

/* ── LIBRARY ── */
.lib-controls { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
.theme-filter { background: var(--card); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 12px; padding: 7px 10px; outline: none; cursor: pointer; }
.btn-add { padding: 7px 14px; background: var(--accent); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: background .15s; }
.btn-add:hover { background: var(--accent-light); }
.lib-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
.lib-card-hdr { padding: 10px 14px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--border); background: rgba(255,255,255,.02); }
.lib-theme { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: 2px 8px; border-radius: 8px; background: rgba(26,140,131,.15); color: var(--accent-light); }
.lib-placeholder { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 8px; background: rgba(217,119,6,.15); color: var(--warn); }
.lib-inactive { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 8px; background: rgba(132,144,168,.1); color: var(--muted); }
.lib-card-actions { margin-left: auto; display: flex; gap: 6px; }
.lib-card-body { padding: 12px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 600px) { .lib-card-body { grid-template-columns: 1fr; } }
.lib-field-label { font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 5px; }
.lib-field-text { font-size: 13px; color: var(--text); line-height: 1.5; white-space: pre-wrap; }
/* ── MODAL ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 100; display: none; align-items: center; justify-content: center; padding: 16px; }
.modal-overlay.open { display: flex; }
.modal { background: var(--card); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 560px; padding: 24px; box-shadow: 0 24px 60px rgba(0,0,0,.6); }
.modal h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
.modal-field { margin-bottom: 13px; }
.modal-field label { display: block; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 5px; }
.modal-field input, .modal-field select, .modal-field textarea {
  width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font-size: 13px; padding: 9px 12px; outline: none; transition: border-color .15s; font-family: inherit; resize: vertical;
}
.modal-field input:focus, .modal-field select:focus, .modal-field textarea:focus { border-color: var(--accent); }
.modal-field textarea { min-height: 90px; }
.modal-btns { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.btn-cancel { padding: 8px 16px; background: transparent; border: 1px solid var(--border); border-radius: 7px; color: var(--muted); font-size: 13px; cursor: pointer; }
.btn-save { padding: 8px 18px; background: var(--accent); border: none; border-radius: 7px; color: white; font-size: 13px; font-weight: 700; cursor: pointer; }
.btn-save:hover { background: var(--accent-light); }

</style>
</head>
<body>

<!-- LOGIN -->
<div id="login-screen">
  <div class="login-box">
    <div class="login-logo">
      <div class="login-logo-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 12 6 12s6-6.75 6-12c0-3.314-2.686-6-6-6z"/><circle cx="12" cy="8" r="2" fill="#1a8c83" stroke="none"/></svg>
      </div>
      <div>
        <div class="login-logo-text">Care Net Portal</div>
        <div class="login-logo-sub">Admin Office</div>
      </div>
    </div>
    <h1>Sign In</h1>
    <p>Admin access only — separate session from the portal.</p>
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

<!-- APP -->
<div id="app">

  <!-- HEADER -->
  <div class="header">
    <div class="header-logo">
      <div class="header-logo-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 12 6 12s6-6.75 6-12c0-3.314-2.686-6-6-6z"/><circle cx="12" cy="8" r="2" fill="#1a8c83" stroke="none"/></svg>
      </div>
      <span class="header-logo-text">Admin Office</span>
    </div>
    <div class="header-right">
      <span class="header-user" id="header-user"></span>
      <button class="btn-signout" id="btn-signout">Sign Out</button>
    </div>
  </div>

  <!-- TABS -->
  <div class="tabs">
    <div class="tab active" data-view="dashboard">
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      Dashboard
    </div>
    <div class="tab" data-view="portals">
      <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      Portals
    </div>
    <div class="tab" data-view="users">
      <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      Users
    </div>

    <div class="tab" data-view="library">
      <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      Library
    </div>
    <div class="tab" data-view="queue">
      <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
      Queue
      <span class="tab-badge" id="queue-badge" style="display:none"></span>
    </div>
  </div>

  <!-- TOOLBAR -->
  <div class="toolbar">
    <div>
      <div class="toolbar-title" id="toolbar-title">Dashboard</div>
      <div class="toolbar-sub" id="toolbar-sub">Overview of all portals and users</div>
    </div>
    <div class="toolbar-right">
      <button class="btn-refresh" id="btn-refresh">Refresh</button>
    </div>
  </div>

  <!-- CONTENT -->
  <div class="content">

    <!-- DASHBOARD -->
    <div class="view active" id="view-dashboard">
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Total Users</div><div class="stat-num" id="stat-total">—</div><div class="stat-sub">non-demo accounts</div></div>
        <div class="stat-card"><div class="stat-label">Active Portals</div><div class="stat-num stat-accent" id="stat-portals">—</div><div class="stat-sub">care circles</div></div>
        <div class="stat-card"><div class="stat-label">Active This Week</div><div class="stat-num stat-success" id="stat-active">—</div><div class="stat-sub">logged in 7 days</div></div>
        <div class="stat-card"><div class="stat-label">Pending Queue</div><div class="stat-num stat-warn" id="stat-queue">—</div><div class="stat-sub">awaiting review</div></div>
      </div>
      <div class="section-hdr">Recent Users — sorted by last login</div>
      <div class="table-wrap" id="dash-recent-wrap"><div class="loading">Loading...</div></div>
      <div class="section-hdr">Pending Queue</div>
      <div class="table-wrap" id="dash-queue-wrap"><div class="loading">Loading...</div></div>
    </div>

    <!-- PORTALS -->
    <div class="view" id="view-portals">
      <div id="portals-list"><div class="loading">Loading portals...</div></div>
    </div>

    <!-- USERS -->
    <div class="view" id="view-users">
      <div class="search-row">
        <input class="search-input" id="users-search" placeholder="Search name or email..." />
        <select class="sort-select" id="users-sort">
          <option value="login">Last Login</option>
          <option value="signup">Signup Date</option>
          <option value="name">Name A–Z</option>
          <option value="entries">Most Active</option>
        </select>
      </div>
      <div class="table-wrap" id="users-table-wrap"><div class="loading">Loading...</div></div>
    </div>

    <!-- QUEUE -->
    <div class="view" id="view-queue">
      <div class="table-wrap" id="queue-table-wrap"><div class="loading">Loading queue...</div></div>
    </div>

    <!-- LIBRARY -->
    <div class="view" id="view-library">
      <div class="lib-controls">
        <select class="theme-filter" id="lib-theme-filter">
          <option value="">All Themes</option>
        </select>
        <button class="btn-add" onclick="openLibModal()">+ New Response</button>
      </div>
      <div id="library-list"><div class="loading">Loading library...</div></div>
    </div>

  </div>
</div>

<div class="toast" id="toast"></div>

<script>
const TOKEN_KEY = 'office_token';
let token = null;
let currentUser = null;
let engagementData = [];
let applicationsData = [];

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); token = t; }
function clearToken() { localStorage.removeItem(TOKEN_KEY); token = null; }
function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() }; }

async function api(method, path, body) {
  const opts = { method, headers: authHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || r.statusText);
  return data;
}

let toastTimer;
function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtAgo(iso) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return d + 'd ago';
  if (d < 30) return Math.floor(d/7) + 'w ago';
  return Math.floor(d/30) + 'mo ago';
}
function roleChip(r) {
  const l = { caregiver:'CG', primary_family:'MC', secondary_family:'Family', self_care:'Self' };
  return '<span class="role-chip role-' + r + '">' + (l[r]||r) + '</span>';
}
function tierBadge(t) {
  return '<span class="tier-' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</span>';
}

async function linkPortal(userId, name) {
  const clientId = prompt('Link ' + name + ' to which portal?\nEnter the clientId number (visible in the Portals tab):');
  if (!clientId || isNaN(Number(clientId))) return;
  try {
    await api('POST', '/api/admin/users/' + userId + '/link-portal', { clientId: Number(clientId) });
    toast(name + ' linked to portal #' + clientId, 'success');
    await loadAllData();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// LOGIN
document.getElementById('btn-login').addEventListener('click', handleLogin);
document.getElementById('login-password').addEventListener('keydown', e => { if (e.key==='Enter') handleLogin(); });
document.getElementById('login-email').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('login-password').focus(); });

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Signing in...';
  try {
    const loginRes = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await loginRes.json().catch(() => ({}));
    if (!loginRes.ok || !data.token) throw new Error(data.message || 'Login failed. Check your email and password.');
    const whoamiRes = await fetch('/api/admin/whoami', { headers: { 'Authorization': 'Bearer ' + data.token } });
    const whoami = await whoamiRes.json().catch(() => ({}));
    if (!whoami.isAdmin) throw new Error('This account does not have admin access. Contact David to be added.');
    setToken(data.token);
    currentUser = { ...whoami, name: data.user?.name || whoami.email || 'Admin' };
    showApp();
  } catch(e) {
    errEl.textContent = e.message || 'Something went wrong. Try again.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In to Admin Office';
  }
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  const name = currentUser?.name || currentUser?.email || 'Admin';
  document.getElementById('header-user').textContent = name;
  loadAllData();
}

document.getElementById('btn-signout').addEventListener('click', () => {
  api('POST', '/api/auth/logout').catch(() => {});
  clearToken();
  location.reload();
});

// TABS
const viewMeta = {
  dashboard: ['Dashboard', 'Overview of all portals and users'],
  portals:   ['Portals',   'All active care circles'],
  users:     ['Users',     'All registered accounts'],
  queue:     ['Queue',     'Pending signup applications'],
  library:   ['Library',   'Becky\'s response bank for caregivers'],
};
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const v = tab.dataset.view;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + v).classList.add('active');
    if (v === 'library') loadLibrary();
    const [title, sub] = viewMeta[v];
    document.getElementById('toolbar-title').textContent = title;
    document.getElementById('toolbar-sub').textContent = sub;
  });
});
document.getElementById('btn-refresh').addEventListener('click', loadAllData);

// DATA
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
  } catch(e) { toast('Load error: ' + e.message, 'error'); }
}

// DASHBOARD
function renderDashboard() {
  const total = engagementData.length;
  const activeWeek = engagementData.filter(u => u.daysSinceLogin <= 7).length;
  const pending = applicationsData.filter(a => a.status === 'pending').length;
  const portals = new Set(engagementData.map(u => u.clientId).filter(Boolean)).size;
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-portals').textContent = portals;
  document.getElementById('stat-active').textContent = activeWeek;
  document.getElementById('stat-queue').textContent = pending;
  const badge = document.getElementById('queue-badge');
  badge.style.display = pending > 0 ? '' : 'none';
  if (pending > 0) badge.textContent = pending;
  const recent = [...engagementData].sort((a,b) => a.daysSinceLogin - b.daysSinceLogin).slice(0,10);
  renderEngTable('dash-recent-wrap', recent);
  renderQueueTable('dash-queue-wrap', applicationsData.filter(a => a.status==='pending').slice(0,5), true);
}

// PORTALS
function renderPortals() {
  const groups = {};
  engagementData.forEach(u => {
    if (!u.clientId) return;
    if (!groups[u.clientId]) groups[u.clientId] = [];
    groups[u.clientId].push(u);
  });
  const container = document.getElementById('portals-list');
  const keys = Object.keys(groups);
  if (!keys.length) { container.innerHTML = '<div class="empty">No portals found.</div>'; return; }
  let html = '';
  keys.forEach(cid => {
    const members = groups[cid];
    const mc = members.find(u => u.role==='primary_family');
    const cg = members.find(u => u.role==='caregiver');
    const label = mc ? (mc.name||'Portal '+cid) : (cg ? cg.name : 'Portal '+cid);
    const tiers = members.map(u => u.tier);
    const health = tiers.includes('active') ? 'active' : tiers.includes('moderate') ? 'moderate' : 'quiet';
    const lastLogin = members.map(u => u.lastLoginAt).filter(Boolean).sort().reverse()[0];
    html += '<div class="portal-group">';
    html += '<div class="portal-group-hdr">';
    html += '<div class="portal-health health-' + health + '"></div>';
    html += '<div class="portal-group-name">' + esc(label) + '</div>';
    html += '<div class="portal-group-meta">Portal #' + cid + ' &nbsp;&middot;&nbsp; ' + members.length + ' member' + (members.length!==1?'s':'') + ' &nbsp;&middot;&nbsp; ' + fmtAgo(lastLogin) + '</div>';
    html += '</div>';
    html += '<table><thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Last Login</th><th>Activity</th></tr></thead><tbody>';
    members.forEach(u => {
      html += '<tr><td>' + esc(u.name||'—') + '</td><td>' + roleChip(u.role) + '</td>';
      html += '<td class="td-email">' + esc(u.email||'—') + '</td>';
      html += '<td class="td-muted">' + fmtAgo(u.lastLoginAt) + '</td>';
      html += '<td class="td-muted">' + u.totalEntries + ' entries</td></tr>';
    });
    html += '</tbody></table></div>';
  });
  container.innerHTML = html;
}

// USERS
function renderUsers() {
  let data = [...engagementData];
  const q = document.getElementById('users-search').value.toLowerCase();
  if (q) data = data.filter(u => (u.name||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q));
  const sort = document.getElementById('users-sort').value;
  if (sort==='login') data.sort((a,b) => a.daysSinceLogin - b.daysSinceLogin);
  else if (sort==='name') data.sort((a,b) => (a.name||'').localeCompare(b.name||''));
  else if (sort==='entries') data.sort((a,b) => b.totalEntries - a.totalEntries);
  const wrap = document.getElementById('users-table-wrap');
  if (!data.length) { wrap.innerHTML = '<div class="empty">No users found.</div>'; return; }
  let html = '<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Portal</th><th>Last Login</th><th>Activity</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
  data.forEach(u => {
    html += '<tr><td><strong>' + esc(u.name||'—') + '</strong></td>';
    html += '<td class="td-email">' + esc(u.email||'—') + '</td>';
    html += '<td>' + roleChip(u.role) + '</td>';
    html += '<td class="td-muted">' + (u.clientId ? '#'+u.clientId : '<span style="color:var(--warn);font-weight:700;">No portal</span>') + '</td>';
    html += '<td class="td-muted">' + fmtAgo(u.lastLoginAt) + '</td>';
    html += '<td class="td-muted">' + u.totalEntries + '</td>';
    html += '<td>' + tierBadge(u.tier) + '</td>';
    const noPortal = !u.clientId && u.role !== 'self_care';
    html += '<td><div class="action-btns">';
    if (noPortal) html += '<button class="btn-action btn-approve" onclick="linkPortal(' + u.id + ',' + JSON.stringify(u.name) + ')">Link Portal</button>';
    html += '<button class="btn-action btn-deactivate" onclick="deactivateUser(' + JSON.stringify(u.email) + ')">Deactivate</button>';
    html += '</div></td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}
document.getElementById('users-search').addEventListener('input', renderUsers);
document.getElementById('users-sort').addEventListener('change', renderUsers);

// QUEUE
function renderQueue() {
  renderQueueTable('queue-table-wrap', applicationsData.filter(a => a.status==='pending'), false);
}

function renderQueueTable(id, apps, compact) {
  const wrap = document.getElementById(id);
  if (!apps.length) { wrap.innerHTML = '<div class="empty">No pending applications.</div>'; return; }
  let html = '<table><thead><tr><th>Name</th><th>Email</th><th>Applied</th><th>Email Verified</th><th>Status</th>';
  if (!compact) html += '<th>Actions</th>';
  html += '</tr></thead><tbody>';
  apps.forEach(a => {
    html += '<tr><td><strong>' + esc(a.name||'—') + '</strong></td>';
    html += '<td class="td-email">' + esc(a.email||'—') + '</td>';
    html += '<td class="td-muted">' + fmtDate(a.createdAt) + '</td>';
    html += '<td><span class="email-chip ' + (a.emailVerified?'email-verified':'email-unverified') + '">' + (a.emailVerified?'✓ Verified':'✗ Unverified') + '</span></td>';
    html += '<td><span class="status-chip status-' + (a.status||'pending') + '">' + (a.status||'pending') + '</span></td>';
    if (!compact) html += '<td><div class="action-btns"><button class="btn-action btn-approve" onclick="approveApp('+a.id+')">Approve</button><button class="btn-action btn-deny" onclick="denyApp('+a.id+')">Deny</button></div></td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function renderEngTable(id, data) {
  const wrap = document.getElementById(id);
  if (!data.length) { wrap.innerHTML = '<div class="empty">No users.</div>'; return; }
  let html = '<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Activity</th><th>Status</th></tr></thead><tbody>';
  data.forEach(u => {
    html += '<tr><td><strong>' + esc(u.name||'—') + '</strong></td>';
    html += '<td class="td-email">' + esc(u.email||'—') + '</td>';
    html += '<td>' + roleChip(u.role) + '</td>';
    html += '<td class="td-muted">' + fmtAgo(u.lastLoginAt) + '</td>';
    html += '<td class="td-muted">' + u.totalEntries + ' entries</td>';
    html += '<td>' + tierBadge(u.tier) + '</td></tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

// ACTIONS
async function approveApp(id) {
  try { await api('POST', '/api/admin/applications/'+id+'/approve'); toast('Approved — invite sent','success'); await loadAllData(); }
  catch(e) { toast('Error: '+e.message,'error'); }
}
async function denyApp(id) {
  if (!confirm('Deny this application?')) return;
  try { await api('POST', '/api/admin/applications/'+id+'/deny'); toast('Application denied','success'); await loadAllData(); }
  catch(e) { toast('Error: '+e.message,'error'); }
}
async function deactivateUser(email) {
  if (!confirm('Deactivate account for '+email+'?')) return;
  try { await api('POST', '/api/admin/users/deactivate', { email }); toast('Account deactivated','success'); await loadAllData(); }
  catch(e) { toast('Error: '+e.message,'error'); }
}



// ── LIBRARY ──────────────────────────────────────────────────────────────
let libraryData = [];

async function loadLibrary() {
  try {
    libraryData = await api('GET', '/api/becky-library');
    renderLibrary();
  } catch(e) { document.getElementById('library-list').innerHTML = '<div class="empty">Error loading library.</div>'; }
}

function renderLibrary() {
  const themeFilter = document.getElementById('lib-theme-filter').value;
  let data = libraryData;
  if (themeFilter) data = data.filter(r => r.theme === themeFilter);

  // Populate theme filter
  const themes = [...new Set(libraryData.map(r => r.theme))].sort();
  const sel = document.getElementById('lib-theme-filter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Themes</option>' + themes.map(t => '<option value="'+esc(t)+'"'+(t===cur?' selected':'')+'>'+esc(t)+'</option>').join('');

  const container = document.getElementById('library-list');
  if (!data.length) { container.innerHTML = '<div class="empty">No responses yet. Add one above.</div>'; return; }

  let html = '';
  data.forEach(r => {
    html += '<div class="lib-card">';
    html += '<div class="lib-card-hdr">';
    html += '<span class="lib-theme">' + esc(r.theme) + '</span>';
    if (r.isPlaceholder) html += '<span class="lib-placeholder">Needs editing</span>';
    if (!r.isActive) html += '<span class="lib-inactive">Inactive</span>';
    html += '<div class="lib-card-actions">';
    html += '<button class="btn-action btn-approve" onclick="editLibEntry('+r.id+')">Edit</button>';
    html += '<button class="btn-action btn-deny" onclick="deleteLibEntry('+r.id+')">Delete</button>';
    html += '</div></div>';
    html += '<div class="lib-card-body">';
    html += '<div><div class="lib-field-label">Example Message</div><div class="lib-field-text">'+esc(r.examplePrompt)+'</div></div>';
    html += '<div><div class="lib-field-label">Response</div><div class="lib-field-text">'+esc(r.response)+'</div></div>';
    html += '</div></div>';
  });
  container.innerHTML = html;
}

document.getElementById('lib-theme-filter').addEventListener('change', renderLibrary);

function openLibModal(entry) {
  document.getElementById('lib-modal-title').textContent = entry ? 'Edit Response' : 'New Response';
  document.getElementById('lib-modal-id').value = entry ? entry.id : '';
  document.getElementById('lib-modal-theme').value = entry ? entry.theme : '';
  document.getElementById('lib-modal-prompt').value = entry ? entry.examplePrompt : '';
  document.getElementById('lib-modal-response').value = entry ? entry.response : '';
  document.getElementById('lib-modal-active').value = entry ? (entry.isActive ? '1' : '0') : '1';
  document.getElementById('lib-modal').classList.add('open');
  setTimeout(() => document.getElementById('lib-modal-theme').focus(), 50);
}

function closeLibModal() {
  document.getElementById('lib-modal').classList.remove('open');
}

function editLibEntry(id) {
  const entry = libraryData.find(r => r.id === id);
  if (entry) openLibModal(entry);
}

async function saveLibEntry() {
  const id = document.getElementById('lib-modal-id').value;
  const body = {
    theme: document.getElementById('lib-modal-theme').value.trim(),
    examplePrompt: document.getElementById('lib-modal-prompt').value.trim(),
    response: document.getElementById('lib-modal-response').value.trim(),
    isActive: document.getElementById('lib-modal-active').value === '1' ? 1 : 0,
    isPlaceholder: 0,
  };
  if (!body.theme || !body.examplePrompt || !body.response) { toast('All fields required', 'error'); return; }
  try {
    if (id) {
      await api('PATCH', '/api/becky-library/' + id, body);
      toast('Response updated', 'success');
    } else {
      await api('POST', '/api/becky-library', body);
      toast('Response added', 'success');
    }
    closeLibModal();
    await loadLibrary();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function deleteLibEntry(id) {
  if (!confirm('Delete this response?')) return;
  try {
    await api('DELETE', '/api/becky-library/' + id);
    toast('Deleted', 'success');
    await loadLibrary();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// Close modal on overlay click
document.getElementById('lib-modal').addEventListener('click', function(e) {
  if (e.target === this) closeLibModal();
});

// INIT
(async function() {
  const saved = getToken();
  if (saved) {
    try {
      const whoamiRes = await fetch('/api/admin/whoami', { headers: { 'Authorization': 'Bearer ' + saved } });
      const whoami = await whoamiRes.json().catch(() => ({}));
      if (whoami.isAdmin) {
        currentUser = { ...whoami, name: whoami.name || whoami.email || 'Admin' };
        showApp();
        return;
      }
    } catch(e) {}
    clearToken(); // clear stale token
  }
  document.getElementById('login-screen').style.display = 'flex';
})();
</script>

<!-- LIBRARY MODAL -->
<div class="modal-overlay" id="lib-modal">
  <div class="modal">
    <h2 id="lib-modal-title">New Response</h2>
    <input type="hidden" id="lib-modal-id" />
    <div class="modal-field">
      <label>Theme</label>
      <input type="text" id="lib-modal-theme" placeholder="e.g. burnout, client_decline, general" />
    </div>
    <div class="modal-field">
      <label>Example Caregiver Message</label>
      <textarea id="lib-modal-prompt" placeholder="What a caregiver might say or ask..."></textarea>
    </div>
    <div class="modal-field">
      <label>Becky's Response</label>
      <textarea id="lib-modal-response" style="min-height:120px" placeholder="Becky's response to this situation..."></textarea>
    </div>
    <div class="modal-field">
      <label>Status</label>
      <select id="lib-modal-active">
        <option value="1">Active</option>
        <option value="0">Inactive (draft)</option>
      </select>
    </div>
    <div class="modal-btns">
      <button class="btn-cancel" onclick="closeLibModal()">Cancel</button>
      <button class="btn-save" onclick="saveLibEntry()">Save</button>
    </div>
  </div>
</div>
</body>
</html>`;
}
