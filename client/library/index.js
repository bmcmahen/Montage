var swipe = require('swipe');
var collection = require('../collections/movies');
var events = require('events');
var isTouch = require('is-touch')();
var debounce = require('debounce');
var translate = require('translate');
var Alphabet = require('./alphabet');
var $ = require('jquery');
var Collection = require('backbone').Collection;
var Emitter = require('emitter');
var EmitterManager = require('emitter-manager');
var _ = require('underscore');
var onload = require('onload');
var Progress = require('progress');
var Hammer = require('hammer');
var addEvent = require('event');
var BackgroundZoom = require('background-zoom');
var hold = require('hold');
var ddp = require('../sockets').ddp;

var Chunk = require('./chunks').Chunk;
var ChunkCollection = require('./chunks').ChunkCollection;
var Session = require('session');



// xxx todo: make this pluggable with different collections.

// API
module.exports = function(wrapper){
  return new SwipeView(wrapper);
};

// Constants -> These should change, depending on window
// size. For example, everything should be smaller on
// phones vs. tablets.

var BOX_WIDTH,
    BOX_HEIGHT,
    PADDING_WIDTH,
    PADDING_HEIGHT,
    CONTAINER_WIDTH,
    CONTAINER_HEIGHT,
    IS_PHONE;

changeVariables($(window).width());

function changeVariables(width, height){

  width = width || $(window).width();
  height = height || $(window).height();
  height -= 60;

  CONTAINER_WIDTH = width;
  CONTAINER_HEIGHT = height;

  // phone (roughly)
  if (width < 480) {
    BOX_WIDTH = 100;
    BOX_HEIGHT = 165;
    PADDING_WIDTH = 10;
    PADDING_HEIGHT = 10;
    IS_PHONE = true;

  // tablet, desktop
  } else if (width >= 480) {
    BOX_WIDTH = 130;
    BOX_HEIGHT = 255;
    PADDING_WIDTH = 50;
    PADDING_HEIGHT = 10;
    CONTAINER_WIDTH = width;
    IS_PHONE = false;
  }
}


/////////////////
// Swipe View  //
/////////////////

function SwipeView(wrapper){
  var $body = document.getElementById('body');
  this.$el = document.createElement('div');
  this.$el.id = 'swipe-container';
  $body.appendChild(this.$el);
  this.$swipe = document.createElement('ul');
  this.$swipe.id = 'library';
  this.$swipe.classList.add('swipe-wrapper');
  this.currentlyRendered = [0, 1, 2];
  this.chunkCollection = new ChunkCollection();
  this.alphabetView = new Alphabet().render();
  this.subviews = [];
  this.bind();
  this.listen();
  this.currentIndex = 0;
}

Emitter(SwipeView.prototype);

SwipeView.prototype.bind = function(){
  this.$window = events(window, this);
  // ios sometimes weirdly registers resize events for (seemingly)
  // no reason, although I could probably change this since I think
  // it was related to scrolling (which we have disabled).
  if (isTouch) {
    this.$window.bind('orientationchange');
    return;
  }
  this._delayedResize = _.debounce(this.resize.bind(this), 200);
  this.$window.bind('resize', '_delayedResize');
};


SwipeView.prototype.listen = function(){
  this.events = new EmitterManager();
  this._delayedUpdate = _.debounce(this.resize.bind(this), 200); // this is probably bad practice.
  this.events.on(this.chunkCollection, 'add', this.addPane.bind(this));
  this.events.on(this.chunkCollection, 'remove', this.onPaneRemove.bind(this));
  this.events.on(collection, 'add', this._delayedUpdate);
  this.events.on(collection, 'remove', this._delayedUpdate);
  this.events.on(collection, 'reset', this.resetView.bind(this));
  this.events.on(this.alphabetView, 'letter', this.pressLetter.bind(this));
};


/**
 * Unbind and remove all of our DOM elements. This might be overkill,
 * but we should at least unbind everything.
 * @return {SwipeView}
 */

