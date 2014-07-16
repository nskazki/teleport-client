/*
	Events:

		needSocketSend

		peerConnect
		peerReconnecting
		peerReconnect
		peerReconnectWithNewId

		objectProps

		needSocketSend
		
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

}

PeerController.prototype._onConnect = function() {
	if (this._state === 'disconnect') {
		this._state = 'reconnecting';

		debug('~socketReconnect -> !needSocketSend \'reconnect command\'');
		debug('oldState: %s -> newState: %s', 'disconnect', 'reconnecting');

		this.emit('needSocketSend', {
			type: 'internalCommand',
			internalCommand: 'reconnect',
			args: {
				clientTimestamp: clientTimestamp,
				peerId: this._peerId
			}
		});
	} else if (this._state === 'notConnect') {
		this._state = 'connecting';

		debug('~socketConnect -> !needSocketSend \'connect command\'');
		debug('oldState: %s -> newState: %s', 'notConnect', 'connecting');

		this.emit('needSocketSend', {
			type: 'internalCommand',
			internalCommand: 'connect',
			args: {
				clientTimestamp: this._clientTimestamp
			}
		});
	}
}

PeerController.prototype.down = function(socketController) {
	socketController
		.on('socketConnect', this._onConnect.bind(this))
		.on('socketReconnect', this._onConnect.bind(this));

	socketController.on('socketMessage', function(message) {
		if (this._state === 'connecting') {
			this._state = 'connect';
			this._state = message.result.peerId;

			debug('~socketMessage -> !peerConnect && !objectProps, message: %j', message);
			debug('oldState: %s -> newState: %s', 'connecting', 'connect');

			this.emit('objectsProps', message.result.objectsProps);
			this.emit('peerConnect');
		} else if (this._state === 'connect') {

			debug('~socketMessage -> !peerMessage, message: %j', message);
			debug('state: %s', 'connect');

			this.emit('peerMessage', message);
		} else if (this._state === 'reconnecting') {
			if (message.result === 'reconnected!') {
				this._state = 'connect';

				debug('~socketMessage -> !peerReconnect, message: %j', message);
				debug('oldState: %s -> newState: %s', 'reconnecting', 'connect');

				this.emit('peerReconnect');
			} else if (typeof message.result.newPeerId === 'number') {
				this._state = 'connect';
				this._peerId = message.result.newPeerId;

				debug('~socketMessage -> !peerReconnectWithNewId, message: %j', message);
				debug('oldState: %s -> newState: %s', 'reconnecting', 'connect');

				this.emit('peerReconnectWithNewId');
			}
		}
	}.bind(this));

	socketController.on('socketDisconnect', function() {
		debug('~socketDisconnect -> !peerReconnecting');

		if (this._state === 'connect') {
			this._state = 'disconnect';
			debug('oldState: %s -> newState: %s', 'connect', 'disconnect');
		} else {
			debug('oldState: %s -> newState: %s', this._state, 'notConnect');
			this._state = 'notConnect';
		}

		this.emit('peerReconnecting');
	}.bind(this));
}