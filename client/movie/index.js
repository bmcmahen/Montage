var Session = require('../session');
var ddp = require('../sockets').ddp;
var domify = require('domify');
var Model = require('backbone').Model;
var $ = require('jquery');
var events = require('events');
var query = require('query');
var html = require('html');
var remove = require('remove');
var reactive = require('reactive');
var bind = require('event');
var loading = require('loading');
var EmitterManager = require('emitter-manager');
var onload = require('onload');

/////////////////////////////////
// Adapt Reactive to Backbone  //
/////////////////////////////////

reactive.get(function(obj, prop) {
  return obj.get(prop);
});

reactive.set(function(obj, prop, val) {
  obj.set(prop, val);
});

reactive.subscribe(function(obj, prop, fn){
  obj.bind('change:'+ prop, fn);
});

reactive.unsubscribe(function(obj, prop, fn){
  obj.unbind('change:'+ prop, fn);
});

/////////////////////////
// Tab View for Movie  //
/////////////////////////

function TabView(movie, init){
	this.init = init || 'playView';
	this.movie = movie;
	this.$el = domify(require('./templates/movie-view.html'));
	this.$content = query('.tab-content', this.$el);
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
	// var backdrop = this.movie.get('original_backdrop_path');
	// console.log('background', backdrop);
	// var background = query('#background-image', this.$el);
	// var url = '/movies/w1280'+ backdrop;

	// var defaultBackground = function(){
	// 	background.classList.add('noimage');
	// 	background.classList.add('fadeIn');
	// };


	// var tries = 0;
	// var tryImage = function(){
	// 	if (backdrop){
	// 		var img = document.createElement('img');
	// 		img.onload = function(){
	// 			console.log('load!', url);
	// 			background.style['background-image'] = 'url("'+ url +'")';
	// 			setTimeout(function(){
	// 				background.classList.add('fadeIn');
	// 			}, 0);
	// 		};
	// 		img.onerror = function(){
	// 			if (tries > 2) return defaultBackground();;
	// 			setTimeout(function(){
	// 				tryImage();
	// 				tries++;
	// 			}, 1000);
	// 			console.log('loading error...');
	// 		}
	// 		console.log('new source', url);
	// 		img.src = url;
	// 	} else {
	// 		defaultBackground();
	// 	}
	// }

	// tryImage();


};

TabView.prototype.bind = function(){
	this.events = events(this.$el, this);
	this.events.bind('click #tab-one', 'playView');
	this.events.bind('click #tab-two', 'metaView');
	this.events.bind('click #tab-three', 'subtitleView');
	this.events.bind('click .icon-close', 'onclose');
	this.listenTo(this.movie, 'change:original_backdrop_path', this.renderImage);
};

TabView.prototype.close = function(e){
	this.events.unbind();
	this.stopListening();
	remove(this.$el);
};

TabView.prototype.onclose = function(e){
	e.preventDefault();
	Session.set('selected_movie', null);
	Session.set('imageZoom', null);
	this.close();
};

TabView.prototype.setActive = function(target){
	if (this.$active) this.$active.classList.remove('active');
	target.classList.add('active');
	this.$active = target;
}

TabView.prototype.playView = function(e){
	if (e) e.preventDefault();
	this.setActive(query('#tab-one', this.$el));
	html(this.$content, new MovieView(this.movie).render().$el);
	var img = this.$content.querySelector('img');
	if (img) onload(img);
};

TabView.prototype.metaView = function(e){
	e.preventDefault();
	this.setActive(query('#tab-two', this.$el));
	html(this.$content, new EditMeta(this.movie).$el);
};

TabView.prototype.subtitleView = function(e){
	e.preventDefault();
	this.setActive(query('#tab-three', this.$el));
	html(this.$content, 'subtitle view');
};


/////////////////////////
// Movie Playback View //
/////////////////////////

function MovieView(movie){
	this.model = movie;
	this.$el = domify(require('./templates/movie.html'));
}


MovieView.prototype.render = function(){
	reactive(this.$el, this.model, this);
	return this;
};

MovieView.prototype.rewind = function(e){
	e.preventDefault();
	console.log('rewind');
	ddp.call('backwardVideo', this.model.toJSON(), function(err, res){
		console.log(err, res);
	});
};

MovieView.prototype.image_url = function(){
	return '/movies/w342'+this.model.get('original_poster_path');;
};


MovieView.prototype.forward = function(e){
	e.preventDefault();
	ddp.call('forwardVideo', this.model.toJSON(), function(err, res){
		console.log('froward result.')
	});
	console.log('forward')
};



MovieView.prototype.play = function(e){
	e.preventDefault();

	if (this.model.get('isPlaying')) {
		ddp.call('pauseVideo', this.model.toJSON(), function(err, res){
      console.log('pause video');
    });
		this.model.set('isPlaying', false);
		Session.set('current_playback', null);
	} else {
		ddp.call('playVideo', this.model.toJSON(), function(err, res){
			console.log('play video');
		});
		this.model.set('isPlaying', true);
		Session.set('current_playback', this.model);
	}
};

//////////////////////
// Edit Movie Meta  //
//////////////////////

function EditMeta(movie){
	this.model = movie;
	this.$el = domify(require('./templates/edit-meta.html'));
	this.bind();
}

EditMeta.prototype.bind = function(){
	this.events = events(this.$el, this);
	this.events.bind('submit form', 'searchMovie');
}

EditMeta.prototype.close = function(){
	this.events.unbind();
	remove(this.$el);
}

EditMeta.prototype.renderResults = function(res){
	var results = res && res.results;
	var fragment = document.createDocumentFragment();
	this.results = results.map(function(movie){
		var view = SearchResult(this.model, movie);
		fragment.appendChild(view.$el);
		return view;
	}, this);
	var searchContainer = query('#search-results', this.$el);
	html(searchContainer, fragment);
};

EditMeta.prototype.searchMovie = function(e){
	e.preventDefault();
	if (this.results) {
		this.results.forEach(function(res){
			res.close();
		}, this);
	}
	var name = query('input', this.$el).value;
	var self = this;
	var loader = loading(this.$el);
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

	var $el = domify(require('./templates/meta-search-result')(json));

  var selectThis = function(){
  	var loader = loading($el);
  	var m = model.toJSON();
  	$el.classList.add('active');
  	delete m.isSelected;
  	ddp.apply('updateMeta', [m, json.id], function(err, res){
  		if (err) return loader.failure();
  		return loader.success();
  	});
  };

  bind.bind($el, 'click', selectThis);

  return {
    $el: $el,
    close: function(){
    	remove($el);
      bind.unbind($el, 'click', selectThis);
    }
  }
}

