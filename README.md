# up-tour-guidé

## Description
Plugin WordPress permettant de créer des visites guidées (back-office, éditeur Gutenberg et front) en s’appuyant sur Driver.js.
Les visites sont définies via des templates XML activables/désactivables depuis l’administration.

## Installation
1. Copier le dossier `up-tour-guide` dans `wp-content/plugins/`.
2. Activer le plugin « Tour guidé » dans l'administration WordPress.
3. Aller dans le menu « Visites guidées » pour configurer les templates existants ou en importer de nouveaux (XML).
4. Pour chaque template, choisir sa disponibilité :
   - **Désactivé** : visite complètement désactivée
   - **Menu + URL** : visible dans le menu ET accessible par lien direct
   - **URL uniquement** : masquée du menu, accessible uniquement par lien direct (`?visite=ID`)
5. Dans l'éditeur Gutenberg, ouvrir le panneau « Visite guidée » pour lancer une visite.
6. Côté front ou admin, ajouter `?visite=ID_TEMPLATE` à l'URL pour lancer une visite spécifique (l'ID est défini dans l'attribut `id=""` du template XML).

## Changelog
- 2025-11-17 · v0.1.8.0 · Système de disponibilité à 3 états : remplacement de la simple activation/désactivation par un système granulaire (Désactivé / Menu + URL / URL uniquement). Permet de gérer finement la visibilité des visites dans le menu admin tout en gardant la possibilité de les lancer via un lien direct `?visite=ID`. Filtrage intelligent du dropdown admin (seules les visites "Menu + URL" apparaissent). Support de migration automatique depuis l'ancien format. Ordre personnalisable par drag & drop respecté dans le menu et l'API.
- 2025-11-17 · v0.1.7.0 · Amélioration des templates XML et de l'éditeur: les descriptions sont maintenant encapsulées en CDATA et auto-formatées en paragraphes `<p>…</p>` à partir des retours à la ligne (tout en respectant le HTML inline). Le bouton « Tester » dans l'éditeur applique exactement la même logique que la sauvegarde XML pour le rendu des paragraphes. En admin, meilleure gestion de la fermeture des popovers (croix visible + bouton natif Driver réactivé) sans casser le positionnement des visites.
- 2025-11-14 · v0.1.6.1 · Stabilisation de la fermeture des visites: prise en charge robuste des boutons Fermer/Terminer (fallback global), nettoyage complet de l'état Driver.js (classes `driver-active`/`driver-fade`, éléments overlay/popover), réouverture possible de l'UI après un tour. Ouverture fiable des sous-menus WordPress pour les étapes ciblant des éléments du menu (détection via l'élément réel fourni par Driver.js et scope `#adminmenu`).
- 2025-11-14 · v0.1.5.0 · Suppression orchestrateur: retour au mode natif Driver.js simple et stable. Menu dropdown custom unifié (plus de double affichage survol/clic), décodage HTML des titres (apostrophes), lien "Gérer les templates" intégré. Navigation Précédent/Suivant native et fonctionnelle.
- 2025-11-14 · v0.1.4.0 · Refonte UI éditeur de templates: layout en cartes ultra-compact, drag & drop par poignée, actions par étape (Tester/Dupliquer/Supprimer), masquage dynamique des champs d'action, sections "Action" et "Attendre" en lignes combinées, tooltips FR. Corrections admin bar et orchestrateur (attente réduite, fallback highlight), améliorations UX.
- 2025-11-14 · v0.1.3.0 · Listes de visites par template (admin bar et panneau Gutenberg), lancement individuel, compat Driver.js (ancienne/nouvelle API), passage à un bundle local (assets/lib), libellés FR (Précédent/Suivant/Fermer/Terminer), correctifs de chargement (éditeur/admin/front).
- 2025-11-14 · v0.1.1.0 · Ajout du contexte (admin/éditeur/front) aux templates, générateur de templates enrichi (formulaire + ajout d’étapes) et corrections Gutenberg.
- 2025-11-14 · v0.1.0 · Création du plugin, intégration Driver.js, templates XML, panneau Gutenberg et barre d’admin.
