# Spec technique verrouillée — Confiture.live

## Statut du document

Ce document verrouille les décisions techniques nécessaires pour lancer le développement avec Codex.

Il complète les specs fonctionnelles et visuelles déjà définies pour le produit de gestion de jam session.

---

# 1. Identité du projet

## Nom produit

**Confiture**

## URL cible

```text
confiture.live
```

## Nom du repository

```text
confiture.live
```

## Objectif produit

Confiture est une application mobile/tablette destinée aux organisateurs de jam sessions.

Elle permet de :

- créer une jam ;
- définir les instruments disponibles ;
- inscrire les musiciens ;
- organiser automatiquement les colonnes de passage par instrument ;
- gérer les plateaux ;
- gérer les liens entre musiciens ;
- ajouter des trous volontaires ;
- gérer les boucles de musiciens ;
- marquer les passages joués ;
- remplacer rapidement un musicien indisponible ;
- garder une persistance locale fiable pendant la soirée.

---

# 2. Stack technique verrouillée

## Backend

```text
Django
Django REST Framework
PostgreSQL
django-cors-headers
Django admin
pytest + pytest-django
Gunicorn
Nginx
```

## Frontend

```text
React
JavaScript
MUI
React Router
TanStack Query
Zustand
Dexie.js
dnd-kit
React Hook Form
Zod
date-fns
Vitest
React Testing Library
```

## Décision importante

Le projet utilise **JavaScript**, pas TypeScript.

Codex ne doit pas convertir le projet en TypeScript et ne doit pas créer de fichiers `.ts` ou `.tsx`.

Tous les fichiers frontend doivent être en :

```text
.js
.jsx
```

---

# 3. Structure du repository

Le projet doit être organisé en monorepo simple.

```text
confiture.live/
├── backend/
├── frontend/
├── docs/
├── README.md
└── AGENTS.md
```

## Backend

```text
backend/
├── manage.py
├── config/
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
├── jams/
│   ├── admin.py
│   ├── apps.py
│   ├── models.py
│   ├── serializers.py
│   ├── urls.py
│   ├── views.py
│   ├── services/
│   │   ├── action_service.py
│   │   └── projection_service.py
│   └── tests/
└── requirements.txt
```

## Frontend

```text
frontend/
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── theme/
│   │   ├── designTokens.js
│   │   ├── muiTheme.js
│   │   └── index.js
│   ├── app/
│   │   ├── router.jsx
│   │   └── queryClient.js
│   ├── features/
│   │   ├── jams/
│   │   ├── participants/
│   │   ├── jamTable/
│   │   │   ├── engine/
│   │   │   │   ├── projectJamTable.js
│   │   │   │   ├── applyJamAction.js
│   │   │   │   ├── actionTypes.js
│   │   │   │   ├── selectors.js
│   │   │   │   └── __tests__/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── store/
│   │   └── sync/
│   ├── shared/
│   │   ├── components/
│   │   ├── api/
│   │   ├── utils/
│   │   └── constants/
│   └── tests/
└── README.md
```

## Docs

```text
docs/
├── product-spec.md
├── visual-spec-table-cards.md
├── technical-stack.md
├── data-model.md
├── table-engine.md
├── sync-strategy.md
└── codex-plan.md
```

---

# 4. Design system centralisé

## Principe

Le design system doit pouvoir être modifié depuis **un seul fichier source** afin de faciliter la personnalisation future du service.

Le fichier source unique est :

```text
frontend/src/theme/designTokens.js
```

Codex doit mettre toutes les valeurs personnalisables dans ce fichier.

Les composants ne doivent pas hardcoder directement :

- couleurs ;
- radius ;
- espacements majeurs ;
- tailles de cartes ;
- largeurs de colonnes ;
- z-index principaux ;
- couleurs d’états ;
- tailles de tags ;
- ombres ;
- transitions.

## Fichiers de thème

