var _ = require('underscore');

// XXX remove cruft, map our functions.

var pubHandlers = {}, pub;

// Create a new publish function with a given name and function
exports.add = function(pubs){
  _.each(pubs, function (func, name){
    if (pubHandlers[name]) throw new Error('A pub with this name already exists.');
    pubHandlers[name] = new Publish(name, func);
  });
};

exports.subscribe = function(name, id, fn){
  if (pub = pubHandlers[name]) pub.subscribe(id, fn);
};

exports.unsubscribe = function(name, id){
  if (pub = pubHandlers[name]) pub.unsubscribe(id);
};

exports.send = function(name, user){
  if (pub = pubHandlers[name]) pub.send(user);
};

exports.added = function(name, doc){
  if (pub = pubHandlers[name]) pub.added(doc);
};

exports.changed = function(name, doc){
  if (pub = pubHandlers[name]) pub.changed(doc);
};

exports.removed = function(name, doc){
  if (pub = pubHandlers[name]) pub.removed(doc);
};

/////////////
// Publish //
/////////////

function Publish(name, query){
  this.subscribers = {};
  this.name = name;
  this.query = query;
}

Publish.prototype.subscribe = function(id, cb){
  this.subscribers[id] = cb;
};

Publish.prototype.unsubscribe = function(id){
  delete this.subscribers[id];
};

// Run our query (probably to the database) and send the
// results to each of our subscribers. If we are knowingly
// altering a particular publish dataset, then we can trigger

Publish.prototype.send = function(user){
  // send to one user only...
  if (user) {
    var sub = this.subscribers[user];
    if (sub) {
      this.query(function(err, res){
        sub(err, res);
      });
    }
  // or to everyone
  } else {
    var cbs = this.subscribers;
    this.query(function(err, res){
      _.each(cbs, function(cb){
        cb(err, res);
      });
    });
  }
};

// XXX These don't really follow the same pattern
// of the above send paradigm. It allows us on the
// server side to send only added, changed, or
// removed messages to our subscribers (instead of
// the entire data set). But we need to know that
// the document does, indeed, belong to the
// correct pub. Ideally, we'd monitor the
// query and perform a diff of the results, and
// send the appropriate added, changed, removed
// events that way (like what Meteor does). But for our purposes
// that's overkill.

Publish.prototype.added = function(doc){
  _.each(this.subscribers, function(cb){
    cb(null, doc, 'added');
  });
};

Publish.prototype.changed = function(doc){
  _.each(this.subscribers, function(cb){
    cb(null, doc, 'changed');
  });
};

Publish.prototype.removed = function(doc){
  _.each(this.subscribers, function(cb){
    cb(null, doc, 'removed');
  });
};


