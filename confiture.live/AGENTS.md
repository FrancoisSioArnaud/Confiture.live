# AGENTS.md — Confiture.live

## Rôle de Codex

Tu travailles sur **Confiture**, une application web mobile/tablette pour organiser des jam sessions en bar.

Ton objectif n’est pas seulement de coder des écrans. Tu dois préserver la logique métier centrale :

- une jam est gérée par un organisateur ;
- les musiciens sont ajoutés dans des colonnes d’instruments ;
- chaque colonne a son propre ordre automatique ;
- chaque ligne représente un plateau potentiel ;
- les musiciens peuvent être liés pour jouer ensemble ;
- des trous volontaires peuvent exister ;
- les musiciens déjà joués deviennent de l’historique ;
- les musiciens partis disparaissent des futurs passages ;
- l’app doit rester utilisable en soirée, rapidement, sur téléphone.

Travaille de manière incrémentale, propre et testable.

---

# 1. Règles absolues

## Langage frontend

Le frontend est en **JavaScript**, pas TypeScript.

Interdit :

- créer des fichiers `.ts` ;
- créer des fichiers `.tsx` ;
- convertir le projet en TypeScript ;
- ajouter une config TypeScript.

Autorisé :

- utiliser JSDoc pour documenter les shapes complexes ;
- créer des fichiers `.js` et `.jsx`.

## Drag and drop

Le drag and drop est uniquement vertical.

Interdit :

- drag horizontal ;
- déplacement horizontal entre colonnes ;
- feature permettant de changer d’instrument par drag.

Interaction attendue :

```text
long press + drag vertical
```

Pas besoin d’affordance visuelle dédiée pour le drag.

## Design system

Ne hardcode pas les valeurs visuelles globales dans les composants.

Toutes les valeurs personnalisables doivent être centralisées dans :

```text
frontend/src/theme/designTokens.js
```

Cela concerne notamment :

- couleurs ;
- fonds ;
- couleurs d’états ;
- tailles des cartes ;
- espacements principaux ;
- radius ;
- ombres ;
- largeurs de colonnes ;
- hauteur de header ;
- z-index ;
- transitions ;
- tags ;
- drawers.

Si tu as besoin d’une nouvelle valeur visuelle globale, ajoute-la dans `designTokens.js`.

## MUI d’abord

Utilise **MUI autant que possible**.

Priorité :

- MUI components ;
- `sx` utilisant le thème/tokens ;
- composants custom uniquement si MUI ne suffit pas.

Ne crée pas une UI entièrement custom si MUI permet de faire proprement.

## Moteur de tableau pur

La logique de projection du tableau doit rester dans un module pur.

Interdit :

- mélanger les règles métier dans les composants React ;
- coder la projection directement dans le JSX ;
- dépendre du DOM, de MUI ou de Zustand dans le moteur.

Le moteur doit rester testable avec Vitest.

## Pas de legacy inutile

Le projet n’est pas en production au départ.

Quand une spec demande un comportement final clair :

- ne maintiens pas plusieurs anciennes variantes inutiles ;
- ne crée pas de compatibilité legacy sans demande explicite ;
- supprime le code mort quand tu remplaces une approche.

## Tests obligatoires sur logique métier

Toute modification du moteur de tableau doit être accompagnée ou couverte par des tests.

Priorité absolue aux tests sur :

- boucles ;
- links ;
- trous ;
- joué ;
- participant parti ;
- remplacement indisponible ;
- déplacement vertical.

---

# 2. Structure du repository

Structure attendue :

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

Les specs doivent rester dans :

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

Quand tu modifies une règle métier structurante, mets à jour la documentation correspondante.

---

# 3. Stack verrouillée

## Backend

```text
Django
Django REST Framework
PostgreSQL
django-cors-headers
Django admin
pytest
pytest-django
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

---

# 4. Design system centralisé

## Fichiers obligatoires

```text
frontend/src/theme/
├── designTokens.js
├── muiTheme.js
└── index.js
```

## `designTokens.js`

Ce fichier est la source unique de personnalisation visuelle.

Il doit contenir au minimum :

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

  drawer: {
    mobileBorderRadius: 16,
    desktopWidth: 420,
    bottomActionHeight: 72,
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
    bottomActionBar: 1250,
  },

  transitions: {
    fast: "120ms ease",
    normal: "180ms ease",
  },
};
```

## `muiTheme.js`

Ce fichier transforme les tokens en thème MUI.

Le thème doit définir :