```text
frontend/src/theme/
├── designTokens.js
├── muiTheme.js
└── index.js
```

### `designTokens.js`

Ce fichier contient la source de vérité du design.

Exemple attendu :

```js
export const designTokens = {
  app: {
    background: "#0F1115",
    surface: "#171A21",
    textPrimary: "#FFFFFF",
    textSecondary: "#AEB4C0",
  },

  colors: {
    primary: "#FF8A00",
    primaryDark: "#D96F00",
    success: "#3CCB7F",
    danger: "#FF5C5C",
    warning: "#FFD166",
    link: "#7C5CFF",
    loopTagBg: "#E6F0FF",
    loopTagText: "#1D5FD1",
    playedBg: "#2A2D34",
    playedText: "#8B929F",
    holeBg: "#20242D",
    holeBorder: "#6D7480",
  },

  table: {
    actionColumnWidth: 56,
    instrumentColumnMinWidth: 132,
    instrumentColumnTabletMinWidth: 164,
    headerHeight: 44,
    rowGap: 8,
    columnGap: 8,
  },

  card: {
    minHeight: 56,
    paddingX: 8,
    paddingY: 8,
    radius: 10,
    borderWidth: 1,
    playedOpacity: 0.72,
  },

  tags: {
    height: 20,
    radius: 999,
    paddingX: 6,
    fontSize: 11,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  zIndex: {
    stickyHeader: 10,
    stickyActionColumn: 11,
    drawer: 1200,
  },

  transitions: {
    fast: "120ms ease",
    normal: "180ms ease",
  },
};
```

### `muiTheme.js`

Ce fichier transforme les tokens en thème MUI.

Les composants MUI doivent utiliser le thème autant que possible.

### Règle Codex

Si Codex a besoin d’une nouvelle couleur ou d’une nouvelle valeur visuelle globale, il doit :

1. l’ajouter dans `designTokens.js` ;
2. l’utiliser via le thème ou via un import des tokens ;
3. ne pas hardcoder la valeur dans un composant.

---

# 5. Architecture produit V0

## V0 sans authentification

En V0 :

- pas de compte organisateur ;
- toutes les jams du service sont visibles sur l’accueil ;
- l’utilisateur peut créer une jam ;
- l’utilisateur peut ouvrir et modifier une jam existante ;
- le multi-appareil simultané sur une même jam est bloqué ou fortement déconseillé.

## V1 avec authentification

En V1 :

- compte organisateur ;
- chaque organisateur voit ses propres jams ;
- auth recommandée : magic link email ;
- Google/Apple login non prioritaire.

---

# 6. Routes frontend V0

Routes verrouillées :

```text
/
  Liste des jams du service

/jams/new
  Création d’une jam

/jams/:jamId
  Tableau de gestion d’une jam

/jams/:jamId/edit
  Édition d’une jam
```

## Drawers internes

Depuis `/jams/:jamId`, l’app peut ouvrir :

- drawer création participant ;
- drawer édition participant ;
- drawer appel des musiciens ;
- drawer remplacement “n’est pas disponible” ;
- drawer “veux jouer sans” ;
- mode link avec barre d’action sticky.

---

# 7. Liste des jams

En V0, l’écran d’accueil affiche toutes les jams du service.

## Tri

Les jams sont triées par **date indicative**.

Ordre recommandé :

1. jams à venir les plus proches ;
2. jams du jour ;
3. jams passées récentes ;
4. jams sans date en bas.

## Carte jam

Chaque carte jam affiche :

- nom ;
- date indicative ;
- nombre de musiciens uniques ;
- nombre de participations instrumentales ;
- nombre de plateaux joués ;
- nombre de musiciens n’ayant pas encore joué leur instrument une première fois.

## Actions

- ouvrir la jam ;
- créer une nouvelle jam ;
- éventuellement supprimer / archiver plus tard.

---

# 8. Modèle de données métier

## Jam

Représente une jam session.

