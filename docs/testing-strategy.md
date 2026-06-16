# Testing Strategy — Confiture.live

## 1. Objectif

Ce document définit la stratégie de test de Confiture.live pour une refonte from scratch basée sur l'event-sourcing.

L'objectif principal est de garantir que la jam peut être reconstruite de manière déterministe à partir de :

```text
eventLog + snapshots optionnels -> projection -> tableau affiché
```

La priorité absolue est la fiabilité du moteur de projection. L'UI ne doit jamais être considérée comme terminée si la règle métier correspondante n'est pas couverte par un test unitaire du moteur.

---

## 2. Principes non négociables

### 2.1 La vérité vient de l'event log

La source de vérité durable est :

```text
JamTransaction[]
JamEvent[]
JamSnapshot[] optionnels
```

La projection est recalculable. Les composants React ne doivent jamais devenir la source de vérité métier.

### 2.2 Le moteur de projection doit être pur

Le moteur de projection doit être testable sans :

- React ;
- DOM ;
- backend ;
- IndexedDB ;
- Zustand ;
- TanStack Query.

Signature conceptuelle :

```js
projectJamState({ eventLog, snapshot }) -> projectedJamState
```

À données identiques, le moteur doit toujours produire exactement la même projection.

### 2.3 Les tests doivent être écrits à partir d'events

Les tests ne doivent pas injecter directement un tableau déjà projeté.

Interdit :

```js
const state = { columns: [...] }
```

Attendu :

```js
const eventLog = [
  jam_created,
  instrument_added,
  participant_created,
  participation_added,
]

const projection = projectJamState(eventLog)
```

### 2.4 Toute correction de bug moteur doit ajouter un test de régression

Si un bug concerne :

- l'ordre des cards ;
- les rounds ;
- les links ;
- les conflicts ;
- les holes ;
- le played ;
- le lock ;
- le skip ;
- l'undo ;
- la sync ;

alors la correction doit inclure au moins un test qui reproduit le bug.

---

## 3. Niveaux de priorité

### P0 — Obligatoire avant intégration UI

- moteur de projection ;
- event reducers ;
- round generator ;
- link resolver ;
- conflict resolver ;
- order helpers ;
- undo resolver ;
- validation d'events côté client.

### P1 — Obligatoire avant première V0 utilisable

- sync queue local-first ;
- IndexedDB/Dexie persistence ;
- API backend transactions/events/snapshots ;
- session active unique / lease ;
- drawer participant ;
- drawer d'appel ;
- feedback UX critique : dialogs, snackbar, sync indicator.

### P2 — À faire avant bêta

- UI modes link/conflict ;
- drag vertical ;
- animations de déplacement ;
- responsive tablette ;
- cas d'erreurs API ;
- seeds de démo.

### P3 — Optionnel V0, recommandé ensuite

- tests end-to-end Playwright ;
- tests de performance projection ;
- tests d'accessibilité avancés.

---

## 4. Outils recommandés

### Frontend

```text
Vitest
React Testing Library
@testing-library/jest-dom
```

À utiliser pour :

- tests unitaires du moteur ;
- tests Zustand stores ;
- tests hooks ;
- tests UI ciblés.

### Backend

```text
pytest
pytest-django
```

À utiliser pour :

- modèles Django ;
- endpoints DRF ;
- idempotence ;
- séquences ;
- lease client actif ;
- snapshots.

### E2E optionnel

```text
Playwright
```

À garder optionnel pour V0. Ne pas bloquer la refonte initiale dessus.

---

## 5. Tests unitaires du moteur de projection

Les tests suivants sont obligatoires.

---

### 5.1 Création simple de jam

Input :

```text
jam_created
instrument_added Chant
instrument_added Guitare
participant_created Nicolas
participation_added Nicolas/Guitare
```

Résultat attendu :

```text
- colonne Guitare visible
- Nicolas apparaît dans Guitare round 1
- aucune card jouée
- aucun link
- aucun conflict manuel
```

---

### 5.2 Ordre d'inscription par colonne

Input :

```text
participant_created Nicolas
participation_added Nicolas/Guitare
participant_created Paul
participation_added Paul/Guitare
participant_created Emma
participation_added Emma/Guitare
```

Résultat attendu :

```text
Guitare round 1:
1. Nicolas
2. Paul
3. Emma
```

