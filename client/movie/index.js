var Session = require('../session');
var ddp = require('../sockets').ddp;

var dom = require('dom');
var events = require('events');
var reactive = require('reactive');
var bind = require('event');
var loading = require('loading');
var EmitterManager = require('emitter-manager');
var onload = require('onload');
var fullscreen = require('fullscreen');
var Toggle = require('toggle');
var Slider = require('slider');

// Session.setDefault('playbackDevice', 'raspberrypi');


var Playback = require('./playback');

/////////////////////////
// Tab View for Movie  //
/////////////////////////

function TabView(movie, init){
	this.init = init || 'playView';
	this.movie = movie;
	this.$el = dom(require('./templates/container.html'));
	this.el = this.$el.get();
	this.$content = this.$el.find('.tab-content');
}

EmitterManager(TabView.prototype);

module.exports = TabView;

TabView.prototype.render = function(){
	this[this.init]();
	this.bind();
	return this;
};

// use once, use retry... maybe make a component for this.
TabView.prototype.renderImage = function(){

};

TabView.prototype.bind = function(){
	this.events = events(this.$el.get(), this);
	this.events.bind('click #tab-one', 'playView');
	this.events.bind('click #tab-two', 'metaView');
	this.events.bind('click #tab-three', 'subtitleView');
	this.events.bind('click .icon-close', 'onclose');
	this.listenTo(this.movie, 'change:original_backdrop_path', this.renderImage);
};

TabView.prototype.close = function(e){
	this.events.unbind();
	this.stopListening();
	this.$el.remove();
};

TabView.prototype.onclose = function(e){
	e.preventDefault();
	Session.set('selected_movie', null);
	Session.set('imageZoom', null);
	this.close();
};

TabView.prototype.setActive = function(target){
	if (this.$active) this.$active.removeClass('active');
	target.addClass('active');
	this.$active = target;
}

TabView.prototype.playView = function(e){
	if (e) e.preventDefault();
	this.setActive(this.$el.find('#tab-one'));
	this.$content
		.empty()
		.append(new Playback(this.movie).$el);
		console.log('play view render');
	var img = this.$content.find('img').get();
	if (img) onload(img);
};

TabView.prototype.metaView = function(e){
	e.preventDefault();
	this.setActive(this.$el.find('#tab-two'));
	this.$content
		.empty()
		.append(new EditMeta(this.movie).$el);
};

TabView.prototype.subtitleView = function(e){
	e.preventDefault();
	this.setActive(this.$el.find('#tab-three'));
	this.$content
		.empty()
		.append('subtitle view');
};


//////////////////////
// Edit Movie Meta  //
//////////////////////

function EditMeta(movie){
	this.model = movie;
	this.$el = dom(require('./templates/meta.html'));
	this.bind();
}

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

