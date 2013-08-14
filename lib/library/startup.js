var publish = require('../sockets/publications');
var resumeTorrents = require('../torrents').resumeDownloadsonStartup;
var syncLibrary = require('./build').syncLibrary;
var db = require('../database');

/////////////////////////////////////////
// Perform these operations on startup //
/////////////////////////////////////////

// Sync our library
syncLibrary()
  .then(function(){
    resumeTorrents();
  })
  .fail(function(err){
    console.log('Error', err);
  })
  .done(function(res){
    publish.send('movies');
  });

// Remove any 'playback' attr that may have been leftover
// after a crash or something.
db.updateAll('movies', { playback : { $exists : true }}, { $unset : { 'playback': '' }}, function(err, num){});