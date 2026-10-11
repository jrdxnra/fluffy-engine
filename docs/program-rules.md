# Program Rules — what the site is meant to do

This is the site's own rulebook. It is **based on** Wendler's 5/3/1 (2nd edition) but is **not** an exact copy: sessions have to fit in 60 minutes, so some things are deliberately different. Where the site and the book disagree, **this file wins**. The rules in the "Tested" sections are enforced by `src/lib/program-rules.test.ts`.

## Tested rules

### Training max
- Starting training max = 90% of the 1RM, rounded to the nearest 5 lb.
- Every set weight = training max × the week's percentage, rounded to the nearest 5 lb.

### Week structure

| Week | Warm-up 1 | Warm-up 2 | Work set 1 | Work set 2 | Top set |
|---|---|---|---|---|---|
| Week 1 (5s) | 50% × 5 | 60% × 5 | 65% × 5 | 75% × 5 | 85% × 5+ |
| Week 2 (3s) | 50% × 5 | 60% × 5 | 70% × 3 | 80% × 3 | 90% × 3+ |
| Week 3 (5/3/1) | 50% × 5 | 60% × 5 | 75% × 5 | 85% × 3 | 95% × 1+ |
| Week 4 (deload) | 50% × 5 | 60% × 5 | 40% × 5 | 50% × 5 | 60% × 5 |

- "+" means as many reps as possible. Deload has no "+" set.
- The movement's own training max is used on every week, deload included.

### Graduation
- After a cycle: +5 lb for Bench and Press, +10 lb for Squat and Deadlift (custom movements use their own increment).
- A lift on hold or in calibration does not go up. A lift counts as calibrating only until it has a full cycle of logged history.
- Only movements trained that cycle go up; a swapped-out movement keeps its number.
- A lift slot's training max always equals its movement's.
- A member who fell behind the group lands on the group's next cycle at graduation.

## Deliberate differences from the book

| Topic | The book | This site | Why |
|---|---|---|---|
| Warm-ups | Three sets: 40% × 5, 50% × 5, 60% × 3 | Two sets: 50% × 5, 60% × 5 | Sessions must fit in 60 minutes (decided 2026-10-11). |
| Lowering a training max | Only when a lifter stalls, to 90% of a recent max | Automatically, whenever the training max is above the stored 1RM | Existing behaviour; planned to change — see `future-improvements.md`. |
| Deload on a two-day week | Probably not needed | Every fourth week | Existing programme design. |

## Not covered by tests yet
- Accessories and conditioning per day.
- The calibration ("7s") on-ramp for new lifters and new movements.
- Session modes (recovery, slide, pause week, Jack Shit).
