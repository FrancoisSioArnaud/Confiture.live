# UX Feedback Spec — Confiture.live

## 1. Objectif

Ce fichier définit comment l’application informe l’organisateur après chaque action.

Le but est d’avoir une UI compréhensible pendant une jam, sans bruit inutile.

Types de feedback :

```txt
silent
visual
snackbar
dialog
dialog + snackbar
animation
blocked state
```

---

## 2. Principes généraux

### 2.1 L’effet visuel suffit souvent

Si l’action produit immédiatement une apparition, disparition, grisé ou changement d’icône clair, ne pas ajouter de snackbar.

Exemples :

- création de jam : arrivée sur la page jam ;
- création participant : apparition des cards ;
- lock/unlock : icône change ;
- plateau joué : cards grisées.

---

### 2.2 Snackbar pour les conséquences non évidentes

Utiliser une snackbar quand :

- des cards ont été déplacées automatiquement ;
- plusieurs rounds ont été impactés ;
- un link/conflict a été créé/supprimé ;
- une action a été refusée ;
- un participant est marqué parti ;
- un instrument est masqué ;
- une action d’undo a été appliquée.

---

### 2.3 Dialog pour les actions destructives ou ambiguës

Utiliser un dialog si l’action :

- supprime une appearance ;
- supprime un hole ;
- supprime un participant ;
- marque un musicien comme parti ;
- masque un instrument contenant des données ;
- casse un link ;
- demande de choisir un scope conflict ;
- annule un plateau joué.

---

### 2.4 Animation obligatoire pour les mouvements

Quand une action réorganise des cards :

- pas de téléportation ;
- animation de déplacement 800–1000 ms ;
- snackbar si la raison du déplacement n’est pas évidente.

Exemple :

```txt
Certains passages ont été déplacés pour respecter le link.
```

---

## 3. Feedback sync

L’état de sync doit rester positif même offline.

Wording recommandé :

```txt
Synchronisé
Sauvegardé sur cet appareil
Connexion instable, sauvegarde locale active
Synchronisation en attente
Reprise nécessaire : cette jam est ouverte ailleurs
```

Pas de snackbar à chaque sync réussie.

En revanche, le chip de statut doit se mettre à jour immédiatement quand le backend accepte les transactions :

```txt
Synchronisation en attente → Synchronisation en cours → Synchronisé
```

Cette mise à jour doit être réactive. Le composant ne doit pas dépendre d'un refresh de page ou d'un re-render lié à une autre partie du store.

En cas d’échec de sync répété, ne pas changer d’état agressif. Garder un warning sympathique et non bloquant.

---

## 4. Tableau des feedbacks par action

| Action | Feedback | Animation | Message recommandé |
|---|---|---:|---|
| `jam_created` | silent | non | Aucun : arrivée sur page jam |
| `jam_updated` | snackbar | non | Jam mise à jour |
| `jam_link_reorder_strategy_changed` | snackbar | non | Stratégie de link mise à jour |
| `instrument_added` | visual/silent | oui si colonne visible | Aucun ou Instrument ajouté |
| `instrument_updated` | silent | non | Aucun |
| `instrument_visibility_changed` | dialog + snackbar | oui | Instrument masqué |
| `instruments_reordered` | visual/silent | oui | Aucun |
| `instrument_round_visibility_changed` | visual/silent | oui | Aucun |
| `participant_created` | visual/silent | oui | Aucun |
| `participant_updated` | silent | non | Aucun |
| ajout instrument à participant existant | snackbar + visual | oui | Instrument ajouté au musicien |
| `participant_removed` | dialog + snackbar | oui | Participant supprimé |
| `participant_marked_left` | dialog + snackbar | oui | Musicien marqué comme parti |
| `participation_added` | visual ou snackbar si impact multi-round | oui | Instrument ajouté au musicien |
| `participation_removed` | dialog si impacts + snackbar | oui | Instrument retiré |
| `appearance_materialized` | silent | non | Aucun |
| `appearance_moved_between` | visual/silent | oui | Aucun si drag simple |
| déplacement groupe linké | snackbar | oui | Le groupe lié a été déplacé |
| `appearance_locked` | visual/silent | non | Aucun |
| `appearance_unlocked` | visual/silent | non | Aucun |
| `appearance_skipped` | snackbar | oui | Passage repoussé |
| `appearance_removed` | dialog + snackbar | oui | Passage supprimé |
| `hole_added` manuel | visual/silent | oui | Aucun |
| `hole_added` jouer sans | snackbar + visual | oui | Trou ajouté et lié au passage |
| `hole_added` Plateau sans [instrument manquant] | snackbar + visual | oui | Plateau sans [instrument manquant] préparé |
| `hole_removed` | dialog + snackbar | oui | Trou supprimé |
| `hole_moved_between` | visual/silent | oui | Aucun si déplacement simple |
| `hole_locked` | visual/silent | non | Aucun |
| `hole_unlocked` | visual/silent | non | Aucun |
| `link_created` sans déplacement | snackbar | non | Link créé |
| `link_created` avec déplacement | snackbar | oui | Certains passages ont été déplacés pour respecter le link |
| `link_removed` | snackbar | non | Link supprimé |
| link refusé par conflict | snackbar erreur | non | Link impossible : ces passages sont en conflit |
| `conflict_created` sans déplacement | dialog scope + snackbar | non | Conflit créé |
| `conflict_created` avec déplacement | dialog scope + snackbar | oui | Passage déplacé pour respecter le conflit |
| `conflict_removed` | snackbar | non | Conflit supprimé |
| `plateau_played` | visual/silent | oui léger | Aucun |
| `plateau_unplayed` | dialog + snackbar | oui | Plateau remis à venir |
| `transaction_reverted` | snackbar | oui si impacts | Action annulée |