Champs principaux :

```text
id
name
indicative_date
created_at
updated_at
```

## Instrument

Instrument disponible dans une jam.

Champs principaux :

```text
id
jam_id
name
order
is_default
created_at
updated_at
```

Instruments actifs par défaut, dans cet ordre :

```text
chant
guitare
basse
batterie
piano
autres
```

L’organisateur peut ajouter un instrument custom en lui donnant un nom.

Un instrument custom appartient uniquement à la jam en cours en V0.

## Participant

Représente une personne unique.

Champs principaux :

```text
id
jam_id
name
status
created_at
updated_at
```

États :

```text
active
left
```

Règle :

- deux participants ne peuvent pas avoir exactement le même nom dans une même jam ;
- si un nom existe déjà, l’interface affiche une erreur ;
- l’organisateur doit modifier le nom, par exemple “Nicolas G.”.

## ParticipantEntry

Représente la participation d’un participant sur un instrument.

Exemples :

- Nicolas en guitare ;
- Nicolas en chant.

Champs principaux :

```text
id
jam_id
participant_id
instrument_id
custom_instrument_label
base_order
created_at
updated_at
```

Règles :

- un participant peut avoir plusieurs `ParticipantEntry` ;
- s’il joue chant + guitare, il apparaît dans deux colonnes ;
- les deux entrées peuvent être linkées ou non ;
- si l’instrument est “autres”, `custom_instrument_label` permet d’afficher “saxophone”, “violon”, etc.

## LinkGroup

Groupe d’entrées ou trous devant passer ensemble.

Champs principaux :

```text
id
jam_id
created_at
updated_at
```

Relations :

```text
entries
holes
```

Règles :

- un groupe lié peut contenir plusieurs entrées ;
- maximum une entrée par instrument ;
- un trou peut être dans un groupe lié ;
- les groupes liés se déplacent ensemble ;
- en V0, créer un link remonte les entrées les plus en retard vers l’entrée la plus avancée.

## Hole

Trou volontaire dans une colonne.

Champs principaux :

```text
id
jam_id
instrument_id
position
created_by_action
created_at
updated_at
```

Règles :

- un trou est une absence volontaire de musicien sur un instrument ;
- un trou peut être créé seul ;
- un trou peut être créé via “veux jouer sans” ;
- un trou peut être linké à un participant ou à un groupe ;
- un trou ne fait pas partie des boucles ;
- un trou peut être supprimé s’il n’est pas déjà dans une ligne jouée ;
- s’il est dans une ligne jouée, il reste dans l’historique.

## PlayedPassage

Trace un passage joué.

Champs principaux :

```text
id
jam_id
participant_entry_id
hole_id
line_index
played_at
created_at
```

Règles :

- une entrée jouée devient grisée ;
- elle ne bouge plus ;
- elle reste dans l’historique ;
- un passage joué peut être annulé en cas d’erreur ;
- un trou peut aussi être considéré comme passé dans une ligne jouée.

## ClientAction

Action locale synchronisable.

Champs principaux :

```text
id
client_action_id
jam_id
type
payload
created_at
synced_at
status
```

États :

```text
pending
synced
failed
```

Règles :

- chaque action utilisateur doit avoir un `client_action_id` unique ;
- le backend doit être idempotent ;
- une action déjà reçue ne doit pas être appliquée deux fois.

---

# 9. Actions métier V0

Toutes les modifications importantes doivent passer par des actions.

Liste verrouillée :

```text
CREATE_JAM
UPDATE_JAM
ADD_INSTRUMENT
REORDER_INSTRUMENTS

ADD_PARTICIPANT
UPDATE_PARTICIPANT
MARK_PARTICIPANT_LEFT

ADD_PARTICIPANT_ENTRY
UPDATE_PARTICIPANT_ENTRY

MOVE_ENTRY_VERTICAL

LINK_ITEMS
UNLINK_ITEMS

ADD_HOLE
REMOVE_HOLE
WANTS_TO_PLAY_WITHOUT

MARK_ENTRY_PLAYED
MARK_PLATEAU_PLAYED
UNDO_ENTRY_PLAYED
UNDO_PLATEAU_PLAYED

REPLACE_UNAVAILABLE
```

