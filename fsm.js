/*
 Finite State Machine Designer (http://madebyevan.com/fsm/)
 License: MIT License (see below)

 Copyright (c) 2010 Evan Wallace

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the "Software"), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 OTHER DEALINGS IN THE SOFTWARE.
*/

var greekLetterNames = [ 'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega' ];

function convertLatexShortcuts(text) {
	// html greek characters
	for(var i = 0; i < greekLetterNames.length; i++) {
		var name = greekLetterNames[i];
		text = text.replace(new RegExp('\\\\' + name, 'g'), String.fromCharCode(913 + i + (i > 16)));
		text = text.replace(new RegExp('\\\\' + name.toLowerCase(), 'g'), String.fromCharCode(945 + i + (i > 16)));
	}

	// subscripts
	//for(var i = 0; i < 10; i++) {
	//	text = text.replace(new RegExp('_' + i, 'g'), String.fromCharCode(8320 + i));
	//}

	return text;
}

function textToXML(text) {
	text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	var result = '';
	for(var i = 0; i < text.length; i++) {
		var c = text.charCodeAt(i);
		if(c >= 0x20 && c <= 0x7E) {
			result += text[i];
		} else {
			result += '&#' + c + ';';
		}
	}
	return result;
}

function drawArrow(c, x, y, angle) {
	var dx = Math.cos(angle);
	var dy = Math.sin(angle);
	c.beginPath();
	c.moveTo(x, y);
	c.lineTo(x - 8 * dx + 5 * dy, y - 8 * dy - 5 * dx);
	c.lineTo(x - 8 * dx - 5 * dy, y - 8 * dy + 5 * dx);
	c.fill();
}

function canvasHasFocus() {
	return (document.activeElement || document.body) == document.body;
}

let fontFamily = '"Helvetica Neue", "Arial", sans-serif';
// in px
let fontHeight = 20;

// returns x/y/h/w bounding box
function drawText(c, text, x, y, angleOrNull, isSelected) {
	c.font = `${fontHeight}px ${fontFamily}`;
	var measure = c.measureText(text);
	var width = measure.width;
	var height = fontHeight;

	let lines = text.split('\n');

	// TODO: multiline
	for (var i = 0; i < lines.length; i++) {
		return drawTextLine(c, lines[i], x, y + i*fontHeight, angleOrNull, isSelected);
	}

	return null;
}

function drawTextLine(c, text, x, y, angleOrNull, isSelected) {
	c.font = `${fontHeight}px ${fontFamily}`;
	var measure = c.measureText(text);
	var width = measure.width;
	var height = fontHeight;

	// temporarily set line width to 1
	var oldLineWidth = c.lineWidth;
	c.lineWidth = 1;

	// center the text
	x -= width / 2;

	// position the text intelligently if given an angle
	if(angleOrNull != null) {
		var cos = Math.cos(angleOrNull);
		var sin = Math.sin(angleOrNull);
		var cornerPointX = (width / 2 + 5) * (cos > 0 ? 1 : -1);
		var cornerPointY = (10 + 5) * (sin > 0 ? 1 : -1);
		var slide = sin * Math.pow(Math.abs(sin), 40) * cornerPointX - cos * Math.pow(Math.abs(cos), 10) * cornerPointY;
		x += cornerPointX - sin * slide;
		y += cornerPointY + cos * slide;
	}

	// draw text
	x = Math.round(x);
	y = Math.round(y);
	c.fillText(text, x, y + 6);

	c.lineWidth = oldLineWidth;

	return {
		x: x,
		y: y + 6 - measure.actualBoundingBoxAscent, 
		h: height + measure.actualBoundingBoxDescent,
		w: width
	};
}

var canvas;
var nodeRadius = 50;
var nodes = [];
var links = [];
var states = [];
var statesIndex = -1;

var snapToPadding = 6; // pixels
var hitTargetPadding = 6; // pixels
var selectedObject = null; // either a Link or a Node
var currentLink = null; // a Link
var movingObject = false;
var movingAllObjects = false;
var originalClick;

var currentScale = 1; // scaling factor to zoom in/out
var translateX = 0.5, translateY = 0.5; // translation factors

// line widths
var nodeLineWidth = 1, linkLineWidth = 1;

var canvasBackground = 'white';
var canvasForeground = 'black';
var canvasSelected = '#007bff';
var canvasWarning = '#dc3545';

/* dark mode
var canvasBackground = 'black'; //'white';
var canvasForeground = 'white'; //'black';
var canvasSelected = '#1F97FF'; //'blue';
*/

function drawUsing(c) {
	c.beginPath();
	c.fillStyle = canvasBackground;
	c.rect(0, 0, canvas.width, canvas.height);
	c.fill();
	c.save();
	c.translate(translateX, translateY);
	c.scale(currentScale, currentScale);

	for(var i = 0; i < nodes.length; i++) {
		c.lineWidth = nodeLineWidth;
		c.fillStyle = c.strokeStyle = (nodes[i] == selectedObject) ? canvasSelected : canvasForeground;
		nodes[i].draw(c);
	}
	for(var i = 0; i < links.length; i++) {
		c.lineWidth = linkLineWidth;
		c.fillStyle = c.strokeStyle = (links[i] == selectedObject) ? canvasSelected : canvasForeground;
		links[i].draw(c);
	}
	if(currentLink != null) {
		c.lineWidth = linkLineWidth;
		c.fillStyle = c.strokeStyle = canvasForeground;
		currentLink.draw(c);
	}

	c.restore();
}

function draw() {
	drawUsing(canvas.getContext('2d'));
}

// convert mouse coords in canvas to the proper x,y coords in canvas
function mouseToCanvasCoords(mouseCoords) {
	let x = mouseCoords.x, y = mouseCoords.y;

	let transformed = {
		x: x - translateX + 0.5,
		y: y - translateY + 0.5
	};

	transformed.x /= currentScale;
	transformed.y /= currentScale;

	return transformed;
}

function selectObject(x, y) {
	let result = _old_selectObject(x, y);

	if (result && window.ferris) {
		if (result instanceof Node) {
			window.ferris.editItem('node', result);
		} else if (!(result instanceof StartLink)) {
			window.ferris.editItem('edge', result);
		}
	}

	if (!result) {
		// cancel changes to old item
		window.ferris.commitEditItem(true);
	}

	return result;
}

