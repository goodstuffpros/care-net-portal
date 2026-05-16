# Care Net Portal — Test Accounts

All addresses route to **goodstuffpros@gmail.com** via Gmail `+` alias.
Verification emails will appear in that inbox.

**Test password (all accounts):** `TestCNP2026!`

---

## Invite Path Testing

| Role | Email | Purpose |
|---|---|---|
| CG (sends invite to MC) | goodstuffpros+cg1@gmail.com | Start: CG → MC invite path |
| MC (accepts CG's invite) | goodstuffpros+mc1@gmail.com | Receives invite from cg1 |
| MC (sends invite to CG) | goodstuffpros+mc2@gmail.com | Start: MC → CG invite path |
| CG (accepts MC's invite) | goodstuffpros+cg2@gmail.com | Receives invite from mc2 |

## Self-Managed Care Testing

| Role | Email | Purpose |
|---|---|---|
| Self-Managed (Path A) | goodstuffpros+self1@gmail.com | Person-led signup (no MC) |
| MC (Path B — invites self-caregiver) | goodstuffpros+mc3@gmail.com | Sends mc_to_self_cg invite |
| Self-Caregiver (Path B — accepts) | goodstuffpros+self2@gmail.com | Accepts mc_to_self_cg invite |

## Transfer of Care Testing

| Role | Email | Purpose |
|---|---|---|
| MC (initiates transfer) | goodstuffpros+mc4@gmail.com | Sends "You Are Ready" |
| Client (initiates transfer) | goodstuffpros+client1@gmail.com | Sends "I Am Ready" |

---

## After Each Test Run

These accounts accumulate in the production DB. Use the **Admin Beta Cleanup Tool**
or a direct DB delete to remove them between test rounds.

**Never leave test accounts connected to real client records.**

---

## Quick Reference — What to Watch For

### CG → MC path (`cg1` invites `mc1`)
- mc1 signs up, onboards, creates client profile
- Care-team step should show: **"[CG Name] is already connected"**

### MC → CG path (`mc2` invites `cg2`)
- cg2 signs up, completes profile, hits Done
- Done screen should say: **"You're already connected to [Client]'s portal."**

### Self-Managed Path A (`self1`)
- Signs up via Self-Managed Care card on Apply page
- Onboarding: profile → client setup → done
- No MC required

### Self-Managed Path B (`mc3` invites `self2`)
- mc3 sends "Invite as Self-Caregiver" from Caregivers page
- self2 accepts, gets self_care role and self-linked client
