# Troubleshooting Log — Training Groups Rollout

> **How to read this file:** Each issue is explained in plain language first, then (in a *Technical detail* line) the exact cause/fix for the developer. The goal is that a non-engineer can understand what went wrong and what we did about it. When a new bug shows up, check here first — many new issues are side effects of an earlier fix meeting data that was created while that bug was still live.

> **Workflow rule — batch before deploying:** Don't deploy one fix at a time. When several fixes are in flight, test them together in **dev first**, confirm the whole cluster is good, **then** do a single deploy. This cuts down deploy time and adds a layer of protection so we don't push a bug to the live site. Default to: fix → verify in dev → batch → deploy once.

---

## How the data is organized (plain version)

The app now keeps **two kinds of programs**:

- A **per-group program** — each group (e.g. Powerlift 2.0, Strategies & Squats) has its own cycles, schedule, and movement names.
- An **old shared program** — the original one that existed before groups.

A client's **strength numbers (1RMs, training maxes, history, movement profiles) are shared** across every group. Only their **schedule position** (which cycle/week they're in, what they've logged) is kept separately per group.

**Why bugs cascade:** because there are two programs side by side, any screen that quietly reads the *old shared* program when it should read the *group's* program will look up the wrong thing — and can show the wrong movement name or a blank weight even though the real data is fine.

---

## Fixed issues

### 1. Graduating a group didn't advance it (fixed)
- **Plain version:** Moving a group to its next cycle didn't create the new cycle, and the client then couldn't be graduated again. The graduation code was only updating the old shared program, not the group's.
- **Fixed:** graduation now updates the group's own program and cycle. One test client had to be hand-corrected afterward.
- *Technical detail:* `graduateTeam`/`graduateTeamAction` wrote legacy `currentCycleNumber` + legacy program only; now group-aware (`dd123fe`).

### 2. Graduation list showed "Selected: 0 of 0" (fixed)
- **Plain version:** The list of clients ready to move up was empty because it was checking the wrong cycle and the wrong (whole) roster instead of the group's members on the group's current cycle.
- **Fixed:** the list now uses the selected group's members and the group's own current cycle.

### 3. Editing a client's movement settings inside a group got lost on save (fixed)
- **Plain version:** If you opened a client while a group was selected and changed their movement settings, saving silently dropped those changes. (Note: this was about *movement profiles/calibrations*, **not** the 1RM numbers — those were already saving.)
- **Fixed:** those fields are now saved too (`10f35e3`).

### 4. Deleting a group's test cycle didn't work (fixed)
- **Plain version:** "Delete cycle" did nothing for a group. After we turned it on, it half-deleted: it removed the cycle but then a second, out-of-date save put it back, while still moving the group back to the earlier cycle. That's why Powerlift 2.0 briefly showed Cycle 7 as current with Cycle 8 still present.
- **Fixed:** the delete now saves everything in one step, so it can't undo itself (`ed8decf`, `4c7dbca`).
- **Leftover:** the test "Cycle 8" may still exist; re-delete it now that the fix is live.

### 5. Settings kept editing the wrong cycle (fixed)
- **Plain version:** While a group was open, the Settings window kept snapping back to whatever cycle the main screen was showing. So if you tried to edit Cycle 8 while viewing Cycle 7, your change actually wrote to Cycle 7. This is the suspected origin of the swapped Squat/Deadlift names that appeared in the test Cycle 8.
- **Fixed:** Settings now edits exactly the cycle you pick (`ed8decf`).

---

## Open / under-investigation issues (2026-09-07)

### A. Clients created with no group become unreachable
- **Plain version:** "Add Client" lets you create someone with no group ("Unassigned"), but the app has **no Unassigned list**, so that person disappears and can't be placed into a group. (We found a duplicate **Frederick** this way: one correctly in Strategies & Squats, one stuck as unassigned.)
- **Status:** **Fixed and verified by the user** — the Roster tab now shows an **Unassigned** section when a group is selected (commit `af229a0`). This surfaced the duplicate unassigned Frederick, which was then successfully deleted. ✅

