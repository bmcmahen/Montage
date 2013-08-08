var ddp = require('sockets').ddp;
var dom = require('dom');
var events = require('events');
var loading = require('loading');

function AddNetwork(){
	this.$el = dom(require('./templates/network-source.html'));
}

module.exports = AddNetwork;

AddNetwork.prototype.render = function(){
	this.bind();
	return this;
};

AddNetwork.prototype.bind = function(){
	this.events = events(this.$el.get(), this);
	this.events.bind('submit form', 'addSource');
};

AddNetwork.prototype.close = function(){
	this.events.unbind();
	this.$el.remove();
};

AddNetwork.prototype.addSource = function(e){
	e.preventDefault();
	if (this.loader) this.loader.reset();
	this.loader = loading(this.$el.get());
	var network = this.$el.find('.current-dir');
	var val = network.value();
	var self = this;
	ddp.apply('addNetworkMount', [val, 'nfs'], function(err, res){;
		if (err) return self.loader.failure();
		var syncLoad = loading(dom('#spinner').get());
		self.loader.success();
		network.value('');
		ddp.call('syncLibrary', {}, function(err, res){
			syncLoad.finish();
		});
	});
};

