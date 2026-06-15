# Remaining work toward V0

## Highest priority

1. Replace the temporary History API router with `react-router-dom` once dependency installation is available. BLOCKED: npm registry returned 403 for `react-router-dom` on 2026-06-14.
2. Retry and install the missing V0 frontend dependencies when registry access allows it: `@mui/icons-material`, `@dnd-kit/sortable`, `@hookform/resolvers`, `date-fns`, and `@testing-library/jest-dom`. BLOCKED: npm registry returned 403 for `@dnd-kit/sortable` and `@hookform/resolvers` during group 1 install attempts on 2026-06-14; no dependency was installed.
3. Keep decomposing the jam page if `frontend/src/features/jams/pages/JamTablePage.jsx` grows again, especially around shell/header composition, table rendering, mode bars, dialogs/drawers, lease/recovery banners, and action orchestration.
4. Complete remaining local-first sync and recovery UX beyond the group 3 hardening: full manual conflict-resolution UX for divergent local/server histories and production polish for recovery decisions.
5. Polish the remaining client-session lifecycle UX beyond the group 3 heartbeat/read-only/takeover/release feedback improvements.
6. Complete remaining UX feedback copy coverage and consistent confirmation/error feedback across the app after the group 2 snackbar provider and common confirmation dialog foundation.

## App shell, routing, and architecture

7. Replace the current minimal router with a proper `react-router-dom` setup. BLOCKED: `react-router-dom` install returned npm registry 403 on 2026-06-14; current History API router remains in place.
8. Finish provider decomposition where still needed beyond the group 2 central snackbar/dialog providers.
9. Strengthen component separation across the app shell, jam page, table, participants, call drawer, sync/session banners, and action orchestration.
10. Add render optimization passes where the current responsive/table UI still risks unnecessary re-renders.

## Local-first sync and client sessions

11. Complete manual recovery resolution for divergent histories after the group 3 local snapshot + server transaction recovery hardening.
12. Add full manual conflict-resolution UX for cases where recovered server transactions and unsynced local pending transactions diverge; group 3 now surfaces divergence and blocks/retries pending sync with explicit messaging.
13. Continue pending-queue production polish after group 3 retry status, backoff, readable errors, and divergence blocking improvements.
14. Continue client-session polish after group 3 heartbeat, read-only, takeover success/failure, heartbeat failure, and release-on-exit feedback improvements.
15. Verify seeded backend demo data loading in a browser after group 3 added automatic backend jam hydration into IndexedDB/projection from the local jams query.

## Projection engine and regression tests

16. Continue polishing advanced link reordering after group 4 added conflict, lock, played-state, missing-target, and duplicate-instrument refusal warnings.
17. Continue UI integration for deterministic linked-group movement after group 4 made projection move linked groups from the latest moved target.
18. Continue conflict/link polish after group 4 made conflicts win against links in projection with warnings.
19. Complete remaining advanced conflict-aware displacement behavior for link/conflict interactions beyond group 4 link refusal and linked-group alignment.
20. Add future regression tests for movement/refusal behavior introduced by later link, conflict, and call-drawer UI groups; group 4 projection regressions were added.
21. Add future projection tests for additional replacement flows from the final call drawer; group 4 covers forced delink on replacement skip.
22. Keep invalid projection behavior surfaced through warnings as remaining advanced movement/displacement rules are completed; group 4 added link refusal warnings.

## Jam creation and configuration

23. Verify final jam configuration UX in browser after group 5 added instrument rename, reorder, active-hide confirmations, link strategy copy, custom instruments, and metadata feedback.
24. Continue any later destructive configuration polish discovered during responsive/accessibility audit.

## Table layout and plateau controls

28. Verify table rail and row-level played/unplayed UX in browser after group 6 added the sticky left plateau rail and row controls.
29. Continue animation polish in later UI groups after group 6 added card/rail transition prep.
30. Continue mobile/tablet table scroll polish if browser audit finds issues; group 6 improved horizontal column scrolling while keeping horizontal drag impossible.