- palette ;
- typography ;
- shape ;
- composants MUI principaux ;
- styles de boutons ;
- styles de drawers/dialogs si utile.

## Règles d’utilisation

Dans les composants :

- privilégie `theme` et `sx`;
- importe les tokens seulement si nécessaire ;
- pas de couleurs arbitraires dans les composants ;
- pas de tailles arbitraires répétées ;
- les styles spécifiques à une carte peuvent être dans le composant, mais les valeurs doivent venir des tokens.

---

# 5. Material Design et MUI

## Composants à privilégier

Utilise les composants MUI suivants :

```text
Box
Stack
Grid si vraiment utile
Typography
Button
IconButton
Drawer
Dialog
Menu
MenuItem
TextField
Checkbox
FormControlLabel
Chip
Snackbar
Alert
Card
CardActionArea si adapté
Divider
List
ListItem
ListItemText
ListItemButton
useMediaQuery
```

## Icônes MUI recommandées

Utilise `@mui/icons-material`.

Icônes recommandées :

```text
Check / CheckRounded
Campaign / CampaignRounded
Link / LinkRounded
MoreVert / MoreVertRounded
Edit / EditRounded
Delete / DeleteRounded
PersonOff / PersonOffRounded
Loop / LoopRounded
Add / AddRounded
Close / CloseRounded
DragIndicator uniquement si besoin plus tard, mais pas en V0
```

## Règles MUI

- Ne mélange pas plusieurs systèmes UI.
- N’ajoute pas Tailwind.
- N’ajoute pas Bootstrap.
- N’ajoute pas de CSS framework externe.
- Utilise `sx` pour les styles locaux.
- Utilise le thème pour les styles globaux.
- Crée des composants partagés quand un pattern revient plus de 2 fois.

---

# 6. Drawers — format standard

L’app utilise beaucoup de drawers. Ils doivent être cohérents.

## Composant partagé recommandé

Créer un composant partagé :

```text
frontend/src/shared/components/AppDrawer.jsx
```

## Objectif

`AppDrawer` doit fournir une structure commune :

```text
Header
Content scrollable
Bottom action bar optionnelle
```

## Comportement mobile

Sur mobile :

- drawer bottom ou full screen selon le cas ;
- largeur 100% ;
- hauteur full screen ou quasi full screen pour les actions complexes ;
- header sticky en haut ;
- action bar sticky en bas ;
- contenu scrollable ;
- bouton close visible.

## Comportement tablette/desktop

Même logique UX, responsive seulement.

Sur tablette :

- drawer peut être plus large ;
- drawer peut garder un format latéral si cela améliore la lisibilité ;
- ne change pas les flows métier.

## Props attendues

```jsx
<AppDrawer
  open={open}
  onClose={handleClose}
  title="Titre"
  subtitle="Optionnel"
  fullScreenOnMobile
  actions={...}
>
  {children}
</AppDrawer>
```

## Header drawer

Le header doit contenir :

- titre clair ;
- sous-titre optionnel ;
- bouton fermer ;
- pas trop d’actions secondaires.

## Content drawer

Le contenu doit être organisé en sections lisibles.

Utilise :

- `Stack`;
- `Typography`;
- `Divider`;
- `FormControlLabel`;
- `TextField`;
- `Button`.

## Bottom action bar

Pour les actions de validation :

- bouton principal en bas ;
- bouton secondaire si nécessaire ;
- ne pas mettre le bouton principal perdu au milieu du scroll.

Exemples :

```text
Annuler | Valider
Fermer | Plateau joué
Retour | Choisir ce musicien
```

## Drawers principaux

Créer ou préparer ces drawers :

```text
JamFormDrawer / JamFormPage
ParticipantFormDrawer
CallPlateauDrawer
UnavailableReplacementDrawer
WantsToPlayWithoutDrawer
InsertBetweenCardsDialog
```

---

# 7. Dialogs et confirmations

Utilise des `Dialog` MUI pour les confirmations courtes.

Confirmations nécessaires :

- annuler un passage joué ;
- annuler un plateau joué ;
- marquer un participant comme parti ;
- supprimer un trou ;
- supprimer une participation non jouée ;
- choisir un remplaçant linké ;
- rendre indisponible un musicien linké ;
- quitter un mode link avec changements non validés.

Les confirmations doivent être courtes et orientées action.

Exemple :

```text
Titre : Marquer Nicolas comme parti ?
Texte : Il disparaîtra des prochains passages, mais ses passages déjà joués resteront dans l’historique.
Actions : Annuler | Marquer comme parti
```

