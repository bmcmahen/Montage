var Spinner = require('spinner');
var spinning = false;
var el = document.getElementById('spinner');
var s;

module.exports = {

	show: function(){
		if (spinning) return;
		s = new Spinner().light().size(25);
		el.appendChild(s.el);
		spinning = true;
	},

	hide: function(){
		if (s) s.stop();
		spinning = false;
		el.removeChild(s.el);
	}

};
