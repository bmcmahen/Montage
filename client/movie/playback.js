var dom = require('dom');
var events = require('events');
var reactive = require('reactive');
var fullscreen = require('fullscreen');
var Toggle = require('toggle');
var Slider = require('slider');
var EmitterManager = require('emitter-manager');
var Model = require('backbone').Model;

var session = require('../session');
var ddp = require('../sockets').ddp;

/////////////////////////////////
// Playback Session Variables  //
/////////////////////////////////

session.setDefault('playbackDevice', 'tv');
session.setDefault('volume', 3);
session.setDefault('tvVolume', 3);

/////////////////////////////////
// Adapt Reactive to Backbone  //
/////////////////////////////////

reactive.get(function(obj, prop) {
  return obj.get(prop);
});

reactive.set(function(obj, prop, val) {
  obj.set(prop, val);
});

reactive.subscribe(function(obj, prop, fn){
  obj.bind('change:'+ prop, fn);
});

reactive.unsubscribe(function(obj, prop, fn){
  obj.unbind('change:'+ prop, fn);
});

reactive.bind('disable-if', function(el, name){
  var $el = dom(el);
  this.change(function(){
    if (this.value(name)) $el.addClass('disabled');
    else $el.removeClass('disabled');
  });
});

reactive.bind('disable-if-not', function(el, name){
  var $el = dom(el);
  this.change(function(){
    if (this.value(name)) $el.removeClass('disabled');
    else $el.addClass('disabled');
  });
});



/////////////////////
// Playback Model  //
/////////////////////

var PlaybackModel = Model.extend({

  defaults: function(){
    this.set('isTV', session.get('playbackDevice') === 'tv');
    this.set('isLocal', !this.get('isTV'));
    this.set('isPlaying', false);
    this.set('TVplaybackStarted', false);
    this.set('localPlaybackStarted', false);
  },

  initialize: function(attr, movie){
    this.movie = movie;
    this.listenTo(session, 'change:playbackDevice', this.setDevice.bind(this));
    this.listenTo(movie, 'change:playback', this.setPlayback);
    if (movie.get('playback') === 'playing') {
      if (this.get('isTV')) {
        this.set('isPlaying', true);
      }
    }
    if (movie.get('playback')) {
      if (this.get('isTV')) {
        this.set('TVplaybackStarted', true);
      }
    }
  },

  setDevice: function(){
    if (session.get('playbackDevice') === 'tv') {
      this.set('isTV', true);
      this.set('isLocal', false);
    } else {
      this.set('isTV', false);
      this.set('isLocal', true);
    }
  },

  setPlayback: function(model, value){
    if (this.get('isTV')) {
      if (!value) {
        this.set('isPlaying', false);
        this.set('TVplaybackStarted', false);
      }
      if (value === 'playing') {
        this.set('isPlaying', true);
        this.set('TVplaybackStarted', true);
      } else {
        this.set('isPlaying', false);
      }
    }
  }


});

//////////////////////////
// Playback Controller  //
//////////////////////////

module.exports = Playback;

function Playback(movie){
  this.movie = movie;
  this.model = new PlaybackModel(null, movie);

  // Our playback wrapper/template
  this.$el = dom(require('./templates/playback.html'));
  this.reactive = reactive(this.$el.get(), this.model, this);

  // Our meta1 template
  this.$metaEl = dom(require('./templates/movieinfo.html'));
  this.reactiveMeta = reactive(this.$metaEl.get(), this.movie, this);
  this.$el.find('.movie-meta-1').append(this.$metaEl);

  this.$metaEl2 = dom(require('./templates/movieinfo.html'));
  this.reactiveMeta2 = reactive(this.$metaEl2.get(), this.movie, this);
  this.$el.find('.movie-meta-2').append(this.$metaEl2);

  // Our TV playback template
  this.$tvEl = dom(require('./templates/tvplayback.html'));
  this.reactiveTVPlay = reactive(this.$tvEl.get(), this.movie, this);
  this.$el.find('.tv-control').append(this.$tvEl);

  this.createToggle();
  this.createVolume();
  this.listen();
}

EmitterManager(Playback.prototype);

Playback.prototype.listen = function(){
  this.listenTo(this.toggle, 'change', this.togglePlayback);
  this.listenTo(this.volume, 'change:value', this.setVolume);
}

Playback.prototype.createToggle = function(){
  var el = this.$el.find('.toggle').get();
  this.toggle = new Toggle(null, el);

  // set our initial value.
  this.toggle.value(session.get('playbackDevice') === 'tv');
};

Playback.prototype.togglePlayback = function(){
  var otherDevice = (session.get('playbackDevice') === 'tv')
    ? 'local'
    : 'tv';
  session.set('playbackDevice', otherDevice);

  // When switchin from Local to TV, make sure that our
  // play button is set to the correct state, and reset
  // our volume to the TV volume level. Also, make sure
  // that our local video (if it exists) is paused.
  if (otherDevice === 'tv'){
    if (this.video){
      dom('.zoom-background').removeClass('fade');
      if (this.tempEvents) this.tempEvents.unbind();
      this.video.pause();
    }
    if (this.movie.get('playback') === 'playing') {
      this.model.set('isPlaying', true);
      this.model.set('TVplaybackStarted', true);
    } else {
      this.model.set('isPlaying', false);
    }
    this.volume.setValue(session.get('tvVolume'));

  // When switching from TV to Local, make sure
  // that our play button is paused. Also, switch our
  // volume indicator to Local volume.
  } else {
    this.model.set('isPlaying', false);
    this.volume.setValue(session.get('volume'));
  }
};

