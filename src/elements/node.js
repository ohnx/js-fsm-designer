function Node(x, y) {
	this.x = x;
	this.y = y;
	this.mouseOffsetX = 0;
	this.mouseOffsetY = 0;
	this.text = '';
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
	// draw the circle
	c.beginPath();
	c.arc(this.x, this.y, nodeRadius, 0, 2 * Math.PI, false);
	c.stroke();

	// draw the text
	drawText(c, this.text, this.x, this.y, null, selectedObject == this);
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