---

# 10. Moteur de projection du tableau

## Emplacement frontend

```text
frontend/src/features/jamTable/engine/
├── projectJamTable.js
├── applyJamAction.js
├── actionTypes.js
├── selectors.js
└── __tests__/
```

## Principe

Le moteur doit être une logique pure.

```text
jamState + actions → projectedTable
```

Il ne doit pas dépendre de React, MUI, Zustand, Django ou du DOM.

## Rôle

Le moteur calcule :

- les lignes visibles ;
- les colonnes ;
- les cartes ;
- les boucles ;
- les trous ;
- les links ;
- les états joués ;
- les participants partis ;
- les prochains passages ;
- les remplaçants disponibles.

## Règles de projection

### Colonnes indépendantes

Chaque instrument possède sa propre file d’attente.

Les colonnes sont indépendantes par défaut.

### Ajout participant

Quand un participant est ajouté dans une colonne :

- il se place à la suite du dernier participant de cette colonne ;
- il est placé avant les répétitions de boucle.

### Boucles

Quand tous les participants actifs d’une colonne ont été affichés une première fois, la colonne boucle.

La boucle réaffiche les musiciens actifs dans l’ordre d’arrivée de référence.

L’interface doit afficher assez de lignes pour voir trois lignes pleines composées uniquement de musiciens en boucle.

### Trous

Un trou :

- peut être créé entre deux cartes ;
- peut être créé via “veux jouer sans” ;
- ne fait pas partie des boucles ;
- peut être linké ;
- suit son link group s’il est linké ;
- reste en historique si sa ligne a été jouée.

### Links

Quand plusieurs entrées sont linkées :

- elles doivent être alignées sur la même ligne ;
- en V0, on remonte celles qui sont le plus en retard vers celle qui est la plus avancée ;
- les cartes poussées se décalent vers le bas ;
- il ne doit jamais y avoir de trou involontaire.

### Joué

Quand une entrée est marquée comme jouée :

- elle devient grisée ;
- elle est figée ;
- elle ne bouge plus ;
- elle compte comme ayant joué son instrument au moins une fois.

### Stat “n’a pas encore joué”

Un musicien est compté comme n’ayant pas encore joué son instrument si son `ParticipantEntry` n’a jamais été marqué joué.

Exemple :

- Nicolas a joué batterie une fois ;
- il revient ensuite dans les boucles ;
- il n’est plus compté comme “n’ayant pas encore joué batterie”.

La stat est donc calculée sur les participations instrumentales actives jamais jouées.

### Participant parti

Quand un participant est marqué comme parti :

- son statut passe à `left` ;
- ses futures apparitions sont supprimées ;
- ses passages déjà joués restent visibles dans l’historique ;
- ses liens futurs sont supprimés ou ajustés.

### N’est pas disponible

Depuis le drawer d’appel :

- si un musicien n’est pas disponible, l’app propose les prochains musiciens de la même colonne ;
- les musiciens linkés sont affichés avec leur état lié ;
- si on choisit un musicien linké, confirmation ;
- après confirmation, il est délinké et déplacé seul ;
- le remplaçant prend la place ;
- le musicien absent est repoussé à la prochaine ligne suivante disponible.

---

# 11. UX tableau V0 verrouillée

## Header

Le header du tableau affiche uniquement le nom de chaque colonne.

Exemple :

```text
Chant | Guitare | Basse | Batterie | Piano | Autres
```

Il ne doit pas afficher :

- compteur ;
- “jamais passés” ;
- “boucle” ;
- autres stats.

Les stats restent dans les pages/drawers de jam.

## Colonne gauche