function findObjectAtCoords(x, y) {
	// just finds the object, doesn't select it
	return _old_selectObject(x, y);
}

function _old_selectObject(x, y) {
	for(var i = 0; i < nodes.length; i++) {
		if(nodes[i].containsPoint(x, y)) {
			return nodes[i];
		}
	}
	for(var i = 0; i < links.length; i++) {
		if(links[i].containsPoint(x, y)) {
			return links[i];
		}
	}
	return null;
}

function snapNode(node) {
	for(var i = 0; i < nodes.length; i++) {
		if(nodes[i] == node) continue;

		if(Math.abs(node.x - nodes[i].x) < snapToPadding) {
			node.x = nodes[i].x;
		}

		if(Math.abs(node.y - nodes[i].y) < snapToPadding) {
			node.y = nodes[i].y;
		}
	}
}

window.onload = function() {
	canvas = document.getElementById('canvas');
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	let mediaListener = window.matchMedia('(prefers-color-scheme: dark)');

	if (mediaListener.matches) {
		canvasBackground = '#111111'; //'white';
		canvasForeground = '#ffffff'; //'black';
		canvasSelected = '#00A4FB'; //'blue';
		canvasWarning = '#dc3545'; //'red';
	} else { // light mode
		canvasBackground = '#ffffff';
		canvasForeground = '#000000';
		canvasSelected = '#007bff';
		canvasWarning = '#dc3545';
	}

	mediaListener.addEventListener('change', function(event) {
		if (event.matches) { // dark mode
			canvasBackground = '#111111'; //'white';
			canvasForeground = '#ffffff'; //'black';
			canvasSelected = '#00A4FB'; //'blue';
			canvasWarning = '#dc3545'; //'red';
		} else { // light mode
			canvasBackground = '#ffffff';
			canvasForeground = '#000000';
			canvasSelected = '#007bff';
			canvasWarning = '#dc3545';
		}
		draw();
	});

	updateStates();
	draw();

	document.querySelectorAll(".canvasSizeInput").forEach(function(elem) {
		elem.addEventListener("keypress", function(e) {
			if(e.key === "Enter") {
				setCanvasSize();
			}
		});
	});

	window.addEventListener('resize', function(e) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		draw();
	}, false);

	canvas.onmousedown = function(e) {
		var mouse = crossBrowserRelativeMousePos(e);
		var canvasCoords = mouseToCanvasCoords(mouse);
		var tappedObject = findObjectAtCoords(canvasCoords.x, canvasCoords.y);
		// don't change selectedObject on mousedown unless we click on something else
		if (tappedObject == null) {
			
		} else {
			selectedObject = selectObject(canvasCoords.x, canvasCoords.y);
		}
		movingObject = false;
		originalClick = canvasCoords;

		if(tappedObject != null) {
			if(e.shiftKey && selectedObject instanceof Node) {
				currentLink = new SelfLink(selectedObject, canvasCoords);
			} else if (!selectedObject.intersectedLabel) {
				movingObject = true;
				deltaMouseX = deltaMouseY = 0;
				if(selectedObject.setMouseStart) {
					selectedObject.setMouseStart(canvasCoords.x, canvasCoords.y);
				}
			}

		} else if(e.shiftKey) {
			currentLink = new TemporaryLink(canvasCoords, canvasCoords);
		} else {
			movingAllObjects = true;
			canvas.style.cursor = "all-scroll";
		}

		draw();

		if(canvasHasFocus()) {
			// disable drag-and-drop only if the canvas is already focused
			return false;
		} else {
			// otherwise, let the browser switch the focus away from wherever it was
			return true;
		}
	};

	canvas.ondblclick = function(e) {
		var mouse = crossBrowserRelativeMousePos(e);
		var canvasCoords = mouseToCanvasCoords(mouse);
		selectedObject = selectObject(canvasCoords.x, canvasCoords.y);

		if(selectedObject == null) {
			selectedObject = new Node(canvasCoords.x, canvasCoords.y);
			nodes.push(selectedObject);
			if (window.ferris) window.ferris.editItem('node', selectedObject);
			draw();
		}

		updateStates();
	};

	var prevMouse = null;
	var mouse = null;

	canvas.onmousemove = function(e) {
		prevMouse = mouse;
		mouse = crossBrowserRelativeMousePos(e);
		var canvasCoords = mouseToCanvasCoords(mouse);

		if(currentLink != null) {
			var targetNode = selectObject(canvasCoords.x, canvasCoords.y);
			if(!(targetNode instanceof Node)) {
				targetNode = null;
			}

			if(selectedObject == null) {
				if(targetNode != null) {
					currentLink = new StartLink(targetNode, originalClick);
				} else {
					currentLink = new TemporaryLink(originalClick, canvasCoords);
				}
			} else {
				if(targetNode == selectedObject) {
					currentLink = new SelfLink(selectedObject, canvasCoords);
				} else if(targetNode != null) {
					currentLink = new Link(selectedObject, targetNode);
				} else {
					currentLink = new TemporaryLink(selectedObject.closestPointOnCircle(canvasCoords.x, canvasCoords.y), canvasCoords);
				}
			}
			draw();
		}

		else if(movingObject) {
			selectedObject.setAnchorPoint(canvasCoords.x, canvasCoords.y);
			if(selectedObject instanceof Node) {
				snapNode(selectedObject);
			}
			draw();
		}

		else if(movingAllObjects) {
			translateX += mouse.x - prevMouse.x;
			translateY += mouse.y - prevMouse.y;

			draw();
		}
	};

	canvas.onmouseup = function(e) {
		canvas.style.cursor = "default";
		movingObject = false;
		movingAllObjects = false;

		if(currentLink != null) {
			if(!(currentLink instanceof TemporaryLink)) {
				selectedObject = currentLink;
				if (!(currentLink instanceof StartLink)) {
					if (window.ferris) window.ferris.editItem('edge', currentLink);
				} else {
					// clear the current editing item no matter what
					if (window.ferris) window.ferris.commitEditItem(true);
				}
				
				links.push(currentLink);
			}
			currentLink = null;
			draw();
		}

		updateStates();
	};

	// zoom in/out
	canvas.onwheel = function (e) {
		e.preventDefault();
		// only care about y scroll
		currentScale += e.deltaY * -0.01;
		if (currentScale <= 0.05) {
			currentScale = 0.05;
		} else if (currentScale >= 35) {
			currentScale = 35;
		}
		draw();
	};
};

