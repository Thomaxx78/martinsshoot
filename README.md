# Shoot Martin

Application locale pour préparer une séance photo, montrer les images au client, noter sa contribution et suivre les séances.

## Démarrer

Prérequis : Node.js 20.19+.

```bash
npm install
npm run dev
```

Ouvrir l’adresse indiquée par Vite (en général `http://localhost:5173`). Le code PIN initial est `1234` ; il se modifie dans **Settings**.

Sur téléphone, l’écran de verrouillage utilise un pavé numérique tactile et valide automatiquement un code de 4 à 8 chiffres. Le clavier physique fonctionne aussi. Un ancien code non numérique peut encore être saisi dans le champ de compatibilité, puis remplacé dans **Settings**.

## Activer Google Drive

Cette étape utilise le compte Google de Martin directement dans le navigateur, sans mot de passe stocké dans l’app et sans base de données supplémentaire. L’app crée un dossier **Shoots** à la racine de **Mon Drive** du compte choisi, puis place chaque shooting dedans. Le site en ligne est `https://martinsshoot.vercel.app`.

1. Depuis le compte de Martin, créer un projet dans [Google Cloud Console](https://console.cloud.google.com/), puis activer **Google Drive API** dans **API et services > Bibliothèque**. Si Google propose l’inscription à l’essai Cloud et demande une carte, créer plutôt un projet gratuit **Spark** dans [Firebase Console](https://console.firebase.google.com/) : c’est aussi un projet Google Cloud, sans compte de facturation lié. Revenir ensuite dans Google Cloud Console, sélectionner ce projet et activer l’API Drive. Cette option n’utilise aucun service Firebase dans l’app.
2. Dans **Google Auth platform**, renseigner **Branding** et **Audience**. Pour un compte Gmail personnel, choisir **External** et ajouter Martin comme utilisateur de test tant que l’app est en test. Dans **Data Access**, déclarer `https://www.googleapis.com/auth/drive.file`.
3. Dans **Clients**, créer un identifiant OAuth 2.0 de type **Application Web**. Ajouter ces **origines JavaScript autorisées**, sans barre finale : `https://martinsshoot.vercel.app` et `http://localhost:5173` pour les essais locaux. Aucun URI de redirection n’est nécessaire pour ce parcours par fenêtre Google.
4. L’identifiant client Web de Martin est déjà dans `.env.production` : Vercel l’intègre au build sans réglage supplémentaire. Pour le développement local, copier `.env.example` en `.env.local` et y mettre ce même identifiant. Le Client ID est public ; ne jamais saisir de mot de passe Google ou de secret OAuth dans une variable `VITE_`.
5. Dans l’app, ouvrir **New photo shoot**, saisir le nom du shooting, sélectionner les photos, puis toucher **Connect Google Drive**. Vérifier l’adresse Google affichée avant de passer le téléphone au client.

Après le formulaire client, l’app crée immédiatement une fiche `pending`, retrouve ou crée **Shoots**, puis crée le sous-dossier `Nom du shooting – Nom du client – Date – REF-000123`. Elle téléverse les photos par morceaux, partage seulement le sous-dossier en lecture à toute personne ayant le lien, puis utilise le vrai lien Drive dans la suite du parcours. En cas d’échec, **Retry upload** reprend dans le même dossier et évite de renvoyer les photos déjà confirmées. L’app conserve une fiche de shooting incomplète pour signaler le problème dans **Customers**.

Avec l’autorisation limitée `drive.file`, l’app retrouve les dossiers **Shoots** qu’elle a elle-même créés. Un dossier **Shoots** créé manuellement dans Drive n’est pas forcément visible pour elle ; dans ce cas, elle peut en créer un second.

Le transfert se fait depuis le navigateur du téléphone : **garder la page ouverte jusqu’à la fin**. Après un rechargement, il faut reconnecter Drive et resélectionner les photos pour un nouveau shooting ; les fichiers sélectionnés ne sont pas stockés localement. Si Drive n’est pas disponible, **Continue without Drive** garde le parcours local et propose de télécharger les photos sur le téléphone.

```bash
npm run build   # vérifie et produit dist/
npm run preview # prévisualise le build
npm run check   # vérifie le formatage, les tests et la compilation
```

## Organisation

| Dossier               | Rôle                                                             |
| --------------------- | ---------------------------------------------------------------- |
| `src/features/admin/` | Un composant par écran du tableau de bord, plus les statistiques |
| `src/features/shoot/` | Parcours de la séance et du client                               |
| `src/data/`           | Traductions, pays et coordonnées de la carte                     |
| `src/lib/`            | Stockage, calculs, export CSV et API Google Drive                |
| `src/styles.css`      | Styles communs                                                   |
| `legacy/`             | Fichier HTML initial, conservé comme référence                   |

## Comportement et limites actuelles

- Les fiches et réglages restent dans le `localStorage` du navigateur, sous la clé `shoot-app`. Les données de l’ancienne version sont relues automatiquement sur le **même navigateur et la même origine**. Un changement de domaine ou le passage de `file://` à `localhost` ne transfère pas ces données automatiquement ; exporter les clients en CSV avant migration si nécessaire.
- Les photos sélectionnées restent en mémoire sur l’appareil pendant la séance. Avec Google Drive connecté, elles sont envoyées dans un dossier créé automatiquement ; sans connexion, elles peuvent être téléchargées localement.
- Les écrans Stripe, Revolut et PayPal présentent les liens ou QR configurés. L’application n’intègre pas leurs API et le statut « paid » repose sur une confirmation manuelle.
- Le PIN est un verrou d’interface local, pas une authentification sécurisée. Éviter d’utiliser cette version pour un stockage partagé ou sensible sans serveur et gestion d’accès.

## Repères pour les prochaines modifications

Les données métier gardent le format `settings` + `shoots` de l’ancienne version. Ajouter un champ avec une valeur par défaut dans `src/lib/storage.js`, puis adapter les composants concernés. Les statistiques doivent rester des calculs dérivés des séances. Le parcours client est dans `ShootFlow.jsx` ; l’administration dans `Dashboard.jsx` et `Insights.jsx`. L’ancien HTML n’est pas chargé par l’application.
