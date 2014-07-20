/*
	Events

		socketMessage
		socketConnect
		socketError
		socketReconnecting
		socketReconnect

		socketControllerAlreadyDestroyed
		socketControllerDestroyed

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
	this._initAsyncEmit();

	this._serverAddress = serverAddress;
	this._autoReconnect = autoReconnect;

	this._isSometimeConnected = false;
	this._isNowDisconnected = true;

	this._socket = null;
	this._createSocket();

	this._isInit = true;
}

SocketController.prototype._initAsyncEmit = function() {
	var vanullaEmit = this.emit;
	this.emit = function() {
		var asyncArguments = arguments;

		setTimeout(function() {
			vanullaEmit.apply(this, asyncArguments);
		}.bind(this), 0);
	}.bind(this);
}

SocketController.prototype.up = function(peerController) {
	peerController.on('needSocketSend', function(message) {
		debug('~needSocketSend -> #send,\n\t message: %j', message);

		this._socket.send(message);
	}.bind(this));

	return this;
}

SocketController.prototype.destroy = function() {
	if (this._isInit === true) {
		this._isInit = false;

		debug('#destroy -> !socketControllerDestroyed');

		this._socket.removeAllListeners();

		socketClose(this._socket, function() {
			this.emit('socketControllerDestroyed');
		}.bind(this));
	} else {
		debug('#destroy -> !socketControllerAlreadyDestroyed')
		this.emit('socketControllerAlreadyDestroyed');
	}

	return this;
}

SocketController.prototype._createSocket = function() {
	this._socket = new Socket(this._serverAddress, {
		forceNew: true,
		reconnection: false
	});

	this._socket.on('message', function(message) {
		debug('~message -> !socketMessage,\n\t message: %j', message);

		this.emit('socketMessage', message);
	}.bind(this));

	this._socket.on('connect', function() {
		if (!this._isSometimeConnected) {
			this._isNowDisconnected = false;
			this._isSometimeConnected = true;

			debug('~connect -> !socketConnect');
			this.emit('socketConnect');
		} else {
			this._isNowDisconnected = false;

			debug('~connect -> !socketReconnect');
			this.emit('socketReconnect');
		}


	}.bind(this));

	this._socket.on('error', function(error) {
		debug('~error -> !socketError,\n\t error: %s', error.toString());

		this.emit('socketError', error)
	}.bind(this));

	var onDisconnect = function() {
		if (!this._isNowDisconnected) {
			this._isNowDisconnected = true;

			debug('~desconnect || ~connect_error -> !socketReconnecting');
			this.emit('socketReconnecting');
		}

		this._socket.removeAllListeners().close();
		setTimeout(this._createSocket.bind(this), this._autoReconnect);
	}.bind(this);

	this._socket.on('disconnect', onDisconnect).on('connect_error', onDisconnect);
};

function socketClose(socket, callback) {
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

		callback();
	}, 500);
}