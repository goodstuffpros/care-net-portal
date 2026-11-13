/**
 * Office analytics — builds the full data set for the standalone /office page.
 * Read-only except for the office_user_flags table (count-in-stats toggle)
 * and user_visit_days (one row per user per day they used the app).
 *
 * Only action TYPES and timestamps are returned — never the text of entries.
 */
import { sqlite } from "./db";

const DAY = 86400000;
const DEMO_EMAILS = ["cnpdemo@carenetportal.com", "democg@carenetportal.com"];
const TEAM_USER_IDS = new Set([10, 43]); // admin accounts — off by default, can be toggled

let tablesReady = false;
export function ensureOfficeTables() {
  if (tablesReady) return;
  sqlite.exec(`CREATE TABLE IF NOT EXISTS user_visit_days (
    user_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    PRIMARY KEY (user_id, day)
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS office_user_flags (
    user_id INTEGER PRIMARY KEY,
    counted INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS office_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  sqlite.prepare(`INSERT OR IGNORE INTO office_meta (key, value) VALUES ('visit_tracking_started_at', ?)`).run(new Date().toISOString());
  tablesReady = true;
}

/** Central-time calendar day, e.g. "2026-11-12" */
export function centralDay(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const visitSeen = new Map<number, string>();
/** Record that a user used the app today. Cheap: at most one write per user per day per server process. */
export function recordVisit(userId: number) {
  try {
    const day = centralDay();
    if (visitSeen.get(userId) === day) return;
    ensureOfficeTables();
    sqlite.prepare(`INSERT OR IGNORE INTO user_visit_days (user_id, day) VALUES (?, ?)`).run(userId, day);
    visitSeen.set(userId, day);
  } catch { /* never block a request over analytics */ }
}

function cols(table: string): Set<string> {
  try {
    return new Set((sqlite.prepare(`SELECT name FROM pragma_table_info(?)`).all(table) as any[]).map(r => r.name));
  } catch { return new Set(); }
}

type Src = { table: string; user?: string; ts: string; client?: string; label: string; feature: string; sql?: string; need?: string[] };

// Every place the app records something a person did.
const SOURCES: Src[] = [
  { table: "activity_logs", user: "logged_by_user_id", ts: "logged_at", client: "client_id", label: "Care Log entry", feature: "Care Log" },
  { table: "activity_log_addendums", user: "author_user_id", ts: "created_at", label: "Correction to a Care Log entry", feature: "Care Log",
    sql: `SELECT a.author_user_id AS uid, a.created_at AS ts, l.client_id AS cid FROM activity_log_addendums a LEFT JOIN activity_logs l ON l.id = a.activity_log_id`, need: ["activity_log_id"] },
  { table: "messages", user: "sender_id", ts: "sent_at", label: "Message", feature: "Messages",
    sql: `SELECT m.sender_id AS uid, m.sent_at AS ts, t.client_id AS cid FROM messages m LEFT JOIN chat_threads t ON t.id = m.thread_id`, need: ["thread_id"] },
  { table: "vitals", user: "recorded_by_user_id", ts: "recorded_at", client: "client_id", label: "Vitals recorded", feature: "Vitals" },
  { table: "medication_logs", user: "caregiver_id", ts: "logged_at", client: "client_id", label: "Medication logged", feature: "Medications" },
  { table: "schedule_events", user: "completed_by_user_id", ts: "completed_at", client: "client_id", label: "Schedule item checked off", feature: "Schedule" },
  { table: "media_items", user: "uploaded_by_user_id", ts: "uploaded_at", client: "client_id", label: "Photo or video added", feature: "Media" },
  { table: "documents", user: "uploaded_by_user_id", ts: "uploaded_at", client: "client_id", label: "Document uploaded", feature: "Documents" },
  { table: "health_history_entries", user: "added_by_user_id", ts: "created_at", client: "client_id", label: "Health history added", feature: "Health History" },
  { table: "thought_entries", user: "recorded_by_user_id", ts: "recorded_at", client: "client_id", label: "Thought entry", feature: "Thoughts" },
  { table: "wellbeing_check_ins", user: "user_id", ts: "created_at", client: "client_id", label: "Wellbeing check-in", feature: "Wellbeing" },
  { table: "misc_notes", user: "author_id", ts: "created_at", client: "client_id", label: "Note", feature: "Notes" },
  { table: "shifts", user: "caregiver_id", ts: "clocked_in_at", client: "client_id", label: "Clocked in", feature: "Shifts" },
  { table: "outings", user: "caregiver_id", ts: "started_at", client: "client_id", label: "Outing", feature: "Outings" },
  { table: "connection_invites", user: "sender_user_id", ts: "created_at", client: "client_id", label: "Sent an invite", feature: "Invites" },
  { table: "emergency_alerts", user: "triggered_by_user_id", ts: "created_at", client: "client_id", label: "Emergency alert", feature: "Emergency" },
  { table: "user_feedback", user: "user_id", ts: "created_at", label: "Sent feedback", feature: "Feedback" },
  // Portal-level actions (the app doesn't record who did them)
  { table: "medications", ts: "created_at", client: "client_id", label: "Medication added", feature: "Medications" },
  { table: "archive_summaries", ts: "generated_at", client: "client_id", label: "Summary generated", feature: "Summaries" },
];

type Ev = { uid: number | null; t: number; cid: number | null; label: string; feature: string };

function loadEvents(now: number): Ev[] {
  const out: Ev[] = [];
  for (const s of SOURCES) {
    const c = cols(s.table);
    if (!c.size || !c.has(s.ts) || (s.user && !c.has(s.user)) || (s.need && s.need.some(n => !c.has(n)))) continue;
    let sql = s.sql;
    if (!sql) {
      sql = `SELECT ${s.user ? s.user : "NULL"} AS uid, ${s.ts} AS ts, ${s.client && c.has(s.client) ? s.client : "NULL"} AS cid FROM ${s.table}`;
    }
    sql = `SELECT * FROM (${sql}) WHERE ts IS NOT NULL AND ts != ''`;
    let rows: any[] = [];
    try { rows = sqlite.prepare(sql).all() as any[]; } catch { continue; }
    for (const r of rows) {
      const t = new Date(r.ts).getTime();
      if (!isFinite(t) || t > now + 5 * 60000) continue; // ignore bad or future-dated timestamps
      out.push({ uid: r.uid ?? null, t, cid: r.cid ?? null, label: s.label, feature: s.feature });
    }
  }
  return out;
}

/** Most recent real action timestamp per user (ISO), for the in-app Engagement tab. */
export function lastActionByUser(): Map<number, string> {
  const m = new Map<number, number>();
  for (const e of loadEvents(Date.now())) {
    if (e.uid == null) continue;
    if ((m.get(e.uid) ?? 0) < e.t) m.set(e.uid, e.t);
  }
  return new Map(Array.from(m).map(([k, v]) => [k, new Date(v).toISOString()]));
}

export function setCounted(userId: number, counted: boolean) {
  ensureOfficeTables();
  sqlite.prepare(`INSERT INTO office_user_flags (user_id, counted, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET counted = excluded.counted, updated_at = excluded.updated_at`)
    .run(userId, counted ? 1 : 0, new Date().toISOString());
}

const ROLE_LABEL: Record<string, string> = {
  primary_family: "Main Contact", secondary_family: "Family", caregiver: "Caregiver", temp_caregiver: "Temp Caregiver",
  multi_caregiver: "Caregiver", self_care: "Self Care", facilitator: "Facilitator",
};

export function buildOfficeData() {
  ensureOfficeTables();
  const now = Date.now();
  const today = centralDay();
  const allUsers = sqlite.prepare(`SELECT id, name, email, role, client_id, is_active FROM users`).all() as any[];
  const accounts = sqlite.prepare(`SELECT user_id, created_at, last_login_at, ${cols("auth_accounts").has("login_count") ? "login_count" : "NULL AS login_count"} FROM auth_accounts WHERE user_id IS NOT NULL`).all() as any[];
  const acctBy = new Map<number, any>(accounts.map(a => [a.user_id, a]));
  const clientCols = cols("clients");
  const pick = (c: string) => (clientCols.has(c) ? c : `NULL AS ${c}`);
  const clients = sqlite.prepare(`SELECT id, name, primary_contact_id, ${pick("is_practice")}, ${pick("is_showcase")}, ${pick("founder_tier")}, ${pick("subscription_status")},
    ${pick("trial_started_at")}, ${pick("subscription_started_at")}, ${pick("subscription_renews_at")}, ${pick("grace_period_ends_at")},
    ${pick("square_customer_id")}, ${pick("square_card_id")}, ${pick("is_active")} FROM clients`).all() as any[];
  const rels = cols("user_client_relationships").size
    ? (sqlite.prepare(`SELECT user_id, client_id, role FROM user_client_relationships`).all() as any[]) : [];
  const flags = new Map<number, boolean>((sqlite.prepare(`SELECT user_id, counted FROM office_user_flags`).all() as any[]).map(f => [f.user_id, !!f.counted]));
  const visits = sqlite.prepare(`SELECT user_id, day FROM user_visit_days WHERE day >= ?`).all(centralDay(new Date(now - 60 * DAY))) as any[];
  const trackingStartedAt = (sqlite.prepare(`SELECT value FROM office_meta WHERE key='visit_tracking_started_at'`).get() as any)?.value ?? null;

  // Demo detection
  const demoUserIds = new Set(allUsers.filter(u => DEMO_EMAILS.includes(String(u.email || "").toLowerCase())).map(u => u.id));
  const demoClientIds = new Set<number>();
  for (const u of allUsers) if (demoUserIds.has(u.id) && u.client_id) demoClientIds.add(u.client_id);
  for (const r of rels) if (demoUserIds.has(r.user_id)) demoClientIds.add(r.client_id);

  const looksTest = (u: any) => /test/i.test(String(u.email || "")) || /^test\b/i.test(String(u.name || ""));

  // Portal membership
  const memberships = new Map<number, Set<number>>(); // userId -> clientIds
  const addM = (uid: number, cid: number | null) => { if (!cid) return; if (!memberships.has(uid)) memberships.set(uid, new Set()); memberships.get(uid)!.add(cid); };
  for (const u of allUsers) addM(u.id, u.client_id);
  for (const r of rels) addM(r.user_id, r.client_id);
  const clientById = new Map<number, any>(clients.map(c => [c.id, c]));

  const events = loadEvents(now);

  // Per-user aggregates
  type Agg = { total: number; d7: number; prev7: number; d30: number; last: Ev | null; byFeature: Record<string, number>; recent: Ev[] };
  const agg = new Map<number, Agg>();
  const getAgg = (uid: number) => { let a = agg.get(uid); if (!a) { a = { total: 0, d7: 0, prev7: 0, d30: 0, last: null, byFeature: {}, recent: [] }; agg.set(uid, a); } return a; };
  const sorted = events.slice().sort((a, b) => b.t - a.t);
  for (const e of sorted) {
    if (e.uid == null) continue;
    const a = getAgg(e.uid);
    a.total++;
    const age = now - e.t;
    if (age <= 7 * DAY) a.d7++; else if (age <= 14 * DAY) a.prev7++;
    if (age <= 30 * DAY) a.d30++;
    if (!a.last) a.last = e;
    a.byFeature[e.feature] = (a.byFeature[e.feature] ?? 0) + 1;
    if (a.recent.length < 30) a.recent.push(e);
  }
  const visitDays = new Map<number, string[]>();
  for (const v of visits) { if (!visitDays.has(v.user_id)) visitDays.set(v.user_id, []); visitDays.get(v.user_id)!.push(v.day); }
  const day30 = centralDay(new Date(now - 29 * DAY));
  const day7 = centralDay(new Date(now - 6 * DAY));

  const people = allUsers.filter(u => !demoUserIds.has(u.id)).map(u => {
    const acct = acctBy.get(u.id);
    const a = agg.get(u.id);
    const lastSeen = acct?.last_login_at ?? null;
    const daysSinceSeen = lastSeen ? Math.floor((now - new Date(lastSeen).getTime()) / DAY) : null;
    const joined = acct?.created_at ?? null;
    const daysSinceJoined = joined ? Math.floor((now - new Date(joined).getTime()) / DAY) : null;
    const defaultCounted = !TEAM_USER_IDS.has(u.id) && !looksTest(u);
    const counted = flags.has(u.id) ? flags.get(u.id)! : defaultCounted;
    const vd = visitDays.get(u.id) ?? [];
    let status: string;
    if (u.is_active === 0) status = "Deactivated";
    else if (!acct) status = "No login";
    else if ((a?.total ?? 0) === 0 && (daysSinceJoined ?? 0) >= 3) status = "Never started";
    else if (daysSinceSeen != null && daysSinceSeen <= 7 && (a?.d7 ?? 0) > 0) status = "Active";
    else if (daysSinceSeen != null && daysSinceSeen <= 7) status = "Looking only";
    else if (daysSinceSeen != null && daysSinceSeen <= 30) status = "Slowing down";
    else if ((daysSinceJoined ?? 0) < 3) status = "New";
    else status = "Gone quiet";
    const portalIds = Array.from(memberships.get(u.id) ?? new Set<number>()).filter(cid => !demoClientIds.has(cid));
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      roleLabel: ROLE_LABEL[u.role] ?? u.role,
      isActive: u.is_active !== 0,
      counted,
      defaultCounted,
      kind: TEAM_USER_IDS.has(u.id) ? "team" : looksTest(u) ? "test" : "real",
      portals: portalIds.map(cid => ({ id: cid, name: clientById.get(cid)?.name ?? `Portal ${cid}` })),
      joinedAt: joined,
      lastSeenAt: lastSeen,
      loginCount: acct?.login_count ?? null,
      lastActionAt: a?.last ? new Date(a.last.t).toISOString() : null,
      lastActionLabel: a?.last?.label ?? null,
      actions7: a?.d7 ?? 0,
      actionsPrev7: a?.prev7 ?? 0,
      actions30: a?.d30 ?? 0,
      actionsTotal: a?.total ?? 0,
      daysUsed7: vd.filter(d => d >= day7).length,
      daysUsed30: vd.filter(d => d >= day30).length,
      byFeature: a?.byFeature ?? {},
      recent: (a?.recent ?? []).map(e => ({ at: new Date(e.t).toISOString(), label: e.label, portal: e.cid ? (clientById.get(e.cid)?.name ?? `Portal ${e.cid}`) : null })),
      status,
    };
  });
  const countedIds = new Set(people.filter(p => p.counted).map(p => p.id));

  // Portals
  const portals = clients.filter(c => !demoClientIds.has(c.id) && !c.is_practice).map(c => {
    const memberIds = people.filter(p => p.portals.some(x => x.id === c.id)).map(p => p.id);
    const members = people.filter(p => memberIds.includes(p.id)).map(p => ({ id: p.id, name: p.name, roleLabel: p.roleLabel, counted: p.counted, lastSeenAt: p.lastSeenAt }));
    const evs = sorted.filter(e => e.cid === c.id);
    const byFeature: Record<string, number> = {};
    let d7 = 0, d30 = 0;
    for (const e of evs) { byFeature[e.feature] = (byFeature[e.feature] ?? 0) + 1; if (now - e.t <= 7 * DAY) d7++; if (now - e.t <= 30 * DAY) d30++; }
    const tier = c.founder_tier ?? "standard";
    const status = c.subscription_status ?? "trial";
    const trialStart = c.trial_started_at ? new Date(c.trial_started_at).getTime() : null;
    const chargeDate = tier === "beta" ? null : (c.subscription_renews_at ?? (trialStart ? new Date(trialStart + 30 * DAY).toISOString() : null));
    const owner = people.find(p => p.id === c.primary_contact_id) ?? null;
    const counted = members.some(m => m.counted);
    return {
      id: c.id,
      name: c.name,
      owner: owner ? { id: owner.id, name: owner.name } : null,
      tier, status,
      trialStartedAt: c.trial_started_at ?? null,
      nextChargeAt: status === "trial" || status === "active" ? chargeDate : null,
      graceEndsAt: c.grace_period_ends_at ?? null,
      cardOnFile: !!(c.square_customer_id && c.square_card_id),
      members,
      actions7: d7, actions30: d30, actionsTotal: evs.length,
      lastActionAt: evs[0] ? new Date(evs[0].t).toISOString() : null,
      lastActionLabel: evs[0]?.label ?? null,
      byFeature,
      counted,
      isShowcase: !!c.is_showcase,
    };
  });
  const countedPortalIds = new Set(portals.filter(p => p.counted).map(p => p.id));

  // Counted events only (person counted, or portal-level action in a counted portal)
  const cEvents = events.filter(e => (e.uid != null ? countedIds.has(e.uid) : e.cid != null && countedPortalIds.has(e.cid)));

  // Daily series — last 30 Central days
  const days: { day: string; actions: number; people: number }[] = [];
  const dayIndex = new Map<string, number>();
  for (let i = 29; i >= 0; i--) { const d = centralDay(new Date(now - i * DAY)); dayIndex.set(d, days.length); days.push({ day: d, actions: 0, people: 0 }); }
  const actorsByDay = new Map<string, Set<number>>();
  for (const e of cEvents) {
    const d = centralDay(new Date(e.t));
    const i = dayIndex.get(d);
    if (i == null) continue;
    days[i].actions++;
    if (e.uid != null) { if (!actorsByDay.has(d)) actorsByDay.set(d, new Set()); actorsByDay.get(d)!.add(e.uid); }
  }
  for (const v of visits) {
    if (!countedIds.has(v.user_id)) continue;
    if (!actorsByDay.has(v.day)) actorsByDay.set(v.day, new Set());
    actorsByDay.get(v.day)!.add(v.user_id);
  }
  for (const d of days) d.people = actorsByDay.get(d.day)?.size ?? 0;

  // Feature use — last 30 days
  const fmap = new Map<string, { feature: string; actions30: number; people: Set<number>; portals: Set<number>; actionsAll: number; lastAt: number }>();
  for (const e of cEvents) {
    let f = fmap.get(e.feature);
    if (!f) { f = { feature: e.feature, actions30: 0, people: new Set(), portals: new Set(), actionsAll: 0, lastAt: 0 }; fmap.set(e.feature, f); }
    f.actionsAll++;
    if (e.t > f.lastAt) f.lastAt = e.t;
    if (now - e.t <= 30 * DAY) { f.actions30++; if (e.uid != null) f.people.add(e.uid); if (e.cid != null) f.portals.add(e.cid); }
  }
  const allFeatures = Array.from(new Set(SOURCES.map(s => s.feature)));
  const features = allFeatures.map(name => {
    const f = fmap.get(name);
    return { feature: name, actions30: f?.actions30 ?? 0, people30: f?.people.size ?? 0, portals30: f?.portals.size ?? 0, actionsAll: f?.actionsAll ?? 0, lastAt: f?.lastAt ? new Date(f.lastAt).toISOString() : null };
  }).sort((a, b) => b.actions30 - a.actions30 || b.actionsAll - a.actionsAll);

  // Headline numbers (counted people only)
  const cp = people.filter(p => p.counted);
  const cpo = portals.filter(p => p.counted);
  const seenWithin = (p: any, d: number) => p.lastSeenAt && now - new Date(p.lastSeenAt).getTime() <= d * DAY;
  const joinedWithin = (p: any, d: number) => p.joinedAt && now - new Date(p.joinedAt).getTime() <= d * DAY;
  const actionsInRange = (from: number, to: number) => cEvents.filter(e => now - e.t > from * DAY && now - e.t <= to * DAY).length;
  const summary = {
    people: cp.length,
    joined7: cp.filter(p => joinedWithin(p, 7)).length,
    joined30: cp.filter(p => joinedWithin(p, 30)).length,
    seenToday: cp.filter(p => p.lastSeenAt && centralDay(new Date(p.lastSeenAt)) === today).length,
    seen7: cp.filter(p => seenWithin(p, 7)).length,
    seen30: cp.filter(p => seenWithin(p, 30)).length,
    doers7: cp.filter(p => p.actions7 > 0).length,
    doers30: cp.filter(p => p.actions30 > 0).length,
    actions7: actionsInRange(-1, 7),
    actionsPrev7: actionsInRange(7, 14),
    actions30: actionsInRange(-1, 30),
    portals: cpo.length,
    portalsActive7: cpo.filter(p => p.actions7 > 0).length,
    tiers: { beta: cpo.filter(p => p.tier === "beta").length, founder: cpo.filter(p => p.tier === "founder").length, standard: cpo.filter(p => p.tier === "standard").length },
    paying: cpo.filter(p => p.status === "active" && p.tier !== "beta").length,
    trial: cpo.filter(p => p.status === "trial" && p.tier !== "beta").length,
    pastDue: cpo.filter(p => ["past_due", "grace", "read_only"].includes(p.status)).length,
  };

  // Things to look at
  const attention: { kind: string; text: string; personId?: number; portalId?: number }[] = [];
  for (const p of cp) {
    if (!p.isActive) continue;
    if (p.status === "Never started") attention.push({ kind: "never", text: `${p.name} joined ${p.joinedAt ? Math.floor((now - new Date(p.joinedAt).getTime()) / DAY) : "?"} days ago and hasn't recorded anything yet`, personId: p.id });
    else if (p.actionsTotal >= 5 && p.lastSeenAt && now - new Date(p.lastSeenAt).getTime() > 14 * DAY && now - new Date(p.lastSeenAt).getTime() <= 60 * DAY)
      attention.push({ kind: "quiet", text: `${p.name} used to be active (${p.actionsTotal} actions) but hasn't been back in ${Math.floor((now - new Date(p.lastSeenAt).getTime()) / DAY)} days`, personId: p.id });
    else if (p.actionsPrev7 >= 5 && p.actions7 <= Math.floor(p.actionsPrev7 / 3))
      attention.push({ kind: "drop", text: `${p.name} dropped from ${p.actionsPrev7} actions last week to ${p.actions7} this week`, personId: p.id });
  }
  for (const p of cpo) {
    if (p.tier !== "beta" && p.status === "trial" && p.nextChargeAt) {
      const d = Math.ceil((new Date(p.nextChargeAt).getTime() - now) / DAY);
      if (d >= 0 && d <= 7) attention.push({ kind: "trial", text: `${p.name}: free month ends in ${d} day${d === 1 ? "" : "s"} (card on file: ${p.cardOnFile ? "yes" : "no"})`, portalId: p.id });
    }
    if (["past_due", "grace", "read_only"].includes(p.status)) attention.push({ kind: "billing", text: `${p.name}: payment status is ${p.status.replace("_", " ")}`, portalId: p.id });
  }

  return { generatedAt: new Date(now).toISOString(), trackingStartedAt, summary, days, features, people, portals, attention };
}
