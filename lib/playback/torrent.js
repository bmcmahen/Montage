var express = require('express');
var app = module.exports = express();
var _ = require('underscore');
var fs = require('fs');
var mime = require('mime');
var rangeParser = require('range-parser');
var db = require('../database');

var pieceStream = require('./piece_stream');
var currentlyPlaying;
var currentDownloads = require('../torrents').currentDownloads;

var pipeline = function(inp, out) {
  inp.pipe(out);
  out.on('close', function() {
    inp.destroy();
  });
};

var stream = function(toPlay, file, range){
  var s = pieceStream(toPlay.torrent, file, range);
  toPlay.prioritize(s.position);
  return s;
};

app.get('/stream/:id', function(req, res, next){
  var id = req.params.id;

  db.findOne('movies', { _id : id })
    .then(function(doc){
      if (!doc) return next(new Error('Movie not found.'));
      if (!currentDownloads) return next(new Error('No current downloads.'));
      if (currentlyPlaying && currentlyPlaying.id === id) {
        toPlay = currentlyPlaying;
      } else {
        toPlay = _.find(currentDownloads, function(dl){
          return dl.attributes._id === id;
        });
        currentlyPlaying = toPlay;
      }

      if (!toPlay) {
        return next(new Error('Video not found amongst current downloads.'));
      }

      var file = toPlay.getLargest();
      var range = req.headers.range;
      req.connection.setTimeout(0);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', mime.lookup(file.name));
      range = range && rangeParser(file.length, range)[0];

      res.statusCode = 206;
      res.setHeader('Content-Length', range.end - range.start + 1);
      res.setHeader('Content-Range', 'bytes '+range.start+'-'+range.end+'/'+file.length);

      if (req.method === 'HEAD') return res.end();
      pipeline(stream(toPlay, file, range), res);
    })
    .fail(next);
});



