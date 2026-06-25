export function getOfficeHtml(): string {
  return String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Office — Care Net Portal</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0f1117;--surface:#161b27;--card:#1c2133;--border:#2a3045;--accent:#1a8c83;--accent-light:#20a89d;--text:#e8eaf0;--muted:#8490a8;--danger:#e05050;--warn:#d97706;--success:#22c55e}
html,body{min-height:100%;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px}
/* LOGIN */
#login-screen{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px;background:radial-gradient(ellipse at 30% 40%,#1a3a38 0%,#0f1117 60%)}
.login-box{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:36px 28px;width:100%;max-width:380px;box-shadow:0 24px 60px rgba(0,0,0,.5)}
.login-logo{display:flex;align-items:center;gap:10px;margin-bottom:28px}
.login-logo-icon{width:36px;height:36px;background:var(--accent);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.login-logo-text{font-size:14px;font-weight:700;color:var(--text);line-height:1.2}
.login-logo-sub{font-size:11px;color:var(--muted)}
.login-box h1{font-size:20px;font-weight:700;margin-bottom:5px}
.login-box p{font-size:13px;color:var(--muted);margin-bottom:22px}
.field{margin-bottom:13px}
.field label{display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
.field input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;padding:11px 12px;outline:none;transition:border-color .15s}
.field input:focus{border-color:var(--accent)}
.pw-wrap{position:relative}
.pw-wrap input{padding-right:52px}
.pw-toggle{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;cursor:pointer;padding:4px;user-select:none}
.btn-primary{width:100%;background:var(--accent);color:white;border:none;border-radius:8px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;margin-top:6px;transition:background .15s}
.btn-primary:hover{background:var(--accent-light)}
.btn-primary:disabled{opacity:.6;cursor:default}
.login-msg{font-size:13px;margin-top:10px;display:none;padding:8px 10px;border-radius:6px}
.login-msg.error{color:var(--danger);background:rgba(224,80,80,.1);display:block}
.login-msg.info{color:var(--accent-light);background:rgba(26,140,131,.1);display:block}
/* APP */
#app{display:none;flex-direction:column;min-height:100vh}
#app.on{display:flex}
.header{background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 16px;height:52px;gap:10px;flex-shrink:0}
.header-logo{display:flex;align-items:center;gap:8px}
.header-logo-icon{width:28px;height:28px;background:var(--accent);border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.header-logo-text{font-size:13px;font-weight:700;color:var(--text);white-space:nowrap}
.header-right{margin-left:auto;display:flex;align-items:center;gap:8px}
.header-user{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px}
.btn-sm{padding:5px 10px;background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--muted);font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .15s}
.btn-sm:hover{border-color:var(--danger);color:var(--danger)}
/* TABS */
.tabs{background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 8px;gap:2px;flex-shrink:0;overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{display:flex;align-items:center;gap:7px;padding:12px 14px;white-space:nowrap;font-size:13px;font-weight:500;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;user-select:none;flex-shrink:0}
.tab:hover{color:var(--text)}
.tab.active{color:var(--accent-light);border-bottom-color:var(--accent);font-weight:600}
.tab svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
.tab-badge{background:var(--accent);color:white;font-size:10px;font-weight:700;padding:1px 5px;border-radius:8px}
/* TOOLBAR */
.toolbar{display:flex;align-items:center;gap:8px;padding:12px 16px;flex-shrink:0;flex-wrap:wrap}
.toolbar-title{font-size:15px;font-weight:700;color:var(--text)}
.toolbar-sub{font-size:12px;color:var(--muted)}
.toolbar-right{margin-left:auto}
.btn-refresh{padding:6px 12px;background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--muted);font-size:12px;cursor:pointer;transition:all .15s}
.btn-refresh:hover{border-color:var(--accent);color:var(--accent)}
/* CONTENT */
.content{flex:1;overflow-y:auto;padding:12px 16px 24px}
.view{display:none}
.view.active{display:block}
/* STATS */
.stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:18px}
@media(min-width:600px){.stat-grid{grid-template-columns:repeat(4,1fr)}}
.stat-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 14px}
.stat-label{font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.stat-num{font-size:26px;font-weight:700;color:var(--text)}
.stat-sub{font-size:11px;color:var(--muted);margin-top:3px}
.c-accent{color:var(--accent-light)}.c-warn{color:var(--warn)}.c-success{color:var(--success)}
/* SECTION */
.sec-hdr{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:16px 0 8px}
/* TABLE */
.tbl-wrap{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow-x:auto;margin-bottom:16px}
table{width:100%;border-collapse:collapse;min-width:480px}
thead th{padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border);background:rgba(255,255,255,.02);white-space:nowrap}
tbody tr{border-bottom:1px solid var(--border);transition:background .1s}
tbody tr:last-child{border-bottom:none}
tbody tr:hover{background:rgba(255,255,255,.025)}
tbody td{padding:9px 12px;font-size:13px;color:var(--text);vertical-align:middle}
.td-m{color:var(--muted);font-size:12px}
.td-e{color:var(--muted);font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* CHIPS */
.chip{display:inline-block;padding:2px 7px;border-radius:9px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
.r-cg{background:rgba(26,140,131,.15);color:var(--accent-light)}
.r-mc{background:rgba(99,130,210,.15);color:#7b9dde}
.r-fm{background:rgba(160,100,200,.15);color:#c090e0}
.r-sc{background:rgba(240,160,50,.15);color:#f0a040}
.t-active{color:var(--success);font-size:11px;font-weight:600}
.t-moderate{color:var(--warn);font-size:11px;font-weight:600}
.t-quiet{color:var(--muted);font-size:11px}
.s-pending{background:rgba(217,119,6,.15);color:var(--warn)}
.s-approved{background:rgba(34,197,94,.15);color:var(--success)}
.s-denied{background:rgba(224,80,80,.15);color:var(--danger)}
.e-ok{background:rgba(34,197,94,.12);color:var(--success)}
.e-no{background:rgba(217,119,6,.12);color:var(--warn)}
/* ACTIONS */
.acts{display:flex;gap:5px}
.btn-act{padding:4px 9px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .15s;white-space:nowrap}
.btn-deny-act{border-color:var(--border);color:var(--muted);background:transparent}
.btn-deny-act:hover{border-color:var(--danger);color:var(--danger)}
.btn-approve-act{border-color:var(--accent);color:var(--accent);background:transparent}
.btn-approve-act:hover{background:var(--accent);color:white}
.btn-link-act{border-color:var(--warn);color:var(--warn);background:transparent}
.btn-link-act:hover{background:var(--warn);color:white}
.btn-role-act{border-color:#8b5cf6;color:#8b5cf6;background:transparent}
.btn-role-act:hover{background:#8b5cf6;color:white}
.user-cards{display:flex;flex-direction:column;gap:10px}
.user-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 16px}
.uc-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px}
.uc-name{font-size:15px;font-weight:700;color:var(--text)}
.uc-chips{display:flex;gap:5px;flex-shrink:0}
.uc-email{font-size:12px;color:var(--muted);margin-bottom:8px;word-break:break-all}
.uc-meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:var(--muted);margin-bottom:10px}
.uc-acts{display:flex;gap:8px;flex-wrap:wrap}
/* SEARCH */
.search-row{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.search-input{flex:1;min-width:160px;background:var(--card);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;padding:8px 12px;outline:none;transition:border-color .15s}
.search-input:focus{border-color:var(--accent)}
.sort-sel{background:var(--card);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:12px;padding:8px 10px;outline:none;cursor:pointer}
/* PORTALS */
.pg{background:var(--card);border:1px solid var(--border);border-radius:12px;margin-bottom:12px;overflow:hidden}
.pg-hdr{padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.02);flex-wrap:wrap}
.pg-name{font-size:14px;font-weight:700;color:var(--text)}
.pg-meta{font-size:11px;color:var(--muted);margin-left:auto;white-space:nowrap}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dot-active{background:var(--success);box-shadow:0 0 5px var(--success)}
.dot-moderate{background:var(--warn)}
.dot-quiet{background:var(--muted)}
/* LIBRARY */
.lib-ctrl{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
.btn-add{padding:7px 14px;background:var(--accent);color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
.btn-add:hover{background:var(--accent-light)}
.lib-card{background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:10px;overflow:hidden}
.lib-hdr{padding:10px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.02)}
.lib-theme{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:2px 8px;border-radius:8px;background:rgba(26,140,131,.15);color:var(--accent-light)}
.lib-ph{font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:rgba(217,119,6,.15);color:var(--warn)}
.lib-off{font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:rgba(132,144,168,.1);color:var(--muted)}
.lib-body{padding:12px 14px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:600px){.lib-body{grid-template-columns:1fr}}
.lib-lbl{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
.lib-txt{font-size:13px;color:var(--text);line-height:1.5;white-space:pre-wrap}
/* MODAL */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;display:none;align-items:center;justify-content:center;padding:16px}
.overlay.on{display:flex}
.modal{background:var(--card);border:1px solid var(--border);border-radius:14px;width:100%;max-width:560px;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.6)}
.modal h2{font-size:16px;font-weight:700;margin-bottom:16px}
.mf{margin-bottom:13px}
.mf label{display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
.mf input,.mf select,.mf textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;padding:9px 12px;outline:none;transition:border-color .15s;font-family:inherit;resize:vertical}
.mf input:focus,.mf select:focus,.mf textarea:focus{border-color:var(--accent)}
.mf textarea{min-height:90px}
.modal-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
.btn-cancel{padding:8px 16px;background:transparent;border:1px solid var(--border);border-radius:7px;color:var(--muted);font-size:13px;cursor:pointer}
.btn-save{padding:8px 18px;background:var(--accent);border:none;border-radius:7px;color:white;font-size:13px;font-weight:700;cursor:pointer}
.btn-save:hover{background:var(--accent-light)}
/* UTIL */
.loading{color:var(--muted);font-size:13px;padding:36px;text-align:center}
.empty{color:var(--muted);font-size:13px;padding:28px;text-align:center}
.toast{position:fixed;bottom:20px;right:16px;left:16px;max-width:360px;margin:0 auto;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px 14px;font-size:13px;color:var(--text);box-shadow:0 8px 32px rgba(0,0,0,.5);z-index:200;transform:translateY(80px);opacity:0;transition:all .25s;pointer-events:none}
.toast.on{transform:translateY(0);opacity:1}
.toast.ok{border-color:var(--success)}.toast.err{border-color:var(--danger)}
</style>
</head>
<body>

<div id="login-screen">
  <div class="login-box">
    <div class="login-logo">
      <div class="login-logo-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 12 6 12s6-6.75 6-12c0-3.314-2.686-6-6-6z"/><circle cx="12" cy="8" r="2" fill="#1a8c83" stroke="none"/></svg>
      </div>
      <div>
        <div class="login-logo-text">Care Net Portal</div>
        <div class="login-logo-sub">Admin Office</div>
      </div>
    </div>
    <h1>Sign In</h1>
    <p>Admin access only — separate from the portal.</p>
    <div class="field">
      <label>Email</label>
      <input type="email" id="em" autocomplete="email" placeholder="your@email.com">
    </div>
    <div class="field">
      <label>Password</label>
      <div class="pw-wrap">
        <input type="password" id="pw" autocomplete="current-password" placeholder="••••••••">
        <span class="pw-toggle" id="pw-eye">Show</span>
      </div>
    </div>
    <button class="btn-primary" id="btn-login">Sign In to Admin Office</button>
    <div class="login-msg" id="login-msg"></div>
  </div>
</div>

<div id="app">
  <div class="header">
    <div class="header-logo">
      <div class="header-logo-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 12 6 12s6-6.75 6-12c0-3.314-2.686-6-6-6z"/><circle cx="12" cy="8" r="2" fill="#1a8c83" stroke="none"/></svg>
      </div>
      <span class="header-logo-text">Admin Office</span>
    </div>
    <div class="header-right">
      <span class="header-user" id="hdr-user"></span>
      <button class="btn-sm" id="btn-out">Sign Out</button>
    </div>
  </div>

  <div class="tabs">
    <div class="tab active" data-v="dashboard">
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>Dashboard
    </div>
    <div class="tab" data-v="portals">
      <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Portals
    </div>
    <div class="tab" data-v="users">
      <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Users
    </div>
    <div class="tab" data-v="queue">
      <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>Queue
      <span class="tab-badge" id="q-badge" style="display:none"></span>
    </div>
    <div class="tab" data-v="library">
      <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>Library
    </div>
  </div>

  <div class="toolbar">
    <div>
      <div class="toolbar-title" id="tb-title">Dashboard</div>
      <div class="toolbar-sub" id="tb-sub">Overview of all portals and users</div>
    </div>
    <div class="toolbar-right">
      <button class="btn-refresh" id="btn-refresh">Refresh</button>
    </div>
  </div>

  <div class="content">
    <div class="view active" id="view-dashboard">
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Total Users</div><div class="stat-num" id="s-total">—</div><div class="stat-sub">non-demo</div></div>
        <div class="stat-card"><div class="stat-label">Active Portals</div><div class="stat-num c-accent" id="s-portals">—</div><div class="stat-sub">care circles</div></div>
        <div class="stat-card"><div class="stat-label">Active This Week</div><div class="stat-num c-success" id="s-active">—</div><div class="stat-sub">logged in 7d</div></div>
        <div class="stat-card"><div class="stat-label">Pending Queue</div><div class="stat-num c-warn" id="s-queue">—</div><div class="stat-sub">awaiting review</div></div>
      </div>
      <div class="sec-hdr">Recent Users</div>
      <div class="tbl-wrap" id="d-recent"><div class="loading">Loading...</div></div>
      <div class="sec-hdr">Pending Queue</div>
      <div class="tbl-wrap" id="d-queue"><div class="loading">Loading...</div></div>
    </div>
    <div class="view" id="view-portals"><div id="portals-list"><div class="loading">Loading...</div></div></div>
    <div class="view" id="view-users">
      <div class="search-row">
        <input class="search-input" id="u-search" placeholder="Search name or email...">
        <select class="sort-sel" id="u-sort">
          <option value="login">Last Login</option>
          <option value="name">Name A–Z</option>
          <option value="entries">Most Active</option>
        </select>
      </div>
      <div class="tbl-wrap" id="users-tbl"><div class="loading">Loading...</div></div>
    </div>
    <div class="view" id="view-queue"><div class="tbl-wrap" id="queue-tbl"><div class="loading">Loading...</div></div></div>
    <div class="view" id="view-library">
      <div class="lib-ctrl">
        <select class="sort-sel" id="lib-filter"><option value="">All Themes</option></select>
        <button class="btn-add" id="btn-new-lib">+ New Response</button>
      </div>
      <div id="lib-list"><div class="loading">Loading...</div></div>
    </div>
  </div>
</div>

<div class="overlay" id="lib-modal">
  <div class="modal">
    <h2 id="lib-modal-title">New Response</h2>
    <input type="hidden" id="lm-id">
    <div class="mf"><label>Theme</label><input type="text" id="lm-theme" placeholder="e.g. burnout, general"></div>
    <div class="mf"><label>Example Caregiver Message</label><textarea id="lm-prompt" placeholder="What a caregiver might say..."></textarea></div>
    <div class="mf"><label>Becky's Response</label><textarea id="lm-response" style="min-height:120px" placeholder="Response text..."></textarea></div>
    <div class="mf"><label>Status</label><select id="lm-active"><option value="1">Active</option><option value="0">Inactive (draft)</option></select></div>
    <div class="modal-btns">
      <button class="btn-cancel" id="lib-cancel">Cancel</button>
      <button class="btn-save" id="lib-save">Save</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
(function() {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────
  var TOKEN_KEY = 'office_token';
  var engData = [];
  var appData = [];
  var libData = [];
  var currentUser = null;

  // ── Helpers ────────────────────────────────────────────────────────────
  function tok() { return localStorage.getItem(TOKEN_KEY); }
  function setTok(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearTok() { localStorage.removeItem(TOKEN_KEY); }

  function authHdr() {
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok() };
  }

  function callApi(method, path, body) {
    var opts = { method: method, headers: authHdr() };
    if (body) opts.body = JSON.stringify(body);
    return fetch(path, opts).then(function(r) {
      return r.json().then(function(d) {
        if (!r.ok) throw new Error(d.message || r.statusText);
        return d;
      });
    });
  }

  var toastTimer;
  function showToast(msg, type) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast on' + (type ? ' ' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { el.classList.remove('on'); }, 3000);
  }

  function ago(iso) {
    if (!iso) return '—';
    var d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d === 0) return 'today';
    if (d === 1) return 'yesterday';
    if (d < 7) return d + 'd ago';
    if (d < 30) return Math.floor(d/7) + 'w ago';
    return Math.floor(d/30) + 'mo ago';
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function roleChip(r) {
    var labels = { caregiver:'CG', primary_family:'MC', secondary_family:'Family', self_care:'Self' };
    var cls = { caregiver:'r-cg', primary_family:'r-mc', secondary_family:'r-fm', self_care:'r-sc' };
    return '<span class="chip ' + (cls[r]||'') + '">' + (labels[r]||r) + '</span>';
  }

  function tierSpan(t) {
    return '<span class="t-' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</span>';
  }

  function msg(text, type) {
    var el = document.getElementById('login-msg');
    el.textContent = text;
    el.className = 'login-msg ' + (type || 'info');
  }

  // ── Login ──────────────────────────────────────────────────────────────
  function doLogin() {
    var email = document.getElementById('em').value.trim();
    var password = document.getElementById('pw').value;
    var btn = document.getElementById('btn-login');
    if (!email || !password) { msg('Enter your email and password.', 'error'); return; }
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    msg('Contacting server...', 'info');

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, status: r.status, data: d }; }); })
    .then(function(res) {
      if (!res.ok || !res.data.token) {
        throw new Error(res.data.message || 'Login failed (' + res.status + ')');
      }
      msg('Checking admin access...', 'info');
      return fetch('/api/admin/whoami', {
        headers: { 'Authorization': 'Bearer ' + res.data.token }
      }).then(function(r2) {
        return r2.json().then(function(d2) {
          return { token: res.data.token, user: res.data.user, whoami: d2 };
        });
      });
    })
    .then(function(res) {
      if (!res.whoami.isAdmin) {
        throw new Error('Not an admin account (user ' + res.whoami.authUserId + ')');
      }
      setTok(res.token);
      currentUser = { name: (res.user && res.user.name) || res.whoami.email || 'Admin' };
      showApp();
    })
    .catch(function(e) {
      msg(e.message || 'Unknown error. Try again.', 'error');
      btn.disabled = false;
      btn.textContent = 'Sign In to Admin Office';
    });
  }

  // ── Show app ──────────────────────────────────────────────────────────
  function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.add('on');
    document.getElementById('hdr-user').textContent = currentUser.name;
    loadAll();
  }

  // ── Load data ─────────────────────────────────────────────────────────
  function loadAll() {
    Promise.all([
      callApi('GET', '/api/admin/engagement'),
      callApi('GET', '/api/admin/applications')
    ]).then(function(results) {
      engData = results[0];
      appData = results[1];
      renderDashboard();
      renderPortals();
      renderUsers();
      renderQueue();
      updateQueueBadge();
    }).catch(function(e) { showToast('Load error: ' + e.message, 'err'); });
  }

  function updateQueueBadge() {
    var n = appData.filter(function(a) { return a.status === 'pending'; }).length;
    var b = document.getElementById('q-badge');
    b.style.display = n > 0 ? '' : 'none';
    b.textContent = n;
  }

  // ── Dashboard ─────────────────────────────────────────────────────────
  function renderDashboard() {
    document.getElementById('s-total').textContent = engData.length;
    var portals = {};
    engData.forEach(function(u) { if (u.clientId) portals[u.clientId] = 1; });
    document.getElementById('s-portals').textContent = Object.keys(portals).length;
    document.getElementById('s-active').textContent = engData.filter(function(u) { return u.daysSinceLogin <= 7; }).length;
    var pend = appData.filter(function(a) { return a.status === 'pending'; });
    document.getElementById('s-queue').textContent = pend.length;
    var recent = engData.slice().sort(function(a,b) { return a.daysSinceLogin - b.daysSinceLogin; }).slice(0,10);
    renderEngTable('d-recent', recent);
    renderQueueTable('d-queue', pend.slice(0,5), true);
  }

  // ── Portals ───────────────────────────────────────────────────────────
  function renderPortals() {
    var groups = {};
    engData.forEach(function(u) {
      if (!u.clientId) return;
      if (!groups[u.clientId]) groups[u.clientId] = [];
      groups[u.clientId].push(u);
    });
    var keys = Object.keys(groups);
    var container = document.getElementById('portals-list');
    if (!keys.length) { container.innerHTML = '<div class="empty">No portals found.</div>'; return; }
    var html = '';
    keys.forEach(function(cid) {
      var members = groups[cid];
      var mc = members.find(function(u) { return u.role === 'primary_family'; });
      var cg = members.find(function(u) { return u.role === 'caregiver'; });
      var label = mc ? (mc.name||'Portal '+cid) : cg ? cg.name : 'Portal '+cid;
      var tiers = members.map(function(u) { return u.tier; });
      var health = tiers.indexOf('active') > -1 ? 'active' : tiers.indexOf('moderate') > -1 ? 'moderate' : 'quiet';
      var logins = members.map(function(u) { return u.lastLoginAt; }).filter(Boolean).sort().reverse();
      html += '<div class="pg"><div class="pg-hdr"><div class="dot dot-'+health+'"></div>';
      html += '<div class="pg-name">'+esc(label)+'</div>';
      html += '<div class="pg-meta">Portal #'+cid+' &middot; '+members.length+' member'+(members.length!==1?'s':'')+' &middot; '+ago(logins[0])+'</div></div>';
      html += '<table><thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Last Login</th><th>Activity</th></tr></thead><tbody>';
      members.forEach(function(u) {
        html += '<tr><td>'+esc(u.name||'—')+'</td><td>'+roleChip(u.role)+'</td><td class="td-e">'+esc(u.email||'—')+'</td><td class="td-m">'+ago(u.lastLoginAt)+'</td><td class="td-m">'+u.totalEntries+' entries</td></tr>';
      });
      html += '</tbody></table></div>';
    });
    container.innerHTML = html;
  }

  // ── Users ─────────────────────────────────────────────────────────────
  function renderUsers() {
    var data = engData.slice();
    var q = document.getElementById('u-search').value.toLowerCase();
    if (q) data = data.filter(function(u) { return (u.name||'').toLowerCase().indexOf(q) > -1 || (u.email||'').toLowerCase().indexOf(q) > -1; });
    var s = document.getElementById('u-sort').value;
    if (s === 'login') data.sort(function(a,b) { return a.daysSinceLogin - b.daysSinceLogin; });
    else if (s === 'name') data.sort(function(a,b) { return (a.name||'').localeCompare(b.name||''); });
    else if (s === 'entries') data.sort(function(a,b) { return b.totalEntries - a.totalEntries; });
    var wrap = document.getElementById('users-tbl');
    if (!data.length) { wrap.innerHTML = '<div class="empty">No users found.</div>'; return; }
    var html = '<div class="user-cards">';
    data.forEach(function(u) {
      var noPortal = u.role === 'primary_family' && !u.clientId;
      var portalTxt = u.clientId ? '#'+u.clientId : '<span style="color:var(--warn);font-weight:700;">No portal</span>';
      html += '<div class="user-card">';
      html += '<div class="uc-top"><div class="uc-name">'+esc(u.name||'—')+'</div><div class="uc-chips">'+roleChip(u.role)+' '+tierSpan(u.tier)+'</div></div>';
      html += '<div class="uc-email">'+esc(u.email||'—')+'</div>';
      html += '<div class="uc-meta"><span>Portal: '+portalTxt+'</span><span>Login: '+ago(u.lastLoginAt)+'</span><span>Activity: '+u.totalEntries+'</span></div>';
      html += '<div class="uc-acts">';
      if (noPortal) html += '<button class="btn-act btn-link-act" data-id="'+u.id+'" data-name="'+esc(u.name||'')+'" data-action="link">Link Portal</button>';
      html += '<button class="btn-act btn-role-act" data-id="'+u.id+'" data-role="'+esc(u.role||'')+'" data-name="'+esc(u.name||'')+'" data-action="role">Change Role</button>';
      html += '<button class="btn-act btn-deny-act" data-email="'+esc(u.email||'')+'" data-action="deactivate">Deactivate</button>';
      html += '</div></div>';
    });
    html += '</div>';
    wrap.innerHTML = html;
  }

  // ── Queue ─────────────────────────────────────────────────────────────
  function renderQueue() {
    renderQueueTable('queue-tbl', appData.filter(function(a) { return a.status === 'pending'; }), false);
  }

  function renderQueueTable(id, apps, compact) {
    var wrap = document.getElementById(id);
    if (!apps.length) { wrap.innerHTML = '<div class="empty">No pending applications.</div>'; return; }
    var html = '<table><thead><tr><th>Name</th><th>Email</th><th>Applied</th><th>Verified</th><th>Status</th>'+(compact?'':'<th>Actions</th>')+'</tr></thead><tbody>';
    apps.forEach(function(a) {
      html += '<tr><td><strong>'+esc(a.name||'—')+'</strong></td><td class="td-e">'+esc(a.email||'—')+'</td>';
      html += '<td class="td-m">'+fmtDate(a.createdAt)+'</td>';
      html += '<td><span class="chip '+(a.emailVerified?'e-ok':'e-no')+'">'+(a.emailVerified?'✓ Yes':'✗ No')+'</span></td>';
      html += '<td><span class="chip s-'+(a.status||'pending')+'">'+(a.status||'pending')+'</span></td>';
      if (!compact) html += '<td><div class="acts"><button class="btn-act btn-approve-act" data-id="'+a.id+'" data-action="approve">Approve</button><button class="btn-act btn-deny-act" data-id="'+a.id+'" data-action="deny">Deny</button></div></td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function renderEngTable(id, data) {
    var wrap = document.getElementById(id);
    if (!data.length) { wrap.innerHTML = '<div class="empty">No users.</div>'; return; }
    var html = '<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Activity</th><th>Status</th></tr></thead><tbody>';
    data.forEach(function(u) {
      html += '<tr><td><strong>'+esc(u.name||'—')+'</strong></td><td class="td-e">'+esc(u.email||'—')+'</td><td>'+roleChip(u.role)+'</td><td class="td-m">'+ago(u.lastLoginAt)+'</td><td class="td-m">'+u.totalEntries+' entries</td><td>'+tierSpan(u.tier)+'</td></tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  // ── Library ───────────────────────────────────────────────────────────
  function loadLibrary() {
    callApi('GET', '/api/becky-library').then(function(data) {
      libData = data;
      renderLibrary();
    }).catch(function() { document.getElementById('lib-list').innerHTML = '<div class="empty">Error loading library.</div>'; });
  }

  function renderLibrary() {
    var filter = document.getElementById('lib-filter').value;
    var data = filter ? libData.filter(function(r) { return r.theme === filter; }) : libData;
    var themes = [];
    libData.forEach(function(r) { if (themes.indexOf(r.theme) === -1) themes.push(r.theme); });
    themes.sort();
    var sel = document.getElementById('lib-filter');
    var cur = sel.value;
    sel.innerHTML = '<option value="">All Themes</option>' + themes.map(function(t) { return '<option value="'+esc(t)+'"'+(t===cur?' selected':'')+'>'+esc(t)+'</option>'; }).join('');
    var container = document.getElementById('lib-list');
    if (!data.length) { container.innerHTML = '<div class="empty">No responses yet.</div>'; return; }
    var html = '';
    data.forEach(function(r) {
      html += '<div class="lib-card"><div class="lib-hdr"><span class="lib-theme">'+esc(r.theme)+'</span>';
      if (r.isPlaceholder) html += '<span class="lib-ph">Needs editing</span>';
      if (!r.isActive) html += '<span class="lib-off">Inactive</span>';
      html += '<div class="acts" style="margin-left:auto"><button class="btn-act btn-approve-act" data-id="'+r.id+'" data-action="lib-edit">Edit</button><button class="btn-act btn-deny-act" data-id="'+r.id+'" data-action="lib-del">Delete</button></div>';
      html += '</div><div class="lib-body"><div><div class="lib-lbl">Example Message</div><div class="lib-txt">'+esc(r.examplePrompt)+'</div></div><div><div class="lib-lbl">Response</div><div class="lib-txt">'+esc(r.response)+'</div></div></div></div>';
    });
    container.innerHTML = html;
  }

  function openLibModal(entry) {
    document.getElementById('lib-modal-title').textContent = entry ? 'Edit Response' : 'New Response';
    document.getElementById('lm-id').value = entry ? entry.id : '';
    document.getElementById('lm-theme').value = entry ? entry.theme : '';
    document.getElementById('lm-prompt').value = entry ? entry.examplePrompt : '';
    document.getElementById('lm-response').value = entry ? entry.response : '';
    document.getElementById('lm-active').value = entry ? (entry.isActive ? '1' : '0') : '1';
    document.getElementById('lib-modal').classList.add('on');
  }

  function closeLibModal() { document.getElementById('lib-modal').classList.remove('on'); }

  function saveLib() {
    var id = document.getElementById('lm-id').value;
    var body = {
      theme: document.getElementById('lm-theme').value.trim(),
      examplePrompt: document.getElementById('lm-prompt').value.trim(),
      response: document.getElementById('lm-response').value.trim(),
      isActive: document.getElementById('lm-active').value === '1' ? 1 : 0,
      isPlaceholder: 0
    };
    if (!body.theme || !body.examplePrompt || !body.response) { showToast('All fields required', 'err'); return; }
    var p = id ? callApi('PATCH', '/api/becky-library/'+id, body) : callApi('POST', '/api/becky-library', body);
    p.then(function() { showToast(id ? 'Updated' : 'Added', 'ok'); closeLibModal(); loadLibrary(); })
     .catch(function(e) { showToast('Error: '+e.message, 'err'); });
  }

  // ── Event delegation ──────────────────────────────────────────────────
  var viewMeta = {
    dashboard: ['Dashboard','Overview of all portals and users'],
    portals:   ['Portals','All active care circles'],
    users:     ['Users','All registered accounts'],
    queue:     ['Queue','Pending signup applications'],
    library:   ['Library','Response bank'],
  };

  document.addEventListener('click', function(e) {
    var t = e.target;

    // Tabs
    var tab = t.closest ? t.closest('.tab') : null;
    if (tab && tab.dataset.v) {
      var v = tab.dataset.v;
      document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
      tab.classList.add('active');
      document.querySelectorAll('.view').forEach(function(x) { x.classList.remove('active'); });
      document.getElementById('view-'+v).classList.add('active');
      var meta = viewMeta[v] || [v, ''];
      document.getElementById('tb-title').textContent = meta[0];
      document.getElementById('tb-sub').textContent = meta[1];
      if (v === 'library') loadLibrary();
      return;
    }

    // Action buttons
    var action = t.dataset && t.dataset.action;
    if (action === 'approve') {
      callApi('POST', '/api/admin/applications/'+t.dataset.id+'/approve')
        .then(function() { showToast('Approved','ok'); loadAll(); })
        .catch(function(e) { showToast('Error: '+e.message,'err'); });
    } else if (action === 'deny') {
      if (!confirm('Deny this application?')) return;
      callApi('POST', '/api/admin/applications/'+t.dataset.id+'/deny')
        .then(function() { showToast('Denied','ok'); loadAll(); })
        .catch(function(e) { showToast('Error: '+e.message,'err'); });
    } else if (action === 'deactivate') {
      if (!confirm('Deactivate account for '+t.dataset.email+'?')) return;
      callApi('POST', '/api/admin/users/deactivate', { email: t.dataset.email })
        .then(function() { showToast('Deactivated','ok'); loadAll(); })
        .catch(function(e) { showToast('Error: '+e.message,'err'); });
    } else if (action === 'role') {
      var roles = ['caregiver','primary_family','secondary_family','self_care'];
      var current = t.dataset.role || 'unknown';
      var newRole = prompt('Change role for '+t.dataset.name+'\nCurrent: '+current+'\n\nEnter new role:\n caregiver\n primary_family\n secondary_family\n self_care');
      if (!newRole || !roles.includes(newRole.trim())) return;
      callApi('POST', '/api/admin/users/'+t.dataset.id+'/role', { role: newRole.trim() })
        .then(function() { showToast('Role changed to '+newRole.trim(),'ok'); loadAll(); })
        .catch(function(e) { showToast('Error: '+e.message,'err'); });
    } else if (action === 'link') {
      var cid = prompt('Link '+t.dataset.name+' to which portal?\nEnter the clientId number (see Portals tab):');
      if (!cid || isNaN(Number(cid))) return;
      callApi('POST', '/api/admin/users/'+t.dataset.id+'/link-portal', { clientId: Number(cid) })
        .then(function() { showToast('Linked to portal #'+cid,'ok'); loadAll(); })
        .catch(function(e) { showToast('Error: '+e.message,'err'); });
    } else if (action === 'lib-edit') {
      var entry = libData.find(function(r) { return String(r.id) === String(t.dataset.id); });
      if (entry) openLibModal(entry);
    } else if (action === 'lib-del') {
      if (!confirm('Delete this response?')) return;
      callApi('DELETE', '/api/becky-library/'+t.dataset.id)
        .then(function() { showToast('Deleted','ok'); loadLibrary(); })
        .catch(function(e) { showToast('Error: '+e.message,'err'); });
    }

    // Show/hide password
    if (t.id === 'pw-eye') {
      var inp = document.getElementById('pw');
      if (inp.type === 'password') { inp.type = 'text'; t.textContent = 'Hide'; }
      else { inp.type = 'password'; t.textContent = 'Show'; }
    }

    // Login button
    if (t.id === 'btn-login') { doLogin(); }

    // Sign out
    if (t.id === 'btn-out') {
      callApi('POST', '/api/auth/logout').catch(function(){});
      clearTok();
      location.reload();
    }

    // Refresh
    if (t.id === 'btn-refresh') { loadAll(); }

    // New library entry
    if (t.id === 'btn-new-lib') { openLibModal(null); }

    // Modal cancel/save
    if (t.id === 'lib-cancel') { closeLibModal(); }
    if (t.id === 'lib-save') { saveLib(); }

    // Overlay click to close
    if (t.id === 'lib-modal') { closeLibModal(); }
  });

  // Search/sort listeners
  document.getElementById('u-search').addEventListener('input', renderUsers);
  document.getElementById('u-sort').addEventListener('change', renderUsers);
  document.getElementById('lib-filter').addEventListener('change', renderLibrary);

  // Enter key on login
  document.getElementById('pw').addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });
  document.getElementById('em').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('pw').focus(); });

  // ── Init ──────────────────────────────────────────────────────────────
  var saved = tok();
  if (saved) {
    fetch('/api/admin/whoami', { headers: { 'Authorization': 'Bearer ' + saved } })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.isAdmin) {
          currentUser = { name: d.email || 'Admin' };
          showApp();
        } else {
          clearTok();
          document.getElementById('login-screen').style.display = 'flex';
        }
      })
      .catch(function() {
        clearTok();
        document.getElementById('login-screen').style.display = 'flex';
      });
  } else {
    document.getElementById('login-screen').style.display = 'flex';
  }

})();
</script>
</body>
</html>`;
}
