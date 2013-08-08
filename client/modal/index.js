var Backbone = require('backbone');
var $ = require('jquery');
var ddp = require('../sockets').ddp;
var Session = require('session');
var Sources = require('../collections/sources');
var _ = require('underscore');

// XXX we should have multiple Views that extend one Modal view,
// and then we should have a controller that controls which modal
// view we should use (torrent, network, etc...);

var ModalView = Backbone.View.extend({

	el : $('#detail-modal'),

	initialize: function(){
		this.$overlay = $('#md-overlay');
	},

	events : {
		'click .md-close' : 'hide',
		'click .md-download' : 'download',
		'click .add-source': 'addNetwork'
	},

	render: function(type, model){
		if (type === 'torrent') {
			this.template = require('./templates/torrent');
			this.model = model;
			var json = this.model.toJSON();
			_.extend(json, { sources : Sources.toJSON() });
			this.$el.html(this.template(json));
		} else if (type === 'network') {
			this.template = require('./templates/network');
			this.$el.html(this.template());
		}
		return this;
	},

	show: function(){
		var self = this;
		setTimeout(function(){
			self.$el.addClass('md-show');
		}, 0);
		this.$overlay.addClass('in');
	},

	hide: function(e){
		if (e) e.preventDefault();
		this.$el.removeClass('md-show');
		this.$overlay.removeClass('in');
	},

	download: function(e){
		if (e) e.preventDefault();
		this.hide();
		// xxx this is shitty, should probablys store _id, and retrieve
		// it from the database on the server-side.

		var path = this.$el
			.find('select')
			.find(':selected')
			.text();

		ddp.apply('downloadTorrent',[this.model.toJSON(), path], function(err, res){
			console.log(err, res);
		});
		Session.set('main', 'movies');
	},

	addNetwork: function(e){
		e.preventDefault();
		var path = this.$el.find('.network-path').val();
		ddp.apply('addNetworkMount', [path, 'nfs'], function(err, res){
			console.log('NETWORK DONE', err, res);
			// resync our db?
		});
	}
});

module.exports = new ModalView();