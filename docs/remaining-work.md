# Remaining work toward V0

## Highest priority

1. Continue extracting the remaining page shell/header composition from `frontend/src/features/jams/pages/JamTablePage.jsx` if it grows again. The table rendering, mode bars, participant dialog, call drawer, play-without/conflict/remove dialogs, lease/recovery banners, and table action orchestration have been moved into feature components/hooks following `docs/frontend-architecture.md`.
2. Replace the temporary History API router with `react-router-dom` once dependency installation is available.
3. Install missing V0 frontend dependencies when registry access allows it: `@mui/icons-material`, `@dnd-kit/sortable`, `@hookform/resolvers`, `date-fns`, and `@testing-library/jest-dom`.
4. Add full conflict-resolution UX for divergent local/server histories. Recovery now normalizes server transactions/events, idempotently upserts synced server transactions, removes matching pending entries, rebuilds projection, resumes the pending queue, preserves projected sync state during lease/status updates, stores recovery counts, and surfaces a retryable warning when server changes arrive while local work remains pending.
5. Polish client-session lifecycle UX. The hook now acquires a lease, schedules heartbeats after acquire/takeover, releases on exit, exposes takeover, and switches to read-only when lease acquisition fails.

## Recently addressed highest-priority baseline

- `frontend/src/App.jsx` is no longer the product shell. The application root now lives under `frontend/src/app/`, route selection is isolated in `app/router.jsx`, providers in `app/providers.jsx`, navigation helpers in `shared/utils/navigation.js`, local-first services in `features/jams/services/`, and page/component code under `features/jams/`, `features/table/`, `features/participants/`, and `features/callDrawer/`.
- Dependency installation was retried and remains blocked by registry `403 Forbidden` responses for the dnd-kit packages already required by `package.json`; router/icon/resolver/date/jest-dom installation should be retried when registry policy allows it.
- Local-first recovery baseline is implemented in `recoverJamProjection`, which reads local snapshots, local transactions, backend snapshot/transactions when available, normalizes server events back onto transactions, idempotently updates synced local records, rebuilds projection, updates sync state, surfaces pending/divergence warnings, and resumes pending sync.
- Client-session baseline is implemented in `useJamClientSession`, with acquire, heartbeat scheduling after acquire/takeover, release-on-unmount, takeover, and read-only state.

## Projection and tests

6. Harden link reordering with conflict/lock/played refusal rules and linked-group movement.
7. Harden conflict behavior so conflict wins against link and displacement is deterministic.
8. Add regression tests for every new movement/refusal behavior introduced during link/conflict/drawer-call completion.
9. Add projection tests around replacement flows from the call drawer when linked targets must be delinked.

## Product UI phases

10. Complete jam configuration: instrument rename, reorder, hide confirmations, and polished link strategy feedback.
11. Complete table layout: left plateau action rail, row-level played/unplayed controls, and stronger mobile/tablet horizontal scroll polish.
12. Complete cards: icon buttons, three-dot menus, drag handles, destructive dialogs, and visual states for linked/locked/played/hole.
13. Replace participant dialog with the responsive participant drawer and add full participation removal confirmations.
14. Replace call dialog with the responsive call drawer, 3 replacement suggestions, full “faire sans musicien”, delink confirmations, and sticky “Plateau joué”.
15. Implement dnd-kit vertical drag; keep horizontal drag impossible.
16. Complete link mode with clear selection styling, validation bar, animations, conflict/lock/played refusal snackbars, and max-one-target-per-instrument enforcement.
17. Complete conflict mode with existing-conflict visibility, conflict removal, scope dialog polish, and no conflict on holes.
18. Complete holes and “Jouer sans…” with between-card insertion zones and better confirmation UX.
19. Complete played/unplayed/undo UX with dialogs, snackbar feedback, and guardrails to avoid accidental undo of initial setup.
20. Complete app-wide UX feedback: snackbar provider, central dialogs, all copy from `docs/ux-feedback-spec.md`, and movement/card animations.
21. Complete responsive/accessibility polish for all dialogs/drawers, icon buttons, focus order, contrast, and render performance.

## Demo and audit

22. Add optional frontend demo tools gated by `VITE_ENABLE_DEMO_TOOLS=true`.
23. Run the seeded demo jams through the frontend projection once the frontend can load backend data into IndexedDB automatically.
24. Capture visual screenshots for mobile/tablet once a browser-based screenshot tool is available in the environment.
25. Re-run this audit after the UI is decomposed further and after dnd-kit/router dependencies are installed.

## Latest highest-priority pass

- Table action orchestration moved out of `JamTablePage.jsx` into `useJamTableActions`, and the remaining top-level play-without/conflict/remove dialogs plus lease/recovery banners moved into feature components.
- Recovery now stores a `recoveryWarning` and recovery counts in sync state when server transactions are recovered while local pending transactions remain, and the warning includes a retry action.
- The jam page displays lease acquisition/read-only state and recovery warnings explicitly.

- Sync status updates now merge into existing `syncState` records instead of overwriting projected state during lease heartbeats or pending queue status changes.
