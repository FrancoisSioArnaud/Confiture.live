# Django admin

L'admin Django est disponible pour inspecter et déboguer les données backend de Confiture.live en développement ou en production.

## Créer un superuser

```bash
cd backend
source venv/bin/activate
python manage.py createsuperuser
```

Ne stockez jamais d'identifiants, mots de passe ou tokens de production dans le dépôt.

## URL

```text
/admin/
```

## Usage recommandé

Utiliser l'admin comme outil d'inspection/debug pour :

- inspecter les jams existantes, leur statut, leur date indicative et leur stratégie de link ;
- inspecter les transactions et leur payload JSON ;
- inspecter les events par jam, leur type, leur numéro de séquence serveur et leur payload JSON ;
- inspecter les sessions client actives ou expirées ;
- inspecter les snapshots disponibles et leur dernier numéro de séquence serveur.

## Avertissement event-sourcing

Les `JamEvent`, `JamTransaction` et `JamSnapshot` constituent l'historique event-sourcing ou ses caches techniques. En production, ne modifiez pas directement ces objets depuis l'admin : l'admin doit servir à comprendre l'état de la base, pas à corriger manuellement l'historique.