function deleteItem(obj) {
	for(var i = 0; i < nodes.length; i++) {
		if(nodes[i] == obj) {
			nodes.splice(i--, 1);
		}
	}
	for(var i = 0; i < links.length; i++) {
		if(links[i] == obj || links[i].node == obj || links[i].nodeA == obj || links[i].nodeB == obj) {
			links.splice(i--, 1);
		}
	}
}

document.onkeydown = function(e) {
	var key = crossBrowserKey(e);

	// do this even if we don't have focus
	if (key == 27) { // escape key
		if(selectedObject != null) {
			// don't save changes and cancel commit
			if (!(selectedObject instanceof StartLink) && selectedObject.text.length == 0) {
				// also delete this object
				deleteItem(selectedObject);
			}
			selectedObject = null;
			if (window.ferris) window.ferris.commitEditItem(true);
			draw();
		} else {
			// close the sidebar
			if (window.ferris) window.ferris.toggleShow(false);
		}

		e.preventDefault();
	} else if(key == 46) { // delete key
		if(selectedObject != null) {
			deleteItem(selectedObject);
			updateStates();
			selectedObject = null;
			if (window.ferris) window.ferris.commitEditItem(true);
			draw();
		}
	}

	// undo on macOS
	if (e.metaKey) {
		// do this even if we don't have focus
		if(key == 68) {// command d
			if(selectedObject != null) {
				deleteItem(selectedObject);
				updateStates();
				selectedObject = null;
				if (window.ferris) window.ferris.commitEditItem(true);
				draw();
			}
			e.preventDefault();
		}
		
		if(!canvasHasFocus()) {
			// don't read keystrokes when other things have focus
			return true;
		}

		if (key == 90) {// command z
			getPreviousState();
			e.preventDefault();
		} else if(key == 89) {// command y
			getNextState();
			e.preventDefault();
		}
	}
};

document.onkeyup = function(e) {
	var key = crossBrowserKey(e);

	if (e.ctrlKey) {
		if (key == 90) // ctrl z
			getPreviousState();
		else if(key == 89) // ctrl y
			getNextState();
	}

	updateStates();
};

function crossBrowserKey(e) {
	e = e || window.event;
	return e.which || e.keyCode;
}

function crossBrowserElementPos(e) {
	e = e || window.event;
	var obj = e.target || e.srcElement;
	var x = 0, y = 0;
	while(obj.offsetParent) {
		x += obj.offsetLeft;
		y += obj.offsetTop;
		obj = obj.offsetParent;
	}
	return { 'x': x, 'y': y };
}

function crossBrowserMousePos(e) {
	e = e || window.event;
	return {
		'x': e.pageX || e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft,
		'y': e.pageY || e.clientY + document.body.scrollTop + document.documentElement.scrollTop,
	};
}

function crossBrowserRelativeMousePos(e) {
	var element = crossBrowserElementPos(e);
	var mouse = crossBrowserMousePos(e);
	return {
		'x': mouse.x - element.x,
		'y': mouse.y - element.y
	};
}

function output(text) {
	var element = document.getElementById('output');
	element.style.display = 'block';
	element.value = text;
}

function setCanvasSize() {
	if(canvas.width !== canvasWidthInput.value) {
		var diff = (canvasWidthInput.value - canvas.width) / 2;

		for(var i = 0; i < nodes.length; i++)
			nodes[i].x += diff;
	}
	
	canvas.width = canvasWidthInput.value;
	canvas.height = canvasHeightInput.value;
	draw();
	updateStates();
}

function updateStates() {
	var newState = exportJson();

	if(newState !== states[statesIndex]) {
		statesIndex++;
		states.length = statesIndex;
		states.push(exportJson());
	}
	if (window.ferris) window.ferris.saveState();
}

function getPreviousState() {
	statesIndex--;

	if(statesIndex < 0) {
		statesIndex = 0;
		return;
	}

	state = states[statesIndex];
	if (window.ferris) window.ferris.commitEditItem(true);
	importJson(state);
	draw();
}

function getNextState() {
	statesIndex++;
	
	if(statesIndex >= states.length) {
		statesIndex = states.length - 1;
		return;
	}

	state = states[statesIndex];
	if (window.ferris) window.ferris.commitEditItem(true);
	importJson(state);
	draw();
}

function updateSelectedObject(name, condition, outputs) {
	if (condition) {
		selectedObject.condition = condition;
	} else if (name) {
		selectedObject.name = name;
	}

	selectedObject.outputs = outputs;
	if (selectedObject.updateText) selectedObject.updateText();
	selectedObject = null;
	updateStates();
	draw();
}

function clearErrors() {
	for(var i = 0; i < nodes.length; i++) {
		nodes[i].errors = [];
	}
	for(var i = 0; i < links.length; i++) {
		links[i].errors = [];
	}
}

function addError(itemType, idx, data) {
	if (itemType == 'link') {
		links[idx].errors.push(data);
	} else if (itemType == 'node') {
		nodes[idx].errors.push(data);
	}
}

// returns map of {condition: 'asdf', output: ['a1', 'a2']}
// may return null if error occurred
// if newOkay is passed, then it will not return null, but instead return empty
// condition w/ no output
function parseSlashedEdge(singlestr, newOkay) {
	let res = {};

	let condOut = singlestr.split('/');
	if (condOut.length != 2) {
		// TODO: error out here
		if (newOkay) {
			// new thing okay
			return {condition: singlestr, output: []};
		}
		return null;
	}

	res.condition = condOut[0].split(' ').join('');
	let outputVars = condOut[1].split(' ').join('');
	res.output = outputVars.length > 0 ? outputVars.split(',') : [];

	return res;
}

