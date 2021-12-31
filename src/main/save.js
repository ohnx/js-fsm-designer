function importJson(jsonString) {
	if(!JSON) {
		return;
	}

	try {
		var backup = JSON.parse(jsonString);
		nodes = [];
		links = [];
		canvas.width = backup.canvasWidth || canvas.width;
		canvas.height = backup.canvasHeight || canvas.height;
		canvasWidthInput.value = canvas.width;
		canvasHeightInput.value = canvas.height;

		for(var i = 0; i < backup.nodes.length; i++) {
			var backupNode = backup.nodes[i];
			var node = new Node(backupNode.x, backupNode.y);
			node.isAcceptState = backupNode.isAcceptState;
			node.text = backupNode.text;
			nodes.push(node);
		}
		for(var i = 0; i < backup.links.length; i++) {
			var backupLink = backup.links[i];
			var link = null;
			if(backupLink.type == 'SelfLink') {
				link = new SelfLink(nodes[backupLink.node]);
				link.anchorAngle = backupLink.anchorAngle;
				link.text = backupLink.text;
			} else if(backupLink.type == 'StartLink') {
				link = new StartLink(nodes[backupLink.node]);
				link.deltaX = backupLink.deltaX;
				link.deltaY = backupLink.deltaY;
				link.text = backupLink.text;
			} else if(backupLink.type == 'Link') {
				link = new Link(nodes[backupLink.nodeA], nodes[backupLink.nodeB]);
				link.parallelPart = backupLink.parallelPart;
				link.perpendicularPart = backupLink.perpendicularPart;
				link.text = backupLink.text;
				link.lineAngleAdjust = backupLink.lineAngleAdjust;
			}
			if(link != null) {
				links.push(link);
			}
		}
	} catch(e) {
		alert("Can't import that file!");
	}
}

function exportJson() {
	if(!JSON) {
		return;
	}

	var backup = {
		'nodes': [],
		'links': [],
		'canvasWidth': canvas.width,
		'canvasHeight': canvas.height
	};
	for(var i = 0; i < nodes.length; i++) {
		var node = nodes[i];
		var backupNode = {
			'x': node.x,
			'y': node.y,
			'text': node.text,
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
				'lineAngleAdjust': link.lineAngleAdjust,
				'parallelPart': link.parallelPart,
				'perpendicularPart': link.perpendicularPart,
			};
		}
		if(backupLink != null) {
			backup.links.push(backupLink);
		}
	}

	return JSON.stringify(backup);
}

function convert(obj, meta) {
  let output = {};
  output.version = 2;
  output.meta = meta;
  output.machine = {};
  output.machine.nodes = obj.nodes.map((x, i) => {
    return {
      id: i,
      name: x.text
    };
  });
  output.machine.edges = obj.links.map((x, i) => {
    let res = {};
    if (x.type == 'StartLink') {
      if (output.meta.reset) {
        // TODO: send message to user that we are overwriting the reset node
      }
      output.meta.reset = x.node;
      return;
    } else if (x.type == 'Link') {
      res.start = x.nodeA;
      res.end = x.nodeB;
    } else if (x.type == 'SelfLink') {
      res.start = x.node;
      res.end = x.node;
    }

    let condOut = x.text.split('/');
    if (condOut.length != 2) {
      // oops
    }
    res.condition = condOut[0].split(' ').join('');
    let outputVars = condOut[1].split(' ').join('');
    res.output = outputVars.length > 0 ? outputVars.split(',') : [];

    return res;
  }).filter(x => x);

  return output;
};

let meta = {
  name: "NFTB_fsm",
  // reset state will be determined
  signals: {
    // signals (input/output) 
    input: [
      {
        // input signals have a name and a width
        name: "fifo_empty",
        width: 1
      },
      {name: "free_outbound", width: 1}
    ],
    output: [
      // output signals also have an extra parameter:
      // for width = 1 signals, if they are inverted
      // inverted == true if they are ACTIVE LOW
      // inverted == false if they are ACTIVE HIGH
      // for width > 1 signals, a "default" setting (if not specified, defaults to 0)
      {name: "fifo_read", width: 1, inverted: false},
      {name: "buf_en", width: 1, inverted: false},
      {name: "sel", width: 2},
      {name: "put_outbound", width: 1, inverted: false}
    ]
  }
};


// log levels go from 0 (debug) to 5 (bad)
const TEST_OPTIONS = {
  // options for outputType:
  // file (have stuff like `default_nettype + module),
  // module (input/output, etc.). Use name as module name
  // code (just the FSM itself)
  outputType: "file",
  // clock and reset options are only used for file/module options
  clock: {
    // name of the clock signal
    name: "clock",
    // edge to care about (options are posedge or negedge)
    edge: "posedge"
  },
  reset: {
    // name of reset signal
    name: "reset_n",
    // edge to care about (options are posedge or negedge)
    edge: "negedge"
  },
  // in case we need to remap
  cstate: "cstate",
  nstate: "nstate",
  // style:
  style: {
    // indent by what (can put spaces/tabs/whatever in here)
    indent: "  ",
    // skip outputting the transition to same state
    skipOutputTransitionToSameState: true,
  },
  // the logger to use
  logger: function(level, message) {
    console.log(`Log ${level}: ${message}`);
  },
};

function exportVerilog() {
	let fsmData = JSON.parse(exportJson());
	return window.highroller.convert(convert(fsmData, meta), TEST_OPTIONS);
}

function saveAsVerilog() {
	var verilogLink = document.getElementById('verilogLink');
	verilogLink.download = 'exportedToVerilog.sv';
	verilogLink.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(exportVerilog());
}
