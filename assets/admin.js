(function(){
  function createDriverInstance(options){
    if (typeof Driver !== 'undefined') { return new Driver(options || {}); }
    if (typeof window !== 'undefined' && window.driver && window.driver.js && typeof window.driver.js.driver === 'function') {
      try { return window.driver.js.driver(options || {}); } catch(e) { return null; }
    }
    return null;
  }

  // Orchestrateur commun
  function getResume(){ try { return JSON.parse(sessionStorage.getItem('TG_RESUME')||'null'); } catch(e){ return null; } }
  function setResume(v){ try { if(v){ sessionStorage.setItem('TG_RESUME', JSON.stringify(v)); } else { sessionStorage.removeItem('TG_RESUME'); } } catch(e){} }
  function waitForSelector(sel, timeout){
    if (!sel) return Promise.resolve(true);
    var t = typeof timeout==='number'?timeout:4000, start=Date.now();
    return new Promise(function(resolve,reject){ (function poll(){
      if (document.querySelector(sel)) return resolve(true);
      if (Date.now()-start>t) return reject(new Error('wait_for timeout: '+sel));
      setTimeout(poll,100);
    })(); });
  }
  function delay(ms){ return new Promise(function(r){ setTimeout(r, ms||0); }); }
  function runOrchestrationUntilDisplay(steps, startIndex, tourId){
    var idx = (typeof startIndex==='number'&&startIndex>=0)?startIndex:0;
    function getOrch(s){ return (s && s.orchestrate) ? s.orchestrate : {}; }
    return new Promise(async function(resolve){
      for (var i=idx;i<steps.length;i++){
        var s=steps[i], o=getOrch(s);
        try{
          var actSel = o.action_selector && o.action_selector.trim()? o.action_selector : s.element;
          if (o.action==='click' && actSel){
            var el=document.querySelector(actSel);
            if (el){
              if (o.navigate_to || (el.tagName==='A' && el.href)){
                setResume({ id: tourId||'unknown', index: i+1 });
              }
              el.click();
              // Après clic, attendre éventuellement que la cible apparaisse
              if (o.wait_for) { try { await waitForSelector(o.wait_for, o.wait_timeout); } catch(_){} }
              if (o.navigate_to){ window.location.assign(o.navigate_to); return resolve({index:i+1,navigated:true}); }
              if (o.delay_ms) { await delay(o.delay_ms); }
              continue;
            } else {
              // Élément introuvable: ne pas attendre, afficher la popover à cette étape
              return resolve({index:i,navigated:false});
            }
          }
          // Pas d'action: éventuellement attendre avant d'afficher la popover
          if (o.wait_for) { await waitForSelector(o.wait_for, o.wait_timeout); }
          if (o.delay_ms) { await delay(o.delay_ms); }
          return resolve({index:i,navigated:false});
        }catch(e){ return resolve({index:i,navigated:false}); }
      }
      resolve({index:steps.length,navigated:false});
    });

    // (binding collapse déplacé plus bas, après définition de stepsTable)

    // MENU CUSTOM anti-fermeture (toggle sur le bouton principal)
    (function(){
      var mainBtn = document.querySelector('#wp-admin-bar-tour_guide_adminbar > a.ab-item');
      if (!mainBtn) return;

      var dropdownId = 'tour-guide-dropdown';
      function ensureDropdown(){
        var dd = document.getElementById(dropdownId);
        if (dd) return dd;
        dd = document.createElement('div');
        dd.id = dropdownId;
        dd.style.position = 'fixed';
        dd.style.top = (window.innerWidth <= 782 ? '46px' : '32px'); // hauteur admin-bar
        dd.style.right = '16px';
        dd.style.background = '#1d2327';
        dd.style.color = '#fff';
        dd.style.border = '1px solid #2c3338';
        dd.style.borderRadius = '4px';
        dd.style.boxShadow = '0 4px 16px rgba(0,0,0,.2)';
        dd.style.zIndex = '100000';
        dd.style.minWidth = '220px';
        dd.style.display = 'none';
        dd.setAttribute('role','menu');
        document.body.appendChild(dd);
        return dd;
      }

      function renderItems(dd){
        dd.innerHTML = '';
        if (!tours.length){
          var empty = document.createElement('div');
          empty.textContent = 'Aucune visite disponible';
          empty.style.padding = '10px 12px';
          dd.appendChild(empty);
          return;
        }
        tours.forEach(function(t){
          var a = document.createElement('a');
          a.href = '#';
          a.textContent = t.title;
          a.style.display = 'block';
          a.style.padding = '10px 12px';
          a.style.color = '#fff';
          a.style.textDecoration = 'none';
          a.addEventListener('mouseenter', function(){ a.style.background = '#2c3338'; });
          a.addEventListener('mouseleave', function(){ a.style.background = 'transparent'; });
          a.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); hide(); startTour(t.steps, t.id); });
          dd.appendChild(a);
        });
      }

      var open = false;
      var dd = ensureDropdown();
      function show(){ renderItems(dd); dd.style.display = 'block'; open = true; }
      function hide(){ dd.style.display = 'none'; open = false; }
      function toggle(ev){ ev.preventDefault(); ev.stopPropagation(); open ? hide() : show(); }

      mainBtn.addEventListener('click', toggle, true);
      document.addEventListener('click', function(){ if (open) hide(); }, true);
      document.addEventListener('keydown', function(e){ if (open && e.key==='Escape'){ hide(); } }, true);
      window.addEventListener('resize', function(){ if (open){ dd.style.top = (window.innerWidth <= 782 ? '46px' : '32px'); } });
    })();

    // Gestion visibilité des champs d'action
    function applyActionVisibilityForRow(tr){
      if (!tr) return;
      var actionSel = tr.querySelector('select[name="step_action[]"]');
      var show = actionSel && actionSel.value !== 'none';
      // Champs concernés dans la même ligne
      var actionSelector = tr.querySelector('input[name="step_action_selector[]"]');
      var navigateTo = tr.querySelector('input[name="step_navigate_to[]"]');
      // On masque seulement ces champs spécifiques d'action
      [actionSelector, navigateTo].forEach(function(el){ if (!el) return; el.classList.toggle('tg-hidden', !show); });
    }
    function applyActionVisibilityAll(){
      var tbody = document.querySelector('#tour-guide-steps-table tbody');
      if (!tbody) return;
      Array.prototype.forEach.call(tbody.querySelectorAll('tr'), applyActionVisibilityForRow);
    }
    applyActionVisibilityAll();
    // Collapse/Expand désactivé temporairement
    stepsTable && stepsTable.addEventListener('change', function(e){
      if (e.target && e.target.name === 'step_action[]'){
        var tr = e.target.closest('tr');
        applyActionVisibilityForRow(tr);
      }
    });
  }

  function startTour(steps, tourId){
    console.log('[Tour Guide Admin] startTour called, tourId:', tourId, 'steps:', Array.isArray(steps)?steps.length:'?');
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
    if (!driver) { console.warn('[Tour Guide Admin] Driver introuvable'); return; }
    (async function(){
      try{
        var resume=getResume();
        var startIdx = resume && (!tourId || resume.id===tourId) ? (resume.index||0) : 0;
        setResume(null);
        var res = await runOrchestrationUntilDisplay(steps, startIdx, tourId);
        if (res && res.navigated) { console.log('[Tour Guide Admin] Navigated during orchestration'); return; }
        var indexToStart = Math.min(res.index||0, steps.length-1);
        if (typeof driver.setConfig==='function'){
          try{ driver.setConfig({ showButtons:['previous','next','close'], nextBtnText:'Suivant', prevBtnText:'Précédent', closeBtnText:'Fermer', doneBtnText:'Terminer' }); }catch(_){ }
        }
        if (typeof driver.defineSteps==='function' && typeof driver.start==='function'){
          driver.defineSteps(steps||[]);
          driver.start(indexToStart);
          setTimeout(function(){ try { console.log('[TG Admin] isActive(legacy):', driver.isActive && driver.isActive()); } catch(_){} }, 50);
        } else if (typeof driver.setSteps==='function' && typeof driver.drive==='function'){
          driver.setSteps(steps||[]);
          driver.drive({ stepIndex: indexToStart });
          setTimeout(function(){
            try {
              var active = driver.isActive && driver.isActive();
              console.log('[TG Admin] isActive(modern):', active);
              if (!active && typeof driver.highlight==='function'){
                console.log('[TG Admin] Fallback highlight on first step');
                driver.highlight(steps[indexToStart]);
              }
            } catch(_){}
          }, 80);
        } else {
          console.warn('[Tour Guide Admin] API Driver inconnue');
        }
      }catch(e){ console.error('[Tour Guide Admin] Orchestrator error', e); }
    })();
  }
  document.addEventListener('DOMContentLoaded', function(){
    var data = window.TOUR_GUIDE_DATA || {};
    var tours = Array.isArray(data.tours) ? data.tours : [];

    // DEBUG
    console.log('[Tour Guide Admin] Tours disponibles:', tours.length);

    // Lier les clics via l'id généré par l'admin bar: #wp-admin-bar-tour_guide_tour_<id>
    tours.forEach(function(tour){
      var itemId = 'wp-admin-bar-tour_guide_tour_' + tour.id.replace(/[^a-z0-9_-]/gi, '');
      var anchor = document.querySelector('#' + itemId + ' > a.ab-item');
      if (!anchor) {
        // Fallback: chercher par texte
        var candidates = document.querySelectorAll('#wp-admin-bar-tour_guide_adminbar .ab-submenu a.ab-item');
        candidates.forEach(function(a){
          if (!anchor && a.textContent && a.textContent.trim() === tour.title) { anchor = a; }
        });
      }
      if (anchor) {
        var handler = function(e){ e.preventDefault(); e.stopPropagation(); startTour(tour.steps, tour.id); };
        var downHandler = function(e){ e.preventDefault(); e.stopPropagation(); };
        // Intercepter mousedown pour éviter la fermeture du sous-menu
        anchor.addEventListener('mousedown', downHandler, true);
        anchor.addEventListener('click', handler, true);
      }
    });

    // Edition de templates: ajout dynamique d’étapes
    var stepsTable = document.getElementById('tour-guide-steps-table');
    var addStepBtn = document.getElementById('tour-guide-add-step');
    if (stepsTable && addStepBtn) {
      addStepBtn.addEventListener('click', function(){
        var tbody = stepsTable.querySelector('tbody');
        if (!tbody) { return; }
        var rows = tbody.querySelectorAll('tr');
        if (!rows.length) { return; }
        var lastRow = rows[rows.length - 1];
        var newRow = lastRow.cloneNode(true);
        // Nettoyer les valeurs
        Array.prototype.forEach.call(newRow.querySelectorAll('input, textarea'), function(el){ el.value = ''; });
        Array.prototype.forEach.call(newRow.querySelectorAll('select'), function(sel){
          if (sel.options.length) { sel.selectedIndex = 0; }
        });
        // Poignée dans la première cellule
        var firstCell = newRow.querySelector('td');
        if (firstCell) {
          var existingHandle = firstCell.querySelector('.tg-handle');
          if (!existingHandle){
            var handle = document.createElement('span');
            handle.className = 'tg-handle';
            handle.title = 'Glisser pour réordonner';
            firstCell.prepend(handle);
          }
        }
        newRow.classList.add('tg-card');
        tbody.appendChild(newRow);
        renumberRows(tbody);
        applyActionVisibilityForRow(newRow);
      });
    }

    // Drag & Drop (jQuery UI Sortable si disponible)
    function addRowControls(tr){
      if (!tr) return;
      var toolsTd = tr.querySelector('td.tg-sec-resume') || tr.querySelector('td');
      if (!toolsTd) return;
      var controls = toolsTd.querySelector('.tg-row-actions');
      if (!controls){
        controls = document.createElement('div');
        controls.className = 'tg-row-actions';
        var btnTest = document.createElement('button');
        btnTest.type = 'button';
        btnTest.className = 'button button-secondary tg-test';
        btnTest.textContent = 'Tester';
        var btnDup = document.createElement('button');
        btnDup.type = 'button';
        btnDup.className = 'button button-secondary tg-dup';
        btnDup.textContent = 'Dupliquer';
        var btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'button button-link-delete tg-del';
        btnDel.textContent = 'Supprimer';
        controls.appendChild(btnTest);
        controls.appendChild(btnDup);
        controls.appendChild(btnDel);
        toolsTd.appendChild(controls);
      }
    }

    function renumberRows(tbody){
      var trs = tbody.querySelectorAll('tr');
      trs.forEach(function(tr, i){
        tr.classList.add('tg-card');
        var td = tr.querySelector('td.tg-sec-number') || tr.querySelector('td');
        if (!td) return;
        // s’assurer de la poignée
        var handle = td.querySelector('.tg-handle');
        if (!handle){
          handle = document.createElement('span');
          handle.className = 'tg-handle';
          handle.title = 'Glisser pour réordonner';
          td.prepend(handle);
        }
        addRowControls(tr);
      });
    }
    (function initSortable(){
      var $ = window.jQuery;
      var tbody = document.querySelector('#tour-guide-steps-table tbody');
      if (!tbody) return;
      // Ajouter poignées initiales
      renumberRows(tbody);
      if ($ && $.fn && $.fn.sortable){
        var $tbody = $(tbody);
        $tbody.sortable({
          handle: '.tg-handle',
          items: '> tr',
          axis: 'y',
          helper: function(e, ui){
            ui.children().each(function(){ $(this).width($(this).width()); });
            return ui;
          },
          placeholder: 'tg-sort-placeholder',
          forcePlaceholderSize: true,
          stop: function(){ renumberRows(tbody); }
        });
      } else {
        // Fallback minimal: pas de lib dispo, laisser tel quel
        console.warn('[Tour Guide Admin] jQuery UI Sortable non disponible');
      }
    })();

    // Délégation pour Dupliquer/Supprimer
    document.addEventListener('click', function(e){
      var btn;
      // Tester
      btn = e.target.closest && e.target.closest('.tg-test');
      if (btn){
        e.preventDefault();
        var tr = btn.closest('tr');
        if (tr){
          var selector = (tr.querySelector('input[name="step_selector[]"]')||{}).value || 'body';
          var title = (tr.querySelector('input[name="step_title[]"]')||{}).value || 'Test';
          var desc = (tr.querySelector('textarea[name="step_description[]"]')||{}).value || '';
          var pos = (tr.querySelector('select[name="step_position[]"]')||{}).value || 'bottom';
          var driver = createDriverInstance({ allowClose:true, animate:true, opacity:0.2, showButtons:['close'], closeBtnText:'Fermer' });
          if (driver && typeof driver.highlight==='function'){
            driver.highlight({ element: selector, popover: { title: title, description: desc, position: pos } });
          }
        }
        return;
      }
      // Supprimer
      btn = e.target.closest && e.target.closest('.tg-del');
      if (btn){
        e.preventDefault();
        var tr = btn.closest('tr');
        if (tr){
          var tbody = tr.parentElement;
          tr.remove();
          renumberRows(tbody);
        }
        return;
      }
      // Dupliquer
      btn = e.target.closest && e.target.closest('.tg-dup');
      if (btn){
        e.preventDefault();
        var tr = btn.closest('tr');
        if (tr){
          var clone = tr.cloneNode(true);
          // Nettoyer valeurs des inputs texte/textarea ? ici on conserve la config en cas de duplication
          tr.parentElement.insertBefore(clone, tr.nextSibling);
          renumberRows(tr.parentElement);
          applyActionVisibilityForRow(clone);
        }
        return;
      }
    });

    // Optional: expose in console
    window.tourGuideStart = function(tourIdOrSteps){ 
      if (typeof tourIdOrSteps === 'string') {
        var tour = tours.find(function(t){ return t.id === tourIdOrSteps; });
        if (tour) { startTour(tour.steps, tour.id); } else { console.warn('[Tour Guide Admin] Tour introuvable pour id:', tourIdOrSteps); }
      } else if (Array.isArray(tourIdOrSteps)) {
        startTour(tourIdOrSteps, null);
      } else {
        console.warn('[Tour Guide Admin] Paramètre inattendu pour tourGuideStart');
      }
    };
    window.tourGuideStartIndex = function(tourId, idx){
      var tour = tours.find(function(t){ return t.id === tourId; });
      if (!tour) { console.warn('[Tour Guide Admin] Tour introuvable pour id:', tourId); return; }
      // Simuler une reprise pour tester un index
      setResume({ id: tourId, index: idx||0 });
      startTour(tour.steps, tourId);
    };
  });
})();
