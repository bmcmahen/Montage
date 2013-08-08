// Alphabet View
// represents a - z. 65 -> 122.
// xxx what about non-roman alphabet? .. later
//
// We have a grid. Each letter is 20 pixels wide.

var Emitter = require('emitter');
var events = require('events');
var $ = require('jquery');
var translate = require('translate');

// constants
// on a phone, we will need to shrink this to at least 10, if not
// more.
var boxWidth = 20;

var windowWidth = $(window).width();
if (windowWidth < 480) {
	boxWidth = 11;
}


function Alphabet(){
	this.$el = document.createElement('div');
	this.$el.classList.add('alphabet-wrapper');
	this.$list = document.createElement('ul');
	this.$list.classList.add('alphabet');
	this.$el.appendChild(this.$list);
	this.createhoverLetter();
	this.map = {};
}

Emitter(Alphabet.prototype);

module.exports = Alphabet;

Alphabet.prototype.bind = function(){
	this.events = events(this.$list, this);
	// this.events.bind('click .letter', 'selectLetter');
	// this.events.bind('click', 'getClickPoint');
	this.events.bind('mousedown', 'ontouchstart');
	this.events.bind('mousemove', 'ontouchmove');
	this.events.bind('touchstart');
	this.events.bind('touchmove');

	this.docEvents = events(document, this);
	this.docEvents.bind('mouseup', 'ontouchend');
	this.docEvents.bind('touchend');
};

// xxx only bind move event listener if we have already
// touched down. on really necessary for mouse.
Alphabet.prototype.ontouchstart = function(e){
	e.stopPropagation();
	e.preventDefault();
	this.tracking = true;
	this.$list.classList.add('active');
	if (e.touches) e = e.touches[0];
	var x = e.clientX;
	var offsetX = this.getOffset(x);
	this.getClickPoint(offsetX);
	this.$hover.classList.add('in');
};

Alphabet.prototype.ontouchmove = function(e){
	if (!this.tracking) return false;
	if (e.touches && e.touches.length > 1) return;
	if (e.touches){
		var ev = e;
		e = e.touches[0];
	}
	var x = e.clientX;
	var offsetX = this.getOffset(x);
	this.getClickPoint(offsetX);
	this.updateHoverLetter(x)
};

Alphabet.prototype.ontouchend = function(e){
	e.stopPropagation();
	this.tracking = false;
	this.$list.classList.remove('active');
	this.$hover.classList.remove('in');
};

Alphabet.prototype.close = function(){
	this.events.unbind();
	this.docEvents.unbind();
	$(this.$el).remove();
	$(this.$hover).remove();
};

Alphabet.prototype.getClickPoint = function(x){
	var charcode = this.pixelsToLetter(x);
	if (!charcode) return;
	this.updateHoverLetter(x, charcode);
	if (charcode === this.currentCharcode) return;
	this.currentCharcode = charcode;
	this.emit('letter', charcode);
};

Alphabet.prototype.getOffset = function(x){
	var offset = $(this.$list).offset();
	return x -= offset.left;
};

Alphabet.prototype.pixelsToLetter = function(x){
	var left = Math.floor(x / boxWidth) * boxWidth;
	return this.map[left];
};

Alphabet.prototype.selectLetter = function(e){
	e.preventDefault();
	var target = e.target;
	var charcode = data(target).get('charcode');
	this.emit('letter', charcode);
};

// By default, this is hidden. It's meant to act a bit like the
// iOS keyboard that shows a brief zoomed letter to indicate to
// the user what they have pressed.
Alphabet.prototype.createhoverLetter = function(){
	this.$hover = document.createElement('div');
	this.$hover.id = 'hover-letter';
	document.body.appendChild(this.$hover);
};

Alphabet.prototype.updateHoverLetter = function(x, charCode){
	if (charCode !== this.charCode) {
		// update our text content
		this.$hover.textContent = String.fromCharCode(charCode).toUpperCase();
	}
};

// xxx use template.
Alphabet.prototype.render = function(){
	var fragment = document.createDocumentFragment();
	var count = 0;
	for (var i = 97; i < 123; i++){
		var el = document.createElement('li');
		el.style.width = boxWidth + 'px';
		var a = document.createElement('a');
		el.appendChild(a);
		a.classList.add('letter');
		a.href = '#';
		a.textContent = String.fromCharCode(i);
		fragment.appendChild(el);
		this.map[count] = i;
		count += boxWidth;
	}
	this.$list.appendChild(fragment);
	this.bind();
	return this;
}

