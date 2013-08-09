var Emitter = require('emitter');
var DDP = require('ddp-browser-client');

// Create our Socket Connection
var ws = new WebSocket('ws://'+ location.host);

// Create our DDP Connection
var ddp = new DDP(ws).connect();

function Subscriptions(){
	var self = this;

	ddp.on('data', function(data){
		self.emit(data.collection, data.fields);
	});

	ddp.on('added', function(data){
		self.emit(data.collection + ':added', data.fields);
	});

	ddp.on('changed', function(data){
		self.emit(data.collection + ':changed', data.fields);
	});

	ddp.on('removed', function(data){
		self.emit(data.collection + ':removed', data.fields);
	});
}

Emitter(Subscriptions.prototype);

ddp.on('connected', function(){
	ddp.subscribe('movies');
	ddp.subscribe('sources');
	ddp.isReady = true;
});

ddp.ready = function(fn){
	if (ddp.isReady) return fn(true);
	ddp.on('connected', function(){
		return fn(true);
	});
}

exports.subscriptions = new Subscriptions();
exports.ddp = ddp;