var page = require("webpage").create();
var system = require("system");

var opts = JSON.parse(system.args[1]);


page.viewportSize = opts.resolution;
page.open(opts.url, function() {

	try {
		page.clipRect = {
				top:    102,
				left:   382,
				width:  opts.resolution.width-382,
				height: opts.resolution.height-102
		};
		page.render(opts.path);
	} catch (e) {
		console.error(e);
	}
	phantom.exit();
});