SwipeView.prototype.close = function(){
  this.events.off();
  this.$window.unbind();
  if (this.swipe) this.swipe.unbind();
  this.alphabetView.close();
  this.subviews.forEach(function(view){
    view.remove();
  });
  $(this.$el).remove();
  return this;
};

SwipeView.prototype.listenSwipe = function(){
  var self = this;
  // Ideally, this would be listening for 'showing' to avoid any
  // instances of unrendered panes. But there's a weird bug in
  // iOS safari that stop registering touchmove when something
  // is removed from the DOM.

  this.events.on(this.swipe, 'show', this.onswipeshow.bind(this));

  // this.events.on(this.swipe, 'show', function(i, pane){
  //   self.rollViewsRendered(i, pane);
  //   self.currentIndex = i;
  //   console.log('show!', i);
  // });
};

SwipeView.prototype.onswipeshow = function(i){
  this.rollViewsRendered(i);
  this.currentIndex = i;
};

SwipeView.prototype.pressLetter = function(num){
  var i = this.alphabet[num];
  var diff = Math.abs(this.currentIndex - i);
  // don't animate when we are switching between more than 4 views
  // because of weird artifacts in chrome, plus the animation is
  // so fast as to be useless. (and its not worth slowing it down.)

    this.swipe.show(i - 1, 0, { silent: true });
    this.onswipeshow(i - 1);
    return;

  // this.swipe.show(i - 1, diff * 300, { silent: true });
  // var self = this;
  // setTimeout(function(){
  //   self.onswipeshow(i - 1);
  // }, 300);
};


SwipeView.prototype.resetView = function(){
  this.hasReset = true;
  this.determineGridItemTotal();
  this.spliceCollection();
  this.mapAlphabet();
  this.render();
};

/**
 * Create a new Pane for the Carousel
 * @param  {Chunk} chunk collection
 * @param  {Number} index of chunk
 */

SwipeView.prototype.addPane = function(chunk, index){
  var view = new SwipeItem(this, chunk);
  this.$swipe.appendChild(view.$el);
  this.subviews.push(view);
};

SwipeView.prototype.onPaneRemove = function(chunk, i){
  if (i === this.currentIndex) {
    this.swipe.show(i - 1);
  }
};

/**
 * When models have been added or removed to our
 * collection, we need to splice it again, map
 * our alphabet, and refresh things.
 */

SwipeView.prototype.updatePanes = function(collection){
  // if (!this.hasReset) return;
  if (!this.swipe) {
    this.resetView();
    this.rollViewsRendered(this.currentIndex || 0, true);
    return;
  }
  this.spliceCollection();
  this.mapAlphabet();
  this.swipe.refresh();
  this.subviews[this.currentIndex].relayout();
  this.rollViewsRendered(this.currentIndex, true);
};


SwipeView.prototype.onorientationchange = function(){
   var ori = window.orientation;
   var width, height;

   if (ori == 90 || ori == -90) {
    width = screen.height;
    height = screen.width - 30;
   } else {
    height = screen.height - 30;
    width = screen.width;
   }

   changeVariables(width, height);
   this.determineGridItemTotal();
   this.updatePanes();
};

/**
 * When resizing the window, we need to update
 * our grid math and refresh everything.
 */

SwipeView.prototype.resize = function(){
  changeVariables();
  this.determineGridItemTotal();
  this.updatePanes();
};


/**
 * Append our EL to body, instantiate our Swipe, and
 * show our default indexes.
 * @return {SwipeView}
 */

SwipeView.prototype.render = function(){
  var self = this;
  if (this.subviews.length < 1) {
    if (collection.length < 1) return this;
    this.resetView();
    return this;
  }


  this.$el.innerHTML = '';
  this.$el.appendChild(this.$swipe);
  this.$el.appendChild(this.alphabetView.$el);

  if (!this.swipe) {
    this.swipe = swipe(this.$el);
    this.swipe.fastThreshold(300);
    this.listenSwipe();
  }

  // Make sure our default indexes are showing.
  this.currentlyRendered.forEach(function(i){
    var subview = self.subviews[i];
    if (subview) subview.showChildren();
  });

  return this;
};

