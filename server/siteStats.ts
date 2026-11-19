/**
 * Marketing-site visitor counting (www.carenetportal.com).
 * The landing page sends small beacons here. One row per visit (session).
 * Stored: random visitor/visit ids, start/last time, landing path, where they came from
 * (referrer host + utm tags only), device type, sections seen, scroll depth, seconds on page,
 * Get Started / Log In clicks. No IP address, no names, no full referrer URLs.
 */
import { sqlite } from "./db";

const DAY = 86400000;
let ready = false;
export function ensureSiteTables() {
  if (ready) return;
  sqlite.exec(`CREATE TABLE IF NOT EXISTS site_visits (
    session_id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    last_at TEXT NOT NULL,
    path TEXT,
    source TEXT,
    ref_host TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    device TEXT,
    is_new INTEGER DEFAULT 1,
    sections TEXT DEFAULT '',
    max_depth INTEGER DEFAULT 0,
    seconds INTEGER DEFAULT 0,
    cta_clicks INTEGER DEFAULT 0,
    login_clicks INTEGER DEFAULT 0
  )`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_site_visits_started ON site_visits(started_at)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS office_meta (key TEXT PRIMARY KEY, value TEXT)`);
  sqlite.prepare(`INSERT OR IGNORE INTO office_meta (key, value) VALUES ('site_tracking_started_at', ?)`).run(new Date().toISOString());
  ready = true;
}

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor|curl|wget|python|playwright|puppeteer/i;
const SECTIONS = ["top", "who", "er", "features", "screens", "pricing", "start", "footer"];
const id = (v: any) => (typeof v === "string" && /^[a-z0-9]{8,40}$/i.test(v) ? v : null);
const clip = (v: any, n: number) => (typeof v === "string" ? v.slice(0, n) : null);

function classify(refHost: string | null, utm: string | null, fbclid: boolean, gclid: boolean): string {
  const u = (utm || "").toLowerCase();
  const h = (refHost || "").toLowerCase();
  if (fbclid || /facebook|^fb\b|^fb\.|messenger/.test(u) || /facebook\.com$|fb\.com$|fb\.me$|com\.facebook|messenger\.com$/.test(h)) return "Facebook";
  if (/instagram/.test(u) || /instagram\.com$/.test(h)) return "Instagram";
  if (gclid || /google|bing|yahoo|duckduckgo|ecosia|brave/.test(h)) return "Search (Google, Bing…)";
  if (u) return u.charAt(0).toUpperCase() + u.slice(1);
  if (/carenetportal\.com$/.test(h)) return "From the app";
  if (h) return "Other website: " + h;
  return "Direct (typed it in or scanned QR)";
}

// simple in-memory rate limit per IP (not stored)
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60000) { hits.set(ip, { n: 1, t: now }); return false; }
  h.n++;
  return h.n > 120;
}

export function recordSiteBeacon(raw: any, ua: string, ip: string) {
  ensureSiteTables();
  if (BOT_RE.test(ua || "") || limited(ip || "?")) return;
  let b: any = raw;
  if (typeof raw === "string") { try { b = JSON.parse(raw); } catch { return; } }
  if (!b || typeof b !== "object") return;
  const s = id(b.s), v = id(b.v);
  if (!s || !v) return;
  const now = new Date().toISOString();
  if (b.t === "v") {
    let refHost: string | null = null;
    try { if (b.r) refHost = new URL(String(b.r)).hostname.replace(/^www\.|^m\.|^l\.|^lm\./, ""); } catch { refHost = clip(b.r, 80); }
    const q = new URLSearchParams(String(b.q || "").slice(0, 600));
    const utmS = clip(q.get("utm_source"), 60), utmM = clip(q.get("utm_medium"), 60), utmC = clip(q.get("utm_campaign"), 80);
    const source = classify(refHost, utmS, q.has("fbclid"), q.has("gclid"));
    const w = Number(b.w) || 0;
    const device = w && w < 700 ? "Phone" : w && w < 1100 ? "Tablet" : "Computer";
    const seenBefore = !!sqlite.prepare(`SELECT 1 FROM site_visits WHERE visitor_id = ? AND session_id != ? LIMIT 1`).get(v, s);
    sqlite.prepare(`INSERT OR IGNORE INTO site_visits (session_id, visitor_id, started_at, last_at, path, source, ref_host, utm_source, utm_medium, utm_campaign, device, is_new)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(s, v, now, now, clip(b.p, 120) || "/", source, refHost, utmS, utmM, utmC, device, seenBefore ? 0 : 1);
    return;
  }
  if (b.t === "u") {
    const row = sqlite.prepare(`SELECT sections, max_depth, seconds, cta_clicks, login_clicks FROM site_visits WHERE session_id = ? AND visitor_id = ?`).get(s, v) as any;
    if (!row) return;
    const secs = new Set(String(row.sections || "").split(",").filter(Boolean));
    if (Array.isArray(b.sec)) for (const x of b.sec) if (SECTIONS.includes(x)) secs.add(x);
    const depth = Math.max(row.max_depth || 0, Math.min(100, Math.round(Number(b.d) || 0)));
    const seconds = Math.max(row.seconds || 0, Math.min(3600, Math.round(Number(b.sec_t) || 0)));
    const cta = Math.min(50, (row.cta_clicks || 0) + (b.c === "cta" ? 1 : 0));
    const login = Math.min(50, (row.login_clicks || 0) + (b.c === "login" ? 1 : 0));
    sqlite.prepare(`UPDATE site_visits SET last_at = ?, sections = ?, max_depth = ?, seconds = ?, cta_clicks = ?, login_clicks = ? WHERE session_id = ?`)
      .run(now, SECTIONS.filter(x => secs.has(x)).join(","), depth, seconds, cta, login, s);
  }
}

function centralDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const DEMO_EMAILS = ["cnpdemo@carenetportal.com", "democg@carenetportal.com"];
const TEAM_USER_IDS = new Set([10, 43]);

export function buildSiteData() {
  ensureSiteTables();
  const now = Date.now();
  const startedAt = (sqlite.prepare(`SELECT value FROM office_meta WHERE key='site_tracking_started_at'`).get() as any)?.value ?? null;
  const visits = sqlite.prepare(`SELECT session_id, visitor_id, started_at, source, device, is_new, sections, max_depth, seconds, cta_clicks, login_clicks
    FROM site_visits WHERE started_at >= ? ORDER BY started_at DESC`).all(new Date(now - 400 * DAY).toISOString()) as any[];

  // Sign-up history (exists since launch): applications via Get Started, and new accounts
  let apps: any[] = [];
  try { apps = sqlite.prepare(`SELECT email, created_at FROM beta_applications`).all() as any[]; } catch {}
  let accts: any[] = [];
  try { accts = sqlite.prepare(`SELECT a.email, a.created_at, a.user_id, u.role FROM auth_accounts a LEFT JOIN users u ON u.id = a.user_id`).all() as any[]; } catch {}
  const isReal = (email: string, uid?: number) => {
    const e = String(email || "").toLowerCase();
    if (DEMO_EMAILS.includes(e)) return false;
    if (uid && TEAM_USER_IDS.has(uid)) return false;
    if (/test/.test(e)) return false;
    return true;
  };
  const OWNER_ROLES = new Set(["primary_family", "self_care"]);

  const byDay = new Map<string, any>();
  const get = (d: string) => { let x = byDay.get(d); if (!x) { x = { day: d, visitors: new Set<string>(), visits: 0, newVisitors: 0, cta: 0, applications: 0, newPortalOwners: 0, newInvited: 0 }; byDay.set(d, x); } return x; };
  for (const v of visits) {
    const d = get(centralDay(new Date(v.started_at)));
    d.visits++; d.visitors.add(v.visitor_id); if (v.is_new) d.newVisitors++; d.cta += v.cta_clicks || 0;
  }
  for (const a of apps) if (a.created_at && isReal(a.email)) get(centralDay(new Date(a.created_at))).applications++;
  for (const a of accts) {
    if (!a.created_at || !isReal(a.email, a.user_id)) continue;
    const d = get(centralDay(new Date(a.created_at)));
    if (OWNER_ROLES.has(a.role)) d.newPortalOwners++; else d.newInvited++;
  }
  // continuous series from the first known day to today
  const keys = Array.from(byDay.keys()).sort();
  const first = keys[0] ?? centralDay(new Date(now));
  const series: any[] = [];
  for (let t = new Date(first + "T12:00:00Z").getTime(); centralDay(new Date(t)) <= centralDay(new Date(now)); t += DAY) {
    const k = centralDay(new Date(t));
    const x = byDay.get(k);
    series.push(x ? { day: k, visitors: x.visitors.size, visits: x.visits, newVisitors: x.newVisitors, cta: x.cta, applications: x.applications, newPortalOwners: x.newPortalOwners, newInvited: x.newInvited }
      : { day: k, visitors: 0, visits: 0, newVisitors: 0, cta: 0, applications: 0, newPortalOwners: 0, newInvited: 0 });
    if (series.length > 800) break;
  }

  return {
    trackingStartedAt: startedAt,
    series,
    visits: visits.map(v => ({
      at: v.started_at, visitor: String(v.visitor_id).slice(0, 6), source: v.source, device: v.device, isNew: !!v.is_new,
      sections: String(v.sections || "").split(",").filter(Boolean), depth: v.max_depth || 0, seconds: v.seconds || 0,
      cta: v.cta_clicks || 0, login: v.login_clicks || 0,
    })),
    sections: [
      { key: "top", label: "Top of page" }, { key: "who", label: "Who it's for" }, { key: "er", label: "The ER moment" },
      { key: "features", label: "Features" }, { key: "screens", label: "Screenshots" }, { key: "pricing", label: "Pricing" },
      { key: "start", label: "Final \"Get Started\"" }, { key: "footer", label: "Bottom of page" },
    ],
  };
}