---

### 5.3 Multi-instruments et conflicts automatiques

Input :

```text
participant_created Nicolas
participation_added Nicolas/Chant
participation_added Nicolas/Guitare
participation_added Nicolas/Basse
conflict_created scope=participation reason=instrument_constraint entre Nicolas/Guitare et Nicolas/Basse
```

Résultat attendu :

```text
- trois participations existent
- les appearances round 1 sont calculables
- le conflict participation-level empêche Guitare et Basse de tomber sur le même plateau
- aucun conflict n'est affiché comme manuel
```

---

### 5.4 Rounds visibles et ajout tardif standard

Input :

```text
round 1 visible par défaut
instrument_round_visibility_changed Guitare visibleRoundCount=2
participant_created Julie
participation_added Julie/Guitare insertionPolicy=end_of_visible_rounds
```

Résultat attendu :

```text
- Julie apparaît à la fin du round 1 Guitare
- Julie apparaît aussi à la fin du round 2 Guitare
- aucune appearance round 3 n'est matérialisée tant que round 3 n'est pas visible
```

---

### 5.5 Ajout entre deux cards dans un round supérieur

Input :

```text
Guitare round 1 visible
Guitare round 2 visible
participant_created Emma
participation_added Emma/Guitare insertedBetween deux cards du round 2
```

Résultat attendu :

```text
- Emma apparaît à partir du round 2 seulement
- aucune appearance rétroactive round 1 n'est créée
- les appearances suivantes du round 2 sont poussées vers le bas
```

---

### 5.6 Appearance materialized

Input :

```text
appearance_materialized pour Nicolas/Guitare round 2
```

Résultat attendu :

```text
- l'appearance reçoit un ID stable
- l'action seule ne change pas sa position
- toute action future peut cibler cet appearanceId
```

---

### 5.7 Link created — move_to_first

Config :

```text
linkReorderStrategy = move_to_first
```

Input :

```text
Nicolas/Guitare/round1 position 3
Sarah/Batterie/round1 position 5
link_created anchor=Nicolas/Guitare targets=[Nicolas/Guitare, Sarah/Batterie]
```

Résultat attendu :

```text
- Sarah remonte au plateau de Nicolas
- les batteurs qui étaient entre les deux sont poussés vers le bas
- Nicolas ne bouge pas
- aucune card played ne bouge
- aucune card locked ne bouge
```

---

### 5.8 Link created — move_to_last

Config :

```text
linkReorderStrategy = move_to_last
```

Input :

```text
Nicolas/Guitare position 3
Sarah/Batterie position 5
link_created
```

Résultat attendu :

```text
- Nicolas descend au plateau de Sarah si possible
- Sarah ne bouge pas
- les cards déplacées sont poussées selon l'ordre stable de colonne
```

---

### 5.9 Link created — average_position

Config :

```text
linkReorderStrategy = average_position
```

Input :

```text
Nicolas/Guitare position 2
Sarah/Batterie position 6
link_created
```

Résultat attendu :

```text
- position cible = moyenne des positions
- en cas d'égalité ou de demi-position, arrondir vers la position la plus haute
- aucune card played/locked ne bouge
```

Exemple :

```text
positions 2 et 5 -> moyenne 3.5 -> cible 3
```

---

### 5.10 Link refusé par conflict

Input :

```text
conflict_created entre A et B
link_created entre A et B
```

Résultat attendu :

```text
- le link est refusé
- la projection reste inchangée
- une erreur métier est retournée pour permettre une snackbar explicative
```

---

### 5.11 Link avec hole

Input :

```text
hole_added Batterie position 3
link_created targets=[Nicolas/Guitare round1, hole Batterie]
```

Résultat attendu :

```text
- le hole et l'appearance musicien restent alignés
- le hole est traité comme une card sans participant
- supprimer le hole ne supprime jamais l'appearance musicien
- supprimer le hole supprime/ignore les links associés au hole
```

---

### 5.12 Conflict appearance-level

Input :

```text
A et B sont sur le même plateau
conflict_created scope=appearance targets=[A, B]
```

Résultat attendu :

```text
- A et B ne sont plus sur le même plateau
- anchor reste stable
- l'autre target est déplacée vers le premier slot suivant valide
- si déplacement impossible, l'action est refusée
```

---

### 5.13 Conflict participation-level

