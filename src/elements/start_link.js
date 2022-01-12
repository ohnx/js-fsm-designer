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