function importJson(jsonString) {
	if(!JSON) {
		return;
	}

	try {
		var backup;
		if (typeof jsonString === 'string' || jsonString instanceof String) {
			backup = JSON.parse(jsonString);
		} else {
			backup = jsonString;
		}
		nodes = [];
		links = [];

		for(var i = 0; i < backup.nodes.length; i++) {
			var backupNode = backup.nodes[i];
			var node = new Node(backupNode.x, backupNode.y);
			node.isAcceptState = backupNode.isAcceptState;
			if (backupNode.text) {
				let result = parseSlashedEdge(backupNode.text, true);
				node.name = result.condition;
				node.outputs = result.output;
			} else {
				node.name = backupNode.name;
				node.outputs = backupNode.outputs;
			}

			node.updateText();
			nodes.push(node);
		}
		for(var i = 0; i < backup.links.length; i++) {
			var backupLink = backup.links[i];
			var link = null;
			if(backupLink.type == 'SelfLink') {
				link = new SelfLink(nodes[backupLink.node]);
				link.anchorAngle = backupLink.anchorAngle;
			} else if(backupLink.type == 'StartLink') {
				link = new StartLink(nodes[backupLink.node]);
				link.deltaX = backupLink.deltaX;
				link.deltaY = backupLink.deltaY;
			} else if(backupLink.type == 'Link') {
				link = new Link(nodes[backupLink.nodeA], nodes[backupLink.nodeB]);
				link.parallelPart = backupLink.parallelPart;
				link.perpendicularPart = backupLink.perpendicularPart;
				link.lineAngleAdjust = backupLink.lineAngleAdjust;
			}

			if(link != null) {
				if (backupLink.text) {
					let result = parseSlashedEdge(backupLink.text, true);
					link.condition = result.condition;
					link.outputs = result.output;
					link.updateText();
				} else if (backupLink.type != 'StartLink') {
					link.condition = backupLink.condition;
					link.outputs = backupLink.outputs;
					link.updateText();
				}

				links.push(link);
			}
		}

		currentScale = backup.scale;
		translateX = backup.position.x;
		translateY = backup.position.y;
	} catch(e) {
		// TODO: don't alert(), lol
		alert("Can't import that file!");
		console.error(e);
	}
}

function exportJson(asObject) {
	if(!JSON) {
		return;
	}

	var backup = {
		'nodes': [],
		'links': [],
		'scale': currentScale,
		'position': {x: translateX, y: translateY},
		
	};
	for(var i = 0; i < nodes.length; i++) {
		var node = nodes[i];
		var backupNode = {
			'x': node.x,
			'y': node.y,
			'name': node.name,
			'outputs': node.outputs,
			'isAcceptState': node.isAcceptState,
		};
		backup.nodes.push(backupNode);
	}
	for(var i = 0; i < links.length; i++) {
		var link = links[i];
		var backupLink = null;
		if(link instanceof SelfLink) {
			backupLink = {
				'type': 'SelfLink',
				'node': nodes.indexOf(link.node),
				'condition': link.condition,
				'outputs': link.outputs,
				'anchorAngle': link.anchorAngle,
			};
		} else if(link instanceof StartLink) {
			backupLink = {
				'type': 'StartLink',
				'node': nodes.indexOf(link.node),
				'deltaX': link.deltaX,
				'deltaY': link.deltaY,
			};
		} else if(link instanceof Link) {
			backupLink = {
				'type': 'Link',
				'nodeA': nodes.indexOf(link.nodeA),
				'nodeB': nodes.indexOf(link.nodeB),
				'condition': link.condition,
				'outputs': link.outputs,
				'lineAngleAdjust': link.lineAngleAdjust,
				'parallelPart': link.parallelPart,
				'perpendicularPart': link.perpendicularPart,
			};
		}
		if(backupLink != null) {
			backup.links.push(backupLink);
		}
	}

	return asObject ? backup : JSON.stringify(backup);
}

function det(a, b, c, d, e, f, g, h, i) {
	return a*e*i + b*f*g + c*d*h - a*f*h - b*d*i - c*e*g;
}

function circleFromThreePoints(x1, y1, x2, y2, x3, y3) {
	var a = det(x1, y1, 1, x2, y2, 1, x3, y3, 1);
	var bx = -det(x1*x1 + y1*y1, y1, 1, x2*x2 + y2*y2, y2, 1, x3*x3 + y3*y3, y3, 1);
	var by = det(x1*x1 + y1*y1, x1, 1, x2*x2 + y2*y2, x2, 1, x3*x3 + y3*y3, x3, 1);
	var c = -det(x1*x1 + y1*y1, x1, y1, x2*x2 + y2*y2, x2, y2, x3*x3 + y3*y3, x3, y3);
	return {
		'x': -bx / (2*a),
		'y': -by / (2*a),
		'radius': Math.sqrt(bx*bx + by*by - 4*a*c) / (2*Math.abs(a))
	};
}

function fixed(number, digits) {
	return number.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
}

function transformPoint(matrix, p) {
	return {
		x: matrix.a * p.x + matrix.c * p.y + matrix.e,
		y: matrix.b * p.x + matrix.d * p.y + matrix.f,
	};
}

