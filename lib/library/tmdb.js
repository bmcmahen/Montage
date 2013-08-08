var RateLimiter = require('limiter').RateLimiter;
var Q = require('q');
var mdb = require('moviedb')('53a0a1c45450e016d2e8b2e898142081');

// TMDB Ratelimits to 30 queries every 10 seconds, or 3 queries every second.
var limiter = new RateLimiter(3, 'second');

/**
 * Search TMDB API for a movie.
 * @param  {String} title
 * @param  {Number} year
 * @return {Object} results -> arr.results[0], etc.
 */

function search(title, year){
  var deferred = Q.defer();
  var params = { query : title };
  if (year) params.year = year;
  limiter.removeTokens(1, function(err, remaining){
    if (err) {
      deferred.reject(err);
      console.log(err);
    }
    else mdb.searchMovie(params, deferred.makeNodeResolver());
  });
  return deferred.promise;
}

exports.search = search;

/**
 * TMDB doesn't provide some useful information in
 * the search results, so we need to query those
 * separately after we get the imdb_id.
 * @param  {String} id
 * @return {Object}    meta results
 */

function getDetail(id){
  var deferred = Q.defer();
  limiter.removeTokens(1, function(err, remaining){
    if (err) {
      console.log('rejecting', err);
      deferred.reject(err);
    }
    else mdb.movieInfo({ id: id}, deferred.makeNodeResolver());
  });
  return deferred.promise;
}

exports.getDetail = getDetail;



/**
 * Map the information provided by TMDB into
 * our own format.
 * @param  {Object} data
 * @return {Object}
 */

function normalize(data){
  return {
    original_backdrop_path: data.backdrop_path,
    belongs_to_collection: data.belongs_to_collection,
    budget: data.budget,
    genres: data.genres,
    tmdb_id: data.id,
    imdb_id: data.imdb_id,
    original_title: data.original_title,
    plot: data.overview,
    original_poster_path: data.poster_path,
    production_companies: data.production_companies,
    production_countries: data.production_countries,
    release_date: data.release_date,
    revenue: data.revenue,
    runtime: data.runtime,
    spoken_languages: data.spoken_languages,
    title: data.title
  }
}

exports.normalize = normalize;