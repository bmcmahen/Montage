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

  setPlayback: function(){
    if (this.get('isTV')) {
      var pb = this.movie.get('playback');
      if (pb === 'playing') this.set('isPlaying', true);
      else this.set('isPlaying', false);
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

  // Our meta template
  this.$metaEl = dom(require('./templates/movieinfo.html'));
  this.reactiveMeta = reactive(this.$metaEl.get(), this.movie, this);
  this.$el.find('#main-playback').empty().append(this.$metaEl);

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
    if (this.video) this.video.pause();
    if (this.movie.get('playback') === 'playing') {
      this.model.set('isPlaying', true);
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
    this.video.currentTime = this.video.currentTime + 30;
  } else {
    ddp.call('forwardVideo', this.model.toJSON(), function(err, res){
      console.log('froward result.')
    });
  }
};

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
    options.currentTime = this.model.get('currentTime');
    options.volume = session.get('tvVolume');
    this.movie.set('playback', 'playing');
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

      $video.src(src + this.movie.id);
      this.$el
        .find('#main-playback')
        .empty()
        .addClass('video')
        .append($video);
      this.video = $video.get();
      this.videoEvents = events(this.video, this);
      this.videoEvents.bind('pause', 'onpause');
      this.videoEvents.bind('error', 'onpause');
      this.videoEvents.bind('ended', 'onpause');
    }
    this.model.set('isPlaying', true);
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

Playback.prototype.onpause = function(){
  if (session.get('playbackDevice') === 'local') {
    this.model.set('isPlaying', false);
    dom('.zoom-background').removeClass('fade');
  }
};

Playback.prototype.image_url = function(){
  return '/movies/w342' + this.movie.get('original_poster_path');;
};

Playback.prototype.close = function(){
  this.$el.remove();
  if (this.videoEvents) this.videoEvents.unbind();
  this.stopListening();
};

