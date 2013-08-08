var collections = require('collections');
var sockets = require('sockets');
var $ = require('jquery');
var Model = require('backbone').Model;
var dom = require('dom');

// Remove touch lag.
var attachFastClick = require('fastclick');
attachFastClick(document.body);


var Session = require('session');

///////////////////////////
// Handle Drawer Display //
///////////////////////////

// xxx tie drawer state to session variables.

(function(){

  var drawer = require('drawer');
  drawer.enterNavigation();

  $('#toggle-drawer').on('click', function(e){
    e.preventDefault();
    drawer.toggle();
    return false;
  });

})();


////////////////////////////
// Handle Primary Display //
////////////////////////////

(function(){

  var Library = require('library');
  var Sources = require('sources');

  var currentMain;

  function renderMain(obj){
    if (Session.get('selected_movie')){
      Session.unset('selected_movie');
      Session.unset('imageZoom');
    }
    if (currentMain) currentMain.close();
    obj.render();
    currentMain = obj;
    $('#body').html(currentMain.$el.get(0));
  }

  function renderLibrary(obj){
    if (currentMain) currentMain.close();
    setTimeout(function(){
      obj.render();
      currentMain = obj;
    }, 200);
  }

  function primaryDisplay(val){
    switch(val){
     case 'movies':
       renderLibrary.call(this, Library());
       break;
     case 'sources':
       renderMain.call(this, new Sources());
       break;
    }
  }

  Session.on('change:primary_display', primaryDisplay);
  primaryDisplay(Session.get('primary_display'));

})();


///////////////////////////////////
// Handle Selected Movie Display //
///////////////////////////////////

// xxx rethink this. pretty bad...

(function(){

  var $footer = document.getElementById('footer');
  var movieView, previousMovie;
  var MovieView = require('movie');
  var collection = require('collections');

  var updateStore = function(model){
    Session.set('selected_movie', Session.get('selected_movie'), {
      silent: true
    });
  }

  function showMovie(val){
    if (!val) $footer.classList.add('hidden');
    if (previousMovie) {
      previousMovie.off('change', updateStore);
      if (movieView) movieView.close();
    }
    if (val){
      if (!(val instanceof Model)) {
        collection.add(val);
        val = collection.get(val._id);
      }
      val.on('change', updateStore);
      previousMovie = val;
      movieView = new MovieView(val).render();
      $footer.appendChild(movieView.$el);
      $footer.classList.remove('hidden');
    }
  }

  Session.on('change:selected_movie', showMovie);
  var holdover = Session.get('selected_movie');
  if (holdover) showMovie(holdover);

})();


/////////////////////////////
// Handle Current Playback //
/////////////////////////////

(function(){

  var CurrentlyPlayingView = require('current_playback');
  var parent = document.getElementById('library-control');
  var currentPlaybackView;
  var collection = require('collections');

  var updateStore = function(model){
    Session.set('current_playback', Session.get('current_playback'), {
      silent: true
    });
  }

  function showPlay(val){
    if (currentPlaybackView) currentPlaybackView.close();
    if (val){
      if (!(val instanceof Model)) {
        collection.add(val);
        val = collection.get(val._id);
      }
      val.isPlaying = true;
      val.on('change', updateStore);
      currentPlaybackView = new CurrentlyPlayingView(val);
      parent.appendChild(currentPlaybackView.$el.get());
      currentPlaybackView.show();
    }
  }

  Session.on('change:current_playback', showPlay);
  var holdover = Session.get('current_playback');
  if (holdover) showPlay(holdover);

})();

require('image_zoom');