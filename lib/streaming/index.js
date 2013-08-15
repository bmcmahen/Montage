var fs = require('fs');
var util = require('util');
var express = require('express');
var app = module.exports = express();
var db = require('../database');
var ffmpeg = require('fluent-ffmpeg');
var minimatch = require('minimatch');
var spawn = require('child_process').spawn;

app.get('/videos/:id', function(req, res, next){
  var id = req.params.id;
  db.findOne('movies', {_id: id})
    .then(function(result){
      if (!result) return next(new Error('Movie not found.'));
      var file_name = result.file_name;
      var path = result.path;


        var stat = fs.statSync(path);
        var total = stat.size;

        if (req.headers['range']) {
          var range = req.headers.range;
          var parts = range.replace(/bytes=/, "").split("-");
          var partialstart = parts[0];
          var partialend = parts[1];
          var start = parseInt(partialstart, 10);
          var end = partialend ? parseInt(partialend, 10) : total - 1;
          var chunksize = (end-start)+1;

          if (isHTML5Friendly(file_name)){
            var file = fs.createReadStream(path, {start: start, end: end});
            res.writeHead(206, { 'Content-Range': 'bytes ' + start + '-' + end + '/' + total, 'Accept-Ranges': 'bytes', 'Content-Length': chunksize, 'Content-Type': 'video/mp4' });
            file.pipe(res);
          } else {
            res.writeHead(200, { 'Accept-Ranges': 'bytes', 'Content-Length': total, 'Content-Type': 'video/mp4' });
            var args = [
              '-re', '-i', path, '-vcodec', 'libx264', '-acodec', 'libfaac', '-f', 'h264', 'pipe:1'
            ];
            var stream = spawn('ffmpeg', args);

            stream.stderr.setEncoding('utf8');
            stream.stdout.setEncoding('utf8');

            stream.stdout.on('data', function(chunk){
              res.write(chunk);
            });

            stream.stderr.on('data', function(data){
              console.log(data);
            });

            stream.on('error', function(err){
              console.log(err);
            });

            res.on('close', function(){
              stream.kill();
            });
          }
        }

    });
});

function isHTML5Friendly(file){
  var types = ['*.mp4', '*.m4v', '*.mkv'];
  return types.some(function(type){
    return minimatch(file, type);
  });
}