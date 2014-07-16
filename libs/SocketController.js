/*
	Events

		socketMessage
		socketConnect
		socketError
		socketDisconnect
		socketReconnect

	Listenings:

		up:

			needSocketSend

*/

var util = require('util');
var events = require('events');
var Socket = require('socket.io-client');

var debug = require('debug')('TeleportClient-SocketController');

util.inherits(SocketController, events.EventEmitter);

module.exports = SocketController;

function SocketController(serverAddress, autoReconnect) {
	this._serverAddress = serverAddress;
	this._autoReconnect = autoReconnect;

	this._isSometimeConnected = false;
	this._isNowDisconnected = true;

	this._socket = null;
	this._createSocket();
}

SocketController.prototype.up = function(peerController) {
	peerController.on('needSocketSend', function(message) {
		debug('~needSocketSend - message: %j', message);

		this._socket.send(message);
	}.bind(this));
}

SocketController.prototype.destroy = function() {
	debug('#destroy');

	this._socket.removeAllListeners();
	socketClose(this._socket);
}

SocketController.prototype._createSocket = function() {
	this._socket = new Socket(this._serverAddress, {
		forceNew: true,
		reconnection: false
	});

	this._socket.on('message', function(message) {
		debug('!socketMessage, message: %j', message);

		this.emit('socketMessage', message);
	}.bind(this));

	this._socket.on('connect', function() {
		if (!this._isSometimeConnected) {
			this._isNowDisconnected = false;
			this._isSometimeConnected = true;

			debug('!socketConnect');
			this.emit('socketConnect');
		} else {
			this._isNowDisconnected = false;

			debug('!socketReconnect');
			this.emit('socketReconnect');
		}


	}.bind(this));

	this._socket.on('error', function(error) {
		this.emit('socketError', error)
	}.bind(this));

	var onDisconnect = function() {
		if (!this._isNowDisconnected) {
			this._isNowDisconnected = true;

			debug('!socketDisconnect');
			this.emit('socketDisconnect');
		}

		this._socket.removeAllListeners().close();
		setTimeout(this._createSocket.bind(this), this._autoReconnect);
	}.bind(this);

	this._socket.on('disconnect', onDisconnect).on('connect_error', onDisconnect);
};

function socketClose(socket) {
	socket.packet({
		"type": 1,
		"nsp": "/"
	});

	//some socket.io-client bug
	//if disabled 500 ms delay disconnect message 
	//not sended to server

	//this bug worked if before #close call #send method
	//if call #close method after !connect - all ok :)
	setTimeout(function() {
		socket.destroy();
		socket.onclose('io client disconnect');
	}, 500);
}