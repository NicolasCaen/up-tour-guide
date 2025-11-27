<?php
/**
 * Plugin Name: up-Tour guidé
 * Description: Visites guidées pour WordPress (Gutenberg et interface d’admin) avec Driver.js, gestion de templates XML activables.
 * Version: 0.1.15.0
 * Author: GEHIN Nicolas
 * Text Domain: tour-guide
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'TOUR_GUIDE_VERSION', '0.1.15.0' );
define( 'TOUR_GUIDE_FILE', __FILE__ );
define( 'TOUR_GUIDE_DIR', plugin_dir_path( __FILE__ ) );
define( 'TOUR_GUIDE_URL', plugin_dir_url( __FILE__ ) );

// Dossier d’upload pour templates XML
function tour_guide_get_upload_dir() {
    $uploads = wp_upload_dir();
    $dir = trailingslashit( $uploads['basedir'] ) . 'tour-guide/templates/';
    return $dir;
}

function tour_guide_get_upload_url() {
    $uploads = wp_upload_dir();
    $url = trailingslashit( $uploads['baseurl'] ) . 'tour-guide/templates/';
    return $url;
}

// Dossier d’upload pour médias (vidéos / images) utilisés dans les descriptions
function tour_guide_get_media_dir() {
    $uploads = wp_upload_dir();
    $dir = trailingslashit( $uploads['basedir'] ) . 'tour-guide/media/';
    return $dir;
}

function tour_guide_get_media_url() {
    $uploads = wp_upload_dir();
    $url = trailingslashit( $uploads['baseurl'] ) . 'tour-guide/media/';
    return $url;
}

function tour_guide_activate() {
    // Crée le dossier d’upload si nécessaire
    $dir = tour_guide_get_upload_dir();
    if ( ! file_exists( $dir ) ) {
        wp_mkdir_p( $dir );
    }
    // Initialise l’option d’activation de templates si absente
    if ( ! get_option( 'tour_guide_active_templates' ) ) {
        update_option( 'tour_guide_active_templates', array() );
    }
}
register_activation_hook( __FILE__, 'tour_guide_activate' );

function tour_guide_load_textdomain() {
    load_plugin_textdomain( 'tour-guide', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}
add_action( 'plugins_loaded', 'tour_guide_load_textdomain' );

// Enqueue Driver.js et scripts/styles du plugin (admin + front)
function tour_guide_enqueue_common_assets() {
    // Driver.js via CDN (v1)
    wp_register_script(
        'driverjs',
        TOUR_GUIDE_URL . 'assets/lib/driverjs.js',
        array(),
        '1.0.0',
        true
    );
    wp_register_style(
        'driverjs-style',
        TOUR_GUIDE_URL . 'assets/lib/driverjs.css',
        array(),
        '1.0.0'
    );
}
add_action( 'init', 'tour_guide_enqueue_common_assets' );

function tour_guide_enqueue_admin_assets( $hook ) {
    wp_enqueue_script( 'driverjs' );
    // Pour le drag & drop des étapes
    wp_enqueue_script( 'jquery-ui-sortable' );
    wp_enqueue_style( 'driverjs-style' );

    wp_enqueue_style( 'tour-guide-admin', TOUR_GUIDE_URL . 'assets/admin.css', array(), null );
    // Dépendances: driverjs, i18n, jquery, jquery-ui-sortable
    wp_enqueue_script( 'tour-guide-admin', TOUR_GUIDE_URL . 'assets/admin.js', array( 'driverjs', 'wp-i18n', 'jquery', 'jquery-ui-sortable' ), null, true );

    $data = array(
        'activeTemplates' => tour_guide_get_active_templates(),
        'templateFiles'   => tour_guide_list_all_templates(),
        'isAdmin'         => is_admin(),
        'adminUrl'        => admin_url( 'admin.php?page=tour-guide-templates' ),
        'i18n'            => array(
            'startTour' => __( 'Démarrer la visite', 'tour-guide' ),
        ),
        'tours'           => tour_guide_get_tours_by_template( true, 'admin' ),
    );
    wp_localize_script( 'tour-guide-admin', 'TOUR_GUIDE_DATA', $data );
}
add_action( 'admin_enqueue_scripts', 'tour_guide_enqueue_admin_assets' );

function tour_guide_enqueue_front_assets() {
    // Charger aussi en front pour permettre des visites côté site
    wp_enqueue_script( 'driverjs' );
    wp_enqueue_style( 'driverjs-style' );

    wp_enqueue_script( 'tour-guide-frontend', TOUR_GUIDE_URL . 'assets/frontend.js', array( 'driverjs' ), null, true );
}
add_action( 'wp_enqueue_scripts', 'tour_guide_enqueue_front_assets' );

// Admin Bar: entrée pour ouvrir les visites guidées
function tour_guide_admin_bar( $wp_admin_bar ) {
    if ( ! is_user_logged_in() || ! current_user_can( 'edit_posts' ) ) {
        return;
    }
    // On crée uniquement le menu principal, sans sous-menus
    // Le dropdown custom JS gérera l'affichage de la liste des tours
    $args = array(
        'id'    => 'tour_guide_adminbar',
        'title' => __( 'Visites guidées', 'tour-guide' ),
        'href'  => '#',
        'meta'  => array( 'class' => 'tour-guide-custom-dropdown' ),
    );
    $wp_admin_bar->add_node( $args );
}
add_action( 'admin_bar_menu', 'tour_guide_admin_bar', 80 );

// Page d’admin: gestion des templates XML (liste, activer/désactiver, upload)
function tour_guide_admin_menu() {
    add_menu_page(
        __( 'Visites guidées', 'tour-guide' ),
        __( 'Visites guidées', 'tour-guide' ),
        'manage_options',
        'tour-guide-templates',
        'tour_guide_render_templates_page',
        'dashicons-visibility',
        59
    );
}
add_action( 'admin_menu', 'tour_guide_admin_menu' );

function tour_guide_handle_export_action() {
    if ( isset( $_POST['tour_guide_action'] ) && $_POST['tour_guide_action'] === 'export_template' && isset( $_POST['template_id'] ) ) {
        if ( check_admin_referer( 'tour_guide_templates' ) && current_user_can( 'manage_options' ) ) {
            $exp_id = sanitize_text_field( $_POST['template_id'] );
            tour_guide_export_template( $exp_id );
            // Si export échoue (fichier non trouvé), on laisse continuer pour afficher l'erreur
        }
    }
}
add_action( 'admin_init', 'tour_guide_handle_export_action' );

function tour_guide_render_templates_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    // Gestion des actions: activation, upload, création/édition
    if ( isset( $_POST['tour_guide_action'] ) && check_admin_referer( 'tour_guide_templates' ) ) {
        if ( $_POST['tour_guide_action'] === 'save_activation' && isset( $_POST['template_status'] ) && is_array( $_POST['template_status'] ) ) {
            $status_map = array();
            // Récupérer l'ordre s'il est envoyé (chaine JSON ou liste séparée par virgules)
            $order_list = array();
            if ( isset( $_POST['active_tours_order'] ) ) {
                $raw_order = sanitize_text_field( $_POST['active_tours_order'] );
                if ( $raw_order ) {
                    $order_list = explode( ',', $raw_order );
                }
            }

            foreach ( $_POST['template_status'] as $id => $status ) {
                $clean_id = sanitize_text_field( $id );
                $clean_status = sanitize_key( $status );
                if ( in_array( $clean_status, array( 'menu', 'url_only' ), true ) ) {
                    $status_map[ $clean_id ] = $clean_status;
                }
            }
            
            // Si on a un ordre défini, on trie $status_map selon cet ordre
            if ( ! empty( $order_list ) ) {
                $ordered_map = array();
                foreach ( $order_list as $oid ) {
                    if ( isset( $status_map[ $oid ] ) ) {
                        $ordered_map[ $oid ] = $status_map[ $oid ];
                        unset( $status_map[ $oid ] );
                    }
                }
                // Ajouter les restants (modules ou nouveaux) à la fin
                $ordered_map = array_merge( $ordered_map, $status_map );
                $status_map = $ordered_map;
            }

            update_option( 'tour_guide_active_templates', $status_map );
            echo '<div class="updated"><p>' . esc_html__( 'Templates mis à jour.', 'tour-guide' ) . '</p></div>';
        }
        if ( $_POST['tour_guide_action'] === 'upload' && ! empty( $_FILES['template_xml']['name'] ) ) {
            $file = $_FILES['template_xml'];
            if ( wp_check_filetype( $file['name'], array( 'xml' => 'text/xml' ) )['ext'] === 'xml' ) {
                $dest_dir = tour_guide_get_upload_dir();
                if ( ! file_exists( $dest_dir ) ) { wp_mkdir_p( $dest_dir ); }
                $safe_name = sanitize_file_name( $file['name'] );
                $dest = trailingslashit( $dest_dir ) . $safe_name;
                if ( move_uploaded_file( $file['tmp_name'], $dest ) ) {
                    echo '<div class="updated"><p>' . esc_html__( 'Template importé.', 'tour-guide' ) . '</p></div>';
                } else {
                    echo '<div class="error"><p>' . esc_html__( 'Échec de l’import.', 'tour-guide' ) . '</p></div>';
                }
            } else {
                echo '<div class="error"><p>' . esc_html__( 'Fichier non valide (XML requis).', 'tour-guide' ) . '</p></div>';
            }
        }
        if ( $_POST['tour_guide_action'] === 'upload_media' && ! empty( $_FILES['tour_guide_media']['name'] ) ) {
            $file = $_FILES['tour_guide_media'];
            // Autoriser quelques types d’images et de vidéos courants
            $allowed_types = array(
                'jpg'  => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'png'  => 'image/png',
                'gif'  => 'image/gif',
                'webp' => 'image/webp',
                'mp4'  => 'video/mp4',
                'webm' => 'video/webm',
                'ogg'  => 'video/ogg',
            );
            $check = wp_check_filetype( $file['name'], $allowed_types );
            if ( $check['ext'] && $check['type'] ) {
                $dest_dir = tour_guide_get_media_dir();
                if ( ! file_exists( $dest_dir ) ) { wp_mkdir_p( $dest_dir ); }
                $safe_name = sanitize_file_name( $file['name'] );
                $dest = trailingslashit( $dest_dir ) . $safe_name;
                if ( move_uploaded_file( $file['tmp_name'], $dest ) ) {
                    echo '<div class="updated"><p>' . esc_html__( 'Média importé.', 'tour-guide' ) . '</p></div>';
                } else {
                    echo '<div class="error"><p>' . esc_html__( 'Échec de l’import du média.', 'tour-guide' ) . '</p></div>';
                }
            } else {
                echo '<div class="error"><p>' . esc_html__( 'Type de fichier non autorisé pour les médias.', 'tour-guide' ) . '</p></div>';
            }
        }
        if ( $_POST['tour_guide_action'] === 'save_template' ) {
            $result = tour_guide_handle_save_template_post();
            if ( $result['success'] ) {
                echo '<div class="updated"><p>' . esc_html( $result['message'] ) . '</p></div>';
            } else {
                echo '<div class="error"><p>' . esc_html( $result['message'] ) . '</p></div>';
            }
        }
        if ( $_POST['tour_guide_action'] === 'delete_template' && isset( $_POST['template_id'] ) ) {
            $del_id = sanitize_text_field( $_POST['template_id'] );
            $deleted = tour_guide_delete_template( $del_id );
            if ( $deleted ) {
                echo '<div class="updated"><p>' . esc_html__( 'Template supprimé.', 'tour-guide' ) . '</p></div>';
            } else {
                echo '<div class="error"><p>' . esc_html__( 'Impossible de supprimer ce template.', 'tour-guide' ) . '</p></div>';
            }
        }
        if ( $_POST['tour_guide_action'] === 'export_template' && isset( $_POST['template_id'] ) ) {
             // L'export est géré par tour_guide_handle_export_action via admin_init.
             // Si on arrive ici, c'est que l'export a échoué (ex: exit non appelé car fichier introuvable).
             echo '<div class="error"><p>' . esc_html__( 'Impossible d’exporter ce template (fichier introuvable).', 'tour-guide' ) . '</p></div>';
        }
    }

    $edit_id = isset( $_GET['edit'] ) ? sanitize_text_field( wp_unslash( $_GET['edit'] ) ) : '';
    $editing_template = $edit_id ? tour_guide_load_template_for_edit( $edit_id ) : false;

    $all = tour_guide_list_all_templates();
    $active = tour_guide_get_active_templates();

    ?>
    <div class="wrap">
        <h1><?php echo esc_html__( 'Templates de visite guidée (XML)', 'tour-guide' ); ?></h1>

        <h2><?php echo esc_html__( 'Créer / modifier un template', 'tour-guide' ); ?></h2>
        <form method="post">
            <?php wp_nonce_field( 'tour_guide_templates' ); ?>
            <input type="hidden" name="tour_guide_action" value="save_template" />
            <input type="hidden" name="template_path" value="<?php echo $editing_template ? esc_attr( $editing_template['path'] ) : ''; ?>" />

            <table class="form-table">
                <tr>
                    <th scope="row"><label for="template_type"><?php echo esc_html__( 'Type de template', 'tour-guide' ); ?></label></th>
                    <td>
                        <?php $current_type = $editing_template && isset( $editing_template['type'] ) ? $editing_template['type'] : 'tour'; ?>
                        <fieldset>
                            <label><input type="radio" name="template_type" value="tour" <?php checked( $current_type, 'tour' ); ?> /> <?php echo esc_html__( 'Visite guidée (Standard)', 'tour-guide' ); ?></label><br/>
                            <label><input type="radio" name="template_type" value="module" <?php checked( $current_type, 'module' ); ?> /> <?php echo esc_html__( 'Module (Brique réutilisable)', 'tour-guide' ); ?></label>
                        </fieldset>
                        <p class="description"><?php echo esc_html__( 'Les modules sont pensés pour être inclus dans d\'autres visites et n\'apparaissent pas directement dans le menu principal.', 'tour-guide' ); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="template_attr_id"><?php echo esc_html__( 'ID du template', 'tour-guide' ); ?></label></th>
                    <td>
                        <input name="template_attr_id" id="template_attr_id" type="text" class="regular-text" value="<?php echo $editing_template ? esc_attr( $editing_template['attr_id'] ) : ''; ?>" />

                        <p class="description"><?php echo esc_html__( 'Utilisé dans l’attribut id="" du template XML. Peut aussi servir à lancer une visite via l’URL, par exemple ?visite=mon-id.', 'tour-guide' ); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="template_page_start"><?php echo esc_html__( 'Démarrer la visite sur', 'tour-guide' ); ?></label></th>
                    <td>
                        <input name="template_page_start" id="template_page_start" type="text" class="regular-text" value="<?php echo $editing_template ? esc_attr( isset($editing_template['page_start']) ? $editing_template['page_start'] : '' ) : ''; ?>" placeholder="/ma-page.php" />
                        <p class="description"><?php echo esc_html__( 'Si renseigné, le lien dans le menu redirigera vers cette page avec ?visite=ID (ex: /admin.php -> /admin.php?visite=mon-id).', 'tour-guide' ); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="template_title"><?php echo esc_html__( 'Titre du template', 'tour-guide' ); ?></label></th>
                    <td>
                        <input name="template_title" id="template_title" type="text" class="regular-text" value="<?php echo $editing_template ? esc_attr( $editing_template['title'] ) : ''; ?>" />
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="template_context"><?php echo esc_html__( 'Contexte', 'tour-guide' ); ?></label></th>
                    <td>
                        <?php
                        $current_context = $editing_template && isset( $editing_template['context'] ) ? $editing_template['context'] : 'all';
                        $contexts = array(
                            'all'    => __( 'Partout (admin, éditeur, front)', 'tour-guide' ),
                            'admin'  => __( 'Administration (barre d’outils, pages admin)', 'tour-guide' ),
                            'editor' => __( 'Éditeur Gutenberg (articles/pages)', 'tour-guide' ),
                            'front'  => __( 'Front du site', 'tour-guide' ),
                        );
                        ?>
                        <select name="template_context" id="template_context">
                            <?php foreach ( $contexts as $value => $label ) : ?>
                                <option value="<?php echo esc_attr( $value ); ?>" <?php selected( $current_context, $value ); ?>><?php echo esc_html( $label ); ?></option>
                            <?php endforeach; ?>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php echo esc_html__( 'Emplacement du fichier', 'tour-guide' ); ?></th>
                    <td>
                        <?php
                        // Déterminer l’emplacement actuel (plugin ou upload) pour pré-sélection
                        $current_storage = 'upload';
                        if ( $editing_template && ! empty( $editing_template['path'] ) ) {
                            $plugin_templates_dir = trailingslashit( TOUR_GUIDE_DIR ) . 'templates/';
                            if ( 0 === strpos( $editing_template['path'], $plugin_templates_dir ) ) {
                                $current_storage = 'plugin';
                            } else {
                                $current_storage = 'upload';
                            }
                        }
                        ?>
                        <fieldset>
                            <label>
                                <input type="radio" name="template_storage" value="plugin" <?php checked( $current_storage, 'plugin' ); ?> />
                                <?php echo esc_html__( 'Dossier du plugin (wp-content/plugins/tour-guide/templates/)', 'tour-guide' ); ?>
                            </label>
                            <br />
                            <label>
                                <input type="radio" name="template_storage" value="upload" <?php checked( $current_storage, 'upload' ); ?> />
                                <?php echo esc_html__( 'Dossier d’uploads (wp-content/uploads/tour-guide/templates/)', 'tour-guide' ); ?>
                            </label>
                            <p class="description"><?php echo esc_html__( 'Pour les nouveaux templates, contrôle où le fichier XML sera créé. Les templates existants restent en place.', 'tour-guide' ); ?></p>
                        </fieldset>
                    </td>
                </tr>
            </table>

            <h3><?php echo esc_html__( 'Étapes de la visite', 'tour-guide' ); ?></h3>
            <p class="description"><?php echo esc_html__( 'Définissez les sélecteurs CSS, titres, descriptions et positions des bulles Driver.js.', 'tour-guide' ); ?></p>
            <table class="widefat fixed" style="max-width: 1000px;" id="tour-guide-steps-table">
                <thead>
                    <tr>
                        <th><?php echo esc_html__( 'Étape', 'tour-guide' ); ?></th>
                        <th><?php echo esc_html__( 'Sélecteur CSS', 'tour-guide' ); ?></th>
                        <th><?php echo esc_html__( 'Type', 'tour-guide' ); ?></th>
                        <th><?php echo esc_html__( 'Template à inclure', 'tour-guide' ); ?></th>
                        <th><?php echo esc_html__( 'Titre', 'tour-guide' ); ?></th>
                        <th><?php echo esc_html__( 'Description', 'tour-guide' ); ?></th>
                        <th><?php echo esc_html__( 'Position', 'tour-guide' ); ?></th>
                        <th><?php echo esc_html__( 'Action', 'tour-guide' ); ?></th>
                        <th><?php echo esc_html__( 'Attendre (wait_for)', 'tour-guide' ); ?></th>
                        <th><?php echo esc_html__( 'Reprendre (resume)', 'tour-guide' ); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    $existing_steps = $editing_template ? $editing_template['steps'] : array();

                    // Prépare la liste des médias disponibles dans:
                    // - le dossier assets/media du plugin
                    // - le dossier d’uploads /tour-guide/media
                    $video_files = array();
                    $image_files = array();

                    // 1) Médias du plugin
                    $plugin_media_dir = trailingslashit( TOUR_GUIDE_DIR ) . 'assets/media/';
                    $plugin_media_url = trailingslashit( TOUR_GUIDE_URL ) . 'assets/media/';
                    if ( is_dir( $plugin_media_dir ) ) {
                        $plugin_media_paths = glob( $plugin_media_dir . '*.{mp4,webm,ogg,jpg,jpeg,png,gif,webp}', GLOB_BRACE );
                        if ( $plugin_media_paths ) {
                            foreach ( $plugin_media_paths as $mp ) {
                                $basename = basename( $mp );
                                $ext = strtolower( pathinfo( $basename, PATHINFO_EXTENSION ) );
                                $full_url = $plugin_media_url . $basename;
                                // On stocke une URL relative (sans nom de domaine)
                                $rel_url = function_exists( 'wp_make_link_relative' ) ? wp_make_link_relative( $full_url ) : $full_url;
                                $item = array(
                                    'file' => $basename,
                                    'url'  => $rel_url,
                                );
                                if ( in_array( $ext, array( 'mp4', 'webm', 'ogg' ), true ) ) {
                                    $video_files[] = $item;
                                } else {
                                    $image_files[] = $item;
                                }
                            }
                        }
                    }

                    // 2) Médias uploadés
                    $upload_media_dir = tour_guide_get_media_dir();
                    $upload_media_url = tour_guide_get_media_url();
                    if ( is_dir( $upload_media_dir ) ) {
                        $upload_media_paths = glob( trailingslashit( $upload_media_dir ) . '*.{mp4,webm,ogg,jpg,jpeg,png,gif,webp}', GLOB_BRACE );
                        if ( $upload_media_paths ) {
                            foreach ( $upload_media_paths as $mp ) {
                                $basename = basename( $mp );
                                $ext = strtolower( pathinfo( $basename, PATHINFO_EXTENSION ) );
                                $full_url = $upload_media_url . $basename;
                                // URL relative (sans nom de domaine)
                                $rel_url = function_exists( 'wp_make_link_relative' ) ? wp_make_link_relative( $full_url ) : $full_url;
                                $item = array(
                                    'file' => $basename,
                                    'url'  => $rel_url,
                                );
                                if ( in_array( $ext, array( 'mp4', 'webm', 'ogg' ), true ) ) {
                                    $video_files[] = $item;
                                } else {
                                    $image_files[] = $item;
                                }
                            }
                        }
                    }

                    $rows_count = max( count( $existing_steps ), 1 );
                    for ( $i = 0; $i < $rows_count; $i++ ) {
                        $step = isset( $existing_steps[ $i ] ) ? $existing_steps[ $i ] : array( 'type' => 'step', 'include_template' => '', 'selector' => '', 'title' => '', 'description' => '', 'position' => '', 'action' => 'none', 'action_selector' => '', 'wait_for' => '', 'wait_timeout' => '', 'delay_ms' => '', 'navigate_to' => '', 'resume' => 'none' );
                        ?>
                        <tr>
                            <td class="tg-sec-number"><?php echo ( $i + 1 ); ?></td>
                            <td class="tg-sec-selector">
                                <span class="tg-cell-label"><span class="tg-info" data-tip="Sélecteur CSS de l'élément ciblé (ex: #menu-appearance, .my-class)">i</span></span>
                                <input type="text" name="step_selector[]" value="<?php echo esc_attr( $step['selector'] ); ?>" class="regular-text" />
                            </td>
                            <td class="tg-sec-type">
                                <span class="tg-cell-label"><span class="tg-info" data-tip="Type : Popup (bulle simple), Action (avec action automatique) ou Include (réutiliser un template)">i</span></span>
                                <?php 
                                $step_ui_type = 'popup'; // par défaut
                                if ( isset($step['type']) && $step['type'] === 'include' ) {
                                    $step_ui_type = 'include';
                                } elseif ( isset($step['action']) && $step['action'] !== 'none' && $step['action'] !== '' ) {
                                    $step_ui_type = 'action';
                                }
                                ?>
                                <select name="step_type[]" class="tg-step-type">
                                    <option value="popup" <?php selected( $step_ui_type, 'popup' ); ?>><?php echo esc_html__( 'Popup', 'tour-guide' ); ?></option>
                                    <option value="action" <?php selected( $step_ui_type, 'action' ); ?>><?php echo esc_html__( 'Action', 'tour-guide' ); ?></option>
                                    <option value="include" <?php selected( $step_ui_type, 'include' ); ?>><?php echo esc_html__( 'Include', 'tour-guide' ); ?></option>
                                </select>
                            </td>
                            <td class="tg-sec-include">
                                <span class="tg-cell-label"><span class="tg-info" data-tip="ID du template à inclure (ex: ajouter-composition)">i</span></span>
                                <input type="text" name="step_include_template[]" value="<?php echo esc_attr( isset($step['include_template']) ? $step['include_template'] : '' ); ?>" class="regular-text" placeholder="ex: ajouter-composition" />
                            </td>
                            <td class="tg-sec-title">
                                <span class="tg-cell-label"><span class="tg-info" data-tip="Titre affiché dans la popover Driver.js">i</span></span>
                                <input type="text" name="step_title[]" value="<?php echo esc_attr( $step['title'] ); ?>" class="regular-text" />
                            </td>
                            <td class="tg-sec-desc">
                                <span class="tg-cell-label"><span class="tg-info" data-tip="Description affichée dans la popover">i</span></span>
                                <?php if ( ! empty( $video_files ) || ! empty( $image_files ) ) : ?>
                                    <div class="tg-media-tools">
                                        <?php if ( ! empty( $video_files ) ) : ?>
                                            <div class="tg-video-tools">
                                                <label for="tg-video-select-<?php echo $i; ?>" class="screen-reader-text"><?php echo esc_html__( 'Insérer une vidéo', 'tour-guide' ); ?></label>
                                                <select id="tg-video-select-<?php echo $i; ?>" class="tg-video-select" data-step-index="<?php echo $i; ?>">
                                                    <option value=""><?php echo esc_html__( 'Sélectionner une vidéo à insérer…', 'tour-guide' ); ?></option>
                                                    <?php foreach ( $video_files as $vf ) : ?>
                                                        <option value="<?php echo esc_attr( $vf['url'] ); ?>"><?php echo esc_html( $vf['file'] ); ?></option>
                                                    <?php endforeach; ?>
                                                </select>
                                                <button type="button" class="button tg-video-copy-btn" data-step-index="<?php echo $i; ?>"><?php echo esc_html__( 'Copier le code vidéo', 'tour-guide' ); ?></button>
                                            </div>
                                        <?php endif; ?>

                                        <?php if ( ! empty( $image_files ) ) : ?>
                                            <div class="tg-image-tools" style="margin-top:4px;">
                                                <label for="tg-image-select-<?php echo $i; ?>" class="screen-reader-text"><?php echo esc_html__( 'Insérer une image', 'tour-guide' ); ?></label>
                                                <select id="tg-image-select-<?php echo $i; ?>" class="tg-image-select" data-step-index="<?php echo $i; ?>">
                                                    <option value=""><?php echo esc_html__( 'Sélectionner une image à insérer…', 'tour-guide' ); ?></option>
                                                    <?php foreach ( $image_files as $im ) : ?>
                                                        <option value="<?php echo esc_attr( $im['url'] ); ?>"><?php echo esc_html( $im['file'] ); ?></option>
                                                    <?php endforeach; ?>
                                                </select>
                                                <button type="button" class="button tg-image-copy-btn" data-step-index="<?php echo $i; ?>"><?php echo esc_html__( 'Copier le code image', 'tour-guide' ); ?></button>
                                            </div>
                                        <?php endif; ?>
                                    </div>
                                <?php endif; ?>
                                <textarea name="step_description[]" rows="2" class="large-text"><?php echo esc_textarea( $step['description'] ); ?></textarea>
                            </td>
                            <td class="tg-sec-position">
                                <span class="tg-cell-label"><span class="tg-info" data-tip="Position de la popover par rapport à l’élément (top/right/bottom/left/center)">i</span></span>
                                <select name="step_position[]">
                                    <?php
                                    $positions = array( 'top', 'right', 'bottom', 'left', 'center' );
                                    foreach ( $positions as $pos ) {
                                        echo '<option value="' . esc_attr( $pos ) . '" ' . selected( $step['position'], $pos, false ) . '>' . esc_html( ucfirst( $pos ) ) . '</option>';
                                    }
                                    ?>
                                </select>
                            </td>
                            <td class="tg-sec-action">
                                <span class="tg-cell-label"><span class="tg-info" data-tip="Définir une action automatique (ex: clic) et/ou une navigation, avant d’afficher la popover">i</span></span>
                                <div class="tg-subfield">
                                    <label>Action automatique</label>
                                    <select name="step_action[]">
                                    <?php $actions = array( 'none' => __( 'Aucune', 'tour-guide' ), 'click' => __( 'Clique', 'tour-guide' ) );
                                    foreach ( $actions as $val => $lab ) {
                                        echo '<option value="' . esc_attr( $val ) . '" ' . selected( isset($step['action'])?$step['action']:'none', $val, false ) . '>' . esc_html( $lab ) . '</option>';
                                    } ?>
                                    </select>
                                </div>
                                <div class="tg-subfield">
                                    <label>Sélecteur pour l’action (optionnel)</label>
                                    <input type="text" name="step_action_selector[]" value="<?php echo esc_attr( isset($step['action_selector'])?$step['action_selector']:'' ); ?>" placeholder="ex: #menu-appearance" class="regular-text" />
                                </div>
                                <div class="tg-subfield">
                                    <label>Naviguer vers (optionnel)</label>
                                    <input type="text" name="step_navigate_to[]" value="<?php echo esc_attr( isset($step['navigate_to'])?$step['navigate_to']:'' ); ?>" placeholder="ex: site-editor.php" class="regular-text" />
                                </div>
                            </td>
                            <td class="tg-sec-wait">
                                <span class="tg-cell-label"><span class="tg-info" data-tip="Attendre l’apparition d’un sélecteur, avec timeout (ms) et un délai optionnel avant d’avancer">i</span></span>
                                <div class="tg-subfield">
                                    <label>Attendre le sélecteur</label>
                                    <input type="text" name="step_wait_for[]" value="<?php echo esc_attr( isset($step['wait_for'])?$step['wait_for']:'' ); ?>" placeholder="ex: .navigation-navigation-item" class="regular-text" />
                                </div>
                                <div class="tg-subfield">
                                    <label>Temps max (ms)</label>
                                    <input type="number" name="step_wait_timeout[]" value="<?php echo esc_attr( isset($step['wait_timeout'])?$step['wait_timeout']:'' ); ?>" placeholder="ex: 4000" class="small-text" />
                                </div>
                                <div class="tg-subfield">
                                    <label>Délai (ms)</label>
                                    <input type="number" name="step_delay_ms[]" value="<?php echo esc_attr( isset($step['delay_ms'])?$step['delay_ms']:'' ); ?>" placeholder="ex: 200" class="small-text" />
                                </div>
                            </td>
                            <td class="tg-sec-resume">
                                <span class="tg-cell-label"><span class="tg-info" data-tip="Reprise automatique après navigation (ex: passer à l’étape suivante)">i</span></span>
                                <select name="step_resume[]">
                                    <?php $resumes = array( 'none' => __( 'Aucune', 'tour-guide' ), 'auto' => __( 'Auto', 'tour-guide' ) );
                                    foreach ( $resumes as $val => $lab ) {
                                        echo '<option value="' . esc_attr( $val ) . '" ' . selected( isset($step['resume'])?$step['resume']:'none', $val, false ) . '>' . esc_html( $lab ) . '</option>';
                                    } ?>
                                </select>
                            </td>
                        </tr>
                        <?php
                    }
                    ?>
                </tbody>
            </table>

            <p><button type="button" class="button" id="tour-guide-add-step"><?php echo esc_html__( 'Ajouter une étape', 'tour-guide' ); ?></button></p>

            <p><button type="submit" class="button button-primary"><?php echo esc_html__( 'Enregistrer le template', 'tour-guide' ); ?></button></p>
        </form>

        <hr />

        <h2><?php echo esc_html__( 'Visites disponibles', 'tour-guide' ); ?></h2>
        <p class="description"><?php echo esc_html__( 'Configurez la disponibilité de chaque visite. Glissez-déposez les lignes du tableau "Mes Visites" pour changer l\'ordre du menu.', 'tour-guide' ); ?></p>
        
        <?php
        // Séparer les templates par type
        $tours_list = array();
        $modules_list = array();
        
        // On récupère la liste triée selon l'ordre d'activation
        $sorted_templates = array();
        $unsorted = array();
        
        // Construire une map ID => Template pour accès rapide
        $all_map = array();
        foreach ($all as $t) { $all_map[$t['id']] = $t; }
        
        // Ajouter d'abord ceux qui sont dans $active (pour respecter l'ordre), puis les autres
        foreach (array_keys($active) as $aid) {
            if (isset($all_map[$aid])) {
                $sorted_templates[] = $all_map[$aid];
                unset($all_map[$aid]);
            }
        }
        // Ajouter le reste
        foreach ($all_map as $t) {
            $sorted_templates[] = $t;
        }
        
        foreach ( $sorted_templates as $tpl ) {
            if ( isset($tpl['type']) && $tpl['type'] === 'module' ) {
                $modules_list[] = $tpl;
            } else {
                $tours_list[] = $tpl;
            }
        }
        ?>

        <form method="post">
            <?php wp_nonce_field( 'tour_guide_templates' ); ?>
            <input type="hidden" name="tour_guide_action" value="save_activation" />
            <input type="hidden" name="active_tours_order" id="active_tours_order" value="" />
            
            <?php if ( ! empty( $tours_list ) ) : ?>
                <h3><?php echo esc_html__( 'Mes Visites (Menu)', 'tour-guide' ); ?></h3>
                <table class="widefat fixed tour-guide-reorder-table" id="tour-guide-templates-activation" style="max-width: 900px; margin-bottom: 20px;">
                    <thead>
                        <tr>
                            <th style="width: 30px;"></th>
                            <th><?php echo esc_html__( 'Disponibilité', 'tour-guide' ); ?></th>
                            <th><?php echo esc_html__( 'Titre', 'tour-guide' ); ?></th>
                            <th><?php echo esc_html__( 'Fichier', 'tour-guide' ); ?></th>
                            <th><?php echo esc_html__( 'Actions', 'tour-guide' ); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ( $tours_list as $tpl ) : 
                            $current_status = isset( $active[ $tpl['id'] ] ) ? $active[ $tpl['id'] ] : 'disabled';
                        ?>
                            <tr data-id="<?php echo esc_attr( $tpl['id'] ); ?>">
                                <td style="cursor: move; color: #ccc;"><span class="dashicons dashicons-menu"></span></td>
                                <td>
                                    <select name="template_status[<?php echo esc_attr( $tpl['id'] ); ?>]" style="width: 100%;">
                                        <option value="disabled" <?php selected( $current_status, 'disabled' ); ?>><?php echo esc_html__( 'Désactivé', 'tour-guide' ); ?></option>
                                        <option value="menu" <?php selected( $current_status, 'menu' ); ?>><?php echo esc_html__( 'Menu + URL', 'tour-guide' ); ?></option>
                                        <option value="url_only" <?php selected( $current_status, 'url_only' ); ?>><?php echo esc_html__( 'URL uniquement', 'tour-guide' ); ?></option>
                                    </select>
                                </td>
                                <td><strong><?php echo esc_html( $tpl['title'] ); ?></strong></td>
                                <td><?php echo esc_html( $tpl['file'] ); ?></td>
                                <td>
                                    <a href="<?php echo esc_url( admin_url( 'admin.php?page=tour-guide-templates&edit=' . urlencode( $tpl['id'] ) ) ); ?>" class="button button-small"><?php echo esc_html__( 'Modifier', 'tour-guide' ); ?></a>
                                    <button type="button" class="button button-small tour-guide-export-btn" data-id="<?php echo esc_attr( $tpl['id'] ); ?>" style="margin-left: 5px;"><?php echo esc_html__( 'Exporter', 'tour-guide' ); ?></button>
                                    <?php if($tpl['source']==='upload'): ?>
                                    <button type="button" class="button button-small button-link-delete tour-guide-delete-btn" data-id="<?php echo esc_attr( $tpl['id'] ); ?>" style="color: #b32d2e; margin-left: 5px;" aria-label="<?php echo esc_attr__( 'Supprimer ce template', 'tour-guide' ); ?>">&times;</button>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>

            <?php if ( ! empty( $modules_list ) ) : ?>
                <h3><?php echo esc_html__( 'Mes Modules (Includes)', 'tour-guide' ); ?></h3>
                <table class="widefat fixed" style="max-width: 900px;">
                    <thead>
                        <tr>
                            <th><?php echo esc_html__( 'ID (pour include)', 'tour-guide' ); ?></th>
                            <th><?php echo esc_html__( 'Titre', 'tour-guide' ); ?></th>
                            <th><?php echo esc_html__( 'Fichier', 'tour-guide' ); ?></th>
                            <th><?php echo esc_html__( 'Actions', 'tour-guide' ); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ( $modules_list as $tpl ) : 
                             // Les modules sont toujours "url_only" ou "disabled", mais ici on ne gère pas le menu
                             // On force un hidden field pour garder le statut s'il existe, sinon url_only par défaut
                             $current_status = isset( $active[ $tpl['id'] ] ) ? $active[ $tpl['id'] ] : 'url_only';
                        ?>
                            <tr>
                                <td>
                                    <input type="text" readonly value="<?php echo esc_attr( $tpl['attr_id'] ); ?>" class="regular-text" style="background:#eee;" />
                                    <input type="hidden" name="template_status[<?php echo esc_attr( $tpl['id'] ); ?>]" value="<?php echo esc_attr($current_status); ?>" />
                                </td>
                                <td><strong><?php echo esc_html( $tpl['title'] ); ?></strong></td>
                                <td><?php echo esc_html( $tpl['file'] ); ?></td>
                                <td>
                                    <a href="<?php echo esc_url( admin_url( 'admin.php?page=tour-guide-templates&edit=' . urlencode( $tpl['id'] ) ) ); ?>" class="button button-small"><?php echo esc_html__( 'Modifier', 'tour-guide' ); ?></a>
                                    <button type="button" class="button button-small tour-guide-export-btn" data-id="<?php echo esc_attr( $tpl['id'] ); ?>" style="margin-left: 5px;"><?php echo esc_html__( 'Exporter', 'tour-guide' ); ?></button>
                                    <?php if($tpl['source']==='upload'): ?>
                                    <button type="button" class="button button-small button-link-delete tour-guide-delete-btn" data-id="<?php echo esc_attr( $tpl['id'] ); ?>" style="color: #b32d2e; margin-left: 5px;"><?php echo esc_html__( 'Supprimer', 'tour-guide' ); ?></button>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>

            <p><button type="submit" class="button button-primary"><?php echo esc_html__( 'Enregistrer l\'ordre et la disponibilité', 'tour-guide' ); ?></button></p>
        </form>
        
        <!-- Formulaire caché pour la suppression -->
        <form id="tour-guide-delete-form" method="post" style="display:none;">
            <?php wp_nonce_field( 'tour_guide_templates' ); ?>
            <input type="hidden" name="tour_guide_action" value="delete_template" />
            <input type="hidden" name="template_id" id="tour-guide-delete-id" value="" />
        </form>
        
        <!-- Formulaire caché pour l'export -->
        <form id="tour-guide-export-form" method="post" style="display:none;">
            <?php wp_nonce_field( 'tour_guide_templates' ); ?>
            <input type="hidden" name="tour_guide_action" value="export_template" />
            <input type="hidden" name="template_id" id="tour-guide-export-id" value="" />
        </form>
        
        <script>
        document.addEventListener('DOMContentLoaded', function(){
            var delBtns = document.querySelectorAll('.tour-guide-delete-btn');
            delBtns.forEach(function(btn){
                btn.addEventListener('click', function(e){
                    e.preventDefault();
                    if(confirm('<?php echo esc_js( __( 'Êtes-vous sûr de vouloir supprimer ce template ?', 'tour-guide' ) ); ?>')){
                        document.getElementById('tour-guide-delete-id').value = btn.getAttribute('data-id');
                        document.getElementById('tour-guide-delete-form').submit();
                    }
                });
            });
            
            var expBtns = document.querySelectorAll('.tour-guide-export-btn');
            expBtns.forEach(function(btn){
                btn.addEventListener('click', function(e){
                    e.preventDefault();
                    document.getElementById('tour-guide-export-id').value = btn.getAttribute('data-id');
                    document.getElementById('tour-guide-export-form').submit();
                });
            });
        });
        </script>

        <h2><?php echo esc_html__( 'Importer un template (XML)', 'tour-guide' ); ?></h2>
        <form method="post" enctype="multipart/form-data">
            <?php wp_nonce_field( 'tour_guide_templates' ); ?>
            <input type="hidden" name="tour_guide_action" value="upload" />
            <input type="file" name="template_xml" accept=".xml" required />
            <button type="submit" class="button"><?php echo esc_html__( 'Importer', 'tour-guide' ); ?></button>
        </form>

        <h2 style="margin-top:20px;">&nbsp;</h2>
        <h2><?php echo esc_html__( 'Importer un média (image / vidéo) pour les descriptions', 'tour-guide' ); ?></h2>
        <form method="post" enctype="multipart/form-data">
            <?php wp_nonce_field( 'tour_guide_templates' ); ?>
            <input type="hidden" name="tour_guide_action" value="upload_media" />
            <input type="file" name="tour_guide_media" accept="image/*,video/*" required />
            <button type="submit" class="button"><?php echo esc_html__( 'Importer le média', 'tour-guide' ); ?></button>
        </form>
    </div>
    <?php
}

// Charger un template pour édition (à partir de son ID interne)
function tour_guide_load_template_for_edit( $internal_id ) {
    $templates = tour_guide_list_all_templates();
    foreach ( $templates as $tpl ) {
        if ( $tpl['id'] === $internal_id ) {
            $path = $tpl['path'];
            if ( ! file_exists( $path ) ) {
                return false;
            }
            
            // Parser le XML manuellement pour détecter les includes (ne pas utiliser tour_guide_parse_template_steps qui les résout)
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
                                'type'            => 'include',
                                'include_template'=> $include_id,
                                'selector'        => '',
                                'title'           => '',
                                'description'     => '',
                                'position'        => 'bottom',
                                'action'          => 'none',
                                'action_selector' => '',
                                'wait_for'        => '',
                                'wait_timeout'    => '',
                                'delay_ms'        => '',
                                'navigate_to'     => '',
                                'resume'          => 'none',
                            );
                        } elseif ( $child->getName() === 'step' ) {
                            // C'est une step normale
                            $step_elem = $child;
                            $selector = isset( $step_elem['selector'] ) ? (string) $step_elem['selector'] : 'body';
                            $position = isset( $step_elem['position'] ) ? (string) $step_elem['position'] : 'bottom';
                            $title    = isset( $step_elem->title ) ? trim( (string) $step_elem->title ) : '';
                            $desc_raw = isset( $step_elem->description ) ? trim( (string) $step_elem->description ) : '';
                            
                            // Traiter la description
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
                            
                            // Orchestration
                            $action          = isset( $step_elem->action ) ? trim( (string) $step_elem->action ) : 'none';
                            $action_selector = isset( $step_elem->action_selector ) ? trim( (string) $step_elem->action_selector ) : '';
                            $wait_for        = isset( $step_elem->wait_for ) ? trim( (string) $step_elem->wait_for ) : '';
                            $wait_timeout    = isset( $step_elem->wait_timeout ) ? intval( (string) $step_elem->wait_timeout ) : '';
                            $delay_ms        = isset( $step_elem->delay_ms ) ? intval( (string) $step_elem->delay_ms ) : '';
                            $navigate_to     = isset( $step_elem->navigate_to ) ? trim( (string) $step_elem->navigate_to ) : '';
                            $resume          = isset( $step_elem->resume ) ? trim( (string) $step_elem->resume ) : 'none';
                            
                            $steps[] = array(
                                'type'            => 'step',
                                'selector'        => $selector,
                                'title'           => $title,
                                'description'     => $desc_for_form,
                                'position'        => $position,
                                'action'          => $action,
                                'action_selector' => $action_selector,
                                'wait_for'        => $wait_for,
                                'wait_timeout'    => $wait_timeout,
                                'delay_ms'        => $delay_ms,
                                'navigate_to'     => $navigate_to,
                                'resume'          => $resume,
                                'include_template'=> '',
                            );
                        }
                    }
                }
            }

            // Récupérer l’attribut id et le contexte du template depuis le XML
            $attr_id = '';
            $page_start = '';
            $context = isset( $tpl['context'] ) ? $tpl['context'] : 'all';
            $type = 'tour';
            if ( function_exists( 'simplexml_load_file' ) ) {
                $xml = @simplexml_load_file( $path );
                if ( $xml ) {
                    if ( isset( $xml['id'] ) ) {
                        $attr_id = (string) $xml['id'];
                    }
                    if ( isset( $xml['context'] ) ) {
                        $context = (string) $xml['context'];
                    }
                    if ( isset( $xml['page_start'] ) ) {
                        $page_start = (string) $xml['page_start'];
                    }
                    if ( isset( $xml['type'] ) ) {
                        $type = (string) $xml['type'];
                    }
                }
            }

            return array(
                'path'    => $path,
                'file'    => $tpl['file'],
                'title'   => $tpl['title'],
                'attr_id' => $attr_id,
                'page_start' => $page_start,
                'context' => $context,
                'type'    => $type,
                'steps'   => $steps,
            );
        }
    }
    return false;
}

// Gérer la sauvegarde d’un template à partir du formulaire
function tour_guide_handle_save_template_post() {
    $attr_id = isset( $_POST['template_attr_id'] ) ? sanitize_text_field( wp_unslash( $_POST['template_attr_id'] ) ) : '';
    $page_start = isset( $_POST['template_page_start'] ) ? sanitize_text_field( wp_unslash( $_POST['template_page_start'] ) ) : '';
    $title   = isset( $_POST['template_title'] ) ? sanitize_text_field( wp_unslash( $_POST['template_title'] ) ) : '';
    $path    = isset( $_POST['template_path'] ) ? wp_unslash( $_POST['template_path'] ) : '';
    $context = isset( $_POST['template_context'] ) ? sanitize_text_field( wp_unslash( $_POST['template_context'] ) ) : 'all';
    $type    = isset( $_POST['template_type'] ) ? sanitize_text_field( wp_unslash( $_POST['template_type'] ) ) : 'tour';
    $storage = isset( $_POST['template_storage'] ) ? sanitize_text_field( wp_unslash( $_POST['template_storage'] ) ) : '';

    $allowed_contexts = array( 'all', 'admin', 'editor', 'front' );
    if ( ! in_array( $context, $allowed_contexts, true ) ) {
        $context = 'all';
    }

    $step_types      = isset( $_POST['step_type'] ) ? (array) $_POST['step_type'] : array();
    $include_templates = isset( $_POST['step_include_template'] ) ? (array) $_POST['step_include_template'] : array();
    $selectors    = isset( $_POST['step_selector'] ) ? (array) $_POST['step_selector'] : array();
    $titles       = isset( $_POST['step_title'] ) ? (array) $_POST['step_title'] : array();
    $descriptions = isset( $_POST['step_description'] ) ? (array) $_POST['step_description'] : array();
    $positions    = isset( $_POST['step_position'] ) ? (array) $_POST['step_position'] : array();
    $actions      = isset( $_POST['step_action'] ) ? (array) $_POST['step_action'] : array();
    $act_selectors= isset( $_POST['step_action_selector'] ) ? (array) $_POST['step_action_selector'] : array();
    $wait_for     = isset( $_POST['step_wait_for'] ) ? (array) $_POST['step_wait_for'] : array();
    $wait_timeout = isset( $_POST['step_wait_timeout'] ) ? (array) $_POST['step_wait_timeout'] : array();
    $delay_ms     = isset( $_POST['step_delay_ms'] ) ? (array) $_POST['step_delay_ms'] : array();
    $navigate_to  = isset( $_POST['step_navigate_to'] ) ? (array) $_POST['step_navigate_to'] : array();
    $resume       = isset( $_POST['step_resume'] ) ? (array) $_POST['step_resume'] : array();

    $steps = array();
    $count = max( count( $step_types ), count( $selectors ), count( $titles ), count( $descriptions ), count( $positions ), count($actions), count($act_selectors), count($wait_for), count($wait_timeout), count($delay_ms), count($navigate_to), count($resume), count($include_templates) );
    for ( $i = 0; $i < $count; $i++ ) {
        $step_ui_type = isset( $step_types[ $i ] ) ? trim( wp_unslash( $step_types[ $i ] ) ) : 'popup';
        
        // Si c'est un include
        if ( $step_ui_type === 'include' ) {
            $include_id = isset( $include_templates[ $i ] ) ? trim( wp_unslash( $include_templates[ $i ] ) ) : '';
            if ( '' !== $include_id ) {
                $steps[] = array(
                    'type' => 'include',
                    'include_template' => $include_id,
                );
            }
            continue;
        }
        
        // Sinon c'est une step normale (popup ou action)
        $sel  = isset( $selectors[ $i ] ) ? trim( wp_unslash( $selectors[ $i ] ) ) : '';
        $st   = isset( $titles[ $i ] ) ? trim( wp_unslash( $titles[ $i ] ) ) : '';
        $desc = isset( $descriptions[ $i ] ) ? trim( wp_unslash( $descriptions[ $i ] ) ) : '';
        $pos  = isset( $positions[ $i ] ) ? trim( wp_unslash( $positions[ $i ] ) ) : '';

        // Auto-paragrapher les descriptions : chaque ligne de texte devient un <p>…</p>.
        // Les lignes qui commencent déjà par un tag HTML (ex. <video>) sont laissées telles quelles.
        if ( '' !== $desc ) {
            $lines = preg_split( "/\r\n|\r|\n/", $desc );
            if ( $lines && is_array( $lines ) ) {
                $paras = array();
                foreach ( $lines as $line ) {
                    $line = trim( $line );
                    if ( '' === $line ) {
                        continue;
                    }
                    if ( 0 === strpos( $line, '<' ) ) {
                        // Ligne HTML (ex. <video>…), ne pas l’envelopper dans un <p>.
                        $paras[] = $line;
                    } else {
                        // Ligne texte (éventuellement avec HTML inline comme <strong>).
                        $paras[] = '<p>' . $line . '</p>';
                    }
                }
                if ( ! empty( $paras ) ) {
                    $desc = implode( "\n", $paras );
                }
            }
        }
        if ( '' === $sel && '' === $st && '' === $desc && $step_ui_type !== 'action' && $step_ui_type !== 'include' ) {
            continue; // ignorer les lignes vides pour les popups
        }
        // Pour les actions, on vérifie s'il y a au moins une config d'action/navigation
        if ( $step_ui_type === 'action' ) {
             $act_sel = isset($act_selectors[$i]) ? trim( wp_unslash($act_selectors[$i]) ) : '';
             $nav     = isset($navigate_to[$i]) ? trim( wp_unslash($navigate_to[$i]) ) : '';
             $wait    = isset($wait_for[$i]) ? trim( wp_unslash($wait_for[$i]) ) : '';
             // Si tout est vide, on ignore
             if ( '' === $act_sel && '' === $nav && '' === $wait && '' === $sel ) {
                 continue;
             }
        }
        
        if ( '' === $pos ) {
            $pos = 'bottom';
        }
        
        // Mapping UI type → action
        // On récupère d'abord la valeur brute du formulaire
        $raw_action = isset($actions[$i]) ? sanitize_text_field( wp_unslash($actions[$i]) ) : 'none';
        
        if ( $step_ui_type === 'action' ) {
            // Pour une étape de type "Action", on force une action si 'none'
            $action_value = $raw_action;
            if ( $action_value === 'none' || $action_value === '' ) {
                $action_value = 'click';
            }
        } else {
            // Pour une "Popup", on accepte l'action choisie (peut être 'none' ou 'click')
            $action_value = $raw_action;
        }
        
        $steps[] = array(
            'type'        => 'step',
            'selector'    => $sel,
            'title'       => $st,
            'description' => $desc,
            'position'    => $pos,
            'action'      => $action_value,
            'action_selector' => isset($act_selectors[$i]) ? trim( wp_unslash($act_selectors[$i]) ) : '',
            'wait_for'    => isset($wait_for[$i]) ? trim( wp_unslash($wait_for[$i]) ) : '',
            'wait_timeout'=> isset($wait_timeout[$i]) ? intval($wait_timeout[$i]) : '',
            'delay_ms'    => isset($delay_ms[$i]) ? intval($delay_ms[$i]) : '',
            'navigate_to' => isset($navigate_to[$i]) ? trim( wp_unslash($navigate_to[$i]) ) : '',
            'resume'      => isset($resume[$i]) ? sanitize_text_field( wp_unslash($resume[$i]) ) : 'none',
        );
    }

    if ( empty( $attr_id ) || empty( $title ) || empty( $steps ) ) {
        return array(
            'success' => false,
            'message' => __( 'Veuillez renseigner au minimum l’ID, le titre et une étape.', 'tour-guide' ),
        );
    }

    $xml = tour_guide_build_template_xml( $attr_id, $title, $steps, $context, $page_start, $type );

    // Si pas de chemin existant, on choisit le dossier selon le stockage
    if ( empty( $path ) ) {
        $dir = '';
        if ( 'plugin' === $storage ) {
            // Dossier templates du plugin
            $dir = trailingslashit( TOUR_GUIDE_DIR ) . 'templates/';
        } else {
            // Par défaut ou "upload": dossier uploads
            $dir = tour_guide_get_upload_dir();
            if ( ! file_exists( $dir ) ) {
                wp_mkdir_p( $dir );
            }
        }
        $base = sanitize_file_name( $attr_id ) ? sanitize_file_name( $attr_id ) : 'template';
        $filename = $base . '.xml';
        $full = trailingslashit( $dir ) . $filename;
        $i = 1;
        while ( file_exists( $full ) ) {
            $filename = $base . '-' . $i . '.xml';
            $full = trailingslashit( $dir ) . $filename;
            $i++;
        }
        $path = $full;
    }

    $written = @file_put_contents( $path, $xml );
    if ( false === $written ) {
        return array(
            'success' => false,
            'message' => __( 'Impossible d’enregistrer le fichier XML. Vérifiez les droits d’écriture.', 'tour-guide' ),
        );
    }

    // Mise à jour automatique de la disponibilité si nouveau
    // On recharge les templates pour récupérer le nouvel ID généré via md5(source|title)
    // Note: $path est soit dans uploads (source='upload') soit plugin (source='plugin')
    $source = ( strpos( $path, tour_guide_get_upload_dir() ) === 0 ) ? 'upload' : 'plugin';
    // Le titre est basename(path)
    $file_basename = basename( $path );
    $new_id = md5( $source . '|' . $file_basename );
    
    $active = tour_guide_get_active_templates();
    if ( ! isset( $active[ $new_id ] ) ) {
        $active[ $new_id ] = 'menu';
        update_option( 'tour_guide_active_templates', $active );
    }

    return array(
        'success' => true,
        'message' => __( 'Template enregistré.', 'tour-guide' ),
    );
}

function tour_guide_delete_template( $id ) {
    $templates = tour_guide_list_all_templates();
    foreach ( $templates as $tpl ) {
        if ( $tpl['id'] === $id ) {
            // Vérification : suppression autorisée uniquement pour upload
            if ( $tpl['source'] !== 'upload' ) {
                return false;
            }
            
            if ( file_exists( $tpl['path'] ) ) {
                if ( unlink( $tpl['path'] ) ) {
                    // Nettoyer l'option d'activation
                    $active = tour_guide_get_active_templates();
                    if ( isset( $active[ $id ] ) ) {
                        unset( $active[ $id ] );
                        update_option( 'tour_guide_active_templates', $active );
                    }
                    return true;
                }
            }
        }
    }
    return false;
}

function tour_guide_export_template( $id ) {
    $templates = tour_guide_list_all_templates();
    foreach ( $templates as $tpl ) {
        if ( $tpl['id'] === $id ) {
            if ( file_exists( $tpl['path'] ) ) {
                $filename = basename( $tpl['path'] );
                header( 'Content-Description: File Transfer' );
                header( 'Content-Type: application/xml' );
                header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
                header( 'Expires: 0' );
                header( 'Cache-Control: must-revalidate' );
                header( 'Pragma: public' );
                header( 'Content-Length: ' . filesize( $tpl['path'] ) );
                readfile( $tpl['path'] );
                exit;
            }
        }
    }
}

// Helper pour échapper les attributs XML
function tour_guide_esc_xml( $text ) {
    return htmlspecialchars( $text, ENT_XML1 | ENT_QUOTES, 'UTF-8' );
}

// Construire le XML d’un template à partir de données de formulaire
function tour_guide_build_template_xml( $attr_id, $title, $steps, $context = 'all', $page_start = '', $type = 'tour' ) {
    $attr_id_esc = tour_guide_esc_xml( $attr_id );
    $title_esc   = tour_guide_esc_xml( $title );
    $context_esc = tour_guide_esc_xml( $context );
    $page_start_esc = tour_guide_esc_xml( $page_start );
    $type_esc = tour_guide_esc_xml( $type );

    $xml  = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    $xml .= '<template id="' . $attr_id_esc . '" title="' . $title_esc . '" context="' . $context_esc . '" page_start="' . $page_start_esc . '" type="' . $type_esc . '">' . "\n";
    $xml .= "  <steps>\n";
    foreach ( $steps as $step ) {
        $step_type = isset( $step['type'] ) ? $step['type'] : 'step';
        
        // Si c'est un include
        if ( $step_type === 'include' ) {
            $include_id = isset( $step['include_template'] ) ? $step['include_template'] : '';
            if ( '' !== $include_id ) {
                $xml .= '    <include template="' . tour_guide_esc_xml( $include_id ) . '" />' . "\n";
            }
            continue;
        }
        
        // Sinon c'est une step normale
        $selector = isset( $step['selector'] ) ? $step['selector'] : '';
        $st       = isset( $step['title'] ) ? $step['title'] : '';
        $desc     = isset( $step['description'] ) ? $step['description'] : '';
        $pos      = isset( $step['position'] ) ? $step['position'] : 'bottom';
        $action   = isset( $step['action'] ) ? $step['action'] : '';
        $action_selector = isset( $step['action_selector'] ) ? $step['action_selector'] : '';
        $wait_for = isset( $step['wait_for'] ) ? $step['wait_for'] : '';
        $wait_timeout = isset( $step['wait_timeout'] ) ? $step['wait_timeout'] : '';
        $delay_ms = isset( $step['delay_ms'] ) ? $step['delay_ms'] : '';
        $navigate_to = isset( $step['navigate_to'] ) ? $step['navigate_to'] : '';
        $resume  = isset( $step['resume'] ) ? $step['resume'] : '';

        $xml .= '    <step selector="' . esc_attr( $selector ) . '" position="' . esc_attr( $pos ) . '">' . "\n";
        $xml .= '      <title>' . esc_html( $st ) . '</title>' . "\n";
        $xml .= '      <description><![CDATA[' . $desc . ']]></description>' . "\n";
        if ( $action )        { $xml .= '      <action>' . esc_html( $action ) . '</action>' . "\n"; }
        if ( $action_selector ){ $xml .= '      <action_selector>' . esc_html( $action_selector ) . '</action_selector>' . "\n"; }
        if ( $wait_for )      { $xml .= '      <wait_for>' . esc_html( $wait_for ) . '</wait_for>' . "\n"; }
        if ( $wait_timeout!=='' ) { $xml .= '      <wait_timeout>' . intval( $wait_timeout ) . '</wait_timeout>' . "\n"; }
        if ( $delay_ms!=='' )    { $xml .= '      <delay_ms>' . intval( $delay_ms ) . '</delay_ms>' . "\n"; }
        if ( $navigate_to )   { $xml .= '      <navigate_to>' . esc_html( $navigate_to ) . '</navigate_to>' . "\n"; }
        if ( $resume )        { $xml .= '      <resume>' . esc_html( $resume ) . '</resume>' . "\n"; }
        $xml .= "    </step>\n";
    }
    $xml .= "  </steps>\n";
    $xml .= "</template>\n";

    return $xml;
}

// Utilitaires: lister les templates XML et les actifs
// Retourne un tableau associatif ID => statut ('menu' ou 'url_only')
function tour_guide_get_active_templates() {
    $active = get_option( 'tour_guide_active_templates', array() );
    if ( ! is_array( $active ) ) { $active = array(); }
    // Support ancien format (simple liste d'IDs) pour migration
    if ( ! empty( $active ) && isset( $active[0] ) && is_string( $active[0] ) ) {
        $legacy = $active;
        $active = array();
        foreach ( $legacy as $id ) {
            $active[ $id ] = 'menu';
        }
    }
    return $active;
}

function tour_guide_list_all_templates() {
    $templates = array();

    // Plugin templates
    $plugin_dir = trailingslashit( TOUR_GUIDE_DIR ) . 'templates/';
    if ( file_exists( $plugin_dir ) ) {
        foreach ( glob( $plugin_dir . '*.xml' ) as $file ) {
            $templates[] = tour_guide_parse_template_meta( $file, 'plugin' );
        }
    }

    // Uploaded templates
    $upload_dir = tour_guide_get_upload_dir();
    if ( file_exists( $upload_dir ) ) {
        foreach ( glob( $upload_dir . '*.xml' ) as $file ) {
            $templates[] = tour_guide_parse_template_meta( $file, 'upload' );
        }
    }
    return $templates;
}

function tour_guide_parse_template_meta( $filepath, $source ) {
	$title   = basename( $filepath );
	$id      = md5( $source . '|' . $title );
	$context = 'all';
	$attr_id = '';
	$page_start = '';
    $type = 'tour';

	// Essayer d’extraire un titre depuis le XML: <template id="..." title="..." context="...">
	$content = @file_get_contents( $filepath );
	if ( $content ) {
		// Simple extraction de l’attribut title
		if ( preg_match( '/<template[^>]*title="([^"]+)"/i', $content, $m ) ) {
			$title = wp_strip_all_tags( $m[1] );
		}
		// Extraction de l’attribut context éventuel
		if ( preg_match( '/<template[^>]*context="([^"]+)"/i', $content, $m2 ) ) {
			$context = sanitize_key( $m2[1] );
		}
		// Extraction de l’attribut id éventuel
		if ( preg_match( '/<template[^>]*id="([^"]+)"/i', $content, $m3 ) ) {
			$attr_id = wp_strip_all_tags( $m3[1] );
		}
			// Extraction de l’attribut page_start éventuel
			if ( preg_match( '/<template[^>]*page_start="([^"]+)"/i', $content, $m4 ) ) {
				// Décoder les entités XML/HTML pour retrouver une URL exploitable (ex: &amp; -> &)
				$page_start_raw = $m4[1];
				$page_start_decoded = html_entity_decode( $page_start_raw, ENT_QUOTES, 'UTF-8' );
				$page_start = wp_strip_all_tags( $page_start_decoded );
			}
        // Extraction de l’attribut type éventuel
		if ( preg_match( '/<template[^>]*type="([^"]+)"/i', $content, $m5 ) ) {
			$type = wp_strip_all_tags( $m5[1] );
		}
	}

	return array(
		'id'      => $id,
		'attr_id' => $attr_id,
		'page_start' => $page_start,
		'file'    => basename( $filepath ),
		'path'    => $filepath,
		'title'   => $title,
		'source'  => $source,
		'context' => $context,
        'type'    => $type,
	);
}

// Retourner les templates avec leurs steps (séparés par template)
function tour_guide_get_tours_by_template( $active_only = true, $context_filter = 'all' ) {
    $all    = tour_guide_list_all_templates();
    $active = tour_guide_get_active_templates();
    $tours  = array();

    // Indexer les templates par ID pour pouvoir respecter l'ordre d'activation
    $by_id = array();
    foreach ( $all as $tpl ) {
        if ( isset( $tpl['id'] ) ) {
            $by_id[ $tpl['id'] ] = $tpl;
        }
    }

    if ( $active_only ) {
        // Parcourir dans l'ordre d'activation (clés du tableau $active)
        foreach ( array_keys( $active ) as $id ) {
            if ( ! isset( $by_id[ $id ] ) ) {
                continue;
            }
            $tpl = $by_id[ $id ];
            $tpl['status'] = isset( $active[ $id ] ) ? $active[ $id ] : 'menu';
            
            // Si c'est un module, on force le statut à url_only pour ne pas l'afficher dans le menu
            if ( isset($tpl['type']) && $tpl['type'] === 'module' && $tpl['status'] === 'menu' ) {
                $tpl['status'] = 'url_only';
            }

            $tpl_context = isset( $tpl['context'] ) ? $tpl['context'] : 'all';
            if ( $context_filter && 'all' !== $context_filter ) {
                if ( 'all' !== $tpl_context && $tpl_context !== $context_filter ) {
                    continue;
                }
            }

            $tpl_steps = tour_guide_parse_template_steps( $tpl['path'] );
            if ( ! empty( $tpl_steps ) ) {
                $tours[] = array(
                    'id'     => $tpl['id'],
                    'xml_id' => isset( $tpl['attr_id'] ) ? $tpl['attr_id'] : '',
                    'page_start' => isset( $tpl['page_start'] ) ? $tpl['page_start'] : '',
                    'title'  => $tpl['title'],
                    'type'   => isset( $tpl['type'] ) ? $tpl['type'] : 'tour',
                    'steps'  => $tpl_steps,
                    'status' => isset( $tpl['status'] ) ? $tpl['status'] : 'menu',
                );
            }
        }
    } else {
        // Mode non filtré : conserver le comportement existant (ordre des fichiers)
        foreach ( $all as $tpl ) {
            $tpl_context = isset( $tpl['context'] ) ? $tpl['context'] : 'all';
            if ( $context_filter && 'all' !== $context_filter ) {
                if ( 'all' !== $tpl_context && $tpl_context !== $context_filter ) {
                    continue;
                }
            }
            $tpl_steps = tour_guide_parse_template_steps( $tpl['path'] );
            if ( ! empty( $tpl_steps ) ) {
                $tours[] = array(
                    'id'     => $tpl['id'],
                    'xml_id' => isset( $tpl['attr_id'] ) ? $tpl['attr_id'] : '',
                    'page_start' => isset( $tpl['page_start'] ) ? $tpl['page_start'] : '',
                    'title'  => $tpl['title'],
                    'type'   => isset( $tpl['type'] ) ? $tpl['type'] : 'tour',
                    'steps'  => $tpl_steps,
                    'status' => 'menu', // Par défaut pour les non actifs
                );
            }
        }
    }

    return $tours;
}

// Helper pour exposer les steps au JS (backward compat)
function tour_guide_get_steps_from_templates( $active_only = true, $context_filter = 'all' ) {
    $tours = tour_guide_get_tours_by_template( $active_only, $context_filter );
    $steps = array();
    foreach ( $tours as $tour ) {
        $steps = array_merge( $steps, $tour['steps'] );
    }
    return $steps;
}

// Parse un template XML vers des steps Driver.js
function tour_guide_parse_template_steps( $filepath, $included_ids = array() ) {
    $results = array();
    $content = @file_get_contents( $filepath );
    if ( ! $content ) { return $results; }
    
    // Récupérer l'ID du template actuel pour éviter les boucles infinies
    $current_id = '';
    if ( preg_match( '/<template[^>]*id="([^"]+)"/i', $content, $m ) ) {
        $current_id = trim( $m[1] );
        // Vérifier si on a déjà inclus ce template (boucle infinie)
        if ( in_array( $current_id, $included_ids ) ) {
            return $results; // Éviter la récursion infinie
        }
        $included_ids[] = $current_id;
    }
    
    // Utiliser SimpleXML si dispo
    if ( function_exists( 'simplexml_load_string' ) ) {
        $xml = @simplexml_load_string( $content );
        if ( $xml && isset( $xml->steps ) ) {
            foreach ( $xml->steps->children() as $child ) {
                // Détecter les balises <include>
                if ( $child->getName() === 'include' ) {
                    $include_id = isset( $child['template'] ) ? trim( (string) $child['template'] ) : '';
                    if ( ! $include_id ) {
                        $include_id = isset( $child['id'] ) ? trim( (string) $child['id'] ) : '';
                    }
                    
                    if ( $include_id && ! in_array( $include_id, $included_ids ) ) {
                        // Chercher le template à inclure
                        $include_path = tour_guide_find_template_by_id( $include_id );
                        if ( $include_path ) {
                            // Récursion : parser le template inclus
                            $included_steps = tour_guide_parse_template_steps( $include_path, $included_ids );
                            $results = array_merge( $results, $included_steps );
                        }
                    }
                    continue;
                }
                
                // Traiter les balises <step> normales
                if ( $child->getName() === 'step' ) {
                    $step = $child;
                    $selector = isset( $step['selector'] ) ? (string) $step['selector'] : 'body';
                    if ( '' === trim( $selector ) ) {
                        $selector = 'body';
                    }
                    $position = isset( $step['position'] ) ? (string) $step['position'] : 'bottom';
                    $title    = isset( $step->title ) ? trim( (string) $step->title ) : '';
                    $desc     = isset( $step->description ) ? trim( (string) $step->description ) : '';
                    // Orchestration (facultatif)
                    $action   = isset( $step->action ) ? trim( (string) $step->action ) : '';
                    $action_selector = isset( $step->action_selector ) ? trim( (string) $step->action_selector ) : '';
                    $wait_for = isset( $step->wait_for ) ? trim( (string) $step->wait_for ) : '';
                    $wait_timeout = isset( $step->wait_timeout ) ? intval( (string) $step->wait_timeout ) : '';
                    $delay_ms = isset( $step->delay_ms ) ? intval( (string) $step->delay_ms ) : '';
                    $navigate_to = isset( $step->navigate_to ) ? trim( (string) $step->navigate_to ) : '';
                    $resume  = isset( $step->resume ) ? trim( (string) $step->resume ) : '';

                    $results[] = array(
                        'element' => $selector,
                        'popover' => array(
                            'title'       => $title,
                            'description' => $desc,
                            'position'    => $position,
                        ),
                        // Exposer aussi au JS
                        'orchestrate' => array(
                            'action' => $action,
                            'action_selector' => $action_selector,
                            'wait_for' => $wait_for,
                            'wait_timeout' => $wait_timeout,
                            'delay_ms' => $delay_ms,
                            'navigate_to' => $navigate_to,
                            'resume' => $resume,
                        ),
                    );
                }
            }
        }
    }
    return $results;
}

// Fonction helper pour trouver un template par son ID XML
function tour_guide_find_template_by_id( $template_id ) {
    $all = tour_guide_list_all_templates();
    foreach ( $all as $tpl ) {
        if ( isset( $tpl['attr_id'] ) && $tpl['attr_id'] === $template_id ) {
            return $tpl['path'];
        }
    }
    return false;
}

// Exposer steps au frontend via wp_localize_script
function tour_guide_localize_frontend_data() {
    $data = array(
        'tours' => tour_guide_get_tours_by_template( true, 'front' ),
    );
    wp_localize_script( 'tour-guide-frontend', 'TOUR_GUIDE_FRONT', $data );
}
add_action( 'wp_enqueue_scripts', 'tour_guide_localize_frontend_data', 20 );

// Enqueue spécifique à l’éditeur Gutenberg
function tour_guide_enqueue_block_editor_assets() {
    // Réutiliser le handle driverjs déjà enregistré
    wp_enqueue_script( 'driverjs' );
    wp_enqueue_style( 'driverjs-style' );

    // CSS spécifique pour l'éditeur (z-index élevé pour être au-dessus de Gutenberg)
    wp_enqueue_style(
        'tour-guide-editor-style',
        TOUR_GUIDE_URL . 'assets/editor.css',
        array( 'driverjs-style' ),
        TOUR_GUIDE_VERSION
    );

    wp_enqueue_script(
        'tour-guide-editor',
        TOUR_GUIDE_URL . 'assets/editor.js',
        array( 'wp-plugins', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-i18n', 'wp-data', 'driverjs' ),
        TOUR_GUIDE_VERSION,
        true
    );

    $data = array(
        'tours' => tour_guide_get_tours_by_template( true, 'editor' ),
        'i18n'  => array(
            'panelTitle' => __( 'Visites guidées', 'tour-guide' ),
            'startTour'  => __( 'Démarrer la visite', 'tour-guide' ),
        ),
    );
    wp_localize_script( 'tour-guide-editor', 'TOUR_GUIDE_EDITOR', $data );
}
add_action( 'enqueue_block_editor_assets', 'tour_guide_enqueue_block_editor_assets' );