Ne demande pas de confirmation pour les actions facilement annulables ou non destructrices.

---

# 8. Routes frontend

Routes V0 verrouillées :

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

## V0 sans auth

En V0 :

- pas d’authentification ;
- toutes les jams du service sont visibles ;
- tri par date indicative ;
- création accessible depuis l’accueil.

## V1 auth

À prévoir plus tard :

- compte organisateur ;
- magic link email recommandé ;
- chaque organisateur voit ses jams.

Ne code pas l’auth en V0 sauf demande explicite.

---

# 9. UX liste des jams

## Tri

Trier par date indicative.

Ordre recommandé :

1. jams à venir les plus proches ;
2. jams du jour ;
3. jams passées récentes ;
4. jams sans date en bas.

## Carte jam

Afficher :

- nom ;
- date indicative ;
- nombre de musiciens uniques ;
- nombre de participations instrumentales ;
- nombre de plateaux joués ;
- nombre de participations instrumentales actives n’ayant jamais joué.

## Empty state

Si aucune jam :

```text
Aucune jam pour l’instant.
Créer une jam
```

---

# 10. UX tableau

## Header tableau

Le header affiche uniquement le nom de la colonne.

Exemple :

```text
Chant | Guitare | Basse | Batterie | Piano | Autres
```

Interdit dans le header :

- compteurs ;
- stats ;
- texte “boucle” ;
- texte “jamais passés”.

## Colonne gauche

Chaque ligne possède deux boutons directs :

1. ouvrir drawer d’appel ;
2. marquer plateau joué.

Le bouton “plateau joué” utilise le même icône que “musicien joué”.

Il n’y a pas de mode “ligne sélectionnée”.

## Scroll

- scroll horizontal pour les colonnes instruments ;
- scroll vertical pour les lignes ;
- header sticky en haut recommandé ;
- colonne gauche sticky recommandée.

## Insertion entre deux cartes

Quand l’utilisateur clique entre deux cartes dans une colonne, ouvrir un `Dialog`.

Contenu :

```text
Ajouter ici

Ajouter un participant
Ajouter un trou
```

Si “Ajouter un participant” :

- ouvrir drawer participant ;
- instrument de la colonne précoché ;
- position d’insertion conservée.

Si “Ajouter un trou” :

- ajouter un trou à cet emplacement ;
- pousser les cartes suivantes ;
- le trou ne boucle pas.

---

# 11. Cards tableau

## Carte normale

Affiche :

- nom participant ;
- tags éventuels ;
- actions.

Actions visibles :

- check seulement si prochain musicien jouable ;
- link ;
- menu `⋯`.

## Carte prochain jouable

C’est la prochaine carte non jouée de sa colonne.

Elle affiche le check.

## Carte jouée

Style :

- grisée ;
- non draggable ;
- historique ;
- check validé ;
- menu disponible pour annulation.

Elle ne doit plus bouger.

## Carte boucle

Afficher un tag bleu compact.

Format :

```text
🔁 2
```

ou :

```text
↻ 2
```

Signification :

- premier passage : pas de tag ;
- première répétition : `🔁 2` ;
- deuxième répétition : `🔁 3`.

## Carte trou

Afficher :

```text
Sans batterie
```

ou selon la colonne.

Style :

- volontairement distinct ;
- bordure pointillée ou équivalent ;
- pas confondu avec une cellule vide.

Un trou :

- peut être linké ;
- ne boucle pas ;
- peut être supprimé s’il n’est pas joué ;
- reste dans l’historique si la ligne est jouée.

## Carte liée

Afficher :

- badge link ;
- identifiant de groupe.

Exemple :

```text
🔗 A
```

Les éléments du même groupe ont le même badge et une cohérence visuelle.

## Carte participant parti

Un participant parti :

- disparaît des futurs passages ;
- reste visible uniquement dans l’historique s’il a déjà joué ;
- affiche éventuellement un badge `parti`.

---

# 12. Mode link

## Déclenchement

Depuis l’icône link d’une carte.

## Comportement

Quand le mode link est actif :

- la carte source est mise en avant ;
- les cartes déjà liées sont mises en avant ;
- les cartes compatibles sont sélectionnables ;
- les cartes incompatibles sont désactivées ;
- une barre sticky en bas affiche `Annuler` et `Valider`.

## Lier / délier

Le même mode sert à lier et délier.

- cliquer une carte non liée compatible l’ajoute au groupe ;
- cliquer une carte déjà liée la retire du groupe ;
- validation applique les changements.