---

## 5. Dialogs détaillés

### 5.1 Supprimer une appearance

Titre :

```txt
Supprimer ce passage ?
```

Body sans link :

```txt
Ce passage sera retiré du tableau. Le musicien et ses autres passages restent conservés.
```

Body avec link :

```txt
Ce passage est lié à un autre passage. Supprimer ce passage supprimera aussi le link associé, sans supprimer l’autre musicien.
```

Actions :

```txt
Annuler
Supprimer le passage
```

---

### 5.2 Supprimer un hole

Titre :

```txt
Supprimer ce trou ?
```

Body sans link :

```txt
Le trou sera retiré du tableau.
```

Body avec link :

```txt
Ce trou est lié à un passage. Le supprimer retirera aussi le link associé, sans supprimer le musicien lié.
```

Actions :

```txt
Annuler
Supprimer le trou
```

---

### 5.3 Marquer musicien parti

Titre :

```txt
Marquer ce musicien comme parti ?
```

Body :

```txt
Ses passages futurs seront retirés du tableau. Ses passages déjà joués resteront visibles dans l’historique.
```

Si appearances futures lockées :

```txt
Certains passages futurs sont verrouillés. Ils seront quand même retirés si le musicien est marqué comme parti.
```

Actions :

```txt
Annuler
Marquer comme parti
```

---

### 5.4 Supprimer participant

Titre :

```txt
Supprimer ce participant ?
```

Body :

```txt
Le participant n’a encore jamais joué. Il sera retiré de la jam avec ses instruments.
```

Si participant a déjà joué, ne pas afficher ce dialog. Afficher snackbar :

```txt
Ce musicien a déjà joué. Tu peux le marquer comme parti.
```

---

### 5.5 Masquer instrument

Titre :

```txt
Masquer cet instrument ?
```

Body standard :

```txt
La colonne ne sera plus affichée dans le tableau ni dans le drawer d’appel. L’historique reste conservé.
```

Si links actifs :

```txt
Cet instrument contient des passages liés à d’autres colonnes. Les links existants resteront dans l’historique, mais la colonne sera masquée pour la suite.
```

Actions :

```txt
Annuler
Masquer l’instrument
```

---

### 5.6 Choix scope conflict

Titre :

```txt
Ce conflit concerne quoi ?
```

Options :

```txt
Seulement ce passage
Toute la soirée
```

Aide :

```txt
“Seulement ce passage” bloque uniquement les cards sélectionnées.
“Toute la soirée” bloque les participations entre elles pour les prochains rounds.
```

---

### 5.7 Delink dans drawer d’appel

Titre :

```txt
Délier ce passage ?
```

Body :

```txt
Ce musicien est lié à un autre passage. Pour le repousser ou le remplacer, le link sera supprimé.
```

Actions :

```txt
Annuler
Délier et continuer
```

---

## 6. Snackbars recommandées

Messages courts, sans jargon technique.

```txt
Jam mise à jour
Instrument ajouté
Instrument masqué
Musicien marqué comme parti
Passage supprimé
Trou supprimé
Link créé
Link supprimé
Conflit créé
Conflit supprimé
Passage repoussé
Action annulée
Link impossible : ces passages sont en conflit
Déplacement impossible : ce passage est verrouillé
Déplacement impossible : ce passage a déjà été joué
Ce musicien a déjà joué. Tu peux le marquer comme parti.
```

---

## 7. Feedback des modes tableau

### 7.1 Mode link

Entrée mode link :

- changement visuel du tableau ;
- card anchor mise en avant ;
- targets compatibles mises en évidence ;
- barre sticky : `Annuler` / `Valider le link`.

Sortie sans enregistrer :

- bouton Annuler ;
- recliquer sur le bouton link de la card anchor.

Validation :

- snackbar selon effet ;
- animation si déplacement.

---

### 7.2 Mode conflict

Entrée mode conflict :

- changement visuel distinct du mode link ;
- anchor mise en avant ;
- conflicts existants visibles ;
- targets sélectionnables.

Validation :

- dialog scope ;
- snackbar ;
- animation si déplacement.

---

## 8. Feedback visuel des cards

Les cards doivent montrer immédiatement :

- played : grisé + immobile ;
- locked : icône cadenas active ;
- linked : icône link active ;
- conflict visible seulement en mode conflict ;
- hole : style distinct d’une appearance musicien.

---

## 9. À ne pas faire

Ne pas :

- afficher une snackbar pour `jam_created` ;
- afficher une snackbar pour `participant_created` ;
- afficher une snackbar pour chaque sync réussie ;
- utiliser un dialog pour une action non destructive ;
- afficher des messages techniques comme `event saved` ;
- bloquer l’organisateur en cas de réseau instable ;
- utiliser des toasts longs pour expliquer des règles complexes : préférer un dialog si confirmation nécessaire.


### Redo et link contre conflit

- Le bouton redo est affiché à côté du bouton undo.
- Si aucune transaction n’est redoable, le bouton redo est disabled.
- Après redo valide : snackbar `Action rétablie`.
- Si un link manuel contredit un conflict actif, afficher un dialog avant mutation.
- Confirmation : `Désactiver le conflit et créer le link`.
- Annulation : aucune transaction n’est créée.
