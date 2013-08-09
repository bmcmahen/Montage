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
		.append(new MovieView(this.movie).render().$el);

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


/////////////////////////
// Movie Playback View //
/////////////////////////

function MovieView(movie){
	this.model = movie;
	this.$el = dom(require('./templates/playback.html'));
	this.playbackDevice = 'local';
	this.isPlaying = false;
}


MovieView.prototype.render = function(){
	reactive(this.$el.get(), this.model, this);
	return this;
};

MovieView.prototype.setPlaybackDevice = function(){
	var selected = this.$el.find('select').value();
	this.playbackDevice = selected;
	this.model.trigger('change:isLocal');
}

MovieView.prototype.rewind = function(e){
	e.preventDefault();
	if (this.playbackDevice === 'local'){
		if (!this.video) return;
		this.video.currentTime = this.video.currentTime - 30;
	} else {
		ddp.call('backwardVideo', this.model.toJSON(), function(err, res){
			console.log(err, res);
		});
	}
};

MovieView.prototype.image_url = function(){
	return '/movies/w342'+this.model.get('original_poster_path');;
};


MovieView.prototype.forward = function(e){
	e.preventDefault();
	if (this.playbackDevice === 'local'){
		if (!this.video) return;
		this.video.currentTime = this.video.currentTime + 30;
	} else {
		ddp.call('forwardVideo', this.model.toJSON(), function(err, res){
			console.log('froward result.')
		});
	}
	console.log('forward')
};

MovieView.prototype.isPlaying = function(){
	return this.isPlaying;
}

MovieView.prototype.isLocal = function(){
	return this.playbackDevice === 'local';
};

MovieView.prototype.playbackLocal = function(){
	if (!this.isPlaying){
		if (!this.video){
			var $video = dom('<video></video>');
			var src = this.model.get('torrent')
				? '/stream/'
				: '/videos/';

			$video.src(src + this.model.id);
			this.$el
				.find('#main-playback')
				.empty()
				.append($video);
			this.video = $video.get();
			this.videoEvents = events(this.video, this);
			this.videoEvents.bind('pause', 'onpause');
			this.videoEvents.bind('error', 'onpause');
			this.videoEvents.bind('ended', 'onpause');
		}
		this.isPlaying = true;
		this.model.trigger('change:isPlaying', true);
		this.video.play();
	} else {
		this.isPlaying = false;
		this.model.trigger('change:isPlaying', false);
		this.video.pause();
	}
};


MovieView.prototype.onpause = function(){
	this.isPlaying = false;
	this.model.trigger('change:isPlaying');
};

MovieView.prototype.toggleFullscreen = function(e){
	if (this.video) {
		if (this.video.webkitEnterFullscreen)
			this.video.webkitEnterFullscreen();
		else
			fullscreen(this.video);
	}
};

MovieView.prototype.play = function(e){
	e.preventDefault();

	if (this.playbackDevice === 'local') {
		return this.playbackLocal();
	}

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

MovieView.prototype.close = function(){
	this.$el.remove();
	if (this.videoEvents) this.videoEvents.unbind();
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

