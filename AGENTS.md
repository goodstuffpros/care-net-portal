# AGENTS.md — Care Net Portal

This file is the authoritative briefing for any AI agent, developer, or contributor working on this codebase. Read it entirely before touching any code.

---

## What This App Is

**Care Net Portal** is a caregiver-client communication and documentation platform. It connects professional caregivers, family members, and the people they care for in a shared, structured care environment called a **portal**.

The app was co-designed by David Gould (founder) and Becky Gould (10 years of private caregiver experience). Becky brought the care. David brought the net. The platform exists because caregiving is relational, not transactional — and the tools caregivers use should reflect that.

**Beta launched:** May 13, 2026. Five live portals.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Vite) |
| Backend | Express (Node.js) |
| Database | SQLite via `better-sqlite3` (file: `/data/data.db` on Railway persistent volume) |
| Hosting | Railway (`gallant-reverence` project) |
| Email | Resend API (`portal@carenetportal.com`) |
| AI | Google Gemini API (help desk / knowledge base) |
| DNS | Cloudflare |
| Version control | GitHub (`goodstuffpros/care-net-portal`, private) |

**Production URL:** https://care-net-portal-production.up.railway.app

**DB path:** `/data/data.db` — this is a Railway persistent volume. Never reference a local SQLite path in production code.

---

## User Roles

There are four roles. Understand them before touching any auth, routing, or permissions logic.

| Role | Description |
|---|---|
| `caregiver` | Professional caregiver. Assigned to portals by the MC. Reads and writes care data. |
| `primary_family` | Main Contact (MC). The ONLY authority who can invite anyone to a portal. Owns the portal. |
| `secondary_family` | Secondary family member. Arrives via invite ONLY — no cold signup path exists. Read access. |
| `self_care` | Self-managed care user. Always receives `self_care_mc` permissions regardless of signup path. |

**Critical rule — Ability is not authority.** A caregiver CAN see the care team page. A caregiver CANNOT invite, remove, or modify team members. Only the MC has that authority. The CG care team page is read-only.

**Two signup paths only:**
1. Professional Caregiver
2. Main Contact (Family)

Secondary family members arrive via MC invite. Self-care users arrive via MC-to-client invite OR a Self-Managed Care signup path. There is no third cold-signup option.

---

## MC Onboarding Flow

The MC onboarding flow is **linear and cannot be skipped**. The order is fixed:

1. Client Profile
2. Personal Profile
3. Care Team
4. Dashboard

Do not add skip buttons, back shortcuts, or optional steps to this flow without explicit discussion with David.

---

## Real Production Users — DO NOT DELETE OR MODIFY

These are real people using the live app. Never delete, deactivate, or alter these accounts in code or migration scripts.

| ID | Name | Role | Email |
|---|---|---|---|
| 10 | David Gould | secondary_family | gouldenterprises@yahoo.com |
| 11 | Becky Gould | caregiver | blgservantgirl@gmail.com |
| 12 | David Gould | primary_family | davidpromail@yahoo.com |
| 14 | Tabitha Gould | secondary_family | tabithalgould@gmail.com |
| 15 | Whitefield Gould | caregiver | dwg4jesus@yahoo.com |
| 16 | Anna Stewart | caregiver | anna@thestewarts.fun |
| 17 | Lynne Gould | primary_family | blgservantgirl@yahoo.com |
| 18 | Bettey Black | caregiver | dnastewart17@yahoo.com |
| 19 | Erfina | caregiver | stadnykerfina@gmail.com |
| 20 | Bonnie Leair | primary_family | terbonleair4@gmail.com |
| 39 | Hillary Bobbett | caregiver | hillary.bobbett@gmail.com |
| 41 | Demo User | primary_family | cnpdemo@carenetportal.com |
| 42 | Sarah (Demo CG) | caregiver | democg@carenetportal.com |
| 43 | Becky Gould (test) | caregiver | beckylgould01@gmail.com |
| 49 | Donielle Hatt | primary_family | mannclann1@gmail.com |
| 50 | McKenzie Szablewski | self_care | 97georgiapeach@gmail.com |
| 51 | Anna Christine Leair Graybill | self_care | onalee33@gmail.com |
| 57 | Madysen | caregiver | madysenmaree7@gmail.com |
| 58 | Rebecca Peck | primary_family | trkcep@gmail.com |

**Demo accounts:** cnpdemo@carenetportal.com / DemoPassword2026 and democg@carenetportal.com / DemoPassword2026. 30-minute idle timeout. Admin reset by David or Becky only.

---

## The Cardinal Rule — No Demo Names in Production

> **"None of the demo names should ever be in a real live portal. Ever. EVER."**

If you are seeding, migrating, testing, or writing fixtures — use only the demo accounts above. Never populate production data with placeholder names (Jane Doe, John Smith, Test User, etc.).

---

## Design Principles

### Visual Style
- **Calm and clinical with a human touch.** This is a healthcare platform used by caregivers at all hours. The UI should feel like a well-organized nurse's station, not a consumer app.
- **Teal is on.** All toggles are teal when active. Green means go — do not deviate from this.
- **No notification bells — ever.** Normal notifications are surfaced inline. Users scroll through at their own pace. No bell icons.
- **Clarity without clutter. But above all, clarity.**

