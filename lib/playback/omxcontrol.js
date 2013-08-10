var spawn = require('child_process').spawn;
var db = require('../database');
var publish = require('../sockets/publications');

var pipe = false;
var currentVideo;

function prepareVideo(json, options){
  if (currentVideo._id !== json._id){
    if (currentVideo) omx.quit();
    currentVideo = json;
    omx.start(json, options);
    return currentVideo;
  }
}

function updateMovie(modifier){
  return db.update('movies', { _id: currentVideo._id }, modifier)
    .then(function(){
      return db.findOne('movies', { _id: currentVideo._id });
    })
    .then(function(doc){
      publish.changed('movies', doc);
    });
}

var omx = {};

function mapKey(command, key, then){
  omx[command] = function(){
    omx.sendKey(key);
    if (then) then();
  }
}

omx.start = function(movie, options){
  if (pipe) return;
  options = options || {};
  var path = JSON.stringify(path.normalize(movie.path));
  pipe = 'omxcontrol';
  exec('mkfifo '+ pipe);
  var path = movie.torrent
    ? 'http://localhost:3000/stream/'+ movie._id
    : path;

  var cmd = 'omxplayer -o local --vol 6 ';
  if (options.startPosition) {
    cmd += '-l ' + options.startPosition + ' ';
  }
  exec(cmd + this.path + ' < ' + this.pipe);
  updateMovie({$set: { playback: 'started' }});
}

mapKey('pause', 'p', function(){
  updateMovie({$set: { playback: 'paused' }});
});
mapKey('play', 'p', function(){
  updateMovie({$set: { playback: 'playing' }});
});
mapKey('quit', 'q', function(){
  exec('rm '+ pipe);
  pipe = false;
  updateMovie({$unset: { playback: '' }});
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







