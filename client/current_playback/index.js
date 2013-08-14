var Session = require('session');
var events = require('events');
var dom = require('dom');
var _ = require('underscore');
var movies = require('../collections/movies');

var currentVideoView = new CurrentlyPlayingView();
dom('#library-control').append(currentVideoView.$el);

////////////////////////////////////
// Listen for changes to Playback //
////////////////////////////////////

var currentMovie;
movies.on('currentlyPlaying', function(model, value){
  if (currentMovie != model) {
    currentVideoView.render(model).show();
    console.log('SHOW VIDEO');
  }
});

movies.on('notCurrentlyPlaying', function(){
  currentMovie = null;
  currentVideoView.hide();
  console.log('HIDE VIDEO');
});


/////////////////////////
// Current Video View  //
/////////////////////////
//
// This keeps track which videos are currently playing
// on the tv, and gives you quick access (via the button
// in the top right corner) to access controls for
// the current playback. It should be updated accross all
// connected devices.
//

function CurrentlyPlayingView(){
  this.$el = dom('<div></div>').id('currently-playing');
  this.events = events(this.$el.get(), this);
  this.events.bind('click', 'showVideo');
};

CurrentlyPlayingView.prototype.show = function(){
  var self = this;
  setTimeout(function(){
    self.$el.addClass('in');
  }, 0);
};

CurrentlyPlayingView.prototype.render = function(movie){
  this.movie = movie;
  var name = movie.get('title') || movie.get('file_name');
  var icon = '<i class="icon-tv"></i>';
  this.$el.html(icon);
  return this;
};

CurrentlyPlayingView.prototype.hide = function(){
  this.$el.removeClass('in');
};

CurrentlyPlayingView.prototype.close = function(){
  this.movie.isPlaying = false;
  this.events.unbind();
  var self = this;
  setTimeout(function(){
    self.$el.remove();
  }, 500);
  this.$el.removeClass('in');
};

CurrentlyPlayingView.prototype.showVideo = function(){
  var self = this;
  var backdrop = this.movie.get('original_backdrop_path')
    ? '/movies/w1280'+ this.movie.get('original_backdrop_path')
    : null;
  Session.set('selected_movie', null);
  var left = window.innerWidth - 150;
  Session.set('imageZoom', {
    origin: {
      left: window.innerWidth - 150,
      top: -120,
      width: 150
  },
  url : backdrop,
  fn : function(zoom){
    zoom.on('showing', function(){
      setTimeout(function(){
        Session.set('selected_movie', self.movie);
      }, 400);
      });
    }
  });
};

module.exports = CurrentlyPlayingView;