### B. New clients' estimated 1RMs save as 0
- **Plain version:** When you add a new client and enter their estimated 1RMs, then open their profile and save, the numbers came back as 0. The save wasn't failing — the number was being turned into 0 *before* it was saved.
- **Real trigger (confirmed):** the save step needs to know which cycle the numbers belong to. It computes "the client's highest cycle" from their cycle history. A brand-new client (assigned **or** unassigned) has **no cycle history**, so the math ran on an empty list and produced a nonsense cycle (`-Infinity`), and the estimates were written there as zeros instead of onto Cycle 1. Creating a client with no group was fine on its own; the break happened on the first profile save while they still had no cycle.
- **Fix applied (the agreed rule):** **Every client always has a real Cycle 1.** If a client has no cycle history, the save now treats them as being on **Cycle 1** and lands their estimates there — never on an empty/`-Infinity` cycle. Applied to both the desktop and mobile profile-save paths (commit `e12b494`). This removes the "empty history" edge case entirely, so it covers new, assigned, and unassigned clients alike.
- **Status:** **Fixed and deployed.** Forward-looking only — it stops the bug from happening again. It does **not** backfill the clients already zeroed (Vijay, Meg, Ting, Chloe, Yingyin, Frederick); re-enter their estimates once and they'll now save correctly.
- **Akshat cleanup (done, 2026-09-07):** he was the one client with the full corruption (zeros + a `-Infinity` cycle key + a group-scoped `currentCycleNumber = -Infinity` + empty group `cycleMembership`). The two `-Infinity` map keys were removed by hand in the console, and a script then set his group state back to `currentCycleNumber: 1` / `cycleMembership: [1]`. A bled-over `movementSelectionByCycle[1].Press = "1ct Pause Bench"` was also cleared. Verified clean afterward.
- **Fleet-wide scan:** checked all 20 clients for `-Infinity`/`NaN` values, bad map keys, non-finite group cycle numbers, and empty group memberships — **Akshat was the only client affected.** No others need cleanup.

### C. Powerlift 2.0 shows "OH Press" instead of "Incline Press," and graphs look off
- **Plain version:** The numbers weren't lost. Powerlift 2.0's *own* program correctly says the Day 2 press is **Incline Press**, and clients' real data is stored under "Incline Press." But the **old shared program** still says **OH Press**, and some screens still ask the old program for the movement name. They look up "OH Press," find no data under that name, assume it's a brand-new un-calibrated lift, and show blanks/zeros. The graph looks wrong because the screen looked up the wrong movement name.
- **The right fix (one rule, not more data patches):** whenever a group is selected, **every screen must ask that group's program for the movement name — never the old shared program.** That's a change to *which program each screen reads from*, not a change to anyone's data. Before changing code, do a read-only audit listing every screen that still reads the old shared program, so the scope is exact and small. One known suspect: the analytics/graph view reads only the old shared program.
- **Status:** Analytics portion **fixed and deployed**. The Client Profile follow-up is **fixed in the current dev worktree and tested, but intentionally not deployed yet** so it can ship with the next verified fix batch.