Chaque ligne possède deux boutons directs :

1. bouton ouvrir le drawer d’appel ;
2. bouton “plateau joué”.

Le bouton “plateau joué” utilise le même icône que “musicien joué”.

Il n’y a pas de mode “ligne sélectionnée”.

## Carte musicien

Une carte affiche :

- nom du participant ;
- éventuellement instrument custom si colonne “autres” ;
- tags d’état ;
- icônes d’action selon contexte.

Actions principales :

- check “a joué” uniquement pour les prochains musiciens jouables ;
- link ;
- menu `⋯`.

Menu `⋯` :

- modifier ;
- marquer comme parti ;
- veux jouer sans ;
- supprimer participation si autorisé ;
- annuler passage si déjà joué.

## Carte boucle

Une carte issue d’une boucle affiche un petit tag bleu.

Format recommandé :

```text
🔁 2
```

ou :

```text
↻ 2
```

Le numéro indique le numéro de boucle.

Exemple :

- premier affichage : pas de tag ;
- première répétition : `🔁 2` ;
- deuxième répétition : `🔁 3`.

## Carte jouée

Une carte jouée est :

- grisée ;
- figée ;
- non draggable ;
- conservée dans l’historique ;
- annulable via menu/confirmation.

## Carte trou

Un trou affiche :

```text
Sans batterie
```

ou selon la colonne :

```text
Sans piano
```

Style :

- visuellement volontaire ;
- fond distinct ;
- bordure pointillée ou style équivalent ;
- pas de confusion avec une cellule vide ou un bug.

## Carte liée

Une carte liée affiche :

- badge link ;
- identifiant visuel de groupe ;
- bordure ou accent commun aux membres du groupe.

Exemple :

```text
🔗 A
```

Tous les éléments du même groupe affichent le même badge.

## Participant parti

Un participant parti :

- disparaît du futur ;
- reste visible uniquement dans l’historique s’il a déjà joué ;
- peut afficher un badge `parti` dans l’historique.

---

# 12. Insertion entre deux cartes

Quand l’organisateur clique entre deux cartes dans une colonne, une modale s’ouvre.

La modale propose :

```text
Ajouter ici

- Ajouter un participant
- Ajouter un trou
```

## Ajouter un participant

Si l’organisateur choisit “Ajouter un participant” :

- le drawer d’ajout participant s’ouvre ;
- l’instrument de la colonne est précoché ;
- la position d’insertion est conservée ;
- à validation, le participant est ajouté à cet emplacement ;
- les cartes suivantes se décalent.

## Ajouter un trou

Si l’organisateur choisit “Ajouter un trou” :

- un trou est ajouté à cet emplacement ;
- les cartes suivantes se décalent ;
- le trou n’est pas ajouté aux boucles.

---

# 13. Drag and drop

## Principe

Le drag and drop est uniquement vertical.

Il n’y aura jamais de drag horizontal, ni en V0, ni en V1, ni plus tard.

## Interaction

L’interaction est :

```text
long press + drag vertical
```

Pas besoin d’affordance visuelle dédiée.

## Règles

- une carte non jouée peut être déplacée verticalement dans sa colonne ;
- une carte jouée ne bouge pas ;
- un groupe lié se déplace ensemble ;
- un trou linké suit son groupe ;
- les cartes déplacées poussent les autres cartes non jouées ;
- il ne doit jamais y avoir de trou involontaire.

---

# 14. Drawers principaux

## Drawer appel des musiciens

Accessible via le bouton d’appel dans la colonne gauche.

Affiche :

- titre du plateau ;
- liste des instruments dans l’ordre des colonnes ;
- musicien prévu pour chaque instrument ;
- trous prévus ;
- bouton “a joué” par musicien jouable ;
- bouton “n’est pas disponible” ;
- bouton global “plateau joué”.

Sur mobile, le drawer est full screen ou quasi full screen.

Le bouton “plateau joué” est sticky en bas.