## Restrictions

- maximum une entrée par instrument dans un groupe ;
- pas de carte jouée ;
- pas de participant parti ;
- les trous peuvent être linkés.

---

# 13. Drawer “appel des musiciens”

## Accès

Depuis le bouton d’appel dans la colonne gauche.

Icône recommandée :

```text
CampaignRounded
```

ou mégaphone équivalent.

## Format

Sur mobile :

- drawer full screen ou quasi full screen ;
- contenu très lisible ;
- bouton global sticky en bas.

## Contenu

Afficher dans l’ordre des colonnes :

```text
Chant
Sarah

Guitare
Nicolas

Basse
Tom

Batterie
Sans batterie

Piano
Jeanne
```

## Actions par musicien

- `A joué`
- `N’est pas disponible`

## Action globale

- `Plateau joué`

Quand “Plateau joué” est cliqué :

- toutes les entrées jouables du plateau sont marquées jouées ;
- les trous du plateau sont considérés comme passés ;
- la ligne reste à sa place ;
- l’app recalcule les futures lignes ;
- fermer le drawer après succès, sauf si une erreur survient.

---

# 14. Drawer “n’est pas disponible”

## Accès

Depuis le drawer d’appel, sur un musicien.

## Principe

Aucun statut durable `indisponible`.

L’objectif est seulement de trouver un remplaçant rapidement.

## Contenu

Afficher les prochains musiciens de la même colonne.

Pour chaque remplaçant :

- nom ;
- tag boucle si concerné ;
- indication s’il est linké ;
- bouton `Choisir`.

Exemple :

```text
Remplacer Jérémy — Batterie

Lucas
Non lié
Choisir

Hugo
Lié avec Sarah
Choisir
```

## Si le musicien indisponible est linké

Demander confirmation.

Si confirmé :

- le délinker ;
- le repousser seul ;
- appliquer la logique normale.

## Si le remplaçant est linké

Demander confirmation.

Si confirmé :

- le délinker ;
- le déplacer seul ;
- il prend la place.

## Effet final

- le remplaçant prend la place ;
- le musicien absent est repoussé à la prochaine ligne suivante disponible.

---

# 15. Drawer “veux jouer sans”

## Accès

Depuis le menu `⋯` d’une carte.

Wording :

```text
Veux jouer sans…
```

## Contenu

Afficher les autres instruments disponibles avec des checkboxes.

Exemple :

```text
Guillaume veut jouer sans…

☐ Chant
☐ Guitare
☑ Batterie
☐ Piano
```

## Validation

À validation :

- créer un trou dans chaque colonne cochée ;
- linker les trous au participant ou à son groupe existant ;
- recalcule le tableau.

---

# 16. Drawer création / édition participant

## Champs

- nom ;
- instruments ;
- champ libre si instrument `Autres`;
- section “faire passer en même temps”.

## Nom unique

Deux participants ne peuvent pas avoir exactement le même nom dans une même jam.

Si le nom existe :

- afficher une erreur claire ;
- bloquer la validation.

Exemple :

```text
Ce nom existe déjà dans cette jam. Ajoute une initiale ou un détail.
```

## Multi-instruments

Un participant peut avoir plusieurs instruments.

Exemple :

- Nicolas chant ;
- Nicolas guitare.

Il apparaît dans plusieurs colonnes.

## Section “faire passer en même temps”

Si plusieurs instruments sont sélectionnés :

```text
Faire passer en même temps ?

☐ Chant + guitare
☐ Chant + batterie
☐ Guitare + batterie
```

En V0, seules les paires cochées sont créées comme liens.

Ne crée pas de bouton “tout lier” sauf demande explicite.

---

# 17. Drawer / page création-édition jam

Création et édition utilisent le même composant.

## Champs

- nom ;
- date indicative ;
- instruments activés ;
- ordre des instruments ;
- ajout instrument custom.

## Instruments par défaut

Actifs par défaut dans cet ordre :

```text
Chant
Guitare
Basse
Batterie
Piano
Autres
```

## Ajout instrument custom

L’organisateur peut ajouter un instrument avec un nom.

En V0 :

- l’instrument custom appartient uniquement à cette jam ;
- il devient une colonne du tableau.

## Édition jam

En mode édition, afficher aussi :

- nombre de musiciens uniques ;
- nombre de participations instrumentales ;
- nombre de plateaux joués ;
- nombre de participations instrumentales actives n’ayant jamais joué.

---

# 18. États réseau et sync

## Principe

Pendant une jam :