## Cards and card actions

33. Verify final card menu/icon-button UX in browser after group 7 added three-dot menus, direct link/lock icon buttons, vertical move handles, and stronger visual states/accessibility.
34. Implement `@dnd-kit/sortable` vertical drag once the dependency is available, while keeping movement column-local and disabled for played or locked targets. BLOCKED: npm registry returned 403 for `@dnd-kit/sortable` during group 7 retry on 2026-06-14.
35. Replace unicode fallback icons with `@mui/icons-material` once available. BLOCKED: install attempt was blocked by the same npm registry 403 before `@mui/icons-material` could be added.
36. Continue destructive confirmation polish in later groups; card removal still routes through the existing RemoveTargetDialog confirmation.

## Participant drawer

40. Verify participant drawer create/edit/removal UX in browser after group 8 replaced the dialog with a responsive drawer and confirmation flow.
41. Continue later participant drawer polish discovered during responsive/accessibility audit; V0 event alignment is preserved.

## Call drawer

45. Verify call drawer replacement/faire-sans UX in browser after group 9 replaced the dialog with a responsive drawer, sticky `Plateau joué`, suggestions, delink confirmations, and feedback.
46. Continue final call-drawer replacement polish in later audit; group 9 uses V0-compatible events and avoids `play_without` event families.

## Link mode

52. Verify link mode styling/validation UX in browser after group 10 added the sticky validation bar, selection copy, refusal snackbars, and max-one-target-per-instrument handling.
53. Continue link mode animation polish in later visual audit; group 10 added transition prep and kept V0 link event names only.
54. Continue link removal polish if browser audit finds issues; current removal still uses `link_removed` with snackbar feedback.

## Conflict mode

59. Verify conflict mode styling, validation, removal, hole-refusal, and scope dialog UX in browser after group 11 added the UI wiring and V0 `conflict_created`/`conflict_removed` flows.
60. Continue later conflict-mode visual polish if browser audit finds issues; existing conflicts are now surfaced on cards and contradictory conflict link refusals already use snackbar feedback.

## Holes and “Jouer sans…”

66. Verify hole insertion zones, linked-hole removal confirmation, and `Jouer sans...` confirmation copy in browser after group 12 added the UI wiring.
67. Continue visual polish for hole insertion/removal animations in the later animation/accessibility audit; `Jouer sans...` remains modeled with `hole_added` + `link_created` only.

## Played, unplayed, and undo

71. Verify played/unplayed confirmation UX and global undo guardrails in browser after group 13 added dialogs, critical-action warnings, setup undo refusal, and snackbar feedback.
72. Continue later animation/accessibility polish for played/unplayed/undo state changes; undo remains linear and invalid `plateau_unplayed` still warns outside the latest played plateau.

## UX feedback, responsiveness, and accessibility

76. Verify responsive/accessibility polish in browser after group 14 added theme-level focus/touch-target defaults, reduced-motion handling, drawer/dialog sizing, table scroll region labels, insertion/plateau aria labels, and memoized table/card rendering.
77. Continue final visual audit for full movement animations, contrast edge cases, and any remaining destructive confirmations; no browser screenshot tool is available in this environment.

## Demo tools, screenshots, and final audit

83. Verify optional demo tools in a browser with `VITE_ENABLE_DEMO_TOOLS=true`; group 15 added the gated local demo panel and verified backend demo seed projection through the frontend projection engine.
84. Capture visual screenshots for mobile/tablet once a browser-based screenshot tool is available. BLOCKED: no browser screenshot tool is available in this environment.
85. Re-run the implementation audit after `react-router-dom`, `@dnd-kit/sortable`, and `@mui/icons-material` are installable. BLOCKED: npm registry returned 403 during the dependency install attempts documented above.