Playback.prototype.createVolume = function(){
  var el = this.$el.find('.volume').get();
  this.volume = new Slider(null, el)
    .range(0, 10)
    .step(1);

  // set our initial value.
  var val = (session.get('playbackDevice') === 'tv')
    ? session.get('tvVolume')
    : session.get('volume');

  this.volume.setValue(val);
};

Playback.prototype.setVolume = function(val, prev){
  if (session.get('playbackDevice') === 'tv') {
    session.set('tvVolume', val);
    if (val > prev) ddp.call('volumeUp');
    else ddp.call('volumeDown');
  } else {
    session.set('volume', val);
    this.video.volume = (val / 10);
  }
};

Playback.prototype.oncontrolclick = function(e){
  e.stopPropagation();
  e.preventDefault();
};

Playback.prototype.toggleSubtitles = function(){
  ddp.call('toggleSubtitles');
};

Playback.prototype.forward = function(e){
  e.preventDefault();
  e.stopPropagation();
  if (session.get('playbackDevice') === 'local'){
    if (!this.video) return;
    this.video.currentTime += 30;
  } else {
    ddp.call('forwardVideo');
  }
};

Playback.prototype.rewind = function(e){
  e.preventDefault();
  e.stopPropagation();
  if (session.get('playbackDevice') === 'local'){
    if (!this.video) return;
    this.video.currentTime -= 30;
  } else {
    ddp.call('backwardVideo');
  }
}

Playback.prototype.toggleFullscreen = function(e){
  e.stopPropagation();
  if (this.video) {
    if (this.video.webkitEnterFullscreen) this.video.webkitEnterFullscreen();
    else fullscreen(this.video);
  }
};

Playback.prototype.play = function(e){
  if (session.get('playbackDevice') === 'tv') this.toggleTVPlayback();
  else this.toggleLocalPlayback();
};

Playback.prototype.toggleTVPlayback = function(){
  if (this.model.get('isPlaying')) {
    this.movie.set('playback', 'paused');
    ddp.call('pauseVideo', this.movie.toJSON(), function(err){
      if (err) console.log(err);
    });
  } else {
    var options = {};
    // this should be normalized so that it's compatible w/
    // different players.
    options['-l'] = this.model.get('currentTime');
    options['--vol'] = session.get('tvVolume');
    this.movie.set('playback', 'playing');
    this.model.set('playbackStarted', true);
    ddp.apply('playVideo', [this.movie.toJSON(), options], function(err){
      if (err) console.log(err);
    });
  }
};

Playback.prototype.toggleLocalPlayback = function(){
  if (!this.model.get('isPlaying')) {
    if (!this.video){
      var $video = dom('<video></video>');
      var src = this.movie.get('torrent')
        ? '/stream/'
        : '/videos/';

      this.video = $video.get();
      this.videoEvents = events(this.video, this);
      this.videoEvents.bind('pause', 'onpause');
      this.videoEvents.bind('error', 'onerror');
      this.videoEvents.bind('ended', 'onerror');

      $video.src(src + this.movie.id);
      this.$el
        .find('#movie-local-playback')
        .empty()
        .addClass('video')
        .append($video);
    }
    this.model.set('isPlaying', true);
    this.model.set('localPlaybackStarted', true);
    dom('.zoom-background').addClass('fade');
    this.video.play();
    this.setVolume(session.get('volume'));
    this.tempEvents = events(document, this);
    this.tempEvents.bind('click', 'toggleLocalPlayback');
  } else {
    this.model.set('isPlaying', false);
    this.tempEvents.unbind();
    this.video.pause();
  }
};

Playback.prototype.onerror = function(){
  console.log("ERROR");
  this.model.set('isPlaying', false);
  this.model.set('localPlaybackStarted', false);
  dom('.zoom-background').removeClass('fade');
};

Playback.prototype.onpause = function(){
  if (session.get('playbackDevice') === 'local') {
    this.model.set('isPlaying', false);
    dom('.zoom-background').removeClass('fade');
  }
};

Playback.prototype.image_url = function(){
  return '/movies/w342' + this.movie.get('original_poster_path');;
};

Playback.prototype.quitMovie = function(e){
  console.log('quit movie!');
  ddp.call('quitMovie');
  this.model.set('isPlaying', false);
  this.model.set('TVplaybackStarted', false);
};

Playback.prototype.close = function(){
  this.$el.remove();
  if (this.videoEvents) this.videoEvents.unbind();
  this.stopListening();
};

Playback.prototype.playbackStartedAndLocal = function(){
  return this.model.get('isLocal') && this.model.get('localPlaybackStarted');
};

Playback.prototype.playbackStartedAndTV = function(){
  return this.model.get('isTV') && this.model.get('TVplaybackStarted');
};

Playback.prototype.aPlaybackStarted = function(){
  return this.model.get('TVplaybackStarted') || this.model.get('localPlaybackStarted');
};

