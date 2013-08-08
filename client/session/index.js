var Emitter = require('emitter');
var store = require('store');
var each = require('each');
var Session = require('session-variables');

var currentSession = new Session().setDefault('primary_display', 'movies');

module.exports = currentSession;