/**
 * Roll our panes to only render current, and immediate
 * siblings, to save on memory usage on mobile.
 * xxx refactor
 * @param  {Number} i current index
 */

SwipeView.prototype.rollViewsRendered = function(i, force){
  var max = this.subviews.length - 1;
  var min = 0;
  var previousShown = this.currentlyRendered;
  var newMin = (i - 1) < 0 ? 0 : (i - 1);
  var newMax = (i + 1) > max ? max : (i + 1);
  var newRendered = [newMin, i, newMax];

  if (force){
    if (newMin !== i) this.subviews[newMin].showChildren();
    if (newMax !== i) this.subviews[newMax].showChildren();
    if (!this.subviews[i].isRendered) this.subviews[i].showChildren();
    this.currentlyRendered = newRendered;
    return;
  }

  var toRemove = previousShown.filter(function(x){
    return newRendered.indexOf(x) < 0;
  });

  var toAdd = newRendered.filter(function(x){
    return previousShown.indexOf(x) < 0;
  });

  if (toRemove.length > 0){
    toRemove.forEach(function(i){
      this.subviews[i].removeChildren();
    }, this);
  }

  if (toAdd.length > 0) {
    toAdd.forEach(function(i){
      this.subviews[i].showChildren();
    }, this);
  }

  this.currentlyRendered = newRendered;
};

/**
 * Calculate the grid dimensions for absolute positioning
 * of our movie thumbnails. Need to be reset when window
 * is resized, or orientation has changed.
 * @return {SwipeView}
 */

SwipeView.prototype.determineGridItemTotal = function(){
  var g = this.grid = {};

  // g.cw = this.$el.clientWidth;
  // if (g.cw < 300) g.cw = 300;

  // g.ch = this.$el.clientHeight - 30;

  g.cw = CONTAINER_WIDTH;
  g.ch = CONTAINER_HEIGHT;


  if (g.ch < (BOX_HEIGHT + (PADDING_HEIGHT * 2))) {
    g.ch = BOX_HEIGHT + (PADDING_HEIGHT * 2);
  }

  // boxes per row
  g.bpr = Math.floor(g.cw / (BOX_WIDTH + PADDING_WIDTH));
  g.rows = Math.floor(g.ch / ((BOX_HEIGHT + PADDING_HEIGHT) + PADDING_HEIGHT));

  // box dimensions
  // g.newWidth = (g.cw - (g.bpr * PADDING_WIDTH)) / g.bpr;
  // g.newHeight = (g.newWidth / BOX_WIDTH) * BOX_HEIGHT;
  g.newWidth = BOX_WIDTH;
  g.newHeight = BOX_HEIGHT;

  // Side padding (left & right)
  // g.mx = (g.cw - (g.bpr * g.newWidth) - (g.bpr - 1) * PADDING_WIDTH) * 0.5;
  // g.rows = Math.floor(g.ch / (g.newHeight + PADDING_HEIGHT));
  if (g.rows === 0) g.rows === 1;

  g.margin_top = (g.ch - (g.rows * BOX_HEIGHT)) / (g.rows + 1);
  g.quadWidth = g.cw / g.bpr;
  g.quadHeight = g.ch / g.rows;

  g.total = g.rows * g.bpr;
  this.emit('grid-reset', g);
  return this;
};


/**
 * Splice our collection into a series of chunks that represet
 * the movies on each pane.
 * @return {SwipeView}
 */

