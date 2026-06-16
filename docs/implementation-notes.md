# Implementation notes

- Socle initial : SQLite est configuré pour la V0 locale/simple via `DJANGO_DATABASE_URL=sqlite:///db.sqlite3`, conformément à la demande de démarrage. PostgreSQL reste la cible durable décrite par les specs.
- Les services backend sont créés comme modules dédiés vides pour réserver l'architecture prévue ; la logique de transaction/sync sera ajoutée dans les phases suivantes.
- Tableau V0 : le bouton d’insertion “Ajouter un participant” crée un participant local nommé “Nouveau participant” via `participant_created` + `participation_added`. L’hypothèse minimale est de permettre une insertion immédiate event-sourced ; le renommage détaillé passera par le drawer participant d’une phase UI ultérieure.


---

## Note V0 sync actuelle

Les anciennes mentions de client sessions/lease dans les notes d'implémentation sont obsolètes pour la V0. La référence actuelle est `docs/v0-sync-no-client-sessions.md`.
