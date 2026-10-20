# Troubleshooting Log — Training Groups Rollout

> **How to read this file:** Each issue is explained in plain language first, then (in a *Technical detail* line) the exact cause/fix for the developer. The goal is that a non-engineer can understand what went wrong and what we did about it. When a new bug shows up, check here first — many new issues are side effects of an earlier fix meeting data that was created while that bug was still live.

> **Workflow rule — batch before deploying:** Don't deploy one fix at a time. When several fixes are in flight, test them together in **dev first**, confirm the whole cluster is good, **then** do a single deploy. This cuts down deploy time and adds a layer of protection so we don't push a bug to the live site. Default to: fix → verify in dev → batch → deploy once.

---

## Handover — where things stand (2026-10-11; copy update 2026-10-16)

**Read this first.** It is the turnover from the 2026-10-10 / 2026-10-11 work sessions. Details are in issues 8–13 below.

### What is live right now
Everything below is merged to `main` and deployed to https://power-lift-b7ea1.web.app (last deploy 2026-10-16). `main` and the live site match.

| Area | What changed | Issue |
|---|---|---|
| Training max maths | Saves keep the number you type; deload weeks use the movement's number; a blank 1RM no longer zeroes a workout | 8 |
| Graduation | Members who fall behind can graduate again; lifts no longer stick in calibration; unused movements stop creeping up; one shared, tested graduation function | 9 |
| 1RM updates | A flag on the lifter's row when a logged set beats the stored 1RM; coach accepts or ignores; capped at 10% per update | 10 |
| Coaching screen | Status line under each name (TM, Hold, Calibrating, Logged), last top set, current-week and today dots, single title row | 11 |
| Settings and profile | Graduation preview table, compact profile table with Go up / Hold switch, Advanced folds, whole-number percentages, newest-first cycle list, in-page How To | 12 |
| Live data | Numbers corrected for five Powerlift 2.0 lifters; three stranded lifters moved onto the group's cycle | 13 |
| Copy button | Names no longer doubled; phone and computer copy the same; new "Copy past month" for the PCA app's history import | 14 |
| Safety net | 99 automated tests; typecheck and tests run on every pull request (`.github/workflows/checks.yml`) | — |

### What still needs checking in real use
None of these have been exercised with a real save by the coach yet. Do them during normal sessions and note the result here.

1. **Profile save:** change one training max in a profile, save, reload, confirm it stuck (closes issues 7 and 8).
2. **Go up / Hold switch:** flip one lift, save, confirm the "Hold" marker follows on the coaching grid and the Roster tab.
3. **Logging:** after logging a session, "Logged" should show under the name; next week that set should show as "Last …" under the top set.
4. **1RM update flag:** when someone clearly beats their numbers, a small "TM …" flag should appear by their name; accept one and confirm the weights change (issue 10).
5. **Deload week:** weights should come from the movement's training max (issue 8).
6. **Next graduation:** read the "What Will Change" table before confirming. Held lifts should stay put; lifts that were stuck in calibration should go up (issue 9).

### Open questions for the coach
- **Strategies & Squats setup:** no numbers entered for any lifter; week 2 repeats week 1 (no 5/3/1 week); bench, deadlift and pause bench are all on day 1 with only squat on day 2; still on cycle 1 since 2026-09-01. Intentional or not?
- **Week on screen vs calendar:** the coaching screen opened on Week 2 while the calendar dot marks Week 1 (cycle start 2026-10-06). Either the selection or the cycle start date is a week off.
- **AI insights:** the live build has no AI key, so that button may not work. Add the key if the feature is used.
- **Repository visibility:** the GitHub repository is public and this log names clients. Consider making it private.

