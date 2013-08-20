var View = require('backbone').View;
var $ = require('jquery');
var _ = require('underscore');

var DrawerView = require('./navigation').DrawerView;
var DrawerItems = require('./navigation').DrawerItems;
var SearchView = require('./search').SearchView;

// XXX this is doing too much, and too much of it is done by
// applying classes to various elements. Ideally, we should have
// one class for the drawer for each mode. Namely, 'search',
// 'list', 'prepare-search' (which blurs our list)

var DrawerController = View.extend({

	el: $('#drawer'),

	initialize: function(){
		this.searchMode = false;
		this.$container = $('#container');
		this.$body = $('body');
		this.showing = false;
		var self = this;
		this.lazyQuery = _.debounce(function(val){
			self.searchView.query(val);
		}, 1000);
		console.log('bacon');
		this.searchView = new SearchView({
			context: this
		});
	},

	events : {
		'input .search input' : 'search',
		'focus .search input' : 'applyFilter',
		'blur .search input' : 'removeFilter',
		'click .cancel button' : 'removeQuery',
		'submit form' : 'searchForm'
	},

	render: function(){
		var itemCollection = new DrawerItems();
		this.drawerView = new DrawerView({
			collection: itemCollection,
			context: this
		});
		return this;
	},

	show : function(){
		var self = this;
		this.showing = true;
		this.$body.addClass('nav-drawer-open');
		setTimeout(function(){
			$('li.search input')
				.prop('disabled', false);
		}, 500);
		this.$container.on('click', function(e){
			self.hide();
			return false;
		});
		return this;
	},

	hide : function(){
		this.showing = false;
		this.$body.removeClass('nav-drawer-open');
		var self = this;
		setTimeout(function(){
			self.$body.css({ 'overflow-x': 'hidden'});
		}, 500);
		this.$container.off('click');
		$('li.search input')
			.blur()
			.prop('disabled', true);
		return this;
	},

	toggle : function(){
		this.showing ? this.hide() : this.show();
	},

	removeQuery: function(e){
		e.preventDefault();
		e.stopPropagation();
		var self = this;
		// Force redraw necessary for iOS safari.
		setTimeout(function(){
			self.$el.find('input')
				.val('')
				.blur();
		}, 0);

		if (this.searchMode) this.enterNavigation();
		this.removeFilter();
	},

	enterNavigation: function(){
		this.$el
			.addClass('navigation')
			.removeClass('active-search');

		$('#drawer-content').html(this.drawerView.render().el);
		this.searchMode = false;
	},

	enterSearch: function(){
		this.$el
			.addClass('active-search')
			.removeClass('navigation filter in');

		$('#drawer-content').html(this.searchView.render().el);
		this.searchMode = true;
	},

	searchForm: function(e){
		e.preventDefault();
		var query = $(e.currentTarget).find('input').val();
		this.search(null, query);
	},

	search: function(e, query){
		var val = query || $(e.currentTarget).val();
		if (e) e.preventDefault();
		if (!val) {
			this.enterNavigation();
			this.$el.addClass('in');
			return;
		}
		if (!this.searchMode) this.enterSearch();
		if (val.length < 3) return;
		this.lazyQuery(val);
	},

	applyFilter: function(e){
		if (this.searchMode) return;
		var $el = this.$el;

		$el.addClass('filter');
		setTimeout(function(){
			$el.addClass('in');
		}, 0);
	},

	removeFilter: function(){
		if (this.searchMode) return;
		var $el = this.$el;
		$el.removeClass('in');
		setTimeout(function(){
			$el.removeClass('filter');
		}, 300);
	}

});

module.exports = new DrawerController().render();