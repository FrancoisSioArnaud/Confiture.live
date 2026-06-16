# Django Admin — V0

Le Django admin sert à inspecter et nettoyer les données persistées V0 :

- jams ;
- transactions ;
- events ;
- snapshots.

`JamClientSession` n'existe plus en V0 et ne doit pas être enregistré dans l'admin.

Les client sessions sont repoussées en V1.

## Suppression depuis l’admin

La V0 n’est pas encore en production : l’admin peut être utilisé pour nettoyer les données de test.

Règles :

- `JamSnapshot` est sélectionnable et supprimable depuis la changelist admin.
- `JamTransaction` est sélectionnable et supprimable depuis la changelist admin.
- `JamEvent` est sélectionnable et supprimable depuis la changelist admin.
- `Jam` est sélectionnable et supprimable depuis la changelist admin.
- Supprimer une `Jam` supprime automatiquement ses transactions, events et snapshots liés via les relations `on_delete=models.CASCADE`.

Les transactions/events/snapshots restent en lecture seule pour l’édition : on peut les consulter ou les supprimer, mais pas modifier leurs payloads à la main.

## CSS admin en production

L’admin Django dépend de `/static/admin/...`.

Le script `./deploy` doit :

1. exécuter `python manage.py collectstatic --noinput` ;
2. vérifier que `backend/staticfiles/admin/css/base.css` existe ;
3. publier `backend/staticfiles/` vers `/var/www/confiture.live/static/` ;
4. vérifier publiquement `https://confiture.live/static/admin/css/base.css`.

Avec la configuration Nginx actuelle :

```nginx
root /var/www/confiture.live;
```

l’URL :

```txt
/static/admin/css/base.css
```

sert le fichier :

```txt
/var/www/confiture.live/static/admin/css/base.css
```
