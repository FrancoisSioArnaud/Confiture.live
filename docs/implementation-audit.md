# Implementation audit — 2026-06-14

This audit compares the current codebase against the V0 specs after the phase-by-phase baseline implementation. The product is now event-sourced end-to-end at a minimal level, but many UI phases remain deliberately partial rather than polished.

## Conforme

### Event types and event store

- Backend and frontend event allow-lists use the V0 event names and explicitly reject known legacy/non-V0 names.
- The backend source of truth remains the event store: `Jam`, `JamTransaction`, `JamEvent`, plus snapshots and client sessions. No Participant/Participation/Appearance tables were added as durable business truth.
- Demo seeds are written as `JamTransaction`/`JamEvent` streams only; no projected table state is seeded.

### Projection engine

- The projection engine is a pure frontend module with no React, DOM, API, Dexie, or MUI dependency.
- `projectJamState` accepts transactions/events and an optional snapshot, normalizes transaction order, precomputes linear undo, applies events, then builds deterministic columns and plateaus.
- Unsupported or invalid projection behavior is surfaced through `projectionWarnings` / `debugWarnings` instead of hidden side effects.
- Linear undo rejects non-latest transaction reverts; `plateau_unplayed` rejects non-last played plateau attempts.

### Backend API baseline

- Backend exposes the V0 contract baseline for health, jams, transactions, snapshots, and client-session lease endpoints.
- Transactions validate `jamId`, event type allow-list, `schemaVersion`, `clientId`, unique transaction ids, and strict client sequence numbers.
- Client-session acquire, heartbeat, release, and takeover endpoints exist with lease-token checks.

### Tests and demo data

- Backend tests cover transaction creation/validation, legacy event rejection, V0 event acceptance, snapshots, sessions, and demo seed command behavior.
- Frontend Vitest tests cover projection creation, V0 event names, linear undo, locks, played/unplayed, links, holes, conflicts, participant-left, instrument visibility, and Phase 3 scenarios.
- `seed_demo_jams` supports `--reset` and `--only simple|rounds|links|multi|complex|sync`.

## Partiellement conforme

### Local-first sync

- Dexie stores exist for local jams, transactions, pending queue, snapshots, sync state, and client sessions.
- A transaction factory and sync queue baseline exist, and UI actions persist local transactions before projection refresh.
- Missing: robust page-level recovery from local snapshot + server transactions, full heartbeat lifecycle management, explicit takeover UI, and production-grade retry/status orchestration.

### Frontend shell and routing

- The app has `/`, `/jams/new`, and `/jams/:jamId` route behavior through a minimal History API router.
- Missing: replacement with `react-router-dom`, full provider decomposition, central dialog/snackbar providers, and stronger component separation.

### Jam creation/configuration

- Jam creation, default instruments, custom instrument entry, metadata update, instrument add/hide, and link strategy update exist in minimal form.
- Missing: instrument rename/reorder UI, confirmation dialog for hiding active instruments, and complete snackbar copy coverage.

### Table and cards

- The table displays projected instrument columns, projected cards/holes, hidden instruments, empty state, horizontal scrolling, reveal next round, and counters.
- Cards display participant/hole labels plus played/locked/linked states and inline action buttons.
- Missing: spec-compliant card menus, icon buttons, desktop/mobile drag gestures, row action rail, full card animations, and complete responsive polish.

### Drawers/dialogs

- Participant creation/edit and call drawer behavior are covered by dialogs rather than full responsive drawers.
- Participant dialog emits `participant_created`, `participant_updated`, `participation_added`, `participation_removed`, and automatic instrument conflicts.
- Call dialog supports plateau played and “faire sans musicien” baseline.
- Missing: full drawer layouts, replacement suggestions, richer confirmations, full-screen mobile behavior, and complete drawer-call replacement semantics.

### Link/conflict/holes/played/undo

- Basic link mode is triggered from card link buttons and emits `link_created` / `link_removed`.
- Basic conflict mode emits `conflict_created` with appearance/participation scope selection.
- “Jouer sans” emits `hole_added` + `link_created`, without non-V0 play-without events.
- Played/unplayed and global undo are available as minimal header actions.
- Missing: conflict-aware displacement, linked-group movement, visual existing-conflict indicators, removal of conflicts from UI, animations, and polished refusal feedback.

### UX feedback and responsive polish

- Jam-page snackbar queue covers primary actions; some destructive actions already use dialogs.
- Jam page has a minimal responsive/accessibility pass with wrapping header actions, touch-friendly horizontal scrolling, focus-visible cards, and aria labels.
- Missing: app-wide feedback provider, exhaustive UX copy, all confirmation dialogs, full animation set, contrast audit, and render optimization.

## Non conforme / reporté

- `react-router-dom`, `@mui/icons-material`, `@dnd-kit/sortable`, `@hookform/resolvers`, `date-fns`, and `@testing-library/jest-dom` were not installed because dependency installation was previously blocked; the current implementation uses already available packages and fallbacks.
- Drag vertical is implemented as deterministic up/down move controls, not dnd-kit pointer/long-press drag.
- Drawer participant and drawer d'appel are dialogs, not spec-compliant responsive drawers.
- No frontend dev-only demo tools behind `VITE_ENABLE_DEMO_TOOLS=true` yet.
- No final visual screenshot was captured in this environment for the responsive polish pass.

## Final validation run

- Backend tests: `pytest` from `backend/`.
- Frontend tests: `npm test -- --run` from `frontend/`.
- Frontend build: `npm run build` from `frontend/`.
