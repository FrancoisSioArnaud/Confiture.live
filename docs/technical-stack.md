# Stack technique — Jam Organizer

## Objectif

Application mobile/tablette pour organisateurs de jam session.

Le produit doit permettre de gérer une jam en direct : participants, instruments, tableau de passage, liens entre musiciens, trous volontaires, boucles, passages joués, remplacement d’un musicien indisponible et synchronisation locale/backend.

La stack doit rester simple, robuste, testable et adaptée à une utilisation en soirée avec réseau potentiellement instable.

---

## Stack recommandée

```text
Backend
- Django
- Django REST Framework
- PostgreSQL
- django-cors-headers
- Django admin
- Django auth à partir de la V1
- pytest + pytest-django

Frontend
- React
- MUI
- React Router
- TanStack Query
- Zustand
- Dexie.js
- dnd-kit
- React Hook Form
- Zod
- date-fns
- Vitest
- React Testing Library

Infra
- Ubuntu VPS
- Nginx
- Gunicorn
- PostgreSQL
```

---

## Backend

### Django

Django sert de base backend principale.

Rôles :

- exposer l’API ;
- gérer les jams ;
- gérer les participants ;
- gérer les instruments ;
- persister les actions ;
- fournir une interface admin ;
- préparer l’authentification organisateur pour la V1.

### Django REST Framework

DRF sert à exposer les endpoints utilisés par le frontend React.

Endpoints probables :

- liste des jams ;
- détail d’une jam ;
- création / édition jam ;
- création / édition participant ;
- actions de tableau ;
- état de synchronisation ;
- récupération d’une jam complète.

### PostgreSQL

PostgreSQL est recommandé dès le début plutôt que SQLite.

Raisons :

- meilleure fiabilité ;
- données relationnelles complexes ;
- historique d’actions ;
- future auth organisateur ;
- sync locale/backend ;
- meilleure base pour évoluer.

### Django admin

L’admin Django sera utile pour inspecter rapidement :

- jams ;
- participants ;
- instruments ;
- passages joués ;
- actions synchronisées ;
- erreurs de sync ;
- état des données en prod.

### Authentification

Décision produit actuelle :

- V0 : pas d’authentification obligatoire, on affiche toutes les jams du service.
- V1 : compte organisateur.

Pour la V1, privilégier :

- magic link email ;
- éventuellement email + mot de passe plus tard ;
- Google/Apple login non prioritaire.

---

## Frontend

### React

React sert de base frontend.

L’app doit être responsive mobile/tablette, avec la même logique UI sur les deux formats.

### MUI

MUI doit être utilisé autant que possible pour :

- Drawer ;
- Dialog ;
- IconButton ;
- Menu ;
- Chip ;
- Snackbar ;
- TextField ;
- Button ;
- Checkbox ;
- List ;
- useMediaQuery ;
- layout responsive.

Objectif : limiter le CSS custom aux parties spécifiques du tableau et des cartes.

### React Router

Routes probables :

```text
/
  Liste des jams

/jams/new
  Création d’une jam

/jams/:jamId
  Tableau de gestion de la jam

/jams/:jamId/edit
  Édition de la jam

/jams/:jamId/participants/:participantId/edit
  Édition participant, si page dédiée nécessaire
```

Les créations/éditions peuvent aussi être gérées par drawers selon l’UX finale.

### TanStack Query

TanStack Query sert à :

- lire les données backend ;
- gérer le cache ;
- gérer les retries ;
- gérer les mutations ;
- resynchroniser après reconnexion ;
- invalider les données après action.

Important : les actions de jam doivent d’abord être appliquées localement, puis synchronisées au backend.

### Zustand

Zustand sert à gérer l’état frontend complexe du tableau.

À utiliser pour :

- jam courante ;
- projection du tableau ;
- mode link ;
- drawer ouvert ;
- action en cours ;
- drag en cours ;
- état de sync ;
- queue locale d’actions si nécessaire en complément de Dexie.

Zustand est plus simple que Redux Toolkit pour ce projet.

### Dexie.js

Dexie.js est recommandé pour le stockage local via IndexedDB.

Il sert à garantir que la jam reste utilisable même avec un réseau instable.

Tables locales probables :

```text
jams
participants
participant_entries
instruments
links
holes
played_passages
pending_actions
sync_state
```

Règle produit :

- pendant la jam, l’état local est la source de vérité si le backend est indisponible ;
- chaque action est persistée localement immédiatement ;
- chaque action est envoyée au backend dès que possible ;
- en cas d’échec backend, l’action reste dans `pending_actions` ;
- retry régulier jusqu’à succès.

### dnd-kit

dnd-kit sert au drag and drop vertical.

Règles :

- drag uniquement vertical ;
- jamais de drag horizontal ;
- interaction : long press + drag ;
- pas d’affordance visuelle obligatoire ;
- les cartes jouées ne bougent pas ;
- les groupes liés se déplacent ensemble ;
- les trous linkés suivent leur groupe.

### React Hook Form

React Hook Form est recommandé pour les formulaires :

- création jam ;
- édition jam ;
- création participant ;
- édition participant ;
- ajout instrument custom ;
- choix multi-instruments ;
- section “faire passer en même temps”.

### Zod

Zod sert à valider les formulaires.

Validations importantes :

