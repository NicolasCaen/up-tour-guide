(function(){
  if (typeof Driver === 'undefined') { return; }
  function startTour(steps){
    try {
      var driver = new Driver({ allowClose: true, animate: true, opacity: 0.2 });
      driver.defineSteps(steps || []);
      driver.start();
    } catch(e) { /* no-op */ }
  }
  document.addEventListener('DOMContentLoaded', function(){
    var data = window.TOUR_GUIDE_DATA || {};
    var tours = Array.isArray(data.tours) ? data.tours : [];
    
    // DEBUG: afficher ce qui est chargé
    console.log('[Tour Guide] Driver.js loaded:', typeof Driver !== 'undefined');
    console.log('[Tour Guide] Tours disponibles:', tours.length);
    console.log('[Tour Guide] Data complète:', data);
    
    // Pour chaque tour, lier le clic sur le menu admin bar
    tours.forEach(function(tour){
      var menuItem = document.querySelector('.tour-guide-start-tour[data-tour-id="' + tour.id + '"]');
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
