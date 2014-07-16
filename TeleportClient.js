var util = require('util');
var events = require('events');
var Socket = require('socket.io-client');
var patternMatching = require('pattern-matching');

util.inherits(TeleportClient, events.EventEmitter);

module.exports = TeleportClient;

function TeleportClient(params) {
	if(!patternMatching(params, {
		serverAddress: 'notEmptyString',
		autoReconnect: 'integer'
	})) throw new Error('does not match pattern.');

	this._params = params;
}

TeleportClient.prototype._createSocket = function() {
	var socket = new Socket(this._params.serverAddress, {
		forceNew: true
	});

	return socket;
};

TeleportClient.prototype._closeSocket = function() {
	this._socket.packet({
		"type": 1,
		"nsp": "/"
	});

	//some socket.io-client bug
	//if disabled 500 ms delay disconnect message 
	//not sended to server

	//this bug worked if before #close call #send method
	//if call #close method after !connect - all ok :)
	setTimeout(function() {
		this._socket.destroy();
		this._socket.onclose('io client disconnect');
	}.bind(this), 500);
};