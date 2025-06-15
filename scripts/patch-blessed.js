#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to blessed's widget.js file
const widgetPath = path.join(__dirname, "..", "node_modules", "blessed", "lib", "widget.js");

try {
	// Read the current widget.js
	let content = fs.readFileSync(widgetPath, "utf8");

	// Check if it's already patched
	if (content.includes("// Static widget imports for bundling")) {
		console.log("✓ Blessed already patched for static bundling");
		process.exit(0);
	}

	// Find the dynamic require pattern
	const dynamicPattern =
		/widget\.classes\.forEach\(function\(name\)\s*{\s*var\s+file\s*=\s*name\.toLowerCase\(\);\s*widget\[name\]\s*=\s*widget\[file\]\s*=\s*require\('\.\/widgets\/'\s*\+\s*file\);\s*}\);/;

	if (!dynamicPattern.test(content)) {
		console.error("Warning: Could not find expected pattern in blessed/lib/widget.js");
		console.error("The file may have already been modified or has a different structure.");
		process.exit(0);
	}

	// Replace with static requires
	const replacement = `// Static widget imports for bundling
var widgets = {
  node: require('./widgets/node'),
  screen: require('./widgets/screen'),
  element: require('./widgets/element'),
  box: require('./widgets/box'),
  text: require('./widgets/text'),
  line: require('./widgets/line'),
  scrollablebox: require('./widgets/scrollablebox'),
  scrollabletext: require('./widgets/scrollabletext'),
  bigtext: require('./widgets/bigtext'),
  list: require('./widgets/list'),
  form: require('./widgets/form'),
  input: require('./widgets/input'),
  textarea: require('./widgets/textarea'),
  textbox: require('./widgets/textbox'),
  button: require('./widgets/button'),
  progressbar: require('./widgets/progressbar'),
  filemanager: require('./widgets/filemanager'),
  checkbox: require('./widgets/checkbox'),
  radioset: require('./widgets/radioset'),
  radiobutton: require('./widgets/radiobutton'),
  prompt: require('./widgets/prompt'),
  question: require('./widgets/question'),
  message: require('./widgets/message'),
  loading: require('./widgets/loading'),
  listbar: require('./widgets/listbar'),
  log: require('./widgets/log'),
  table: require('./widgets/table'),
  listtable: require('./widgets/listtable'),
  // Exclude widgets with optional dependencies
  // terminal: require('./widgets/terminal'), // requires term.js and pty.js
  // image: require('./widgets/image'), // requires node-png
  // ansiimage: require('./widgets/ansiimage'),
  // overlayimage: require('./widgets/overlayimage'),
  // video: require('./widgets/video'),
  layout: require('./widgets/layout')
};

widget.classes.forEach(function(name) {
  var file = name.toLowerCase();
  widget[name] = widget[file] = widgets[file];
});`;

	// Replace the dynamic loading
	content = content.replace(dynamicPattern, replacement);

	// Write the patched file
	fs.writeFileSync(widgetPath, content);
	console.log("✓ Patched blessed for static bundling");
} catch (error) {
	console.error("✗ Failed to patch blessed:", error.message);
	process.exit(1);
}
