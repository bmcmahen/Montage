// contains helper
function contains(a, obj) {
  var i = a.length;
  while (i--) {
   if (a[i].file_name === obj.file_name) {
    return true;
   }
  }
  return false;
}

// Difference helper
// XXX this is definitely not very efficient, and would probably
// be much faster even without native methods.
function difference(a1, a2, observer){
  var found;

  // check for new ones
  a1.forEach(function(v1){
    found = contains(a2, v1);
    if (!found) observer.remove(v1);
  });

  // check for removed docs
  a2.forEach(function(v2){
    found = contains(a1, v2);
    if (!found) observer.add(v2);
  });

}

module.exports = difference;

