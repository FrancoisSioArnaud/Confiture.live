# Seed Demo Data — Confiture.live

## 1. Objectif

Ce document définit les données de démonstration à créer pour développer, tester et valider visuellement Confiture.live.

Les seeds doivent permettre de vérifier rapidement :

- l'affichage du tableau par colonnes ;
- les rounds visibles ;
- les links ;
- les conflicts ;
- les holes ;
- le played ;
- le lock ;
- le drawer participant ;
- le drawer d'appel ;
- les remplacements ;
- le skip ;
- le participant parti ;
- l'instrument masqué ;
- l'undo ;
- la sync pending/offline en dev.

Les seeds doivent être écrits comme des transactions/events, pas comme un état de tableau déjà projeté.

---

## 2. Règles générales

### 2.1 Les seeds doivent utiliser l'event-sourcing

Interdit : injecter directement des colonnes, lignes ou cards projetées.

Attendu :

```text
JamTransaction[]
JamEvent[]
JamSnapshot optionnel
```

Le tableau doit être obtenu uniquement par le moteur de projection.

### 2.2 Les IDs doivent être stables et lisibles

Utiliser des IDs déterministes pour faciliter le debug.

Exemples :

```text
jam_demo_simple
participant_nicolas
participation_nicolas_guitar
appearance_nicolas_guitar_r1
hole_drums_without_paul_r1
tx_demo_simple_001
evt_demo_simple_001
```

### 2.3 Chaque seed doit avoir un but clair

Chaque jam de démo doit cibler un ensemble de comportements précis.

Ne pas créer une seule jam énorme pour tout tester. Il faut plusieurs jams ciblées.

### 2.4 Les seeds doivent être rejouables

La commande doit pouvoir supprimer et recréer les seeds proprement.

Commandes recommandées :

```bash
python manage.py seed_demo_jams
python manage.py seed_demo_jams --reset
python manage.py seed_demo_jams --only simple
python manage.py seed_demo_jams --only rounds
python manage.py seed_demo_jams --only links
python manage.py seed_demo_jams --only multi
python manage.py seed_demo_jams --only complex
```

### 2.5 Les seeds ne doivent pas dépendre d'une date réelle

Utiliser des dates indicatives fixes ou relatives contrôlées.

Exemple :

```text
2026-01-15
2026-01-16
2026-01-17
```

---

## 3. Format recommandé

Chaque seed doit être construit comme :

```js
{
  jamId: "jam_demo_simple",
  label: "Jam simple — 4 instruments",
  transactions: [
    {
      transactionId: "tx_demo_simple_001",
      label: "Create jam",
      clientSequenceNumber: 1,
      events: [
        {
          eventId: "evt_demo_simple_001",
          type: "jam_created",
          payload: {
            jamId: "jam_demo_simple",
            name: "Jam simple — 4 instruments",
            indicativeDate: "2026-01-15",
            linkReorderStrategy: "move_to_first"
          }
        }
      ]
    }
  ]
}
```

En base Django, cela peut être transformé en :

```text
Jam
JamTransaction
JamEvent
JamSnapshot optionnel
```

---

## 4. Instruments de référence

Utiliser ces instruments par défaut dans la majorité des seeds :

```text
instrument_vocals   — Chant
instrument_guitar   — Guitare
instrument_bass     — Basse
instrument_drums    — Batterie
instrument_piano    — Piano
instrument_other    — Autre
```

Ordre par défaut :

```text
1. Chant
2. Guitare
3. Basse
4. Batterie
5. Piano
6. Autre
```

---

## 5. Participants de référence

Réutiliser ces noms dans les seeds pour faciliter la lecture :

```text
Sarah
Nicolas
Tom
Jérémy
Léa
Paul
Max
Rayan
Alice
Hugo
Emma
Jules
Julie
Maya
Noé
Inès
Yanis
Camille
```

Pour `Autre`, utiliser :

```text
Hugo — saxophone
Maya — trompette
Noé — violon
```

---

# Seed 1 — Jam simple

