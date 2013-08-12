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

Session.setDefault('playbackDevice', 'raspberrypi');

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

reactive.bind('disable-if', function(el, name){
	var $el = dom(el);
	this.change(function(){
		if (this.value(name)) $el.addClass('disabled');
		else $el.removeClass('disabled');
	});
});

/////////////////////////
// Tab View for Movie  //
/////////////////////////

function TabView(movie, init){
	this.init = init || 'playView';
	console.log('MOVIE', movie.toJSON());
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
	this.playbackDevice = Session.get('playbackDevice');
	console.log(this.playbackDevice);
	if (this.playbackDevice === 'raspberrypi') {
		if (this.model.get('playback') === 'playing') {
			console.log('IS PLAYING');
			this.isPlaying = true;
		} else {
			console.log('IS PAUSED');
			this.isPlaying = false;
		}
	}
	this.hasStarted = false;
}

EmitterManager(MovieView.prototype);


MovieView.prototype.render = function(){
	reactive(this.$el.get(), this.model, this);
	var toggleEl = this.$el.find('.toggle').get();
	var toggled = (this.playbackDevice === 'raspberrypi')
		? true : false;
	this.toggle = new Toggle(null, toggleEl);
	this.toggle.value(toggled);

	var volEl = this.$el.find('.volume').get();
	this.volume = new Slider(null, volEl)
		.range(0, 10)
		.step(1);


	var volume = (this.playbackDevice === 'raspberrypi')
		? Session.get('tvVolume')
		: Session.get('volume');
	this.volume.setValue(volume || 0);
	this.bind();
	return this;
};

MovieView.prototype.oncontrolclick = function(e){
	e.stopPropagation();
	e.preventDefault();
};

MovieView.prototype.bind = function(){
	this.listenTo(this.toggle, 'change', this.togglePlayback);
	this.listenTo(this.volume, 'change:value', this.changeVolume);
};

MovieView.prototype.togglePlayback = function(val){
	// on = raspberrypi
	// off = currentDevice
	this.playbackDevice = val ? 'raspberrypi' : 'local';
	Session.set('playbackDevice', this.playbackDevice);
	this.model.trigger('change:isPi');
	if (this.video && this.playbackDevice === 'raspberrypi') {
		this.currentTime = this.video.currentTime;
		this.video.pause();
		this.play();
	}
}

MovieView.prototype.rewind = function(e){
	e.preventDefault();
	e.stopPropagation();
	if (this.playbackDevice !== 'raspberrypi'){
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

MovieView.prototype.changeVolume = function(val, prev){
	if (this.playbackDevice === 'raspberrypi') {
		Session.set('tvVolume', val);
		if (val > prev) this.volumeUp();
		else this.volumeDown();
	} else {
		Session.set('volume', val);
		this.video.volume = (val / 10);
	}
};

MovieView.prototype.volumeUp = function(e){
	ddp.call('volumeUp', function(err){
		if (err) console.log(err);
	});
};

MovieView.prototype.volumeDown = function(e){
	ddp.call('volumeDown', function(err){
		if (err) console.log(err);
	});
};

MovieView.prototype.toggleSubtitles = function(){
	ddp.call('toggleSubtitles', function(err){
		if (err) console.log(err);
	});
};


MovieView.prototype.forward = function(e){
	e.preventDefault();
	e.stopPropagation();
	if (this.playbackDevice === 'local'){
		if (!this.video) return;
		this.video.currentTime = this.video.currentTime + 30;
	} else {
		ddp.call('forwardVideo', this.model.toJSON(), function(err, res){
			console.log('froward result.')
		});
	}
};

MovieView.prototype.isPlaying = function(){
	return this.isPlaying;
};

MovieView.prototype.started = function(){
	return this.hasStarted;
};

MovieView.prototype.isPi = function(){
	return (this.playbackDevice === 'raspberrypi');
};

MovieView.prototype.isLocalAndStarted = function(){
	return (!this.isPi() && this.started());
}

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
				.addClass('video')
				.append($video);
			this.video = $video.get();
			this.videoEvents = events(this.video, this);
			this.videoEvents.bind('pause', 'onpause');
			this.videoEvents.bind('error', 'onpause');
			this.videoEvents.bind('ended', 'onpause');
		}
		this.isPlaying = true;
		this.model.trigger('change:isPlaying', true);
		dom('.zoom-background').addClass('fade');
		this.video.play();
		this.video.volume = Session.get('volume') / 10;
		this.tempEvents = events(document, this);
		this.tempEvents.bind('click', 'playbackLocal');
	} else {
		this.isPlaying = false;
		this.model.trigger('change:isPlaying', false);
		this.tempEvents.unbind();
		this.video.pause();
	}
};

MovieView.prototype.notPlaying = function(){
	return !this.isPlaying;
};

MovieView.prototype.onpause = function(){
	if (this.playbackDevice !== 'raspberrypi'){
		this.isPlaying = false;
		this.model.trigger('change:isPlaying');
		dom('.zoom-background').removeClass('fade');
	}
};

MovieView.prototype.toggleFullscreen = function(e){
	e.stopPropagation();
	if (this.video) {
		if (this.video.webkitEnterFullscreen)
			this.video.webkitEnterFullscreen();
		else
			fullscreen(this.video);
	}
};

MovieView.prototype.play = function(e){
	if (e) e.preventDefault();
	if (e) e.stopPropagation();

	if (this.playbackDevice !== 'raspberrypi') {
		return this.playbackLocal();
	}

	if (this.isPlaying) {
		ddp.call('pauseVideo', this.model.toJSON(), function(err, res){
      console.log('pause video', err);
    });
    this.isPlaying = false;
    this.model.set('playback', 'paused');
    this.model.trigger('change:isPlaying');
	} else {
		var options = {};
		options.currentTime = this.currentTime || 0;
		options.volume = Session.get('tvVolume');
		ddp.apply('playVideo', [this.model.toJSON(), options], function(err, res){
			console.log('play video');
		});
		this.isPlaying = true;
		this.model.set('playback', 'playing');
		this.model.trigger('change:isPlaying');
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