Input :

```text
conflict_created scope=participation targets=[Nicolas/Guitare, Nicolas/Basse]
```

Résultat attendu :

```text
- les appearances des deux participations ne peuvent pas être sur le même plateau
- la contrainte s'applique aux rounds futurs
- elle ne matérialise pas automatiquement toutes les appearances futures
```

---

### 5.14 Hole added

Input :

```text
hole_added Basse entre deux cards du round 1
```

Résultat attendu :

```text
- un hole apparaît à la position ciblée
- les cards suivantes de la colonne sont poussées
- le hole ne génère pas de round futur
- le hole peut être locké, linké, joué ou supprimé
```

---

### 5.15 Hole removed

Input :

```text
hole_removed
```

Résultat attendu :

```text
- seul le hole disparaît
- les cards suivantes remontent visuellement
- aucun participant n'est supprimé
- les links ciblant ce hole sont supprimés/ignorés dans la projection
```

---

### 5.16 Played

Input :

```text
plateau_played plateauIndex=1
```

Résultat attendu :

```text
- toutes les appearances/holes du plateau deviennent played
- elles sont figées
- elles ne peuvent plus être déplacées
- elles restent visibles dans l'historique
- les lignes futures sont recalculées si nécessaire
```

Règle :

```text
played > locked
```

Une card played est immobile même si elle n'est pas explicitement locked.

---

### 5.17 Plateau unplayed

Input :

```text
plateau_unplayed
```

Résultat attendu V0 :

```text
- autorisé uniquement sur le dernier plateau joué
- les cards redeviennent non played
- elles gardent leur position actuelle
```

---

### 5.18 Lock strict

Input :

```text
appearance_locked A
appearance_moved_between A
```

Résultat attendu :

```text
- le déplacement est refusé
- une appearance lockée ne bouge ni manuellement ni automatiquement
- pour déplacer une card lockée, il faut d'abord unlock
```

---

### 5.19 Appearance skipped

Input :

```text
appearance_skipped depuis drawer d'appel
```

Résultat attendu :

```text
- si l'appearance était linkée, le link est retiré/désactivé
- seule l'appearance skippée est repoussée d'un plateau
- aucun état temporarily_away durable n'est stocké
- l'appearance redevient disponible après le report
```

---

### 5.20 Remplacement depuis drawer d'appel

Input :

```text
replacement_selected pour remplacer A par B dans un plateau
```

Résultat attendu :

```text
- B prend la place de A
- A est repoussée au prochain slot disponible
- si A ou B était linkée, le link concerné est retiré/désactivé selon la spec drawer-call
- aucune card played/locked ne bouge sans event explicite
```

---

### 5.21 Plateau sans [instrument manquant] depuis drawer d'appel

Input :

```text
call_drawer_replace_with_hole
```

Résultat attendu :

```text
- l'appearance appelée est remplacée par un hole dans le plateau courant
- l'appearance musicien est repoussée au prochain slot disponible
- le hole peut ensuite être joué avec le plateau
```

---

### 5.22 Participant marqué parti

Input :

```text
participant_marked_left Nicolas
```

Résultat attendu :

```text
- les appearances déjà played restent dans l'historique
- toutes les appearances futures de Nicolas sont retirées de la projection active
- aucune nouvelle appearance future n'est générée pour Nicolas
- les links futurs impliquant Nicolas sont supprimés/ignorés
```

---

### 5.23 Participant removed

Input :

```text
participant_removed Nicolas
```

Résultat attendu :

```text
- autorisé uniquement si Nicolas n'a jamais joué
- sinon refusé et l'UI doit suggérer “Marquer comme parti”
- si autorisé, toutes les participations/appearances futures disparaissent
```

---

### 5.24 Instrument visibility changed

Input :

```text
instrument_visibility_changed Autre visible=false
```

Résultat attendu :

```text
- la colonne Autre n'est plus affichée
- l'instrument n'apparaît plus dans le drawer d'appel
- l'historique et les events sont conservés
- les participations ne sont pas supprimées physiquement
```

---

### 5.25 Undo linéaire

Règle :

```text
Il est impossible d'undo une transaction si des transactions actives plus récentes existent.
```

Input :

```text
tx1 active
tx2 active
tx3 active
transaction_reverted target=tx1
```

Résultat attendu :

