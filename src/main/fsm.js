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
var canvasSelected = 'blue';

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
		} else {
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
				if (window.ferris) window.ferris.editItem('edge', currentLink);
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
		if (currentScale <= 0.005) {
			currentScale = 0.005;
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
			if (selectedObject.text.length == 0) {
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

function updateSelectedObject(input) {
	selectedObject.text = input;
	selectedObject = null;
	updateStates();
	draw();
}
