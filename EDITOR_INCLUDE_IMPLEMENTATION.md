# Implémentation de l'éditeur d'includes

## Objectif
Modifier l'éditeur de templates pour supporter 3 types d'entrées :
1. **Step** : Étape normale (classique)
2. **Include** : Inclusion d'un autre template

## Modifications nécessaires

### 1. PHP - Lecture XML avec includes (`tour_guide_load_template_for_edit`)

Dans la fonction `tour_guide_load_template_for_edit()` (ligne ~416), il faut **parser le XML manuellement** pour détecter les `<include>` en plus des `<step>`.

**Code à ajouter après la ligne 424** :

```php
// Au lieu d'utiliser tour_guide_parse_template_steps (qui résout les includes),
// on doit lire le XML brut pour garder les includes visibles dans l'éditeur
$steps = array();
if ( function_exists( 'simplexml_load_file' ) ) {
    $xml = @simplexml_load_file( $path );
    if ( $xml && isset( $xml->steps ) ) {
        foreach ( $xml->steps->children() as $child ) {
            if ( $child->getName() === 'include' ) {
                // C'est un include
                $include_id = isset( $child['template'] ) ? (string) $child['template'] : '';
                if ( ! $include_id ) {
                    $include_id = isset( $child['id'] ) ? (string) $child['id'] : '';
                }
                $steps[] = array(
                    'type' => 'include',
                    'include_template' => $include_id,
                    // Remplir les autres champs vides pour la compatibilité
                    'selector' => '',
                    'title' => '',
                    'description' => '',
                    'position' => 'bottom',
                    'action' => 'none',
                    'action_selector' => '',
                    'wait_for' => '',
                    'wait_timeout' => '',
                    'delay_ms' => '',
                    'navigate_to' => '',
                    'resume' => 'none',
                );
            } elseif ( $child->getName() === 'step' ) {
                // C'est une step normale
                $step = $child;
                $orch = array();
                if ( isset( $step->action ) ) $orch['action'] = trim( (string) $step->action );
                if ( isset( $step->action_selector ) ) $orch['action_selector'] = trim( (string) $step->action_selector );
                if ( isset( $step->wait_for ) ) $orch['wait_for'] = trim( (string) $step->wait_for );
                if ( isset( $step->wait_timeout ) ) $orch['wait_timeout'] = intval( (string) $step->wait_timeout );
                if ( isset( $step->delay_ms ) ) $orch['delay_ms'] = intval( (string) $step->delay_ms );
                if ( isset( $step->navigate_to ) ) $orch['navigate_to'] = trim( (string) $step->navigate_to );
                if ( isset( $step->resume ) ) $orch['resume'] = trim( (string) $step->resume );

                $selector = isset( $step['selector'] ) ? (string) $step['selector'] : 'body';
                $position = isset( $step['position'] ) ? (string) $step['position'] : 'bottom';
                $title    = isset( $step->title ) ? trim( (string) $step->title ) : '';
                $desc_raw = isset( $step->description ) ? trim( (string) $step->description ) : '';
                
                // Traitement de la description (même logique que l'originale)
                $desc_for_form = $desc_raw;
                if ( '' !== $desc_for_form ) {
                    $tmp = trim( $desc_for_form );
                    $without_p = preg_replace( '#</?p>\s*#i', "\n", $tmp );
                    $lines = preg_split( "/\r\n|\r|\n/", $without_p );
                    if ( $lines && is_array( $lines ) ) {
                        $clean_lines = array();
                        foreach ( $lines as $line ) {
                            $line = trim( $line );
                            if ( '' === $line ) continue;
                            $clean_lines[] = $line;
                        }
                        if ( ! empty( $clean_lines ) ) {
                            $desc_for_form = implode( "\n", $clean_lines );
                        } else {
                            $desc_for_form = '';
                        }
                    }
                }

                $steps[] = array(
                    'type' => 'step',
                    'selector' => $selector,
                    'title' => $title,
                    'description' => $desc_for_form,
                    'position' => $position,
                    'action' => isset( $orch['action'] ) ? $orch['action'] : 'none',
                    'action_selector' => isset( $orch['action_selector'] ) ? $orch['action_selector'] : '',
                    'wait_for' => isset( $orch['wait_for'] ) ? $orch['wait_for'] : '',
                    'wait_timeout' => isset( $orch['wait_timeout'] ) ? $orch['wait_timeout'] : '',
                    'delay_ms' => isset( $orch['delay_ms'] ) ? $orch['delay_ms'] : '',
                    'navigate_to' => isset( $orch['navigate_to'] ) ? $orch['navigate_to'] : '',
                    'resume' => isset( $orch['resume'] ) ? $orch['resume'] : 'none',
                    'include_template' => '',
                );
            }
        }
    }
}
```

### 2. PHP - Sauvegarde XML avec includes (`tour_guide_handle_save_template_post`)

Dans la fonction `tour_guide_handle_save_template_post()` (ligne ~498), ajouter :

**Après la ligne 520** (après `$resume`) :
```php
$step_types = isset( $_POST['step_type'] ) ? (array) $_POST['step_type'] : array();
$include_templates = isset( $_POST['step_include_template'] ) ? (array) $_POST['step_include_template'] : array();
```

**Modifier la boucle (ligne ~524)** pour gérer les types :
```php
for ( $i = 0; $i < $count; $i++ ) {
    $step_type = isset( $step_types[ $i ] ) ? trim( wp_unslash( $step_types[ $i ] ) ) : 'step';
    
    if ( $step_type === 'include' ) {
        // Créer un include
        $include_id = isset( $include_templates[ $i ] ) ? trim( wp_unslash( $include_templates[ $i ] ) ) : '';
        if ( '' !== $include_id ) {
            $steps[] = array(
                'type' => 'include',
                'include_template' => $include_id,
            );
        }
        continue;
    }
    
    // Reste du code pour les steps normales...
    $sel  = isset( $selectors[ $i ] ) ? trim( wp_unslash( $selectors[ $i ] ) ) : '';
    // ...etc
}
```