// draw using this instead of a canvas and call toLaTeX() afterward
function ExportAsLaTeX() {
	this._points = [];
	this._texData = '';
	this._scale = 0.1; // to convert pixels to document space (TikZ breaks if the numbers get too big, above 500?)

	this.toLaTeX = function() {
		return '\\documentclass[12pt]{article}\n' +
			'\\usepackage{tikz}\n' +
			'\n' +
			'\\begin{document}\n' +
			'\n' +
			'\\begin{center}\n' +
			'\\begin{tikzpicture}[scale=0.2]\n' +
			'\\tikzstyle{every node}+=[inner sep=0pt]\n' +
			this._texData +
			'\\end{tikzpicture}\n' +
			'\\end{center}\n' +
			'\n' +
			'\\end{document}\n';
	};

	this.beginPath = function() {
		this._points = [];
	};
	this.arc = function(x, y, radius, startAngle, endAngle, isReversed) {
		x *= this._scale;
		y *= this._scale;
		radius *= this._scale;
		if(endAngle - startAngle == Math.PI * 2) {
			this._texData += '\\draw [' + this.strokeStyle + '] (' + fixed(x, 3) + ',' + fixed(-y, 3) + ') circle (' + fixed(radius, 3) + ');\n';
		} else {
			if(isReversed) {
				var temp = startAngle;
				startAngle = endAngle;
				endAngle = temp;
			}
			if(endAngle < startAngle) {
				endAngle += Math.PI * 2;
			}
			// TikZ needs the angles to be in between -2pi and 2pi or it breaks
			if(Math.min(startAngle, endAngle) < -2*Math.PI) {
				startAngle += 2*Math.PI;
				endAngle += 2*Math.PI;
			} else if(Math.max(startAngle, endAngle) > 2*Math.PI) {
				startAngle -= 2*Math.PI;
				endAngle -= 2*Math.PI;
			}
			startAngle = -startAngle;
			endAngle = -endAngle;
			this._texData += '\\draw [' + this.strokeStyle + '] (' + fixed(x + radius * Math.cos(startAngle), 3) + ',' + fixed(-y + radius * Math.sin(startAngle), 3) + ') arc (' + fixed(startAngle * 180 / Math.PI, 5) + ':' + fixed(endAngle * 180 / Math.PI, 5) + ':' + fixed(radius, 3) + ');\n';
		}
	};
	this.moveTo = this.lineTo = function(x, y) {
		x *= this._scale;
		y *= this._scale;
		this._points.push({ 'x': x, 'y': y });
	};
	this.stroke = function() {
		if(this._points.length == 0) return;
		this._texData += '\\draw [' + this.strokeStyle + ']';
		for(var i = 0; i < this._points.length; i++) {
			var p = this._points[i];
			this._texData += (i > 0 ? ' --' : '') + ' (' + fixed(p.x, 2) + ',' + fixed(-p.y, 2) + ')';
		}
		this._texData += ';\n';
	};
	this.fill = function() {
		if(this._points.length == 0) return;
		this._texData += '\\fill [' + this.strokeStyle + ']';
		for(var i = 0; i < this._points.length; i++) {
			var p = this._points[i];
			this._texData += (i > 0 ? ' --' : '') + ' (' + fixed(p.x, 2) + ',' + fixed(-p.y, 2) + ')';
		}
		this._texData += ';\n';
	};
	this.measureText = function(text) {
		var c = canvas.getContext('2d');
		c.font = '20px "Times New Romain", serif';
		return c.measureText(text);
	};
	this.advancedFillText = function(text, originalText, x, y, angleOrNull) {
		if(text.replace(' ', '').length > 0) {
			var nodeParams = '';
			// x and y start off as the center of the text, but will be moved to one side of the box when angleOrNull != null
			if(angleOrNull != null) {
				var width = this.measureText(text).width;
				var dx = Math.cos(angleOrNull);
				var dy = Math.sin(angleOrNull);
				if(Math.abs(dx) > Math.abs(dy)) {
					if(dx > 0) nodeParams = '[right] ', x -= width / 2;
					else nodeParams = '[left] ', x += width / 2;
				} else {
					if(dy > 0) nodeParams = '[below] ', y -= 10;
					else nodeParams = '[above] ', y += 10;
				}
			}
			x *= this._scale;
			y *= this._scale;
			this._texData += '\\draw (' + fixed(x, 2) + ',' + fixed(-y, 2) + ') node ' + nodeParams + '{$' + originalText.replace(/ /g, '\\mbox{ }') + '$};\n';
		}
	};

	this.translate = this.save = this.restore = this.clearRect = function(){};
}

// draw using this instead of a canvas and call toSVG() afterward
function ExportAsSVG() {
	this.fillStyle = 'black';
	this.strokeStyle = 'black';
	this.lineWidth = 1;
	this.font = '12px Arial, sans-serif';
	this._points = [];
	this._svgData = '';
	this._transX = 0;
	this._transY = 0;

	this.toSVG = function() {
		return '<?xml version="1.0" standalone="no"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n\n<svg width="800" height="600" version="1.1" xmlns="http://www.w3.org/2000/svg">\n' + this._svgData + '</svg>\n';
	};

	this.beginPath = function() {
		this._points = [];
	};
	this.arc = function(x, y, radius, startAngle, endAngle, isReversed) {
		x += this._transX;
		y += this._transY;
		var style = 'stroke="' + this.strokeStyle + '" stroke-width="' + this.lineWidth + '" fill="none"';

		if(endAngle - startAngle == Math.PI * 2) {
			this._svgData += '\t<ellipse ' + style + ' cx="' + fixed(x, 3) + '" cy="' + fixed(y, 3) + '" rx="' + fixed(radius, 3) + '" ry="' + fixed(radius, 3) + '"/>\n';
		} else {
			if(isReversed) {
				var temp = startAngle;
				startAngle = endAngle;
				endAngle = temp;
			}

			if(endAngle < startAngle) {
				endAngle += Math.PI * 2;
			}

			var startX = x + radius * Math.cos(startAngle);
			var startY = y + radius * Math.sin(startAngle);
			var endX = x + radius * Math.cos(endAngle);
			var endY = y + radius * Math.sin(endAngle);
			var useGreaterThan180 = (Math.abs(endAngle - startAngle) > Math.PI);
			var goInPositiveDirection = 1;

			this._svgData += '\t<path ' + style + ' d="';
			this._svgData += 'M ' + fixed(startX, 3) + ',' + fixed(startY, 3) + ' '; // startPoint(startX, startY)
			this._svgData += 'A ' + fixed(radius, 3) + ',' + fixed(radius, 3) + ' '; // radii(radius, radius)
			this._svgData += '0 '; // value of 0 means perfect circle, others mean ellipse
			this._svgData += +useGreaterThan180 + ' ';
			this._svgData += +goInPositiveDirection + ' ';
			this._svgData += fixed(endX, 3) + ',' + fixed(endY, 3); // endPoint(endX, endY)
			this._svgData += '"/>\n';
		}
	};
	this.moveTo = this.lineTo = function(x, y) {
		x += this._transX;
		y += this._transY;
		this._points.push({ 'x': x, 'y': y });
	};
	this.stroke = function() {
		if(this._points.length == 0) return;
		this._svgData += '\t<polygon stroke="' + this.strokeStyle + '" stroke-width="' + this.lineWidth + '" points="';
		for(var i = 0; i < this._points.length; i++) {
			this._svgData += (i > 0 ? ' ' : '') + fixed(this._points[i].x, 3) + ',' + fixed(this._points[i].y, 3);
		}
		this._svgData += '"/>\n';
	};
	this.fill = function() {
		if(this._points.length == 0) return;
		this._svgData += '\t<polygon fill="' + this.fillStyle + '" stroke-width="' + this.lineWidth + '" points="';
		for(var i = 0; i < this._points.length; i++) {
			this._svgData += (i > 0 ? ' ' : '') + fixed(this._points[i].x, 3) + ',' + fixed(this._points[i].y, 3);
		}
		this._svgData += '"/>\n';
	};
	this.measureText = function(text) {
		var c = canvas.getContext('2d');
		c.font = '20px "Times New Roman", serif';
		return c.measureText(text);
	};
	this.fillText = function(text, x, y) {
		x += this._transX;
		y += this._transY;
		if(text.replace(' ', '').length > 0) {
			this._svgData += '\t<text x="' + fixed(x, 3) + '" y="' + fixed(y, 3) + '" font-family="Times New Roman" font-size="20">' + textToXML(text) + '</text>\n';
		}
	};
	this.translate = function(x, y) {
		this._transX = x;
		this._transY = y;
	};

	this.save = this.restore = this.clearRect = function(){};
}

