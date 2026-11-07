# Shoot Martin

Application locale pour préparer une séance photo, montrer les images au client, noter sa contribution et suivre les séances.

## Démarrer

Prérequis : Node.js 20.19+.

```bash
npm install
npm run dev
```

Ouvrir l’adresse indiquée par Vite (en général `http://localhost:5173`). Le code PIN initial est `1234` ; il se modifie dans **Settings**.

```bash
npm run build   # vérifie et produit dist/
npm run preview # prévisualise le build
npm run check   # vérifie le formatage et la compilation
```

## Organisation

| Dossier               | Rôle                                                             |
| --------------------- | ---------------------------------------------------------------- |
| `src/features/admin/` | Un composant par écran du tableau de bord, plus les statistiques |
| `src/features/shoot/` | Parcours de la séance et du client                               |
| `src/data/`           | Traductions, pays et coordonnées de la carte                     |
| `src/lib/`            | Stockage, calculs et export CSV                                  |
| `src/styles.css`      | Styles communs                                                   |
| `legacy/`             | Fichier HTML initial, conservé comme référence                   |

## Comportement et limites actuelles

- Les fiches et réglages restent dans le `localStorage` du navigateur, sous la clé `shoot-app`. Les données de l’ancienne version sont relues automatiquement sur le **même navigateur et la même origine**. Un changement de domaine ou le passage de `file://` à `localhost` ne transfère pas ces données automatiquement ; exporter les clients en CSV avant migration si nécessaire.
- Les photos sélectionnées restent en mémoire sur l’appareil pendant la séance. Elles ne sont pas envoyées sur Google Drive. Pour partager les photos, les téléverser sur Drive et saisir leur véritable lien dans le formulaire de la séance. Sans lien, l’écran de livraison permet de les télécharger individuellement.
- Les écrans Stripe, Revolut et PayPal présentent les liens ou QR configurés. L’application n’intègre pas leurs API et le statut « paid » repose sur une confirmation manuelle.
- Le PIN est un verrou d’interface local, pas une authentification sécurisée. Éviter d’utiliser cette version pour un stockage partagé ou sensible sans serveur et gestion d’accès.

## Repères pour les prochaines modifications

Les données métier gardent le format `settings` + `shoots` de l’ancienne version. Ajouter un champ avec une valeur par défaut dans `src/lib/storage.js`, puis adapter les composants concernés. Les statistiques doivent rester des calculs dérivés des séances. Le parcours client est dans `ShootFlow.jsx` ; l’administration dans `Dashboard.jsx` et `Insights.jsx`. L’ancien HTML n’est pas chargé par l’application.
# martinsshoot
