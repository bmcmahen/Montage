var fs = require('fs');
var Methods = require('../sockets/methods');
var publish = require('../sockets/publications');
var db = require('../database');
var syncLibrary = require('./build').syncLibrary;
var tmdb = require('./tmdb');
var Q = require('q');
var _ = require('underscore');

Methods.add({

  /**
   * Sync Library with the FS, and send
   * the results.
   * @return {Promise}
   */

  syncLibrary: function(){
    return syncLibrary().then(function(){
      publish.send('movies');
      return true;
    });
  },

  /**
   * Return the contents of a given directory. Used
   * for browsing file sources.
   * @param  {String} dir
   * @return {Array}
   */

  browse: function(dir){
    return Q.nfcall(fs.readdir, dir)
      .then(function(fileNames){
        return fileNames
          // filter invisible fileNames
          .filter(function(filename){ return ! /^\./.test(filename); })
          // create an object with type supplied
          .map(function(filename){
            var type = (fs.lstatSync(dir + '/' + filename).isDirectory())
              ? 'directory'
              : 'file';
            return { type : type, name : filename };
          });
      });
  },

 /**
  * Remove a source from our collection of
  * sources.
  * @param  {_id} id of source
  * @return {Object}
  */

  removeSource: function(id){
    return db.remove('sources', {_id: id })
      .then(function(res){
        publish.removed('sources', res);
        return res;
      });
  },

  /**
   * Add a directory to our library sources.
   * @param  {String} dir
   * @return {Object}
   */

  addSource: function(dir){
    if (!dir) return new Error('You must supply a directory.');
    if (dir[dir.length - 1] === '/') dir = dir.slice(0, -1);
    return db.insert('sources', { path: dir })
      .then(function(src){
        publish.added('sources', src);
        return src;
      });
  },

  /**
   * Return all of our current library sources.
   * @return {Array}
   */

  getSources: function(){
    return db.find('sources', {});
  },

  /**
   * Given a query, return a set of search results
   * from IMDB.
   * @param  {String} query movie name
   * @return {Array}       results
   */

  queryMeta: function(query){
    return tmdb.search(query);
  },

  /**
   * Save the altered json of a movie document to
   * our database.
   * @param  {Object} json
   * @param  {String} tmdb id used if we want to fetch meta
   * @return {Object}
   */

  updateMeta: function(model, id){

    // If we don't need to fetch any metadata, simply update
    // the database and send changes to our client.

    if (!id){
      return db.update('movies', { _id: model._id }, {'$set' : model })
        .then(function(doc){
          publish.changed('movies', doc);
          return doc;
        });
    }

    // Otherwise, request additional metadata and fetch our images
    // before sending back to the client.
    var fetchPoster = require('./meta').fetchPosters;

    return tmdb.getDetail(id)
      .then(function(meta){
        _.extend(model, tmdb.normalize(meta));
        return fetchPoster(model);
      })
      .then(function(){
        return db.update('movies', { _id: model._id }, {'$set' : model });
      })
      .then(function(){
        return db.findOne('movies', { _id: model._id });
      })
      .then(function(doc){
        publish.changed('movies', doc);
        return doc;
      });
  }

});