(function(){
  function createDriverInstance(options){
    if (typeof Driver !== 'undefined') { return new Driver(options || {}); }
    if (typeof window !== 'undefined' && window.driver && window.driver.js && typeof window.driver.js.driver === 'function') {
      try { return window.driver.js.driver(options || {}); } catch(e) { return null; }
    }
    return null;
  }

  // Fermer tous les sous-menus WordPress ouverts par le tour
  function closeAllTourMenus(){
    try{
      var openMenus = document.querySelectorAll('#adminmenu li.wp-has-submenu.tg-opened');
      openMenus.forEach(function(menu){
        menu.classList.remove('wp-menu-open', 'opensub', 'tg-opened');
        var submenu = menu.querySelector('.wp-submenu');
        if (submenu) submenu.style.display = '';
      });
    }catch(e){ console.warn('[TG] Erreur fermeture menus', e); }
  }

  function formatDescriptionForPreview(desc){
    if (!desc) return '';
    var lines = String(desc).split(/\r\n|\r|\n/);
    var paras = [];
    lines.forEach(function(line){
      if (!line) return;
      line = line.trim();
      if (!line) return;
      if (line.charAt(0) === '<'){
        // Ligne HTML (ex. <video>…), ne pas l’envelopper dans un <p>.
        paras.push(line);
      } else {
        // Ligne texte (éventuellement avec HTML inline comme <strong>).
        paras.push('<p>' + line + '</p>');
      }
    });
    return paras.join('\n');
  }

  function ensurePopoverCloseCross(driver){
    if (!driver) return;
    try{
      var pop = document.querySelector('.driver-popover');
      if (!pop) return;
      var container = pop.querySelector('.driver-popover-title') || pop;
      if (container.querySelector('.tg-close-cross')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tg-close-cross';
      btn.innerHTML = '\u00d7';
      btn.addEventListener('click', function(e){
        e.preventDefault();
        try{
          if (typeof driver.destroy === 'function'){
            driver.destroy();
          } else if (typeof driver.reset === 'function'){
            driver.reset();
          }
        }catch(_){}
      });
      container.appendChild(btn);
    }catch(_){}
  }

  // Ouvrir le sous-menu pour une étape spécifique
  // Utilise de préférence l'élément DOM fourni par Driver.js (argument element des hooks)
  function openMenuForStep(step, element){
    var target = null;
    try{
      // 1) Si Driver.js nous fournit déjà l'élément ciblé
      if (element && element.nodeType === 1) {
        target = element;
      } else if (step) {
        // 2) Sinon, on retombe sur les sélecteurs de l’étape (selector puis element string)
        var selector = null;
        if (typeof step.selector === 'string' && step.selector) {
          selector = step.selector;
        } else if (typeof step.element === 'string' && step.element) {
          selector = step.element;
        }
        if (!selector || selector === 'body') return;

        // Préférer la barre latérale admin (#adminmenu) pour éviter de toucher à d'autres liens
        var scoped = null;
        try {
          scoped = document.querySelector('#adminmenu ' + selector);
        } catch(_e) {
          scoped = null;
        }
        if (scoped) {
          target = scoped;
        } else {
          target = document.querySelector(selector);
        }

        if (!target) {
          console.warn('[TG] Élément non trouvé pour le sélecteur:', selector);
          return;
        }
      } else {
        return;
      }

      // Ne gérer que les éléments situés dans le menu latéral admin
      if (!target.closest('#adminmenu')) {
        return;
      }

      // Chercher le parent menu WordPress qui contient cet élément
      var parentLi = target.closest('#adminmenu li.wp-has-submenu');
      
      if (parentLi){
        console.log('[TG] Menu parent trouvé:', parentLi.id || parentLi.className);
        
        // Marquer ce menu comme ouvert par le tour
        parentLi.classList.add('wp-menu-open', 'opensub', 'tg-opened');
        
        // Forcer l'affichage du sous-menu
        var submenu = parentLi.querySelector('.wp-submenu');
        if (submenu){
          submenu.style.display = 'block';
          console.log('[TG] Sous-menu affiché pour:', selector);
        }
      }
    }catch(e){
      console.warn('[TG] Erreur ouverture menu pour', selector, e);
    }
  }

  function startTour(steps, tourId){
    console.log('[Tour Guide Admin] startTour called, tourId:', tourId, 'steps:', Array.isArray(steps)?steps.length:'?');

    var hooks = {
      onHighlightStarted: function(element, step, options){
        try {
          closeAllTourMenus();
          openMenuForStep(step || null, element || null);
          ensurePopoverCloseCross(driver);
        } catch(e){
          console.warn('[TG] Erreur onHighlightStarted:', e);
        }
      },
      onDestroyStarted: function(){
        // Quand le tour se termine, fermer tous les menus ouverts
        try {
          closeAllTourMenus();
        } catch(e){
          console.warn('[TG] Erreur onDestroyStarted:', e);
        }
      }
    };

    var driver = createDriverInstance(Object.assign({
      // Ne pas fermer le tour en cliquant en dehors de la popover
      allowClose: false,
      animate: true,
      opacity: 0.2,
      showButtons: ['previous','next','close'],
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      closeBtnText: 'Fermer',
      doneBtnText: 'Terminer'
    }, hooks));
    if (!driver) { console.warn('[Tour Guide Admin] Driver introuvable'); return; }

    try{
      if (typeof driver.setConfig==='function'){
        driver.setConfig(Object.assign({ 
          // Ne pas autoriser la fermeture en cliquant en dehors de la popover
          allowClose:false,
          showButtons:['previous','next','close'], 
          nextBtnText:'Suivant', 
          prevBtnText:'Précédent', 
          closeBtnText:'Fermer', 
          doneBtnText:'Terminer'
        }, hooks));
      }
      if (typeof driver.defineSteps==='function' && typeof driver.start==='function'){
        driver.defineSteps(steps||[]);
        driver.start();
        console.log('[TG Admin] Tour démarré (ancienne API)');
      } else if (typeof driver.setSteps==='function' && typeof driver.drive==='function'){
        driver.setSteps(steps||[]);
        driver.drive();
        console.log('[TG Admin] Tour démarré (nouvelle API)');
      } else {
        console.warn('[Tour Guide Admin] API Driver inconnue');
      }
    }catch(e){ console.error('[Tour Guide Admin] Error', e); }
  }

  // Fallback global : si Driver.js ne ferme pas correctement la popover
  // on force la fermeture de l'UI (popover + overlay) après le clic sur Fermer/Terminer
  document.addEventListener('click', function(e){
    var t = e.target;
    if (!t) return;

    var isClose = false;
    if (t.classList && (t.classList.contains('driver-popover-close-btn') || t.classList.contains('driver-close-btn'))){
      isClose = true;
    }
    if (!isClose && t.tagName === 'BUTTON'){
      var txt = (t.textContent || '').trim();
      if (txt === 'Fermer' || txt === 'Terminer'){
        isClose = true;
      }
    }
    if (!isClose) return;

    console.log('[TG] Fallback fermeture détecté sur bouton Driver.js');

    // Laisser Driver.js réagir d'abord, puis vérifier si l'UI est toujours présente
    setTimeout(function(){
      try {
        var pop = document.querySelector('.driver-popover');
        var overlay = document.querySelector('.driver-overlay');

        // Si Driver.js a déjà tout retiré, ne rien faire
        if (!pop && !overlay) return;

        console.log('[TG] Fallback fermeture appliqué (cleanup complet)');

        // Nettoyer les classes globales qui bloquent les clics
        var body = document.body;
        var html = document.documentElement;
        if (body && body.classList) {
          body.classList.remove('driver-active', 'driver-fade');
        }
        if (html && html.classList) {
          html.classList.remove('driver-active', 'driver-fade');
        }
        var actives = document.querySelectorAll('.driver-active-element');
        actives.forEach(function(el){ el.classList.remove('driver-active-element'); });

        // Retirer complètement l'overlay et la popover restantes
        if (overlay && overlay.parentNode){
          overlay.parentNode.removeChild(overlay);
        }
        if (pop && pop.parentNode){
          pop.parentNode.removeChild(pop);
        }
      } catch(_) {}
    }, 200);
  }, true);

  document.addEventListener('DOMContentLoaded', function(){
    var data = window.TOUR_GUIDE_DATA || {};
    var tours = Array.isArray(data.tours) ? data.tours : [];
    console.log('[Tour Guide Admin] Tours disponibles:', tours.length);

    // Démarrage automatique via paramètres d’URL
    try {
      var search      = new URLSearchParams(window.location.search || '');
      var tourParam   = search.get('tour');
      var visiteParam = search.get('visite');

      if (tourParam) {
        if (tourParam === '1' && tours.length > 0) {
          // Lancer le premier tour disponible
          startTour(tours[0].steps, tours[0].id);
        } else {
          // Chercher par ID interne
          var tourByInternal = tours.find(function(t){ return t.id === tourParam; });
          if (tourByInternal) {
            startTour(tourByInternal.steps, tourByInternal.id);
          }
        }
      } else if (visiteParam) {
        // Chercher par ID de template XML (xml_id)
        var tourByXmlId = tours.find(function(t){
          return t.xml_id && String(t.xml_id) === String(visiteParam);
        });
        if (tourByXmlId) {
          startTour(tourByXmlId.steps, tourByXmlId.id);
        }
      }
    } catch(e) {
      console.warn('[Tour Guide Admin] Erreur lecture paramètres URL pour démarrage auto', e);
    }

    // Menu dropdown custom
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
        dd.style.top = '0px';
        dd.style.left = '0px';
        dd.style.background = '#23282d';
        dd.style.border = '1px solid #2c3338';
        dd.style.padding = '6px 0';
        dd.style.minWidth = '220px';
        dd.style.display = 'none';
        dd.style.zIndex = '100000';
        dd.addEventListener('click', function(e){ e.stopPropagation(); }, false);
        dd.addEventListener('mousedown', function(e){ e.stopPropagation(); }, false);
        document.body.appendChild(dd);
        return dd;
      }
      function computePosition(){
        if (!mainBtn || !open) return;
        var r = mainBtn.getBoundingClientRect();
        dd.style.top = Math.round(r.bottom) + 'px';
        dd.style.left = Math.round(r.left) + 'px';
      }

      function decodeHtml(str){
        var txt = document.createElement('textarea');
        txt.innerHTML = str;
        return txt.value;
      }
      
      function renderItems(dd){
        dd.innerHTML = '';
        // Filtrer uniquement les visites avec status === 'menu'
        var menuTours = tours.filter(function(t){ return t.status === 'menu'; });
        if (!menuTours.length){
          var empty = document.createElement('div');
          empty.textContent = 'Aucune visite disponible';
          empty.style.padding = '10px 12px';
          empty.style.color = '#a7aaad';
          dd.appendChild(empty);
        } else {
          menuTours.forEach(function(t){
            var a = document.createElement('a');
            a.href = '#';
            a.style.display = 'block';
            a.style.padding = '10px 12px';
            a.style.color = '#fff';
            a.style.textDecoration = 'none';
            a.textContent = decodeHtml(t.title || '');
            a.addEventListener('mouseenter', function(){ a.style.background = '#2c3338'; });
            a.addEventListener('mouseleave', function(){ a.style.background = 'transparent'; });
            a.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); hide(); startTour(t.steps, t.id); });
            dd.appendChild(a);
          });
        }
        
        // Ajouter le lien "Gérer les templates"
        var separator = document.createElement('div');
        separator.style.borderTop = '1px solid #464b50';
        separator.style.margin = '6px 0';
        dd.appendChild(separator);
        
        var manage = document.createElement('a');
        manage.href = data.adminUrl || '/wp-admin/admin.php?page=tour-guide-templates';
        manage.style.display = 'block';
        manage.style.padding = '10px 12px';
        manage.style.color = '#72aee6';
        manage.style.textDecoration = 'none';
        manage.textContent = 'Gérer les templates';
        manage.addEventListener('mouseenter', function(){ manage.style.background = '#2c3338'; });
        manage.addEventListener('mouseleave', function(){ manage.style.background = 'transparent'; });
        dd.appendChild(manage);
      }

      var open = false;
      var dd = ensureDropdown();
      function show(){
        renderItems(dd);
        dd.style.display = 'block';
        open = true;
        computePosition();
      }
      function hide(){
        dd.style.display = 'none';
        open = false;
      }
      function toggle(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (open) { hide(); } else { show(); }
      }

      // Ouverture/fermeture uniquement au clic, plus de logique de survol qui ferme trop vite
      mainBtn.addEventListener('click', toggle, false);
      document.addEventListener('click', function(e){
        if (!open) return;
        var insideBtn = e.target && (e.target === mainBtn || mainBtn.contains(e.target));
        var insideDd = e.target && (e.target === dd || dd.contains(e.target));
        if (!insideBtn && !insideDd) hide();
      }, false);
      document.addEventListener('keydown', function(e){ if (open && e.key==='Escape'){ hide(); } }, true);
      window.addEventListener('resize', function(){ if (open){ computePosition(); } });
      window.addEventListener('scroll', function(){ if (open){ computePosition(); } }, true);
    })();

    // Gestion visibilité selon le type (popup / action / include)
    function applyTypeVisibilityForRow(tr){
      if (!tr) return;
      var typeSel = tr.querySelector('select.tg-step-type');
      if (!typeSel) return;
      
      var type = typeSel.value; // 'popup', 'action', ou 'include'
      var isInclude = type === 'include';
      var isPopup = type === 'popup';
      var isAction = type === 'action';
      
      // Colonnes communes à popup et action (toujours visibles sauf pour include)
      var commonCols = [
        tr.querySelector('.tg-sec-selector'),
        tr.querySelector('.tg-sec-title'),
        tr.querySelector('.tg-sec-desc'),
        tr.querySelector('.tg-sec-position')
      ];
      
      // Colonnes uniquement pour action
      var actionOnlyCols = [
        tr.querySelector('.tg-sec-action'),
        tr.querySelector('.tg-sec-wait'),
        tr.querySelector('.tg-sec-resume')
      ];
      
      var includeCol = tr.querySelector('.tg-sec-include');
      
      // Afficher les colonnes communes sauf si include
      commonCols.forEach(function(col){ 
        if (!col) return;
        if (isInclude) {
          col.style.setProperty('display', 'none', 'important');
        } else {
          col.style.setProperty('display', 'table-cell', 'important');
        }
      });
      
      // Afficher les colonnes d'action seulement si type=action
      actionOnlyCols.forEach(function(col){ 
        if (!col) return;
        if (isAction) {
          col.style.setProperty('display', 'table-cell', 'important');
        } else {
          col.style.setProperty('display', 'none', 'important');
        }
      });
      
      // Afficher la colonne include seulement si type=include
      if (includeCol) {
        if (isInclude) {
          includeCol.style.setProperty('display', 'table-cell', 'important');
        } else {
          includeCol.style.setProperty('display', 'none', 'important');
        }
      }
    }
    
    function applyTypeVisibilityAll(){
      var tbody = document.querySelector('#tour-guide-steps-table tbody');
      if (!tbody) return;
      Array.prototype.forEach.call(tbody.querySelectorAll('tr'), applyTypeVisibilityForRow);
    }
    
    // Gestion visibilité des champs d'action
    function applyActionVisibilityForRow(tr){
      if (!tr) return;
      var actionSel = tr.querySelector('select[name="step_action[]"]');
      var show = actionSel && actionSel.value !== 'none';
      var actionSelector = tr.querySelector('input[name="step_action_selector[]"]');
      var navigateTo = tr.querySelector('input[name="step_navigate_to[]"]');
      [actionSelector, navigateTo].forEach(function(el){ if (!el) return; el.classList.toggle('tg-hidden', !show); });
    }
    function applyActionVisibilityAll(){
      var tbody = document.querySelector('#tour-guide-steps-table tbody');
      if (!tbody) return;
      Array.prototype.forEach.call(tbody.querySelectorAll('tr'), applyActionVisibilityForRow);
    }
    applyTypeVisibilityAll();
    applyActionVisibilityAll();
    var stepsTable = document.getElementById('tour-guide-steps-table');
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

    // Edition de templates: ajout dynamique d'étapes
    var addStepBtn = document.getElementById('tour-guide-add-step');
    if (stepsTable && addStepBtn) {
      addStepBtn.addEventListener('click', function(){
        var tbody = stepsTable.querySelector('tbody');
        if (!tbody) { return; }
        var rows = tbody.querySelectorAll('tr');
        if (!rows.length) { return; }
        var lastRow = rows[rows.length - 1];
        var newRow = lastRow.cloneNode(true);
        Array.prototype.forEach.call(newRow.querySelectorAll('input, textarea'), function(el){ el.value = ''; });
        Array.prototype.forEach.call(newRow.querySelectorAll('select'), function(sel){
          if (sel.options.length) { sel.selectedIndex = 0; }
        });
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
        applyTypeVisibilityForRow(newRow);
        applyActionVisibilityForRow(newRow);
      });
    }

    // Drag & Drop
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
        console.warn('[Tour Guide Admin] jQuery UI Sortable non disponible');
      }
    })();

    (function initActivationSortable(){
      var $ = window.jQuery;
      var table = document.getElementById('tour-guide-templates-activation');
      if (!table || !$ || !$.fn || !$.fn.sortable) return;
      var tbody = table.querySelector('tbody');
      if (!tbody) return;
      var $tbody = $(tbody);
      $tbody.sortable({
        items: '> tr',
        axis: 'y',
        helper: function(e, ui){
          ui.children().each(function(){ $(this).width($(this).width()); });
          return ui;
        },
        placeholder: 'tg-sort-placeholder',
        forcePlaceholderSize: true
      });
    })();

    // Délégation pour Dupliquer/Supprimer/Tester
    document.addEventListener('click', function(e){
      var btn;
      btn = e.target.closest && e.target.closest('.tg-test');
      if (btn){
        e.preventDefault();
        var tr = btn.closest('tr');
        if (tr){
          var selector = (tr.querySelector('input[name="step_selector[]"]')||{}).value || 'body';
          var title = (tr.querySelector('input[name="step_title[]"]')||{}).value || 'Test';
          var rawDesc = (tr.querySelector('textarea[name="step_description[]"]')||{}).value || '';
          var desc = formatDescriptionForPreview(rawDesc);
          var pos = (tr.querySelector('select[name="step_position[]"]')||{}).value || 'bottom';
          
          // Fermer les menus précédents et ouvrir celui de cette étape
          closeAllTourMenus();
          openMenuForStep({ element: selector });
          
          var driver = createDriverInstance({ 
            allowClose:true, 
            animate:true, 
            opacity:0.2, 
            showButtons:['close'], 
            closeBtnText:'Fermer',
            onDestroyStarted: function() {
              // Fermer le menu quand on ferme le test
              closeAllTourMenus();
            }
          });
          if (driver && typeof driver.highlight==='function'){
            driver.highlight({ element: selector, popover: { title: title, description: desc, position: pos } });
            setTimeout(function(){ ensurePopoverCloseCross(driver); }, 0);
          }
        }
        return;
      }
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
      btn = e.target.closest && e.target.closest('.tg-dup');
      if (btn){
        e.preventDefault();
        var tr = btn.closest('tr');
        if (tr){
          var clone = tr.cloneNode(true);
          tr.parentElement.insertBefore(clone, tr.nextSibling);
          renumberRows(tr.parentElement);
          applyActionVisibilityForRow(clone);
        }
        return;
      }
    });

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
  });
})();