function SelfLink(node, mouse) {
	this.node = node;
	this.anchorAngle = 0;
	this.mouseOffsetAngle = 0;
	this.text = '';
	this.condition = '';
	this.outputs = [];
	this.textBounds = null;
	this.intersectedLabel = false;
	this.errors = []; //'ahhh';

	if(mouse) {
		this.setAnchorPoint(mouse.x, mouse.y);
	}
}

SelfLink.prototype.setMouseStart = function(x, y) {
	this.mouseOffsetAngle = this.anchorAngle - Math.atan2(y - this.node.y, x - this.node.x);
};

SelfLink.prototype.setAnchorPoint = function(x, y) {
	this.anchorAngle = Math.atan2(y - this.node.y, x - this.node.x) + this.mouseOffsetAngle;
	// snap to 90 degrees
	var snap = Math.round(this.anchorAngle / (Math.PI / 2)) * (Math.PI / 2);
	if(Math.abs(this.anchorAngle - snap) < 0.1) this.anchorAngle = snap;
	// keep in the range -pi to pi so our containsPoint() function always works
	if(this.anchorAngle < -Math.PI) this.anchorAngle += 2 * Math.PI;
	if(this.anchorAngle > Math.PI) this.anchorAngle -= 2 * Math.PI;
};

SelfLink.prototype.getEndPointsAndCircle = function() {
	var effectiveNodeRadius = nodeRadius + nodeLineWidth/2;
	var circleX = this.node.x + 1.5 * effectiveNodeRadius * Math.cos(this.anchorAngle);
	var circleY = this.node.y + 1.5 * effectiveNodeRadius * Math.sin(this.anchorAngle);
	var circleRadius = 0.75 * effectiveNodeRadius;
	var startAngle = this.anchorAngle - Math.PI * 0.8;
	var endAngle = this.anchorAngle + Math.PI * 0.8;
	var startX = circleX + circleRadius * Math.cos(startAngle);
	var startY = circleY + circleRadius * Math.sin(startAngle);
	var endX = circleX + circleRadius * Math.cos(endAngle);
	var endY = circleY + circleRadius * Math.sin(endAngle);
	return {
		'hasCircle': true,
		'startX': startX,
		'startY': startY,
		'endX': endX,
		'endY': endY,
		'startAngle': startAngle,
		'endAngle': endAngle,
		'circleX': circleX,
		'circleY': circleY,
		'circleRadius': circleRadius
	};
};

SelfLink.prototype.draw = function(c) {
	var stuff = this.getEndPointsAndCircle();
	var oldColor = null;
	this.textBounds = null;

	if (this.errors.length > 0 && c.fillStyle == canvasForeground) {
		oldColor = c.fillStyle;
		c.fillStyle = c.strokeStyle = canvasWarning;
	}

	// draw arc
	c.beginPath();
	c.arc(stuff.circleX, stuff.circleY, stuff.circleRadius, stuff.startAngle, stuff.endAngle, false);
	c.stroke();
	// draw the text on the loop farthest from the node
	var textX = stuff.circleX + stuff.circleRadius * Math.cos(this.anchorAngle);
	var textY = stuff.circleY + stuff.circleRadius * Math.sin(this.anchorAngle);
	this.textBounds = drawText(c, this.text, textX, textY, this.anchorAngle, selectedObject == this);
	// draw the head of the arrow
	drawArrow(c, stuff.endX, stuff.endY, stuff.endAngle + Math.PI * 0.4);

	if (oldColor) {
		c.fillStyle = c.strokeStyle = oldColor;
	}
};

SelfLink.prototype.labelContainsPoint = function(stuff, x, y) {
	if (!this.textBounds) return;
	if ((x >= this.textBounds.x - hitTargetPadding) &&
		(x <= (this.textBounds.x + this.textBounds.w + hitTargetPadding))) {
		if ((y >= this.textBounds.y - hitTargetPadding) &&
			(y <= (this.textBounds.y + this.textBounds.h + hitTargetPadding))) {
			this.intersectedLabel = true;
			return true;
		}
	}
	return false;
};

SelfLink.prototype.containsPoint = function(x, y) {
	this.intersectedLabel = false;
	var stuff = this.getEndPointsAndCircle();
	var dx = x - stuff.circleX;
	var dy = y - stuff.circleY;
	var distance = Math.sqrt(dx*dx + dy*dy) - stuff.circleRadius;
	return (Math.abs(distance) < hitTargetPadding) ||
			this.labelContainsPoint(stuff, x, y);
};

SelfLink.prototype.updateText = function() {
	this.text = `${this.condition} / ${this.outputs.join(', ')}`;
};

function Link(a, b) {
	this.nodeA = a;
	this.nodeB = b;
	this.text = '';
	this.condition = '';
	this.outputs = [];
	this.lineAngleAdjust = 0; // value to add to textAngle when link is straight line
	this.textBounds = null;
	this.intersectedLabel = false;
	this.errors = [];

	// make anchor point relative to the locations of nodeA and nodeB
	this.parallelPart = 0.5; // percentage from nodeA to nodeB
	this.perpendicularPart = -30; // pixels from line between nodeA and nodeB
}

