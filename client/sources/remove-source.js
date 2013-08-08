var dom = require('dom');
var events = require('events');
var EmitterManger = require('emitter-manager');
var _ = require('underscore');
var inherit = require('inherit');
var ddp = require('sockets').ddp;

var List = require('./listing');

/////////////////
// Add Source  //
/////////////////

function RemoveSourceView(){
	List.ListView.call(this, require('./templates/remove-source.html'));
	this.container('.browse-content');
	this.sources = require('../collections/sources');
	this.child(require('./templates/list-item-remove'));
	this.bind();
}

inherit(RemoveSourceView, List.ListView);
EmitterManger(RemoveSourceView.prototype);

module.exports = RemoveSourceView;

RemoveSourceView.prototype.render = function(){
	this.renderChildren(this.sources, RemoveListItem);
	return this;
};

RemoveSourceView.prototype.bind = function(){
	console.log(this.sources);
	this.listenTo(this.sources, 'add', this.render);
	this.listenTo(this.sources, 'remove', this.render);
};

RemoveSourceView.prototype.close = function(){
	this.stopListening();
	this.$el.remove();
};

RemoveSourceView.prototype.listItemSelected = function(itemModel){
	console.log('list item selected');
	// provide warning dialog asking if they really want to remove
	// the current item.
};

RemoveSourceView.prototype.removeItem = function(model){
	if (model.isNew()) return;
	var _id = model.get('_id');
	var self = this;
	ddp.call('removeSource', _id, function(err, res){
		self.sources.remove(model);
		ddp.apply('syncLibrary', [], function(err, res){
			console.log('library synced');
		});
	});
};




function RemoveListItem(context, model, template){
	this.context = context;
	this.model = model;
	this.$el = dom(template(model.toJSON()));
	this.bind();
}

RemoveListItem.prototype.bind = function(){
	this.events = events(this.$el.get(0), this);
	this.events.bind('click', 'deleteSource');
};

RemoveListItem.prototype.deleteSource = function(){
	this.context.removeItem(this.model);
};

RemoveListItem.prototype.close = function(){
	this.$el.remove();
	this.events.unbind();
}

