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
        var el = document.querySelector(sel);
        // Vérifier que l'élément existe ET est visible/interactif
        if (el && el.offsetParent !== null && el.offsetHeight > 0 && el.offsetWidth > 0) {
          return resolve(true);
        }
        if (Date.now() - start > t) return reject(new Error('wait_for timeout: '+sel));
        setTimeout(poll, 100);
      })();
    });
  }
  function delay(ms){ return new Promise(function(r){ setTimeout(r, ms||0); }); }
  function runOrchestrationUntilDisplay(steps, startIndex, tourId){
    var idx = (typeof startIndex === 'number' && startIndex>=0) ? startIndex : 0;
    console.log('[Tour Guide] runOrchestrationUntilDisplay called with', steps.length, 'steps, startIndex:', idx);
    function getOrch(s){ return (s && s.orchestrate) ? s.orchestrate : {}; }
    return new Promise(async function(resolve){
      console.log('[Tour Guide] Starting orchestration loop from index', idx);
      for (var i=idx;i<steps.length;i++){
        var s = steps[i];
        var o = getOrch(s);
        console.log('[Tour Guide] Step', i, '- orchestrate:', o, '- element:', s.element);
        try {
          // Si resume="none", ne pas faire le clic maintenant (sera fait par onNextClick)
          // Seulement faire le clic si resume="auto"
          var shouldClickNow = o.action === 'click' && o.resume === 'auto';
          
          var actSel = o.action_selector && o.action_selector.trim() ? o.action_selector : s.element;
          if (shouldClickNow && actSel){
            // Attendre que l'élément soit visible avant de cliquer
            try {
              await waitForSelector(actSel, 3000);
            } catch(e){
              console.warn('[Tour Guide] Element to click not found or not visible:', actSel);
            }
            var el = document.querySelector(actSel);
            if (el){
              console.log('[Tour Guide] Clicking on:', actSel, el);
              // Si navigation attendue, enregistrer la reprise puis cliquer
              if (o.navigate_to || (el.tagName==='A' && el.href)){
                setResume({ id: tourId || 'unknown', index: i+1 });
              }
              
              // Pour les boutons React/Gutenberg, déclencher les événements dans l'ordre
              try {
                // Focus sur l'élément
                el.focus();
                
                // Déclencher mousedown, puis mouseup, puis click avec des délais
                var mouseDownEvent = new MouseEvent('mousedown', { 
                  bubbles: true, 
                  cancelable: true, 
                  view: window,
                  button: 0,
                  buttons: 1
                });
                var mouseUpEvent = new MouseEvent('mouseup', { 
                  bubbles: true, 
                  cancelable: true, 
                  view: window,
                  button: 0,
                  buttons: 0
                });
                var clickEvent = new MouseEvent('click', { 
                  bubbles: true, 
                  cancelable: true, 
                  view: window,
                  button: 0,
                  detail: 1
                });
                
                el.dispatchEvent(mouseDownEvent);
                await delay(50);
                el.dispatchEvent(mouseUpEvent);
                await delay(50);
                el.dispatchEvent(clickEvent);
                
                // Clic DOM natif en dernier
                el.click();
                
                console.log('[Tour Guide] Click events dispatched');
              } catch(e){
                console.error('[Tour Guide] Error dispatching events:', e);
              }
              
              if (o.navigate_to){ window.location.assign(o.navigate_to); return resolve({ index: i+1, navigated: true }); }
              // Si clic non naviguant sans wait_for, passer à l'étape suivante
              if (!o.wait_for) { continue; }
            }
          }
          // Attendre après l'action (si wait_for est défini)
          if (o.wait_for) { await waitForSelector(o.wait_for, o.wait_timeout); }
          if (o.delay_ms) { await delay(o.delay_ms); }
          
          // Si resume="auto", continuer à l'étape suivante sans afficher Driver
          if (o.resume === 'auto') {
            console.log('[Tour Guide] Step', i, 'completed with resume=auto, continuing to next step');
            continue; // Continuer la boucle
          }
          
          // Sinon, afficher Driver sur cette étape
          console.log('[Tour Guide] Orchestration complete at step', i, '- displaying Driver.js');
          return resolve({ index: i, navigated: false });
        } catch(e){ 
          console.error('[Tour Guide] Error at step', i, ':', e);
          return resolve({ index: i, navigated: false }); 
        }
      }
      // Si tout a été consommé par des actions, rien à afficher
      console.log('[Tour Guide] All steps consumed by orchestration, no popover to display');
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
        
        // Ajouter le callback onNextClick dans chaque step.popover pour déclencher l'action
        steps.forEach(function(step, idx) {
          if (step.orchestrate && step.orchestrate.action === 'click') {
            if (!step.popover) step.popover = {};
            step.popover.onNextClick = async function() {
              console.log('[Tour Guide] onNextClick - Step', idx, step.popover.title);
              
              // Vérifier si l'élément attendu existe déjà (panneau déjà ouvert)
              var waitForSel = step.orchestrate.wait_for;
              var alreadyOpen = false;
              if (waitForSel) {
                var existingEl = document.querySelector(waitForSel);
                if (existingEl && existingEl.offsetParent !== null && existingEl.offsetHeight > 0 && existingEl.offsetWidth > 0) {
                  alreadyOpen = true;
                  console.log('[Tour Guide] Element already visible, skipping click:', waitForSel);
                }
              }
              
              // Ne cliquer que si l'élément n'est pas déjà ouvert
              if (!alreadyOpen) {
                var selector = step.orchestrate.action_selector || step.element;
                var el = document.querySelector(selector);
                if (el) {
                  console.log('[Tour Guide] Clicking on:', selector);
                  el.click();
                  try {
                    var mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 });
                    var mouseUpEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 0 });
                    var clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0, detail: 1 });
                    el.dispatchEvent(mouseDownEvent);
                    el.dispatchEvent(mouseUpEvent);
                    el.dispatchEvent(clickEvent);
                  } catch(e){
                    console.error('[Tour Guide] Error dispatching click events:', e);
                  }
                  
                  if (step.orchestrate.wait_for) {
                    console.log('[Tour Guide] Waiting for:', step.orchestrate.wait_for);
                    try {
                      await waitForSelector(step.orchestrate.wait_for, step.orchestrate.wait_timeout || 5000);
                      console.log('[Tour Guide] Element appeared:', step.orchestrate.wait_for);
                    } catch(e) {
                      console.warn('[Tour Guide] Timeout waiting for:', step.orchestrate.wait_for);
                    }
                  }
                  if (step.orchestrate.delay_ms) {
                    await delay(step.orchestrate.delay_ms);
                  }
                } else {
                  console.warn('[Tour Guide] Element not found:', selector);
                }
              }
              
              // IMPORTANT: appeler moveNext() pour passer à l'étape suivante
              console.log('[Tour Guide] Moving to next step');
              driver.moveNext();
            };
          }
        });
        
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

  // Auto-lancement si ?visite=ID dans l'URL
  (function(){
    var search = new URLSearchParams(window.location.search);
    var visiteParam = search.get('visite');
    
    if (visiteParam && tours.length > 0) {
      // Chercher le tour par xml_id
      var tourByXmlId = tours.find(function(t){
        return t.xml_id && String(t.xml_id) === String(visiteParam);
      });
      
      if (tourByXmlId) {
        // Attendre que l'éditeur soit vraiment prêt avant de lancer
        var maxAttempts = 50; // 5 secondes max
        var attempts = 0;
        var interval = setInterval(function(){
          attempts++;
          // Vérifier qu'un élément de base de Gutenberg existe
          if (document.querySelector('.editor-document-tools, .edit-post-header') || attempts >= maxAttempts) {
            clearInterval(interval);
            if (attempts < maxAttempts) {
              // Petit délai pour laisser l'interface se stabiliser
              setTimeout(function(){
                console.log('[Tour Guide Editor] Auto-lancement de la visite:', visiteParam);
                startEditorTour(tourByXmlId.steps, tourByXmlId.xml_id);
              }, 500);
            }
          }
        }, 100);
      } else {
        console.warn('[Tour Guide Editor] Visite non trouvée:', visiteParam);
      }
    }
  })();
})(window.wp || {});
