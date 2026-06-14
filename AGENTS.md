# AGENTS.md — Instructions globales pour Codex

## 1. Rôle de ce fichier

Ce fichier est le contrat de travail racine pour tout agent de code intervenant sur le repo Confiture.live.

Le repo peut démarrer from scratch avec uniquement un dossier `docs/`. Codex doit créer l'application complète en respectant strictement les specs présentes dans `docs/`.

Ce fichier prime sur les intuitions de l'agent, mais ne remplace pas les specs métier détaillées. En cas de doute, lire les docs concernées puis choisir l'option la plus simple, la plus déterministe et la plus testable.

---

## 2. Objectif produit

Confiture.live est une application mobile/tablette pour organisateurs de jam sessions.

L'objectif est de gérer en direct :

- les jams ;
- les instruments ;
- les participants ;
- les participations instrumentales ;
- les appearances par round ;
- les holes/trous ;
- les links ;
- les conflicts ;
- les passages joués ;
- les remplacements depuis le drawer d'appel ;
- l'undo ;
- la synchronisation local-first.

Le produit doit fonctionner pendant une jam réelle, avec peu de temps, du bruit, et parfois un réseau instable.

---

## 3. Ordre obligatoire de lecture des specs

Avant de coder une feature, lire les docs dans cet ordre :

1. `docs/product-spec.md`
2. `docs/technical-stack.md`
3. `docs/confiture_event_actions_spec.md`
4. `docs/data_model.md`
5. `docs/event-payloads-reference.md`
6. `docs/projection-engine-spec.md`
7. `docs/sync_strategy.md`
8. `docs/backend-api-contract.md`
9. `docs/frontend-architecture.md`
10. `docs/visual_spec_table.md`
11. `docs/visual_spec_table_cards.md`
12. `docs/drawer-participant-spec.md`
13. `docs/drawer-call-spec.md`
14. `docs/ux-feedback-spec.md`
15. `docs/testing-strategy.md`
16. `docs/seed-demo-data.md`
17. `implementation-plan.md`
18. `repo-structure.md`

Quand une tâche concerne seulement un périmètre précis, lire au minimum le fichier global produit, le fichier technique, puis les fichiers spécialisés liés à la tâche.

---

## 4. Règles non négociables

### 4.1 Event-sourcing

La source de vérité métier est l'historique des transactions et events.

Ne jamais utiliser l'état visuel du tableau comme source de vérité durable.

Flux obligatoire :

```text
JamTransaction[] + JamEvent[] + snapshot optionnel
→ projection déterministe
→ affichage UI
```

### 4.2 Projection pure

Le moteur de projection doit être un module pur, sans dépendance à React, MUI, API, Dexie ou Django.

Il doit pouvoir être testé ainsi :

```text
input: eventLog + snapshot optionnel
output: projectedJamState
```

Aucune logique métier critique ne doit être codée directement dans les composants React.

### 4.3 Transactions

Une action UI produit une transaction.
Une transaction contient un ou plusieurs events.

Exemples :

- “ajouter participant” peut créer `participant_created` + plusieurs `participation_added` + conflicts automatiques ;
- “jouer sans musicien” crée `hole_added` + `link_created` ;
- “undo” crée `transaction_reverted`.

### 4.4 Undo linéaire

L'undo est linéaire.

Pour annuler une transaction 4, toutes les transactions actives 5, 6, 7 doivent déjà avoir été annulées.

Ne pas implémenter d'undo arbitraire dans le passé.

### 4.5 Un seul client actif

En V0, une seule session peut éditer une jam en temps réel.

Le serveur gère une lease/session active.
Un second client peut voir la jam en lecture seule ou demander à reprendre le contrôle selon `sync_strategy.md`.

Ne pas implémenter de merge multi-client en V0.

### 4.6 Local-first

Chaque action doit être appliquée localement immédiatement, persistée en IndexedDB/Dexie, puis synchronisée au backend.

Le réseau ne doit pas bloquer l'organisateur pendant la jam.

Si la sync échoue, l'app reste utilisable avec un indicateur positif/discret de sauvegarde locale.

---

## 5. Modèle métier à respecter

### Entités conceptuelles

```text
Jam
Instrument
Participant
Participation
Appearance
Hole
Link
Conflict
Lock
Transaction
Event
Snapshot
ClientSession
```

### Définitions

- `Participant` = une personne.
- `Participation` = inscription d'un participant sur un instrument.
- `Appearance` = occurrence concrète d'une participation dans un round.
- `Hole` = slot sans musicien, équivalent visuel d'une appearance sans participant.
- `Link` = contrainte d'alignement entre targets, par exemple appearances et/ou holes.
- `Conflict` = incompatibilité entre participations ou appearances.
- `Lock` = verrouillage strict d'une appearance ou d'un hole.
- `Played` = historique figé, immobile.