### 3. PHP - Génération XML avec includes (`tour_guide_generate_xml_from_steps`)

Dans la fonction `tour_guide_generate_xml_from_steps()` (ligne ~585), modifier pour gérer les includes :

**Remplacer la boucle foreach** (ligne ~604) :
```php
if ( ! empty( $steps ) ) {
    foreach ( $steps as $step ) {
        $step_type = isset( $step['type'] ) ? $step['type'] : 'step';
        
        if ( $step_type === 'include' ) {
            // Générer <include>
            $include_id = isset( $step['include_template'] ) ? $step['include_template'] : '';
            if ( '' !== $include_id ) {
                $xml .= '    <include template="' . esc_xml( $include_id ) . '" />' . "\n";
            }
            continue;
        }
        
        // Reste du code pour générer <step>...
        $sel = isset( $step['selector'] ) ? $step['selector'] : '';
        // ... etc
    }
}
```

### 4. HTML - Ajout du champ type dans le formulaire

Dans le formulaire (ligne ~282), ajouter une colonne "Type" **AVANT** la colonne "Sélecteur CSS" :

```php
// Dans le <thead>
<th><?php echo esc_html__( 'Type', 'tour-guide' ); ?></th>

// Dans le <tbody>, dans la boucle, AVANT la ligne 284
<td class="tg-sec-type">
    <span class="tg-cell-label"><span class="tg-info" data-tip="Type d'élément : Step (étape normale) ou Include (réutiliser un autre template)">i</span></span>
    <select name="step_type[]" class="tg-step-type">
        <option value="step" <?php selected( isset($step['type']) ? $step['type'] : 'step', 'step' ); ?>><?php echo esc_html__( 'Step', 'tour-guide' ); ?></option>
        <option value="include" <?php selected( isset($step['type']) ? $step['type'] : 'step', 'include' ); ?>><?php echo esc_html__( 'Include', 'tour-guide' ); ?></option>
    </select>
</td>

// APRÈS la colonne Type, ajouter la colonne Include (masquée par défaut)
<td class="tg-sec-include" style="display:none;">
    <span class="tg-cell-label"><span class="tg-info" data-tip="ID du template à inclure (ex: ajouter-composition)">i</span></span>
    <input type="text" name="step_include_template[]" value="<?php echo esc_attr( isset($step['include_template']) ? $step['include_template'] : '' ); ?>" class="regular-text" placeholder="ex: ajouter-composition" />
</td>
```

### 5. JavaScript - Gestion de l'affichage conditionnel

Dans `admin.js`, après la fonction `applyActionVisibilityForRow` (ligne ~396), ajouter :

```javascript
// Gestion visibilité des champs selon le type
function applyTypeVisibilityForRow(tr){
  if (!tr) return;
  var typeSel = tr.querySelector('select.tg-step-type');
  if (!typeSel) return;
  
  var isInclude = typeSel.value === 'include';
  var isStep = typeSel.value === 'step';
  
  // Colonnes à cacher pour include
  var stepCols = [
    tr.querySelector('.tg-sec-selector'),
    tr.querySelector('.tg-sec-title'),
    tr.querySelector('.tg-sec-desc'),
    tr.querySelector('.tg-sec-position'),
    tr.querySelector('.tg-sec-action'),
    tr.querySelector('.tg-sec-wait'),
    tr.querySelector('.tg-sec-resume')
  ];
  
  var includeCol = tr.querySelector('.tg-sec-include');
  
  // Afficher/cacher selon le type
  stepCols.forEach(function(col){ 
    if (col) col.style.display = isStep ? '' : 'none'; 
  });
  if (includeCol) includeCol.style.display = isInclude ? '' : 'none';
}

function applyTypeVisibilityAll(){
  var tbody = document.querySelector('#tour-guide-steps-table tbody');
  if (!tbody) return;
  Array.prototype.forEach.call(tbody.querySelectorAll('tr'), applyTypeVisibilityForRow);
}
```

Appeler `applyTypeVisibilityAll()` au chargement (ligne ~409) :
```javascript
applyTypeVisibilityAll();
```

Ajouter l'événement de changement (ligne ~416) :
```javascript
stepsTable && stepsTable.addEventListener('change', function(e){
  if (e.target && e.target.name === 'step_action[]'){
    var tr = e.target.closest('tr');
    applyActionVisibilityForRow(tr);
  }
  if (e.target && e.target.classList.contains('tg-step-type')){
    var tr = e.target.closest('tr');
    applyTypeVisibilityForRow(tr);
  }
});
```

Modifier aussi la fonction d'ajout d'étape (ligne ~428) pour appliquer la visibilité :
```javascript
applyTypeVisibilityForRow(newRow);
```

## Fonctions helper PHP nécessaires

Ajouter cette fonction pour échapper le XML :
```php
function esc_xml( $text ) {
    return htmlspecialchars( $text, ENT_XML1 | ENT_QUOTES, 'UTF-8' );
}
```

## Résultat final

L'éditeur aura maintenant un sélecteur "Type" pour chaque ligne :
- **Step** : affiche tous les champs classiques (sélecteur, titre, description, etc.)
- **Include** : affiche seulement un champ "Template à inclure" où on entre l'ID du template

Le XML généré contiendra des `<include template="..." />` aux bons endroits.