```text
- refusé
- il faut d'abord undo tx3 puis tx2
```

Input valide :

```text
transaction_reverted target=tx3
transaction_reverted target=tx2
transaction_reverted target=tx1
```

Résultat attendu :

```text
- l'historique reste complet
- les events revertis ne participent plus à la projection active
```

---

## 6. Tests des event payloads

Chaque event V0 doit avoir un test de validation de payload.

Objectif : éviter que l'UI crée des events incomplets ou ambigus.

À tester pour chaque event :

```text
- type connu
- transactionId présent
- jamId présent
- schemaVersion présent
- ids target présents
- payload minimal valide
- payload invalide refusé
```

Events à couvrir au minimum :

```text
jam_created
jam_updated
jam_link_reorder_strategy_changed
instrument_added
instrument_updated
instrument_visibility_changed
instruments_reordered
participant_created
participant_updated
participant_removed
participant_marked_left
participation_added
participation_removed
appearance_materialized
appearance_moved_between
appearance_locked
appearance_unlocked
appearance_skipped
appearance_removed
link_created
link_removed
conflict_created
conflict_removed
hole_added
hole_removed
hole_moved_between
hole_locked
hole_unlocked
instrument_round_visibility_changed
plateau_played
plateau_unplayed
transaction_reverted
```

---

## 7. Tests de sync local-first

### 7.1 Action offline

Input :

```text
network unavailable
user creates transaction
```

Résultat attendu :

```text
- transaction appliquée localement
- transaction persistée IndexedDB
- transaction marquée pending
- UI reste utilisable
- sync indicator affiche un warning positif
```

---

### 7.2 Retry réussi

Input :

```text
pending transaction exists
network restored
```

Résultat attendu :

```text
- transaction envoyée au backend
- serverSequenceNumber reçu
- transaction marquée synced
- sync indicator redevient synced
```

---

### 7.3 Idempotence

Input :

```text
same transactionId sent twice
```

Résultat attendu :

```text
- backend ne crée pas de doublon
- réponse idempotente
- client marque la transaction comme synced
```

---

### 7.4 Trou de séquence

Input :

```text
server has sequence 12
client sends sequence 14 without 13
```

Résultat attendu :

```text
- backend refuse
- client doit resync/reload
- aucune fusion automatique
```

---

### 7.5 Un seul client actif

Input :

```text
client A détient le lease
client B ouvre la jam
```

Résultat attendu :

```text
- client B voit la jam en lecture seule ou écran de reprise de contrôle
- client B ne peut pas pousser d'events tant qu'il n'a pas repris le lease
```

---

## 8. Tests backend API

À tester avec pytest-django.

### Endpoints obligatoires

```text
GET    /api/jams/
POST   /api/jams/
GET    /api/jams/:jamId/
PATCH  /api/jams/:jamId/
POST   /api/jams/:jamId/transactions/
GET    /api/jams/:jamId/transactions/
GET    /api/jams/:jamId/snapshot/latest/
POST   /api/jams/:jamId/snapshots/
POST   /api/jams/:jamId/client-session/acquire/
POST   /api/jams/:jamId/client-session/heartbeat/
POST   /api/jams/:jamId/client-session/release/
```

### Tests obligatoires

```text
- création jam
- lecture jam
- push transaction valide
- push transaction idempotente
- push transaction avec trou de séquence refusé
- push transaction avec mauvais jamId refusé
- snapshot stocké
- snapshot récupéré
- lease accordé
- lease refusé si déjà actif
- lease expiré reprenable
- heartbeat prolonge le lease
- release libère le lease
```

---

## 9. Tests frontend UI ciblés

### 9.1 Card appearance

Tester :

```text
- nom musicien affiché
- instrument custom affiché si applicable
- bouton link visible
- bouton link état linked/unlinked
- bouton lock/unlock visible
- menu trois-points visible
- card played grisée
- card locked visuellement distincte
```

### 9.2 Card hole

Tester :

```text
- label trou affiché
- bouton lock/unlock visible
- bouton link visible si hole linkable
- menu trois-points limité
- hole played grisé
```

### 9.3 Mode link

Tester :

```text
- clic bouton link active le mode link
- card anchor mise en avant
- cards sélectionnables visibles dans les autres colonnes
- recliquer sur bouton link de l'anchor sort du mode link
- validation crée link_created
- annulation ne crée aucun event
- aucune entrée link dans le menu trois-points
```

