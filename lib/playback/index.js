var exec = require('child_process').exec;
var db = require('../database');
var publish = require('../sockets/publications');
var Methods = require('../sockets/methods');
var path = require('path');
var OMXControl = require('./omxplayer');

var currentVideo;

//////////////////////////
// Player Controller  //
//////////////////////////

function Player(json, options){
  this.json = json;
  this._id = json._id;
  this.options = options || {};
  this.path = json.torrent
    ? 'http://localhost:3000/stream/'+ json._id
    : json.path;

  console.log('BUILDING PLAYER');
  currentVideo = this;

  // xxx todo: make player pluggable here.
  // ie. Player.use(OMXControl) (or something)
  this.player = new OMXControl(this.path, options);
  this.player.on('error', this.onerror.bind(this));
  this.player.on('closed', this.onclosed.bind(this));

  var self = this;
  db.findOne('movies', {_id: this._id })
    .then(function(doc){
      if (!this.player.isClosed && currentVideo._id === this._id) {
        self.updateMovie({ '$set': { playback : 'playing' }})
          .then(function(){
            console.log('changed currently playing');
            publish.changed('currentlyPlaying', doc);
          });
      }
    });
}

Player.prototype.onerror = function(err){
  // What should we do with this? Parse it and try to update
  // playback accordingly? Pass it to the user?
  console.log(err);
};

Player.prototype.updateMovie = function(modifier){
  var _id = this._id;
  return db
    .update('movies', { _id: _id }, modifier)
    .then(function(){
      return db.findOne('movies', { _id: _id });
    })
    .then(function(doc){
      return publish.changed('movies', doc);
    })
    .fail(function(err){
      console.log('Error updating movie playback', err);
    });
};

Player.prototype.onclosed = function(){
  this.updateMovie({ $set : { playback: false }});
  if (this._id === currentVideo._id) {
    publish.changed('currentlyPlaying', {});
    currentVideo = null;
  }
};

/**
 * Basic controller
 * @param  {Object} json
 * @param  {Object} options
 * @return {Player}
 */

function startOrRetrieveVideo(json, options){
  if (!currentVideo) return new Player(json, options);
  if (currentVideo._id !== json._id){
    currentVideo.player.quit();
    return new Player(json, options);
  }
  return currentVideo;
}

/////////////
// Methods //
/////////////

Methods.add({
  playVideo: function(video, options){
    var vid = startOrRetrieveVideo(video, options);
    vid.player.play();
  },
  forwardVideo: function(){
    currentVideo.player.forward();
  },
  backwardVideo: function(){
    currentVideo.player.backward();
  },
  pauseVideo: function(){
    if (currentVideo){
      currentVideo.updateMovie({$set: { playback: 'paused' }});
      currentVideo.player.pause();
    }
  },
  volumeUp: function(){
    currentVideo.player.volumeUp();
  },
  volumeDown: function(){
    currentVideo.player.volumeDown();
  },
  toggleSubtitles: function(){
    currentVideo.player.toggleSubtitles();
  },
  nextSubtitleStream: function(){
    currentVideo.player.nextSubtitleStream();
  },
  previousSubtitleStream: function(){
    currentVideo.player.previousSubtitleStream();
  },
  nextChapter: function(){
    currentVideo.player.nextChapter();
  },
  previousChapter: function(){
    currentVideo.player.previousChapter();
  },
  quitVideo: function(){
    currentVideo.player.quit();
  }

});







