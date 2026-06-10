# Confiture.live

Confiture est une application web mobile/tablette pour aider les organisateurs de jam session en bar à gérer rapidement les musiciens, instruments et passages.

Ce dépôt est un monorepo avec :

```text
confiture.live/
├── backend/   # Django + Django REST Framework
├── frontend/  # React + JavaScript + MUI via Vite
├── docs/      # spécifications produit, UI et techniques
├── AGENTS.md
└── README.md
```

## Backend

Le backend Django est dans `backend/` avec le projet `config` et l'app principale `jams`.

### Installation et démarrage

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Par défaut, le backend utilise SQLite pour faciliter le démarrage local. Pour PostgreSQL, définir `DATABASE_URL`, par exemple :

```bash
export DATABASE_URL="postgres://user:password@localhost:5432/confiture"
```

## Frontend

Le frontend React est dans `frontend/`. Il est volontairement en JavaScript uniquement : pas de TypeScript, pas de fichiers `.ts` ou `.tsx`.

### Installation et démarrage

```bash
cd frontend
npm install
npm run dev
```

### Tests et build

```bash
cd frontend
npm run test
npm run build
```

## État de cette étape

Cette étape met en place la structure technique de base uniquement : Django/DRF, Vite React JavaScript, MUI, thème centralisé, React Router et pages placeholder. Les modèles métier, l'API métier, le moteur de tableau, Dexie sync et le drag and drop seront ajoutés dans des étapes ultérieures.
