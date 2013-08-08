var ddp = require('sockets').ddp;
var events = require('events');
var dom = require('dom');
var AddSourceView = require('./add-source');
var RemoveSourceView = require('./remove-source');
var AddNetworkView = require('./network-source');

function TabView(init){
	this.init = init || 'addSource';
	this.$el = dom(require('./templates/browser-tabs.html'));
	this.$content = this.$el.find('.tab-content');
}

module.exports = TabView;

TabView.prototype.render = function() {
	this[this.init]();
	this.bind();
	return this;
};

TabView.prototype.bind = function(){
	this.events = events(this.$el.get(0), this);
	this.events.bind('click #tab-one', 'addSource');
	this.events.bind('click #tab-two', 'removeSource');
	this.events.bind('click #tab-three', 'addNetwork');
};

TabView.prototype.close = function(){
	this.events.unbind();
	this.$el.remove();
};

TabView.prototype.setActive = function($target){
	if (this.$active) this.$active.removeClass('active');
	this.$active = $target.addClass('active');
}

TabView.prototype.addSource = function() {
	this.setActive(this.$el.find('#tab-one'));
	this.$content.empty().append(new AddSourceView().render().$el);
};

TabView.prototype.removeSource = function() {
	this.setActive(this.$el.find('#tab-two'));
	this.$content.empty().append(new RemoveSourceView().render().$el);
};

TabView.prototype.addNetwork = function() {
	this.setActive(this.$el.find('#tab-three'));
	this.$content.empty().append(new AddNetworkView().render().$el);
};