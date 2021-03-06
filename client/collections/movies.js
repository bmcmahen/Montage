var Model = require('backbone').Model;
var _ = require('underscore');
var ddp = require('../sockets').ddp;
var subscriptions = require('../sockets').subscriptions;
var Collection = require('backbone').Collection;
var $ = require('jquery');

var loading = require('../loading');

var videoControls = require('../controls');

// Movie Model
var Movie = Model.extend({

  idAttribute: '_id',

  /**
   * Override Backbone's default JSON save to use ddp sockets
   * and determine the method type depending on if its new (add)
   * or not (update).
   */

  save: function(){
    var json = this.toJSON();
    var type = this.isNew() ? 'add' : 'update';
    var self = this;
    this.trigger('request', this);
    loading.show();
    ddp.apply(type, ['movies', json], function(err, res){
      if (err) return self.trigger('error', self);
      self.trigger('sync', self);
      loading.hide();
    });
  },

  playMovie: function(){
    videoControls.playVideo(this);
    console.log(this.toJSON());
  }

});

exports.Model = Movie;


// Movie Collection
var Movies = Collection.extend({

  model: Movie,

  // Listen to our subscriptions, and update accordingly.
  initialize: function(){
    this.initialLoad = true;
    subscriptions.on('movies', this.setMovies.bind(this));
    subscriptions.on('movies:added', this.addMovie.bind(this));
    subscriptions.on('movies:changed', this.changeMovie.bind(this));
    subscriptions.on('movies:removed', this.remove.bind(this));
    this.listenTo(this, 'change:playback', this.changeCurrentlyPlaying);
    this.sortOrder = 'title';
  },

  changeCurrentlyPlaying: function(model, value, options){
    if (value === 'playing' || value === 'paused') {
      this.onTV = model;
      this.trigger('currentlyPlaying', model, value);
    } else {
      if (model == this.onTV) {
        this.onTV = null;
        this.trigger('notCurrentlyPlaying');
      }
    }
  },

  setMovies: function(movies){
    this.set(movies);
    var currentMovie = this.find(function(vid){
      return vid.get('playback');
    });
    if (currentMovie && currentMovie != this.onTV) {
      this.onTV = currentMovie;
      this.trigger('currentlyPlaying', currentMovie, currentMovie.get('playback'));
    }
  },

  comparator: function(movie){
    var title = (movie.get('title') && movie.get('title').toLowerCase());
    if (!title) {
      var file_name = (movie.get('file_name') && movie.get('file_name').toLowerCase());
    }
    return title || file_name;
  },

  addMovie: function(doc){
    this.add(doc);
  },

  /**
   * If the document is already in our collection, its
   * properties will get updated. It's effectively a merge.
   * @param  {object} doc
   */

  changeMovie: function(doc){
    this.add(doc, { merge : true });
    return this;
  }

});

module.exports = new Movies();
