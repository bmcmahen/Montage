var Collection = require('backbone').Collection;
var Emitter = require('emitter');

var Chunk = Collection.extend({
	idAttribute: '_id'
});

exports.Chunk = Chunk;


/**
 * Basic array wrapper that gives us events for removal
 * and addition of array items. Basically, it's a collection
 * of collections that correspond with the panes that are
 * to be rendered. [[0, 1, 2], [3, 4, 5], [6, 7, 8]]
 */

function ChunkCollection(){
	this.chunks = [];
}

Emitter(ChunkCollection.prototype);

exports.ChunkCollection = ChunkCollection;

ChunkCollection.prototype.length = function(){
	return this.chunks.length;
};

ChunkCollection.prototype.slice = function(index){
	return this.chunks.slice(index);
};

ChunkCollection.prototype.splice = function(index){
	var removed = this.chunks.splice(index);
	removed.forEach(function(chunk){
		this.emit('remove', chunk);
	}, this);
	return removed;
};

ChunkCollection.prototype.at = function(index){
	return this.chunks[index];
};

ChunkCollection.prototype.add = function(chunk, silent){
	this.chunks.push(chunk);
	if (!silent) this.emit('add', chunk, this.chunks.length - 1);
};

ChunkCollection.prototype.pop = function(){
	var i = this.chunks.length - 1;
	var chunk = this.chunks[i];
	this.chunks.pop()
	this.emit('remove', chunk, i);
	chunk.trigger('chunk-removed');
};

ChunkCollection.prototype.remove = function(chunk){
	var index = this.chunks.indexOf(chunk);
	if (index === -1) return new Error('Chunk doesnt exist.');
	this.chunks.splice(index, 1);
	this.emit('remove', chunk, index);
	chunk.trigger('chunk-removed');
};

ChunkCollection.prototype.map = function(fn){
	var chunks = this.chunks;
	var len = chunks.length;
	var arr = [];
	for (var i = 0; i < len; i++) {
		arr.push(fn(chunks[i], i));
	}
	return arr;
};

ChunkCollection.prototype.forEach = function(fn){
	var chunks = this.chunks;
	var len = chunks.length;
	for (var i = 0; i < len; i++) {
		fn(chunks[i], i);
	}
	return this;
};