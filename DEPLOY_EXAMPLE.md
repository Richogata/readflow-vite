# 🔧 ReadFlow — Exemple de déploiement pas à pas

Ce document montre exactement comment déployer ReadFlow sur GitHub Pages avec des exemples concrets.

## Scénario : "Je m'appelle Alice et je veux déployer ReadFlow"

### Étape 1 : Créer le dépôt GitHub

1. Ouvrez [github.com](https://github.com) et connectez-vous
2. Cliquez sur le **+** en haut à droite → **New repository**
3. Remplissez:
   - **Repository name**: `readflow` (ou `my-readflow`, `alice-readflow`, etc.)
   - **Public**: ✅ COCHÉ (important pour GitHub Pages gratuit)
   - **Initialize this repository with**: ❌ (laissez vide, nous pousserons le code)
4. Cliquez **Create repository**

**Résultat**:
- Vous avez maintenant une URL: `https://github.com/alice/readflow`
- Votre futur site: `https://alice.github.io/readflow`

### Étape 2 : Préparer le code local

Ouvrez votre terminal dans le dossier `READFLOW 2.0` et exécutez:

```bash
# Initialiser git (si pas déjà fait)
git init

# Ajouter tous les fichiers
git add .

# Créer le commit initial
git commit -m "Initial ReadFlow commit"

# Renommer la branche (GitHub utilise 'main' par défaut)
git branch -M main
```

### Étape 3 : Connecter le dépôt GitHub

Remplacez `alice` par votre nom d'utilisateur GitHub:

```bash
git remote add origin https://github.com/alice/readflow.git
git push -u origin main
```

**Premier lancement**: Vous serez peut-être demandé de vous authentifier. Utilisez votre token d'accès personnel GitHub (PAT) ou SSH.

**Résultat**: Le code est maintenant sur GitHub. Attendez 10-30 secondes.

### Étape 4 : Activer GitHub Pages

1. Allez sur votre dépôt: `https://github.com/alice/readflow`
2. Cliquez sur **Settings** (onglet en haut)
3. Dans le menu de gauche, cliquez sur **Pages**
4. Sous « Build and deployment », changez la source:
   - De: « Deploy from a branch »
   - À: **GitHub Actions**
5. GitHub Pages trouvera automatiquement le fichier `.github/workflows/deploy.yml`
6. Le workflow démarre automatiquement

### Étape 5 : Vérifier le déploiement

1. Dans votre repo, cliquez sur **Actions** (onglet)
2. Vous verrez le workflow « Deploy ReadFlow to GitHub Pages » en cours d'exécution
3. Attendez ~2-3 minutes
4. Quand le workflow est ✅ vert, c'est bon!

### Étape 6 : Ouvrir votre site

Après le succès du workflow:

1. Allez dans **Settings → Pages**
2. Vous verrez: **Your site is live at** `https://alice.github.io/readflow`
3. Cliquez sur le lien ou ouvrez-le directement dans le navigateur

**Résultat**: Votre ReadFlow est en ligne! 🎉

---

## ✅ Checklist complète

- [x] Compte GitHub créé et connecté
- [x] Dépôt public créé (`readflow`)
- [x] `git init` dans le dossier READFLOW 2.0
- [x] `git add .` (tous les fichiers)
- [x] `git commit -m "Initial ReadFlow"`
- [x] `git remote add origin https://github.com/alice/readflow.git`
- [x] `git push -u origin main`
- [x] GitHub Pages: Source = **GitHub Actions**
- [x] Workflow en cours d'exécution (Actions tab)
- [x] Workflow terminé avec ✅ (2-3 min)
- [x] Site accessible: `https://alice.github.io/readflow`

---

## 🔄 Mise à jour du site après déploiement

Si vous modifiez le code ou ajoutez des features:

```bash
# Faire vos modifications dans src/
# Par exemple: changer la couleur, ajouter une feature

# Ajouter les changements
git add .

# Créer un commit
git commit -m "Ajouter feature X ou changer couleur"

# Pousser vers GitHub
git push origin main
```

GitHub Actions re-déploiera automatiquement! Attendez 2-3 minutes et rechargez votre site.

---

## ⚠️ Problèmes courants et solutions

### Problème 1: "Build failed" dans GitHub Actions

**Cause**: Généralement une erreur TypeScript ou de dépendances.

**Solution**:
1. Cliquez sur le workflow rouge ❌
2. Regardez les logs (onglet « Run npm ci && npm run build »)
3. Corrigez l'erreur en local
4. Poussez à nouveau: `git add . && git commit -m "Fix" && git push`

### Problème 2: Site affiche "404" ou "blank page"

**Cause**: Les assets ne sont pas chargés.

**Solution**:
1. Vérifiez que votre URL est `https://alice.github.io/readflow` (avec le `/readflow`)
2. Ouvrez la console: F12 → Console
3. Cherchez les erreurs "Failed to load" ou "404"
4. Forcez un rechargement: Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)

### Problème 3: "No permissions to push"

**Cause**: Authentification GitHub manquante.

**Solution**:
- Utilisez HTTPS + token d'accès personnel (PAT): [Créer un PAT](https://github.com/settings/tokens)
- Ou configurez SSH: [GitHub SSH guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

### Problème 4: "Source already exists" ou "Pages already configured"

**Cause**: GitHub Pages est déjà activé pour une autre branche.

**Solution**:
1. Allez dans **Settings → Pages**
2. Changez la source de « Deploy from a branch » à **GitHub Actions**

---

## 🎯 Après le déploiement

Votre ReadFlow est maintenant en ligne!

- 📚 Ouvrez votre site et importez des livres
- 🎧 Testez la lecture vocale
- 📊 Vérifiez les statistiques
- 💾 Exportez vos données (backup)

---

## 📊 Ressources additionnelles

- [GitHub Pages Official Docs](https://docs.github.com/en/pages)
- [GitHub Actions Official Docs](https://docs.github.com/en/actions)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html#github-pages)

---

## ❓ Questions fréquentes du déploiement

**Q: Ça va vraiment être gratuit?**  
A: OUI. GitHub Pages est gratuit pour les dépôts publics. Aucune limite de bande passante pour les pages statiques.

**Q: Mon site reste accessible même si je l'oublie?**  
A: OUI. GitHub le garde en ligne pour toujours (tant qu'il n'est pas supprimé).

**Q: Je peux avoir un domaine personnalisé?**  
A: OUI. Configurez dans **Settings → Pages → Custom domain**. Vous aurez besoin d'acheter un domaine (pas facile, mais possible).

**Q: Les données de mes livres seront partagées?**  
A: NON. IndexedDB est local à votre navigateur. Aucun upload automatique.

**Q: Je peux revenir en arrière si le déploiement rate?**  
A: OUI. Restaurez une version antérieure: `git revert` ou `git reset`.

---

*Déploiement en ~5 minutes. Lecture pour toujours.*
