var fs = require('fs');
var Builder = require('component-builder');
var jade = require('component-jade');
var write = fs.writeFileSync;
var rework = require('./rework');
var watch = require('node-watch');
var path = require('path');

watch(path.join(__dirname, '../'), build);


function build(){
	console.log('building');
	var builder = new Builder('.');
	builder.addLookup('lib');
	builder.copyAssetsTo('public');
	builder.use(jade);
	builder.use(rework);
	builder.build(function(err, res){
		if (err) return console.log(err);
		write('public/app.js', res.require + res.js);
		write('public/app.css', res.css);
	});
}

build();




// module.exports = function(req, response, next){
// 	var builder = new Builder('.');
// 	builder.addLookup('lib');
// 	builder.copyAssetsTo('public');
// 	builder.use(jade);
// 	builder.use(rework);
// 	builder.build(function(err, res){
// 		if (err) return next(err);
// 		write('public/app.js', res.require + res.js);
// 		write('public/app.css', res.css);
// 		next();
// 	});
// };

