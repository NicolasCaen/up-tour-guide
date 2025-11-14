(function(){
  function createDriverInstance(options){
    if (typeof Driver !== 'undefined') { return new Driver(options || {}); }
    if (typeof window !== 'undefined' && window.driver && window.driver.js && typeof window.driver.js.driver === 'function') {
      try { return window.driver.js.driver(options || {}); } catch(e) { return null; }
    }
    return null;
  }

  function startFrontTour(steps){
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
    if (!driver) { return; }
    try {
      function toHtmlNode(str){
        if (typeof str !== 'string') return str;
        var div = document.createElement('div');
        div.innerHTML = str;
        return div;
      }
      if (typeof driver.setSteps === 'function'){
        var _setSteps = driver.setSteps.bind(driver);
        driver.setSteps = function(stepsArg){
          var mapped = (stepsArg||[]).map(function(s){
            var step = Object.assign({}, s);
            var pop = step.popover || { title: step.title, description: step.description, position: step.position };
            if (typeof pop.description === 'string') { pop = Object.assign({}, pop, { description: toHtmlNode(pop.description) }); }
            step.popover = pop;
            return step;
          });
          return _setSteps(mapped);
        };
      }
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
      }
    } catch(e) { /* no-op */ }
  }
  document.addEventListener('DOMContentLoaded', function(){
    var data = window.TOUR_GUIDE_FRONT || {};
    var tours = Array.isArray(data.tours) ? data.tours : [];
    
    // Lancer via query ?tour=1 ou ?tour=tour-id
    var tourParam = new URLSearchParams(window.location.search).get('tour');
    if (tourParam) {
      if (tourParam === '1' && tours.length > 0) {
        // Lancer le premier tour disponible
        startFrontTour(tours[0].steps);
      } else {
        // Chercher par ID
        var tour = tours.find(function(t){ return t.id === tourParam; });
        if (tour) { startFrontTour(tour.steps); }
      }
    }
    
    // Lier les clics sur l’Admin Bar en front
    tours.forEach(function(tour){
      var itemId = 'wp-admin-bar-tour_guide_tour_' + tour.id.replace(/[^a-z0-9_-]/gi, '');
      var anchor = document.querySelector('#' + itemId + ' > a.ab-item');
      if (anchor) {
        anchor.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          startFrontTour(tour.steps);
        });
      }
    });

    window.tourGuideStartFront = function(tourIdOrSteps){ 
      if (typeof tourIdOrSteps === 'string') {
        var tour = tours.find(function(t){ return t.id === tourIdOrSteps; });
        if (tour) { startFrontTour(tour.steps); }
      } else {
        startFrontTour(tourIdOrSteps);
      }
    };
  });
})();
