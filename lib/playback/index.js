var exec = require('child_process').exec;
var db = require('../database');
var publish = require('../sockets/publications');
var Methods = require('../sockets/methods');
var path = require('path');

var pipe = false;
var currentVideo;
var omx = {};

// XXX eventually make this pluggable. perhaps emit events,
// or register keys and functions... something that allows
// someone to easily add a VLC, MPV, etc., plugin.

function prepareVideo(json, options){
  if (!currentVideo) {
    currentVideo = json;
    omx.start(json, options);
    return currentVideo;
  };

  if (currentVideo._id !== json._id){
    if (currentVideo) omx.quit();
    currentVideo = json;
    omx.start(json, options);
    return currentVideo;
  }
}

function updateMovie(modifier){
  if (!currentVideo) return;
  return db.update('movies', { _id: currentVideo._id }, modifier)
    .then(function(){
      return db.findOne('movies', { _id: currentVideo._id });
    })
    .then(function(doc){
      console.log('PUBLISHING CHANGES');
      publish.changed('movies', doc);
    })
    .fail(function(err){
      console.log('error updating movie playback', err);
    });
}


function mapKey(command, key, then){
  omx[command] = function(){
    omx.sendKey(key);
    if (then) then();
  }
}

omx.sendKey = function(key){
  console.log("sending key", key);
  if (!pipe) return;
  exec('echo -n '+ key +' > '+ pipe);
};

omx.start = function(movie, options){
  console.log('starting video');
  if (pipe) return;
  options = options || {};
  var p = JSON.stringify(path.normalize(movie.path));
  pipe = 'omxcontrol';
  exec('mkfifo '+ pipe);
  p = movie.torrent
    ? 'http://localhost:3000/stream/'+ movie._id
    : p;

  var cmd = 'omxplayer -o local --blank ';
  if (options.startPosition) {
    cmd += '-l ' + options.startPosition + ' ';
  }

  if (options.volume) {
    cmd += '--vol ' + options.volume + ' ';
  }

  exec(cmd + p + ' < ' + this.pipe);
  updateMovie({$set: { playback: 'started' }});
  db.findOne('movies', {_id: currentVideo._id})
    .then(function(vid){
      console.log('SENDING NEW VID', vid);
      publish.changed('currentlyPlaying', vid);
    });
}

mapKey('pause', 'p', function(){
  console.log('pause yo');
  updateMovie({$set: { playback: 'paused' }});
});
mapKey('play', 'p', function(){
  console.log('play yo');
  updateMovie({$set: { playback: 'playing' }});
});
mapKey('quit', 'q', function(){
  exec('rm '+ pipe);
  pipe = false;
  updateMovie({$unset: { playback: '' }});
  console.log('CURRENTPLY PLAYING NULLED');
  publish.changed('currentlyPlaying', null);
});
mapKey('forward', "\x5b\x43");
mapKey('backward', "\x5b\x43");
mapKey('volumeUp', '+');
mapKey('volumeDown', '-');
mapKey('toggleSubtitles', 's');
mapKey('nextSubtitleStream', 'm');
mapKey('previousSubtitleStream', 'n');
mapKey('nextChapter', 'o');
mapKey('previousChapter', 'i');


Methods.add({
  playVideo: function(video, options){
    prepareVideo(video, options);
    omx.play();
    return true;
  },
  forwardVideo: function(){
    return omx.forward();
  },
  backwardVideo: function(){
    return omx.backward();
  },
  pauseVideo: function(){
    return omx.pause();
  },
  volumeUp: function(){
    return omx.volumeUp();
  },
  volumeDown: function(){
    return omx.volumeDown();
  },
  toggleSubtitles: function(){
    return omx.toggleSubtitles();
  },
  nextSubtitleStream: function(){
    return omx.nextSubtitleStream();
  },
  previousSubtitleStream: function(){
    return omx.previousSubtitleStream();
  },
  nextChapter: function(){
    return omx.nextChapter();
  },
  previousChapter: function(){
    return omx.previousChapter();
  }

})







