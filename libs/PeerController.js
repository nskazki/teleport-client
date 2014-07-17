/*
	Events:

		needSocketSend
		
		peerMessage
		peerConnect
		peerReconnecting
		peerReconnect
		peerReconnectWithNewId

		objectsProps

		peerControllerDestroyed
		peerControllerAlreadyDestroyed

	
	Listenings:

		down:
			socketConnect
			socketReconnect
			socketMessage
			socketDisconnect

		up:
			needPeerSend

*/

var util = require('util');
var events = require('events');
var Socket = require('socket.io-client');
var debug = require('debug')('TeleportClient-PeerController');

util.inherits(PeerController, events.EventEmitter);

module.exports = PeerController;

function PeerController() {
	this._peerId = null;
	this._clientTimestamp = new Date().valueOf();
	this._state = 'notConnect';
	this._messageQueue = [];

	this._selfBind();

	this._isInit = true;
}

PeerController.prototype._onPeerConnect = function() {
	debug('~peerReconnect || ~peerConnect -> send all message from peer._messageQueue.');

	while (this._messageQueue.length) {
		var message = this._messageQueue.shift();
		this.emit('needPeerSend', message);
	}
}

PeerController.prototype._onNeedPeerSend = function(message) {
	if (this._state === 'connect') {
		debug('~needPeerSend -> !needSocketSend,\n\t message: %j', message);
		this.emit('needSocketSend', message);
	} else {
		debug('~needPeerSend && state: %s -> add message to _messageQueue,\n\t message: %j', this._state, message);
		this._messageQueue.push(message);
	}
};

PeerController.prototype._selfBind = function() {
	this.on('peerConnect', this._onPeerConnect.bind(this));
	this.on('peerReconnect', this._onPeerConnect.bind(this));

	this.on('needPeerSend', this._onNeedPeerSend.bind(this));
}

PeerController.prototype.destroy = function() {
	if (this._isInit === true) {
		this._isInit = false;

		debug('#destroy -> !peerControllerDestroyed');

		this.emit('peerControllerDestroyed');
	} else {
		debug('#destroy -> !peerControllerAlreadyDestroyed');
		this.emit('peerControllerAlreadyDestroyed');
	}

	return this;
}

PeerController.prototype._onSocketConnect = function() {
	if (this._state === 'disconnect') {
		debug('~socketReconnect || ~socketConnect -> !needSocketSend \'reconnect command\'');
		this._changeState('reconnecting');

		this.emit('needSocketSend', {
			type: 'internalCommand',
			internalCommand: 'reconnect',
			args: {
				clientTimestamp: this._clientTimestamp,
				peerId: this._peerId
			}
		});
	} else if (this._state === 'notConnect') {
		debug('~socketReconnect || ~socketConnect -> !needSocketSend \'connect command\'');
		this._changeState('connecting');

		this.emit('needSocketSend', {
			type: 'internalCommand',
			internalCommand: 'connect',
			args: {
				clientTimestamp: this._clientTimestamp
			}
		});
	}
}

PeerController.prototype._changeState = function(newState) {
	debug('oldState: %s -> newState: %s', this._state, newState);
	this._state = newState;
}

PeerController.prototype.down = function(socketController) {
	socketController
		.on('socketConnect', this._onSocketConnect.bind(this))
		.on('socketReconnect', this._onSocketConnect.bind(this));

	socketController.on('socketMessage', function(message) {
		if (this._state === 'connecting') {
			this._peerId = message.result.peerId;

			debug('~socketMessage -> !peerConnect && !objectsProps,\n\t message: %j', message);
			this._changeState('connect');

			this.emit('objectsProps', message.result.objectsProps);
			this.emit('peerConnect');
		} else if (this._state === 'connect') {
			debug('~socketMessage -> !peerMessage,\n\t message: %j', message);
			debug('state: %s', 'connect');

			this.emit('peerMessage', message);
		} else if (this._state === 'reconnecting') {
			if (message.result === 'reconnected!') {
				debug('~socketMessage -> !peerReconnect,\n\t message: %j', message);
				this._changeState('connect');

				this.emit('peerReconnect');
			} else if (typeof message.result.newPeerId === 'number') {
				this._peerId = message.result.newPeerId;

				debug('~socketMessage -> !peerReconnectWithNewId,\n\t message: %j', message);
				this._changeState('connect');

				this.emit('peerReconnectWithNewId');
			}
		}
	}.bind(this));

	socketController.on('socketReconnecting', function() {
		debug('~socketReconnecting -> !peerReconnecting');

		if (this._state === 'connect') {
			this._changeState('disconnect');
		} else {
			this._changeState('notConnect');
		}

		this.emit('peerReconnecting');
	}.bind(this));

	return this;
}

PeerController.prototype.up = function(objectController) {
	objectController.on('needPeerSend', this._onNeedPeerSend.bind(this));

	return this;
}