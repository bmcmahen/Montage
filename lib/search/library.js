var db = require('../database');

function findMovies(query, fn){
  db.movies.find({ title : query }, function(err, results){
    if (err) return fn(err);
    fn(null, results);
  });
};

module.exports = findMovies;