## 1. Identité

```text
jamId: jam_demo_simple
name: Jam simple — 4 instruments
purpose: tester l'affichage basique du tableau
```

## 2. Instruments

```text
Chant
Guitare
Basse
Batterie
```

## 3. Participants

```text
Sarah  — Chant
Nicolas — Guitare
Tom    — Basse
Jérémy — Batterie
Léa    — Chant
Paul   — Guitare
Max    — Basse
Rayan  — Batterie
```

## 4. Transactions attendues

```text
tx_001 jam_created
tx_002 instrument_added Chant
tx_003 instrument_added Guitare
tx_004 instrument_added Basse
tx_005 instrument_added Batterie
tx_006 participant_created Sarah + participation_added Chant
tx_007 participant_created Nicolas + participation_added Guitare
tx_008 participant_created Tom + participation_added Basse
tx_009 participant_created Jérémy + participation_added Batterie
tx_010 participant_created Léa + participation_added Chant
tx_011 participant_created Paul + participation_added Guitare
tx_012 participant_created Max + participation_added Basse
tx_013 participant_created Rayan + participation_added Batterie
```

## 5. Résultat visuel attendu

```text
Plateau 1:
Chant Sarah | Guitare Nicolas | Basse Tom | Batterie Jérémy

Plateau 2:
Chant Léa | Guitare Paul | Basse Max | Batterie Rayan
```

## 6. À vérifier

```text
- colonnes affichées dans le bon ordre
- cards appearance simples
- aucun link
- aucun conflict manuel
- aucun hole
- aucun played
- aucun lock
```

---

# Seed 2 — Jam rounds

## 1. Identité

```text
jamId: jam_demo_rounds
name: Jam rounds — ajout après reveal
purpose: tester visible rounds, loops et ajout tardif
```

## 2. Instruments

```text
Chant
Guitare
Basse
Batterie
```

## 3. Participants initiaux

```text
Sarah  — Chant
Nicolas — Guitare
Tom    — Basse
Jérémy — Batterie
Léa    — Chant
Paul   — Guitare
Max    — Basse
Rayan  — Batterie
```

## 4. Actions spécifiques

```text
instrument_round_visibility_changed Guitare visibleRoundCount=2
instrument_round_visibility_changed Batterie visibleRoundCount=2
participant_created Julie + participation_added Julie/Guitare standard
participant_created Emma + participation_added Emma/Batterie insertedBetween dans round 2
```

## 5. Résultat attendu

```text
Guitare:
Round 1: Nicolas, Paul, Julie
Round 2: Nicolas, Paul, Julie

Batterie:
Round 1: Jérémy, Rayan
Round 2: Jérémy, Emma, Rayan ou Jérémy, Rayan, Emma selon position ciblée dans le seed
```

Règle importante :

```text
Julie est ajoutée standard après reveal round 2 : elle apparaît fin round 1 et fin round 2.
Emma est ajoutée entre deux cards du round 2 : elle démarre au round 2, sans appearance rétroactive round 1.
```

## 6. À vérifier

```text
- bouton afficher round suivant
- apparition animée du round 2
- ajout standard sur rounds visibles
- ajout entre cards dans round 2
- pas d'appearance rétroactive si insertion ciblée round 2
```

---

# Seed 3 — Jam links et conflicts

## 1. Identité

```text
jamId: jam_demo_links_conflicts
name: Jam links et conflicts
purpose: tester mode link, mode conflict et réorganisation
```

## 2. Instruments

```text
Chant
Guitare
Basse
Batterie
Piano
```

## 3. Participants

```text
Sarah  — Chant
Nicolas — Guitare
Tom    — Basse
Jérémy — Batterie
Léa    — Chant
Paul   — Guitare
Max    — Basse
Rayan  — Batterie
Alice  — Piano
Hugo   — Guitare
```

## 4. Actions spécifiques

