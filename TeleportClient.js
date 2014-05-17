/*
need include:
	Helpers/util.js
	Helpers/EventEmitter.js
*/

"use strict"

util.inherits(TeleportClient, EventEmitter);
function TeleportClient(options) {
	//options
	this._optionWsServerAddress = options.serverAddress;
	this._optionIsDebug = options.isDebug;

	//end options

	//values
	this._valueWsClient = null;
	this._valueRequests = [];
	this._valueObjectsNames = null;

	this.objects = {};

	this._valueIsInit = false;

	//end values
}

//public
TeleportClient.prototype.init = function() {
	if (!this._valueIsInit) {
		this._valueWsClient = new WebSocket(this._optionWsServerAddress);


		this._valueWsClient.onmessage = this._funcWsOnMessage.bind(this);
		this._valueWsClient.onopen = this._funcWsOnOpen.bind(this);
		this._valueWsClient.onclose = this._funcWsOnClosed.bind(this);
		this._valueWsClient.onerror = this._funcWsOnError.bind(this);

		this._valueIsInit = true;
	}

	return this;
};

//end public

//private
TeleportClient.prototype._funcWsSessionInit = function() {
	this.emit('info', {
		desc: "[TeleportClient] Info: отправил запрос на получение методов"
	})

	this._funcWsSendMessage({
		type: "internalCommand",
		internalCommand: "getObjects",
	});
};

TeleportClient.prototype._funcInternalCallbackHandler = function(message) {
	if (message.internalCommand == "getObjects") {
		if (message.error) {
			var errorInfo = {
				desc: "[TeleportClient] Error: getObjects вернул ошибку: " + message.error,
				message: message
			};

			this.emit("error", errorInfo);
		} else {
			this.emit('info', {
				desc: "[TeleportClient] Info: объекты получены: " + message.result,
				message: message
			});

			this._valueObjectsNames = message.result;

			for (var objectName in this._valueObjectsNames) {
				this._funcObjectCreate(objectName);
			}

			this.emit('ready', this._valueObjectsNames);
		}
	} else {
		var errorInfo = {
			desc: "[TeleportClient] Error: пришел ответ на неожиданную команду: " + message.internalCommand,
			message: message
		};

		this.emit("error", errorInfo);
	}
};

TeleportClient.prototype._funcObjectCreate = function(objectName) {
	var objectProps = this._valueObjectsNames[objectName];
	this.objects[objectName] = new TeleportedObject(objectProps);

	for (var methodIndex = 0; methodIndex < objectProps.methods.length; methodIndex++) {
		var methodName = objectProps.methods[methodIndex];

		this.objects[objectName][methodName] =
			this._funcMethodCreate(objectName, methodName).bind(this);
	}
};

TeleportClient.prototype._funcMethodCreate = function(objectName, methodName) {
	return function(options, callback) {
		if (!callback) {
			callback = options;
			options = null;
		}
		if (!callback) {
			callback = function() {};
		}

		var requestId = this._valueRequests.length;

		this.emit('info', {
			desc: "[TeleportClient] Info: вызвын метод серверного объекта: " + objectName + "." + methodName,
			args: options,
			requestId: requestId
		});

		this._valueRequests.push(callback);

		this._funcWsSendMessage({
			objectName: objectName,
			type: "command",
			command: methodName,
			requestId: requestId,
			args: options
		});

		return this.objects[objectName];
	};
};

TeleportClient.prototype._funcCallbackHandler = function(message) {
	this.emit('info', {
		desc: "[TeleportClient] Info: сервер вернул callback на: " + message.objectName + "." + message.command,
		message: message
	});

	this._valueRequests[message.requestId](message.error, message.result);
};

TeleportClient.prototype._funcEventHandler = function(message) {
	this.emit('info', {
		desc: "[TeleportClient] nfo: сервер передал событие: " + message.objectName + "." + message.event,
		message: message
	});

	this[message.objectName].emit(message.event, message.args);
};

//end private

//server
TeleportClient.prototype._funcWsOnOpen = function() {
	this.emit('info', {
		desc: "[TeleportClient] Info: соединение с сервером установленно"
	});

	this._funcWsSessionInit();
}

TeleportClient.prototype._funcWsOnMessage = function(sourceMessage) {
	var message = JSON.parse(sourceMessage.data);

	if (message.type == "callback") {
		this._funcCallbackHandler(message);
	} else if (message.type == "internalCallback") {
		this._funcInternalCallbackHandler(message);
	} else if (message.type == "event") {
		this._funcEventHandler(message);
	} else {
		var errorInfo = {
			desc: "[TeleportClient] Error: для данного типа сообщений нет хэндлера: " + message.type,
			message: message
		};

		this.emit("error", errorInfo);
	}
};

TeleportClient.prototype._funcWsSendMessage = function(message) {
	try {
		var string = JSON.stringify(message);
		this._valueWsClient.send(string);
	} catch (error) {
		var errorInfo = {
			desc: "[TeleportClient] Error: ошибка отправки сообщения на сервер: " + error,
			message: message,
			error: error
		};

		this.emit("error", errorInfo);
	}
};

TeleportClient.prototype._funcWsOnClosed = function() {
	var errorInfo = {
		desc: "[TeleportClient] Error: соединение с сервером закрылось"
	};

	this.emit("error", errorInfo);
};

TeleportClient.prototype._funcWsOnError = function(error) {
	var errorInfo = {
		desc: "[TeleportClient] Error: WebSocket Client выбросил ошибку: " + error,
		error: error
	};

	this.emit("error", errorInfo);
};

//end server


//
util.inherits(TeleportedObject, EventEmitter);

function TeleportedObject(objectProps) {
	this.__events__ = objectProps.events;
	this.__methods__ = objectProps.methods;
};

//