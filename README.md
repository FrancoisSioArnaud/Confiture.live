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
