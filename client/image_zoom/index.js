var BackgroundZoom = require('background-zoom');
var dom = require('dom');
var $container = dom('#background-image');
var Session = require('session');
var currentZoom;

Session.on('change:imageZoom', zoom);
var holdover = Session.get('imageZoom');
if (holdover) zoom(holdover);

$container.on('click', function(e){
	currentZoom && zoom();
});

function zoom(val){
	if (currentZoom) currentZoom.hide();
	if (val) {
		currentZoom = constructZoom(val.origin, val.url, val.fn);
		if (val.model){
			val.model.on('change:original_backdrop_path', function(model, img){
				if (img) {
					$container
						.find('.zoom-background')
						.css('background-image', 'url("/movies/w1280'+img+'")');
				}
			});
		}
		return;
	}
}

function constructZoom(origin, url, fn){
	var top = 45;
	var left = 0;
	var height = window.innerHeight - 45;
	var width = window.innerWidth;
	var originHeight = origin.width * (height / width);

	var zoom = new BackgroundZoom(url, $container.get())
		.duration(300)
		.setDimensions('100%', '100%')
		.className('zoom-background')
		.target(left, top, width, height)
		.origin(origin.left, origin.top + 130, origin.width, originHeight)
		.show();

	if (fn) fn(zoom);

	return zoom;
}