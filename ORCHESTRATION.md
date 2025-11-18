# Documentation Orchestrateur XML

Ce document explique en détail comment fonctionnent les différents éléments XML dans les templates de visites guidées, et comment l'orchestrateur les interprète pour créer des tours interactifs avec Driver.js.

## Structure de base d'un template XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<template id="mon-tour" title="Mon Tour" context="editor">
  <steps>
    <step selector=".mon-element" position="bottom">
      <title>Titre de l'étape</title>
      <description><![CDATA[<p>Description de l'étape</p>]]></description>
      <action>click</action>
      <action_selector>.bouton-a-cliquer</action_selector>
      <wait_for>.element-attendu</wait_for>
      <wait_timeout>5000</wait_timeout>
      <delay_ms>300</delay_ms>
      <resume>auto</resume>
    </step>
  </steps>
</template>
```

## Attributs du template

### `<template>`

- **`id`** (requis) : Identifiant unique du template. Utilisé dans les URLs (`?visite=ID`).
- **`title`** (requis) : Titre de la visite affiché dans les menus.
- **`context`** (optionnel) : Contexte d'exécution. Valeurs possibles :
  - `editor` : Éditeur Gutenberg uniquement
  - `admin` : Administration WordPress (hors éditeur)
  - `front` : Front-office du site
  - Non défini : disponible partout

## Éléments d'une étape (`<step>`)

### Ciblage et positionnement

#### `selector` (attribut, requis)
Sélecteur CSS de l'élément à mettre en surbrillance avec Driver.js.

**Exemple :**
```xml
<step selector=".editor-document-tools__inserter-toggle">
```

**Important :** Cet élément doit exister dans le DOM au moment où Driver.js affiche l'étape. Si l'élément est créé dynamiquement (comme un panneau qui s'ouvre), utilisez d'abord une étape avec `action="click"` pour le faire apparaître.

#### `position` (attribut, optionnel)
Position du popover par rapport à l'élément surligné.

**Valeurs possibles :**
- `top` : Au-dessus
- `bottom` : En-dessous (défaut)
- `left` : À gauche
- `right` : À droite
- `top-left`, `top-right`, `bottom-left`, `bottom-right` : Coins

**Exemple :**
```xml
<step selector=".mon-element" position="right">
```

### Contenu du popover

#### `<title>` (requis)
Titre affiché dans le popover Driver.js.

**Exemple :**
```xml
<title>Ouvrir l'inserteur</title>
```

#### `<description>` (optionnel)
Contenu HTML affiché dans le corps du popover. Doit être encapsulé dans `<![CDATA[...]]>` pour permettre le HTML.

**Exemple :**
```xml
<description><![CDATA[
  <p>Cliquez sur ce bouton pour ouvrir le panneau d'insertion de blocs.</p>
  <p><strong>Astuce :</strong> Vous pouvez aussi utiliser le raccourci <kbd>/</kbd></p>
]]></description>
```

**Bonnes pratiques :**
- Utilisez des paragraphes `<p>` pour structurer le texte
- Utilisez `<strong>` pour mettre en gras, `<em>` pour l'italique
- Utilisez `<kbd>` pour afficher des touches de clavier
- Évitez les balises complexes (div, span avec styles inline, etc.)

## Orchestration (actions automatiques)

L'orchestrateur permet d'automatiser des interactions avant d'afficher un popover. C'est particulièrement utile pour :
- Ouvrir des menus/panneaux
- Naviguer entre les pages
- Attendre que des éléments apparaissent

### `<action>` (optionnel)
Type d'action à effectuer **avant** d'afficher le popover Driver.js.

**Valeurs possibles :**
- `none` (défaut) : Aucune action, afficher directement le popover
- `click` : Cliquer sur un élément
- `navigate` : Naviguer vers une URL (non implémenté actuellement)

**Exemple :**
```xml
<action>click</action>
```

### `<action_selector>` (optionnel)
Sélecteur CSS de l'élément sur lequel effectuer l'action. Si non défini, utilise le `selector` principal.

**Exemple :**
```xml
<action>click</action>
<action_selector>.editor-document-tools__inserter-toggle</action_selector>
```

**Cas d'usage typique :**
```xml
<!-- Étape 1 : Cliquer sur le bouton + puis afficher le popover sur ce bouton -->
<step selector=".editor-document-tools__inserter-toggle" position="bottom">
  <title>Ouvrir l'inserteur</title>
  <description><![CDATA[<p>Nous allons ouvrir le panneau d'insertion.</p>]]></description>
  <action>click</action>
  <action_selector>.editor-document-tools__inserter-toggle</action_selector>
  <wait_for>.editor-inserter-sidebar</wait_for>
  <wait_timeout>5000</wait_timeout>
  <resume>auto</resume>
</step>
```

### `<wait_for>` (optionnel)
Sélecteur CSS d'un élément à attendre **après** l'action, avant d'afficher le popover. L'orchestrateur vérifie toutes les 100ms si l'élément existe dans le DOM.

**Exemple :**
```xml
<wait_for>.editor-inserter-sidebar</wait_for>
```

**Important :** Si vous utilisez `action="click"` pour ouvrir un panneau, vous DEVEZ utiliser `wait_for` pour attendre que le panneau apparaisse, sinon le tour passera à l'étape suivante trop vite.

### `<wait_timeout>` (optionnel, défaut: 10000ms)
Temps maximum (en millisecondes) à attendre l'élément défini dans `wait_for`. Si l'élément n'apparaît pas dans ce délai, l'orchestrateur continue quand même (évite de bloquer le tour).

**Exemple :**
```xml
<wait_timeout>5000</wait_timeout>
```

**Valeurs recommandées :**
- `3000` (3s) : Pour des éléments qui apparaissent rapidement
- `5000` (5s) : Pour des panneaux/menus (défaut recommandé)
- `10000` (10s) : Pour des chargements plus longs

### `<delay_ms>` (optionnel, défaut: 0)
Délai supplémentaire (en millisecondes) après `wait_for`, avant d'afficher le popover. Utile pour laisser des animations se terminer.

**Exemple :**
```xml
<delay_ms>300</delay_ms>
```

**Cas d'usage :** Attendre qu'une animation d'ouverture de menu se termine avant d'afficher le popover.

### `<resume>` (optionnel, défaut: "none")
Comportement après l'action orchestrée.

**Valeurs possibles :**
- `none` (défaut) : L'utilisateur doit cliquer sur "Suivant" pour passer à l'étape suivante
- `auto` : Passe automatiquement à l'étape suivante après l'action (sans afficher de popover sur l'étape actuelle)

**Exemple avec `resume="auto"` :**
```xml
<!-- Étape 1 : Clic automatique + passage automatique à l'étape 2 -->
<step selector=".bouton-menu" position="bottom">
  <title>Ouvrir le menu</title>
  <description><![CDATA[<p>Ouverture automatique du menu...</p>]]></description>
  <action>click</action>
  <wait_for>.menu-ouvert</wait_for>
  <resume>auto</resume>
</step>

<!-- Étape 2 : Popover affiché sur le menu ouvert -->
<step selector=".menu-ouvert" position="right">
  <title>Menu principal</title>
  <description><![CDATA[<p>Le menu est maintenant ouvert.</p>]]></description>
</step>
```

**Exemple avec `resume="none"` (par défaut) :**
```xml
<!-- Étape 1 : Clic automatique + popover affiché sur le bouton -->
<step selector=".bouton-menu" position="bottom">
  <title>Ouvrir le menu</title>
  <description><![CDATA[<p>Cliquez sur Suivant pour continuer.</p>]]></description>
  <action>click</action>
  <wait_for>.menu-ouvert</wait_for>
  <resume>none</resume>
</step>
```

### `<navigate_to>` (non implémenté)
URL vers laquelle naviguer. Fonctionnalité réservée pour une future version.

## Fonctionnement de l'orchestrateur

L'orchestrateur (`runOrchestrationUntilDisplay()`) traite les étapes dans l'ordre :

1. **Pour chaque étape**, il vérifie s'il y a une `action` définie
2. **Si `action="click"`** :
   - Recherche l'élément avec `action_selector` (ou `selector` si non défini)
   - Si trouvé, effectue le clic
   - Si `wait_for` est défini, attend que l'élément apparaisse (avec timeout)
   - Attend `delay_ms` millisecondes supplémentaires si défini
   - Si `resume="auto"`, passe à l'étape suivante **sans afficher de popover**
   - Si `resume="none"`, affiche le popover Driver.js sur l'étape actuelle
3. **Si pas d'action ou action terminée**, affiche directement le popover Driver.js

## Exemples de patterns courants

### Pattern 1 : Ouvrir un panneau puis le cibler

```xml
<!-- Étape 1 : Ouvrir le panneau (passage automatique) -->
<step selector=".bouton-ouvrir" position="bottom">
  <title>Ouverture du panneau</title>
  <description><![CDATA[<p>Ouverture automatique...</p>]]></description>
  <action>click</action>
  <action_selector>.bouton-ouvrir</action_selector>
  <wait_for>.panneau-ouvert</wait_for>
  <wait_timeout>5000</wait_timeout>
  <resume>auto</resume>
</step>

<!-- Étape 2 : Popover sur le panneau ouvert -->
<step selector=".panneau-ouvert" position="right">
  <title>Panneau principal</title>
  <description><![CDATA[<p>Le panneau est maintenant accessible.</p>]]></description>
</step>
```

### Pattern 2 : Mettre en surbrillance puis cibler un sous-élément

```xml
<!-- Étape 1 : Popover sur le conteneur -->
<step selector=".conteneur" position="top">
  <title>Zone principale</title>
  <description><![CDATA[<p>Cette zone contient plusieurs éléments.</p>]]></description>
</step>

<!-- Étape 2 : Popover sur un sous-élément -->
<step selector=".conteneur .sous-element" position="right">
  <title>Sous-élément</title>
  <description><![CDATA[<p>Voici un élément spécifique.</p>]]></description>
</step>
```

### Pattern 3 : Série d'éléments dans un panneau

```xml
<!-- Étape 1 : Ouvrir le panneau -->
<step selector=".ouvrir-panel" position="bottom">
  <title>Ouverture</title>
  <description><![CDATA[<p>Ouverture du panneau...</p>]]></description>
  <action>click</action>
  <wait_for>.panel-content</wait_for>
  <resume>auto</resume>
</step>

<!-- Étape 2-5 : Cibler différents éléments dans le panneau -->
<step selector=".panel-content .item-1" position="right">
  <title>Premier élément</title>
  <description><![CDATA[<p>Description de l'élément 1</p>]]></description>
  <wait_for>.panel-content .item-1</wait_for>
</step>

<step selector=".panel-content .item-2" position="right">
  <title>Deuxième élément</title>
  <description><![CDATA[<p>Description de l'élément 2</p>]]></description>
  <wait_for>.panel-content .item-2</wait_for>
</step>
```

## Conseils de débogage

### Si le popover ne s'affiche pas

1. **Vérifier que l'élément existe** : Ouvrir la console et taper :
   ```js
   document.querySelector('.mon-selector')
   ```
   Doit retourner l'élément (pas `null`)

2. **Vérifier le contexte** : Dans Gutenberg, certains éléments sont dans l'iframe du canvas. Vérifier dans la console contexte `top` vs iframe.

3. **Vérifier les erreurs console** : Chercher des erreurs JavaScript qui bloquent l'exécution.

### Si l'action ne se déclenche pas

1. **Vérifier `action_selector`** : S'assurer que le sélecteur cible bien le bon élément.

2. **Augmenter `wait_timeout`** : Si l'élément met du temps à apparaître après le clic.

3. **Ajouter un `delay_ms`** : Si des animations peuvent interférer.

### Si le tour se bloque

1. **Vérifier `wait_for`** : S'assurer que l'élément attendu apparaît bien après l'action.

2. **Réduire `wait_timeout`** : Pour éviter d'attendre trop longtemps un élément qui ne viendra pas.

3. **Utiliser la console** : Les logs `[Tour Guide Editor]` indiquent l'état du tour.

## Inclusion de templates (`<include>`)

Vous pouvez réutiliser les étapes d'un autre template en utilisant la balise `<include>`. Cela permet de composer des tours complexes en combinant des templates existants.

### Syntaxe

```xml
<include template="ID_DU_TEMPLATE" />
```

ou

```xml
<include id="ID_DU_TEMPLATE" />
```

**Paramètre :**
- `template` ou `id` : L'ID du template à inclure (attribut `id` dans la balise `<template>`)

### Exemple

```xml
<?xml version="1.0" encoding="UTF-8"?>
<template id="workflow-complet" title="Workflow complet" context="editor">
  <steps>
    <!-- Étapes personnalisées -->
    <step selector=".my-custom-element" position="top">
      <title>Étape initiale</title>
      <description><![CDATA[<p>Début du workflow.</p>]]></description>
    </step>
    
    <!-- Inclure toutes les étapes du template "ajouter-block" -->
    <include template="ajouter-block" />
    
    <!-- Inclure toutes les étapes du template "ajouter-composition" -->
    <include template="ajouter-composition" />
    
    <!-- Étapes personnalisées finales -->
    <step selector=".final-element" position="bottom">
      <title>Étape finale</title>
      <description><![CDATA[<p>Fin du workflow.</p>]]></description>
    </step>
  </steps>
</template>
```

### Fonctionnement

- Les étapes du template inclus sont insérées **à l'endroit exact** où se trouve la balise `<include>`
- Vous pouvez inclure plusieurs templates dans le même tour
- Les includes peuvent être combinés avec des étapes normales
- **Protection contre les boucles infinies** : Si un template A inclut B qui inclut A, la récursion est détectée et stoppée

### Cas d'usage

**1. Réutilisation de séquences communes**
```xml
<!-- Template "ouvrir-inserter" : séquence réutilisable -->
<template id="ouvrir-inserter" title="Ouvrir inserteur" context="editor">
  <steps>
    <step selector=".editor-document-tools__inserter-toggle" position="bottom">
      <action>click</action>
      <wait_for>.editor-inserter-sidebar</wait_for>
      <resume>auto</resume>
    </step>
  </steps>
</template>

<!-- Template principal qui réutilise la séquence -->
<template id="mon-workflow" title="Mon workflow" context="editor">
  <steps>
    <include template="ouvrir-inserter" />
    <!-- Suite des étapes... -->
  </steps>
</template>
```

**2. Composer des workflows longs**
```xml
<template id="formation-complete" title="Formation complète" context="editor">
  <steps>
    <include template="decouverte-interface" />
    <include template="ajouter-block" />
    <include template="ajouter-composition" />
    <include template="publier-page" />
  </steps>
</template>
```

## Limitations actuelles

- **Navigation entre pages** : `navigate_to` n'est pas encore implémenté. Pour naviguer, utiliser `action="click"` sur un lien.
- **Actions multiples** : Une seule action par étape. Pour enchaîner plusieurs actions, créer plusieurs étapes avec `resume="auto"`.
- **Éléments dans iframes** : Driver.js fonctionne dans le contexte principal. Les éléments dans des iframes peuvent ne pas être ciblables.
- **Sélecteurs dynamiques** : Les classes générées aléatoirement (ex: `css-abc123`) ne sont pas fiables. Préférer des classes stables.
- **Includes récursifs** : Un template ne peut pas s'inclure lui-même (directement ou indirectement). La récursion est détectée et bloquée.

## Exemple complet : Tour d'insertion d'image dans Gutenberg

```xml
<?xml version="1.0" encoding="UTF-8"?>
<template id="ajouter-image" title="Ajouter une image" context="editor">
  <steps>
    <!-- Étape 1 : Ouvrir l'inserteur (automatique) -->
    <step selector=".editor-document-tools__inserter-toggle" position="bottom">
      <title>Ouvrir l'inserteur</title>
      <description><![CDATA[<p>Cliquez sur ce bouton pour ouvrir le panneau d'insertion de blocs.</p>]]></description>
      <action>click</action>
      <action_selector>.editor-document-tools__inserter-toggle</action_selector>
      <wait_for>.editor-inserter-sidebar</wait_for>
      <wait_timeout>5000</wait_timeout>
      <resume>auto</resume>
    </step>
    
    <!-- Étape 2 : Panneau d'insertion -->
    <step selector=".editor-inserter-sidebar" position="right">
      <title>Panneau d'insertion de blocs</title>
      <description><![CDATA[<p>Le panneau est maintenant ouvert. Vous pouvez rechercher et ajouter des blocs ici.</p>]]></description>
    </step>
    
    <!-- Étape 3 : Barre de recherche -->
    <step selector=".block-editor-inserter__search" position="right">
      <title>Rechercher un bloc</title>
      <description><![CDATA[<p>Utilisez cette barre pour rechercher le type de bloc que vous souhaitez insérer.</p>]]></description>
      <wait_for>.block-editor-inserter__search</wait_for>
      <wait_timeout>3000</wait_timeout>
    </step>
    
    <!-- Étape 4 : Bloc Image -->
    <step selector=".editor-block-list-item-image" position="right">
      <title>Bloc Image</title>
      <description><![CDATA[
        <p>Cliquez sur ce bloc pour insérer une image dans votre contenu.</p>
        <p><strong>Astuce :</strong> Vous pouvez aussi taper <kbd>/image</kbd> directement dans l'éditeur.</p>
      ]]></description>
      <wait_for>.editor-block-list-item-image</wait_for>
      <wait_timeout>3000</wait_timeout>
    </step>
  </steps>
</template>
```

---

**Pour plus d'informations**, consulter le code source dans `assets/editor.js` (fonction `runOrchestrationUntilDisplay`).
