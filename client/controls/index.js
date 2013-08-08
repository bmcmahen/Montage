var VideoControls = function(){
	this.currentlyPlaying = false;
}

VideoControls.prototype.playVideo = function(model){
	var self = this;
	this.stopVideo(function(){
		ddp.call('playVideo', model.get('path'), function(err, res){
			if (!err) self.currentlyPlaying = model;
		})
	});
}

VideoControls.prototype.stopVideo = function(fn){
	if (this.currentlyPlaying) {
		ddp.call('stopVideo', function(err, res){
			console.log(err, res);
			fn();
		});
	} else {
		fn();
	}
}

module.exports = new VideoControls();