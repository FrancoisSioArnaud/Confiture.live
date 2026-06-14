# implementation-plan.md — Plan de développement from scratch

## 1. Objectif

Ce fichier donne l'ordre recommandé pour développer Confiture.live from scratch à partir d'un repo contenant uniquement `docs/`.

Codex doit suivre cet ordre sauf raison technique forte. Le but est d'éviter de construire l'UI avant le moteur métier, ou de créer une architecture difficile à tester.

---

## 2. Principe général

Le développement doit suivre cette logique :

```text
Specs
→ data model
→ event payloads
→ projection engine pur
→ tests moteur
→ backend sync
→ frontend local-first
→ UI tableau
→ drawers
→ feedback UX
→ seeds
```

La source de vérité est l'eventLog.
La projection est calculée.
L'UI affiche la projection.

---

## 3. Phase 0 — Préparation du repo

### Objectif

Créer la structure initiale du projet sans implémenter encore de logique métier complexe.

### À faire

- Créer `AGENTS.md`, `implementation-plan.md`, `repo-structure.md` à la racine si absents.
- Créer l'arborescence `backend/` et `frontend/`.
- Ajouter `.gitignore` racine.
- Ajouter `README.md` minimal.
- Ajouter `.env.example` backend/frontend.
- Vérifier que tous les fichiers docs sont dans `docs/`.

### Critère terminé

Le repo a une structure claire et peut accueillir le backend et le frontend.

---

## 4. Phase 1 — Backend minimal Django/DRF

### Objectif

Créer le backend event-sourcing minimal, sans projection serveur complète.

### À lire avant

- `docs/technical-stack.md`
- `docs/data_model.md`
- `docs/backend-api-contract.md`
- `docs/sync_strategy.md`

### À faire

- Initialiser Django dans `backend/`.
- Créer l'app `jams`.
- Configurer DRF et CORS.
- Configurer base dev.
- Créer modèles :
  - `Jam`
  - `JamTransaction`
  - `JamEvent`
  - `JamSnapshot`
  - `JamClientSession`
- Ajouter migrations.
- Ajouter serializers.
- Ajouter endpoints principaux :
  - liste jams ;
  - détail jam ;
  - création jam ;
  - update métadonnées jam ;
  - push transactions ;
  - récupération eventLog ;
  - récupération snapshot ;
  - lease client actif.

### Critère terminé

Les tests backend basiques passent et les endpoints peuvent stocker/récupérer transactions/events/snapshots.

---

## 5. Phase 2 — Event payloads et validation légère

### Objectif

Implémenter une validation légère des transactions/events côté backend et des helpers communs côté frontend.

### À lire avant

- `docs/event-payloads-reference.md`
- `docs/confiture_event_actions_spec.md`

### À faire

- Définir les constantes de types d'events.
- Valider :
  - `jamId` ;
  - `transactionId` ;
  - `clientSequenceNumber` ;
  - `schemaVersion` ;
  - `type` autorisé ;
  - payload JSON objet ;
  - ordre de séquence sans trou.
- Gérer idempotence des transactions.
- Refuser les transactions si le client n'a pas le lease actif.

### Critère terminé

Le serveur refuse les séquences invalides et accepte les transactions valides.

---

## 6. Phase 3 — Projection engine pur

### Objectif

Créer le cœur métier testable indépendamment de React et du backend.

### À lire avant

- `docs/projection-engine-spec.md`
- `docs/confiture_event_actions_spec.md`
- `docs/event-payloads-reference.md`

### Emplacement recommandé

```text
frontend/src/features/projection/
```

### À faire

Créer modules purs :

- `projectJamState.js`
- `applyTransaction.js`
- `applyEvent.js`
- `rounds.js`
- `ordering.js`
- `links.js`
- `conflicts.js`
- `undo.js`
- `selectors.js`

### Règles

- Pas de React.
- Pas de MUI.
- Pas de Dexie.
- Pas d'appel API.
- Entrée/sortie JSON simple.

### Critère terminé

Le moteur peut produire un `projectedJamState` déterministe depuis un eventLog.

---

## 7. Phase 4 — Tests du moteur de projection

### Objectif

Sécuriser le cœur du produit avant de créer l'UI.

### À lire avant

- `docs/testing-strategy.md`
- `docs/seed-demo-data.md`

