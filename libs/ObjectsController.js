/*
	Events
		
		needPeerSend
	
		objectsControllerReady

		objectsControllerDestroyed
		objectsControllerAlreadyDestroyed

	Listenings:

		down:
	
			objectsProps
			peerMessage
			peerReconnectWithNewId

*/

var util = require('util');
var events = require('events');
var Socket = require('socket.io-client');

var debug = require('debug')('TeleportClient-ObjectsController');

util.inherits(ObjectsController, events.EventEmitter);

module.exports = ObjectsController;

function ObjectsController() {
	this._isInit = true;
	this._requests = [];
	this._objects = {};
}

ObjectsController.prototype.down = function(peerController) {
	peerController.on('peerMessage', function(message) {

		if (message.type === 'callback') {
			debug('~peerMessage -> #_callRequestsHandler,\n\t message: %j', message);
			this._callRequestsHandler(message);
		} else if (message.type === 'event') {
			debug('~peerMessage -> #_callEventsHandler,\n\t message: %j', message);
			this._callEventsHandler(message);
		}

	}.bind(this));

	peerController.on('objectsProps', this._onObjectProps.bind(this));

	peerController.on('peerReconnectWithNewId', function() {
		debug('~peerReconnectWithNewId -> close all requests with error');

		var errorInfo = 'client reconnect to server, but server remove all results, because client reconnects too long'

		while (this._requests.length) {
			var callback = this._requests.shift();
			if (callback) callback(errorInfo);
		}
	}.bind(this))

	return this;
}

ObjectsController.prototype._onObjectProps = function(objectsProps) {
	debug('~objectsProps -> !objectsControllerReady,\n\t objectsProps: %j', objectsProps);

	for (var objectName in objectsProps) {
		if (objectsProps.hasOwnProperty(objectName)) {
			var objectProps = objectsProps[objectName];

			this._objects[objectName] = new TeleportedObject(objectName, objectProps)
				.on('_newCommand', function(objectName, methodName, args, callback) {
					var requestId = this._requests.length;
					this._requests.push(callback);

					debug('~_newCommand -> !needPeerSend, requestId: %s, objectName: %s, methodName: %s',
						requestId, objectName, methodName);

					this.emit('needPeerSend', {
						type: 'command',
						objectName: objectName,
						methodName: methodName,
						args: args,
						requestId: requestId
					});
				}.bind(this));
		}
	}

	this.emit('objectsControllerReady', objectsProps, this._objects);
}

ObjectsController.prototype._callEventsHandler = function(message) {
	var object = this._objects[message.objectName];

	if (object) {
		debug('#_callEventsHandler -> event emitted,\n\t message: %j', message);

		var emitArgs = [];
		emitArgs.push(message.eventName);
		emitArgs = emitArgs.concat(message.args);

		object.emit.apply(object, emitArgs);
	} else {
		debug('#_callEventsHandler - objectName not found!\n\t message: %j', message);
	}
}

ObjectsController.prototype._callRequestsHandler = function(message) {
	var callback = this._requests[message.requestId];

	if (callback) {
		debug('#_callRequestsHandler -> callback call,\n\t message: %j', message);

		delete this._requests[message.requestId];
		try {
			callback.apply(null, message.resultArgs);
		} catch (ex) {
			//нужно вырваться за пределы текущего call stack
			//
			//потому что если я выброшу тут error
			//и юзер не подписался на 'error' teleport-client
			//
			//то eventEmitter выбросит throw ex
			//его перехватит какой нибудь catch Socket.IO
			//выбросит свою более лучшую ошибку
			//
			//и юзер увидит фигню

			setImmediate(this.emit.bind(this, 'error', ex));
		}
	} else {
		debug('#_callRequestsHandler - callback not found!\n\t message: %j', message);
	}
}

ObjectsController.prototype.destroy = function() {
	if (this._isInit === true) {
		this._isInit = false;

		debug('#destroy -> !objectsControllerDestroyed');
		this.emit('objectsControllerDestroyed');
	} else {
		debug('#destroy -> !objectsControllerAlreadyDestroyed')
		this.emit('objectsControllerAlreadyDestroyed');
	}

	return this;
}

//

util.inherits(TeleportedObject, events.EventEmitter);

function TeleportedObject(objectName, objectProps) {
	debug('TeleportedObject#new -> TeleportedObject#_init, objectName: %s', objectName);

	this._objectProps = objectProps;
	this._objectName = objectName;

	this._init();
}

TeleportedObject.prototype._init = function() {
	if (this._objectProps.methods) {
		this._objectProps.methods.forEach(this._createMethod.bind(this));
	}
}

TeleportedObject.prototype._createMethod = function(methodName) {
	debug('TeleportedObject#_createMethod, objectName: %s, methodName: %s', this._objectName, methodName);

	this[methodName] = function() {
		debug('TeleportedObject#%s -> !_newCommand, objectName: %s', methodName, this._objectName);

		var args;
		var callback;

		if (arguments.length > 0) {
			var sliceEndIndex = arguments.length - 1;
			var callbackIndex = arguments.length - 1;

			if (typeof(arguments[callbackIndex]) != 'function') sliceEndIndex = arguments.length;
			else callback = arguments[callbackIndex];

			args = Array.prototype.slice.call(arguments, 0, sliceEndIndex);
		}

		if (!callback) callback = function() {}

		this.emit('_newCommand', this._objectName, methodName, args, callback);

		return this;
	}.bind(this);
}