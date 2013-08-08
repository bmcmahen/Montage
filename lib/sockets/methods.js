var _ = require('underscore');
var Q = require('q');

var methodHandlers = {};

/**
 * Pass object of functions to methods to create
 * method handlers.
 * @param  {Object} methods
 */

var methods = exports.add = function(methods){
  _.each(methods, function (func, name){
    if (methodHandlers[name])
      throw new Error("A method with this name already exists.");
    methodHandlers[name] = func;
  });
};

/**
 * Call a method
 * @param  {String} name
 */

var call = exports.call = function(name){
  var fn;
  var args = Array.prototype.slice.call(arguments, 1);
  if (args.length && typeof args[args.length - 1] === 'function')
    fn = args.pop();

  return this.apply(name, args, fn);
};

/**
 * Apply a method
 * @param  {String}   name
 * @param  {Array}   args
 * @param  {Function} fn
 */

var apply = exports.apply = function(name, args, fn){
  var handler = methodHandlers[name];
  if (!handler) return fn(new Error('Method' + name + ' was not found.'));
  args = (args || []);
  Q.when(handler.apply(null, args))
    .then(function(results){ fn(null, results); })
    .fail(function(err){
      fn(new Error('An error occurred on the server.'))
      console.log(err);
    })
    .done();
}

