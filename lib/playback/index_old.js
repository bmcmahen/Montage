var Methods = require('../sockets/methods');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var currentVideo = false;
var path = require('path');

// vlc, omx, or mplayer.
var player = 'omx';

var VLC_ARGS = '-q --video-on-top --play-and-exit';
var OMX_EXEC = 'omxplayer -r -o local ';
var MPLAYER_EXEC = 'mplayer -ontop -really-quiet -noidx -loop 0 ';


function control(json){
	if (currentVideo._id === json._id) return currentVideo;
	if (currentVideo) currentVideo.stop();
	currentVideo = new Video(json);
	return currentVideo;
}

function Video(json){
	this.json = json;
	if (this.json.torrent) {
		// we need to stream torrents.
		this.isTorrent = true;
	}
	this.path = JSON.stringify(path.normalize(json.path));
	this.hasStarted = false;
}

Video.prototype.start = function(){
	if (!this.pipe) {
		this.pipe = 'videocontrol';
		exec('mkfifo '+ this.pipe);
		var path = this.isTorrent
			? 'http://localhost:3000/stream/'+ this.json._id
			: this.path;

		var cmd = 'omxplayer -o local --vol 6 ';
		var self = this;
		exec(cmd + this.path + ' < ' + this.pipe, function(err){
			if (!err) {
				self.hasStarted = true;
				self.sendKey('.');
			}
		});
	}
};

Video.prototype.sendKey = function(key){
	if (!this.pipe) return;
	exec('echo -n '+ key +' > '+ this.pipe);
};

Video.prototype.play = Video.prototype.pause = function(){
	if (!this.pipe) this.start()
	this.sendKey('p');
};


Video.prototype.stop = function(){
	this.sendKey('q');
	exec('rm '+ this.pipe);
	delete this.pipe;
	this.hasStarted = false;
}

Video.prototype.forward = function(){
	this.sendKey("\x5b\x43");
};

Video.prototype.backward = function(){
	this.sendKey("\x5b\x43");
};

Video.prototype.volumeUp = function(){
	this.sendKey('+');
};

Video.prototype.volumeDown = function(){
	this.sendKey('-');
};

Video.prototype.toggleSubtitles = function(){
	this.sendKey('s');
};

Video.prototype.nextSubtitleStream = function(){
	this.sendKey('m');
};

Video.prototype.previousSubtitleStream = function(){
	this.sendKey('n');
};

Video.prototype.nextChapter = function(){
	this.sendKey('o');
};

Video.prototype.previousChapter = function(){
	this.sendKey('i');
}

Methods.add({

	playVideo: function(video, options){
		p
		return true;
	},

	forwardVideo: function(video){
		control(video).ffwd();
		return true;
	},

	backwardVideo: function(video){
		control(video).rewind();
		return true;
	},

	pauseVideo: function(video){
		console.log('pause');
		control(video).pause();
	}
});