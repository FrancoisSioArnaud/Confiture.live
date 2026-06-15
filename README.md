# Confiture.live

Application mobile/tablette local-first pour organiser des jam sessions à partir d'un event log déterministe.

## Backend

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Endpoint de santé : `GET /api/health/`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Routes initiales : `/`, `/jams/new`, `/jams/:jamId`.

## Configuration API frontend

En production, le frontend doit appeler le backend via le préfixe API servi par le même domaine :

```env
VITE_API_BASE_URL=/api
```

Vite injecte cette variable au moment de `npm run build`. Après toute modification de `.env.production`, il faut donc rebuild le front pour que la nouvelle valeur soit prise en compte.

Nginx doit proxyfier `/api/` vers Gunicorn afin que les routes Django comme `/api/jams/` soient servies par le backend, et non par l'application React statique.

## Notes de migration SQLite

Certaines bases SQLite de développement ou de production peuvent avoir appliqué une ancienne version de `backend/jams/migrations/0001_initial.py` avant l'ajout de colonnes aujourd'hui attendues par les modèles Django. Les migrations de réparation ultérieures inspectent le schéma réel et ajoutent uniquement les colonnes absentes, ce qui les rend idempotentes sur les bases déjà réparées comme sur les bases récentes.

Ne modifiez jamais une migration déjà appliquée sur un environnement existant : créez une nouvelle migration de réparation pour préserver les données et garder l'historique Django cohérent.
