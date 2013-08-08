var qs = require('qs').stringify;
var request = require('request');
var Q = require('q');

var SEARCH_URL = "http://ca.isohunt.com/js/json.php?";

var normalize = function(data){
  return {
    "title": data.title,
    "url": data.enclosure_url,
    "size": data.size,
    "seeds": data.Seeds,
    "leechers": data.leechers,
    "score": data.votes,
    "_id": data.guid,
    "type": 'torrent'
  };
};

function search(query){
  var deferred = Q.defer();
  var params = qs({ 'ihq' : query, 'rows' : 15 });
  request(SEARCH_URL + params, {json : true}, function(err, res, body){
    if (err) return deferred.reject(err);
    else if (!body.items) return deferred.resolve([]);
    return deferred.resolve(body.items.list.map(normalize));
  });
  return deferred.promise;
}

module.exports = search;