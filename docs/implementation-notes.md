# Implementation notes

- Le moteur de projection V0 matérialise seulement le round 1 calculé par défaut pour chaque participation active. Les rounds futurs sont ajoutés progressivement via des events qui ciblent explicitement des appearances.
- Le backend effectue une validation légère conforme V0 et ne reconstruit pas la projection métier lors d'un push de transaction.

## 2026-06-14 — Phase 1 event type alignment

Aligned backend and frontend event type allow-lists with the V0 names from `docs/event-payloads-reference.md` and `docs/confiture_event_actions_spec.md`.
Legacy names such as `jam_metadata_updated`, `participant_left`, `appearance_reordered`, `appearance_deleted`, `hole_reordered`, `lock_added`, and `lock_removed` are intentionally rejected instead of translated at validation time so new transactions cannot persist non-spec events. Locks are represented by target-specific events (`appearance_locked` / `appearance_unlocked` and `hole_locked` / `hole_unlocked`). Non-V0 event families including play-without, link/conflict updates, and notes remain unsupported; “jouer sans” must be encoded with `hole_added` plus `link_created`.

## 2026-06-14 — Phase 2 projection engine baseline

The projection engine now normalizes transactions/events into ordered transaction records before applying events. Linear undo is precomputed from transaction order so only the latest active transaction can be reverted; invalid or non-linear undo events are preserved as `projectionWarnings`. Calculated appearances are generated deterministically per active participation and per instrument `visibleRoundCount`; materialized appearances override the matching calculated participation/round pair. This remains a V0 baseline: advanced link/conflict-driven reordering is exposed through pure helpers and state flags, while full automatic displacement policies are deferred to the later dedicated link/conflict phases.

## 2026-06-14 — Phase 6 routing dependency fallback

Installing the optional routing/icon/date helper packages requested for the app shell was blocked by the npm registry returning 403 for existing dependency resolution. To keep the phase moving without adding unverified dependencies, the current shell uses a minimal History API router in `App.jsx`, MUI components already present in the project, and the local-first Dexie projection cache. This should be replaced with `react-router-dom` once dependency installation is available.


## 2026-06-14 — Phase 11 drag fallback

The requested `@dnd-kit/sortable` dependency is still unavailable in this environment, so Phase 11 is implemented as deterministic vertical move controls on cards rather than pointer drag. The controls emit the same V0 movement events (`appearance_moved_between` / `hole_moved_between`), remain column-local, and are disabled for played or locked targets. This preserves the event-sourcing contract while leaving the gesture layer for a later dependency-enabled pass.

## 2026-06-14 — Phase 16 played/unplayed and undo baseline

Phase 16 is implemented as a minimal deterministic baseline. `plateau_unplayed` is accepted only for the most recent played plateau in projection; older plateau unplay events are ignored with a `projectionWarnings` entry. The current UI exposes header actions for unplaying the latest plateau and for global undo, and global undo emits `transaction_reverted` targeting the latest active transaction only. Rich confirmation dialogs, row-level plateau controls, and snackbar/animation feedback remain in the UX phase.

## 2026-06-14 — Phase 17 feedback baseline

Phase 17 is covered by a minimal jam-page snackbar queue. The current baseline shows positive confirmations for primary table actions such as link creation/removal, conflict creation, play-without, call-drawer skip, played/unplayed, undo, lock/unlock, and removal. The full V0 feedback system still needs an app-wide provider, exhaustive copy coverage, richer confirmation dialogs for risky actions, and card movement/state animations.

## 2026-06-14 — Phase 18 demo seeds baseline

Phase 18 adds the `seed_demo_jams` Django command with `--reset` and `--only` support for `simple`, `rounds`, `links`, `multi`, `complex`, and `sync`. The command writes only `Jam`, `JamTransaction`, and `JamEvent` rows using deterministic demo IDs. It intentionally does not create projected table state; any table view must still come from the projection engine.

## 2026-06-14 — Phase 19 responsive polish baseline

Phase 19 is covered by a minimal responsive/accessibility pass on the current jam page. Header actions wrap on small screens, instrument columns use touch-friendly horizontal scrolling with scroll snap, cards expose focus-visible styling and group labels, and key card buttons have larger touch targets plus aria labels. Full mobile drawer layouts, complete icon-button accessibility, and render optimization remain pending.
