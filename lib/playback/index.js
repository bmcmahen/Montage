var exec = require('child_process').exec;
var db = require('../database');
var publish = require('../sockets/publications');
var Methods = require('../sockets/methods');
var path = require('path');
var OMXControl = require('./omxplayer');

var currentVideo, omx;

function onerror(err){
  console.log(err);
}

// This should be called any time we quit OMXPlayer.
function onclose(){
  console.log('CLOSING');
  updateMovie({ $set : { playback : false }})
    .then(function(){
      currentVideo = null;
    });
  publish.changed('currentlyPlaying', {});
  omx = null;
}

function prepareVideo(json, options){

  var makePlayer = function(){
    console.log('MAKING PLAYER');
    currentVideo = json;
    var path = json.torrent
      ? 'http://localhost:3000/stream/'+ json._id
      : json.path;
    omx = new OMXControl(path, options);
    omx.on('error', onerror);
    omx.on('closed', onclose);
    db.findOne('movies', {_id: currentVideo._id})
      .then(function(vid){
        if (!omx.isClosed) publish.changed('currentlyPlaying', vid);
      });
    return currentVideo;
  };

  if (!currentVideo) return makePlayer();
  if (currentVideo._id !== json._id){
    if (currentVideo) omx.quit();
    return makePlayer();
  }
}

function updateMovie(modifier){
  if (!currentVideo) return;
  return db.update('movies', { _id: currentVideo._id }, modifier)
    .then(function(){
      return db.findOne('movies', { _id: currentVideo._id });
    })
    .then(function(doc){
      console.log('PUBLISHING CHANGES', doc.playback);
      publish.changed('movies', doc);
    })
    .fail(function(err){
      console.log('error updating movie playback', err);
    });
}

Methods.add({
  playVideo: function(video, options){
    prepareVideo(video, options);
    omx.play();
    updateMovie({$set: { playback: 'playing' }});
    return true;
  },
  forwardVideo: function(){
    return omx.forward();
  },
  backwardVideo: function(){
    return omx.backward();
  },
  pauseVideo: function(){
    updateMovie({$set: { playback: 'paused' }});
    if (omx) omx.pause();
    return;
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







