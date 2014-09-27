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
var patternMatching = require('pattern-matching');

util.inherits(PeerController, events.EventEmitter);

module.exports = PeerController;

function PeerController(authFunc) {
	this._authFunc = authFunc;
	this._authData = null;

	this._peerId = null;
	this._token = null;
	this._state = 'notConnect';
	this._messageQueue = [];

	this._selfBind();

	this._isInit = true;
}

PeerController.prototype._onPeerConnect = function() {
	debug('~peerConnect || ~peerReconnect -> send all message from peer._messageQueue.');

	while (this._messageQueue.length) {
		var message = this._messageQueue.shift();
		this.emit('needPeerSend', message);
	}
}

PeerController.prototype._onNeedPeerSend = function(message) {
	if (this._state === 'connect') {
		message.token = this._token;

		debug('~needPeerSend -> !needSocketSend,\n\t message: %j', message);
		this.emit('needSocketSend', message);
	} else {
		for (var i = 0; i < 10e8; i++);

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
	if (this._authData !== null) {
		debug('_authData defined -> call #connecter, _authData: %j', this._authData);
		connecter.bind(this)();
	} else {
		debug('_authData not defined, call #_authFunc');

		this._authFunc(function(error, authData) {
			if (error) {
				debug('_authFunc returned error, wow i threw error, error: %j', error);
				throw new Error('authFunc returned error: ' + error.toString());
			}

			debug('#_authFunc returned _authData -> call #connecter, _authData: %j', authData);

			this._authData = authData;
			connecter.bind(this)();
		}.bind(this));
	}

	function connecter() {
		if (this._state === 'disconnect') {
			debug('~socketReconnect || ~socketConnect -> !needSocketSend \'reconnect command\'');
			this._changeState('reconnecting');

			this.emit('needSocketSend', {
				type: 'internalCommand',
				internalCommand: 'reconnect',
				args: {
					authData: this._authData,
					token: this._token,
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
					authData: this._authData
				}
			});
		}
	};
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
		if (this._state === 'connecting' && patternMatching(message, {
			result: {
				token: 'notEmptyString',
				peerId: 'integer'
			}
		})) {
			this._peerId = message.result.peerId;
			this._token = message.result.token;

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
			} else if (patternMatching(message, {
				result: {
					newToken: 'notEmptyString',
					newPeerId: 'integer'
				}
			})) {
				this._peerId = message.result.newPeerId;
				this._token = message.result.newToken;

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