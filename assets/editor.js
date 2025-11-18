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
  var useDispatch = wp.data.useDispatch;
  var useSelect = wp.data.useSelect;

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

  // Helpers orchestration
  function getResume(){
    try { return JSON.parse(sessionStorage.getItem('TG_RESUME') || 'null'); } catch(e){ return null; }
  }
  function setResume(val){
    try { if (val){ sessionStorage.setItem('TG_RESUME', JSON.stringify(val)); } else { sessionStorage.removeItem('TG_RESUME'); } } catch(e){}
  }
  function waitForSelector(sel, timeout){
    if (!sel) return Promise.resolve(true);
    var t = typeof timeout === 'number' ? timeout : 10000;
    var start = Date.now();
    return new Promise(function(resolve, reject){
      (function poll(){
        if (document.querySelector(sel)) return resolve(true);
        if (Date.now() - start > t) return reject(new Error('wait_for timeout: '+sel));
        setTimeout(poll, 100);
      })();
    });
  }
  function delay(ms){ return new Promise(function(r){ setTimeout(r, ms||0); }); }
  function runOrchestrationUntilDisplay(steps, startIndex, tourId){
    var idx = (typeof startIndex === 'number' && startIndex>=0) ? startIndex : 0;
    function getOrch(s){ return (s && s.orchestrate) ? s.orchestrate : {}; }
    return new Promise(async function(resolve){
      for (var i=idx;i<steps.length;i++){
        var s = steps[i];
        var o = getOrch(s);
        try {
          // Gérer l'action de clic d'abord
          var actSel = o.action_selector && o.action_selector.trim() ? o.action_selector : s.element;
          if (o.action === 'click' && actSel){
            var el = document.querySelector(actSel);
            if (el){
              // Si navigation attendue, enregistrer la reprise puis cliquer
              if (o.navigate_to || (el.tagName==='A' && el.href)){
                setResume({ id: tourId || 'unknown', index: i+1 });
              }
              el.click();
              if (o.navigate_to){ window.location.assign(o.navigate_to); return resolve({ index: i+1, navigated: true }); }
              // Si clic non naviguant sans wait_for, passer à l'étape suivante
              if (!o.wait_for) { continue; }
            }
          }
          // Attendre après l'action (si wait_for est défini)
          if (o.wait_for) { await waitForSelector(o.wait_for, o.wait_timeout); }
          if (o.delay_ms) { await delay(o.delay_ms); }
          // Afficher Driver sur cette étape
          return resolve({ index: i, navigated: false });
        } catch(e){ 
          return resolve({ index: i, navigated: false }); 
        }
      }
      // Si tout a été consommé par des actions, rien à afficher
      resolve({ index: steps.length, navigated: false });
    });
  }

  function startEditorTour(steps, tourId){
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
    // NE PAS transformer les descriptions en HTML nodes - garder les strings
    (async function(){
      try {
        var resume = getResume();
        var startIdx = resume && (!tourId || resume.id===tourId) ? (resume.index||0) : 0;
        setResume(null);
        var res = await runOrchestrationUntilDisplay(steps, startIdx, tourId);
        if (res.navigated) { return; }
        var indexToStart = Math.min(res.index||0, steps.length-1);
        console.log('[Tour Guide Editor] Defining steps from index', indexToStart, steps);
        if (typeof driver.setConfig === 'function') {
          try { driver.setConfig({
            showButtons: ['previous','next','close'],
            nextBtnText: 'Suivant', prevBtnText: 'Précédent', closeBtnText: 'Fermer', doneBtnText: 'Terminer'
          }); } catch(_) {}
        }
        if (typeof driver.defineSteps === 'function' && typeof driver.start === 'function') {
          driver.defineSteps(steps || []);
          driver.start(indexToStart);
          console.log('[Tour Guide Editor] Tour démarré (ancienne API)');
        } else if (typeof driver.setSteps === 'function' && typeof driver.drive === 'function') {
          driver.setSteps(steps || []);
          // Utiliser drive() sans options si indexToStart est 0
          if (indexToStart === 0) {
            driver.drive();
          } else {
            driver.drive(indexToStart);
          }
          console.log('[Tour Guide Editor] Tour démarré (nouvelle API)');
        } else {
          console.warn('[Tour Guide Editor] API Driver inconnue');
        }
      } catch(e){ console.error('[Tour Guide Editor] Orchestration error:', e); }
    })();
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
        onClick: function(){ startEditorTour(tour.steps, tour.id); },
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
    },
    icon: el('svg', { 
      xmlns: 'http://www.w3.org/2000/svg', 
      viewBox: '0 0 24 24', 
      width: 24, 
      height: 24 
    }, el('path', { 
      d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z' 
    }))
  });

  // Injecter un bouton dans la toolbar
  (function injectToolbarButton(){
    if (!wp.data || !wp.data.dispatch || !wp.data.select) return;
    
    var retryCount = 0;
    var maxRetries = 50;
    
    function tryInject(){
      var pinnedItems = document.querySelector('.interface-pinned-items');
      if (!pinnedItems) {
        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(tryInject, 100);
        }
        return;
      }
      
      // Vérifier si le bouton existe déjà
      if (document.getElementById('tour-guide-toolbar-btn')) return;
      
      var btn = document.createElement('button');
      btn.id = 'tour-guide-toolbar-btn';
      btn.type = 'button';
      btn.className = 'components-button is-compact has-icon';
      btn.setAttribute('aria-label', labels.panelTitle);
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path></svg>';
      
      btn.addEventListener('click', function(){
        try {
          var dispatch = wp.data.dispatch('core/edit-post');
          if (dispatch && dispatch.openGeneralSidebar) {
            dispatch.openGeneralSidebar('tour-guide/tour-guide-sidebar');
          }
        } catch(e){
          console.error('[Tour Guide] Erreur ouverture sidebar:', e);
        }
      });
      
      // Insérer le bouton au début de .interface-pinned-items
      pinnedItems.insertBefore(btn, pinnedItems.firstChild);
      
      // Surveiller l'état ouvert/fermé pour le style pressed
      if (wp.data.subscribe) {
        wp.data.subscribe(function(){
          try {
            var select = wp.data.select('core/edit-post');
            if (select && select.getActiveGeneralSidebarName) {
              var isOpen = select.getActiveGeneralSidebarName() === 'tour-guide/tour-guide-sidebar';
              if (isOpen) {
                btn.setAttribute('aria-pressed', 'true');
                btn.classList.add('is-pressed');
              } else {
                btn.setAttribute('aria-pressed', 'false');
                btn.classList.remove('is-pressed');
              }
            }
          } catch(e){}
        });
      }
    }
    
    // Attendre que l'éditeur soit chargé
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryInject);
    } else {
      tryInject();
    }
  })();

  // Expose to console for quick testing
  window.tourGuideStartEditor = function(custom){ startEditorTour(custom || []); };
})(window.wp || {});
