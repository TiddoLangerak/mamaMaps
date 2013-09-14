var express = require("express");
var path = require("path");
var uuid = require("uuid");
var fs = require("fs");
var url = require("url");
var phantom = require("phantom");
var debug = require("debug");
var log = debug("MamasMaps:log");
var plog = debug("MamasMaps:phantom");

var emptyFunc = function(){};


var getPort = (function() {
	var	min = 12345;
	var max = 22345;
	var current = 12345;
	return function getPort() {
		if (current >= max) {
			current = min;
		}
		return current++;
	}
}());





//Lifetime of the images, 30 minutes
var fileLifetime = 1000 * 60 * 30;

//port to listen on
var port = process.env.PORT || 8080;
//Paths to files and stuff
var clientPath = path.join(__dirname, "../client");
var mapPath = path.join(clientPath, "maps");

//cleanup files
log("deleting old files...");
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
	log(JSON.stringify(opts));


	phantom.create({port : getPort() },function (handle) {
		plog("Created new phantom insance");
		handle.createPage(function (page) {
			page.set("viewportSize", opts.resolution);
			plog("Opening " + opts.url);
			page.open(opts.url, function(status) {
				plog("Opened " + opts.url);
				plog("Status: " + status);
				if (status !== "success") {
					res.send("Oops, er is iets misgegaan. Probeer het later opnieuw.");
					handle.exit();
					return;
				}

				page.set("clipRect", {
						top:    102,
						left:   382,
						width:  opts.resolution.width-382,
						height: opts.resolution.height-102
				});
				plog("Writing screenshot to " + opts.path);
				var interval = setInterval(function() {
					page.evaluate(function() {
						return document.getElementById("loadmessagehtml").style.display;
					}, function(display) {
						if (display === "none") { 
							clearInterval(interval);
							page.render(opts.path, function() {
								plog("Written to" + opts.path + " successfully");
								res.header("Location", "maps/" + fileName);
								res.send(303);
								setTimeout(fs.unlink, fileLifetime, opts.path, emptyFunc);
								handle.exit();
							});
						}
					});
				}, 250);
				

			});
		});

	});


/*
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
		log(stdout);
		log(stderr);

		setTimeout(fs.unlink, fileLifetime, opts.path, function(){});

	});
	*/


});

log("Starting server on port " + port);
app.listen(port);
