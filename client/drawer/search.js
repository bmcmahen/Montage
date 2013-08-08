var View = require('backbone').View;
var _ = require('underscore');
var $ = require('jquery');
var ddp = require('../sockets').ddp;

var movies = require('../collections/movies');
var TorrentModel = require('backbone').Model;
var Session = require('session');



var SearchView = View.extend({

  className: 'search-view',

  render: function(){
    if (this.children) this.removeChildren();
    this.children = [];
    this.children.push(new LocalResults());
    this.children.push(new TorrentResults());
    _.each(this.children, function(child){
      this.$el.append(child.el);
    }, this);
    return this;
  },

  query: function(query){
    this.render();
    _.each(this.children, function(view){
      view.query(query);
    });
  },

  removeChildren: function(){
    _.each(this.children, function(child){
      child.remove();
    });
  }

});

var LocalResults = SearchView.extend({

  className: 'local-results',

  template: require('./templates/local_results'),

  query: function(query){
    // Query our local files
    var re = new RegExp(query, 'i');
    this.results = movies.filter(function(mov){
      var title = mov.get('title');
      if (!title) return false;
      if (title.search(re) >= 0) return true;
    });
    this.render();
  },

  render: function(){
    this.$el.html(this.template());
    var els = [];
    if (this.children) this.removeChildren();
    this.children = this.results.map(function(res){
      var view = new SearchItem({ model : res });
      els.push(view.render().el);
      return view;
    });
    this.$el.append(els);
  }

});

var TorrentResults = SearchView.extend({

  className: 'torrent-results',

  template: require('./templates/torrent_results'),

  initialize: function(){
    this.loading = true;
  },

  query: function(query){
    // Query our database
    var self = this;
    this.loading = true;
    this.render();
    ddp.apply('search', [query], function(err, res){
      self.loading = false;
      if (err) console.log('error', err);
      else {
        self.results = _.map(res, function(r){
          return new TorrentModel(r);
        });
      }
      self.render();
    });
  },

  render: function(){
    var els = [];
    if (this.children) this.removeChildren();
    this.$el.html(this.template({ loading: this.loading }));
    if (this.loading) return;
    this.children = this.results.map(function(res){
      var view = new TorrentItem({ model : res });
      els.push(view.render().el);
      return view;
    });
    this.$el.append(els);
  }

});


var SearchItem = View.extend({

  tagName: 'li',

  events: {
    'click a' : 'select'
  },

  initialize: function(){
    this.listenTo(this.model, 'change:selected', this.render);
  },

  template : require('./templates/search_result'),

  render: function(){
    this.$el.html(this.template(this.model.toJSON()));
    this.$el.find('.thumb').css({
      'background-image' : 'url("/movies/w45/'+ this.model.get('original_poster_path')+'")'
    });
    return this;
  },

  select: function(){
    var drawer = require('.');
    Session.set('selected_movie', this.model);
    drawer.toggle();
  }
});


var Modal = require('../modal');

var TorrentItem = SearchItem.extend({

  template : require('./templates/torrent_result'),

  events: {
    'click a.torrent' : 'selectTorrent'
  },

  render: function(){
    this.$el.html(this.template(this.model.toJSON()));
    return this;
  },

  selectTorrent: function(e){
    e.preventDefault();
    console.log(this.model);
    Modal.render('torrent', this.model).show();
  }

});

exports.SearchView = SearchView;