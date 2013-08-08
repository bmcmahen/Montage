var Methods = require('../sockets/methods');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var currentVideo = false;
var path = require('path');

// vlc, omx, or mplayer.
var player = 'vlc';

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
	console.log(this.path);
	this.pipe = 'videocontrol';
	this.isPlaying = false;
	exec('mkfifo '+ this.pipe);
}

Video.prototype.play = function(){
	if (this.isPlaying) return;
	var path = this.isTorrent
		? 'http://localhost:3000/stream/'+this.json._id
		: this.path;

	switch(player) {
		case 'vlc':
			console.log('play in vlc');
			exec('/Applications/VLC.app/Contents/MacOS/VLC ' + path + ' ' + VLC_ARGS, function(err, stdout, stderr){
				console.log(err, stdout, stderr);
			});
			// exec('/Applications/VLC.app/Contents/MacOS/VLC ' + this.path + ' < '+ this.pipe, function(err, stdout, stderr){
			// 	console.log(err, stdout, stderr);
			// });
			return;
		case 'omx':
			if (this.isTorrent) {

				return;
			}
			exec('omxplayer -o hdmi < '+ this.pipe, function(err, stdout, stderr){
				console.log(stdout);
			});
			this.sendKey('.');
			return;
	}
	this.isPlaying = true;
	return this;
};

Video.prototype.pause = function(){
	switch(player){
		case 'omx': this.sendKey('p'); return;
	}
}

Video.prototype.sendKey = function(key){
	if (!this.pipe) return;
	exec('echo -n '+ key +' > '+ this.pipe);
};

Video.prototype.stop = function(){

};

Video.prototype.ffwd = function(){
	this.sendKey("$'\\x1b\\x5b\\x43'");
};

Video.prototype.rewind = function(){
	this.sendKey("$'\\x1b\\x5b\\x44'");
};

Video.prototype.destroy = function(){
	exec('rm '+ this.pipe);
	this.isPlaying = false;
};

Video.prototype.volume = function(int){
	// vlc --volume int
};

Methods.add({

	playVideo: function(video){
		console.log('play');
		control(video).play();
		return true;
	},

	forwardVideo: function(video){
		console.log('ffwd');
		control(video).ffwd();
		return true;
	},

	backwardVideo: function(video){
		console.log('rewind');
		control(video).rewind();
		return true;
	},

	pauseVideo: function(video){
		console.log('pause');
		control(video).pause();
	}
});