- nom de jam requis ;
- nom participant requis ;
- deux participants ne peuvent pas avoir exactement le même nom dans une jam ;
- au moins un instrument sélectionné ;
- nom d’instrument custom requis ;
- pas de doublon d’instrument custom dans une même jam.

### date-fns

date-fns sert à :

- afficher les dates indicatives ;
- trier les jams par date indicative ;
- formater les dates ;
- éviter une grosse dépendance type moment.js.

---

## Moteur de tableau

Le cœur technique du produit est le moteur de projection du tableau.

Il doit être écrit comme un module pur, testable indépendamment de React.

Principe :

```text
jamState + actions → projectedTable
```

Il prend un état source et produit les lignes visibles du tableau.

### État source

Exemples de données source :

```text
Jam
- id
- name
- indicative_date
- instruments_order

Instrument
- id
- name
- order

Participant
- id
- name
- status: active | left

ParticipantEntry
- id
- participant_id
- instrument_id
- custom_instrument_label
- base_order
- status

LinkGroup
- id
- entry_ids
- hole_ids

Hole
- id
- instrument_id
- linked_to
- position
- played

PlayedPassage
- id
- entry_id ou hole_id
- line_index
- played_at

Action
- id
- type
- payload
- created_at
- synced_at
```

### Actions principales

```text
CREATE_JAM
UPDATE_JAM
ADD_INSTRUMENT
REORDER_INSTRUMENTS
ADD_PARTICIPANT
UPDATE_PARTICIPANT
ADD_PARTICIPANT_INSTRUMENT
MOVE_ENTRY_VERTICAL
LINK_ENTRIES
UNLINK_ENTRIES
ADD_HOLE
REMOVE_HOLE
WANTS_TO_PLAY_WITHOUT
MARK_ENTRY_PLAYED
MARK_PLATEAU_PLAYED
UNDO_ENTRY_PLAYED
MARK_PARTICIPANT_LEFT
REPLACE_UNAVAILABLE
```

### Règles importantes

- les colonnes sont indépendantes par défaut ;
- chaque colonne est une file d’attente ;
- chaque musicien ajouté se place à la suite de sa colonne, avant les répétitions ;
- les boucles réaffichent les musiciens actifs après leur première rotation ;
- les trous ne font pas partie des boucles ;
- les cartes jouées restent en historique et ne bougent plus ;
- les musiciens marqués comme partis disparaissent des futurs passages ;
- leurs passages déjà joués restent visibles ;
- les links alignent les entrées sur une même ligne ;
- en V0, le link remonte les entrées les plus en retard vers la plus avancée ;
- les déplacements poussent les cartes non jouées ;
- le drag est uniquement vertical dans une colonne.

---

## Synchronisation

### Principe

Chaque action utilisateur doit être :

1. appliquée immédiatement à l’état local ;
2. enregistrée dans Dexie ;
3. ajoutée à une file `pending_actions` ;
4. envoyée au backend ;
5. marquée comme synchronisée si le backend confirme.

### Source de vérité

Pendant la jam :

- si le backend est disponible : local et backend restent alignés ;
- si le backend est indisponible : local devient source de vérité temporaire ;
- l’app retente régulièrement la synchronisation.

### Idempotence

Chaque action doit avoir un identifiant unique côté client :

```text
client_action_id
```

Le backend doit ignorer une action déjà appliquée.

Objectif : éviter les doublons en cas de retry.

### Multi-appareil

Décision V0 :

- on bloque l’usage multi-appareil pour une même jam en édition active.

But :

- éviter les conflits ;
- éviter une logique de résolution complexe ;
- garder la V0 simple.

Une version future pourra gérer les conflits ou le temps réel.

---

## Tests

### Frontend

Outils :

- Vitest ;
- React Testing Library.

Tests prioritaires :

- moteur de projection ;
- boucles ;
- ajout participant ;
- déplacement vertical ;
- links ;
- trous ;
- “veux jouer sans” ;
- “n’est pas disponible” ;
- marquer comme joué ;
- annuler joué ;
- marquer comme parti ;
- queue de sync locale.

### Backend

Outils :

- pytest ;
- pytest-django.

Tests prioritaires :

- modèles ;
- endpoints principaux ;
- idempotence des actions ;
- persistance des actions ;
- récupération d’une jam complète ;
- blocage multi-appareil V0 ;
- auth V1 plus tard.

---

## Déploiement

Déploiement simple recommandé :

```text
Ubuntu VPS
Nginx
Gunicorn
Django
React build statique
PostgreSQL
```

Django peut servir l’API, et Nginx peut servir le build React.

Approche similaire à MusikMap.

---

## Librairies principales à installer

### Backend

```bash
pip install django djangorestframework django-cors-headers psycopg[binary] gunicorn pytest pytest-django
```

### Frontend

```bash
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material
npm install react-router-dom @tanstack/react-query zustand dexie @dnd-kit/core @dnd-kit/sortable
npm install react-hook-form zod @hookform/resolvers date-fns
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

---

## Décision finale recommandée

Stack à retenir :

```text
Django + DRF + PostgreSQL
React + MUI
TanStack Query
Zustand
Dexie.js
dnd-kit
React Hook Form + Zod
date-fns
Vitest + pytest-django
Nginx + Gunicorn
```

Le point à sécuriser en priorité est le moteur de projection du tableau.

Il doit être développé comme une logique pure, testée à fond, avant de trop investir dans les détails visuels.
