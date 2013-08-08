var View = require('backbone').View;
var _ = require('underscore');
var $ = require('jquery');
var onload = require('onload');
var translate = require('translate');
var Orientation = require('orientation-listener');

var Session = require('../collections/session_variables');
var movieCollection = require('../collections/movies');

var forceReflow = function(elem){
  elem = elem || document.documentElement;

  // force a reflow by increasing size 1px
  var width = elem.style.width,
      px = elem.offsetWidth+1;

  elem.style.width = px+'px';

  setTimeout(function(){
      // undo resize, unfortunately forces another reflow
      elem.style.width = width;
      elem = null;
  }, 0);
};

// Movies View
var MoviesView = View.extend({

  className: 'library clearfix',

  initialize: function(collection){
    if (!collection) throw new Error('Movies view requires a Collection.');
    this.collection = collection;
    // this.listenTo(this.collection, 'add', this.addView);
    // this.listenTo(this.collection, 'remove', this.removeView);
    // this.listenTo(this.collection, 'reset', this.render);
    // console.log('INIT ME');
    this.listenTo(this.collection, 'totalHeight', this.setHeight);
    this.listenTo(this.collection, 'render', this.renderModel);
    window.addEventListener('orientationchange', this.alterPositions.bind(this), false);

    // iOS has a weird window resizing bug. It gets (randomly?) triggered
    // at strange moments, notably when scrolling our overflowing container
    // element. This causes some weird freezing issues. Instead, with iOS we
    // listen for orientation change, since this is the only time when resizing
    // will need to be triggered.

    if (!Session.get('ios')){
      this.relayout = _.debounce(_.bind(this.alterPositions, this), 300);
      $(window).on('resize', this.relayout);
    }

    this.children = [];
  },

  renderModel: function(model){
    var view = new MovieView({ model : model }).render();
    view.setPosition();
    this.$el.append(view.$el);
  },

  render: function(){
    var els = [];
    // this.children = this.collection.map(function(model){
    //   var view = new MovieView({ model: model });
    //   els.push(view.render().$el);
    //   return view;
    // });
    // this.alterPositions();
    //
    console.log('hello world?', this.collection);
    var scrollTop = $('#body').scrollTop();
    this.collection.efficientGeneratePositions(scrollTop);
    this.$el.html(els);
    return this;
  },

  alterPositions: function(render){
    this.collection.generatePositions();
    if (render) {
      _.each(this.children, function(view){
        view.setPosition();
      });
    }
    // force reflow to avoid weird horizontal scrollbar bug.
    // i'm using a crazy reflow function i found on stackoverflow
    // http://stackoverflow.com/questions/11297641/mobile-webkit-reflow-issue
    setTimeout(forceReflow, 600);
  },

  setHeight: function(height){
    console.log('set height', height);
    this.$el.height(height);
  },

  addView: function(model){
    var view = new MovieView({ model: model });
    this.children.push(view);
    this.alterPositions();
    this.$el.append(view.render().$el);
    return this;
  },

  removeView: function(model){
    this.children = _.reject(this.children, function(view){
      if (model.id === view.model.id) {
        view.remove();
        return true;
      }
    });
    this.alterPositions();
  },

  close: function(){
    _.each(this.children, function(child){
      child.remove();
    });
    this.children = [];
    this.remove();
    $(window).off();
  }

});

////////////////////////////
// Individual Movie View  //
////////////////////////////

var MovieView = View.extend({

  initialize: function(){
    this.listenTo(this.model, 'layoutPosition', this.setPosition);
    this.listenTo(this.model, 'change:selected', this.toggleSelected);
    this.listenTo(this.model, 'remove', this.removeView);
    if (this.model.get('type') === 'torrent'){
      this.isTorrent = true;
      this.listenTo(this.model, 'change:progress', this.showProgress);
      this.listenTo(this.model, 'change:finished', this.finishDownload);
    }
    this.listenTo(this.model, 'change:title', this.render);
  },

  events: {
    'tap': 'movieDetail',
    'hold img': 'editMovie'
  },

  className: 'movie-thumb preload',

  template: require('./templates/movie'),

  removeView: function(){
    this.remove();
  },

  render: function(){
    var self = this;

    this.$el
      .html(this.template(this.model.toJSON()))
      .hammer();

    if (this.model.get('poster_path')){
      // this.$el.find('img').on('load error', function(){
        self.$el.removeClass('preload');
      // });
    } else {
      this.$el
        .removeClass('preload')
        .addClass('missing-image');
    }

    if (this.isTorrent) {
      this.$progress = $('<div></div>').appendTo(this.$el);
    }

    return this;
  },

  showProgress: function(model, progress){
    console.log(progress);
    this.$progress.text(progress);
  },

  finishDownload: function(){
    // download is finished.
    this.$progress.remove();
  },

  toggleSelected: function(){
    this.$el.toggleClass('selected');
  },

  setPosition: function(){
    if (!this.model.left) movieCollection.generatePositions();
    var el = this.$el[0];
    translate(el, this.model.left, this.model.top);
    this.$el
      .width(this.model.width)
      .height(this.model.height);
  },

  movieDetail: function(){
    Session.set('selected_movie', this.model);
  },

  editMovie: function(e){
    if (e) e.preventDefault();
    this.$el.addClass('edit');
  },

  playMovie: function(e){
    e.preventDefault();
    this.model.playMovie();
  }

});


var SortView = View.extend({

  template: require('./templates/sort'),

  className: 'sort-wrapper',

  events: {
    'change #sort' : 'sort'
  },

  sort: function(e){
    var select = e.currentTarget;
    var val = select.options[select.selectedIndex].value;
    movieCollection.sortOrder = val;
    movieCollection.sort();
    movieCollection.generatePositions();
    setTimeout(forceReflow, 600);
  },

  render: function(){
    this.$el.html(this.template());
    return this;
  }
});

exports.MovieView = MovieView;
exports.MoviesView = MoviesView;
exports.SortView = SortView;

