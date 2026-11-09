# Consignes pour les agents de développement

- Lire `README.md` pour connaître l’architecture et les limites réelles des intégrations.
- Préserver la compatibilité du stockage `localStorage` sous la clé `shoot-app` et la forme `{ settings, shoots }`, sauf migration explicite.
- Ne jamais créer de faux lien Google Drive ni annoncer un paiement vérifié sans intégration réelle.
- L’accès Drive utilise Google Identity Services et le scope `drive.file`. Le Client ID public est injecté par `VITE_GOOGLE_CLIENT_ID` ; ne jamais placer de mot de passe, de secret OAuth ou de jeton Google dans le dépôt ou `localStorage`. La session persistante conserve le jeton de renouvellement chiffré dans un cookie `HttpOnly` côté navigateur ; la clé de chiffrement reste uniquement sur Vercel.
- Les photos partent du navigateur. Conserver l’identifiant du dossier et les sessions d’upload lors d’un nouvel essai pour éviter les doublons.
- Le dossier racine `Shoots` doit être retrouvé ou créé avec le scope `drive.file` ; chaque sous-dossier utilise le nom saisi par Martin, le client, la date et la référence. Ne partager publiquement que le sous-dossier du shooting.
- L’envoi Gmail utilise le scope distinct `gmail.send` et le même compte Google que Drive. Vérifier l’adresse du compte avant tout envoi ; conserver les jetons d’accès uniquement en mémoire et le jeton de renouvellement chiffré dans le cookie de session. Ne jamais utiliser ni committer la clé Resend partagée dans la conversation.
- Modifier les fonctionnalités dans `src/features/`, les calculs réutilisables dans `src/lib/`, les textes et constantes dans `src/data/`.
- Après une modification fonctionnelle, exécuter `npm run build` et vérifier manuellement le parcours concerné.
- `legacy/Shoot (2).html` est une référence historique, pas du code actif.