```text
link_created Nicolas/Guitare/r1 + Jérémy/Batterie/r1
link_created Léa/Chant/r1 + Paul/Guitare/r1 + Alice/Piano/r1
conflict_created scope=appearance reason=manual Sarah/Chant/r1 + Hugo/Guitare/r1
```

## 5. Résultat attendu

```text
- Nicolas et Jérémy sont alignés sur le même plateau
- Léa, Paul et Alice sont alignés sur le même plateau
- Sarah et Hugo ne sont pas sur le même plateau
- les cards déplacées restent dans leur colonne
- aucun drag horizontal n'est utilisé
```

## 6. Feedback attendu en UI

```text
- cards linkées avec icône link état lié
- snackbar si des cards sont déplacées après link
- snackbar explicative si un link est refusé par conflict
- animation de déplacement 800–1000 ms
```

---

# Seed 4 — Jam multi-instruments

## 1. Identité

```text
jamId: jam_demo_multi_instruments
name: Jam multi-instruments
purpose: tester Participant / Participation / Appearance
```

## 2. Instruments

```text
Chant
Guitare
Basse
Batterie
Piano
```

## 3. Participants

```text
Nicolas — Chant + Guitare + Basse
Sarah   — Chant + Piano
Tom     — Basse + Batterie
Léa     — Chant
Jérémy  — Batterie
Paul    — Guitare
Alice   — Piano
```

## 4. Actions spécifiques

```text
conflict_created scope=participation reason=instrument_constraint Nicolas/Guitare + Nicolas/Basse
conflict_created scope=participation reason=instrument_constraint Tom/Basse + Tom/Batterie
link_created Nicolas/Chant/r1 + Nicolas/Guitare/r1
instrument_round_visibility_changed Chant visibleRoundCount=2
instrument_round_visibility_changed Guitare visibleRoundCount=2
link_created Nicolas/Guitare/r2 + Sarah/Piano/r1
```

## 5. Résultat attendu

```text
- Nicolas a plusieurs participations
- Nicolas/Chant/r1 et Nicolas/Guitare/r1 peuvent être linkés
- Nicolas/Guitare/r2 peut avoir un link différent de Nicolas/Guitare/r1
- conflict participation-level empêche les impossibilités structurelles
- les rounds sont indépendants
```

## 6. À vérifier

```text
- distinction Participant / Participation / Appearance
- links sur appearances
- conflicts sur participations
- no propagation automatique des links vers les rounds suivants
```

---

# Seed 5 — Jam live complexe

## 1. Identité

```text
jamId: jam_demo_complex
name: Jam live complexe
purpose: tester les cas réels d'une soirée
```

## 2. Instruments

```text
Chant
Guitare
Basse
Batterie
Piano
Autre
```

## 3. Participants

```text
Sarah   — Chant
Nicolas — Guitare
Tom     — Basse
Jérémy  — Batterie
Léa     — Chant
Paul    — Guitare
Max     — Basse
Rayan   — Batterie
Alice   — Piano
Hugo    — Autre / saxophone
Emma    — Chant + Guitare
Jules   — Basse + Batterie
Julie   — Piano
Maya    — Autre / trompette
```

## 4. Actions spécifiques

```text
plateau_played plateau 1
appearance_locked Nicolas/Guitare/r2
hole_added Batterie/r2
link_created Emma/Chant/r1 + Emma/Guitare/r1
hole_added Basse/r1 pour “Paul veut jouer sans basse”
link_created Paul/Guitare/r1 + hole Basse/r1
appearance_skipped Alice/Piano/r1
replacement_selected Julie/Piano prend la place de Alice/Piano/r1
participant_marked_left Hugo
instrument_visibility_changed Autre visible=false
transaction_reverted dernière transaction active
```

## 5. Résultat attendu

```text
- plateau 1 est grisé et immobile
- Nicolas/Guitare/r2 est locké et immobile
- hole Batterie/r2 est visible
- Emma chant/guitare est alignée
- Paul joue avec un hole en Basse
- Alice est repoussée après skip/remplacement
- Julie prend la place dans le plateau courant
- Hugo n'a plus de futures appearances
- instrument Autre peut être masqué puis restauré par undo
```

