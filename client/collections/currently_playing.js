var Model = require('backbone').Model;
var _ = require('underscore');
var ddp = require('../sockets').ddp;
var subscriptions = require('../sockets').subscriptions;

var CurrentlyPlaying = Model.extend({

	idAttribute: '_id',

	initialize: function(){
		subscriptions.on('currentlyPlaying', this.handleSubscription.bind(this));
		subscriptions.on('currentlyPlaying:changed', this.movieChanged.bind(this));
	},

	handleSubscription: function(doc){
		this.attributes = doc[0];
		this.trigger('change');
	},

	movieChanged: function(doc){
		this.attributes = doc;
		this.trigger('change');
	}
});

module.exports = new CurrentlyPlaying();