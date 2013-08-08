var Q = require('q');
var events = require('events');
var sys = require('sys');
var fs = require('fs');
var path = require('path');
var Torrent = require('itty-bitty-torrent');
var _ = require('underscore');
var Database = require('../database');
var Methods = require('../sockets/methods');
var Publish = require('../sockets/publications');
var isVideo = require('../library/build').isVideo;

var currentDownloads = [];
exports.currentDownloads = currentDownloads;

function isAvi(name){
  return /\.avi$/i.test(name);
}

//////////////////////////
// Bittorrent Download  //
//////////////////////////

function Download(attr){
  if (!(this instanceof Download)) return new Download(attr);
  events.EventEmitter.call(this);
  this.attributes = attr;
  this.torrentFile = attr.torrent;
  this.torrentURL = attr.torrent.url;
  this.dest = attr.torrent.destination;
}

sys.inherits(Download, events.EventEmitter);

// This isn't very efficient, but we need to query each time
// so as to make sure that we aren't publishing an outdated,
// wrong version of the file to the client.
Download.prototype.publishChanges = function(){
  Database.findOne('movies', { _id : this.attributes._id })
    .then(function(doc){
      if (doc) Publish.changed('movies', doc);
    });
};

Download.prototype.onFinished = function(){
  if (this.interval) clearInterval(this.interval);
  this.torrent.stop();
  currentDownloads.splice(currentDownloads.indexOf(this), 0);
  var self = this;
  Database.findOne('movies', { _id : this.attributes._id })
    .then(function(doc){
      delete doc.torrent;
      return Database.update('movies', { _id : doc._id }, doc);
    })
    .then(function(){
      self.publishChanges();
    });
};

Download.prototype.download = function(fn){
  // Determine our destination folder
  var attr = this.attributes;
  var folder = attr.parsed_date
    ? attr.parsed_name + ' [' + attr.parsed_date + ']'
    : attr.parsed_name;

  // Make that folder if it doesn't exist.
  this.dest = path.join(this.dest, folder);
  if (!fs.existsSync(this.dest)) fs.mkdirSync(this.dest);

  var self = this;
  if (!this.torrentURL) return fn(new Error('No torrent url found.'));

  // Create our torrent, and download it.
  this.torrent = new Torrent(this.torrentURL, this.dest, function(err){
    if (err) return fn(err);
    self.updateMetaData();
    var largest = self.largest = self.getLargest();
    if (isAvi(largest.name)) self.isAvi = true;
    self.torrent.download();
    return fn();
  });

  // Bind our finishing event to remove our torrent related information.
  this.torrent.on('finished', this.onFinished.bind(this));
};

Download.prototype.updateMetaData = function(){
  var self = this;
  try { var files = this.torrent.storage.torrent.files; }
  catch(err){ return new Error('Torrent files not found.'); }

  // Assume the largest file is our movie. Eventually this should
  // be more sophisticated to deal with multiple videos, etc.
  var movie = _.max(files, function(file){
    return file.length;
  });

  if (! isVideo(movie.name))
    return new Error('Video file not found.');

  this.attributes.file_name = movie.name;
  this.attributes.path = path.join(this.dest, movie.name);
  Database
    .update('movies', {_id: this.attributes._id}, {
      '$set': {
        file_name : this.attributes.file_name,
        path: this.attributes.path
      }
    })
    .then(function(){
      self.publishChanges();
    });
};

// xxx when actually using, probably increase this to 60 seconds.
Download.prototype.monitorProgress = function(){
  var self = this;
  this.interval = setInterval(function(){
    if (! self.torrent) return;
    Database.update('movies', {_id : self.attributes._id}, {
      '$set': { 'torrent.progress' : self.torrent.percentage() }
    }).then(function(){
      self.publishChanges();
      console.log('Progress', self.torrent.percentage());
    });
  }, 20000);
};

Download.prototype.prioritize = function(i){
  var self = this;
  this.torrent.storage.missing.sort(function(a, b){
    if (a === self.largest.end && !self.isAvi) return -1;
    if (b === self.largest.end && !self.isAvi) return 1;
    if (a >= i && b < i) return -1;
    if (b >= i && a < i) return 1;
    return a - b;
  });
};

Download.prototype.getLargest = function(){
  return _.max(this.torrent.storage.files, function(file){
    return file.length;
  });
};


var prepareAndAddVideos = require('../library/build').prepareAndAddVideos;


/**
 * Given a document in the database that contains a torrent
 * field, download it.
 * @param  {Movie} torrentdoc
 * @return {Promise}
 */

function initiateDownload(torrentdoc){
  var deferred = Q.defer();
  torrentdoc = _.isArray(torrentdoc) ? torrentdoc[0] : torrentdoc;
  var dl = new Download(torrentdoc);
  console.log('trying to init', dl);
  dl.download(function(err){
    console.log('download initated');
    if (err) return deferred.reject(err);
    dl.monitorProgress();
    currentDownloads.push(dl);
    deferred.resolve(dl);
  });
  return deferred.promise;
};


/**
 * Build a torrent download when given a torrent URL and
 * destination path. Add it to our DB (as a movie) and
 * monitor it for progress. Add it to our collection of
 * current downloads.
 * @param  {URL} torrent
 * @param  {String} destination path
 * @return {Movie}
 */

// We should eventually support file selection. So we'd parse the
// torrent file, send them back to the client. the client would
// select which files they want. we'd just download those, then.

function prepareTorrentDownload(torrent, destination){
  var deferred = Q.defer();
  var torrentFile = _.clone(torrent);
  var torrentFileName = { file_name : torrent.title };

  // If our torrent file already exists (i.e., we are currently downloading
  // it) then we merely try to resume the torrent. If it doesn't,
  // then we try to parse the torrent name, find metadata, add it
  // to the database, and then try to initiate the download.
  Database.findOne('movies', { 'torrent._id' : torrentFile._id })
    .then(function(result){
      if (result) return initiateDownload(result);
      prepareAndAddVideos(torrentFileName)
        .then(function(doc){
          doc = doc[0];
          Database.update('movies',
            { _id : doc._id }, { '$set': {
              torrent : torrentFile,
              'torrent.destination' : destination
            }
          }).then(function(){
            Database.findOne('movies', { _id: doc._id }).then(function(res){
              initiateDownload(res).then(function(dl){
                deferred.resolve();
              });
            });
          });
        });
    })
    .fail(function(err){
      if (err) deferred.resolve(err);
    })

  return deferred.promise;
}

/**
 * Resume any current downloads that might have
 * stopped during a restart, etc.
 */

function resumeDownloadsonStartup(){
  Database.find('movies', { torrent : { $exists: true }})
    .then(function(torrents){
      console.log('found some torrents', torrents.length);
      torrents.forEach(function(doc){
        initiateDownload(doc);
      });
    });
}

exports.resumeDownloadsonStartup = resumeDownloadsonStartup;

/////////////
// Methods //
/////////////

Methods.add({
  downloadTorrent: function(torrent, destination){
    if (!torrent || !torrent.url) return new Error('Torrent URL required.');
    if (!destination) return new Error('Download destination is required.');
    return prepareTorrentDownload(torrent, destination);
  }
});

