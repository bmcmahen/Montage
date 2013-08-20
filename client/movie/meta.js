var ddp = require('../sockets').ddp;
var dom = require('dom');
var events = require('events');
var bind = require('event');
var loading = require('loading');

//////////////////////
// Edit Movie Meta  //
//////////////////////

function EditMeta(movie){
  this.model = movie;
  this.$el = dom(require('./templates/meta.html'));
  this.$el.addClass('tab-item');
  this.bind();
}

module.exports = EditMeta;

EditMeta.prototype.bind = function(){
  this.events = events(this.$el.get(), this);
  this.events.bind('submit form', 'searchMovie');
}

EditMeta.prototype.close = function(){
  this.events.unbind();
  this.$el.remove();
}

EditMeta.prototype.renderResults = function(res){
  var results = res && res.results;
  var fragment = document.createDocumentFragment();
  this.results = results.map(function(movie){
    var view = SearchResult(this.model, movie);
    fragment.appendChild(view.$el.get());
    return view;
  }, this);
  this.$el
    .find('#search-results')
    .empty()
    .append(fragment);
};

EditMeta.prototype.searchMovie = function(e){
  e.preventDefault();
  if (this.results) {
    this.results.forEach(function(res){
      res.close();
    }, this);
  }
  var name = this.$el.find('input').val();
  var self = this;
  var loader = loading(this.$el.get());
  ddp.ready(function(){
    ddp.call('queryMeta', name, function(err, res){
      loader.finish();
      if (err) return console.log(err);
      self.renderResults(res);
    });
  });
};


///////////////////
// Search Result //
///////////////////

function SearchResult(model, json){

  var $el = dom(require('./templates/meta-search-result')(json));

  var selectThis = function(){
    var loader = loading($el.get());
    var m = model.toJSON();
    $el.addClass('active');
    delete m.isSelected;
    ddp.apply('updateMeta', [m, json.id], function(err, res){
      if (err) return loader.failure();
      return loader.success();
    });
  };

  bind.bind($el.get(), 'click', selectThis);

  return {
    $el: $el,
    close: function(){
      $el.remove();
      bind.unbind($el.get(), 'click', selectThis);
    }
  }
}