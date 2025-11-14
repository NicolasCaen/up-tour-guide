# up-tour-guidé

## Description
Plugin WordPress permettant de créer des visites guidées (back-office, éditeur Gutenberg et front) en s’appuyant sur Driver.js.
Les visites sont définies via des templates XML activables/désactivables depuis l’administration.

## Installation
1. Copier le dossier `up-tour-guide` dans `wp-content/plugins/`.
2. Activer le plugin « Tour guidé » dans l’administration WordPress.
3. Aller dans le menu « Visites guidées » pour activer les templates existants ou en importer de nouveaux (XML).
4. Dans l’éditeur Gutenberg, ouvrir le panneau « Visite guidée » pour lancer une visite.
5. Côté front, ajouter `?tour=1` à l’URL pour lancer une visite globale.

## Changelog
- 2025-11-14 · v0.1.6.0 · Stabilisation de la fermeture des visites: prise en charge robuste des boutons Fermer/Terminer (fallback global), nettoyage complet de l'état Driver.js (classes `driver-active`/`driver-fade`, éléments overlay/popover), réouverture possible de l'UI après un tour. Ouverture fiable des sous-menus WordPress pour les étapes ciblant des éléments du menu (détection via l'élément réel fourni par Driver.js et scope `#adminmenu`).
- 2025-11-14 · v0.1.5.0 · Suppression orchestrateur: retour au mode natif Driver.js simple et stable. Menu dropdown custom unifié (plus de double affichage survol/clic), décodage HTML des titres (apostrophes), lien "Gérer les templates" intégré. Navigation Précédent/Suivant native et fonctionnelle.
- 2025-11-14 · v0.1.4.0 · Refonte UI éditeur de templates: layout en cartes ultra-compact, drag & drop par poignée, actions par étape (Tester/Dupliquer/Supprimer), masquage dynamique des champs d'action, sections "Action" et "Attendre" en lignes combinées, tooltips FR. Corrections admin bar et orchestrateur (attente réduite, fallback highlight), améliorations UX.
- 2025-11-14 · v0.1.3.0 · Listes de visites par template (admin bar et panneau Gutenberg), lancement individuel, compat Driver.js (ancienne/nouvelle API), passage à un bundle local (assets/lib), libellés FR (Précédent/Suivant/Fermer/Terminer), correctifs de chargement (éditeur/admin/front).
- 2025-11-14 · v0.1.1.0 · Ajout du contexte (admin/éditeur/front) aux templates, générateur de templates enrichi (formulaire + ajout d’étapes) et corrections Gutenberg.
- 2025-11-14 · v0.1.0 · Création du plugin, intégration Driver.js, templates XML, panneau Gutenberg et barre d’admin.