Link.prototype.getAnchorPoint = function() {
	var dx = this.nodeB.x - this.nodeA.x;
	var dy = this.nodeB.y - this.nodeA.y;
	var scale = Math.sqrt(dx * dx + dy * dy);
	return {
		'x': this.nodeA.x + dx * this.parallelPart - dy * this.perpendicularPart / scale,
		'y': this.nodeA.y + dy * this.parallelPart + dx * this.perpendicularPart / scale
	};
};

Link.prototype.setAnchorPoint = function(x, y) {
	var dx = this.nodeB.x - this.nodeA.x;
	var dy = this.nodeB.y - this.nodeA.y;
	var scale = Math.sqrt(dx * dx + dy * dy);
	this.parallelPart = (dx * (x - this.nodeA.x) + dy * (y - this.nodeA.y)) / (scale * scale);
	this.perpendicularPart = (dx * (y - this.nodeA.y) - dy * (x - this.nodeA.x)) / scale;
	// snap to a straight line
	if(this.parallelPart > 0 && this.parallelPart < 1 && Math.abs(this.perpendicularPart) < snapToPadding) {
		this.lineAngleAdjust = (this.perpendicularPart < 0) * Math.PI;
		this.perpendicularPart = 0;
	}
};

Link.prototype.getEndPointsAndCircle = function() {
	if(this.perpendicularPart == 0) {
		var midX = (this.nodeA.x + this.nodeB.x) / 2;
		var midY = (this.nodeA.y + this.nodeB.y) / 2;
		var start = this.nodeA.closestPointOnCircle(midX, midY);
		var end = this.nodeB.closestPointOnCircle(midX, midY);
		return {
			'hasCircle': false,
			'startX': start.x,
			'startY': start.y,
			'endX': end.x,
			'endY': end.y,
		};
	}
	var anchor = this.getAnchorPoint();
	var circle = circleFromThreePoints(this.nodeA.x, this.nodeA.y, this.nodeB.x, this.nodeB.y, anchor.x, anchor.y);
	var isReversed = (this.perpendicularPart > 0);
	var reverseScale = isReversed ? 1 : -1;
	var startAngle = Math.atan2(this.nodeA.y - circle.y, this.nodeA.x - circle.x) - reverseScale * (nodeRadius + nodeLineWidth/2) / circle.radius;
	var endAngle = Math.atan2(this.nodeB.y - circle.y, this.nodeB.x - circle.x) + reverseScale * (nodeRadius + nodeLineWidth/2) / circle.radius;
	var startX = circle.x + circle.radius * Math.cos(startAngle);
	var startY = circle.y + circle.radius * Math.sin(startAngle);
	var endX = circle.x + circle.radius * Math.cos(endAngle);
	var endY = circle.y + circle.radius * Math.sin(endAngle);
	return {
		'hasCircle': true,
		'startX': startX,
		'startY': startY,
		'endX': endX,
		'endY': endY,
		'startAngle': startAngle,
		'endAngle': endAngle,
		'circleX': circle.x,
		'circleY': circle.y,
		'circleRadius': circle.radius,
		'reverseScale': reverseScale,
		'isReversed': isReversed,
	};
};

Link.prototype.draw = function(c) {
	var stuff = this.getEndPointsAndCircle();
	var oldColor = null;
	this.textBounds = null;
	this.intersectedLabel = false;

	if (this.errors.length > 0 && c.fillStyle == canvasForeground) {
		oldColor = c.fillStyle;
		c.fillStyle = c.strokeStyle = canvasWarning;
	}

	// draw arc
	c.beginPath();
	if(stuff.hasCircle) {
		c.arc(stuff.circleX, stuff.circleY, stuff.circleRadius, stuff.startAngle, stuff.endAngle, stuff.isReversed);
	} else {
		c.moveTo(stuff.startX, stuff.startY);
		c.lineTo(stuff.endX, stuff.endY);
	}
	c.stroke();
	// draw the head of the arrow
	if(stuff.hasCircle) {
		drawArrow(c, stuff.endX, stuff.endY, stuff.endAngle - stuff.reverseScale * (Math.PI / 2));
	} else {
		drawArrow(c, stuff.endX, stuff.endY, Math.atan2(stuff.endY - stuff.startY, stuff.endX - stuff.startX));
	}
	// draw the text
	if(stuff.hasCircle) {
		var startAngle = stuff.startAngle;
		var endAngle = stuff.endAngle;
		if(endAngle < startAngle) {
			endAngle += Math.PI * 2;
		}
		var textAngle = (startAngle + endAngle) / 2 + stuff.isReversed * Math.PI;
		var textX = stuff.circleX + stuff.circleRadius * Math.cos(textAngle);
		var textY = stuff.circleY + stuff.circleRadius * Math.sin(textAngle);
		this.textBounds = drawText(c, this.text, textX, textY, textAngle, selectedObject == this);
	} else {
		var textX = (stuff.startX + stuff.endX) / 2;
		var textY = (stuff.startY + stuff.endY) / 2;
		var textAngle = Math.atan2(stuff.endX - stuff.startX, stuff.startY - stuff.endY);
		this.textBounds = drawText(c, this.text, textX, textY, textAngle + this.lineAngleAdjust, selectedObject == this);
	}

	if (oldColor) {
		c.fillStyle = c.strokeStyle = oldColor;
	}
};

Link.prototype.containsPoint = function(x, y) {
	var stuff = this.getEndPointsAndCircle();
	return this.lineContainsPoint(stuff, x, y) || this.labelContainsPoint(stuff, x, y);
};

Link.prototype.labelContainsPoint = function(stuff, x, y) {
	if (!this.textBounds) return;
	if ((x >= this.textBounds.x - hitTargetPadding) &&
		(x <= (this.textBounds.x + this.textBounds.w + hitTargetPadding))) {
		if ((y >= this.textBounds.y - hitTargetPadding) &&
			(y <= (this.textBounds.y + this.textBounds.h + hitTargetPadding))) {
			this.intersectedLabel = true;
			return true;
		}
	}
	return false;
};

