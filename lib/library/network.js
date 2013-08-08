var path = require('path');
var fs = require('fs');
var exec = require('child_process').exec;
var Q = require('q');
var db = require('../database');
var publish = require('../sockets/publications');

// Ensure that our network mounts folder exists.
var basePath = path.join(__dirname, '../../network_mounts');
if (! fs.existsSync(basePath)) fs.mkdirSync(basePath);

function getName(p){
  return path.basename(p);
}

function escapePath(p){
  p = p.replace(' ', '\ ');
  return JSON.stringify(p);
}

/**
 * Mount NFS path
 * @param {String} p address & path of the mount source
 */

function addNFS(p){
  var deferred = Q.defer();
  var mountPoint = path.join(basePath, getName(p));
  if (!fs.existsSync(mountPoint)) fs.mkdirSync(mountPoint);
  var str = 'mount -t nfs '+ escapePath(p) +' '+ escapePath(mountPoint);
  exec(str, function(err){
    console.log('exec finished?', err);
    if (err) return deferred.reject(err);
    return deferred.resolve(mountPoint);
  });
  return deferred.promise;
}

/**
 * Attempt to add a network library source, given
 * a network address and type (only NFS is currently
 * supported).
 * @param {path} p    eg. 192.168.0.50:/Volumes/Macintosh HD/Movies/
 * @param {String} type of network (nfs, smb, afp)
 */

function addNetwork(p, type){
  var deferred = Q.defer();
  type = type || 'nfs';
  console.log(p, type);
  try {
    p = path.normalize(p.trim());
  } catch(err){
    return deferred.reject(err);
  }
  if (type === 'nfs') {
    addNFS(p).then(function(mountPoint){
      return db.insert('sources', {
        path: mountPoint,
        type: type
      });
    }).then(function(src){
      publish.added('sources', src);
      return deferred.resolve(src);
    }).fail(function(err){
      deferred.reject(err);
    });
  }
  return deferred.promise;
}

exports.addNetwork = addNetwork;


//////////////
// Methods  //
//////////////

var Methods = require('../sockets/methods');

Methods.add({
  addNetworkMount : function(dir, type){
    return addNetwork(dir, type);
  }
});
