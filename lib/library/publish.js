var publications = require('../sockets/publications');
var db = require('../database');

publications.add({

	// Return all of our videos in the db.
	movies : function(fn){
		db.movies.find({}, fn);
	},

	// Return all of our library sources.
	sources : function(fn){
		db.sources.find({}, fn);
	}

});