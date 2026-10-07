# ReadFlow — Guide de déploiement gratuit

## Avant de déployer

**Vérification du code** : La version de développement dans `/src` contient tout le code TypeScript de l'application. Aucune clé API, aucun secret, aucun élément payant n'est inclus.

**Build final** : Le répertoire `/dist/` contient le site statique prêt au déploiement. Il ne dépend d'aucun backend payant ni service distant obligatoire.

**Dépendances** : Exécutez `npm ci` pour installer les dépendances du `package.json`. Toutes les dépendances utilisées sont open source et gratuites. L'audit npm est propre : `found 0 vulnerabilities`.

## Lancer localement

```bash
npm ci
npm run dev
```

Ouvrez l'URL affichée par Vite (ex. `http://localhost:5173`). Les fichiers sont serviced'après `/src` en mode développement, avec hot module replacement activé.

## Déployer sur GitHub Pages (gratuit, sans serveur, sans limite de bande)

### Étape 1 : Créer un dépôt GitHub

1. Allez sur https://github.com/new
2. Créez un dépôt **public** (GitHub Pages gratuit nécessite un dépôt public ou une accounts GitHub Pro).
3. Notez le chemin : `https://github.com/votre-nom/votre-repo`

### Étape 2 : Pousser le code

```bash
git init
git add .
git commit -m "Initial ReadFlow commit"
git branch -M main
git remote add origin https://github.com/votre-nom/votre-repo.git
git push -u origin main
```

### Étape 3 : Activer GitHub Pages avec Actions

1. Allez sur votre dépôt GitHub.
2. Cliquez sur **Settings → Pages**.
3. Sous « Build and deployment », sélectionnez **GitHub Actions** comme source.
4. GitHub Pages cherchera un workflow `deploy.yml` (inclus dans `.github/workflows/`).
5. Poussez vers `main` (ou déclenchez le workflow manuellement depuis l'onglet **Actions**).

### Étape 4 : Vérifier le déploiement

Après le succès du workflow :
- L'URL du site statique s'affiche dans la page **Settings → Pages** (ex. `https://votre-nom.github.io/votre-repo`).
- L'application est accessible immédiatement.
- Tous les livres importés restent sur l'appareil de l'utilisateur ; aucun fichier n'est envoyé à GitHub.

## Conditions d'utilisation gratuite

### GitHub Pages
- **Tarification** : Entièrement gratuit pour les dépôts publics.
- **Limites** : Pas de limite de bande passante ni de stockage déraisonnable pour un site statique.
- **Accès** : Pas de carte bancaire requise pour créer un dépôt public et utiliser GitHub Pages avec Actions.
- **Confidentialité** : Les livres importés ne sont jamais téléversés vers GitHub. Seul le code de l'application (qui contient le HTML, le CSS et le JavaScript) est publié.

### Autres hébergeurs statiques gratuits

Si vous préférez une alternative à GitHub Pages :

- **Netlify** (https://netlify.com) : gratuit, déploiement depuis GitHub/GitLab, domaine personnalisé gratuit via `*.netlify.app`.
- **Vercel** (https://vercel.com) : gratuit pour les sites statiques, déploiement depuis GitHub, domaine personnalisé gratuit via `*.vercel.app`.
- **Cloudflare Pages** (https://pages.cloudflare.com) : gratuit, domaine gratuit via `*.pages.dev`, déploiement depuis GitHub.

**Précaution** : Vérifiez que la source de déploiement configure bien `npm ci && npm run build`, et que le répertoire de sortie est configuré sur `dist/`.

## Fonctionnalités garanties après déploiement

- ✅ **Import de PDF et EPUB** : Fonctionnel, les fichiers restent sur l'appareil.
- ✅ **Lecture des textes** : PDF.js et epub.js chargés dynamiquement, sans API externe.
- ✅ **Synthèse vocale gratuite** : Web Speech API du navigateur, voix du système d'exploitation.
- ✅ **Stockage local** : IndexedDB pour les livres, les notes, les sessions, la progression.
- ✅ **Interface responsive** : Fonctionne sur ordinateur, tablette, smartphone.
- ✅ **Pas d'authentification** : Aucun compte, aucun email requis.
- ✅ **Pas de paywalls** : Zéro limitations, zéro abonnement.

## Performance et optimisation

Le build de production utilise :
- **Vite** : Bundling moderne avec chargement dynamique des gros modules (PDF.js, epub.js).
- **Code splitting** : Réduit le bundle initial à ~180 KB (gzippé ~58 KB).
- **Lazy loading des modules** : PDF.js et epub.js ne sont téléchargés que si l'utilisateur ajoute un livre.
- **CSS Tailwind** : ~29 KB (gzippé ~7.6 KB), purged pour inclure uniquement les styles utilisés.

Le site se charge et devient interactif en moins de 2 secondes sur une connexion haut débit.

## Avertissements et limitations connues

1. **Synthèse vocale** : La disponibilité et la qualité des voix dépendent du navigateur et du système d'exploitation. Les voix Windows, macOS, iOS et Android sont respectivement différentes. Les tests doivent être effectués sur la plate-forme cible.

2. **PDF scannés** : Si un PDF ne contient que des images (pas de texte sélectionnable), l'application affiche un message indiquant qu'un OCR serait nécessaire. Aucun service OCR gratuit n'est intégré par défaut.

3. **Stockage IndexedDB** : Les données sont liées au profil de navigateur, au domaine et à l'origine. Changer de navigateur, de profil, d'appareil ou effacer le stockage du navigateur peut supprimer ou rendre inaccessibles les données.

4. **Exportation** : L'option **Exporter mes données** exporte les métadonnées, les notes et les sessions au format JSON. Les fichiers PDF/EPUB eux-mêmes ne sont pas inclus (respecter la confidentialité et le droit d'auteur). L'import JSON n'est pas implémenté ; les données exportées sont à titre d'archivage uniquement.

5. **Résumés** : Les résumés proposés sont basés sur une extraction locale et une sélection naïve de phrases, pas une véritable IA. Ils sont générés sur l'appareil, sans appel API distant payant.

## Support et améliorations futures

Consultez la section **Implemented features** du [README.md](./README.md) pour la liste complète des fonctionnalités actuelles.

Pour ajouter des fonctionnalités (ex. OCR local gratuit via `tesseract.js`, synchronisation chiffrée entre appareils via `Sync Storage API`), respectez le principe **100 % gratuit** : aucune dépendance à un service externe payant.

---

**ReadFlow reste 100 % gratuit, local et privé. Amusez-vous à lire.**
