var findTorrent = require('./torrent');
var Methods = require('../sockets/methods');


// It's faster to query the local cache of our library
// for searching the library, but we may eventually want
// to plugin more search queries (perhaps youtube?) in whic
// case, we would use this method. Currently it only searches
// isohunt.



Methods.add({
	search: function(query) {
		return findTorrent(query);
	}
});

