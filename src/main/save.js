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
				if (backupLink.type == 'StartLink') {
					// skip any sort of text importing here
				} else if (backupLink.text) {
					let result = parseSlashedEdge(backupLink.text, true);
					link.condition = result.condition;
					link.outputs = result.output;
					link.updateText();
				} else {
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
