
# Mobile Frontend Redesign Plan

## Non-Negotiable Rule: Desktop Layout Is Untouched

The app is actively in use on desktop and works correctly. All mobile changes must be strictly isolated behind breakpoints.

- Do **not** modify desktop layout, spacing, or behavior.
- Do **not** refactor or restructure shared components in ways that affect `md` and up rendering.
- All mobile-specific layout logic must be gated with responsive classes (e.g., `block md:hidden`, `flex md:flex-row`) or conditional rendering based on screen size.
- If a shared component must change, ensure the desktop render path is byte-for-byte identical in behavior and appearance before and after the change.
- When in doubt, add a new mobile-only subcomponent rather than modifying an existing one.

## Goal
Make core coaching workflows fast and reliable on phones, with the least typing and the fewest taps possible.

## Primary Mobile User Jobs
- Open today’s session quickly.
- Find a client quickly.
- Enter completed set weight and reps quickly.
- Move between clients without losing unsaved input.
- Review notes and copy workout text when needed.

## Design Direction Changes

### 1. Shift from desktop table mindset to mobile task cards
Current UI is table-first and column-dense. Mobile should be card-first and action-first.

What to change:
- Replace small-screen table with per-client session cards.
- Keep the desktop table for md and up.
- Put primary actions (save set data, view notes, copy text) inside each card footer.

Acceptance criteria:
- No horizontal page scrolling at phone widths.
- A coach can edit one client without zooming or side-scrolling.
- Save action is visible without hunting.

### 2. Establish a mobile page frame with sticky utility zones
Current main shell has floating controls and a centered title pattern that will collide on small screens.

What to change:
- Use a mobile header with two rows:
  - Row 1: sidebar/menu trigger, session title, theme toggle in compact icon mode.
  - Row 2: segmented controls for Day/Lift and selected day/lift.
- Add a sticky bottom action bar for high-frequency actions:
  - show/hide warmups
  - bulk log toggle
  - open configuration (admin only)

Acceptance criteria:
- Header controls never overlap title text.
- Important controls remain reachable one-handed.
- Keyboard opening does not hide the active input and save affordance.

### 3. Convert dense modals into mobile sheets/fullscreen dialogs
Long dialogs are currently optimized for desktop width and multi-column content.

What to change:
- Use fullscreen dialog mode below md for profile/config/insight surfaces.
- Replace multi-column content with vertical sections and accordions.
- Keep primary action buttons sticky at the bottom of the dialog.

Acceptance criteria:
- Form and chart sections are readable without pinch zoom.
- Submit and cancel are always visible in long dialogs.
- Dialog content scroll is smooth and does not trap users.

### 4. Increase tap safety and input ergonomics
Some controls and row action targets are too compact for thumbs.

What to change:
- Raise touch target minimum to 44x44 for primary interactive elements.
- Use larger numeric inputs with explicit labels on mobile.
- Keep inline validation directly under each field.
- Use numeric keyboard behavior consistently for set inputs and 1RM fields.

Acceptance criteria:
- Fewer accidental taps on row utilities.
- Faster data entry with fewer corrections.
- Validation errors are obvious and recoverable in place.

### 5. Simplify information hierarchy for live session mode
Mobile needs a short visual hierarchy focused on "what to do now".

What to change:
- Session header should show only: view mode, day/lift, cycle-week label.
- Move advanced controls into collapsible "Session tools" blocks.
- Default collapsed state for secondary data (accessory details, less-used labels).

Acceptance criteria:
- First screen on open shows immediate next action.
- Secondary controls do not crowd first paint.
- Session progress remains visible while scrolling.

## Component-Level Redesign Requirements

### Workout surface
File: src/components/WorkoutTable.tsx
- Add responsive split render:
  - mobile: client cards with stacked set rows
  - desktop: existing table layouts
- Move set editors to clear mobile rows:
  - set label + target
  - weight input
  - reps input
  - save row action
- Keep focus mode behavior, but represent it as card expansion instead of width animations.

### Session shell
File: src/components/SbdohControl.tsx
- Replace absolute centered title with responsive flex layout.
- Convert floating top-right controls into compact icon group in header.
- Add sticky action band for frequent actions on mobile.
- Ensure spacing tokens are mobile-first (larger vertical rhythm, less dense clusters).

### Sidebar/navigation
File: src/components/SettingsSidebar.tsx
- Keep sidebar sheet behavior on mobile, but split into sections:
  - session setup
  - week selection
  - roster
  - admin tools
- Replace tiny reorder arrows with larger list reordering affordances.
- Keep destructive actions separated and visually guarded.

### Add client flow
File: src/components/AddClientSheet.tsx
- Move from grid label layout to stacked label/input blocks on mobile.
- Add sticky submit footer.
- Increase spacing between lift inputs.

### Client profile flow
File: src/components/ClientProfileModal.tsx
- Use fullscreen on mobile.
- Turn tab sections into accordions on small screens.
- Keep save/delete/reset actions in sticky bottom action row.

### Configuration flow
File: src/components/ConfigSettingsDialog.tsx
- Mobile-specific information architecture:
  - cycle management
  - week settings
  - schedule
  - advanced/debug
- Hide debug-heavy sections behind "Advanced" collapse on mobile.
- Break long forms into step-like sections instead of one long mixed screen.

## Global Style and Spacing Changes
File: src/app/globals.css
- Define explicit mobile spacing scale for containers and cards.
- Add utility classes for sticky mobile header and sticky mobile action bar.
- Add safe-area support for bottom bar on iOS devices.

## Prioritized Implementation Sequence
1. Mobile session shell and header behavior.
2. Mobile workout card layout and set input flow.
3. Mobile add/edit client forms and dialog behavior.
4. Sidebar information architecture and tap target pass.
5. Config and chart surfaces.

## Success Metrics
- Coaches can complete a full client logging pass on mobile without horizontal scrolling.
- Median taps per set entry decreases.
- Reduction in input correction rate during live sessions.
- No blocking UI overlap issues at common phone widths (360, 390, 414).
