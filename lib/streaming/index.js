var fs = require('fs');
var util = require('util');
var express = require('express');
var app = module.exports = express();
var db = require('../database');

app.get('/videos/:id', function(req, res, next){
  var id = req.params.id;
  db.findOne('movies', {_id: id})
    .then(function(result){
      if (!result) return next(new Error('Movie not found.'));
      var path = result.path;
      var stat = fs.statSync(path);
      var total = stat.size;

      if (req.headers['range']) {
        var range = req.headers.range;
        var parts = range.replace(/bytes=/, "").split("-");
        var partialstart = parts[0];
        var partialend = parts[1];
        console.log(total);
        var start = parseInt(partialstart, 10);
        var end = partialend ? parseInt(partialend, 10) : total - 1;
        var chunksize = (end-start)+1;
        console.log('RANGE: ' + start + ' - ' + end + ' = ' + chunksize);

        var file = fs.createReadStream(path, {start: start, end: end});
        res.writeHead(206, { 'Content-Range': 'bytes ' + start + '-' + end + '/' + total, 'Accept-Ranges': 'bytes', 'Content-Length': chunksize, 'Content-Type': 'video/mp4' });
        file.pipe(res);
      }
    });
});

