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
			if (backupNode.name) {
				node.name = backupNode.name;
				node.outputs = backupNode.outputs;
				node.updateText();
			} else {
				// old format
				// punt the updating of the format to ferris frontend
				node.text = backupNode.text;
			}
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
				if (backupLink.condition) {
					link.condition = backupLink.condition;
					link.outputs = backupLink.outputs;
					link.updateText();
				} else {
					// old format
					// punt the updating of the format to ferris frontend
					link.text = backupLink.text;
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
			'text': node.text,
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
				'text': link.text,
				'condition': link.condition,
				'outputs': link.outputs,
				'anchorAngle': link.anchorAngle,
			};
		} else if(link instanceof StartLink) {
			backupLink = {
				'type': 'StartLink',
				'node': nodes.indexOf(link.node),
				'text': link.text,
				'deltaX': link.deltaX,
				'deltaY': link.deltaY,
			};
		} else if(link instanceof Link) {
			backupLink = {
				'type': 'Link',
				'nodeA': nodes.indexOf(link.nodeA),
				'nodeB': nodes.indexOf(link.nodeB),
				'text': link.text,
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
