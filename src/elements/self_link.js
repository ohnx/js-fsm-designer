function SelfLink(node, mouse) {
	this.node = node;
	this.anchorAngle = 0;
	this.mouseOffsetAngle = 0;
	this.text = '';
	this.condition = '';
	this.outputs = [];
	this.textBounds = null;
	this.intersectedLabel = false;
	this.errorText = 'ahh'; //'ahhh';

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

	if (this.errorText && c.fillStyle == canvasForeground) {
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
