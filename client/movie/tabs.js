var Tabs = require('tabs');
var Session = require('../session');
var dom = require('dom');
var events = require('events');
var onload = require('onload');

var Playback = require('./playback');
var EditMeta = require('./meta');

/**
 * Movie-View Tab Controller
 * @param {Model} movie
 * @param {Number} init  with tab index
 */

function TabView(movie, init){
	this.$el = dom(require('./templates/container.html'));
	this.movie = movie;

	var playback = new Playback(movie);
	var meta = new EditMeta(movie);

	this.tabs = new Tabs()
		.add('Playback', playback.$el.get())
		.add('Edit Metadata', meta.$el.get())
		.show(init || 0);

	this.$el
		.find('.tab-wrapper')
		.append(this.tabs.el);

	this.$el
		.find('.tab-content')
		.append(this.tabs.content);

	this.$el.find('img').forEach(function(img){
		onload(img);
	});

	this.bind();
}

module.exports = TabView;

TabView.prototype.bind = function(){
	this.events = events(this.$el.get(), this);
	this.events.bind('click .icon-close', 'onclose');
};

TabView.prototype.onclose = function(e){
	e.preventDefault();
	Session.set('selected_movie', null);
};