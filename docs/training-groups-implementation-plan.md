# Training Groups Implementation Plan

## Product Decisions

- [ ] Confirm that a client has one active group at a time. Moving a client changes their active group and retains enrollment history.
- [ ] Confirm the transfer default: join the receiving group at its current cycle and week, while retaining client lifting history, logged sets, notes, and 1RM/TM records.
- [ ] Confirm whether a transfer can instead start a client at week 1 when coaching requires it.
- [ ] Confirm the gym's IANA timezone, for example `America/Chicago`, used for time-aware automatic group selection.
- [ ] Confirm the new groups' names, day-one and day-two weekdays, start times, first program start date, and initial five to eight client assignments.

## Target Navigation

The sidebar must use two independent, closed-by-default accordion sections in this order:

```text
Groups                                    [caret]
  6:00 AM - Fall Series (8)               [caret]
  5:30 PM - Fall Series (7)               [caret]
  Legacy Group (7)                        [caret]

All Clients (22)                          [caret]
  Alex
  Brianna
  ...
```

- [ ] The `Groups` caret only expands and collapses the group list.
- [ ] Each group caret only expands and collapses that group's members.
- [ ] A group row selects that group's independent program and workout roster.
- [ ] The `All Clients` caret only expands and collapses the complete roster.
- [ ] Selecting a client from either list opens their profile; it must not change the selected group.
- [ ] Keep the selected group visible and clearly marked while its member list is collapsed.
- [ ] Preserve this information architecture on desktop and mobile, using the current sidebar/sheet behavior appropriate to each viewport.

## Phase 1: Domain Model and Pure Helpers

### Scope

- [x] Add a `TrainingGroup` type in `src/lib/types.ts` with stable ID, display name, sort order, active status, timezone, and independent program settings.
- [x] Move program ownership conceptually from app-wide cycles to a group program: cycle names, cycle settings, schedules, and current selection belong to a group.
- [x] Add `activeGroupId`, group-scoped client program state, and a historical enrollment record to `Client`.
- [x] Keep all per-cycle client fields inside group-scoped state so a transfer between two independently numbered programs cannot overwrite previous program progress.
- [x] Define an unassigned fallback for pre-existing clients so no existing client disappears during rollout.
- [x] Add pure helpers for finding a group, filtering active members, sorting groups, and building a group-specific program context.
- [x] Add a pure, timezone-aware group recommendation helper. It must choose the current/nearest scheduled group from its weekday and start time without relying on the browser timezone.

### Tests

- [x] Add unit tests for group sorting, active-member filtering, and unassigned-client fallback.
- [x] Add time-boundary tests for before, during, and after a group start time.
- [x] Add a timezone test using the chosen IANA timezone.
- [x] Run the focused Vitest files for the new helpers.
- [x] Run `npm run typecheck`.

## Phase 2: Persistence and Backfill

### Scope

- [x] Extend the `appSettings/cycleSettings` document schema in `src/lib/data.ts` to persist group definitions and their independent program settings.
- [x] Preserve backward compatibility while reading existing app settings with no groups.
- [x] Update `getAppSettings` and `saveAppSettings` to normalize and save groups without altering unrelated client data.
- [x] Update the page and shell props so both desktop and mobile receive the initial groups.
- [ ] Add an idempotent migration/backfill route or script that creates a legacy/default group and assigns every existing client to it.
- [ ] Ensure the backfill can be previewed and reports client counts before writing.
- [ ] Update server action payloads so `activeGroupId` and enrollment history are never dropped by profile saves or client creation.

### Tests and Verification

- [ ] Add unit tests for legacy settings normalization and a second read after save.
- [ ] Add a migration test covering an unassigned legacy client and a client already assigned to a group.
- [ ] Run the focused persistence and migration tests.
- [ ] Run `npm run typecheck` and `npm run lint`.
- [ ] Take a Firebase backup/export or record document snapshots before running the production backfill.
- [ ] Run the backfill once in a non-production environment, verify counts, then run it in production.

