var Model = require('backbone').Model;
var _ = require('underscore');
var ddp = require('../sockets').ddp;
var subscriptions = require('../sockets').subscriptions;
var Collection = require('backbone').Collection;
var $ = require('jquery');
var loading = require('../loading');

var Source = Model.extend({
	idAttribute: '_id'
});

exports.Model = Source;

var Sources = Collection.extend({

	model: Source,

	initialize: function(){
		subscriptions.on('sources', this.set.bind(this));
    subscriptions.on('sources:added', this.add.bind(this));
    subscriptions.on('sources:changed', this.changeSource.bind(this));
    subscriptions.on('sources:removed', this.remove.bind(this));
	},

	changeSource: function(doc){
		this.add(doc, { merge : true });
		return this;
	}
});

module.exports = new Sources();