- l’action est appliquée localement immédiatement ;
- elle est stockée dans Dexie ;
- elle est envoyée au backend ;
- si le backend échoue, local reste source de vérité ;
- retry régulier.

## Indicateur UI

Prévoir un indicateur discret :

```text
Synchronisé
Synchronisation en attente
Hors ligne — sauvegarde locale
Erreur de synchronisation
```

## Ne pas bloquer inutilement

Ne bloque pas l’organisateur pendant une jam à cause du réseau, sauf conflit multi-appareil.

## Multi-appareil V0

En V0 :

- bloquer l’édition simultanée d’une même jam sur deux appareils ;
- ne pas développer de résolution de conflit.

---

# 19. Backend Django

## Apps

App principale :

```text
jams
```

Project Django :

```text
config
```

## Models attendus

Créer les modèles principaux :

```text
Jam
Instrument
Participant
ParticipantEntry
LinkGroup
Hole
PlayedPassage
ClientAction
```

## Admin

Tous les modèles principaux doivent être enregistrés dans Django admin.

Admin utile :

- list_display ;
- search_fields ;
- list_filter ;
- ordering.

## API minimale V0

Endpoints attendus :

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

## Idempotence

Chaque action envoyée par le frontend contient :

```text
client_action_id
```

Le backend doit refuser ou ignorer proprement une action déjà appliquée.

Ne jamais appliquer deux fois la même action.

---

# 20. Moteur de tableau

## Emplacement

```text
frontend/src/features/jamTable/engine/
```

## Fichiers

```text
projectJamTable.js
applyJamAction.js
actionTypes.js
selectors.js
__tests__/
```

## Principe

Le moteur est pur :

```text
jamState + actions → projectedTable
```

## Interdictions

Le moteur ne doit pas importer :

- React ;
- MUI ;
- Zustand ;
- Dexie ;
- API backend ;
- DOM.

## Responsabilités

Le moteur calcule :

- lignes visibles ;
- colonnes ;
- cartes ;
- boucles ;
- tags boucle ;
- links ;
- trous ;
- joué ;
- participants partis ;
- prochains musiciens jouables ;
- remplaçants disponibles ;
- stats principales.

---

# 21. Actions métier

Liste d’actions à utiliser :

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

Ne crée pas plusieurs noms différents pour la même action.

---

# 22. État local frontend

## Zustand

Utilise Zustand pour :

- jam courante ;
- mode link ;
- drawers ouverts ;
- action en cours ;
- état drag ;
- état de sync ;
- projection courante si nécessaire.

## TanStack Query

Utilise TanStack Query pour :

- fetch jams ;
- fetch jam detail ;
- mutations backend ;
- refetch ;
- retry réseau ;
- invalidation.

## Dexie

Utilise Dexie pour :

- cache local jam ;
- actions pending ;
- état sync ;
- reprise après refresh.

---

# 23. Tests

## Frontend

Utilise :

```text
Vitest
React Testing Library
```

Tests moteur prioritaires :

- ajout participant ;
- ajout participant avant boucle ;
- boucle simple ;
- boucle avec nouveau participant ;
- trou manuel ;
- trou via “veux jouer sans” ;
- link simple ;
- link avec trou ;
- déplacement vertical ;
- déplacement groupe lié ;
- marquer joué ;
- annuler joué ;
- plateau joué ;
- participant parti ;
- remplaçant indisponible ;
- remplaçant linké.

Tests UI prioritaires :

- carte normale ;
- carte jouée ;
- carte boucle ;
- carte trou ;
- carte liée ;
- bouton appel ;
- bouton plateau joué ;
- drawer appel ;
- insertion entre deux cartes.

## Backend

Utilise :

```text
pytest
pytest-django
```

Tests backend prioritaires :

- création jam ;
- édition jam ;
- nom participant unique ;
- action idempotente ;
- récupération jam complète ;
- lock édition multi-appareil ;
- admin models importables.

---

# 24. Accessibilité et usage en soirée

L’app est utilisée en bar, dans le bruit, souvent rapidement.

Priorités :

- grands tap targets ;
- actions importantes visibles ;
- confirmations pour actions dangereuses ;
- textes courts ;
- contrastes suffisants ;
- feedback immédiat ;
- pas d’interaction fragile.

## Tap targets

Les boutons importants doivent être facilement cliquables sur mobile.

Évite les icônes trop petites.

## Textes

Wording simple :

```text
A joué
Plateau joué
N’est pas disponible
Veux jouer sans…
Marquer comme parti
Annuler le passage
Sans batterie
```

