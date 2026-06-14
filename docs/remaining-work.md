# Remaining work toward V0

## Highest priority

1. Replace the temporary History API router with `react-router-dom` once dependency installation is available.
2. Retry and install the missing V0 frontend dependencies when registry access allows it: `@mui/icons-material`, `@dnd-kit/sortable`, `@hookform/resolvers`, `date-fns`, and `@testing-library/jest-dom`.
3. Keep decomposing the jam page if `frontend/src/features/jams/pages/JamTablePage.jsx` grows again, especially around shell/header composition, table rendering, mode bars, dialogs/drawers, lease/recovery banners, and action orchestration.
4. Complete local-first sync and recovery UX: full conflict-resolution UX for divergent local/server histories, stronger page-level recovery behavior, production-grade retry/status orchestration, and clearer recovery feedback when server changes arrive while local work remains pending.
5. Polish the client-session lifecycle UX: full heartbeat lifecycle management, explicit takeover UI, clearer read-only/lease status, and robust release/reconnect feedback.
6. Add app-wide UX feedback infrastructure: snackbar provider, central dialog handling, exhaustive copy coverage, and consistent confirmation/error feedback across the app.

## App shell, routing, and architecture

7. Replace the current minimal router with a proper `react-router-dom` setup.
8. Finish provider decomposition where still needed, including central snackbar/dialog providers.
9. Strengthen component separation across the app shell, jam page, table, participants, call drawer, sync/session banners, and action orchestration.
10. Add render optimization passes where the current responsive/table UI still risks unnecessary re-renders.

## Local-first sync and client sessions

11. Harden recovery from local snapshots plus server transactions so the app can reliably rebuild the page state after reloads, network interruptions, or divergent histories.
12. Add full conflict-resolution UX for cases where recovered server transactions and unsynced local pending transactions diverge.
13. Improve pending-queue retry/status behavior until it is production-grade and easy to understand from the UI.
14. Complete explicit client-session takeover flows, including clear messaging for read-only mode, takeover success/failure, heartbeat failures, and release-on-exit behavior.
15. Ensure seeded backend demo data can be loaded automatically into IndexedDB and projected by the frontend without manual recovery steps.

## Projection engine and regression tests

16. Harden link reordering with conflict, lock, and played-state refusal rules.
17. Implement deterministic linked-group movement when linked appearances need to move together.
18. Harden conflict behavior so conflicts win against links and any displacement remains deterministic.
19. Complete conflict-aware displacement behavior for link/conflict interactions.
20. Add regression tests for every new movement and refusal behavior introduced during link, conflict, and call-drawer completion.
21. Add projection tests for replacement flows from the call drawer, especially when linked targets must be delinked.
22. Keep invalid projection behavior surfaced through warnings rather than hidden side effects as the advanced movement rules are completed.

## Jam creation and configuration

23. Complete instrument rename UI.
24. Complete instrument reorder UI.
25. Add confirmation dialogs before hiding active instruments.
26. Polish link strategy update feedback and snackbar copy.
27. Complete jam configuration polish around default/custom instruments, metadata updates, and destructive configuration changes.

## Table layout and plateau controls

28. Complete the spec-compliant left plateau action rail.
29. Add row-level played/unplayed controls instead of relying only on minimal header-level actions.
30. Improve mobile/tablet horizontal scroll polish for instrument columns.
31. Complete full table/card movement animations.
32. Keep horizontal drag impossible while supporting the intended vertical movement behavior.

## Cards and card actions

33. Complete spec-compliant card menus and three-dot actions.
34. Replace temporary inline controls with the intended icon buttons where required.
35. Add desktop/mobile drag handles and the final vertical drag gesture layer.
36. Implement `@dnd-kit/sortable` vertical drag once the dependency is available, while keeping movement column-local and disabled for played or locked targets.
37. Complete visual states for linked, locked, played, and hole cards.
38. Add destructive confirmation dialogs for risky card actions.
39. Add stronger card accessibility: icon-button labels, focus order, focus-visible states, touch targets, and contrast.

## Participant drawer

40. Replace the current participant dialog with the responsive participant drawer.
41. Complete the participant drawer layout for create and edit modes.
42. Add full confirmation UX for participation removal.
43. Keep participant creation/edit events aligned with the V0 event model.
44. Complete responsive and full-screen mobile behavior for the participant drawer.

## Call drawer

45. Replace the current call dialog with the responsive call drawer.
46. Add the full call drawer layout with sticky `Plateau joué` behavior.
47. Implement the three replacement suggestions when a musician is unavailable or missing.
48. Complete replacement semantics, including delink confirmations when linked targets are affected.
49. Complete the full `faire sans musicien` flow using V0-compatible `hole_added` plus `link_created` events.
50. Complete call-drawer skip/replacement feedback, confirmations, and snackbar copy.
51. Add full-screen mobile behavior for the call drawer.

## Link mode

52. Complete link mode selection styling.
53. Add a clear validation bar for link mode.
54. Add link mode animations.
55. Enforce max-one-target-per-instrument behavior.
56. Add conflict, lock, and played-state refusal snackbars for invalid link actions.
57. Polish link removal UX and feedback.
58. Keep link creation/removal encoded with V0 event names only.

## Conflict mode

59. Complete conflict mode selection styling and validation UX.
60. Add existing-conflict visibility on relevant cards/appearances.
61. Add conflict removal from the UI.
62. Polish the appearance-vs-participation scope dialog.
63. Prevent conflicts on holes.
64. Add explanatory snackbar feedback when a link is refused because of a contradictory conflict.
65. Keep conflict creation/removal aligned with the V0 event model.

## Holes and “Jouer sans…”

66. Complete between-card insertion zones.
67. Complete hole insertion UX from between-card actions.
68. Complete `Jouer sans...` confirmation UX.
69. Improve confirmation dialogs for hole removal, especially when the hole is linked.
70. Keep `Jouer sans...` modeled as a normal hole linked to the relevant appearance, without adding non-V0 play-without event families.

## Played, unplayed, and undo

71. Complete played/unplayed UX with dialogs, snackbar feedback, and row-level controls.
72. Add guardrails to avoid accidental undo of initial setup or critical actions.
73. Polish global undo feedback and confirmation behavior.
74. Keep undo linear: only the latest active transaction should be revertible.
75. Keep invalid `plateau_unplayed` actions rejected or warned when they target anything other than the most recent played plateau.

## UX feedback, responsiveness, and accessibility

76. Complete all copy and feedback behavior from `docs/ux-feedback-spec.md`.
77. Add the full animation set for card movement and state changes.
78. Complete all confirmation dialogs for destructive or risky actions.
79. Run a contrast audit and fix insufficient contrast.
80. Complete responsive polish for dialogs/drawers, table scrolling, header actions, and mobile/tablet layouts.
81. Complete icon-button accessibility, keyboard focus order, aria labels, and focus-visible behavior.
82. Add performance/render optimization for the final responsive UI.

## Demo tools, screenshots, and final audit

83. Add optional frontend demo tools gated behind `VITE_ENABLE_DEMO_TOOLS=true`.
84. Run seeded demo jams through the frontend projection after automatic backend-to-IndexedDB loading is available.
85. Capture visual screenshots for mobile/tablet once a browser-based screenshot tool is available.
86. Re-run the implementation audit after further UI decomposition and after `dnd-kit`/router dependencies are installed.
87. Re-run backend tests with `pytest` from `backend/` after the remaining backend-facing changes.
88. Re-run frontend tests with `npm test -- --run` from `frontend/` after the remaining frontend changes.
89. Re-run the frontend build with `npm run build` from `frontend/` after the remaining frontend changes.
