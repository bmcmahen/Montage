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



require('current_playback');
require('movie');
require('image_zoom');