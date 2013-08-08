var $ = require('jquery');
var _ = require('underscore');

var Backbone = require('backbone');
var View = Backbone.View;
var Model = Backbone.Model;
var Collection = Backbone.Collection;

var loading = require('../loading');

var ddp = require('../sockets').ddp;
var selectionCol;

var Sources = View.extend({

	template : require('./templates/library_source'),

	className: 'library-sources',

	initialize: function(){
		this.currentClass = 'add-tab';
	},

	events: {
		'click a.add-source' : 'addSource',
		'click a.remove-source' : 'removeSource',
		'click a.network-location' : 'networkLocation',
		'click a.browse' : 'browse',
		'click a.network' : 'network',
		'click a.back' : 'back'
	},

	render: function(){
		this.$el.html(this.template);
		this.$el.addClass(this.currentClass);
		this.browse();
		return this;
	},

	close: function(){
		this.remove();
	},

	addSource: function(e){
		e.preventDefault();
		this.toggleClass('add-tab');
	},

	removeSource: function(e){
		e.preventDefault();
		this.toggleClass('remove-tab');
	},

	networkLocation: function(e){
		e.preventDefault();
		var Modal = require('../modal');
		Modal.render('network').show();
		// this.toggleClass('network-tab');
	},

	toggleClass: function(name){
		this.$el.removeClass(this.currentClass);
		this.$el.addClass(name);
		this.currentClass = name;
	},

	browse: function(e){
		if (e) e.preventDefault();
		var self = this;

		// browse code
		this.collection = new FileCollection();
		this.collection.on('sourceAdded', function(){
			self.hide();
		});

		this.browseView = new BrowseView({
			collection: this.collection
		});

		// show currently selected
		this.selectionCol = selectionCol = new SelectCollection();
		this.selectionCol.update();
		this.selectionView = new SelectView({
			collection: this.selectionCol
		});

		this.$el
			.find('#selected-sources')
			.find('.browse-content')
			.html(this.selectionView.render().$el);

		this.$el
			.find('#files')
			.find('.browse-content')
			.html(this.browseView.render().$el);

		this.collection.update();

	},


	network : function(){
		// network code
		console.log('NETWORK');

		console.log('network');
	},

	back : function(e){
		console.log('back', e);
		e.preventDefault();
		this.collection
			.removeDir()
			.update();
		return false;
	}
});

module.exports = Sources;

var FileModel = Model.extend({

	navigateTo: function(){
		var name = this.get('name');
		this.collection
			.addDir(name + '/')
			.update();
	},

	selectDir: function(){
		var name = this.get('name');
		var pwd = this.collection
			.getPath(name + '/');
		selectionCol.add({ path : pwd });
	}
});

var FileCollection = Collection.extend({

	initialize: function(){
		this.dirs = ['/', 'Users/'];
	},

	model : FileModel,

	update : function(){
		var self = this;
		var dir = this.toString();
		ddp.ready(function(){
			ddp.apply('browse', [dir], function(err, res){
				if (err) return; // do something w/ error
				else self.reset(res);
			});
		});
	},

	toString: function(){
		return this.dirs.join('');
	},

	addToDatabase: function(){
		var dir = this.toString();
		var self = this;
		ddp.apply('addSource', [dir], function(err, res){
			if (err) return; // xxx do something
			else self.trigger('sourceAdded');
		})
	},

	addDir: function(dir){
		this.dirs.push(dir);
		return this;
	},

	removeDir: function(){
		if (this.dirs.length < 2) return this;
		this.dirs.pop();
		return this;
	},

	getPath: function(name){
		var dirs = _.clone(this.dirs);
		dirs.push(name);
		return dirs.join('');
	}

});



var FileView = View.extend({

	tagName: 'li',

	className: 'clearfix list-group-item',

	template : require('./templates/browse_file'),

	events : {
		'click .folder' : 'navigateTo',
		'click .file' : 'onFileClick',
		'click .select' : 'selectDir'
	},

	render: function(){
		this.$el.html(this.template(this.model.toJSON()));
		return this;
	},

	navigateTo: function(e){
		e.preventDefault();
		this.model.navigateTo();
	},

	selectDir: function(e){
		e.preventDefault();
		e.stopPropagation();
		this.model.selectDir();
	},

	onFileClick: function(e){
		e.preventDefault();
	}

});



var BrowseView = View.extend({

	tagName: 'ul',

	className: 'browse-view list-group',

	initialize: function(){
		this.listenTo(this.collection, 'reset', this.render);
	},

	render: function(){
		var els = [];

		var types = this.collection
			.chain()
			.sortBy(function(m){
				return m.get('name').toLowerCase();
			})
			.groupBy(function(m){
				return m.get('type');
			})
			.value();

		this.children = [];

		var self = this;

		var makeView = function(model){
			var view = new FileView({ model : model });
			els.push(view.render().$el);
			self.children.push(view);
		};

		_.each(types.directory, makeView);
		_.each(types.file, makeView);

		this.$el.html(els);
		return this;
	},

	close : function(){
		_.each(this.children, function(child){
			child.remove();
		});
		this.children = [];
		this.remove();
	}

});




var SelectModel = Model.extend({

	idAttribute: '_id',

	removeItem : function(){
		this.collection.remove(this);
	}
});


var SelectCollection = Collection.extend({

	model : SelectModel,

	initialize: function(){
		this.on('add', this.syncAdd);
		this.on('remove', this.syncRemove);
	},

	update: function(){
		var self = this;
		ddp.ready(function(){
			ddp.apply('getSources', [], function(err, res){
				if (!err) self.reset(res);
			});
		});
	},

	syncRemove: function(model){
		if (model.isNew()) return;
		var _id = model.get('_id');
		loading.show();
		ddp.apply('removeSource', [_id], function(err, res){
			ddp.apply('syncLibrary', [], function(err, res){
				loading.hide();
			});
		});
	},

	syncAdd: function(model){
		var path = model.get('path');
		loading.show();
		ddp.apply('addSource', [path], function(err, res){
			console.log('RES', res);
			model.set(res);
			ddp.apply('syncLibrary', [], function(err, res){
				loading.hide();
			});
		});
	}

});


var SelectView = BrowseView.extend({

	initialize: function(){
		this.listenTo(this.collection, 'reset', this.render);
		this.listenTo(this.collection, 'add', this.render);
		this.listenTo(this.collection, 'remove', this.render);
	},

	render: function(){
		var els = [];
		this.children = this.collection.map(function(model){
			var view = new SelectItemView({ model : model });
			els.push(view.render().el);
			return view;
		});
		this.$el.html(els);
		return this;
	}
});

var SelectItemView = View.extend({
	tagName: 'li',

	className: 'source-item',

	events: {
		'click .select' : 'removeItem'
	},

	template: require('./templates/source_item'),

	render: function(){
		this.$el.html(this.template(this.model.toJSON()));
		return this;
	},

	removeItem: function(e){
		e.preventDefault();
		e.stopPropagation();
		this.model.removeItem();
	}

});

var SelectItems = Collection.extend({

});
