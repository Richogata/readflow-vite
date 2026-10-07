# 🚀 ReadFlow — Guide de démarrage rapide

Bienvenue dans **ReadFlow**, votre application de lecture gratuite, locale et privée.

## ✅ Ce qui fonctionne

- ✅ **Import de PDF et EPUB** : Ouvrez vos livres directement dans l'app
- ✅ **Lecture vocale gratuite** : Écoutez votre livre avec la voix du système
- ✅ **Sauvegarde automatique** : Retrouvez votre progression à chaque ouverture
- ✅ **Lecteur immersif** : Navigation, zoom, signet, minuterie
- ✅ **Coach de lecture** : Objectif, pages/jour, statistiques
- ✅ **100% gratuit** : Zéro abonnement, zéro publicité, zéro connexion requise
- ✅ **100% privé** : Vos livres restent sur votre appareil

---

## 🖥️ Lancer localement (développement)

**Prérequis**: Node.js 20+ et npm

```bash
npm ci
npm run dev
```

Ouvrez l'URL affichée dans le terminal (ex. `http://localhost:5173`).

Les modifications du code sont appliquées instantanément (hot reload).

---

## 📦 Déployer gratuitement sur GitHub Pages

### 1️⃣ Créer un dépôt GitHub

Allez sur [github.com/new](https://github.com/new) et créez un dépôt **public** (gratuit).

Copiez l'URL du dépôt (ex. `https://github.com/votre-nom/readflow.git`).

### 2️⃣ Pousser le code

```bash
git init
git add .
git commit -m "Initial ReadFlow commit"
git branch -M main
git remote add origin https://github.com/votre-nom/readflow.git
git push -u origin main
```

### 3️⃣ Activer GitHub Pages

1. Allez dans **Settings → Pages**
2. Sous « Build and deployment », sélectionnez **GitHub Actions**
3. GitHub Pages trouvera le fichier `.github/workflows/deploy.yml` et déploiera automatiquement

**C'est tout !** Votre site sera accessible à `https://votre-nom.github.io/readflow`

---

## 📚 Première utilisation

1. **Ouvrez l'app** : Cliquez sur « Ajouter un livre »
2. **Importez un PDF ou EPUB** : Sélectionnez un fichier sur votre appareil
3. **Commencez à lire** : Cliquez sur le livre pour ouvrir le lecteur
4. **Écoutez** (optionnel) : Cliquez sur le bouton 🔊 pour lire à haute voix

Les livres sont sauvegardés automatiquement. Fermez et rouvrez l'app, votre progression est conservée.

---

## 🎧 Lecture vocale

- **Voix** : Dépend de votre navigateur et système d'exploitation
- **Vitesse** : Réglable (0.75x à 2x)
- **Arrêt automatique** : Minuterie d'endormissement
- **Reprendre** : Recommence du dernier paragraphe

**Note** : Les voix disponibles varient. Windows, macOS, iOS et Android proposent des voix différentes.

---

## 📖 Fonctionnalités principales

### Bibliothèque
- Affichage des couvertures
- Filtres : À lire, En cours, Terminés
- Recherche par titre
- Statistiques : Jours consécutifs, temps cumulé

### Lecteur
- **PDF** : Navigation par page, zoom, extraction de texte
- **EPUB** : Chapitres, police, thème (Papier/Sépia/Nuit)
- **Audio** : Lecture à voix haute, pause, vitesse, saut au chapitre suivant
- **Plein écran** : Mode concentration

### Coach
- Objectif personnalisé (7, 14, 30 jours ou date libre)
- Calcul automatique des pages/jour
- Ajustement selon votre progression
- Notes et fiches de révision
- Résumé par passage

---

## 💾 Sauvegarder vos données

Cliquez sur **Exporter mes données** pour télécharger un JSON contenant :
- Métadonnées des livres (titre, auteur, couverture)
- Votre progression
- Notes et highlights
- Sessions de lecture

**Important** : Les fichiers PDF/EPUB eux-mêmes ne sont pas inclus (respecter les droits d'auteur).

---

## ⚠️ Limitations à connaître

1. **Stockage local** : Si vous videz le cache du navigateur, les données disparaissent. Exportez régulièrement !
2. **PDF scannés** : Les PDFs sans texte (images) nécessitent un OCR (non inclus gratuitement)
3. **Voix** : Dépendent du navigateur et du système. Pas de voix haute qualité payante
4. **EPUB complexes** : Certains EPUBs avec CSS avancé peuvent ne pas s'afficher parfaitement

---

## 🔧 Support et contribution

- Consultez [README.md](./README.md) pour la documentation technique
- Consultez [DEPLOYMENT.md](./DEPLOYMENT.md) pour les options de déploiement
- Consultez [BUILD_VALIDATION.md](./BUILD_VALIDATION.md) pour les détails du build

---

## 📋 Production Build

Pour générer le site statique prêt au déploiement :

```bash
npm run build
```

Les fichiers seront dans le dossier `dist/`. C'est ce dossier qui est publié sur GitHub Pages.

Pour tester localement :

```bash
npm run preview
```

---

## 🎨 Design

ReadFlow utilise un design holographique futuriste :
- **Thème sombre** : Bleu électrique, violet, noir profond (par défaut)
- **Thème clair** : Blanc, gris, bleu doux (optionnel)
- **Effets 3D** : Glassmorphism, ombres, reflets, animations fluides
- **Responsive** : Fonctionne sur desktop, tablette, smartphone

---

## 🚀 Vous êtes prêt !

Amusez-vous à lire avec ReadFlow.

**Questions ?** Consultez la documentation complète dans les fichiers README.md, DEPLOYMENT.md et BUILD_VALIDATION.md.

---

*ReadFlow — Lire à votre rythme, gratuitement, localement, sans distraction.*
