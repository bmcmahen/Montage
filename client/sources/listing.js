var dom = require('dom');
var events = require('events');
var loading = require('loading');
var Emitter = require('emitter');
var EmitterManger = require('emitter-manager');
var _ = require('underscore');

///////////////////////////
// Generic Listing Class //
///////////////////////////

// var listView = new ListView(require('./template/bacon'))
// 	.container('.list-content')
// 	.child(require('./template/child_bacon'))
// 	.render()
// 	.$el;

function ListView(template){
	this.$el = dom(template);
	this.initialize.apply(this, arguments);
};

exports.ListView = ListView;

ListView.prototype.initialize = function(){
 // generic intiialize function gets called when new model
 // is instantiated. basically a constructor.
};

ListView.prototype.container = function(selector){
	this.$container = this.$el.find(selector);
	return this;
};

ListView.prototype.child = function(temp){
	this.childTemplate = temp;
	return this;
}

// make this accept child view.
ListView.prototype.renderChildren = function(arr, ChildClass){
	ChildClass = ChildClass || ListItem;
	if (this.children) {
		this.children.forEach(function(child){
			child.close();
		});
	}
	var fragment = document.createDocumentFragment();
	this.children = arr.map(function(model){
		var view = new ChildClass(this, model, this.childTemplate);
		fragment.appendChild(view.$el.get());
		return view;
	}, this);

	this.$container.empty().append(fragment);
};

///////////////
// List Item //
///////////////

function ListItem(context, model, template){
	var context = context;
	var model = model;
	var $el = dom(template(model));
	var $link = $el.find('a');

	var handleClick = function(e){
		loading($el.get(0));
		if (context.listItemSelected) context.listItemSelected(model);
	}

	$link.on('click', handleClick);

	return {
		$el : $el,
		close: function(){
			$el.remove();
			$el.off();
		}
	}
}

exports.ListItemView = ListItem;