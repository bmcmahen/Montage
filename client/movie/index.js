var dom = require('dom');
var bind = require('event');
var onload = require('onload');
var Zoom = require('zoom');
var Model = require('backbone').Model;

var TabView = require('./tabs');
var Session = require('../session');
var collection = require('../collections/movies');



/////////////////
// Controller  //
/////////////////

var movieView, previousMovie, zoom;
var $container = dom('#movie-view');
var top = 45;
var left = 0;

var updateStore = function(model){
  Session.set('selected_movie', Session.get('selected_movie'), {
    silent: true
  });
}

function showMovie(val, options){

  if (previousMovie) {
    previousMovie.off('change', updateStore);
    delete previousMovie.pos;
    zoom.hide();
    movieView = null;
    previousMovie = null;
  }

  if (val){
    if (!(val instanceof Model)) {
      collection.add(val);
      val = collection.get(val._id);
    }

    val.on('change', updateStore);
    previousMovie = val;
    movieView = new TabView(val);

    console.log(movieView);

    var height = window.innerHeight - 45;
    var width = window.innerWidth;

    if (!val.pos) {
      val.pos = {
        width: 100,
        left: (width / 2) - (100 / 2),
        top: (height / 2) - (75 / 2)
      };
    }

    var originHeight = val.pos.width * (height / width);

    zoom = new Zoom(movieView.$el.get(), $container.get())
      .duration(400)
      .setDimensions('100%', '100%')
      .target(left, top, width, height)
      .origin(val.pos.left, val.pos.top + 70, val.pos.width, originHeight);


    options = options || {};
    if (options.no_zoom) {
      movieView.$el.addClass('no-zoom');
    }

    // preload our background image.
    var src = val.get('original_backdrop_path');
    if (src) {
      var path = '/movies/w1280' + src;
      var img = new Image;
      img.onload = function() {
        movieView.$el.get().style['background-image'] = 'url("'+ path +'")';
        zoom.show();
      };
      img.onerror = function(){
        zoom.show();
      };
      img.src = path;
    // or don't bother using a background image.
    } else {
      zoom.show();
    }
  }
}

Session.on('change:selected_movie', showMovie);
var holdover = Session.get('selected_movie');
if (holdover) showMovie(holdover, { no_zoom: true });