## Drawer “n’est pas disponible”

Affiche les remplaçants possibles dans la même colonne.

Pour chaque remplaçant :

- nom ;
- état linké ou non ;
- tag boucle si concerné ;
- bouton “choisir”.

Si le remplaçant est linké :

- confirmation ;
- si confirmé, il est délinké ;
- il prend la place.

## Drawer “veux jouer sans”

Accessible depuis le menu `⋯` d’une carte participant.

Wording verrouillé :

```text
Veux jouer sans…
```

L’organisateur peut cocher un ou plusieurs instruments.

Effet :

- crée un trou dans chaque colonne choisie ;
- linke ces trous au participant ou au groupe du participant.

## Drawer création/édition participant

Champs :

- nom ;
- instruments ;
- champ libre si instrument “autres” ;
- section “faire passer en même temps”.

### Section “faire passer en même temps”

Si plusieurs instruments sont sélectionnés pour un même participant, afficher les combinaisons possibles.

Exemple Nicolas : chant + guitare + batterie.

Afficher :

```text
Faire passer en même temps ?

☐ Chant + guitare
☐ Chant + batterie
☐ Guitare + batterie
```

Les liens ne sont pas transitifs automatiquement en V0 : seules les paires cochées sont créées.

## Drawer création/édition jam

Création et édition utilisent le même composant.

Champs :

- nom ;
- date indicative ;
- instruments activés ;
- ordre des instruments ;
- ajout instrument custom.

En mode édition, afficher aussi :

- nombre de musiciens uniques ;
- nombre de participations instrumentales ;
- nombre de plateaux joués ;
- nombre de participations instrumentales actives n’ayant jamais joué.

---

# 15. Synchronisation locale/backend

## Décision V0

Pendant une jam :

- chaque action est appliquée localement immédiatement ;
- chaque action est stockée dans Dexie ;
- chaque action est envoyée au backend ;
- si l’envoi échoue, l’état local reste source de vérité ;
- l’app retente régulièrement la sync.

## États UI de sync

Prévoir un petit indicateur discret :

```text
Synchronisé
Synchronisation en attente
Hors ligne — sauvegarde locale
Erreur de synchronisation
```

Pas d’écran bloquant sauf cas grave.

## Multi-appareil

En V0, on bloque l’édition simultanée d’une même jam sur deux appareils.

Règle simple :

- si une jam est déjà ouverte en édition active ailleurs, afficher un blocage clair ;
- pas de résolution de conflit en V0.

---

# 16. Backend API V0

Endpoints minimaux attendus :

```text
GET    /api/jams/
POST   /api/jams/
GET    /api/jams/:id/
PATCH  /api/jams/:id/

POST   /api/jams/:id/actions/
GET    /api/jams/:id/actions/

POST   /api/jams/:id/lock-editing/
POST   /api/jams/:id/unlock-editing/
```

## Approche recommandée

Le frontend peut envoyer des actions métier au backend.

Le backend :

- vérifie l’idempotence via `client_action_id` ;
- applique l’action ;
- renvoie l’état de jam mis à jour ou un accusé de réception.

---

# 17. Phases de développement Codex

Ne pas demander à Codex de tout développer en une seule fois.

## Phase 1 — Setup repo

Objectif :

- créer monorepo ;
- backend Django minimal ;
- frontend React JS + MUI ;
- thème centralisé ;
- routes vides ;
- docs copiées.

## Phase 2 — Modèle frontend et moteur pur

Objectif :

- créer les types JSDoc / shapes JS ;
- créer `projectJamTable.js` ;
- créer `applyJamAction.js`;
- créer les actions ;
- créer tests Vitest.

Pas encore d’UI complexe.

## Phase 3 — UI statique tableau avec fake data

Objectif :

- afficher tableau ;
- headers colonnes ;
- colonne gauche avec deux boutons ;
- cartes et states ;
- scroll horizontal/vertical ;
- fake data.

