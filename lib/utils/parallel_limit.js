var Q = require('q');

/**
 * Run promises in parallel, with a limit. This is useful
 * when you run into errors for running too much in
 * parallel, like spawns (for node-gm).
 * @param  {Array} promises
 * @param  {Number} limit        number to run in parallel
 * @param  {Mixed} initialValue to pass to our set
 * @return {Promises}
 */

function parallelLimit(promises, limit, initialValue){
	var grouped = group(promises, limit);
	var promiseSets = grouped.map(function(set){
		return Q.all(set);
	});
	return promiseSets.reduce(function (soFar, f){
		return soFar.then(f);
	}, Q(initialValue));
}

module.exports = parallelLimit;

/**
 * Group an array into chunks given a range.
 * @param  {Array} array
 * @param  {Number} range
 * @return {Array}
 */

function group(array, range){
	var grouped = [];
	for (var i = 0, len = array.length; i < len; i+=range){
		grouped.push(array.slice(i, i + range));
	}
	return grouped;
}