### UX Principles
- **Least amount of friction.** Every flow should remove steps, not add them.
- **Consistency matters more than novelty.** Users who have never experienced this flow before need predictability.
- **"We want our amazing users to think that we thought of everything."**

---

## Key Feature Areas

- **Care Log** — timestamped caregiver entries. Supports incident tagging.
- **Schedule** — caregiver shift scheduling and clock-in/out.
- **Vitals** — health metric tracking per client.
- **Medications** — medication list and administration tracking.
- **Messages** — in-portal messaging between care team members.
- **Media** — file and photo sharing within the portal.
- **Archive** — historical record access.
- **Care Net University (CNU)** — in-app training and lesson system for caregivers.
- **Help Desk ("?")** — Gemini-powered knowledge base. The button is labeled "?" — not "Help", not "App Help".
- **Transfer of Care** — section for transitioning a client to self-managed care. "I Am Ready" = client-initiated. "You Are Ready" = MC-initiated.
- **BeckyAdmin** — internal admin panel (David + Becky access only). Includes user management, engagement tracking, and feedback review.

---

## Auth & Security

- JWT-based session auth. Secret stored in Railway environment variable `JWT_SECRET`.
- Email sent via Resend. From address: `Care Net Portal <portal@carenetportal.com>`.
- Admin access: David and Becky only. Role enforcement is in middleware — do not bypass it.
- **Sign in is the most critical path in the application.** If a user cannot sign in, nothing else works. Treat any breakage here as a P0.

---

## HIPAA Considerations

This platform handles personal health information (PHI). HIPAA compliance is an active, ongoing effort.

- Do not log PHI to console in production.
- Do not store PHI in unencrypted fields without explicit design review.
- AWS HealthLake (FHIR-compliant, encrypted) is on the roadmap for future health data storage.
- Any new feature that touches health data (vitals, medications, care logs, diagnoses) must be reviewed against HIPAA requirements before shipping.
- HIPAA compliance documentation is maintained in the workspace and should be updated when new data types are introduced.

---

## Accessibility

- Build for users of all ages and technical comfort levels. Caregivers use this app at 11pm in a client's kitchen on their phone.
- Follow WCAG AA minimum contrast ratios.
- All interactive elements must have accessible labels (`aria-label`, `aria-describedby` where needed).
- Forms must have visible, associated labels — not just placeholder text.
- Focus states must be visible on all interactive elements.
- Test on mobile (Android Chrome, iOS Safari) — not just desktop.
- Do not rely solely on color to convey state (pair color with text or icon).

---

## Testing Standards

- Write tests for any new API route before shipping.
- Write tests for any auth or permissions logic — this is non-negotiable.
- Test new features against the demo accounts before touching real users.
- Verify sign-in flow after any auth-adjacent change.
- **"I want whatever we find in a test to be cleared before moving to the next test."**

---

## Git Workflow

- `main` branch is production. Every commit to main deploys to live users.
- Use feature branches for new work: `feature/your-feature-name`.
- Use a `develop` branch as a staging layer before merging to `main`. (In progress — being adopted.)
- Commit messages should be clear and prefixed: `feat:`, `fix:`, `refactor:`, `chore:`.
- Do not force-push to `main`.

### Build & Deploy
```bash
cd care-net-portal
npm run build
cp client/public/cnu-audio/welcome.mp3 dist/public/cnu-audio/
cp client/public/university/new_*.jpg dist/public/university/
git add -A && git commit -m "message" && git push
```
Railway auto-deploys on push to `main`.

---

## Environment Variables (Railway)

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://care-net-portal-production.up.railway.app` |
| `JWT_SECRET` | Auth token signing |
| `DB_PATH` | `/data/data.db` |
| `RESEND_API_KEY` | Email delivery |
| `SMTP_FROM` | `Care Net Portal <portal@carenetportal.com>` |
| `GEMINI_API_KEY` | Help desk AI |

Never hard-code these values. Never commit them to the repo.

---

## Working with David

- **Talk through before building.** David thinks by talking. Do not rush to implement — discuss the approach first.
- **"I do not like doing things twice."** Confirm the plan before executing.
- **"Stop guessing."** Check the docs, the DB, and the logs before forming an opinion.
- **"Stop telling me it will work. I will tell you if it works."** Do not promise outcomes.
- **"If you cannot fix something over a period of time, I need to remove it."** Don't hold a feature hostage to a bug you can't solve.
- David's process: he talks things out repeatedly before presenting them. Like preaching a sermon multiple times before standing in front of a congregation. Do not rush him toward conclusions.

---

## What This App Is Not

- It is not a monitoring or surveillance tool. It does not watch caregivers. It builds a professional record.
- It is not a scheduling-only tool. Schedule is one module among many in a holistic care management system.
- It is not a consumer health app. It is a professional platform for coordinated care.

---

*This file should be updated whenever the architecture, user roles, or core rules change. It is the source of truth for any agent or developer entering this codebase.*
