// We need to create a view for each list_item, which will be generated
// from our drawer Schema. Each view will have a model. We will keep
// track of all models, and the 'selected' model, which will rerender
// the view appropriately.

var $ = require('jquery');
var Model = require('backbone').Model;
var View = require('backbone').View;
var Collection = require('backbone').Collection;
var _ = require('underscore');

var EmitterManager = require('emitter-manager');

var controller;

var session = require('session');
window.session = session;

var drawerSchema = [
{
	name : 'library',
	options: [
		{ label : 'Movies', icon: 'icon-camera', name: 'movies' }
	]
},
{
	name : 'settings',
	options: [
		{ label: 'Library Sources', icon: 'icon-drawer', name: 'sources' }
	]
}
];

////////////////////////////
// Drawer List-Item Model //
////////////////////////////

var ItemModel = Model.extend({

	defaults: {
		"active" : false,
		"type" : 'library'
	},

	select: function(){
		this.set('active', true);
	},

	deselect: function(){
		this.set('active', false);
	}

});

// This is so ugly. makes me want to transition away from backbone...

var DrawerItems = Collection.extend({

	model: ItemModel,

	initialize: function(){
		_.each(drawerSchema, function(cat){
			var type = cat.name;
			_.each(cat.options, function(item){
				this.add({
					name : item.name,
					icon : item.icon,
					type : type,
					label : item.label
				});
			}, this);
		}, this);
		this.highLight(session.get('primary_display'));
		this.listenTo(session, 'change:primary_display', this.highLight.bind(this));
	},

	selectItem: function(model){
		// if (this.itemSelected) this.itemSelected.deselect();
		// this.itemSelected = model;
		session.set('primary_display', model.get('name'));
	},

	highLight: function(val, previous){
		if (this.currentHightlight) this.currentHightlight.deselect();
		var toHightlight = this.findWhere({ name : val });
		this.currentHightlight = toHightlight;
		toHightlight.select();
	}

});

var DrawerView = View.extend({

	className: 'navigation-view',

	template: require('./templates/navigation'),

	initialize: function(attr){
		controller = attr.context;
		this.showing = false;
		this.activeItem = false;
	},

	render: function(){
		this.$el.html(this.template());
		var $library = this.$el.find('#library');
		var libraryItemEls = [];

		var $settings = this.$el.find('#settings');
		var settingItemEls = [];

		this.childViews = this.collection.map(function(model){
			var type = model.get('type');
			var view = new ItemView({ model : model });
			if (type === 'library') libraryItemEls.push(view.render().el);
			else if (type === 'settings') settingItemEls.push(view.render().el);
			return view;
		});

		$settings.html(settingItemEls);
		$library.html(libraryItemEls);
		return this;
	},

	closeView: function(){
		if (this.currentView) this.currentView.close();
	}
})



///////////////////////////
// Drawer List-Item View //
///////////////////////////

var ItemView = View.extend({

	tagName: 'li',

	events: {
		'click a' : 'selectView',
		'touchstart a' : 'ontouchstart',
		'touchend a' : 'ontouchend'
	},

	template: require('./templates/list_item'),

	initialize: function(){
		this.listenTo(this.model, 'change', this.render);
	},

	render: function(){
		this.$el.html(this.template(this.model.toJSON()));
		return this;
	},

	selectView: function(e){
		if (e) e.preventDefault();
		this.model.select();
		session.set('primary_display', this.model.get('name'));
		if (controller) controller.hide();
	},

	// these should only be bound if model is not active.
	ontouchstart: function(e){
		if (!this.model.get('active'))
			this.$el.find('a').addClass('active');
	},

	ontouchend: function(e){
		if (!this.model.get('active'))
			this.$el.find('a').removeClass('active');
	}

});

exports.DrawerView = DrawerView;
exports.DrawerItems = DrawerItems;