### 9.4 Mode conflict

Tester :

```text
- menu trois-points -> créer/retirer conflit active le mode conflict
- validation ouvre dialog de scope
- choix “ce passage seulement” crée scope=appearance
- choix “toute la soirée” crée scope=participation
- suppression conflict possible par désélection
```

### 9.5 Drawer participant

Tester :

```text
- créer participant nom + instruments
- modifier nom
- ajouter instrument à participant existant
- retirer instrument
- erreurs nom vide
- erreurs aucun instrument
- snackbar ajout instrument existant
```

### 9.6 Drawer d'appel

Tester :

```text
- affiche les instruments dans l'ordre du tableau
- affiche musicien ou hole par instrument
- bouton plateau joué
- musicien introuvable ouvre propositions
- trois remplaçants max affichés
- option “Plateau sans [instrument manquant]” affichée
- remplacement crée les bons events
- Plateau sans [instrument manquant] crée hole/remplacement
```

### 9.7 Feedback UX

Tester :

```text
- dialog obligatoire avant suppression appearance
- dialog obligatoire avant suppression hole
- dialog mentionne link si target linkée
- snackbar explicative si link refusé par conflict
- sync indicator positif offline/pending
```

---

## 10. Tests drag & drop

Ne pas essayer de simuler parfaitement dnd-kit dans tous les cas.

Tester plutôt les fonctions et callbacks :

```text
- drag vertical appelle appearance_moved_between
- drag horizontal impossible
- card locked non draggable
- card played non draggable
- hole played non draggable
- groupe linké déplacé selon règle moteur
```

La physique exacte du drag peut être testée manuellement et via quelques tests d'intégration légers.

---

## 11. Tests d'animation

Les animations ne doivent pas rendre les tests fragiles.

À tester uniquement :

```text
- une classe/prop d'animation est appliquée quand une card est déplacée par link/conflict/skip
- les cards ne se téléportent pas dans l'UI finale
```

Ne pas tester au milliseconde près.

Durée attendue :

```text
800 à 1000 ms pour les déplacements de cards
```

---

## 12. Scénarios critiques obligatoires

Ces scénarios doivent exister en tests unitaires moteur et en seed demo.

### Scenario A — Jam simple

```text
Créer jam
Ajouter instruments
Ajouter 8 participants mono-instrument
Projeter tableau
```

### Scenario B — Rounds visibles

```text
Afficher round 2
Ajouter participant standard
Ajouter participant entre deux cards round 2
```

### Scenario C — Link

```text
Créer link entre cards éloignées
Réorganiser selon move_to_first
Afficher snackbar si déplacement
```

### Scenario D — Conflict

```text
Créer conflict entre deux appearances sur même plateau
Déplacer target non-anchor
Refuser si impossible
```

### Scenario E — Hole + play without

```text
Créer hole
Linker avec appearance
Supprimer hole
Vérifier que participant reste
```

### Scenario F — Drawer d'appel

```text
Musicien introuvable
Afficher 3 remplaçants
Choisir remplaçant
Tester Plateau sans [instrument manquant]
```

### Scenario G — Left

```text
Participant joué une fois
Marquer parti
Historique conservé
Futurs passages retirés
```

### Scenario H — Undo

```text
Créer 3 transactions
Undo 3 puis 2 puis 1
Refuser undo 1 directement
```

### Scenario I — Sync offline

```text
Créer action offline
Stocker IndexedDB
Retry après réseau restauré
```

---

## 13. Ce qu'il ne faut pas tester en V0

Ne pas passer trop de temps sur :

```text
- vraie résolution multi-client concurrente
- édition collaborative temps réel
- QR code participant
- auth organisateur avancée
- paiement
- analytics
- emails
- accessibilité complète WCAG niveau AA
- exports PDF/CSV
```

Ces sujets ne sont pas dans la V0 from scratch.

---

## 14. Critère de fin minimal

Une feature est considérée terminée seulement si :

```text
1. les events correspondants existent ;
2. les payloads sont validés ;
3. le moteur projette correctement ;
4. un test unitaire moteur couvre le comportement ;
5. l'UI crée la bonne transaction ;
6. la sync persiste la transaction ;
7. le feedback UX correspond à ux-feedback-spec.md.
```

