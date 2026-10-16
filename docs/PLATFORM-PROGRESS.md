# Progress by platform

PC game details and console trophy details include the same progress panel.
Each linked version displays its own unlocked count, total and percentage;
there is no combined completion percentage. Unknown totals/counters remain
unknown. Console scan timestamps and retained disconnected snapshots are labelled.

Confirmed Steam/Epic catalogue groups already present in the library are linked
automatically. Console versions and other entries can be associated explicitly
using **Associate another version**. Titles are only used to order/search the
choices; identical names do not automatically merge editions or progress.
Associations work in both directions, including from console game details.

User associations are local to this Orbit renderer profile, stored under
`orbit.game-platform-links.v1` in localStorage. Console nodes include provider,
account ID and title ID. Links through missing/switched account nodes are ignored,
so progress is not silently transferred to a different account. No games,
achievement records, console sessions or upstream catalogue records are modified.
Associations are not cloud-synced.

Malformed/unreadable associations are not overwritten. Manual associations can
be removed only after the user accepts the confirmation in the UI; removing a
link never removes games or achievements. Existing associations from other
windows are re-read before a write, and storage/change events refresh the panel.

Console coverage and authentication requirements remain as documented in
[Console accounts](CONSOLE-ACCOUNTS.md), including the pending Microsoft
application registration and live-account validation. Progress panels use the
existing local snapshots and do not initiate background provider scans.
