var Q = require('q');
var Database = require('../database');
var fs = require('fs');
var path = require('path');
var minimatch = require('minimatch');
var getChanges = require('../utils/difference');
var request = require('request');
var _ = require('underscore');
var getMeta = require('./meta');


/**
 * Return a list of all of the video files found
 * within our specified sources directories.
 * @return {Promise}
 */

function findAllVideoFiles(){
  return Database
    .find('sources', {})
    .then(function(sources){
      var promises = sources.map(function(source){
        return findVideosInDirectory(source.path);
      });
      return Q.all(promises);
    })
    .then(function(results){
      return [].concat.apply([], results);
    });
}

exports.findAllVideoFiles = findAllVideoFiles;


/**
 * Determine if the file has a video extension
 * @param  {String}  file
 */

function isVideo(file){
  var types = ['*.mp4', '*.m4v', '*.mkv', '*.avi', '*.flv'];
  return types.some(function(type){
    return minimatch(file, type);
  });
}

exports.isVideo = isVideo;


/**
 * Find the videos contained (recursively) in
 * a given directory.
 * @param  {String} dir
 * @return {Array}     Videos
 */

function findVideosInDirectory(dir, done) {
  var deferred = Q.defer();
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return deferred.reject(err);
    var pending = list.length;
    if (!pending) return deferred.resolve(results);
    list.forEach(function(file) {
      var pwd = dir + '/' + file;
      fs.stat(pwd, function(err, stat) {
        if (stat && stat.isDirectory()) {
          findVideosInDirectory(pwd).then(function(res){
            results = results.concat(res);
            if (!--pending) deferred.resolve(results);
          })
        } else {
          if (isVideo(file)) results.push({
            file_name: file,
            path: pwd
          });
          if (!--pending) deferred.resolve(results);
        }
      });
    });
  });
  return deferred.promise.nodeify(done);
}

/**
 * Remove a list of Videos from the database.
 * @param  {Array} list
 */

function removeVideos(list){
  var promises = list.map(function(vid){
    return Database.remove('movies', { _id : vid._id });
  });
  return Q.all(promises);
}

function disableVideos(list){
  var promises = list.map(function(vid){
    return Database.update('movies', { _id : vid._id }, {$set: { file_missing: true }});
  });
  return Q.all(promises);
}

function enableVideos(list){
  var promises = list.map(function(vid){
    return Database.update('movies', { _id : vid._id }, { $set: { file_missing: false }});
  });
  return Q.all(promises);
}


/**
 * Parse a file name in an attempt to get the
 * date and name of the movie.
 * @param  {Object} file
 * @return {Object}      altered object w/ parsed_name & date.
 */

function parseName(file){
  if (_.isArray(file)) return parseFileNames(file);
  var str = file.file_name || file.title;
  // find any dates
  var dates = str
    .split(/[^\d]/)
    .filter(function(n){
      if ( (n >= 1900) && (n <= 2099)) return n;
    });

  var dateString = dates[dates.length - 1];

  // Anything after the date isn't the title.
  var title = dateString
    ? str.substr(0, str.indexOf(dateString))
    : str;

  // Remove the file extension
  var extension = title.lastIndexOf('.');
  if (extension > 0) title = title.substr(0, extension);

  // Remove slashes, periods, html from filename
  title = title
    .replace(/\(|\)|\[|\]/g, '')
    .replace(/\./g, ' ')
    .replace(/<(?:.|\n)*?>/gm, '')
    .trim();

  // If we somehow end up with an empty title,
  // we should just use the file_name.
  if (title === '') title = str;
  if (dateString) file.parsed_date = dateString;
  file.parsed_name = title;
  return file;
}

exports.parseName = parseName;

/**
 * Parse the filenames for a list of files.
 * @param  {Array} list
 * @return {Array}      altered list.
 */

function parseFileNames(list){
  list.forEach(function(file){
    file = parseName(file);
  });
  return list;
}

/**
 * Add a given list of file_names to the database,
 * after fetching meta, d/l images, etc.
 * @param  {Array} toAdd array of filenames
 * @return {Array}       inserted movies
 */

function prepareAndAddVideos(toAdd){
  if (toAdd.length < 1) return true;
  var parsedFiles = parseName(toAdd);
  return getMeta
    .fetchAllMovieMeta(parsedFiles)
    .then(function(meta){
      parsedFiles = meta;
      return getMeta.fetchPosters(parsedFiles);
    })
    .then(function(){
      var promises = parsedFiles.map(function(movie){
        return Database.insert('movies', movie);
      });
      return Q.all(promises);
    })
    .fail(function(err){
      console.log(err);
    });
}

exports.prepareAndAddVideos = prepareAndAddVideos;

/**
 * Sync our library given the files found in our
 * specified source directories.
 * @return {Promise}
 */

function syncLibrary(){
  return Q.all([
    Database.find('movies', {}),
    findAllVideoFiles()
  ])
  .spread(function(currentMovies, newFiles){
    var toRemove = [];
    var toAdd = [];
    var toEnable = [];
    getChanges(currentMovies, newFiles, {
      remove: function(v){ toRemove.push(v); },
      add : function(v){ toAdd.push(v); },
      enable: function(v) { toEnable.push(v) }
    });
    return Q.all([
      prepareAndAddVideos(toAdd),
      disableVideos(toRemove),
      enableVideos(toEnable)
    ]);
  });
}

exports.syncLibrary = syncLibrary;

module.exports = exports;


