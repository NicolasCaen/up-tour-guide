(function(){
  if (typeof Driver === 'undefined') { return; }
  function startFrontTour(steps){
    try {
      var driver = new Driver({ allowClose: true, animate: true, opacity: 0.2 });
      driver.defineSteps(steps || []);
      driver.start();
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
