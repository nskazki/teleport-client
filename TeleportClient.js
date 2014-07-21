/**
	https://github.com/nskazki/web-TeleportClient
	MIT
	from russia with love, 2014
*/

/**

	Public:

		destroy

	Events:

		peerConnect -> ready
		peerReconnect -> reconnect & reconnectOnOldTerms
		peerReconnectWithNewId -> reconnect & reconnectAndReinit
		peerReconnecting -> reconnecting

		socketError -> error
		socketControllerDestroyed -> destroyed
		socketControllerAlreadyDestroyed -> alreadyDestroyed
*/

'use strict';

var SocketController = require('./libs/SocketController');
var PeerController = require('./libs/PeerController');
var ObjectsController = require('./libs/ObjectsController');

var util = require('util');
var events = require('events');

var patternMatching = require('pattern-matching');
var debug = require('debug')('TeleportClient-main');

util.inherits(TeleportClient, events.EventEmitter);

module.exports = TeleportClient;

function TeleportClient(params) {
	if (!patternMatching(params, {
		serverAddress: 'notEmptyString',
		autoReconnect: 'integer',
		authFunc: 'function'
	})) throw new Error('does not match pattern.');

	this._initAsyncEmit();

	this._params = params;

	this._objectsController = new ObjectsController();
	this._socketController = new SocketController(params.serverAddress, params.autoReconnect);
	this._peerController = new PeerController(params.authFunc);

	this._socketController.up(this._peerController);
	this._peerController.down(this._socketController).up(this._objectsController);
	this._objectsController.down(this._peerController);

	this.objects = this._objectsController._objects;

	this._bindOnControllersEvents();

	this._isInit = true;
}

TeleportClient.prototype._initAsyncEmit = function() {
	var vanullaEmit = this.emit;
	this.emit = function() {
		var asyncArguments = arguments;

		process.nextTick(function() {
			vanullaEmit.apply(this, asyncArguments);
		}.bind(this), 0);
	}.bind(this);
}

TeleportClient.prototype.destroy = function() {
	if (this._isInit === true) {
		this._isInit = false;

		this.on('destroyed', function() {
			this._objectsController.removeAllListeners();
			this._socketController.removeAllListeners();
			this._peerController.removeAllListeners();
		}.bind(this));

		this._objectsController.destroy();
		this._socketController.destroy(); //-> socketControllerDestroyed
		this._peerController.destroy();

	} else {
		debug('#destroy - TeleportClient alreadyDestroyed -> !alreadyDestroyed');
		this.emit('alreadyDestroyed');
	}

	return this;
};

TeleportClient.prototype._bindOnControllersEvents = function() {
	var peerSourceNames = ['peerConnect', 'peerReconnect', 'peerReconnect', 'peerReconnectWithNewId', 'peerReconnectWithNewId', 'peerReconnecting'];
	var peerNewNames = ['ready', 'reconnect', 'reconnectOnOldTerms', 'reconnect', 'reconnectAndReinit', 'reconnecting'];

	this._createEvetnsProxy(
		this._peerController,
		peerSourceNames,
		peerNewNames
	);

	var socketSourceNames = ['socketError', 'socketControllerDestroyed', 'socketControllerAlreadyDestroyed'];
	var socketNewNames = ['error', 'destroyed', 'alreadyDestroyed'];

	this._createEvetnsProxy(
		this._socketController,
		socketSourceNames,
		socketNewNames
	);
}

TeleportClient.prototype._createEvetnsProxy = function(object, eventsSourceNames, eventsNewNames) {
	for (var index = 0; index < eventsSourceNames.length; index++) {
		var sourceName = eventsSourceNames[index];
		var newName = (eventsNewNames) ? eventsNewNames[index] : sourceName;

		object.on(
			sourceName,
			this._createEventProxy(newName).bind(this)
		);
	}
}

TeleportClient.prototype._createEventProxy = function(eventName) {
	return function() {
		var arg = Array.prototype.slice.call(arguments);
		this.emit.apply(this, [eventName].concat(arg));
	}
}