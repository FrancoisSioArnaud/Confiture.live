# Frontend Architecture — Confiture.live

## 1. Objectif

Ce fichier cadre l’architecture frontend à suivre pour redévelopper Confiture.live from scratch.

Le frontend doit être :

- mobile-first ;
- tablette-compatible ;
- local-first ;
- fondé sur un eventLog ;
- capable de reconstruire le tableau via un moteur pur ;
- utilisable pendant une jam avec réseau instable ;
- strictement cohérent avec les specs produit, data model, sync et visuelles.

---

## 2. Stack frontend obligatoire

```txt
React
Vite
JavaScript uniquement, pas TypeScript
MUI
React Router
TanStack Query
Zustand
Dexie.js
Dnd Kit
React Hook Form
Zod
date-fns
Vitest
React Testing Library
```

Ne pas introduire Redux, MobX, Tailwind, Next.js ou une lib de composants concurrente à MUI sans demande explicite.

---

## 3. Principes non négociables

### 3.1 L’UI ne modifie jamais directement la vérité durable

L’UI déclenche des actions.

Les actions créent des transactions.

Les transactions contiennent des events.

Les events alimentent la projection.

```txt
UI action → JamTransaction → JamEvent[] → projection → UI
```

---

### 3.2 Optimistic local-first

Chaque action :

1. crée une transaction localement ;
2. écrit la transaction dans IndexedDB via Dexie ;
3. applique immédiatement la projection locale ;
4. ajoute la transaction à la queue de sync ;
5. tente un push backend ;
6. garde une UI utilisable même si le backend échoue.

---

### 3.3 Projection pure

Le tableau affiché vient exclusivement du moteur de projection.

Aucun composant React ne doit recalculer lui-même des règles métier lourdes.

Les composants peuvent filtrer/formatter, mais pas décider :

- de l’ordre final ;
- de l’alignement des links ;
- de la résolution des conflicts ;
- de la génération des rounds ;
- des candidates de remplacement.

---

## 4. Arborescence recommandée

```txt
frontend/src/
  app/
    App.jsx
    router.jsx
    providers.jsx
    theme.js

  shared/
    api/
      httpClient.js
      jamsApi.js
      syncApi.js
    components/
      AppShell.jsx
      ConfirmDialog.jsx
      LoadingState.jsx
      ErrorState.jsx
      SyncIndicator.jsx
    constants/
      ids.js
      instruments.js
    utils/
      createId.js
      dateFormat.js
      invariant.js

  features/
    jamEngine/
      projectJamState.js
      applyEvent.js
      selectors.js
      validators.js
      linkResolver.js
      conflictResolver.js
      roundGenerator.js
      positionKeys.js
      projectionWarnings.js

    events/
      createTransaction.js
      eventFactories.js
      eventTypes.js
      eventSchemas.js
      transactionGuards.js

    sync/
      localDb.js
      syncQueue.js
      syncStatus.js
      clientSession.js
      useSyncEngine.js

    jams/
      pages/
        JamListPage.jsx
        JamTablePage.jsx
      components/
        JamCard.jsx
        JamConfigDialog.jsx
      hooks/
        useJams.js
        useJamSessionLock.js

    participants/
      components/
        ParticipantDrawer.jsx
        ParticipantInstrumentEditor.jsx
      hooks/
        useParticipantForm.js

    table/
      components/
        JamTable.jsx
        InstrumentColumn.jsx
        PlateauActionsColumn.jsx
        AppearanceCard.jsx
        HoleCard.jsx
        InsertBetweenCardsZone.jsx
        RoundRevealButton.jsx
        TableModeActionBar.jsx
      hooks/
        useTableDragAndDrop.js
        useLinkMode.js
        useConflictMode.js
      animation/
        useCardMoveAnimation.js

    callDrawer/
      components/
        CallDrawer.jsx
        CallDrawerInstrumentRow.jsx
        ReplacementPicker.jsx
      hooks/
        useReplacementSuggestions.js

  stores/
    jamStore.js
    tableUiStore.js
    syncStore.js
    snackbarStore.js
```

---

## 5. Stores Zustand

### 5.1 `jamStore`

Responsabilité : état courant de jam côté client.

Contient :

```js
{
  jamId,
  transactions,
  events,
  snapshot,
  projection,
  projectionWarnings,
  lastProjectedAt,
  applyTransaction,
  reloadFromLocalDb,
  hydrateFromServer,
  rebuildProjection
}
```