SwipeView.prototype.spliceCollection = function(){
  var size = this.grid.total;
  var iterations = Math.ceil(collection.length / size);
  var subs = this.chunkCollection;
  var len = subs.length();

  var createNewChunk = function(chunk){
    subs.add(new Chunk(chunk));
  };

  // If we need to remove chunks...
  if (iterations < len){
    for (var p = 0; p < (len - iterations); p++){
      subs.pop();
    }
  }

  // xxx while loop?
  var start = 0;
  for (var i = 0; i < iterations; i++){
    var chunk = collection.slice(start, start + size);
    if (len > 0) {
      if (i === this.currentIndex) subs.at(i).set(chunk);
      else if (subs.at(i)) subs.at(i).reset(chunk);
      else createNewChunk(chunk);
    } else {
      createNewChunk(chunk);
    }
    start += size;
  }

  return this;
};


/**
 * Map our alphabet to particular indexes in our carousel
 * such that we can skip to a particular index when a
 * letter in the alphabet is clicked.
 * Range 96 -> 122 (charCode)
 */

SwipeView.prototype.mapAlphabet = function(){
  var self = this;
  this.alphabet = {};
  var lastCharacter = 96;

  /**
   * Small helper for getting the appropriate charcode
   * from the title or filename.
   * @param  {Movie} model
   * @return {Number}       charcode
   */

  var getCharCode = function(model){
    var name = model.get('title') || model.get('file_name');
    return name.toLowerCase().charCodeAt(0);
  };

  /**
   * When letters are missing, we still want them to
   * go to the previous letter's index.
   * @param  {Number} difference
   * @param  {Number} index
   */

  var insertMissing = function(difference, index){
    for (var p = 1; p < difference; p++) {
      self.alphabet[lastCharacter + p] = index + 1;
    }
  }

  this.chunkCollection.forEach(function(chunk, i){
    lastCharacter = lastCharacter || getCharCode(chunk.at(0));
    var endCharCode = getCharCode(chunk.at(chunk.length - 1));

    chunk.some(function(movie){
      var charCode = getCharCode(movie);
      if (charCode !== lastCharacter){
        var diff = charCode - lastCharacter;
        if (diff > 1) insertMissing(diff, i);
        self.alphabet[charCode] = i + 1;
        lastCharacter = charCode;
      }
      if (lastCharacter === endCharCode) return true;
    });
  });

    // Fill in remaining letters to Z
  if (lastCharacter < 122) {
    var missing = 122 - lastCharacter;
    insertMissing(missing + 1, this.chunkCollection.length() - 1);
  }

};

///////////////////////
// Swipe Item (Pane) //
///////////////////////

function SwipeItem(context, chunk){
  this.context = context;
  this.setChunk(chunk);
  this.$el = document.createElement('li');
  this.$el.classList.add('swipe-item', 'hidden');
  this.setDimensions({
    cw: context.$el.clientWidth,
    ch: context.$el.clientHeight - 10
  });
  this.bind();
}

SwipeItem.prototype.bind = function(){
  var self = this;
  this.events = new EmitterManager();
  this.events.on(this.context, 'grid-reset', this.setDimensions.bind(this));
  this.events.on(this.chunk, 'remove', this.removeChild.bind(this));
  this.events.on(this.chunk, 'add', this.addChild.bind(this));
  this.events.on(this.chunk, 'reset', this.render.bind(this));
  this.events.on(this.chunk, 'chunk-removed', this.remove.bind(this));
};

SwipeItem.prototype.unbind = function(){
  this.events.off();
};

SwipeItem.prototype.removeChild = function(model){
  if (!this.children) return;
  this.children.some(function(child, i){
    if (child.model.id === model.id) {
      child.removeView();
      this.children.splice(i, 1);
      return true;
    }
  }, this);
};

SwipeItem.prototype.addChild = function(model){
  var view = new MovieItem(model).render();
  this.children.push(view);
};

SwipeItem.prototype.determinePosition = function(model, i){
  var g = this.context.grid;
  var r = Math.floor(i / g.bpr);
  var c = i % g.bpr;
 // var left = g.mx + (c * (g.newWidth + PADDING_WIDTH));
  var left = ((g.quadWidth * c) + (g.quadWidth / 2)) - (g.newWidth / 2);
  // var top = ((g.quadHeight * r) + (g.quadHeight / 2)) - (g.newHeight / 2);
  var top = (r * (BOX_HEIGHT + g.margin_top)) + g.margin_top;
  return { top: top, left: left, width: g.newWidth, height: g.newHeight };
}

