var rangeParser = require('range-parser');
var mime = require('mime');
var Readable = require('stream').Readable;
var util = require('util');

var MIN_BUFFER = 1.5 * 1000 * 1000;

module.exports = function(download, file, range){

  var dest = file.destination; // yup
  var missing = download.storage.missing; // yup
  var torrent = download.storage.torrent; // yup

  var piecesToBuffer = Math.ceil((MIN_BUFFER) / torrent.pieceLength);
  var start = (file.offset / torrent.pieceLength) | 0;
  var end = ((file.offset + file.length + 1) / torrent.pieceLength) | 0;

  var PieceStream = function(range){
    if (!(this instanceof PieceStream)) return new PieceStream();
    Readable.call(this);
    range = range || { start:0, end : file.length - 1 };
    this.position = ((range.start + file.offset) / torrent.pieceLength) | 0;
    this.remaining = range.end - range.start + 1;
    this.skip = (range.start + file.offset) % torrent.pieceLength;
    this.destroyed = false;
    this._buffer = this.position + Math.min(piecesToBuffer, (this.remaining / torrent.pieceLength) | 0);
    this._onreadable = null;
    this.emit('position', this.position);
  };

  util.inherits(PieceStream, Readable);

  PieceStream.prototype._read = function(){
    if (!this.remaining) return this.push(null);
    var self = this;
    var onread = function(err, data){
      if (err) return self.emit('error', err);
      if (self.skip) data = data.slice(self.skip);
      if (data.length > self.remaining) data = data.slice(0, self.remaining);
      self.skip = 0;
      self.remaining -= data.length;
      if (self.destroyed) return;
      self.push(data);
      self.emit('position', self.position);
    }

    if (!this.buffering()) return dest.read(this.position++ - start, onread);
    this._onreadable = function(index) {
      if (self.buffering()) return;
      dest.removeListener('readable', self._onreadable);
      dest.read(self.position++ - start, onread);
      self.emit('position', self.position);
    };

    dest.on('readable', this._onreadable);
  };

  PieceStream.prototype.buffering = function() {
    for (var i = this.position; i < this._buffer; i++) {
      if (!dest.readable(i - start)) return true;
    }
    return !dest.readable(this.position - start);
  };

  PieceStream.prototype.destroy = function() {
    this.destroyed = true;
    if (this._onreadable) dest.removeListener('readable', this._onreadable);
    this.emit('close');
  };

  return new PieceStream(range);

}