## Phase 4 — Actions locales Zustand

Objectif :

- connecter les actions locales ;
- ajouter participant ;
- déplacer verticalement ;
- marquer joué ;
- plateau joué ;
- links ;
- trous ;
- parti ;
- remplacement indisponible.

## Phase 5 — Formulaires/drawers

Objectif :

- création/édition jam ;
- création/édition participant ;
- drawer appel ;
- drawer indisponible ;
- drawer veux jouer sans ;
- insertion entre deux cartes.

## Phase 6 — Backend Django + API

Objectif :

- modèles ;
- serializers ;
- endpoints ;
- admin ;
- tests backend.

## Phase 7 — Dexie + sync queue

Objectif :

- stockage local ;
- pending actions ;
- retry ;
- idempotence ;
- indicateur de sync ;
- blocage multi-appareil V0.

## Phase 8 — Polish

Objectif :

- responsive ;
- animations ;
- confirmations ;
- empty states ;
- finition visuelle.

---

# 18. Tests prioritaires

## Tests moteur tableau

À écrire dès le début :

- ajout participant en fin de colonne ;
- ajout participant avant boucles ;
- boucle simple ;
- boucle avec participant ajouté avant répétition ;
- trou manuel ;
- trou via “veux jouer sans” ;
- link de deux entrées ;
- link avec trou ;
- déplacement vertical simple ;
- déplacement vertical d’un groupe lié ;
- marquer joué ;
- annuler joué ;
- plateau joué ;
- participant parti ;
- remplaçant indisponible ;
- remplaçant linké avec confirmation.

## Tests UI prioritaires

- affichage carte normale ;
- carte jouée ;
- carte boucle ;
- carte trou ;
- carte liée ;
- bouton ligne appel ;
- bouton ligne plateau joué ;
- drawer appel ;
- insertion entre deux cartes.

## Tests backend prioritaires

- création jam ;
- édition jam ;
- action idempotente ;
- récupération jam ;
- participant nom unique par jam ;
- marquer comme parti ;
- lock édition multi-appareil.

---

# 19. Règles importantes pour Codex

Codex doit respecter ces règles :

1. Ne pas utiliser TypeScript.
2. Ne pas créer de drag horizontal.
3. Ne pas hardcoder les tokens visuels dans les composants.
4. Mettre le design system dans `frontend/src/theme/designTokens.js`.
5. Garder le moteur de tableau pur et testé.
6. Ne pas mélanger la logique de projection avec les composants React.
7. Utiliser MUI autant que possible.
8. Utiliser Zustand pour l’état local complexe.
9. Utiliser Dexie pour la persistance locale.
10. Ne pas coder tout le produit en une seule passe.
11. Livrer par phases testables.
12. Garder les specs dans `docs/`.
13. Utiliser JavaScript + JSDoc si besoin de documenter les shapes.
14. Prévoir les tests Vitest sur le moteur avant le polish UI.

---

# 20. Commandes de base attendues

## Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## Frontend

```bash
cd frontend
npm install
npm run dev
npm run test
```

## Tests backend

```bash
cd backend
pytest
```

---

# 21. Résumé décisionnel

Décisions verrouillées :

```text
Nom produit : Confiture
Repo : confiture.live
URL : confiture.live
Backend : Django + DRF
Frontend : React + MUI
Langage frontend : JavaScript, pas TypeScript
Design system : source unique dans frontend/src/theme/designTokens.js
Repo : monorepo backend/frontend/docs
V0 : sans authentification
V1 : compte organisateur
V0 jams : toutes les jams visibles
Tri jams : date indicative
Drag : vertical uniquement, long press + drag
Tableau : header = nom de colonne uniquement
Colonne gauche : bouton appel + bouton plateau joué
Sync : Dexie local first + backend retry
Multi-appareil V0 : édition simultanée bloquée
Moteur tableau : module pur testé
```