---

## 6. UI non négociable

### 6.1 Tableau

- Les colonnes représentent les instruments.
- Les lignes déduites représentent les plateaux.
- Pas de drag horizontal.
- Drag vertical uniquement dans une colonne.
- Les rounds sont affichés progressivement par colonne.
- Les plateaux sont déduits des positions dans les colonnes.

### 6.2 Cards

Les cards peuvent être :

- appearance card ;
- hole card.

Actions directes principales :

- bouton link avec état lié/non lié ;
- lock/unlock ;
- menu trois-points ;
- drag handle desktop / long press mobile.

Ne pas mettre de mention link dans le menu trois-points.
Le link passe uniquement par le bouton link et le mode link du tableau.

### 6.3 Mode link

- Déclenché depuis le bouton link d'une card.
- Le tableau passe en mode link.
- Recliquer sur le bouton link de la card anchor sort du mode link.
- Une validation explicite enregistre le link.
- Les cards déplacées doivent être animées.

### 6.4 Mode conflict

- Déclenché depuis le menu trois-points d'une card.
- Le tableau passe en mode conflict.
- Validation avec choix du scope : ce passage seulement ou en général.
- Pas de drawer conflict.
- Pas de `conflict_updated` en V0 : supprimer puis recréer.

### 6.5 Drawers

- Drawer participant : modifier nom + instruments joués.
- Drawer d'appel : appeler plateau, remplacer musicien introuvable, faire sans musicien, marquer plateau joué.
- Pas de drawer link.
- Pas de drawer conflict.

---

## 7. Ce qu'il ne faut pas implémenter

Ne pas implémenter en V0 :

- auth organisateur obligatoire ;
- QR code participant ;
- temps réel multi-client ;
- résolution de conflits multi-client ;
- notes participant/appearance ;
- `play_without_created` / `play_without_removed` ;
- `link_updated` ;
- `conflict_updated` ;
- `plateau_composition_forced` ;
- drag horizontal ;
- drawer link ;
- drawer conflict ;
- suppression physique RGPD avancée ;
- logique métier durable basée sur l'état React.

---

## 8. Stack obligatoire

Respecter `docs/technical-stack.md`.

Résumé :

```text
Backend:
- Django
- Django REST Framework
- PostgreSQL cible prod
- SQLite acceptable en dev si explicitement prévu
- pytest + pytest-django

Frontend:
- React + Vite
- JavaScript, pas TypeScript sauf demande explicite
- MUI
- Zustand
- TanStack Query
- Dexie.js
- dnd-kit
- React Hook Form
- Zod
- Vitest + React Testing Library
```

---

## 9. Priorité de développement

L'ordre recommandé est dans `implementation-plan.md`.

Priorité absolue :

1. modèles/events/sync backend minimal ;
2. moteur de projection pur ;
3. tests moteur ;
4. persistance locale Dexie ;
5. rendu tableau ;
6. interactions UI.

Ne pas commencer par une UI complexe tant que le moteur de projection n'est pas fiable.

---

## 10. Exigences de tests

Toute feature qui modifie la liste ou l'ordre des passages doit avoir un test moteur.

Aucune feature UI ne doit être considérée finie si le comportement métier correspondant n'a pas de test unitaire côté projection engine.

À chaque bug moteur corrigé, ajouter un test de régression.

Se référer à `docs/testing-strategy.md`.

---

## 11. Qualité de code attendue

- Code simple et explicite.
- Fonctions pures pour la projection.
- Pas de logique métier cachée dans JSX.
- Payloads event conformes à `docs/event-payloads-reference.md`.
- Noms cohérents avec les specs.
- Pas de renommage opportuniste des concepts métier.
- Pas de dépendance lourde non validée.
- Pas d'optimisation prématurée.

---

## 12. Définition de terminé

Une étape est terminée seulement si :

1. le code respecte les specs concernées ;
2. les tests associés passent ;
3. la projection reste déterministe ;
4. les anciennes logiques legacy ne sont pas réintroduites ;
5. les fichiers créés respectent `repo-structure.md` ;
6. les commandes de test/build pertinentes passent ou les limites sont documentées.

---

## 13. En cas d'ambiguïté

Si une spec semble incomplète :

1. ne pas inventer une logique lourde ;
2. privilégier l'option la plus simple ;
3. privilégier l'event-sourcing et le déterminisme ;
4. documenter l'hypothèse dans le code ou dans une note courte ;
5. éviter de bloquer tout le chantier pour une micro-décision UI.

Pour les règles métier critiques, créer une TODO claire et isolée plutôt que disperser une approximation dans plusieurs composants.