SwipeItem.prototype.relayout = function(){
  var self = this;
  this.chunk.forEach(function(model, i){
    var pos = self.determinePosition(model, i);
    model.trigger('position', pos, function(view){
      if (!view.isAttached) {
        self.$el.appendChild(view.$el);
        view.isAttached = true;
      }
    });
  });
}

SwipeItem.prototype.setChunk = function(chunk){
  this.chunk = chunk;
};


SwipeItem.prototype.render = function(models){
  this.removeChildren();
  this.isRendered = true;
  var frag = document.createDocumentFragment();
  this.children = this.chunk.map(function(model, i){

    // Render our child
    var view = new MovieItem(model).render();

    // Set its position
    var pos = this.determinePosition(model, i);
    view.updatePosition(pos);

    view.isAttached = true;
    frag.appendChild(view.$el);
    return view;
  }, this);

  this.$el.appendChild(frag);
  this.$el.classList.remove('hidden');
  return this;
};

SwipeItem.prototype.setDimensions = function(g){
  this.$el.style.width = g.cw + 'px';
  this.$el.style.height = g.ch + 65 + 'px';
};


SwipeItem.prototype.removeChildren = function(){
  // remove children!
  this.isRendered = false;
  if (!this.children) return;
  this.children.forEach(function(child){
    child.removeView();
  });
  this.$el.classList.add('hidden');
};

SwipeItem.prototype.showChildren = function(){
  this.render();
};

SwipeItem.prototype.remove = function(){
  this.removeChildren();
  $(this.$el).remove();
  this.unbind();
};




/////////////////////
// List View Item  //
/////////////////////

function MovieItem(model){
  this.model = model;
  var self = this;
  this.$el = document.createElement('div');
  this.$el.classList.add('movie-thumb');
  this.template = require('./templates/movie');
  this.bind();
};

MovieItem.prototype.render = function(){
  var imagePath = '/movies/w154';
  if (window.devicePixelRatio === 2 && !IS_PHONE) imagePath = '/movies/w342';
  var json = this.model.toJSON();
  if (IS_PHONE) json.is_phone = true;
  json.image_path = imagePath;
  this.$el.innerHTML = this.template(json);
  this.$image = this.$el.querySelector('img');
  if (this.$image) onload(this.$image);
  if (this.model.get('torrent')){
    this.showProgress();
  }
  if (this.model.get('file_missing')){
    this.$el.classList.add('file-missing');
  }
  return this;
};

MovieItem.prototype.removePreload = function(){
  var self = this;
  onload()
  if (this.$image){

    this.$image.bind('load', function(){
      self.$el.classList.add('in');
      self.$image.unbind('load');
    });
  } else {
    // actually tie this to an onload event for the image.
    setTimeout(function(){
      self.$el.classList.add('in');
    }, 0);
  }
};

// use reactive here... this is sucky & turning into spaghetti. mmm spahgetti.
MovieItem.prototype.bind = function(){
  this.listen = new EmitterManager();
  this.listen.on(this.model, 'position', this.updatePosition.bind(this));
  var self = this;
  this.listen.on(this.model, 'change:selected', this.toggleSelected);
  this.listen.on(this.model, 'change:title', this.changeTitle.bind(this));
  this.listen.on(this.model, 'change:runtime', this.changeRuntime.bind(this));
  this.listen.on(this.model, 'change:original_poster_path', this.changePoster.bind(this));
  if (this.model.get('torrent')) {
    this.listen.on(this.model, 'change:torrent', this.showProgress.bind(this));
  }
  this.listen.on(this.model, 'change:file_missing', function(){
    self.$el.classList.remove('file-missing');
  })
  this.events = events(this.$el, this);
  this.events.bind('click', 'selectMovie');
  hold(this.$el, function(e){
    self.holding = true;
    self.enterEditMode();
  });
};