Règles :

- `projection` est toujours reconstruite via `projectJamState` ;
- ne jamais modifier `projection` manuellement ;
- `applyTransaction` écrit localement avant toute tentative réseau.

---

### 5.2 `tableUiStore`

Responsabilité : états purement UI du tableau.

Contient :

```js
{
  mode: "normal" | "link" | "conflict" | "dragging",
  anchorTarget: null,
  selectedTargets: [],
  openParticipantDrawer: null,
  openCallDrawerPlateauIndex: null,
  pendingDialog: null,
  setMode,
  enterLinkMode,
  exitLinkMode,
  enterConflictMode,
  exitConflictMode
}
```

Règles :

- les modes `link` et `conflict` ne sont pas persistés dans l’eventLog ;
- annuler un mode ne crée aucun event ;
- valider un mode crée une transaction.

---

### 5.3 `syncStore`

Responsabilité : état de synchronisation.

Contient :

```js
{
  status: "synced" | "syncing" | "pending" | "offline_pending" | "sync_warning" | "readonly" | "blocked_by_other_client",
  pendingTransactionCount,
  lastSuccessfulSyncAt,
  lastSyncError,
  activeClientLease
}
```

Feedback : toujours positif et non bloquant.

Exemples de wording :

```txt
Sauvegardé
Sauvegarde…
Sauvegarde en attente
Hors ligne — vos actions sont gardées sur cet appareil
Sauvegarde en attente — vos actions sont gardées sur cet appareil
Lecture seule
Lecture seule — jam active sur un autre appareil
```

---

### 5.4 `snackbarStore`

Responsabilité : feedback ponctuel.

Contient :

```js
{
  queue: [],
  pushSnackbar,
  closeSnackbar
}
```

Ne pas utiliser des snackbars pour chaque sync réussie.

---

## 6. Routing

Routes recommandées :

```txt
/
  JamListPage

/jams/new
  redirige ou ouvre JamConfigDialog en création

/jams/:jamId
  JamTablePage
```

L’édition de jam doit se faire dans une modale/dialog de configuration depuis la page jam, pas nécessairement dans une page dédiée.

Le drawer participant et le drawer d’appel sont des overlays de la page jam.

---

## 7. Page `JamListPage`

Responsabilité : lister les jams et créer une jam.

UI :

- liste de cards jam ;
- bouton “Ouvrir” ;
- bouton supprimer avec confirmation ;
- bouton créer jam.

Ne pas ouvrir une jam en cliquant sur toute la card. Utiliser le bouton “Ouvrir”.

---

## 8. Page `JamTablePage`

Responsabilités :

- charger la jam depuis IndexedDB puis backend ;
- prendre le lease client actif ;
- afficher le tableau ;
- orchestrer les drawers/dialogs ;
- afficher l’indicateur de sync ;
- bloquer l’édition si un autre client actif détient le lease.

Flux d’ouverture :

```txt
1. charger snapshot/eventLog local si disponible
2. afficher rapidement une projection locale
3. demander lease backend
4. récupérer les transactions serveur manquantes
5. réconcilier si le client local n’a pas de branche concurrente
6. activer la sync queue
```

Si un autre client est actif :

- afficher lecture seule ou écran bloquant selon décision finale sync ;
- ne pas créer d’events locaux.

---

## 9. Moteur d’events frontend

### 9.1 `eventFactories.js`

Expose des fonctions de haut niveau :

```js
createParticipantTransaction(formValues, projection)
updateParticipantTransaction(participantId, formValues, projection)
createLinkTransaction(anchorTarget, selectedTargets, projection)
removeLinkTransaction(linkId, projection)
createConflictTransaction(anchorTarget, selectedTargets, scope, projection)
removeConflictTransaction(conflictId, projection)
markPlateauPlayedTransaction(plateauIndex, projection)
skipAppearanceTransaction(appearanceId, replacementChoice, projection)
```

Ces factories doivent :

- générer les IDs ;
- créer une transaction cohérente ;
- inclure tous les events nécessaires ;
- refuser de produire une transaction invalide.

---

### 9.2 `validators.js`

Expose :

```js
canCreateLink
canCreateConflict
canMoveTarget
canRemoveAppearance
canRemoveHole
canMarkParticipantLeft
canHideInstrument
canSkipAppearance
```

