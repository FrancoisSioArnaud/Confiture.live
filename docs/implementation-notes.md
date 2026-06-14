# Implementation notes

- Le moteur de projection V0 matérialise seulement le round 1 calculé par défaut pour chaque participation active. Les rounds futurs sont ajoutés progressivement via des events qui ciblent explicitement des appearances.
- Le backend effectue une validation légère conforme V0 et ne reconstruit pas la projection métier lors d'un push de transaction.