MovieItem.prototype.deleteMovie = function(e){
  e.preventDefault();
  e.stopPropagation();
  this.model.collection.remove(this.model);
  ddp.call('ignoreVideo', this.model.toJSON());
  this.exitEdit();
};

MovieItem.prototype.exitEdit = function(){
  this.$el.querySelector('.images').classList.remove('edit');
  addEvent.unbind(this.$el.querySelector('.icon-close'), 'click', this._boundDelete);
  addEvent.unbind(document, 'click', this._boundExitEdit);
};

MovieItem.prototype.enterEditMode = function(){
  this.$el.querySelector('.images').classList.add('edit');
  this._boundDelete = this.deleteMovie.bind(this);
  this._boundExitEdit = this.exitEdit.bind(this);
  addEvent.bind(this.$el.querySelector('.icon-close'), 'click', this._boundDelete);
  addEvent.bind(document, 'click', this._boundExitEdit);
};

MovieItem.prototype.changeTitle = function(){
  var title = this.model.get('title') || this.model.get('file_name');
  $(this.$el).find('.name').text(title);
  // this.$el.querySelector('.name').textContext = title;
};

MovieItem.prototype.changeRuntime = function(){
  var runtime = this.model.get('runtime');
  $(this.$el).find('.meta').text(runtime + ' Minutes');
  // this.$el.querySelector('.meta').textContext = runtime;
};

MovieItem.prototype.changePoster = function(){
  var poster = this.model.get('original_poster_path');
  var loadCounts = 0;
  var self = this;

  // this is absurd... but it works. The problem I'm having is that
  // we call back to the user before the images are seemingly ready.
  // The images are certainly downloaded, but perhaps they aren't ready
  // to be served yet.
  var loadImage = function(){
    var img = document.createElement('img');
    img.setAttribute('width', 130);
    img.setAttribute('height', 195);
    img.classList.add('onload');
    img.onload = function(){
      $(self.$el).find('.img-container').html(img);
    }
    img.onerror = function(err){
      setTimeout(function(){
        if (loadCounts > 3) return;
        loadImage();
        loadCounts++;
      }, 3000);
    }
    img.src = '/movies/w154'+ poster;
  }

  setTimeout(function(){
    loadImage();
  }, 500);

};

MovieItem.prototype.selectMovie = function(e){
  e.stopPropagation();
  if (this.model.get('file_missing')) {
    return;
  }
  if (this.holding){
    this.holding = false;
    return;
  }
  this.model.pos = {
    left: this.pos.left,
    top: this.pos.top + 50,
    width: BOX_WIDTH
  };
  Session.set('selected_movie', this.model);
};

MovieItem.prototype.unbind = function(){
  this.listen.off();
};

MovieItem.prototype.removeView = function(){
  this.unbind();
  $(this.$el).remove();
};

MovieItem.prototype.updatePosition = function(pos, fn){
  this.pos = pos;
  var $el = this.$el;
  if (IS_PHONE) {
    var s = $el.style;
    s.top = pos.top + 'px';
    s.left = pos.left + 'px';
  } else {
    translate($el, pos.left, pos.top);
  }
  if (fn) fn(this);
};

MovieItem.prototype.showProgress = function() {
  var progress = this.model.get('torrent').progress;
  progress = progress ? progress.toFixed(2) : 0.1;
  if (!this.progress) {
    this.progress = new Progress()
      .size(100)
      .lineWidth(20);
    this.progress.el.classList.add('progress');
    this.$el.querySelector('.images').appendChild(this.progress.el);
  }
  this.progress.update(progress);
  if (progress === 100) {
    $(this.progress.el).remove();
  }
};

MovieItem.prototype.finishDownload = function(){
  $(this.$progress).remove();
};

MovieItem.prototype.toggleSelected = function(){

}