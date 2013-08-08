var events = require('events');
var sys = require('sys');
var _ = require('underscore');

var methods = require('./methods');
var publish = require('./publications');


/////////////////////////////////////////
// DDP Server listens for connections  //
/////////////////////////////////////////

var DDPServer = module.exports = function(ws){
  events.EventEmitter.call(this);
  this.socket = ws;
  this.bind();
};

sys.inherits(DDPServer, events.EventEmitter);

DDPServer.prototype.bind = function(){
  var self = this;
  this.socket.on('connection', function(conn){
    var connection = new Connection(conn);
    self.emit('newConnection', connection);
  });
}

/////////////////
// Connections //
/////////////////

var Connection = function(conn){
  this.connection = conn;
  this.subscriptions = [];
  this.id = _.uniqueId(); // xxx replace w/ random uid?
  this.listen();
};

Connection.prototype.listen = function() {
  this.connection.on('message', this.onData.bind(this));
  this.connection.on('close', this.onClose.bind(this));
};

Connection.prototype.onClose = function(){
  // Unsubscribe from any potential subscriptions.
  _.each(this.subscriptions, function(name){
    publish.unsubscribe(name, this.id);
  }, this);
};

Connection.prototype.onData = function(raw) {
  var data = JSON.parse(raw);
  if (!data.msg) return;
  switch (data.msg) {

    case 'connect':
      this.send({ msg : 'connected' });
      break;

    case 'method':
      this.handleMethod(data);
      break;

    case 'sub':
      this.handleSubscription(data);
      break;
  }
};

Connection.prototype.handleSubscription = function(json) {
  var name = json.name;
  var id = json.id;
  var params = json.params;
  var self = this;

  // use the id of our connection and pass that to our
  // subscribe. we will then keep a hash of connId ->
  // callbacks, within each of our subscriptions. We should
  // record which publish functions we have subscribed to,
  // for easy deletion.

  publish.subscribe(name, this.id, function(err, res, type){
    if (!type) self.data(name, id, res); // xxx error handling?
    else if (type === 'added') self.added(name, id, res);
    else if (type === 'changed') self.changed(name, id, res);
    else if (type === 'removed') self.removed(name, id, res);
  });

  this.subscriptions.push(name);
  // We only want to send to our one user, not everyone.
  publish.send(name, this.id);
};

// Deal with methods
Connection.prototype.handleMethod = function(json){
  var name = json.method;
  var id = json.id;
  var params = json.params;
  var self = this;

  methods.apply(name, params, function(err, res){
    if (err) self.result(id, err); // Send error to the client. Careful.
    else if (res) self.result(id, null, res);
  });
};

// Method response
Connection.prototype.result = function(id, err, attr){
  var message = { msg: 'result', id: id };
  if (err) message.error = err;
  else if (attr) message.result = attr;
  this.send(message);
};

// Data isn't part of the DDP protocol, but it basically
// just sends the complete subscription data set every time
// instead of added, removed, changed callbacks. For our
// purposes, this blanket send should be enough.
Connection.prototype.data = function(col, id, docs){
  this.send({
    msg: 'data',
    collection: col,
    id: id,
    fields: docs
  });
};

Connection.prototype.added = function(col, id, fields){
  this.send({
    msg: 'added',
    collection: col,
    id: id,
    fields: fields
  });
};

Connection.prototype.changed = function(col, id, fields, cleared){
  this.send({
    msg: 'changed',
    collection: col,
    id: id,
    fields: fields,
    cleared: cleared
  });
};

Connection.prototype.removed = function(col, id){
  this.send({
    msg: 'removed',
    collection: col,
    id: id
  });
};

Connection.prototype.send = function(json){
  this.connection.send(JSON.stringify(json), function(){});
};

