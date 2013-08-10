var dom = require('dom');
var events = require('events');
var loading = require('loading');
var Emitter = require('emitter');
var EmitterManager = require('emitter-manager');
var _ = require('underscore');
var inherit = require('inherit');
var ddp = require('sockets').ddp;

var ListView = require('./listing').ListView;
var ListItem = require('./listing').ListItemView;

/////////////////
// Add Source  //
/////////////////

function AddSourceView(){
	ListView.call(this, require('./templates/add-source.html'));
	this.container('.browse-content');
	this.$form = this.$el.find('form');
	this.child(require('./templates/list-item'));
	this.currentDirectory = new CurrentDirectory();
}

inherit(AddSourceView, ListView);
EmitterManager(AddSourceView.prototype);

module.exports = AddSourceView;

AddSourceView.prototype.render = function() {
	this.bind();
	this.currentDirectory.update();
	return this;
};

AddSourceView.prototype.close = function(){
	this.$el.remove();
	this.events.unbind();
	this.stopListening();
}

AddSourceView.prototype.bind = function(){
	this.events = events(this.$el.get(0), this);
	this.events.bind('submit #add-directory', 'addSource');
	this.events.bind('click a.browse', 'browse');
	this.events.bind('click .back', 'back');
	this.listenTo(this.currentDirectory, 'directoryListing', this.renderChildren);
	this.listenTo(this.currentDirectory, 'currentDirectory', this.updateForm);
};

AddSourceView.prototype.updateForm = function(){
	if (this.loading){
		this.loading.finish();
		delete this.loading;
	}
	this.$form.find('.current-dir').value(this.currentDirectory.toString());
};

AddSourceView.prototype.listItemSelected = function(itemModel){
	this.currentDirectory.addDir(itemModel).update();
};

AddSourceView.prototype.back = function(e){
	e.preventDefault();
	this.loading = loading(this.$container.get());
	this.currentDirectory.removeDir().update();
};

AddSourceView.prototype.renderChildren = function(arr){
	if (this.children) {
		this.children.forEach(function(child){
			child.close();
		});
	}

	var fragment = document.createDocumentFragment();

	// directories
	if (arr.directory){
		this.children = arr.directory.map(function(model){
			var view = new ListItem(this, model, this.childTemplate);
			fragment.appendChild(view.$el.get());
			return view;
		}, this);
	}

	// then files
	if (arr.file){
		arr.file.forEach(function(model){
			var view = new ListItem(this, model, this.childTemplate);
			this.children.push(view);
			fragment.appendChild(view.$el.get());
			return view;
		}, this);
	}

	this.$container.empty().append(fragment);
};


AddSourceView.prototype.addSource = function(e){
	e.preventDefault();
	var val = this.$form.find('.current-dir').value();
	var loader = loading(dom('#spinner').get());
	ddp.call('addSource', val, function(err, res){
		if (err) loader.finish();
		ddp.call('syncLibrary', function(err, res){
			loader.finish();
		});
	});
};


/////////////////////////////////
// Current Browsing Directory  //
/////////////////////////////////

function CurrentDirectory(dirs){
	// xxx we need to contact the server to ask
	// for what the root directory is.
	this.dirs = dirs || ['/'];
}

Emitter(CurrentDirectory.prototype);

CurrentDirectory.prototype.update = function(){
	var dir = this.toString();
	var self = this;
	ddp.ready(function(){
		ddp.apply('browse', [dir], function(err, res){
			var files = _.chain(res)
				.sortBy(function(m){ return m.name.toLowerCase() })
				.groupBy(function(m) { return m.type })
				.value();
			self.emit('directoryListing', files);
			self.emit('currentDirectory', self.dirs);
		});
	});
};

CurrentDirectory.prototype.addDir = function(dir){
	this.dirs.push(dir.name + '/');
	return this;
};

CurrentDirectory.prototype.removeDir = function(){
	if (this.dirs.length < 2) return this;
	this.dirs.pop();
	return this;
};

CurrentDirectory.prototype.toString = function(){
	return this.dirs.join('');
};
