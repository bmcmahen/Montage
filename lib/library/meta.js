var qs = require('qs').stringify;
var request = require('request');
var Q = require('q');
var _ = require('underscore');
var path = require('path');
var fs = require('fs');
var gm = require('gm');
var path = require('path');
var parallelLimit = require('../utils/parallel_limit');
var tmdb = require('./tmdb');

var MY_MOVIE_URL = 'http://mymovieapi.com/?';
var metaSearchOptions = {
	'imdb' : searchIMDB
};


function normalizeIMDB(data){
	// runtime from 144min -> 144
	if (!data) return data;
	var runtime = data.runtime;
	if (runtime && runtime[0]){
		data.runtime = runtime[0].substr(0, runtime[0].indexOf(' '));
	}
	return data;
}



function searchIMDB(title, year){
	var deferred = Q.defer();
	var params = { title : title, plot: 'full' };
	if (year) params.year = year;
	var queryString = qs(params);
	request(MY_MOVIE_URL + queryString, { json: true }, function(err, res, body){
		if (!_.isArray(body)) return deferred.reject(new Error('No results generated.'));
		if (err) return deferred.reject(err);
		deferred.resolve(body);
	});
	return deferred.promise;
}

exports.searchIMDB = searchIMDB;


function fetchImage(url, filename, format){
	var deferred = Q.defer();
	format = format || '.jpg';
	var newPath = path.join(__dirname, '../../public/movies/images', filename + format);
	var stream = fs.createWriteStream(newPath)
	var req = request(url).pipe(fs.createWriteStream(newPath));
	req.on('close', function(){
		console.log('END');
		deferred.resolve();
	});
	req.on('error', deferred.reject);
	return deferred.promise;
}

exports.fetchImage = fetchImage;


function createThumbnail(path, width, height, outName, quality){
	var deferred = Q.defer();
	gm(path)
		.noProfile()
		.thumb(width, height, outName, quality, function(err){
			if (err) return deferred.reject(err);
			return deferred.resolve();
		});
	return deferred.promise;
}

function createThumbnails(p, name){
	var d1 = path.join(__dirname, '../../public/movies/130', name);
	var d2 = path.join(__dirname, '../../public/movies/80', name);
	var thumb1 = createThumbnail(p, 130, 195, d1, 100); // 130
	var thumb2 = createThumbnail(p, 30, 45, d2, 100); // 80
	return Q.allSettled(thumb1, thumb2);
}

function createAllThumbnails(list){
	var promises = [];
	list.forEach(function(video){
		if (video.poster) {
			var name = video.imdb_id + '.jpg';
			var p = path.join(__dirname, '../../public/movies/images', name);
			promises.push(createThumbnails(p, name));
		}
	});
	return parallelLimit(promises, 10);
}

exports.createAllThumbnails = createAllThumbnails;

var counter = 0;

function fetchMovieMeta(movie, type){
	if (_.isArray(movie)) return fetchAllMovieMeta(movie, type);
	var name = movie.parsed_name || movie.file_name;
	// Use TMDB (Should be our primary API)
	if (type === 'tmdb') {
		return tmdb.search(name, movie.year)
			.then(function(res){
				if (!(res && res.results && res.results[0])) return movie;
				return tmdb.getDetail(res.results[0].id)
					.then(function(detail){
						if (detail) _.extend(movie, tmdb.normalize(detail));
						return movie;
					});
			});
	}
}

exports.fetchMovieMeta = fetchMovieMeta;

/**
 * Given a list of documents, query the specified
 * meta api & alter the document with the returned
 * meta information.
 * @param  {Array} list of parsed files
 * @param  {String} type of scraper to use
 * @return {Promise}
 */

function fetchAllMovieMeta(list, type){
	list = _.isArray(list) ? list : [list];
	type = (type || 'tmdb');
	var promises = list.map(function(video){
		return fetchMovieMeta(video, type);
	});
	return Q.all(promises);
}

exports.fetchAllMovieMeta = fetchAllMovieMeta;

/**
 * Given a list of documents, if the movie has
 * a poster URL then we download the poster.
 * @param  {Array} list of parsed files w/ meta
 * @return {Promise}
 */

// function fetchPosters(list){
// 	var promises = [];
// 	list.forEach(function(movie){
// 		var poster = movie.poster;
// 		var imdbid = movie.imdb_id;
// 		if (poster && imdbid) {
// 			promises.push(fetchImage(poster, imdbid))
// 		}
// 	});
// 	return Q.allSettled(promises);
// }

// poster_sizes = original, w154, w342, w45
function fetchPosters(list){
	list = _.isArray(list) ? list : [list];
  var sizes = ['original', 'w154', 'w342', 'w45'];
  var promises = [];
  list.forEach(function(movie){
  	// Get Poster
    var poster = movie.original_poster_path;
    if (poster) {
      sizes.forEach(function(size){
        promises.push(downloadImage(poster, size));
      });
    }
    // Get Backdrop
    var backdrop = movie.original_backdrop_path;
    if (backdrop){
    	promises.push(downloadAndPrepareBackdrop(backdrop));
    }
  });
  return parallelLimit(promises, 50);
}

// xxx we should be checking tmdb for configuration, regarding
// basename, size options, etc.
function downloadImage(name, size){
  var deferred = Q.defer();
  var destination = path.join(__dirname, '../../public/movies/', size, name);
  var url = 'http://d3gtl9l2a4fn1j.cloudfront.net/t/p/'+ size + name;
  var stream = fs.createWriteStream(destination);
  var req = request(url).pipe(stream);
  req.on('close', deferred.resolve);
  req.on('error', deferred.reject);
  stream.on('error', deferred.reject);
  return deferred.promise;
}

function downloadAndPrepareBackdrop(name){
	return downloadImage(name, 'w1280')
		.then(function(){
			return prepareBackdrop(path.join(__dirname, '../../public/movies/w1280', name))
		});
}

function prepareBackdrop(path){
	var deferred = Q.defer();
	gm(path)
		.noProfile()
		.modulate(85, 20, 100)
		.quality(70)
		.write(path, function(err){
			if (err) return deferred.reject(err);
			return deferred.resolve();
		});
		return deferred.promise;
}


exports.fetchPosters = fetchPosters;

module.exports = exports;