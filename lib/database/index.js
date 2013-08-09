var Datastore = require('nedb');
var path = require('path');
var Q = require('q');
var fs = require('fs');

/**
 * nedb is used to create a local nosql store of all our
 * persisted data. The wrapper stores all of these datasets
 * and emits a 'loaded' event once they have all loaded.
 */

function Databases(){

  // Create our database folder if need be.
  var databasePath = path.join(__dirname, '/databases');
  if (!fs.existsSync(databasePath)) {
    fs.mkdirSync(databasePath)
  }

  // Movies
  this.movies = new Datastore({
    filename: path.join(__dirname, '/databases/movies.db'),
    autoload: true
  });

  // Library Sources
  this.sources = new Datastore({
    filename: path.join(__dirname, '/databases/sources.db'),
    autoload: true
  });
}

// Return promises for our queries, inserts, updates, and
// other async operations involving nedb.

//   db
//    .find('bacon', {})
//    .then(function(data){ console.log(data); })
//    .fail(function(error){ console.log('error', error); });
//
//   You can also use typical node style callbacks.


Databases.prototype.insert = function(name, json, fn){
  var deferred = Q.defer();
  try {
    this[name].insert(json, deferred.makeNodeResolver());
  } catch (err) { deferred.reject(err); };
  return deferred.promise.nodeify(fn);
};

Databases.prototype.update = function(name, selector, json, fn){
  var deferred = Q.defer();
  try {
    this[name].update(selector, json, {}, deferred.makeNodeResolver());
  } catch (err) { deferred.reject(err); };
  return deferred.promise.nodeify(fn);
};

Databases.prototype.remove = function(name, selector, fn){
  var deferred =  Q.defer();
  try {
    this[name].remove(selector, deferred.makeNodeResolver());
  } catch (err) { deferred.reject(err); };
  return deferred.promise.nodeify(fn);
};

Databases.prototype.find = function(name, selector, fn){
  var deferred = Q.defer();
  try {
    this[name].find(selector, deferred.makeNodeResolver());
  } catch(err){ deferred.reject(err); };
  return deferred.promise.nodeify(fn);
};

Databases.prototype.findOne = function(name, selector, fn){
  var deferred = Q.defer();
  try {
    this[name].findOne(selector, deferred.makeNodeResolver());
  } catch(err) { deferred.reject(err); };
  return deferred.promise.nodeify(fn);
};

var databases = new Databases();

// insert a default source if none are entered.
databases.find('sources', {})
  .then(function(res){
    if (res.length < 1) {
      var defaultPath = path.join(__dirname, '/../../movies');
      return databases.insert('sources', { path : defaultPath });
    }
  })
  .fail(function(error){
    console.log('Error syncing', error);
  });

module.exports = databases;

