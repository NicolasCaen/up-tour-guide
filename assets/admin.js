(function(){
  function createDriverInstance(options){
    if (typeof Driver !== 'undefined') { return new Driver(options || {}); }
    if (typeof window !== 'undefined' && window.driver && window.driver.js && typeof window.driver.js.driver === 'function') {
      try { return window.driver.js.driver(options || {}); } catch(e) { return null; }
    }
    return null;
  }

  function startTour(steps){
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
    try {
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
        driver.defineSteps(steps || []);
        driver.start();
      } else if (typeof driver.setSteps === 'function' && typeof driver.drive === 'function') {
        driver.setSteps(steps || []);
        driver.drive();
      } else {
        console.warn('[Tour Guide Admin] API Driver inconnue');
      }
    } catch(e) { console.error('[Tour Guide Admin] Erreur démarrage visite', e); }
  }
  document.addEventListener('DOMContentLoaded', function(){
    var data = window.TOUR_GUIDE_DATA || {};
    var tours = Array.isArray(data.tours) ? data.tours : [];

    // DEBUG
    console.log('[Tour Guide Admin] Tours disponibles:', tours.length);

    // Lier les clics via l'id généré par l'admin bar: #wp-admin-bar-tour_guide_tour_<id>
    tours.forEach(function(tour){
      var itemId = 'wp-admin-bar-tour_guide_tour_' + tour.id.replace(/[^a-z0-9_-]/gi, '');
      var menuItem = document.getElementById(itemId);
      if (!menuItem) {
        // Fallback: chercher par préfixe et texte
        var candidates = document.querySelectorAll('[id^="wp-admin-bar-tour_guide_tour_"]');
        candidates.forEach(function(el){
          if (!menuItem && el.textContent && el.textContent.trim() === tour.title) { menuItem = el; }
        });
      }
      if (menuItem) {
        menuItem.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          startTour(tour.steps);
        });
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
        // Numéro d’étape
        var firstCell = newRow.querySelector('td');
        if (firstCell) { firstCell.textContent = rows.length + 1; }
        tbody.appendChild(newRow);
      });
    }

    // Optional: expose in console
    window.tourGuideStart = function(tourIdOrSteps){ 
      if (typeof tourIdOrSteps === 'string') {
        var tour = tours.find(function(t){ return t.id === tourIdOrSteps; });
        if (tour) { startTour(tour.steps); }
      } else {
        startTour(tourIdOrSteps);
      }
    };
  });
})();