### À faire

Créer tests Vitest pour :

- création jam ;
- instruments ;
- participant/participation ;
- appearances calculées/matérialisées ;
- reveal rounds ;
- ajout dans round 1 / round 2 ;
- links avec stratégies `move_to_first`, `move_to_last`, `average_position` ;
- conflicts participation/appearance ;
- holes ;
- play without = hole + link ;
- lock/unlock ;
- played ;
- appearance_skipped ;
- participant left ;
- instrument visibility ;
- undo linéaire.

### Critère terminé

Les tests P0/P1 de `testing-strategy.md` passent.

---

## 8. Phase 5 — Frontend setup local-first

### Objectif

Initialiser le frontend et le stockage local.

### À lire avant

- `docs/frontend-architecture.md`
- `docs/sync_strategy.md`
- `docs/technical-stack.md`

### À faire

- Initialiser React + Vite.
- Installer MUI, Zustand, TanStack Query, Dexie, dnd-kit, React Hook Form, Zod, date-fns.
- Créer routing :
  - `/`
  - `/jams/new`
  - `/jams/:jamId`
- Créer store Zustand jam courant.
- Créer Dexie schema :
  - jams cache ;
  - transactions ;
  - events ;
  - snapshots ;
  - sync state ;
  - pending queue.
- Créer sync queue.
- Créer indicateur sync discret.

### Critère terminé

Une transaction locale peut être créée, persistée IndexedDB, projetée, puis poussée au backend.

---

## 9. Phase 6 — API client frontend

### Objectif

Créer l'interface frontend/backend.

### À lire avant

- `docs/backend-api-contract.md`
- `docs/sync_strategy.md`

### À faire

Créer :

- `frontend/src/shared/api/httpClient.js`
- `frontend/src/shared/api/jamsApi.js`
- `frontend/src/features/sync/syncQueue.js`
- `frontend/src/features/sync/localDb.js`

Gérer :

- retries ;
- offline ;
- transactions pending ;
- lease actif ;
- conflit de session ;
- resync au chargement.

### Critère terminé

Le front peut charger une jam, prendre un lease, rejouer l'eventLog et pousser des transactions.

---

## 10. Phase 7 — Liste des jams et création/édition jam

### Objectif

Créer le premier parcours utilisable.

### À lire avant

- `docs/product-spec.md`
- `docs/drawer-participant-spec.md` pour cohérence de formulaires
- `docs/ux-feedback-spec.md`

### À faire

- Page liste jams.
- Card jam avec bouton ouvrir et bouton supprimer si prévu.
- Création jam.
- Edition jam/configuration :
  - nom ;
  - date indicative ;
  - instruments ;
  - ordre instruments ;
  - visibilité instruments ;
  - `linkReorderStrategy`.

### Critère terminé

L'utilisateur peut créer une jam et arriver sur la page tableau.

---

## 11. Phase 8 — Rendu du tableau

### Objectif

Afficher la projection sous forme de colonnes/cards.

### À lire avant

- `docs/visual_spec_table.md`
- `docs/visual_spec_table_cards.md`
- `docs/projection-engine-spec.md`

### À faire

- Créer layout tableau mobile/tablette.
- Afficher colonnes instruments visibles.
- Afficher rounds visibles par colonne.
- Afficher appearances/hole cards.
- Afficher actions de plateau.
- Afficher bouton “afficher round suivant”.
- Afficher zones d'insertion entre cards.

### Critère terminé

Le tableau reflète uniquement la projection, sans logique métier cachée dans les composants.

---

## 12. Phase 9 — Cards et actions simples

### Objectif

Rendre les cards interactives.

### À lire avant

- `docs/visual_spec_table_cards.md`
- `docs/ux-feedback-spec.md`

### À faire

- Appearance card.
- Hole card.
- Bouton link état lié/non lié.
- Lock/unlock.
- Menu trois-points.
- Drag vertical.
- Suppression appearance/hole avec Dialog.
- Animations de déplacement/retrait/apparition.

### Critère terminé

Les interactions simples produisent des transactions/events et mettent à jour la projection.

---

## 13. Phase 10 — Drawer participant

### Objectif

Créer et éditer les participants.

### À lire avant

- `docs/drawer-participant-spec.md`
- `docs/event-payloads-reference.md`

