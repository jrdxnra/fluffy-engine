# Dev Dashboard Playbook

This document defines the safety rules and working checklist for the new dashboard build.

## Goal

Build and iterate on a new dashboard in a fully isolated dev-only surface, with zero behavior change to the current production dashboard until we explicitly approve release.

## Non-Negotiable Rules

1. Keep production dashboard untouched.
- `src/app/page.tsx` remains the current production entry point.
- No behavior changes to production dashboard without an explicit release decision.

2. Build the new dashboard only under a separate route.
- Dev route: `src/app/dev/dashboard/page.tsx`
- Do not link this route from production navigation.

3. Keep dev dashboard hidden from indexing and casual discovery.
- Add `noindex, nofollow` metadata.
- Gate access with an env toggle: `ENABLE_DEV_DASHBOARD=true`.
- Default behavior is disabled unless explicitly enabled.

4. Isolate new UI code from production UI.
- New components live under `src/components/dev-dashboard/`.
- New helper logic lives under `src/lib/dev-dashboard/`.
- Avoid replacing shared production components until release phase.

5. Additive changes first, replacement later.
- Prefer adding new files over modifying stable production files.
- If shared utilities must change, ensure backward compatibility.

6. Testing is required before any merge.
- Unit tests for new utility logic.
- Manual QA on both routes:
  - Production: `/`
  - Dev dashboard: `/dev/dashboard`
- Confirm no regressions to data loading, actions, or settings updates.

7. Release is a separate, explicit step.
- Do not switch production to the new dashboard until the release checklist is complete.
- Initial release can remain hidden behind a route or flag even after deployment.

## Change Log

- 2026-03-07: Playbook created. Established route isolation and release gates.

## Working Checklist

### Phase 0: Safety Setup

- [x] Create this playbook.
- [x] Create isolated dev-only route.
- [ ] Confirm `ENABLE_DEV_DASHBOARD` defaults to disabled in non-dev environments.
- [ ] Add basic route access note to project docs.

### Phase 1: Baseline Shell

- [ ] Add page skeleton for new dashboard layout.
- [ ] Create `src/components/dev-dashboard/` structure.
- [ ] Wire mock-safe data loading without touching production rendering.

### Phase 2: Feature Migration

- [ ] Migrate header and global controls.
- [ ] Migrate workout table and client interactions.
- [ ] Migrate settings sidebar behavior.
- [ ] Migrate AI insights and supporting dialogs.

### Phase 3: Stabilization

- [ ] Add or update tests for migrated logic.
- [ ] Validate all API interactions used by new dashboard.
- [ ] Run regression pass on production dashboard.
- [ ] Track and close known bugs.

### Phase 4: Hidden Release

- [ ] Deploy with new dashboard still hidden.
- [ ] Internal QA on deployed hidden route.
- [ ] Fix production-only or hosting-specific issues.
- [ ] Approve production switch plan.

### Phase 5: Production Switch

- [ ] Swap production route to new dashboard implementation.
- [ ] Keep rollback path documented.
- [ ] Monitor errors and user feedback.

## Active Issues / Notes

Use this section to log every bug, decision, and follow-up item while we build.

- _No issues logged yet._