## 6. À vérifier

```text
- played figé
- locked figé
- hole affiché et supprimable si non played
- dialog suppression hole/appearance mentionne les links
- skip delink si besoin
- remplacement via drawer d'appel
- “faire sans musicien” disponible
- participant left retire futures appearances
- instrument masqué absent tableau + drawer d'appel
- undo linéaire visible
```

---

# Seed 6 — Jam sync pending/offline

## 1. Identité

```text
jamId: jam_demo_sync_pending
name: Jam sync pending/offline
purpose: tester l'état local-first et l'indicateur de sync
```

## 2. Principe

Ce seed peut être côté frontend uniquement ou via un flag dev.

Il doit simuler :

```text
- jam chargée depuis backend
- actions locales créées
- backend temporairement indisponible
- transactions pending dans IndexedDB
- retour backend
- retry et sync réussie
```

## 3. Actions à simuler

```text
participant_created Camille + participation_added Chant
link_created Camille/Chant/r1 + Paul/Guitare/r1
hole_added Batterie/r1
```

## 4. États UI attendus

```text
- indicateur sync positif mais warning : “Sauvegardé sur cet appareil”
- aucune snackbar répétitive à chaque retry
- l'organisateur peut continuer à agir
- après retry réussi : “Synchronisé”
```

---

## 6. Données minimales par event

Chaque event seedé doit inclure au minimum :

```js
{
  eventId: "evt_...",
  jamId: "jam_...",
  transactionId: "tx_...",
  type: "...",
  payload: {},
  clientId: "demo_seed",
  schemaVersion: 1,
  createdAt: "2026-01-15T20:00:00.000Z"
}
```

Chaque transaction seedée doit inclure :

```js
{
  transactionId: "tx_...",
  jamId: "jam_...",
  label: "Human-readable label for debug",
  clientId: "demo_seed",
  clientSequenceNumber: 1,
  serverSequenceNumber: 1,
  status: "synced",
  createdAt: "2026-01-15T20:00:00.000Z"
}
```

---

## 7. Commande Django recommandée

Créer une commande :

```text
backend/jams/management/commands/seed_demo_jams.py
```

Options :

```bash
python manage.py seed_demo_jams
python manage.py seed_demo_jams --reset
python manage.py seed_demo_jams --only simple
python manage.py seed_demo_jams --only rounds
python manage.py seed_demo_jams --only links
python manage.py seed_demo_jams --only multi
python manage.py seed_demo_jams --only complex
python manage.py seed_demo_jams --only sync
```

Comportement :

```text
- --reset supprime uniquement les jams demo dont id/slug commence par jam_demo_
- sans --reset, la commande doit être idempotente
- --only limite la création à une seed précise
```

---

## 8. Outils dev frontend recommandés

Optionnel, contrôlé par variable d'environnement :

```text
VITE_ENABLE_DEMO_TOOLS=true
```

Si activé, l'UI peut afficher :

```text
- bouton “Charger une jam de démo”
- bouton “Simuler offline”
- bouton “Simuler sync retry”
```

Ces outils ne doivent jamais apparaître en production.

---

## 9. Critères de validation des seeds

Après exécution des seeds :

```text
- toutes les jams apparaissent dans la liste
- chaque jam s'ouvre sans erreur
- le moteur de projection ne retourne aucun warning bloquant
- les warnings non bloquants sont affichables en mode debug
- les cards apparaissent dans l'ordre attendu
- les buttons link/lock/menu sont visibles
- les drawers fonctionnent sur au moins une jam complexe
```

---

## 10. Ce qu'il ne faut pas seeder en V0

Ne pas inclure :

```text
- utilisateurs authentifiés organisateurs
- QR code participant
- inscriptions participants depuis téléphone externe
- paiements
- emails
- analytics
- exports PDF/CSV
- multi-client temps réel concurrent
```

Ces sujets ne sont pas dans la V0 from scratch.

