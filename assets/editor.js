(function(wp){
  if (!wp || !wp.plugins || !wp.element || !wp.components || (!wp.editPost && !wp.editor)) {
    return;
  }

  var el = wp.element.createElement;
  var PluginSidebar = (wp.editor && wp.editor.PluginSidebar) || (wp.editPost && wp.editPost.PluginSidebar);
  var PluginSidebarMoreMenuItem = (wp.editor && wp.editor.PluginSidebarMoreMenuItem) || (wp.editPost && wp.editPost.PluginSidebarMoreMenuItem);
  var PanelBody = wp.components.PanelBody;
  var Button = wp.components.Button;
  var __ = wp.i18n.__;

  // Résoudre la bonne API Driver.js (ancienne globale Driver ou nouveau namespace driver.js.driver)
  function createDriverInstance(options) {
    if (typeof Driver !== 'undefined') {
      return new Driver(options || {});
    }
    if (typeof window !== 'undefined' && window.driver && window.driver.js && typeof window.driver.js.driver === 'function') {
      try {
        return window.driver.js.driver(options || {});
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function startEditorTour(steps){
    var driver = createDriverInstance({ 
      allowClose: true, 
      animate: true, 
      opacity: 0.2,
      showButtons: ['previous','next','close'],
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      closeBtnText: 'Fermer',
      doneBtnText: 'Terminer'
    });
    console.log('[Tour Guide Editor] startEditorTour called, driver instance:', driver);
    if (!driver) { console.warn('[Tour Guide Editor] Aucun driver disponible'); return; }
    try {
      console.log('[Tour Guide Editor] Defining steps:', steps);
      // Appliquer config FR si API moderne
      if (typeof driver.setConfig === 'function') {
        try { driver.setConfig({
          showButtons: ['previous','next','close'],
          nextBtnText: 'Suivant',
          prevBtnText: 'Précédent',
          closeBtnText: 'Fermer',
          doneBtnText: 'Terminer'
        }); } catch(_) {}
      }
      if (typeof driver.defineSteps === 'function' && typeof driver.start === 'function') {
        // Ancienne API Driver.js v1
        driver.defineSteps(steps || []);
        driver.start();
        console.log('[Tour Guide Editor] Tour démarré (ancienne API defineSteps/start)');
      } else if (typeof driver.setSteps === 'function' && typeof driver.drive === 'function') {
        // Nouvelle API Driver.js moderne
        driver.setSteps(steps || []);
        driver.drive();
        console.log('[Tour Guide Editor] Tour démarré (nouvelle API setSteps/drive)');
      } else {
        console.warn('[Tour Guide Editor] API Driver inconnue, aucune méthode de démarrage trouvée');
      }
    } catch(e) { 
      console.error('[Tour Guide Editor] Erreur pendant le démarrage de la visite:', e);
    }
  }

  var tours = (window.TOUR_GUIDE_EDITOR && Array.isArray(window.TOUR_GUIDE_EDITOR.tours)) ? window.TOUR_GUIDE_EDITOR.tours : [];
  var labels = (window.TOUR_GUIDE_EDITOR && window.TOUR_GUIDE_EDITOR.i18n) ? window.TOUR_GUIDE_EDITOR.i18n : { panelTitle: 'Visites guidées', startTour: 'Démarrer la visite' };

  // DEBUG
  var hasLegacyDriver = (typeof Driver !== 'undefined');
  var hasNamespaceDriver = !!(typeof window !== 'undefined' && window.driver && window.driver.js && typeof window.driver.js.driver === 'function');
  console.log('[Tour Guide Editor] Legacy Driver global:', hasLegacyDriver);
  console.log('[Tour Guide Editor] Namespace driver.js.driver:', hasNamespaceDriver);
  console.log('[Tour Guide Editor] Tours disponibles:', tours.length);
  console.log('[Tour Guide Editor] Data complète:', window.TOUR_GUIDE_EDITOR);

  var Sidebar = function(){
    var buttons = tours.map(function(tour){
      return el(Button, {
        key: tour.id,
        isPrimary: true,
        onClick: function(){ startEditorTour(tour.steps); },
        style: { marginBottom: '8px', display: 'block', width: '100%' }
      }, tour.title);
    });

    var content = tours.length > 0 
      ? buttons
      : el('p', null, __('Aucune visite disponible. Activez des templates dans les réglages.', 'tour-guide'));

    return el(PluginSidebar, { name: 'tour-guide-sidebar', title: labels.panelTitle },
      el(PanelBody, { title: labels.panelTitle, initialOpen: true }, content)
    );
  };

  var SidebarItem = function(){
    return el(PluginSidebarMoreMenuItem, { target: 'tour-guide-sidebar' }, labels.panelTitle);
  };

  wp.plugins.registerPlugin('tour-guide', {
    render: function(){
      return el(wp.element.Fragment, null, el(SidebarItem), el(Sidebar));
    }
  });

  // Expose to console for quick testing
  window.tourGuideStartEditor = function(custom){ startEditorTour(custom || []); };
})(window.wp || {});
