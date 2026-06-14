# Confiture.live

Application local-first pour organiser des jam sessions en direct.

## Structure

- `backend/` — API Django/DRF event-sourcing minimal.
- `frontend/` — React/Vite, projection pure, stockage local Dexie.
- `docs/` — spécifications produit et techniques.

## Démarrage rapide

```bash
cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && python manage.py migrate
cd frontend && npm install && npm test
```
