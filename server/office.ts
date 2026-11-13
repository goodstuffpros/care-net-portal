export function getOfficeHtml(): string {
  return String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Office — CareNet Portal</title>
<link rel="icon" href="/icon-192.png">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#F4F3EF;--card:#ffffff;--line:#E3E1DA;--ink:#1d2a2c;--muted:#6b7577;--teal:#01696F;--deep:#0C4E54;--mint:#E3F2F0;--good:#15803d;--goodbg:#e7f6ec;--warn:#b45309;--warnbg:#fdf3e2;--bad:#b91c1c;--badbg:#fdeceb;--grey:#5b6466;--greybg:#eeeeea}
html,body{background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.4}
button{font-family:inherit}
/* login */
#login{display:none;min-height:100vh;align-items:center;justify-content:center;padding:16px;background:linear-gradient(160deg,#0C4E54 0%,#01696F 100%)}
.lbox{background:#fff;border-radius:16px;padding:32px 26px;width:100%;max-width:380px;box-shadow:0 20px 50px rgba(0,0,0,.25)}
.brand{display:flex;align-items:center;gap:10px}
.brand img{width:36px;height:36px;border-radius:9px}
.brand b{display:block;font-size:15px}
.brand span{font-size:12px;color:var(--muted)}
.lbox h1{font-size:20px;margin:22px 0 4px}
.lbox p{color:var(--muted);font-size:13px;margin-bottom:18px}
.fld{margin-bottom:12px}
.fld label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px}
.fld input{width:100%;border:1px solid var(--line);border-radius:8px;padding:11px 12px;font-size:15px;outline:none}
.fld input:focus{border-color:var(--teal)}
.btn{background:var(--teal);color:#fff;border:0;border-radius:8px;padding:12px 16px;font-size:14px;font-weight:700;cursor:pointer;width:100%}
.btn:disabled{opacity:.6}
.lmsg{font-size:13px;margin-top:10px;color:var(--bad);min-height:18px}
/* shell */
#app{display:none}
.top{background:var(--deep);color:#fff;padding:0 20px}
.top-in{max-width:1280px;margin:0 auto;display:flex;align-items:center;gap:12px;height:56px}
.top .brand b{color:#fff}.top .brand span{color:#a9dcd8}
.top .brand img{width:30px;height:30px;border-radius:8px}
.top-r{margin-left:auto;display:flex;align-items:center;gap:10px;font-size:12px;color:#cfe7e5}
.ghost{background:transparent;border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:7px;padding:6px 11px;font-size:12px;font-weight:600;cursor:pointer}
.tabs{background:#fff;border-bottom:1px solid var(--line);padding:0 20px;position:sticky;top:0;z-index:5}
.tabs-in{max-width:1280px;margin:0 auto;display:flex;gap:4px;overflow-x:auto}
.tab{padding:14px 14px 12px;font-size:14px;font-weight:600;color:var(--muted);border-bottom:3px solid transparent;cursor:pointer;white-space:nowrap;user-select:none}
.tab.on{color:var(--teal);border-bottom-color:var(--teal)}
main{max-width:1280px;margin:0 auto;padding:20px}
.view{display:none}.view.on{display:block}
.note{font-size:12px;color:var(--muted);margin:6px 0 16px}
h2{font-size:17px;margin:26px 0 10px}
h2:first-child{margin-top:4px}
/* stat cards */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.stat .k{font-size:12px;font-weight:600;color:var(--muted)}
.stat .v{font-size:30px;font-weight:700;margin:4px 0 2px;color:var(--deep)}
.stat .s{font-size:12px;color:var(--muted)}
.up{color:var(--good);font-weight:600}.down{color:var(--bad);font-weight:600}
/* cards & tables */
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.pad{padding:14px 16px}
table{width:100%;border-collapse:collapse}
th{font-size:12px;font-weight:600;color:var(--muted);text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);background:#fbfaf7;white-space:nowrap;cursor:pointer;user-select:none}
th.num,td.num{text-align:right}
td{padding:10px 12px;border-bottom:1px solid #efede7;vertical-align:top}
tr.row{cursor:pointer}
tr.row:hover td{background:#f6faf9}
tr.dim td{color:#9aa2a3}
.tw{overflow-x:auto}
.sub{font-size:12px;color:var(--muted)}
.pill{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;white-space:nowrap}
.p-good{background:var(--goodbg);color:var(--good)}.p-warn{background:var(--warnbg);color:var(--warn)}.p-bad{background:var(--badbg);color:var(--bad)}.p-grey{background:var(--greybg);color:var(--grey)}.p-teal{background:var(--mint);color:var(--deep)}
.tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.tools input[type=text],.tools input:not([type]),.tools select{border:1px solid var(--line);border-radius:8px;padding:9px 11px;font-size:14px;background:#fff}
.tools input:not([type]){min-width:220px;flex:1;max-width:360px}
.chk input{width:16px;height:16px;accent-color:#01696F}
a{color:var(--teal)}
.chk{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted)}
.att{list-style:none}
.att li{padding:10px 16px;border-bottom:1px solid #efede7;display:flex;gap:10px;align-items:flex-start;cursor:pointer}
.att li:last-child{border-bottom:0}
.att li:hover{background:#f6faf9}
.empty{padding:22px;text-align:center;color:var(--muted)}
/* chart */
.chart{padding:14px 16px 8px}
.legend{display:flex;gap:16px;font-size:12px;color:var(--muted);margin-bottom:6px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.bars{display:flex;align-items:flex-end;gap:3px;height:150px;border-bottom:1px solid var(--line)}
.bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;position:relative;height:100%}
.bar .a{width:100%;background:var(--teal);border-radius:3px 3px 0 0;min-height:0}
.bar .pp{position:absolute;width:7px;height:7px;border-radius:50%;background:#d97706;left:50%;margin-left:-3.5px}
.bar:hover{background:rgba(1,105,111,.06)}
.xl{display:flex;gap:3px;font-size:10px;color:var(--muted);margin-top:4px}
.xl span{flex:1;text-align:center;white-space:nowrap;overflow:hidden}
.tip{position:fixed;background:var(--ink);color:#fff;font-size:12px;padding:6px 9px;border-radius:6px;pointer-events:none;display:none;z-index:50}
/* feature bars */
.fbar{height:8px;background:#eceae4;border-radius:99px;overflow:hidden;min-width:80px}
.fbar i{display:block;height:100%;background:var(--teal)}
/* drawer */
.shade{position:fixed;inset:0;background:rgba(0,0,0,.35);display:none;z-index:20}
.shade.on{display:block}
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(560px,100%);background:#fff;z-index:21;transform:translateX(100%);transition:transform .2s,visibility .2s;overflow-y:auto;visibility:hidden}
.drawer.on{transform:none;visibility:visible;box-shadow:-10px 0 30px rgba(0,0,0,.15)}
.dh{padding:18px 20px;border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:flex-start;position:sticky;top:0;background:#fff}
.dh h3{font-size:18px}
.x{margin-left:auto;background:none;border:0;font-size:26px;line-height:1;cursor:pointer;color:var(--muted)}
.db{padding:16px 20px 30px}
.kv{display:grid;grid-template-columns:140px 1fr;gap:6px 12px;font-size:13px;margin-bottom:16px}
.kv div:nth-child(odd){color:var(--muted)}
.db h4{font-size:13px;margin:18px 0 8px;color:var(--deep)}
.mini td{padding:7px 0;border-bottom:1px solid #f0eee8;font-size:13px}
.act{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
.b2{border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 12px;font-size:13px;font-weight:600;cursor:pointer}
.b2.red{color:var(--bad);border-color:#f0c9c6}
.b2.teal{color:var(--teal);border-color:#b9dcd9}
/* library */
.lib-card{background:#fff;border:1px solid var(--line);border-radius:10px;margin-bottom:10px}
.lib-hdr{padding:10px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--line)}
.lib-body{padding:12px 14px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lib-lbl{font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px}
.lib-txt{white-space:pre-wrap;font-size:13px}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:30;display:none;align-items:center;justify-content:center;padding:16px}
.overlay.on{display:flex}
.modal{background:#fff;border-radius:14px;width:100%;max-width:560px;padding:22px}
.modal h2{margin:0 0 14px}
.mf{margin-bottom:12px}
.mf label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px}
.mf input,.mf select,.mf textarea{width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 11px;font-size:14px;font-family:inherit}
.mf textarea{min-height:90px}
.modal-btns{display:flex;gap:8px;justify-content:flex-end}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;display:none;z-index:60}
.toast.on{display:block}
.sortm{display:none}
@media(max-width:700px){main{padding:14px}.lib-body{grid-template-columns:1fr}.kv{grid-template-columns:110px 1fr}.hide-sm{display:none}
 #updated{display:none}.top{padding:0 12px}.top .brand span{display:none}.tabs{padding:0 6px}.tab{padding:13px 10px 11px}.tools input:not([type]){min-width:0;max-width:none;width:100%;flex-basis:100%}
 .cols td,.cols th{padding:10px 8px}.cols .sub.em{display:none}.cols td:first-child{max-width:130px}
 .xl span{overflow:visible}
}
</style>
</head>
<body>

<div id="login">
  <div class="lbox">
    <div class="brand"><img src="/icon-192.png" alt=""><div><b>CareNet Portal</b><span>Office</span></div></div>
    <h1>Sign in</h1>
    <p>For the CareNet Portal team only.</p>
    <div class="fld"><label for="em">Email</label><input id="em" type="email" autocomplete="username"></div>
    <div class="fld"><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password"></div>
    <button class="btn" id="btn-login">Sign in</button>
    <div class="lmsg" id="lmsg"></div>
  </div>
</div>

<div id="app">
  <div class="top"><div class="top-in">
    <div class="brand"><img src="/icon-192.png" alt=""><div><b>CareNet Portal</b><span>Office</span></div></div>
    <div class="top-r"><span id="updated"></span><button class="ghost" id="btn-refresh">Refresh</button><button class="ghost" id="btn-out">Sign out</button></div>
  </div></div>
  <div class="tabs"><div class="tabs-in">
    <div class="tab on" data-v="overview">Overview</div>
    <div class="tab" data-v="people">People</div>
    <div class="tab" data-v="portals">Portals</div>
    <div class="tab" data-v="features">Features</div>
    <div class="tab" data-v="library">Library</div>
  </div></div>
  <main>
    <section class="view on" id="v-overview"><div class="empty">Loading…</div></section>
    <section class="view" id="v-people">
      <div class="tools">
        <input id="p-q" placeholder="Search name or email">
        <select id="p-status"><option value="">All statuses</option></select>
        <select id="p-role"><option value="">All roles</option></select>
        <select id="p-sort" class="sortm"><option value="lastSeenAt">Sort: last visit</option><option value="lastActionAt">Sort: last action</option><option value="actions7">Sort: most active this week</option><option value="actions30">Sort: most active, 30 days</option><option value="joinedAt">Sort: newest</option><option value="name">Sort: name</option></select>
        <label class="chk"><input type="checkbox" id="p-all"> Show team and test accounts</label>
      </div>
      <div class="card tw cols" id="p-tbl"></div>
      <div class="note" id="p-note"></div>
    </section>
    <section class="view" id="v-portals">
      <div class="tools">
        <input id="o-q" placeholder="Search portal or member">
        <select id="o-tier"><option value="">All plans</option><option value="beta">Beta (free for life)</option><option value="founder">Founder</option><option value="standard">Standard</option></select>
        <select id="o-sort" class="sortm"><option value="lastActionAt">Sort: last activity</option><option value="actions7">Sort: most active this week</option><option value="actions30">Sort: most active, 30 days</option><option value="nextChargeAt">Sort: next charge</option><option value="name">Sort: name</option></select>
        <label class="chk"><input type="checkbox" id="o-all"> Show team and test portals</label>
      </div>
      <div class="card tw cols" id="o-tbl"></div>
    </section>
    <section class="view" id="v-features"></section>
    <section class="view" id="v-library">
      <div class="tools">
        <select id="lib-filter"><option value="">All themes</option></select>
        <button class="b2 teal" id="btn-new-lib">+ New response</button>
      </div>
      <div class="note">The response bank the help button draws from.</div>
      <div id="lib-list"><div class="empty">Loading…</div></div>
    </section>
  </main>
</div>

<div class="shade" id="shade"></div>
<aside class="drawer" id="drawer"></aside>
<div class="tip" id="tip"></div>
<div class="toast" id="toast"></div>

<div class="overlay" id="lib-modal">
  <div class="modal">
    <h2 id="lib-modal-title">New response</h2>
    <input type="hidden" id="lm-id">
    <div class="mf"><label>Theme</label><input type="text" id="lm-theme" placeholder="e.g. burnout, general"></div>
    <div class="mf"><label>Example message</label><textarea id="lm-prompt"></textarea></div>
    <div class="mf"><label>Response</label><textarea id="lm-response" style="min-height:120px"></textarea></div>
    <div class="mf"><label>Status</label><select id="lm-active"><option value="1">Active</option><option value="0">Inactive (draft)</option></select></div>
    <div class="modal-btns"><button class="b2" id="lib-cancel">Cancel</button><button class="btn" style="width:auto" id="lib-save">Save</button></div>
  </div>
</div>

<script>
(function(){
'use strict';
var TOKEN_KEY='office_token', D=null, libData=[], sortP={k:'lastSeenAt',d:-1}, sortO={k:'lastActionAt',d:-1};
var TZ='America/Chicago', DAY=86400000;
function $(id){return document.getElementById(id)}
function tok(){return localStorage.getItem(TOKEN_KEY)}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function api(method,path,body){
  var o={method:method,headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok()}};
  if(body)o.body=JSON.stringify(body);
  return fetch(path,o).then(function(r){return r.json().catch(function(){return{}}).then(function(d){if(r.status===401||r.status===403){signOutLocal();throw new Error('Please sign in again')}if(!r.ok)throw new Error(d.message||r.statusText);return d})});
}
var tt;function toast(m){var e=$('toast');e.textContent=m;e.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){e.classList.remove('on')},3000)}
function ago(iso){
  if(!iso)return 'never';
  var ms=Date.now()-new Date(iso).getTime();
  if(ms<0)ms=0;
  var m=Math.floor(ms/60000),h=Math.floor(ms/3600000),d=Math.floor(ms/DAY);
  if(m<60)return m<=1?'just now':m+' min ago';
  if(h<24)return h+' hr ago';
  if(d===1)return 'yesterday';
  if(d<30)return d+' days ago';
  var mo=Math.floor(d/30);return mo+(mo===1?' month ago':' months ago');
}
function fmtDate(iso){if(!iso)return '—';return new Date(iso).toLocaleDateString('en-US',{timeZone:TZ,month:'short',day:'numeric',year:'numeric'})}
function fmtDT(iso){if(!iso)return '—';return new Date(iso).toLocaleString('en-US',{timeZone:TZ,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function n(v){return v==null?'—':Number(v).toLocaleString()}
var STATUS={'Active':'p-good','Looking only':'p-teal','New':'p-teal','Slowing down':'p-warn','Never started':'p-bad','Gone quiet':'p-grey','No login':'p-grey','Deactivated':'p-grey'};
var STATUS_HELP={'Active':'Visited and recorded something in the last 7 days','Looking only':'Visited in the last 7 days but recorded nothing','New':'Joined in the last 3 days','Slowing down':'Last visit was 8 to 30 days ago','Never started':'Joined 3+ days ago and has never recorded anything','Gone quiet':'No visit in over 30 days','No login':'Has no sign-in account','Deactivated':'Account turned off'};
function spill(s){return '<span class="pill '+(STATUS[s]||'p-grey')+'" title="'+esc(STATUS_HELP[s]||'')+'">'+esc(s)+'</span>'}
var TIER={beta:['Beta · free for life','p-teal'],founder:['Founder · $10','p-good'],standard:['Standard','p-grey']};
function tpill(t){var x=TIER[t]||[t,'p-grey'];return '<span class="pill '+x[1]+'">'+esc(x[0])+'</span>'}
var BILL={trial:['Free month','p-teal'],active:['Paying','p-good'],past_due:['Past due','p-bad'],grace:['Grace period','p-warn'],read_only:['Read only','p-bad'],canceled:['Canceled','p-grey']};
function bpill(p){if(p.tier==='beta')return '<span class="pill p-teal">Free for life</span>';var x=BILL[p.status]||[p.status,'p-grey'];return '<span class="pill '+x[1]+'">'+esc(x[0])+'</span>'}
function trend(a,b){if(!b&&!a)return '';if(!b)return '<span class="up">new this week</span>';var p=Math.round((a-b)/b*100);if(p===0)return 'same as last week';return '<span class="'+(p>0?'up':'down')+'">'+(p>0?'▲ ':'▼ ')+Math.abs(p)+'%</span> vs last week'}

/* ── login ── */
function showLogin(){$('login').style.display='flex';$('app').style.display='none'}
function signOutLocal(){localStorage.removeItem(TOKEN_KEY);showLogin()}
function doLogin(){
  var em=$('em').value.trim(),pw=$('pw').value,b=$('btn-login');
  if(!em||!pw){$('lmsg').textContent='Enter your email and password.';return}
  b.disabled=true;b.textContent='Signing in…';$('lmsg').textContent='';
  fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em,password:pw})})
  .then(function(r){return r.json().then(function(d){if(!r.ok||!d.token)throw new Error(d.message||'Sign in failed');return d.token})})
  .then(function(t){return fetch('/api/admin/whoami',{headers:{'Authorization':'Bearer '+t}}).then(function(r){return r.json()}).then(function(w){if(!w.isAdmin)throw new Error('This account does not have office access.');localStorage.setItem(TOKEN_KEY,t)})})
  .then(start)
  .catch(function(e){$('lmsg').textContent=e.message;b.disabled=false;b.textContent='Sign in'});
}
function start(){$('login').style.display='none';$('app').style.display='block';load();loadLibrary()}
function load(){
  $('updated').textContent='Loading…';
  api('GET','/api/admin/office/data').then(function(d){D=d;renderAll();$('updated').textContent='Updated '+fmtDT(d.generatedAt)}).catch(function(e){$('updated').textContent='';toast(e.message)});
}
function renderAll(){renderOverview();fillFilters();renderPeople();renderPortals();renderFeatures()}
function person(id){for(var i=0;i<D.people.length;i++)if(D.people[i].id===id)return D.people[i];return null}
function portal(id){for(var i=0;i<D.portals.length;i++)if(D.portals[i].id===id)return D.portals[i];return null}

/* ── overview ── */
function renderOverview(){
  var s=D.summary,h='';
  h+='<h2>This week</h2><div class="stats">';
  h+=stat('People using the app',s.seen7,'visited in the last 7 days · '+s.seenToday+' today');
  h+=stat('People recording things',s.doers7,'made at least one entry in 7 days');
  h+=stat('Actions this week',s.actions7,trend(s.actions7,s.actionsPrev7));
  h+=stat('Portals with activity',s.portalsActive7+' of '+s.portals,'something recorded in 7 days');
  h+='</div>';
  h+='<h2>Growth and plans</h2><div class="stats">';
  h+=stat('People',s.people,s.joined7+' joined this week · '+s.joined30+' in 30 days');
  h+=stat('Used it in 30 days',s.seen30,s.doers30+' recorded something');
  h+=stat('Paying portals',s.paying,s.trial+' in free month'+(s.pastDue?' · <span class="down">'+s.pastDue+' payment problem'+(s.pastDue>1?'s':'')+'</span>':''));
  h+=stat('Plans',s.tiers.beta+' beta',s.tiers.founder+' founder · '+s.tiers.standard+' standard');
  h+='</div>';
  h+='<h2>Last 30 days</h2><div class="card chart" id="chart"></div>';
  h+='<h2>Worth a look</h2><div class="card">';
  if(!D.attention.length)h+='<div class="empty">Nothing needs attention right now.</div>';
  else{h+='<ul class="att">';D.attention.forEach(function(a){var k={never:['Never started','p-bad'],quiet:['Gone quiet','p-grey'],drop:['Dropping off','p-warn'],trial:['Free month ending','p-teal'],billing:['Payment','p-bad']}[a.kind]||[a.kind,'p-grey'];h+='<li data-person="'+(a.personId||'')+'" data-portal="'+(a.portalId||'')+'"><span class="pill '+k[1]+'">'+k[0]+'</span><span>'+esc(a.text)+'</span></li>'});h+='</ul>'}
  h+='</div>';
  var top=D.people.filter(function(p){return p.counted&&p.actions30>0}).sort(function(a,b){return b.actions30-a.actions30}).slice(0,8);
  h+='<h2>Most active (30 days)</h2><div class="card tw"><table><thead><tr><th>Person</th><th>Role</th><th class="num">Actions</th><th class="hide-sm">Mostly using</th><th>Last visit</th></tr></thead><tbody>';
  if(!top.length)h+='<tr><td colspan="5" class="empty">No activity yet.</td></tr>';
  top.forEach(function(p){h+='<tr class="row" data-person="'+p.id+'"><td><b>'+esc(p.name)+'</b></td><td>'+esc(p.roleLabel)+'</td><td class="num">'+p.actions30+'</td><td class="hide-sm sub">'+esc(topFeatures(p.byFeature))+'</td><td>'+ago(p.lastSeenAt)+'</td></tr>'});
  h+='</tbody></table></div>';
  h+='<div class="note">Numbers leave out the demo, test accounts, and the team accounts (David and Becky admin). You can change who counts on any person’s page. "Actions" are things people record in the app: Care Log entries, corrections, messages, medications, vitals, schedule check-offs, photos, documents, health history and more.</div>';
  $('v-overview').innerHTML=h;
  drawChart();
}
function stat(k,v,s){return '<div class="stat"><div class="k">'+k+'</div><div class="v">'+v+'</div><div class="s">'+(s||'')+'</div></div>'}
function topFeatures(bf){var a=Object.keys(bf||{}).map(function(k){return[k,bf[k]]}).sort(function(x,y){return y[1]-x[1]}).slice(0,3);return a.map(function(x){return x[0]}).join(', ')}
function drawChart(){
  var el=$('chart');if(!el)return;
  var days=D.days,maxA=1,maxP=1;days.forEach(function(d){if(d.actions>maxA)maxA=d.actions;if(d.people>maxP)maxP=d.people});
  var h='<div class="legend"><span><i style="background:#01696F"></i>Actions</span><span><i style="background:#d97706;border-radius:50%"></i>People active</span><span style="margin-left:auto">Busiest day: '+maxA+' actions</span></div><div class="bars">';
  days.forEach(function(d,i){
    var ah=Math.round(d.actions/maxA*100),ph=Math.round(d.people/maxP*92);
    var lbl=new Date(d.day+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'});
    h+='<div class="bar" data-tip="'+esc(lbl+': '+d.actions+' actions, '+d.people+' people')+'"><div class="a" style="height:'+ah+'%"></div>'+(d.people?'<div class="pp" style="bottom:calc('+ph+'% - 3px)"></div>':'')+'</div>';
  });
  h+='</div><div class="xl">';
  days.forEach(function(d,i){var dt=new Date(d.day+'T12:00:00Z');h+='<span>'+(i%5===0||i===days.length-1?dt.toLocaleDateString('en-US',{timeZone:'UTC',month:'numeric',day:'numeric'}):'')+'</span>'});
  h+='</div>';
  if(D.trackingStartedAt&&Date.now()-new Date(D.trackingStartedAt).getTime()<30*DAY)h+='<div class="note">Daily visits are recorded starting '+fmtDate(D.trackingStartedAt)+'. Before that, "people active" only counts people who recorded something.</div>';
  el.innerHTML=h;
}

/* ── people ── */
function fillFilters(){
  var st={},ro={};D.people.forEach(function(p){st[p.status]=1;ro[p.roleLabel]=1});
  var s=$('p-status'),cur=s.value;s.innerHTML='<option value="">All statuses</option>'+Object.keys(st).sort().map(function(k){return '<option'+(k===cur?' selected':'')+'>'+esc(k)+'</option>'}).join('');
  var r=$('p-role'),c2=r.value;r.innerHTML='<option value="">All roles</option>'+Object.keys(ro).sort().map(function(k){return '<option'+(k===c2?' selected':'')+'>'+esc(k)+'</option>'}).join('');
}
var PCOLS=[['name','Person'],['roleLabel','Role','hide-sm'],['portal','Portal','hide-sm'],['status','Status'],['lastSeenAt','Last visit'],['lastActionAt','Last action','hide-sm'],['actions7','7 days','num hide-sm'],['actions30','30 days','num'],['actionsTotal','All time','num hide-sm'],['joinedAt','Joined','hide-sm']];
function renderPeople(){
  if(!D)return;
  var q=$('p-q').value.toLowerCase(),fs=$('p-status').value,fr=$('p-role').value,all=$('p-all').checked;
  var rows=D.people.filter(function(p){
    if(!all&&!p.counted)return false;
    if(fs&&p.status!==fs)return false;
    if(fr&&p.roleLabel!==fr)return false;
    if(q&&(p.name+' '+p.email).toLowerCase().indexOf(q)<0)return false;
    return true;
  });
  rows.sort(function(a,b){var k=sortP.k,x=k==='portal'?(a.portals[0]||{}).name:a[k],y=k==='portal'?(b.portals[0]||{}).name:b[k];if(x==null)x='';if(y==null)y='';return (x>y?1:x<y?-1:0)*sortP.d});
  var h='<table><thead><tr>';
  PCOLS.forEach(function(c){h+='<th class="'+(c[2]||'')+'" data-sortp="'+c[0]+'">'+c[1]+(sortP.k===c[0]?(sortP.d>0?' ▲':' ▼'):'')+'</th>'});
  h+='</tr></thead><tbody>';
  if(!rows.length)h+='<tr><td colspan="10" class="empty">No one matches.</td></tr>';
  rows.forEach(function(p){
    h+='<tr class="row'+(p.counted?'':' dim')+'" data-person="'+p.id+'">';
    h+='<td><b>'+esc(p.name)+'</b>'+(p.kind!=='real'?' <span class="pill p-grey">'+p.kind+'</span>':'')+'<div class="sub em">'+esc(p.email)+'</div></td>';
    h+='<td class="hide-sm">'+esc(p.roleLabel)+'</td>';
    h+='<td class="hide-sm">'+(p.portals.length?esc(p.portals[0].name)+(p.portals.length>1?' <span class="sub">+'+(p.portals.length-1)+'</span>':''):'<span class="sub">none</span>')+'</td>';
    h+='<td>'+spill(p.status)+'</td>';
    h+='<td title="'+esc(fmtDT(p.lastSeenAt))+'">'+ago(p.lastSeenAt)+'</td>';
    h+='<td class="hide-sm">'+(p.lastActionAt?ago(p.lastActionAt)+'<div class="sub">'+esc(p.lastActionLabel)+'</div>':'<span class="sub">nothing yet</span>')+'</td>';
    h+='<td class="num hide-sm">'+p.actions7+'</td><td class="num">'+p.actions30+'</td><td class="num hide-sm">'+p.actionsTotal+'</td>';
    h+='<td class="hide-sm">'+fmtDate(p.joinedAt)+'</td></tr>';
  });
  h+='</tbody></table>';
  $('p-tbl').innerHTML=h;
  $('p-note').textContent=rows.length+' '+(rows.length===1?'person':'people')+' shown. Click anyone for details. "Last visit" is updated about once an hour while someone is using the app.';
}
function openPerson(id){
  var p=person(id);if(!p)return;
  var h='<div class="dh"><div><h3>'+esc(p.name)+'</h3><div class="sub">'+esc(p.email)+'</div><div style="margin-top:6px">'+spill(p.status)+' <span class="pill p-grey">'+esc(p.roleLabel)+'</span>'+(p.counted?'':' <span class="pill p-warn">Not counted in numbers</span>')+'</div></div><button class="x" data-close="1">×</button></div><div class="db">';
  h+='<div class="kv">';
  h+='<div>Joined</div><div>'+fmtDate(p.joinedAt)+'</div>';
  h+='<div>Last visit</div><div>'+ago(p.lastSeenAt)+' <span class="sub">('+fmtDT(p.lastSeenAt)+')</span></div>';
  h+='<div>Last action</div><div>'+(p.lastActionAt?esc(p.lastActionLabel)+', '+ago(p.lastActionAt):'nothing recorded yet')+'</div>';
  h+='<div>Days used</div><div>'+p.daysUsed7+' of the last 7 · '+p.daysUsed30+' of the last 30'+(D.trackingStartedAt&&Date.now()-new Date(D.trackingStartedAt).getTime()<30*DAY?' <span class="sub">(counting since '+fmtDate(D.trackingStartedAt)+')</span>':'')+'</div>';
  h+='<div>Actions</div><div>'+p.actions7+' this week · '+p.actionsPrev7+' last week · '+p.actions30+' in 30 days · '+p.actionsTotal+' all time</div>';
  if(p.loginCount!=null)h+='<div>Sign-ins</div><div>'+p.loginCount+'</div>';
  h+='<div>Portals</div><div>'+(p.portals.length?p.portals.map(function(x){return '<a href="#" data-portal="'+x.id+'">'+esc(x.name)+'</a>'}).join(', '):'none')+'</div>';
  h+='</div>';
  var bf=Object.keys(p.byFeature).map(function(k){return[k,p.byFeature[k]]}).sort(function(a,b){return b[1]-a[1]});
  h+='<h4>What they use (all time)</h4>';
  if(!bf.length)h+='<div class="sub">Nothing recorded yet.</div>';
  else{var mx=bf[0][1];h+='<table class="mini">';bf.forEach(function(x){h+='<tr><td style="width:40%">'+esc(x[0])+'</td><td><div class="fbar"><i style="width:'+Math.round(x[1]/mx*100)+'%"></i></div></td><td class="num" style="width:50px">'+x[1]+'</td></tr>'});h+='</table>'}
  h+='<h4>Recent actions</h4>';
  if(!p.recent.length)h+='<div class="sub">None yet.</div>';
  else{h+='<table class="mini">';p.recent.forEach(function(r){h+='<tr><td style="width:36%" class="sub">'+fmtDT(r.at)+'</td><td>'+esc(r.label)+(r.portal?' <span class="sub">· '+esc(r.portal)+'</span>':'')+'</td></tr>'});h+='</table><div class="note">Shows what kind of action, never what was written.</div>'}
  h+='<div class="act"><button class="b2 teal" data-count="'+p.id+'" data-val="'+(p.counted?0:1)+'">'+(p.counted?'Leave out of numbers':'Count in numbers')+'</button>';
  if(p.isActive&&p.kind!=='team')h+='<button class="b2 red" data-deact="'+esc(p.email)+'">Deactivate account</button>';
  h+='</div></div>';
  openDrawer(h);
}

/* ── portals ── */
var OCOLS=[['name','Portal'],['owner','Owner','hide-sm'],['tier','Plan'],['status','Billing','hide-sm'],['nextChargeAt','Next charge','hide-sm'],['members','Members','num hide-sm'],['actions7','7 days','num hide-sm'],['actions30','30 days','num'],['lastActionAt','Last activity']];
function renderPortals(){
  if(!D)return;
  var q=$('o-q').value.toLowerCase(),ft=$('o-tier').value,all=$('o-all').checked;
  var rows=D.portals.filter(function(p){
    if(!all&&!p.counted)return false;
    if(ft&&p.tier!==ft)return false;
    if(q){var t=(p.name+' '+p.members.map(function(m){return m.name}).join(' ')).toLowerCase();if(t.indexOf(q)<0)return false}
    return true;
  });
  rows.sort(function(a,b){var k=sortO.k,x=a[k],y=b[k];if(k==='owner'){x=(a.owner||{}).name;y=(b.owner||{}).name}if(k==='members'){x=a.members.length;y=b.members.length}if(x==null)x='';if(y==null)y='';return (x>y?1:x<y?-1:0)*sortO.d});
  var h='<table><thead><tr>';
  OCOLS.forEach(function(c){h+='<th class="'+(c[2]||'')+'" data-sorto="'+c[0]+'">'+c[1]+(sortO.k===c[0]?(sortO.d>0?' ▲':' ▼'):'')+'</th>'});
  h+='</tr></thead><tbody>';
  if(!rows.length)h+='<tr><td colspan="9" class="empty">No portals match.</td></tr>';
  rows.forEach(function(p){
    h+='<tr class="row'+(p.counted?'':' dim')+'" data-portal="'+p.id+'"><td><b>'+esc(p.name)+'</b><div class="sub em">#'+p.id+'</div></td>';
    h+='<td class="hide-sm">'+(p.owner?esc(p.owner.name):'<span class="sub">—</span>')+'</td>';
    h+='<td>'+tpill(p.tier)+'</td><td class="hide-sm">'+bpill(p)+'</td>';
    h+='<td class="hide-sm">'+(p.tier==='beta'?'<span class="sub">never</span>':fmtDate(p.nextChargeAt))+'</td>';
    h+='<td class="num hide-sm">'+p.members.length+'</td><td class="num hide-sm">'+p.actions7+'</td><td class="num">'+p.actions30+'</td>';
    h+='<td>'+(p.lastActionAt?ago(p.lastActionAt)+'<div class="sub">'+esc(p.lastActionLabel)+'</div>':'<span class="sub">nothing yet</span>')+'</td></tr>';
  });
  h+='</tbody></table>';
  $('o-tbl').innerHTML=h;
}
function openPortal(id){
  var p=portal(id);if(!p)return;
  var h='<div class="dh"><div><h3>'+esc(p.name)+'</h3><div class="sub">Portal #'+p.id+'</div><div style="margin-top:6px">'+tpill(p.tier)+' '+bpill(p)+'</div></div><button class="x" data-close="1">×</button></div><div class="db"><div class="kv">';
  h+='<div>Owner</div><div>'+(p.owner?'<a href="#" data-person="'+p.owner.id+'">'+esc(p.owner.name)+'</a>':'—')+'</div>';
  h+='<div>Started</div><div>'+fmtDate(p.trialStartedAt)+'</div>';
  h+='<div>Next charge</div><div>'+(p.tier==='beta'?'Never (free for life)':fmtDate(p.nextChargeAt))+'</div>';
  h+='<div>Card on file</div><div>'+(p.cardOnFile?'Yes':'No')+'</div>';
  if(p.graceEndsAt)h+='<div>Grace ends</div><div>'+fmtDate(p.graceEndsAt)+'</div>';
  h+='<div>Activity</div><div>'+p.actions7+' this week · '+p.actions30+' in 30 days · '+p.actionsTotal+' all time</div>';
  h+='<div>Last activity</div><div>'+(p.lastActionAt?esc(p.lastActionLabel)+', '+ago(p.lastActionAt):'nothing yet')+'</div>';
  h+='</div><h4>Members</h4><table class="mini">';
  if(!p.members.length)h+='<tr><td class="sub">No members found.</td></tr>';
  p.members.forEach(function(m){h+='<tr><td><a href="#" data-person="'+m.id+'">'+esc(m.name)+'</a></td><td class="sub">'+esc(m.roleLabel)+'</td><td class="sub">visited '+ago(m.lastSeenAt)+'</td></tr>'});
  h+='</table>';
  var bf=Object.keys(p.byFeature).map(function(k){return[k,p.byFeature[k]]}).sort(function(a,b){return b[1]-a[1]});
  h+='<h4>What this portal uses (all time)</h4>';
  if(!bf.length)h+='<div class="sub">Nothing recorded yet.</div>';
  else{var mx=bf[0][1];h+='<table class="mini">';bf.forEach(function(x){h+='<tr><td style="width:40%">'+esc(x[0])+'</td><td><div class="fbar"><i style="width:'+Math.round(x[1]/mx*100)+'%"></i></div></td><td class="num" style="width:50px">'+x[1]+'</td></tr>'});h+='</table>'}
  h+='</div>';
  openDrawer(h);
}

/* ── features ── */
function renderFeatures(){
  var f=D.features,mx=1;f.forEach(function(x){if(x.actions30>mx)mx=x.actions30});
  var h='<div class="note">Which parts of the app people actually use. Counts only include people and portals that count in the numbers.</div><div class="card tw"><table><thead><tr><th>Feature</th><th style="width:30%">Last 30 days</th><th class="num">Actions (30d)</th><th class="num">People (30d)</th><th class="num">Portals (30d)</th><th class="num">All time</th><th>Last used</th></tr></thead><tbody>';
  f.forEach(function(x){h+='<tr'+(x.actionsAll?'':' class="dim"')+'><td><b>'+esc(x.feature)+'</b></td><td><div class="fbar"><i style="width:'+Math.round(x.actions30/mx*100)+'%"></i></div></td><td class="num">'+x.actions30+'</td><td class="num">'+x.people30+'</td><td class="num">'+x.portals30+'</td><td class="num">'+x.actionsAll+'</td><td>'+(x.lastAt?ago(x.lastAt):'<span class="sub">never</span>')+'</td></tr>'});
  h+='</tbody></table></div><div class="note">Medications counts both doses logged and medications added. "Summaries" counts Generate Summary uses; the app does not record who pressed the button, so it shows under the portal only. Visit Reports aren’t saved by the app, so they can’t be counted yet.</div>';
  $('v-features').innerHTML=h;
}

/* ── drawer ── */
function openDrawer(h){$('drawer').innerHTML=h;$('drawer').classList.add('on');$('shade').classList.add('on');$('drawer').scrollTop=0}
function closeDrawer(){$('drawer').classList.remove('on');$('shade').classList.remove('on')}

/* ── library ── */
function loadLibrary(){api('GET','/api/becky-library').then(function(d){libData=d;renderLibrary()}).catch(function(){$('lib-list').innerHTML='<div class="empty">Could not load the library.</div>'})}
function renderLibrary(){
  var f=$('lib-filter').value,data=f?libData.filter(function(r){return r.theme===f}):libData,th=[];
  libData.forEach(function(r){if(th.indexOf(r.theme)<0)th.push(r.theme)});th.sort();
  $('lib-filter').innerHTML='<option value="">All themes</option>'+th.map(function(t){return '<option'+(t===f?' selected':'')+'>'+esc(t)+'</option>'}).join('');
  if(!data.length){$('lib-list').innerHTML='<div class="empty">No responses yet.</div>';return}
  $('lib-list').innerHTML=data.map(function(r){return '<div class="lib-card"><div class="lib-hdr"><span class="pill p-teal">'+esc(r.theme)+'</span>'+(r.isPlaceholder?'<span class="pill p-warn">Needs editing</span>':'')+(r.isActive?'':'<span class="pill p-grey">Inactive</span>')+'<span style="margin-left:auto"></span><button class="b2" data-libedit="'+r.id+'">Edit</button><button class="b2 red" data-libdel="'+r.id+'">Delete</button></div><div class="lib-body"><div><div class="lib-lbl">Example message</div><div class="lib-txt">'+esc(r.examplePrompt)+'</div></div><div><div class="lib-lbl">Response</div><div class="lib-txt">'+esc(r.response)+'</div></div></div></div>'}).join('');
}
function openLib(e){$('lib-modal-title').textContent=e?'Edit response':'New response';$('lm-id').value=e?e.id:'';$('lm-theme').value=e?e.theme:'';$('lm-prompt').value=e?e.examplePrompt:'';$('lm-response').value=e?e.response:'';$('lm-active').value=e?(e.isActive?'1':'0'):'1';$('lib-modal').classList.add('on')}
function saveLib(){
  var id=$('lm-id').value,b={theme:$('lm-theme').value.trim(),examplePrompt:$('lm-prompt').value.trim(),response:$('lm-response').value.trim(),isActive:$('lm-active').value==='1'?1:0,isPlaceholder:0};
  if(!b.theme||!b.examplePrompt||!b.response){toast('Fill in all fields');return}
  (id?api('PATCH','/api/becky-library/'+id,b):api('POST','/api/becky-library',b)).then(function(){toast(id?'Saved':'Added');$('lib-modal').classList.remove('on');loadLibrary()}).catch(function(e){toast(e.message)});
}

/* ── events ── */
document.addEventListener('click',function(e){
  var t=e.target,el;
  if((el=t.closest('.tab'))){document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('on')});el.classList.add('on');document.querySelectorAll('.view').forEach(function(x){x.classList.remove('on')});$('v-'+el.dataset.v).classList.add('on');return}
  if((el=t.closest('[data-sortp]'))){var k=el.dataset.sortp;sortP={k:k,d:sortP.k===k?-sortP.d:(/name|role|portal|status/.test(k)?1:-1)};renderPeople();return}
  if((el=t.closest('[data-sorto]'))){var k2=el.dataset.sorto;sortO={k:k2,d:sortO.k===k2?-sortO.d:(/name|owner|tier|status/.test(k2)?1:-1)};renderPortals();return}
  if((el=t.closest('[data-close]'))||t.id==='shade'){closeDrawer();return}
  if((el=t.closest('[data-count]'))){api('POST','/api/admin/office/counted',{userId:Number(el.dataset.count),counted:el.dataset.val==='1'}).then(function(){toast('Updated');var id=Number(el.dataset.count);api('GET','/api/admin/office/data').then(function(d){D=d;renderAll();openPerson(id)})}).catch(function(x){toast(x.message)});return}
  if((el=t.closest('[data-deact]'))){if(!confirm('Turn off the account for '+el.dataset.deact+'? They will not be able to sign in.'))return;api('POST','/api/admin/users/deactivate',{email:el.dataset.deact}).then(function(){toast('Account turned off');closeDrawer();load()}).catch(function(x){toast(x.message)});return}
  if((el=t.closest('[data-person]'))&&el.dataset.person){e.preventDefault();openPerson(Number(el.dataset.person));return}
  if((el=t.closest('[data-portal]'))&&el.dataset.portal){e.preventDefault();openPortal(Number(el.dataset.portal));return}
  if((el=t.closest('[data-libedit]'))){var en=libData.filter(function(r){return String(r.id)===el.dataset.libedit})[0];if(en)openLib(en);return}
  if((el=t.closest('[data-libdel]'))){if(!confirm('Delete this response?'))return;api('DELETE','/api/becky-library/'+el.dataset.libdel).then(function(){toast('Deleted');loadLibrary()}).catch(function(x){toast(x.message)});return}
  if(t.id==='btn-new-lib')openLib(null);
  if(t.id==='lib-cancel'||t.id==='lib-modal')$('lib-modal').classList.remove('on');
  if(t.id==='lib-save')saveLib();
  if(t.id==='btn-login')doLogin();
  if(t.id==='btn-refresh')load();
  if(t.id==='btn-out'){api('POST','/api/auth/logout').catch(function(){});signOutLocal()}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeDrawer()});
document.addEventListener('mousemove',function(e){var b=e.target.closest&&e.target.closest('[data-tip]'),tip=$('tip');if(!b){tip.style.display='none';return}tip.textContent=b.dataset.tip;tip.style.display='block';tip.style.left=Math.min(e.clientX+12,window.innerWidth-220)+'px';tip.style.top=(e.clientY-34)+'px'});
['p-q','p-status','p-role','p-all'].forEach(function(id){$(id).addEventListener(id==='p-q'?'input':'change',renderPeople)});
['o-q','o-tier','o-all'].forEach(function(id){$(id).addEventListener(id==='o-q'?'input':'change',renderPortals)});
$('lib-filter').addEventListener('change',renderLibrary);
$('p-sort').addEventListener('change',function(){var k=this.value;sortP={k:k,d:k==='name'?1:-1};renderPeople()});
$('o-sort').addEventListener('change',function(){var k=this.value;sortO={k:k,d:k==='name'||k==='nextChargeAt'?1:-1};renderPortals()});
$('pw').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin()});
$('em').addEventListener('keydown',function(e){if(e.key==='Enter')$('pw').focus()});

/* ── init ── */
if(tok()){fetch('/api/admin/whoami',{headers:{'Authorization':'Bearer '+tok()}}).then(function(r){return r.json()}).then(function(d){if(d.isAdmin)start();else signOutLocal()}).catch(signOutLocal)}
else showLogin();
})();
</script>
</body>
</html>`;
}
