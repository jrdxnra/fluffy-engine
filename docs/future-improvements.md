# Future Improvements

Ideas that are agreed in principle but parked. Nothing here is being worked on until it is picked up on purpose.

## Stall and reset (replace the automatic lowering)

- **Today:** if a training max is higher than the lifter's stored 1RM, the site quietly uses 90% of that 1RM instead. The stored 1RM does not update during normal cycles while the training max goes up every cycle, so this kicks in after a few cycles (around cycle 4 for a squat) whether or not the lifter is struggling.
- **What the book does:** keep going up every cycle until the lifter can't hit the prescribed reps. Then reset **only that lift** to 90% of a recent max (a 1RM or a rep-max estimate) and build up again. Expect 5–7 cycles before a stall.
- **Proposed:**
  1. Flag a stall when a lifter misses the prescribed reps on a top set.
  2. On a stall, suggest a reset to 90% of their best recent lift, for the coach to accept or not.
  3. Remove the automatic lowering.
- **Order matters:** some lifters currently have training maxes above what they are actually lifting. Their numbers must be corrected first; removing the check before that would raise their weights.

## Smaller parked items

- **"Reset training max from recent performance" button** only updates the old lift-slot number, which movement profiles override, and it mixes history from different movements in the same slot. Replace it with the per-lift "update from a logged set" flag (added 2026-10-11) or remove it.

- **"Jack Shit" mode** hides the warm-up sets as well as the accessories; the book means main lift only, warm-ups included. Decide which is wanted.
- **Mobile view** skips the deload and week-name repair for ungrouped clients (see troubleshooting log, issue 6).
- **Old shared program copied onto every client record** — stale baggage; stop writing it (troubleshooting log, cleanup 3).
- **Maintenance and debug routes** — several have no on/off switch; review which are still needed.
- **AI insights key** — the build deployed from the current machine has no key, so the AI insights button may not work on the live site.
- **`Log all Reps` / `Save all Reps`** — hidden in the UI; decide whether to restore or remove (from `blueprint.md`).

## Coaching screen ideas (from the 2026-10-11 UI review)

- **Sidebar controls:** week options need a double-click, and How To / 1RM Calc / Settings are small text links at the bottom. Give each week tab a visible "more" control and make the footer links proper buttons.
- **Phone view:** nine lifters across two lifts is a long scroll. Add a row of lifter initials to jump to someone; the bottom bar has room.
- **Analytics page:** it opens on the previous cycle, lists inactive lifters, and its "Hold advised" / "Plateau watch" calls never reach the coaching screen. Feed them into the status line under each name.
- **Hidden analytics button:** an invisible button in the top-right corner of the coaching screen opens analytics. Replace it with a visible link.
