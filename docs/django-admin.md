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


## Fichiers statiques de l’admin

L’admin Django utilise les fichiers statiques fournis par `django.contrib.admin`.
En production, ils doivent être collectés puis servis par Nginx.

Collecter les fichiers statiques :

```bash
cd backend
source venv/bin/activate
python manage.py collectstatic --noinput
```

Vérifier que les CSS admin existent :

```bash
ls -la staticfiles/admin/css | head
```

Tester depuis le serveur :

```bash
curl -I -H "Host: confiture.live" http://127.0.0.1/static/admin/css/base.css
```

Résultat attendu : `200 OK`. Si le résultat est `404`, ajouter ou corriger ce bloc dans la configuration Nginx du site :

```nginx
location /static/ {
    alias /home/confiture/confiture.live/backend/staticfiles/;
}
```

Avec `alias`, les deux `/` finaux sont importants : `location /static/` et `staticfiles/`.

Après modification Nginx :

```bash
sudo nginx -t
sudo systemctl reload nginx
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