### C — fix applied (2026-09-07)
- **Plain version:** The analytics/graph screen now asks **each client's own group** "what's the press movement?" instead of asking the old shared program. So a Powerlift 2.0 client resolves to **Incline Press** (their group's name) and finds their real data again. No one's numbers were changed — only which program the screen reads from.
- **Follow-up found:** The Client Profile screen had the same old/shared-schedule wiring. The main workout view correctly used the selected group, but opening a profile still used the legacy schedule, which is why Powerlift 2.0 showed OH Press while the workout view showed Incline Press. The TS abbreviation means this troubleshooting log.
- **What changed (one-direction rule, no data touched):**
  - The analytics screen now receives the list of groups and, **per client**, uses that client's own group's program (`activeGroupId`) to resolve movement names and profiles. Ungrouped clients still use the old shared program, so nothing changes for them.
  - Files: `src/lib/admin-analytics.ts` (accepts an optional per-client schedule lookup), `src/components/AdminAnalyticsDashboard.tsx` (supplies that lookup from the client's group), and `src/app/admin/analytics/page.tsx` (passes the groups in).
- **Verified:** typecheck clean, all 44 tests pass.

### C — audit results (which screens read which program)
- **Plain version:** The main coaching screen already reads the **group's** program correctly, so it shows the right movement names. The **graph/analytics screen** is the one that still reads the **old shared** program — so for a grouped client it looks up the wrong movement name ("OH Press" instead of "Incline Press") and shows blanks/zeros.
- **Scope of the fix (small and contained):**
  - ✅ **Main coaching view** (`SbdohControl.tsx` and the workout table) — already uses the selected group's schedule. No change needed.
  - ❌ **Analytics/graph view** (`AdminAnalyticsDashboard.tsx` + its data builder `admin-analytics.ts`, fed by `src/app/admin/analytics/page.tsx`) — receives **only the old shared program** (`cycleSchedulesByCycle`) and no group info at all. This is the one to fix: pass the selected group's program and resolve each grouped client's movement names/profiles against their own group's schedule.
  - *Technical detail:* `admin-analytics/page.tsx` calls `<AdminAnalyticsDashboard cycleSchedulesByCycle={appSettings.cycleSchedulesByCycle} …>` with no `trainingGroups`. Inside, `resolveClientMovementName` / `getMovementProfileForLift` resolve names from that legacy schedule. The dashboard is also cross-group (shows all clients at once), so the fix must resolve **per client by that client's `activeGroupId`**, not with a single selected group.
- **Data note (separate from the code fix):** even after the view reads the right program, the leftover zeroed Cycle 8 snapshots (see below) can still make Cycle 8 look empty. Cleaning those up is a separate, reviewed data step.

### C — extra finding: the old shared program is mirrored onto every client document
- **Plain version:** While checking a brand-new Strategies & Squats client (**Vijay**), we saw "7 cycles" on his record and worried he had data he shouldn't. He doesn't. Those 7 cycles are **not his** — they're a copy of the **old shared program** (`cycleNames`, `cycleSchedulesByCycle`, `cycleSettingsByCycle`) that the app stamps onto *every* client document whenever settings are saved. Vijay's **real** data is separate and correctly tiny: `programStateByGroup → his group → Cycle 1`, and all-zero 1RMs.
- **Why it matters for issue C:** this mirrored legacy schedule lives **on each client doc**, and it still says the old movement names (e.g. Cycle 7 Press = "OH Press"). So it's **one more place** a screen can accidentally read the wrong movement name from. The fix rule is the same — read the client's *group* program, not these mirrored legacy fields — but any audit/cleanup should be aware these stale copies exist on every client.
- **Status:** Documented; no action needed for correctness once screens read the group program. (Optional hygiene later: stop mirroring the shared program onto client docs, or strip those fields, but that's a separate, careful change.)

---

## Confirmed data evidence (from production read, 2026-09-07)

These are real examples pulled from the live database that confirm the mechanisms above.

### B confirmed — Akshat has a corrupted cycle key
- **Plain version:** Akshat (Strategies & Squats, brand new, cycle 1) ended up with a saved "cycle" literally called **`-Infinity`** containing all zeros, plus a normal Cycle 1 of all zeros. `-Infinity` is impossible as a real cycle — it's what the code produces when it tries to compute "the highest cycle" over an **empty** list. So the save step ran on a client with no cycle history, computed an invalid cycle, and wrote zeros there.
- **Why this proves issue B:** the 1RM save isn't being dropped — it's being run against a brand-new client whose cycle membership is empty, which produces a garbage cycle key and zeros. That's the exact zeroing path.
- *Technical detail:* `Math.max(...[])` → `-Infinity`; `handleUpdateClient` computes `normalizedCurrentCycleNumber` from `getEffectiveCycleMembership`, which is empty for a fresh client, so `[currentCycleForClient]` became `-Infinity` in `oneRepMaxesByCycle`.

### C related — Cycle 8 test cycle left zeroed 1RM snapshots on Powerlift 2.0 clients
- **Plain version:** Mel, Michael, Kristina, Mick, Devon, Hunter, Michelle, and Radek all have a saved **Cycle 8** where **Squat, Deadlift, and Press were wiped to 0 but Bench kept its real value.** This lines up exactly with the Cycle 8 "test" cycle that had Squat and Deadlift swapped plus a new "1ct Pause Bench," created while the cycle-bleed bug (issue 5) was live.
- **Impact:** if anyone's view or graduation touches Cycle 8, those zeroed numbers can surface as blanks/"Bar only."
- **Cleanup:** deleting the leftover Cycle 8 (now possible after the atomic-delete fix, issue 4) plus removing the zeroed Cycle 8 1RM snapshots would clear this. Not yet done — needs a careful, reviewed data cleanup, not a blind script.

---

## Outstanding data cleanups (not code bugs)

These are leftover data from earlier bugs. They're separate from any code fix and should each be reviewed before running.

### 1. Zeroed Cycle 8 snapshots on 8 Powerlift 2.0 clients
- **What:** Mel, Michael, Kristina, Mick, Devon, Hunter, Michelle, and Radek each had a `oneRepMaxesByCycle[8]` (and related profile/calibration entries) where Squat/Deadlift/Press were wiped to 0 but Bench kept its value — residue from the test Cycle 8 created while the cycle-bleed bug (issue 5) was live.
- **What was done (2026-09-07):** Ran a read-only preview first, which showed the group's Cycle 8 *program* was already gone (the atomic-delete fix removed it) and only the 8 clients had residue, in just four shared maps. Deleted the Cycle 8 key from `oneRepMaxesByCycle`, `trainingMaxesByCycle`, `movementProfilesByCycle`, and `movementCalibrationsByCycle` on those 8 clients. Nothing else was touched (no group-scoped Cycle 8 state existed, and `cycleMembership` didn't include 8).
- **Status:** **Done and verified** — a follow-up scan confirmed no Cycle 8 data remains on any client.

### 2. Re-enter estimated 1RMs for zeroed Strategies & Squats clients
- **What:** Vijay, Meg, Ting, Chloe, Yingyin, and Frederick still have all-zero 1RMs from issue B.
- **Action (manual, no script):** open each profile and re-enter their estimated 1RMs; the issue B fix now saves them to Cycle 1 correctly.
- **Status:** **Not started** — quick manual task, safe to do anytime.

### 3. Optional hygiene — stop mirroring the shared program onto client docs
- **What:** every client document carries a copy of the old shared program (`cycleNames`, `cycleSchedulesByCycle`, `cycleSettingsByCycle`). It's stale baggage and a place screens can read the wrong movement name from.
- **Status:** **Optional / later.** Not required for correctness now that screens read the group program. Removing it is a careful, separate change.

---

## Intended new-client / calibration flow (target behavior for issue B)

1. You meet a client and optionally enter their **estimated 1RMs** (if they know them).
2. Those estimates populate the movements so they have starting weights.
3. Their **first cycle with a movement is a calibration cycle**: the app uses what they *actually* lifted to recalibrate the real numbers, since the initial estimates can be wrong or the client may be deconditioned.

This matches the intended design (new lifts start in calibration — see `isLiftCalibrationRequired`, which keeps a lift in calibration until it has logged history). Issue B is the bug that breaks step 2 by zeroing the estimate on save.

---

## Ongoing notes for the developer
- Firestore rules are `allow read, write: if true` (intentional for now; security is out of scope per user, but flagged).
- Maintenance/debug API routes run under the same open rules.
- The old shared `cycleSchedulesByCycle` still differs from group programs. Any screen that reads the old shared schedule for a grouped client will disagree with the group view. Prefer the group's schedule whenever a group is selected.

