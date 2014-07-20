'use strict';

var SocketController = require('./libs/SocketController');
var PeerController = require('./libs/PeerController');
var ObjectsController = require('./libs/ObjectsController');

var util = require('util');
var events = require('events');

var patternMatching = require('pattern-matching');

util.inherits(TeleportClient, events.EventEmitter);

module.exports = TeleportClient;

function TeleportClient(params) {
	if (!patternMatching(params, {
		serverAddress: 'notEmptyString',
		autoReconnect: 'integer'
	})) throw new Error('does not match pattern.');

	this._initAsyncEmit();

	this._params = params;

	this._objectsController = new ObjectsController();
	this._socketController = new SocketController(params.serverAddress, params.autoReconnect);
	this._peerController = new PeerController();

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

		this.on('socketControllerDestroyed', function() {
			this._objectsController.removeAllListeners();
			this._socketController.removeAllListeners();
			this._peerController.removeAllListeners();
		}.bind(this));

		this._objectsController.destroy();
		this._socketController.destroy(); //-> socketControllerDestroyed
		this._peerController.destroy();

	} else {
		this.emit('socketControllerAlreadyDestroyed');
	}

	return this;
};

TeleportClient.prototype._bindOnControllersEvents = function() {
	this._createEvetnsProxy(
		this._peerController, ['peerReconnect', 'peerReconnecting', 'peerConnect', 'peerReconnectWithNewId']
	);

	this._createEvetnsProxy(
		this._socketController, ['socketError', 'socketControllerDestroyed', 'socketControllerAlreadyDestroyed']
	);
}

TeleportClient.prototype._createEvetnsProxy = function(object, events) {
	events.forEach(function(eventName) {
		object.on(
			eventName,
			this._createEventProxy(eventName).bind(this)
		);
	}.bind(this));
}

TeleportClient.prototype._createEventProxy = function(eventName) {
	return function() {
		var arg = Array.prototype.slice.call(arguments);
		this.emit.apply(this, [eventName].concat(arg));
	}
}