Link.prototype.lineContainsPoint = function(stuff, x, y) {
	if(stuff.hasCircle) {
		var dx = x - stuff.circleX;
		var dy = y - stuff.circleY;
		var distance = Math.sqrt(dx*dx + dy*dy) - stuff.circleRadius;
		if(Math.abs(distance) < hitTargetPadding) {
			var angle = Math.atan2(dy, dx);
			var startAngle = stuff.startAngle;
			var endAngle = stuff.endAngle;
			if(stuff.isReversed) {
				var temp = startAngle;
				startAngle = endAngle;
				endAngle = temp;
			}
			if(endAngle < startAngle) {
				endAngle += Math.PI * 2;
			}
			if(angle < startAngle) {
				angle += Math.PI * 2;
			} else if(angle > endAngle) {
				angle -= Math.PI * 2;
			}
			return (angle > startAngle && angle < endAngle);
		}
	} else {
		var dx = stuff.endX - stuff.startX;
		var dy = stuff.endY - stuff.startY;
		var length = Math.sqrt(dx*dx + dy*dy);
		var percent = (dx * (x - stuff.startX) + dy * (y - stuff.startY)) / (length * length);
		var distance = (dx * (y - stuff.startY) - dy * (x - stuff.startX)) / length;
		return (percent > 0 && percent < 1 && Math.abs(distance) < hitTargetPadding);
	}
	return false;
};

Link.prototype.updateText = function() {
	this.text = `${this.condition} / ${this.outputs.join(', ')}`;
};

function TemporaryLink(from, to) {
	this.from = from;
	this.to = to;
}

TemporaryLink.prototype.draw = function(c) {
	// draw the line
	c.beginPath();
	c.moveTo(this.to.x, this.to.y);
	c.lineTo(this.from.x, this.from.y);
	c.stroke();

	// draw the head of the arrow
	drawArrow(c, this.to.x, this.to.y, Math.atan2(this.to.y - this.from.y, this.to.x - this.from.x));
};

function Node(x, y) {
	this.x = x;
	this.y = y;
	this.mouseOffsetX = 0;
	this.mouseOffsetY = 0;
	this.text = '';
	this.name = '';
	this.outputs = [];
	this.errors = [];
}

Node.prototype.setMouseStart = function(x, y) {
	this.mouseOffsetX = this.x - x;
	this.mouseOffsetY = this.y - y;
};

Node.prototype.setAnchorPoint = function(x, y) {
	this.x = x + this.mouseOffsetX;
	this.y = y + this.mouseOffsetY;
};

Node.prototype.draw = function(c) {
	var oldColor = null;

	if (this.errors.length > 0 && c.fillStyle == canvasForeground) {
		oldColor = c.fillStyle;
		c.fillStyle = c.strokeStyle = canvasWarning;
	}

	// draw the circle
	c.beginPath();
	c.arc(this.x, this.y, nodeRadius, 0, 2 * Math.PI, false);
	c.stroke();

	// draw the text
	drawText(c, this.text, this.x, this.y, null, selectedObject == this);

	if (oldColor) {
		c.fillStyle = c.strokeStyle = oldColor;
	}
};

Node.prototype.closestPointOnCircle = function(x, y) {
	var dx = x - this.x;
	var dy = y - this.y;
	var effectiveNodeRadius = nodeRadius + nodeLineWidth/2;
	var scale = Math.sqrt(dx * dx + dy * dy);
	return {
		'x': this.x + dx * effectiveNodeRadius / scale,
		'y': this.y + dy * effectiveNodeRadius / scale,
	};
};

Node.prototype.containsPoint = function(x, y) {
	var effectiveNodeRadius = nodeRadius + nodeLineWidth/2;
	return (x - this.x)*(x - this.x) + (y - this.y)*(y - this.y) < effectiveNodeRadius*effectiveNodeRadius;
};

Node.prototype.updateText = function() {
	this.text = (this.outputs.length > 0) ? (`${this.name} / ${this.outputs.join(', ')}`) : this.name;
};

function StartLink(node, start) {
	this.node = node;
	this.deltaX = 0;
	this.deltaY = 0;
	this.intersectedLabel = false;
	this.errors = [];

	if(start) {
		this.setAnchorPoint(start.x, start.y);
	}
}

StartLink.prototype.setAnchorPoint = function(x, y) {
	this.deltaX = x - this.node.x;
	this.deltaY = y - this.node.y;

	if(Math.abs(this.deltaX) < snapToPadding) {
		this.deltaX = 0;
	}

	if(Math.abs(this.deltaY) < snapToPadding) {
		this.deltaY = 0;
	}
};

StartLink.prototype.getEndPoints = function() {
	var startX = this.node.x + this.deltaX;
	var startY = this.node.y + this.deltaY;
	var end = this.node.closestPointOnCircle(startX, startY);
	return {
		'startX': startX,
		'startY': startY,
		'endX': end.x,
		'endY': end.y,
	};
};

StartLink.prototype.draw = function(c) {
	var stuff = this.getEndPoints();
	var oldColor = null;

	if (this.errors.length > 0 && c.fillStyle == canvasForeground) {
		oldColor = c.fillStyle;
		c.fillStyle = c.strokeStyle = canvasWarning;
	}

	// draw the line
	c.beginPath();
	c.moveTo(stuff.startX, stuff.startY);
	c.lineTo(stuff.endX, stuff.endY);
	c.stroke();

	// draw the head of the arrow
	drawArrow(c, stuff.endX, stuff.endY, Math.atan2(-this.deltaY, -this.deltaX));

	if (oldColor) {
		c.fillStyle = c.strokeStyle = oldColor;
	}
};

StartLink.prototype.containsPoint = function(x, y) {
	this.intersectedLabel = false;
	var stuff = this.getEndPoints();
	var dx = stuff.endX - stuff.startX;
	var dy = stuff.endY - stuff.startY;
	var length = Math.sqrt(dx*dx + dy*dy);
	var percent = (dx * (x - stuff.startX) + dy * (y - stuff.startY)) / (length * length);
	var distance = (dx * (y - stuff.startY) - dy * (x - stuff.startX)) / length;
	return ((percent > 0 && percent < 1 && Math.abs(distance) < hitTargetPadding));
};