### How work gets shipped now
1. Change on a branch, run `npm run typecheck` and `npm test`.
2. Preview locally with `npm run dev` (http://localhost:9002). **The local copy uses the live database** — there is no practice copy, so anything saved locally is real.
3. Pull request → the automatic checks must pass → merge.
4. Deploy by starting the **Deploy to Firebase** workflow on GitHub (Actions tab → Deploy to Firebase → Run workflow, or ask Claude). It runs the checks, builds and deploys `main` to `power-lift-b7ea1` in about 10 minutes. It never runs on its own after a merge. It needs the `FIREBASE_SERVICE_ACCOUNT` repository secret. Deploying by hand still works: `npm run build`, then `firebase deploy --only hosting --project power-lift-b7ea1`.
5. Look at the live site afterwards.

### Where things are written down
- `docs/program-rules.md` — what the site is meant to do, and where it deliberately differs from the 5/3/1 book.
- `docs/future-improvements.md` — parked ideas (stall and reset, phone lifter jump, analytics feeding the status line, and more).
- `~/fluffy-engine-backups/` on the coach's machine (not in the repository) — a full copy of the live data from before the 2026-10-11 corrections, plus the before/after record of those corrections.

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

### 4. Warm-ups are not matching the expected weights
- **Plain version:** the saved warm-up percentages are correct (normal weeks use 25% and 35% of the training max), but the weights shown on the workout screen do not always match the client's current movement profile. For example, Powerlift 2.0 Cycle 7 Devon has a stored Incline Press training max of 100, so Week 1 should calculate to 25/35 warm-ups and 65/75/85 work sets. The reported screen showed 45/55/65, which cannot come from that stored Cycle 7 profile and template.
- **What the code does:** `calculateWorkout` calculates every set from the selected movement profile's training max, rounds to the nearest 5, and then calculates plates. The live group templates themselves have the expected 25%/35% warm-up percentages.
- **Likely issue:** the old warm-up normalization work covered the shared program but did not clearly cover nested group programs. That is a coverage gap, but the live group percentages are currently correct. The immediate mismatch points to the render path using a different effective week or training max than the group-scoped Cycle 7 values inspected in Firestore.
- **Correction (2026-10-10):** the "25% and 35%" above is wrong. The intended warm-ups are **50% and 60%** on every week (see the blueprint and issue 6), followed by that week's work sets (e.g. 65/75/85). With a training max of 100, Week 1 is 50/60 warm-ups and 65/75/85 work sets.
- **Follow-up (2026-10-10):** a likely cause was found in code and fixed — see issue 8. Still needs the live check described there before this is closed.
- **Earlier status:** **Under investigation; no data or code change yet.** Next step is to capture the exact active cycle/week, projected client, movement profile, and workout calculation together in dev before changing anything. This must be fixed for every group, not by changing Powerlift 2.0 data only.

### 5. Deprecated top-level trainingMaxes are stale on a few clients
- **Plain version:** Several clients still have older top-level `trainingMaxes` values that do not match their current-cycle `trainingMaxesByCycle` values. This is a data-sync issue, not a workout-calculation bug. The app is intentionally reading the cycle-scoped values for math, so workouts stay correct even while the legacy field remains stale.
- **What is being tracked:** Devon, Michael, Mick, Hunter, Mel, Kristina, and Radek are still showing this mismatch. The warning is staying visible as a tracked reminder until their Firestore docs are cleaned up to match the authoritative per-cycle data.
- **Source of truth:** `trainingMaxesByCycle[currentCycle]` is the value the app uses. `trainingMaxes` is legacy compatibility data, and the validation log specifically calls out when it is stale.
- **Status:** **Tracked; not a runtime logic failure.** The remaining action is a Firestore cleanup/sync, not a code fix in the calculation path. This item should stay in the troubleshooting log until the DB is fully consistent.
- **Follow-up (2026-10-11):** this was not only stale data. Every profile save was re-writing the old values into the top-level field (issue 8), so it kept going stale. That is fixed, graduation now keeps the lift-slot and movement numbers equal (issue 9), and the lifters corrected in issue 13 had the top-level field brought into line. Any remaining mismatch on other lifters will clear the next time their profile is saved or they graduate.

---

## Intended new-client / calibration flow (target behavior for issue B)

1. You meet a client and optionally enter their **estimated 1RMs** (if they know them).
2. Those estimates populate the movements so they have starting weights.
3. Their **first cycle with a movement is a calibration cycle**: the app uses what they *actually* lifted to recalibrate the real numbers, since the initial estimates can be wrong or the client may be deconditioned.

This matches the intended design (new lifts start in calibration — see `isLiftCalibrationRequired`, which keeps a lift in calibration until it has logged history). Issue B is the bug that breaks step 2 by zeroing the estimate on save.

---

## Route disposition decisions (final)

### Keep as maintenance-only: `backfill-movement-profiles`
- **Use case:** only for clients who are missing `movementProfilesByCycle` entries even though there is historical logged-set data that can reconstruct a reasonable 1RM/training max.
- **Why it still matters:** this is the only route that can rebuild missing movement profile state from actual logged sets, instead of guessing from the current top-level values.
- **Not a normal workflow:** it is not a routine app operation and should not be run as a blanket fix. It is an edge-case recovery tool for data repair only.

### Delete / do not use: `fix-current-cycle-main-lift-maxes`
- **Why it is unsafe:** it rebuilds the current cycle training maxes from `oneRepMaxes` using `oneRepMaxes * 0.9`. Several active clients have valid real values in the current cycle while their `oneRepMaxes` fields are blank or partial (Bench present, Squat/Deadlift/Press = 0), so a blanket run can overwrite correct training maxes with zeros.
- **Current rule:** do not run it again until there is an explicit, safer repair path for partial/blank 1RM data.
- **Disposition:** this route is treated as a legacy, speculative repair and should be removed from the codebase rather than kept as an active admin action.

### Delete / do not use: `reset-weeks`
- **Why it is legacy:** this is a broad default-reset hammer for the whole cycle template system. It was useful in the app's early days, but the current product does not have a supported workflow that intentionally resets all week templates going forward.
- **Current rule:** do not use this as a standing admin action. If a reset is needed, it should be a targeted, reviewed data fix for a specific cycle/group, not a generic reset-all hammer.
- **Disposition:** remove from the repo as a stale one-off route.

---

### 6. Group programs kept showing stale 25%/35% warmups after the warmup fix shipped
- **Plain version:** after the earlier warmup fix (item 4 above) was believed complete, Powerlift 2.0's own Cycle 7 still displayed 25%/35% warmups in Settings, even after that fix was committed, tested, and deployed to prod.
- **Root cause:** the training-groups feature stores each group's own week templates in `trainingGroup.program.cycleSettingsByCycle`, separate from the legacy shared `appSettings.cycleSettingsByCycle` and separate from the per-client mirrored settings. The original warmup fix (`normalizeWarmupPercentages`) was only wired into the two legacy read/write paths in `getAppSettings`/`saveAppSettings`. `normalizeTrainingGroups`, which reads and writes every group's own program, never called it — so any group's stored cycle template kept whatever warmup values it already had.
- **Why this was missed:** the fix was verified by auditing/normalizing the legacy shared program and confirming `audit-warmup-percentages` reported clean. That audit and the manual live-data check both only inspected the old shared program shape, not each training group's nested `program.cycleSettingsByCycle`. Once groups shipped, they became a second, parallel place the same stale data could live, and the verification step wasn't updated to cover it.
- **Fix:** `normalizeTrainingGroups` in `src/lib/data.ts` now runs each group's `program.cycleSettingsByCycle` through the same `normalizeWarmupPercentages`/`normalizeAccessoryVisibility` normalization used for the legacy program, on both the read (`getAppSettings`) and write (`saveAppSettings`) paths. No Firestore write was needed — normalization happens on every read, so existing group documents self-correct immediately.
- **Verified:** typecheck and full test suite pass (45/45); confirmed live via `getAppSettings()` that Powerlift 2.0 Cycle 7 Week 1 now resolves to `warmup1: 0.5`, `warmup2: 0.6`.
- **Lesson for next time — catch this earlier:** whenever a data-shape fix touches something that exists in more than one place (legacy shared program, per-client mirrored settings, and now per-group programs), the checklist must explicitly enumerate every storage location before declaring the fix or its audit complete. Grep for all places a given field (e.g. `cycleSettingsByCycle`) is read/written before closing out a "fixed" data bug, not just the location where the bug was originally reported.
- **Follow-up audit found a second instance of the same gap:** `normalizeCycleSettingsByCycle` (the deload-week percentage/rep repair and stale "Week X (Repeat)" name repair in `src/lib/cycle-settings-normalizer.ts`) was only ever run client-side in `SbdohControl.tsx` against the legacy shared program — never against each group's own `program.cycleSettingsByCycle`. Fixed by running it inside `normalizeTrainingGroups` in `src/lib/data.ts` as well, so it's applied server-side for every group on both read and write, the same way the warmup fix now is. A live scan of every group's Cycle 4 (deload) week confirmed no group actually had corrupted deload data, so this was a preventive close of the gap rather than a live incident.
- **Related, lower-risk gap noted but not changed:** the mobile dev dashboard (`MobileDevShell.tsx`) never runs `normalizeCycleSettingsByCycle` at all, even for the legacy shared program (desktop's `SbdohControl.tsx` is the only place that does). This predates this session's fixes and only affects ungrouped clients viewed on mobile; flagged here for awareness, not yet fixed.

---

## Open / under-investigation (2026-09-08)

### 7. Client profile saves appear to silently do nothing, for every client (not just one)
- **Plain version:** the user tried to update a client's profile (started with Akshat, but reports this is happening broadly) and nothing saves — no visible error, no toast, no console output in the browser.
- **Follow-up #1 (ruled out):** first suspected the desktop/mobile split — the user reproduced this via Chrome DevTools' device emulation, which switches the app to the mobile dashboard component. Traced `handleUpdateClient` in `MobileDevShell.tsx` and it's structurally identical to the desktop version and calls the same server action correctly — not the cause.
- **Follow-up #2 (ruled out):** confirmed a success toast *does* appear after saving, which proves the Save button is being hit, the server action is running, and `updateDoc` is completing without error. So this was never actually a "silent failure" — it's a "reports success, but the typed values don't stick" bug. Also ruled out a cycle-selector mismatch theory (the user confirmed the correct "Cycle 1 (Current)" was selected in the dropdown when the bug occurred).
- **Root cause found:** `mainLiftProfileSnapshots` in `src/components/ClientProfileModal.tsx` computed each main lift's 1RM/training max as:
  ```
  oneRepMax: cycleOneRepMaxes?.[lift] ?? chosenProfile?.profile.oneRepMax ?? 0
  ```
  `cycleOneRepMaxes` is the **old, unedited** top-level `oneRepMaxesByCycle`/`oneRepMaxes` snapshot. `chosenProfile.profile.oneRepMax` is the **live, freshly-typed** value from the Movement 1RM/TM input fields (bound via `handleMovementProfileChange`). Because `cycleOneRepMaxes?.[lift]` is almost always a real number — including `0` for a brand-new client — and `??` (nullish coalescing) only falls through on `null`/`undefined`, **the old value always won, even when it was `0` and the coach had just typed a real number.** The freshly-typed input was read correctly, stored correctly in local state, then discarded the moment `handleSave` built the payload from this snapshot. This is why the save "succeeded" (it really did write to Firestore) but always re-wrote the old (often zero) values instead of what was typed — for every client, on every lift, whenever this Movement-tab input path was used to set 1RMs.
- **Fix:** swapped the priority so the live-edited profile value wins first, falling back to the top-level cycle snapshot only when no profile entry exists yet: `chosenProfile?.profile.oneRepMax ?? cycleOneRepMaxes?.[lift] ?? 0` (same swap for `trainingMax`). Safe because `movementProfileEntries` already seeds a new profile's `oneRepMax`/`trainingMax` from `cycleOneRepMaxes` when no profile exists yet, so the fallback value is identical in the untouched case — only the edited case changes behavior.
- **Verified:** typecheck and full test suite pass (45/45). `ClientProfileModal.tsx` is shared by both `SbdohControl.tsx` (desktop) and `MobileDevShell.tsx` (mobile), so one fix covers both surfaces.
- **Status:** fix committed; **not yet deployed to prod as of this entry** — deploy and a live re-test (edit a real client's 1RM, reload, confirm it stuck) are still required before this is closed out.
- **Follow-up (2026-10-11):** the fix is deployed (it is part of every deploy since). A deeper cause of numbers not sticking was found afterwards — see issue 8. **Still not closed:** the live re-test by the coach has not been done.
- **Lesson for next time:** when a "save" reports success but the value doesn't change, don't assume the write path is broken — check whether the *value being sent* is actually the edited one. A `??` where `||` (or a reversed priority order) was needed will silently prefer a stale falsy-but-defined value (like `0`) over a real edit, and nothing about that failure mode throws, logs, or fails a toast.

### 8. Training maxes were being overwritten or ignored in three places (2026-10-10)
- **Plain version:** the app keeps two copies of each training max — one per **lift slot** (Squat/Bench/Deadlift/Press) and one per **movement** (e.g. Incline Press). A code review found three places that quietly replaced or ignored the number the coach set:
  1. **Every profile save recalculated the lift-slot training max as 90% of the 1RM**, on desktop and mobile, whatever had been typed. If the 1RM was blank the training max became 0, and desktop then rebuilt later cycles from it. This is the same formula that got `fix-current-cycle-main-lift-maxes` banned, and it is also why the top-level `trainingMaxes` kept going stale (outstanding cleanup 5).
  2. **Deload weeks ignored the movement's training max** and used the lift-slot one instead — the number item 1 kept overwriting.
  3. **A blank 1RM wiped the whole workout to zero**, because the "training max must not exceed the 1RM" safety check treated a blank 1RM as a real max of 0.
- **Also found:** saving a profile while viewing a **non-current cycle** wrote 0 for any lift with no movement entry in that cycle, and could create an all-zero cycle for a client who had nothing stored there. This matches the Cycle 8 pattern (Squat/Deadlift/Press wiped, Bench kept).
- **Likely link to outstanding item 4 (Devon):** the reported 45/55/65 cannot come from Week 1 percentages at any training max. It is exactly the deload percentages (40/50/60) on a training max of 110 rather than Devon's Incline Press 100. **This is an inference from the code.**
- **Fix (one rule: the movement's training max is the number, and nothing recalculates it behind the coach's back):**
  - Profile saves keep the training max as edited; 90% of the 1RM is only used when a cycle has no training max at all, and no other cycle is rewritten. Desktop and mobile now share one function (`normalizeClientForProfileSave` in `src/lib/client-profile-save.ts`).
  - `calculateWorkout` (`src/lib/utils.ts`) uses the movement's training max on every week, deload included, and no longer zeroes a workout when the 1RM is blank.
  - `ClientProfileModal.tsx` keeps a non-current cycle's stored numbers and skips writing strength data for a cycle the client has nothing in.
- **Deliberately not changed:** the safety check still lowers a training max that is higher than a real, entered 1RM (to 90% of that 1RM). Graduation raises the training max each cycle without touching the 1RM, so long-running clients can still hit this until their 1RM is updated. Needs a decision.
- **Verified so far:** typecheck clean, full test suite passes (53/53), including 8 new tests for the cases above (`src/lib/client-profile-save.test.ts`). Tests and typecheck now also run automatically on GitHub for every pull request (`.github/workflows/checks.yml`).
- **Status:** **merged (pull request 2) and deployed 2026-10-10.** Checked so far: tests, and a read-only look at the live numbers. **Not closed:** the coach's live checks are still to do — a real profile save that sticks, and a deload week on screen.
- **Route removed:** `fix-current-cycle-main-lift-maxes` was deleted from the codebase on 2026-10-10. `ENABLE_MAINTENANCE_ROUTES` is still `"true"` in `apphosting.yaml` for the remaining maintenance routes.

### 9. Graduation review: stranded members, lifts stuck in calibration, untrained movements creeping up (2026-10-11)
- **Plain version:** a review of graduation found three problems.
  1. **Members who fell behind could never graduate again.** The graduation list only offered members whose own cycle matched the group's. Anyone left behind dropped off the list for good, yet still appeared on the workout screen with numbers guessed from an older cycle.
  2. **Lifts stuck in "calibration" never went up.** A lift whose numbers were typed in (rather than calibrated from a logged set) kept its calibration flag forever, and graduation holds any lift in calibration.
  3. **Movements that weren't trained still went up every cycle.** Graduation raised every stored movement, including ones the group had swapped out.
- **Also:** the lift-slot training max and the movement training max were raised separately at graduation, which is how they drifted apart.
- **Fix:** all graduation maths now lives in one tested function, `buildGraduatedClient` in `src/lib/graduation.ts`, used by both the server and the desktop screen (previously two hand-kept copies).
  - Only movements trained that cycle go up; others carry forward unchanged.
  - A leftover calibration flag no longer holds a lift that has a full cycle of logged history, and the flag is cleared.
  - Each lift slot's training max follows its movement's.
  - Members behind the group's cycle are offered in the graduation list and land on the group's next cycle, graduating from their most recent numbers.
- **Verified:** typecheck clean, 80/80 tests pass, including 10 new tests that run the real graduation code (the older graduation tests only simulated it).
- **Status:** **merged (pull request 3) and deployed 2026-10-11.** The graduation preview (issue 12) shows the expected results on live data. **Not closed:** the next real graduation is the live check.

### 10. The stored 1RM never updates, so strong lifters were held back (2026-10-11)
- **Plain version:** the stored 1RM stays fixed during normal cycles while the training max rises every cycle. Lifters hitting 10+ reps on their top sets had no way to catch up except typing new numbers by hand, and the old "reset training max from recent performance" button only changed the lift-slot number that movement profiles override.
- **What was built:** when a logged set estimates a 1RM at least 5% above the stored one, a small flag ("TM 210") appears by the lifter's name on the desktop grid and phone cards. Tapping it shows the set, the estimate, and the 1RM and training max before and after. Nothing changes unless the coach presses "Update numbers".
- **Guard rails:** one update can raise a training max by at most 10% (high-rep sets overestimate a true max); only one update per logged session; no flag on deload weeks or modified sessions; holds and graduation are unaffected.
- *Technical detail:* `src/lib/one-rep-max-suggestion.ts` (pure logic and tests), `OneRepMaxSuggestionButton.tsx`, wired into `WorkoutTable.tsx`, `MobileWorkoutCard.tsx` and both shells.
- **Status:** merged (pull request 4) and deployed 2026-10-11. **Not yet seen on live data** — nobody's logged sets for the week on screen were big enough to trigger it. First real flag and accept is the live check.
- **Left alone on purpose:** the old reset button still exists and still only changes the lift-slot number (noted in `future-improvements.md`).

### 11. Coaching screen: the grid hid why a weight was what it was (2026-10-11)
- **Plain version:** the grid showed weights and plates but nothing about holds, calibration, training maxes or who had logged — which is how a lifter being shown weights above their held numbers went unnoticed.
- **What changed:**
  - A status line under each name: training max, plus "Hold", "Calibrating" and "Logged" as plain words.
  - The most recent logged top set under each prescribed top set ("Last 270 × 7"). It checks earlier weeks of the cycle, then the previous cycle, skips deloads, and won't borrow from a different movement.
  - A dot on the week today falls in by the calendar, and on today's session button.
  - Fixes for cut-off names and day buttons; plate chips wrap inside their column; "lbs" moved to the column header; Week 4 tab reads "Deload"; logo and title merged into one row.
- *Technical detail:* `LifterStatusLine.tsx`, `src/lib/previous-top-set.ts`, `getCalendarWeekKey` in `src/lib/schedule.ts`, `getLiftProgressStatus` in `src/lib/graduation.ts` (the same rule graduation uses, so the screen and graduation cannot disagree).
- **Status:** merged (pull request 5) and deployed 2026-10-11. Seen on the live site: training max, Hold, last top set, current-week dot. **Not yet seen:** "Calibrating", "Logged", and the today dot (nobody was in those states; it was not a training day).

### 12. Settings and profile windows reorganised (2026-10-11)
- **Plain version:** the settings were laid out the way the data is stored rather than the way they are used, and a few controls exposed internal bookkeeping.
- **What changed:**
  - **Graduation preview:** the form ends with a "What Will Change" table — each selected lifter's training max now and after, per lift, with holds marked. It is built from the same function that does the real graduation.
  - **Profile:** the four lift cards became one table (lift and day, movement, 1RM, TM, step, at graduation) with a clear "Go up / Hold" switch and the last logged top set.
  - **Advanced folds:** "Client Cycle Membership" (profile) and "Cycle Client List" (settings) are folded away with a warning; unticking a cycle there is one way a lifter gets left behind the group.
  - **Program Weeks:** percentages are typed as whole numbers (70, not 0.7) with plain labels. Warm-ups are shown greyed out because the site fixes them at 50% and 60% on every week.
  - **Program Cycles:** newest first, three shown, the rest folded. "Current" now means the cycle the group is on; "Editing" marks the cycle Settings is changing (previously the editing cycle was mislabelled "Current").
  - **Also:** compact Movements table; How To opens in a window instead of leaving the site; visible "Week options" button and a gear on each group replace double-click-only actions; Roster rows show cycle, holds, "Behind group" and "No numbers yet"; the internal group ID and an out-of-date feature list were removed.
- *Technical detail:* `GraduationPreview.tsx`, `getGraduationPreview` in `src/lib/graduation.ts`, `RosterStatus.tsx`, `HowToDialog.tsx`, plus edits in `ConfigSettingsDialog.tsx`, `ClientProfileModal.tsx`, `SettingsSidebar.tsx`.
- **Status:** merged (pull request 6) and deployed 2026-10-11. Seen on the live site: Roster status line, Week options window, graduation preview (on the local preview against live data). **Not exercised:** saving from the new profile table, and the Advanced folds.

### 13. Live data corrections for Powerlift 2.0 (2026-10-11)
- **Plain version:** a read-only review of the live data, compared against each lifter's logged sets, found two kinds of problem and both were corrected with one reviewed, one-off script run by the coach.
  1. **Numbers that no longer matched reality.** Some training maxes were above what the lifter had actually lifted, so the safety check was quietly lowering them; in one case the stored 1RMs were also out of date, so the lowered weights were too light. Those lifters' 1RMs and training maxes were set from their recent logged sets.
  2. **Three lifters stranded behind the group.** Their schedule position was stuck on older cycles while the group moved on, so they had no entry for the current cycle and were shown numbers guessed from an older one — for one of them, above the numbers the coach had put on hold. They were moved onto the group's current cycle with proper entries, and the holds were restored.
- **How it was done safely:** full backup of the live data first; a dry run that printed every before and after value; then the same script with writes switched on; then a read-back confirming every lifter is on the group's cycle with a stored number for every lift and nobody being lowered by the safety check. The script was deleted afterwards.
- **Where the detail is:** client names and numbers are deliberately not in this file (the repository is public). The backup and the before/after record are in `~/fluffy-engine-backups/` on the coach's machine.
- **Decision recorded:** the safety check that lowers a training max above a real 1RM stays for now. The longer-term replacement (flag a stall, suggest a reset, coach decides) is in `future-improvements.md`.
- **Status:** done and read back. Nothing further needed unless a lifter's numbers look wrong in use.

### 14. Copy button: doubled names, phone and computer disagreeing; new "Copy month so far" (2026-10-16)
- **Plain version:** the Copy button swapped in each lifter's movement name with find-and-replace on the finished text, and the replace also hit text that already had the right name. Found with real names: the day heading read "OH OH Press" and "Hex Bar Hex Bar Deadlift", and accessories were renamed ("JM Press" became "JM 1ct Pause Bench"). The phone built its copy text with a separate copy of the code that never used the lifter's own movement name, so the phone said "Deadlift" where the computer said "Hex Bar Deadlift". The one-lift copy also always included warm-ups, even with "Hide w/u" on, and its blank lines were being stripped.
- **Fixed:** the copy text is now built in one place that the phone and computer both use, and every name is the lifter's own from the start. Nothing is replaced afterwards. The one-lift copy follows the warm-up switch and has blank lines between sections. Numbers typed but not saved yet are included on both screens.
- **New:** "Copy month so far" (now "Copy past month", see below), in each lifter's ⋮ menu and in the Copy menu (computer toolbar and phone card). It copies every session from the 1st of the month to today across cycles: the date, cycle and week, prescribed sets and what was logged, and accessories, laid out a week to a row with one column per training day. It pastes as a table into Sheets or Docs, and as tab-separated text elsewhere. It is meant for carrying a lifter's month into the PCA app (client history import) when writing their next workouts.
- **Window changed (same day):** the menu item is now **"Copy past month"**. It used to copy the 1st of the calendar month to today, whichever week was on screen. Now it copies one month back from the session on screen: on this week that is the month up to today, and on an earlier week it is the month up to that session. It never goes past today, so a future week on screen still ends today.
- **Layout follow-up (same day):** the first version wrote dates as "Tue 10/13" with no year and used the site's own headings, so the PCA import found no sessions and listed every line as an unmatched movement. Each block now starts with a full date (10/13/2026) and the PCA headings `MOVEMENT | SETS | REPS | LOAD`, then `PLANNED REPS | PLANNED LOAD`, which the import ignores. A lift's name is on its first set only, so the import keeps the three sets as one movement. REPS and LOAD hold what was logged. A lift with nothing logged shows the plan, and its heading says "(NOT LOGGED, PLANNED SHOWN)". Accessories are listed under "ACCESSORIES (PROGRAMMED)"; the import skips them because the program has names only. Checked by running a real lifter's month through the PCA app's own import code: 5 sessions and 10 movements read, with the right dates and sets.
- **Worth knowing:** past sessions' prescribed weights are worked out again from the lifter's current numbers for that cycle. If a training max was changed partway through a cycle, earlier rows show the new prescription; the logged actuals are what was saved. Week 1 of a calibrating lift has no prescribed load, as on screen.
- *Technical detail:* `src/lib/client-workout.ts` (`calculateClientLiftWorkout`, the per-lifter calculation that `SbdohControl` and `MobileDevShell` each had a copy of), `src/lib/session-copy.ts` (lift, day and month builders), `src/lib/copy-formatter.ts` (text, table, month grid, clipboard with HTML). Tests: `src/lib/session-copy.test.ts`.
- **Status:** merged (pull request 8) and deployed 2026-10-16; 109 tests pass. On the live site, "Copy past month" copied a lifter's Sep 16 – Oct 16 on the computer and phone layouts. Before that, On the local preview against live data, copying one lifter's day and month on the computer and phone layouts gave the same text on both, with no doubled names. **Still to check in real use:** paste a month into the PCA app's history import and match the movement names once (it remembers them).

---

## Working rule: track fixes that didn't fully work, not just fixes that did
Some entries above only tell half the story on a first pass — they get marked "fixed" after fixing what was *found*, without confirming that was the *entire* issue. Going forward, every entry must show its full history:
1. What was reported.
2. What was fixed, and what evidence was checked to confirm it (not just "code was changed").
3. If the symptom recurred or a related gap was found later, add a **follow-up** entry to the same numbered issue instead of a new disconnected one — state clearly that the earlier fix was incomplete, what was missed, and what closed the gap the second time.
4. Never close an issue as "done" purely because a code change was deployed — close it only once the originally reported symptom has been reproduced-and-confirmed-fixed, or explicitly state it remains open/unverified.

---

## Ongoing notes for the developer
- Firestore rules are `allow read, write: if true` (intentional for now; security is out of scope per user, but flagged).
- Maintenance/debug API routes run under the same open rules.
- **One database, no practice copy:** local development, previews and the live site all use the same live data. A separate test project or the Firebase emulator would make it possible to test saves and graduation safely; until then, test with read-only looks and dry runs.
- **Shared logic lives in `src/lib/`:** profile-save normalisation, graduation, lift status, the 1RM suggestion and the last-top-set lookup are each one tested function used by both the desktop and phone screens. Workout calculation and set logging are still duplicated between `SbdohControl.tsx` and `MobileDevShell.tsx`; change both or, better, move them into `src/lib/` first.
- **`apphosting.yaml` is not what deploys the site.** The live site is built by `firebase deploy` on the deploying machine, which bakes in that machine's `.env.local`. Settings in `apphosting.yaml` (including the maintenance-route switch) may not reflect what is live.
- The old shared `cycleSchedulesByCycle` still differs from group programs. Any screen that reads the old shared schedule for a grouped client will disagree with the group view. Prefer the group's schedule whenever a group is selected.
- **Multi-location data check:** several fields exist in three parallel places — the legacy shared `appSettings` document, per-client mirrored settings, and per-group `trainingGroup.program`. Any normalization/repair fix must be applied (and verified) in all three before being marked done.


