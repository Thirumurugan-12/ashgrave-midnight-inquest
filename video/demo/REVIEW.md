# Review: Ashgrave how-to-play (storyline A)

Checked against `SPEC.md` with `hyperframes check` (0 errors) and snapshots at the QA times.

| Time | Expected | Seen |
| --- | --- | --- |
| 2.0 | Title screen, rain | ✓ |
| 7.5–9.0 | "Who killed Lady Verity?" over the lantern; orchid card flips | ✓ |
| 14.5 | Chapter I card, slip "Three chapters, clear goals" | ✓ |
| 22 | Glints in the conservatory, slip "Search by lantern" | ✓ |
| 30 | Wrong test fizzles grey, slip "Test it at the lab" | ✓ |
| 38.5 | Letter scraps being placed | ✓ |
| 48.6 | LIE CAUGHT on Dr. Vale, stamp sound on the hit | ✓ |
| 53 / 56 | Ghost hint; the corkboard with red string | ✓ |
| 63.5 | GUILTY stamp, impact sound | ✓ |
| 69 | Mattermost #conservatory, slip "Live in your team chat" | ✓ |
| 76.5 | End card: Ashgrave / The Midnight Inquest | ✓ |

## Found and fixed
- The screencast runs about 1.3% slow against the capture's timing marks, so cuts drifted up to 2.5 s by the end. All media starts are now remapped (`vt()` in `build.py`).
- Hero title animated `letterSpacing` (pixel-snapping stutter); it now uses opacity and scale.
- End-card small print was 24 px, under the 28 px floor; it is now 28 px.
- Sound effects had no lengths and overlapped on one track; each now has a duration and a short fade.

## Known limits
- The audio mix was measured, not listened to.
- Kokoro voice and MusicGen music are free, local tools: good enough for a demo, not studio quality.
- In the Vale and ghost shots, the conversation log behind the action includes lines from an earlier playthrough (the room keeps its history).
