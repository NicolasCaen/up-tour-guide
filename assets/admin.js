(function(){
  function createDriverInstance(options){
    if (typeof Driver !== 'undefined') { return new Driver(options || {}); }
    if (typeof window !== 'undefined' && window.driver && window.driver.js && typeof window.driver.js.driver === 'function') {
      try { return window.driver.js.driver(options || {}); } catch(e) { return null; }
    }
    return null;
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
    
    try{
      if (typeof driver.setConfig==='function'){
        driver.setConfig({ showButtons:['previous','next','close'], nextBtnText:'Suivant', prevBtnText:'Précédent', closeBtnText:'Fermer', doneBtnText:'Terminer' });
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

  document.addEventListener('DOMContentLoaded', function(){
    var data = window.TOUR_GUIDE_DATA || {};
    var tours = Array.isArray(data.tours) ? data.tours : [];
    console.log('[Tour Guide Admin] Tours disponibles:', tours.length);

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
        if (!tours.length){
          var empty = document.createElement('div');
          empty.textContent = 'Aucune visite disponible';
          empty.style.padding = '10px 12px';
          empty.style.color = '#a7aaad';
          dd.appendChild(empty);
        } else {
          tours.forEach(function(t){
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
      var overBtn = false;
      var overDd = false;
      var closeT = null;
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
      function scheduleClose(){
        if (closeT) { clearTimeout(closeT); closeT = null; }
        closeT = setTimeout(function(){
          if (!overBtn && !overDd && open) hide();
        }, 200);
      }
      function toggle(ev){ ev.preventDefault(); ev.stopPropagation(); open ? hide() : show(); }

      mainBtn.addEventListener('click', toggle, false);
      mainBtn.addEventListener('mouseenter', function(){ overBtn = true; if (open) { if (closeT){ clearTimeout(closeT); closeT=null; } } }, false);
      mainBtn.addEventListener('mouseleave', function(){ overBtn = false; if (open) scheduleClose(); }, false);
      dd.addEventListener('mouseenter', function(){ overDd = true; if (closeT){ clearTimeout(closeT); closeT=null; } }, false);
      dd.addEventListener('mouseleave', function(){ overDd = false; scheduleClose(); }, false);
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
    applyActionVisibilityAll();
    var stepsTable = document.getElementById('tour-guide-steps-table');
    stepsTable && stepsTable.addEventListener('change', function(e){
      if (e.target && e.target.name === 'step_action[]'){
        var tr = e.target.closest('tr');
        applyActionVisibilityForRow(tr);
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
          var desc = (tr.querySelector('textarea[name="step_description[]"]')||{}).value || '';
          var pos = (tr.querySelector('select[name="step_position[]"]')||{}).value || 'bottom';
          var driver = createDriverInstance({ allowClose:true, animate:true, opacity:0.2, showButtons:['close'], closeBtnText:'Fermer' });
          if (driver && typeof driver.highlight==='function'){
            driver.highlight({ element: selector, popover: { title: title, description: desc, position: pos } });
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
