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
		db.movies.find({ playback : { $exists: true }}, fn);
	}

});