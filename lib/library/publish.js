var publications = require('../sockets/publications');
var db = require('../database');

// update these w/ promises.
publications.add({

	// Return all of our videos in the db.
	movies : function(fn){
		db.movies.find({}, fn);
	},

	// Return all of our library sources.
	sources : function(fn){
		db.sources.find({}, fn);
	},

	currentlyPlaying: function(fn){
		db.movies.findOne({ $or: [{ playback : 'playing'}, { playback: 'paused' }]}, function(err, res){
			console.log(err, res);
		});
		db.movies.findOne({ $or: [{ playback : 'playing'}, { playback: 'paused' }]}, fn);
	}

});