## Phase 3: Group Administration

### Scope

- [x] Add a Training Groups section to `src/components/ConfigSettingsDialog.tsx`.
- [x] Support create, rename, and archive/restore; edit timezone and day start times.
- [ ] Add reorder controls, day weekday editing, program start date editing, lift day assignments, and movement display names per group.
- [x] Creating a group must start with a fresh independent program and cycle one settings, not a reference to another group's mutable settings (implemented via a deep clone of current cycle settings/schedules at creation time).
- [x] Add a guarded archive flow. Archiving (toggle active/restore) does not delete members or historical program data; there is no delete action yet, so nothing is destroyed.
- [ ] Prevent deleting the final active group while clients still need an assignment. (Not yet applicable — no delete action exists yet.)
- [x] Ensure group configuration is available through both the desktop and mobile configuration entry points.

### Tests and Verification

- [ ] Add tests that creating a group does not mutate an existing group's program settings.
- [ ] Add tests for archive behavior and active-group validation.
- [ ] Manually create two groups with different start dates and confirm their week/cycle changes do not affect one another.
- [x] Run `npm run typecheck`.
- [x] Run `npm run lint` (0 errors; 3 pre-existing unrelated warnings).

## Phase 4: Client Assignment and Transfers

### Scope

- [x] Add group selection to `src/components/AddClientSheet.tsx`. (Deviation: assignment is optional at creation, not required, and the picker only appears once at least one active group exists — this keeps today's add-client flow unchanged until groups are rolled out.)
- [x] Add current group and transfer controls to `src/components/ClientProfileModal.tsx`.
- [x] Require an explicit transfer placement choice: receiving group's current week ("Keep current progress") or week 1 ("Start at week 1"); defaults to keep-current-progress and is only submittable once a destination group is chosen.
- [x] On transfer, update `activeGroupId`, append enrollment history, and initialize only the client program state needed by the destination group (`buildGroupTransferUpdate` / `buildGroupProgramStateForPlacement` in `src/lib/training-groups.ts`).
- [x] Retain client identity, lifting history, notes, historical records, and all prior enrollment history (transfer only merges the three group-related fields onto the existing client object).
- [x] Make the `All Clients` list the natural roster-management surface for moving a member between groups (the transfer control lives in the shared client profile modal opened from any roster list; no separate UI exists yet since Groups accordion is Phase 5).

### Tests and Verification

- [x] Add tests for transferring a client to each allowed placement (`current_program` keeps progress, `week_1` resets to a fresh cycle 1) and for enrollment-history bookkeeping across a transfer.
- [ ] Add a server-level test for creating an assigned client (blocked: `addClientAction` talks to Firestore; no test harness for that path yet).
- [ ] Add a regression test that profile edits retain the group assignment.
- [ ] Manually transfer a client, reload the app, and verify that they appear only in the destination group.
- [x] Run `npm run typecheck`, `npm run lint`, and the focused Vitest files (38/38 passing overall).

## Phase 5: Sidebar and Group-Scoped Workouts

### Scope

- [x] Refactor `src/components/SettingsSidebar.tsx` to render the accordion navigation defined above.
- [x] Add selected-group state to `src/components/SbdohControl.tsx` and `src/components/dev-dashboard/MobileDevShell.tsx`.
- [x] Filter the calculated workouts by active group and the group's selected cycle membership.
- [x] Pass the selected group's copied program settings, schedule, and cycle to workout calculation rather than the current globally shared settings.
- [x] Update the session header to include the selected group name. (Scheduled start-time display remains to be added.)
- [ ] Preserve a useful `All Clients` roster view without treating it as a combined workout program.
- [ ] Scope roster reordering within the selected group. A member move must not reorder clients in other groups.
- [ ] Make empty states clear for a group with no members and for unassigned clients.

### Tests and Verification

- [ ] Add component or helper tests proving that selecting one group excludes another group's clients from calculated workouts.
- [ ] Test nested accordion behavior: all sections initially closed; each caret changes only its own section.
- [ ] Verify desktop at a normal wide viewport and mobile at 360 px, 390 px, and 414 px widths.
- [ ] Verify client reorder affects only the open group.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm test`.

## Phase 6: Automatic Context Selection and Graduation

### Scope

- [ ] On a new visit, select the time-appropriate active group, then select its current cycle/week/day session.
- [ ] Do not override a coach's manual group selection during the same visit.
- [ ] Provide an explicit control to return to the recommended current group when needed.
- [ ] Change cycle graduation so it operates on the selected group's eligible members and selected group's program only.
- [ ] Confirm that graduating one group cannot alter another group's calendar, templates, or clients.
- [ ] Ensure query/deep-link behavior identifies the group as well as cycle, week, and lift.

### Tests and Verification

- [ ] Add tests for automatic group selection across multiple same-day start times.
- [ ] Add a regression test that manual group selection remains stable.
- [ ] Add a graduation test with clients in two groups, proving only the selected group's clients advance.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm test`.

## Phase 7: Rollout and Acceptance

- [ ] Create the legacy/default group and confirm every existing client is assigned exactly once.
- [ ] Create the new series group with its independent program start date and schedule.
- [ ] Add the first five to eight new clients directly to the new group.
- [ ] Confirm the new group's cycle/week changes do not change the legacy group's workout output.
- [ ] Confirm transfers from `All Clients` persist after a reload and do not duplicate a client in active group rosters.
- [ ] Confirm scheduled automatic selection at each group's start time in the configured timezone.
- [ ] Verify desktop and mobile workflows with a coach: open current group, view a workout, log sets, edit a client, and transfer a client.
- [ ] Record any deferred enhancements separately; do not block initial rollout on multi-group concurrent enrollment or cross-group reporting.

## Final Validation

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `git diff --check`.
- [ ] Review the Firestore data created by the migration and verify active group membership counts against the sidebar.

## Settings And Roster IA Cleanup

### Goal

Make the app's navigation match the data hierarchy:

```text
Training Group
  Group details
  Roster for this group
  Program for this group
    Cycles
    Weeks
    Calendar
    Movement setup
```

### Settings Modal

- [x] Remove `Groups` as a peer tab beside program settings.
- [x] Make `Editing Program For` the first control in the modal.
- [x] Put `Add Group` next to the group selector.
- [x] Show selected group details directly below the selector: name, default, active/archive, timezone, day times, current-cycle start date, weekdays, delete.
- [x] Rename/clarify programming tabs so they read as children of the selected group.
- [x] Keep group details visible while editing Cycles/Weeks/Calendar.
- [x] Ensure changing group details persists only the selected group record.
- [x] Ensure Cycles/Weeks/Calendar changes persist only the selected group's program.
- [ ] Keep global/shared movement library behavior clearly labeled if it remains shared.

### Sidebar

- [x] Keep sidebar as live coaching navigation only.
- [ ] Keep top-level groups and member expansion.
- [x] Remove roster editing controls from sidebar where practical, including Add Client, All Clients, and Inactive Clients.
- [ ] Keep single-click group navigation and double-click group settings shortcut.

### Roster Administration

- [x] Add a Roster section inside Settings scoped to the selected group.
- [ ] Support adding/transferring/removing members from the selected group there.
- [x] Support inactive client management there.
- [ ] Preserve a global All Clients roster management surface for search/assignment/delete.

### Validation

- [ ] Open Settings from a double-clicked group and confirm the selected group details appear immediately.
- [ ] Rename a group and confirm only that group changes.
- [ ] Change selected group calendar/week settings and confirm another group is unchanged.
- [ ] Add a new group and confirm Settings switches to it or clearly prompts selection.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `git diff --check`.