Les composants UI doivent appeler ces helpers avant validation.

---

## 10. Modes tableau

### 10.1 Mode normal

Actions autorisées :

- drag vertical ;
- link button ;
- lock/unlock ;
- menu trois-points ;
- zones d’insertion ;
- actions de plateau.

---

### 10.2 Mode link

Déclencheur : bouton link d’une card.

Règles :

- la card source devient anchor ;
- recliquer sur le bouton link de l’anchor sort du mode link sans enregistrer ;
- les targets compatibles sont sélectionnables ;
- les targets déjà linkées sont visibles comme sélectionnées ;
- validation explicite obligatoire ;
- annulation ne crée aucun event ;
- aucune mention link dans le menu trois-points.

---

### 10.3 Mode conflict

Déclencheur : menu trois-points → “Créer / retirer un conflit”.

Règles :

- la card source devient anchor ;
- le tableau change visuellement ;
- sélection/désélection de targets ;
- validation explicite ;
- dialog de scope : passage uniquement ou général ;
- pas de drawer conflict ;
- pas de `conflict_updated`.

---

## 11. Drag and drop

Lib : dnd-kit.

Règles :

- vertical uniquement dans une colonne ;
- jamais horizontal ;
- desktop : handle de drag visible ou zone dédiée selon visual spec ;
- mobile : long press ;
- played interdit ;
- locked interdit ;
- group linked déplacé ensemble ;
- action refusée avec snackbar si impossible.

Animations :

- déplacement 800–1000 ms pour les mouvements algorithmiques visibles ;
- pas de téléportation de cards ;
- grisé played avec transition courte.

---

## 12. Drawers et dialogs

### 12.1 ParticipantDrawer

Responsabilités :

- créer participant ;
- modifier nom ;
- ajouter/retirer instruments ;
- gérer les links initiaux entre instruments via mode/form dédié dans le drawer si nécessaire ;
- produire les transactions adaptées.

Ajout/retrait d’instruments ne doit pas être dans le menu card.

---

### 12.2 CallDrawer

Responsabilités :

- afficher les musiciens du plateau ;
- marquer plateau joué ;
- gérer musicien introuvable ;
- proposer trois remplaçants ;
- proposer “Plateau sans [instrument manquant]”.

---

### 12.3 ConfirmDialog

Utiliser un composant commun pour :

- suppression participant ;
- musicien parti ;
- suppression appearance ;
- suppression hole ;
- masquage instrument avec links actifs ;
- delink pendant remplacement ;
- plateau unplayed si nécessaire.

---

## 13. API et TanStack Query

TanStack Query sert à :

- charger les jams ;
- charger une jam initiale ;
- envoyer les transactions ;
- prendre/renouveler/libérer le lease ;
- récupérer les transactions manquantes.

Important : TanStack Query ne remplace pas l’event log local.

Les mutations backend ne doivent pas être la source de vérité immédiate de l’UI pendant la jam. L’UI applique d’abord localement.

---

## 14. Dexie local DB

Tables locales recommandées :

```txt
jams
transactions
events
snapshots
syncQueue
clientSessions
```

Le frontend doit pouvoir redémarrer après reload sans perdre :

- les transactions non syncées ;
- le dernier snapshot ;
- le status de sync ;
- le `clientId` local.

---

## 15. Erreurs et feedback

Règles :

- ne jamais bloquer l’organisateur pour une simple erreur réseau ;
- afficher un état positif : “sauvegarde locale active” ;
- snackbar pour refus métier compréhensible ;
- dialog uniquement pour confirmations importantes ;
- pas de snackbar à chaque action triviale si l’effet visuel est suffisant.

---

## 16. Tests frontend prioritaires

Même si `testing-strategy.md` sera rédigé plus tard, Codex doit prévoir l’architecture pour tester :

- projection engine pur ;
- event factories ;
- validators ;
- syncQueue ;
- modes link/conflict ;
- drawer participant ;
- drawer d’appel ;
- drag rules ;
- IndexedDB abstraction.

---

## 17. À ne pas faire

Ne pas implémenter :

- une projection métier dans les composants React ;
- une logique de sync dépendante uniquement de TanStack Query ;
- un état durable dans localStorage pour les events ;
- un drawer link ;
- un drawer conflict ;
- des notes participant/appearance ;
- un vrai multi-client actif ;
- une suppression physique d’historique ;
- un front desktop séparé.