### À faire

- Drawer création participant.
- Drawer édition participant.
- Modifier nom.
- Ajouter/retirer instruments.
- Gérer instrument “Autre”.
- Créer participations/appearances selon rounds visibles.
- Créer conflicts automatiques `instrument_constraint`.

### Critère terminé

Le drawer participant ne contient pas de gestion link/conflict avancée hors règles validées.

---

## 14. Phase 11 — Mode link

### Objectif

Créer/supprimer des links depuis le tableau.

### À lire avant

- `docs/confiture_event_actions_spec.md`
- `docs/visual_spec_table.md`
- `docs/visual_spec_table_cards.md`
- `docs/projection-engine-spec.md`

### À faire

- Entrer en mode link depuis bouton link card.
- Anchor card.
- Sélection/désélection targets.
- Sortie en recliquant link anchor.
- Validation explicite.
- Appliquer stratégie jam :
  - `move_to_first`
  - `move_to_last`
  - `average_position`
- Snackbar si déplacement.
- Animation cards déplacées.

### Critère terminé

Links fonctionnels, testés côté projection et visibles côté UI.

---

## 15. Phase 12 — Mode conflict

### Objectif

Créer/supprimer des conflicts depuis le tableau.

### À lire avant

- `docs/confiture_event_actions_spec.md`
- `docs/ux-feedback-spec.md`

### À faire

- Entrer en mode conflict depuis menu card.
- Sélection/désélection targets.
- Dialog scope : passage seulement / en général.
- Créer conflict `appearance` ou `participation`.
- Supprimer conflict existant.
- Snackbar explicative si link refusé par conflict.

### Critère terminé

Conflict mode sans drawer, sans `conflict_updated`.

---

## 16. Phase 13 — Drawer d'appel

### Objectif

Gérer le plateau live.

### À lire avant

- `docs/drawer-call-spec.md`
- `docs/ux-feedback-spec.md`

### À faire

- Ouvrir drawer depuis action plateau.
- Afficher instruments dans ordre jam.
- Afficher musicians/holes du plateau.
- Marquer plateau joué.
- Musician introuvable :
  - proposer 3 remplaçants ;
  - proposer “faire sans musicien” ;
  - remplacer appearance ;
  - ou créer hole ;
  - déclencher `appearance_skipped` pour la card absente ;
  - delink puis repousser seulement cette appearance si nécessaire.

### Critère terminé

Le drawer d'appel couvre les cas réels sans créer d'état temporairement absent durable.

---

## 17. Phase 14 — Feedback UX

### Objectif

Ajouter les feedbacks selon les règles produit.

### À lire avant

- `docs/ux-feedback-spec.md`

### À faire

- Snackbar.
- Dialog confirmations.
- Animations déplacement cards.
- Feedback sync positif/discret.
- Warnings non bloquants sauf confirmations obligatoires.

### Critère terminé

Les actions importantes ont le bon niveau de feedback : silent, snackbar, dialog, animation.

---

## 18. Phase 15 — Seeds demo

### Objectif

Créer des données utiles pour dev/test visuel.

### À lire avant

- `docs/seed-demo-data.md`

### À faire

- Commande Django `seed_demo_jams`.
- `--reset`.
- `--only <seed>`.
- Seeds sous forme de transactions/events, pas d'état projeté injecté.

### Critère terminé

Les jams de démo permettent de vérifier visuellement les cas complexes.

---

## 19. Phase 16 — Polish responsive et robustesse

### Objectif

Finaliser la V0 exploitable.

### À faire

- Optimiser mobile/tablette.
- Vérifier scroll horizontal/vertical.
- Vérifier mode offline.
- Vérifier lease expirée/reprise contrôle.
- Vérifier build prod.
- Vérifier tests.

### Critère terminé

L'application est utilisable pour une jam réelle de test.

---

## 20. Ordre de priorité si temps limité

Si le chantier est trop large, prioriser :

1. backend event storage ;
2. projection engine ;
3. tests moteur ;
4. frontend local projection ;
5. tableau read-only ;
6. ajout participant ;
7. plateau joué ;
8. link mode ;
9. drawer d'appel ;
10. sync robuste.

Ne pas sacrifier le moteur de projection pour accélérer l'UI.
