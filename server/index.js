var express = require("express");
var path = require("path");
var uuid = require("uuid");
var childProcess = require("child_process");
var fs = require("fs");
var url = require("url");


//Lifetime of the images, 30 minutes
var fileLifetime = 1000 * 60 * 30;
//path to phantomjs executable
var phantomjsPath = require("phantomjs").path;
//port to listen on
var port = process.env.PORT || 8080;
//Paths to files and stuff
var clientPath = path.join(__dirname, "../client");
var mapPath = path.join(clientPath, "maps");

//cleanup files
console.log("deleting old files...");
var files = fs.readdirSync(mapPath);
for (var i = 0; i < files.length; i++) {
	fs.unlinkSync(path.join(mapPath, files[i]));
}

var app = express();

app.use(express.static(clientPath));
app.use(express.bodyParser());

app.post("/generateMap", function(req, res) {
	if (!req.body.url) {
		res.send("Geen url meegegeven. Probeer opnieuw");
	}

	var fileName = uuid.v1() + ".png";
	var filePath = path.join(mapPath, fileName);

	var q = parseInt(req.body.quality, 10) - 1;

	var urlParts = url.parse(req.body.url, true);
	if (urlParts.query.z && req.body.quality) {
		urlParts.query.z = parseInt(urlParts.query.z, 10) + q;
		delete urlParts.search;
	}
	var newUrl = url.format(urlParts);

	
	var width = parseInt(req.body.width || 1920, 10);
	var height = parseInt(req.body.height || 1080, 10);

	//we should do some transformations on the width & height to get the right quality.
	//we want to scale the map size. Every point increase in quality should double
	//both dimensions of the map.
	//the page however has some useless junk around itself, so to calculate the new
	//size we should do the following:
	//-substract the sizes of the borders and stuff
	//-scale
	//-add the sizes of borders and stuff again
	//
	
	width -= 382;
	height -= 102;

	width = width << q;
	height = height << q;

	width += 382;
	height += 102;


	var opts = {
		url : newUrl,
	  resolution : {
			width : width,
			height: height
		},
		path : filePath,
		q : req.body.quality
	};
	console.log(opts);

	var phantomArgs = [
		path.join(__dirname, "mapGenerator.js"),
		JSON.stringify(opts)
	];

	childProcess.execFile(phantomjsPath, phantomArgs, function(err, stdout, stderr) {
		if (err) {
			return res.send("Er is iets misgegaan.\nError: " + err);
		}

		res.header("Location", "maps/" + fileName);
		res.send(303);
		console.log(stdout);
		console.log(stderr);

		setTimeout(fs.unlink, fileLifetime, opts.path, function(){});

	});


});

console.log("Starting server on port " + port);
app.listen(port);