## Feedback

Après une action :

- mettre à jour l’UI immédiatement ;
- afficher snackbar seulement si utile ;
- ne pas spammer les snackbars pour chaque micro-action.

---

# 25. Performance

Le tableau peut devenir long.

Règles :

- éviter les recalculs inutiles ;
- mémoriser les projections si nécessaire ;
- garder le moteur pur et efficace ;
- ne pas faire de logique lourde dans le render ;
- limiter les re-renders des cartes ;
- utiliser des keys stables.

Si le tableau devient très long, envisager virtualisation plus tard, mais ne pas complexifier la V0 sans besoin.

---

# 26. Qualité de code

## Général

- code lisible ;
- fonctions courtes ;
- noms explicites ;
- pas de duplication inutile ;
- pas de fichiers énormes ;
- pas de logique métier cachée dans les composants.

## React

- composants petits ;
- hooks dédiés si logique réutilisable ;
- pas de state global inutile ;
- pas de props drilling excessif ;
- pas de `useEffect` pour dériver ce qui peut être calculé directement.

## Django

- models propres ;
- serializers explicites ;
- services pour logique métier ;
- views simples ;
- tests pour services ;
- admin utile.

## Erreurs

- gérer les erreurs utilisateur clairement ;
- pas de `console.log` permanent ;
- logs backend utiles ;
- messages d’erreur courts côté UI.

---

# 27. Sécurité minimale

Même en V0 sans auth :

- ne fais pas confiance aux données frontend ;
- valide côté backend ;
- protège l’admin Django ;
- utilise variables d’environnement pour secrets ;
- ne commit pas de secrets ;
- configure CORS proprement ;
- prépare la séparation dev/prod.

---

# 28. Documentation

Quand tu ajoutes ou modifies une règle importante, mets à jour :

- `docs/product-spec.md` pour le métier ;
- `docs/visual-spec-table-cards.md` pour l’UI ;
- `docs/technical-stack.md` pour la stack ;
- `docs/data-model.md` pour les modèles ;
- `docs/table-engine.md` pour le moteur ;
- `docs/sync-strategy.md` pour la sync.

Ne laisse pas la doc diverger du code.

---

# 29. Méthode de travail Codex

Avance par phases.

Ne fais pas tout en une seule réponse ou un seul énorme patch.

Ordre recommandé :

1. setup monorepo ;
2. setup frontend MUI + theme ;
3. setup backend Django ;
4. docs initiales ;
5. moteur tableau pur + tests ;
6. UI tableau fake data ;
7. actions locales Zustand ;
8. drawers principaux ;
9. backend models/API ;
10. Dexie + sync ;
11. polish responsive ;
12. tests finaux.

À chaque étape :

- expliquer ce qui a changé ;
- lister les fichiers modifiés ;
- indiquer les commandes de test ;
- signaler les limites restantes.

---

# 30. Commandes attendues

## Frontend

```bash
cd frontend
npm install
npm run dev
npm run test
npm run build
```

## Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
pytest
```

---

# 31. Checklist avant validation d’un patch

Avant de considérer une tâche terminée :

- le code compile ;
- les tests pertinents passent ;
- aucune valeur visuelle globale n’est hardcodée ;
- aucune logique métier de tableau n’est cachée dans le JSX ;
- pas de TypeScript ;
- pas de drag horizontal ;
- les docs concernées sont mises à jour ;
- les fichiers morts sont supprimés ;
- les erreurs utilisateur sont lisibles ;
- l’UI reste mobile-first ;
- MUI est utilisé autant que possible.

---

# 32. Résumé des décisions verrouillées

```text
Produit : Confiture
URL : confiture.live
Repo : confiture.live
Frontend : React + JavaScript + MUI
Backend : Django + DRF
Pas de TypeScript
Pas de drag horizontal
Drag vertical : long press + drag
Design system : frontend/src/theme/designTokens.js
V0 : sans auth
V1 : auth organisateur
V0 : toutes les jams visibles
Tri jams : date indicative
Tableau : header = nom de colonne uniquement
Colonne gauche : appel + plateau joué
Check : visible uniquement pour les prochains musiciens jouables
Boucle : tag bleu “🔁 2”
Trous : volontaires, linkables, non bouclés
Participant parti : futur supprimé, historique conservé
Sync : local first avec Dexie + retry backend
Multi-appareil V0 : édition simultanée bloquée
Moteur tableau : pur, testé, indépendant de React/MUI
```
