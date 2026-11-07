# Consignes pour les agents de développement

- Lire `README.md` pour connaître l’architecture et les limites réelles des intégrations.
- Préserver la compatibilité du stockage `localStorage` sous la clé `shoot-app` et la forme `{ settings, shoots }`, sauf migration explicite.
- Ne jamais créer de faux lien Google Drive ni annoncer un paiement vérifié sans intégration réelle.
- Modifier les fonctionnalités dans `src/features/`, les calculs réutilisables dans `src/lib/`, les textes et constantes dans `src/data/`.
- Après une modification fonctionnelle, exécuter `npm run build` et vérifier manuellement le parcours concerné.
- `legacy/Shoot (2).html` est une référence historique, pas du code actif.
