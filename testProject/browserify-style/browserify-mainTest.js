(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var TeleportClient = require('teleport-client');
var util = require('util');

window.teleportClient = new TeleportClient({
		serverAddress: "ws://localhost:8000",
		autoReconnect: 3000
	})
	.on('debug', console.debug.bind(console))
	.on('info', console.info.bind(console))
	.on('warn', console.warn.bind(console))
	.on('error', console.error.bind(console))
	.on('ready', function(objectsProps) {
		//for Debuging
		window.simpleObject = teleportClient.objects.simpleObject;;

		/*events*/
		simpleObject
			.on(
				'eventWithMyOptions',
				CreateEventLogger('simpleObject', 'eventWithMyOptions'))
			.on(
				'eventWithoutArgs',
				CreateEventLogger('simpleObject', 'eventWithoutArgs'))
			.on(
				'eventWithUnlimArgs',
				CreateEventLogger('simpleObject', 'eventWithUnlimArgs'))
			.on(
				'10secIntervalEvent',
				CreateEventLogger('simpleObject', '10secIntervalEvent'));


		/*funcs with callback*/
		simpleObject
			.func(
				'simepleParam',
				CreateCallbackLogger('simpleObject', 'func'))
			.funcWithoutArgs(
				CreateCallbackLogger('simpleObject', 'funcWithoutArgs'))

		/*funcs without callback*/
		simpleObject
			.funcWithUnlimArgs(false, '1', 2, 3)
			.funcWith10SecDelay();

	}).init();


function CreateEventLogger(objectName, eventName) {
	return function() {
		var obj = {
			desc: util.format("[%s.event] Info: получено событие %s", objectName, eventName),
			arguments: arguments
		};

		var details = document.createElement('details');
		details.innerHTML = "<summary>" + obj.desc + "</summary>" + "<pre>" + JSON.stringify(obj, ' ', 4) + "</pre";

		var welcom = document.getElementById('welcom');
		welcom.parentNode.insertBefore(details, welcom);
	}
}

function CreateCallbackLogger(objectName, methodName) {
	return function(error, result) {
		var obj = {
			desc: util.format("[%s.callback] Info: вернулся результат вызова метода %s", objectName, methodName),
			result: result,
			error: error
		};


		var details = document.createElement('details');
		details.innerHTML = "<summary>" + obj.desc + "</summary>" + "<pre>" + JSON.stringify(obj, ' ', 4) + "</pre";

		var welcom = document.getElementById('welcom');
		welcom.parentNode.insertBefore(details, welcom);
	}
}
},{"teleport-client":2,"util":7}],2:[function(require,module,exports){
/**
	https://github.com/nskazki/web-TeleportClient
	MIT
	from russia with love, 2014
*/


/*
need include:
	my-helpers/util.js
	my-helpers/EventEmitter.js
*/

/*
	requirejs.config({
		paths: {
			EventEmitter: 'bower_components/my-helpers/EventEmitter',
			util: 'bower_components/my-helpers/util'
		}
	});

	or
	
	<script src="./js/someLibsFolder/my-helpers/EventEmitter.js" type="text/javascript"></script>
	<script src="./js/someLibsFolder/my-helpers/util.js" type="text/javascript"></script>
*/

/*
	Public:

		init
		destroy			

	Events:

		debug 
		info 
		warn 
		error 	

		ready
		close
		destroyed
		
		reconnected
		reconnecting

		reconnectedToNewServer
		reconnectedToOldServer

		serverObjectsChanged
*/

"use strict";

(function(namespace) {

	if (namespace.define && namespace.requirejs) {
		/**
			Раз есть define и requirejs значит подключен requirejs.
			Зависимости будет переданны в CreateTeleportServer, 
			который вернет сформированный класс TeleportClient

		*/
		define(
			[
				'EventEmitter',
				'util'
			],
			CreateTeleportServer);
	} else if (isModule()) {
		/**
			Раз есть module.exports значит browserify сейчас подключает этот модуль
			Зависимости удовлетворит сам browserify. 
	
		*/

		var EventEmitter = require('events').EventEmitter;
		var util = require('util');

		module.exports = CreateTeleportServer(EventEmitter, util);
	} else {
		/**
			Иначе считаю, что TeleportClient подключен в "классический"
			проект, зависимости удовлетворены разработчиком проекта которому мой 
			класс понадобился, и добавляю сформированный класс в глобальное пространство имен.

		*/
		namespace.TeleportClient = CreateTeleportServer(EventEmitter, util);
	}

	function isModule() {
		try {
			return module && module.exports;
		} catch (ex) {
			return false;
		}
	}

	function CreateTeleportServer(EventEmitter, util) {
		util.inherits(TeleportClient, EventEmitter);

		/**
			Это RPC клиент, умеет вызывать методы телепортированных объектов и получать собития ими выбрасываемые. 
			Также умеет восстанавливать соединение с сервером в случае разрыва соединения.

			Конструктор класса TeleportClient, принимает единственным параметром объект с опциями,
			возвращает новый неинециализированный объект класса TeleportClient
			
			------------------------

			options = {
				serverAddress: "ws://localhost:8000",
				autoReconnect: 3000
			}

			serverAddress - адрес TeleportServer
				default: "ws://localhost:8000"

			autoReconnect - время задержки перед попыткой переподключния к серверу.
				если число - то это время задержки в миллесекундах
				если false - то переподключения не будет выполненно.
				default: 3000 msec

			-----------------------

			формат инициалируемых полей:

			Массив с калбеками для вызванных телепортированных методов.
			в каждом сообщение уходящем на сервер есть поле requestId, значение в этом поле это индекс каллбека в этом массиве:
			
				this._valueRequests = [
					1: someCallback,
					2: secondCallback
				]
			
			Объект содержащий свойства телепортируемых объектов, которые проинициализируют объекты в this.objects
			Получаю при первом успешном соединении с сервером.

			Если произойдет разъединение с сервером по причине грустных интернетов, то перезапрашивать его нет смысла, потому что на сервере ничего не поменялось.
			Если же разъединило потому что сервер был перезапущенн, то свойства телепортируеммых объектов будут перезапрошенны.
				* Если они не изменились, то работа будет продолженна.
				* Или изменились, то будет выброшенно событие `serverObjectsChanged` 
				 * и я бы на месте словившего его программиста вывыел пользователю предложение перезагрузить страницу.
				   Потому что изменение набора серверных объектов неминуемо (обычно) влечет изменение клиентского сценария, и чтобы его обновить
				   нужно обновить страничку (насколько мне известно нагорячую js скрипты подменять нельзя).
				 * Также несмотря на то что были полученны новые свойства,
				   они не будут помещенны в this._valueServerObjectsProps и this.objects не будет измененн.
				   измениться только флаг this.isServerObjectChanged = true;

				this._valueServerObjectsProps = {
					'someServerObjectName': {
						events: ['firstPermitedEventName', 'secondPermitedEventName'],
						methods: ['firstMethodName', 'secondMethodName']
					}, ...
				}

			Объект содержащий в себе проинициализированные телепортированные объекты.
			У них есть несколько служебных полей и методы унаследованные от класса EventEmetter.
			
			Методы создаваемые внутри телепортированного объекта разбирают приходящий псевдомассив arguments 
			выделяют из него аргументы для метода и калбек (если калбека нет, то создается заглушка)
			запросу присваеватеся requestId, каллбек под этим id помещается в this._valueRequests
			и запрос отправляется на сервер.

			this.objects = {
				'someServerObjectName': {
					__events__: ['firstPermitedEventName', 'secondPermitedEventName'],
					__methods__: ['firstMethodName', 'secondMethodName'],
					firstMethodName: function(args, secondArg, callback) {...},
					secondMethodName: function(callback) {...},
				}
			}

		*/
		function TeleportClient(options) {
			//options
			this._optionWsServerAddress = options.serverAddress || "ws://localhost:8000";
			this._optionAutoReconnect = (options.autoReconnect === undefined) ? 3000 : options.autoReconnect;

			//end options

			//private
			this._valueWsClient = null;
			this._valueRequests = [];
			this._valueInternalRequests = [];

			this._valueServerObjectsProps = null;
			this._valueIsInit = false;

			this._valuePeerId = null;
			this._valuePeerTimestamp = null;

			this._valueServerTimestamp = null;
			this._valueIsReadyEmited = false;

			//end private

			//public
			this.objects = {};
			this.isServerObjectChanged = false;

			//end public
		}

		//public
		TeleportClient.prototype.init = function() {
			if (!this._valueIsInit) {
				this._valuePeerTimestamp = new Date();
				this._funcWsInit();

				this._valueIsInit = true;
			}

			return this;
		};

		/**
			Метод деструктов закрывает соединение с сервером, вызывает все ожидающие результат калеки с ошибкой.
			очищает несколько служебных полей и наконец выбрасывает `destroyed`

		*/
		TeleportClient.prototype.destroy = function() {
			if (this._valueIsInit) {
				this.emit('info', {
					desc: '[TeleportClient] Info: Работа клиента штатно прекращена, на все калбеки будет возвращена ошибка, соединение с сервером будет закрыто.'
				});

				this._funcCloseAllRequests();

				this.objects = {};
				this._valueServerObjectsProps = {};
				this._valueIsInit = false;
				this._valuePeerId = null;
				this._valueServerTimestamp = null;
				this._valuePeerTimestamp = null;
				this._valueIsReadyEmited = false;

				this.removeAllListeners('__reconnectedToOldServer__');
				this.removeAllListeners('__reconnectedToNewServer__');

				if (this._valueWsClient) {
					this._funcWsClose();
					this.emit('close');
				}

				this.emit('destroyed');
			}

			return this;
		};

		//end public

		//private
		//ws client
		TeleportClient.prototype._funcWsInit = function() {
			this._valueWsClient = new WebSocket(this._optionWsServerAddress);

			//onmessage
			this._valueWsClient.onmessage = this._funcWsOnMessage.bind(this);

			//onopen
			this._valueWsClient.onopen = (function() {
				this.emit('info', {
					desc: "[TeleportClient] Info: соединение с сервером установленно"
				});

				this._funcInternalGetServerTimestamp(
					this._funcInternalHandlerGetTimestamp.bind(this));
			}.bind(this));

			//onerror
			this._valueWsClient.onerror = (function(error) {
				this.emit("error", {
					desc: "[TeleportClient] Error: WebSocket Client выбросил ошибку: " + error,
					error: error
				});
			}.bind(this));

			//onclose
			this._valueWsClient.onclose = (function() {
				this.emit('warn', {
					desc: "[TeleportClient] Warn: Соединение с сервером потерянно."
				});

				if (this._optionAutoReconnect !== false) this._funcWsReconnect();
				else {
					this._funcWsClose();
					this.emit('close');
				}
			}.bind(this));
		};

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
					desc: "[TeleportClient] Warn: для данного типа сообщений нет хэндлера: " + message.type,
					message: message
				};

				this.emit("warn", errorInfo);
			}
		};

		TeleportClient.prototype._funcWsReconnect = function() {
			this.emit('info', {
				desc: "[TeleportClient] Info: Будет выполненно переподключение к серверу.",
				delay: this._optionAutoReconnect
			});

			if (this._valueWsClient) this._funcWsClose();
			this.emit('reconnecting');

			setTimeout(this._funcWsInit.bind(this), this._optionAutoReconnect);
		};

		TeleportClient.prototype._funcWsClose = function() {
			this._valueWsClient.onmessage = function() {};
			this._valueWsClient.onopen = function() {};
			this._valueWsClient.onclose = function() {};
			this._valueWsClient.onerror = function() {};

			this._valueWsClient.close();

			this._valueWsClient = null;
		};

		//end ws client

		//close all callbacks
		TeleportClient.prototype._funcCloseAllRequests = function(isInitError) {
			var errorInfo = (isInitError) ? "[TeleportClient] Error: Произошла ошибка при регистрация клиента на сервере, поэтому результат выполнения команды никогда не будет возвращенн." :
				"[TeleportClient] Error: Соединение с сервером востановленно, но это новый экземпляр сервера, поэтому результат выполнения команды никогда не будет возвращенн.";

			while (this._valueRequests.length) {
				var callback = this._valueRequests.shift();
				if (callback) callback({
					desc: errorInfo
				});
			}
		};

		//end close all callbacks

		//connction init
		TeleportClient.prototype._funcInternalGetServerTimestamp = function(callback) {
			this.emit('debug', {
				desc: "[TeleportClient] Debug: отправил запрос на получение timestamp."
			})

			this._funcSendInternalCommand({
				type: "internalCommand",
				internalCommand: "getTimestamp",
			}, callback);
		};

		TeleportClient.prototype._funcInternalGetPeerId = function(callback) {
			this.emit('debug', {
				desc: "[TeleportClient] Debug: отправил запрос на получение peerId.",
				timestamp: this._valuePeerTimestamp
			});

			this._funcSendInternalCommand({
				type: "internalCommand",
				internalCommand: "getPeerId",
				args: {
					timestamp: this._valuePeerTimestamp
				}
			}, callback);
		};

		TeleportClient.prototype._funcInternalSetPeerId = function(callback) {
			this.emit('debug', {
				desc: "[TeleportClient] Debug: отправил запрос на подтвержение уже существующего peerId.",
				timestamp: this._valuePeerTimestamp,
				peerId: this._valuePeerId
			})

			this._funcSendInternalCommand({
				type: "internalCommand",
				internalCommand: "setPeerId",
				args: {
					timestamp: this._valuePeerTimestamp,
					peerId: this._valuePeerId
				}
			}, callback);
		};

		TeleportClient.prototype._funcInternalGetObjectsProps = function(callback) {
			this.emit('debug', {
				desc: "[TeleportClient] Debug: отправил запрос на получение свойств серверных объектов.",
				peerId: this._valuePeerId
			})

			this._funcSendInternalCommand({
				type: "internalCommand",
				internalCommand: "getObjects",
				args: {
					peerId: this._valuePeerId
				}
			}, callback);
		};

		TeleportClient.prototype._funcInternalConnected = function(callback) {
			this.emit('debug', {
				desc: "[TeleportClient] Debug: отправил подтверждение завершения подключения.",
				peerId: this._valuePeerId
			})

			this._funcSendInternalCommand({
				type: "internalCommand",
				internalCommand: "connectionСompleted",
				args: {
					peerId: this._valuePeerId
				}
			}, callback);
		};

		TeleportClient.prototype._funcInternalReconnected = function(callback) {
			this.emit('debug', {
				desc: "[TeleportClient] Debug: отправил подтверждение завершения переподключения.",
				peerId: this._valuePeerId
			})

			this._funcSendInternalCommand({
				type: "internalCommand",
				internalCommand: "reconnectionCompleted",
				args: {
					peerId: this._valuePeerId
				}
			}, callback);
		};

		TeleportClient.prototype._funcSendInternalCommand = function(message, callback) {
			if (callback) {
				message.internalRequestId = this._valueInternalRequests.length;
				this._valueInternalRequests.push(callback);
			}

			this._funcWsSendMessage(message);
		};

		//end connction init

		/**
			хэндлер для ответов на сервисные запросы к серверу
		
		*/
		//InternalHandler
		TeleportClient.prototype._funcInternalCallbackHandler = function(message) {
			this.emit('debug', {
				desc: "[TeleportClient] Debug: сервер вернул internalCallback на: " + message.internalCommand,
				message: message
			});

			this._valueInternalRequests[message.internalRequestId](message.error, message.result);
			delete this._valueInternalRequests[message.internalRequestId];
		};

		TeleportClient.prototype._funcInternalHandlerGetTimestamp = function(error, newServerTimestamp) {
			if (!this._valueIsReadyEmited) {
				this.emit('debug', {
					desc: "[TeleportClient] Debug: Полученн timestamp, это первое подключение к серверу, запрашиваю peerId.",
					timestamp: newServerTimestamp
				});

				this._valueServerTimestamp = newServerTimestamp;

				this._funcInternalGetPeerId(
					this._funcInternalHandlerGetPeerId.bind(this));
			} else if (newServerTimestamp != this._valueServerTimestamp) {
				this.emit('debug', {
					desc: "[TeleportClient] Debug: Полученный timestamp отличается от прошлого, сервер был перезапущенн, " +
						"запрашиваю новый peerId, на все калбеки ожидающие результат возвращаю ошибку.",
					requestCount: this._valueRequests.length,
					oldTimestamp: this._valueServerTimestamp,
					newTimestamp: newServerTimestamp,
				});

				this._valueServerTimestamp = newServerTimestamp;
				this._funcCloseAllRequests();

				this._funcInternalGetPeerId(
					this._funcInternalHandlerGetPeerId.bind(this));
			} else {
				this.emit('debug', {
					desc: "[TeleportClient] Debug: Полученн timestamp, он соответствует старому, отправляю на сервер свой peerId.",
					timestamp: newServerTimestamp
				});

				this._funcInternalSetPeerId(
					this._funcInternalHandlerSetPeerId.bind(this));
			}
		};

		TeleportClient.prototype._funcInternalHandlerGetPeerId = function(error, peerId) {
			if (!this._valueIsReadyEmited) this.emit('debug', {
				desc: "[TeleportClient] Debug: Полученн peerId, запрашиваю свойства серверных объектов.",
				peerId: peerId
			});
			else this.emit('debug', {
				desc: "[TeleportClient] Debug: Полученн peerId, переподключение произошло из-за перезапуска сервера " +
					"проверяю изменились ли свойства серверных объектов. Или из-за истечения времени ожидания сервером " +
					"переподключения этого клиента.",
				peerId: peerId
			});

			this._valuePeerId = peerId;

			this._funcInternalGetObjectsProps(
				this._funcInternalHandlerGetObjects.bind(this));
		};

		TeleportClient.prototype._funcInternalHandlerSetPeerId = function(error) {
			if (error) {
				var errorInfo = {
					desc: "[TeleportClient] Error: Не удалось восстановить соединение с сервером, запрос на установку peerId, вернул ошибку. " +
						"Попробую получить новый peerId.",
					error: error
				};

				this.emit("error", errorInfo);
				this._funcCloseAllRequests('init error');

				this._funcInternalGetPeerId(
					this._funcInternalHandlerGetPeerId.bind(this));
			} else {
				this._funcInternalReconnected();

				this.emit('info', {
					desc: "[TeleportClient] Info: Соединение с сервером востановленно.",
					peerId: this._valuePeerId,
					events: ['reconnected', 'reconnectedToOldServer']
				});

				this.emit('reconnected');
				this.emit('reconnectedToOldServer');
				this.emit('__reconnectedToOldServer__');
			}
		};

		TeleportClient.prototype._funcInternalHandlerGetObjects = function(error, objectProps) {
			if (!this._valueIsReadyEmited) {
				this._valueServerObjectsProps = objectProps;

				this._funcObjectCreateAll();
				this._funcInternalConnected();

				this.emit('info', {
					desc: "[TeleportClient] Info: серверные объекты инициализированны, клиент готов к работе.",
					events: ['ready'],
					serverObjectsProps: this._valueServerObjectsProps
				});
				this._valueIsReadyEmited = true;

				this.emit('ready', this._valueServerObjectsProps);
			} else if (isPropsEqual(objectProps, this._valueServerObjectsProps)) {
				this.emit('info', {
					desc: "[TeleportClient] Info: Сервер был перезапущенн, но объекты телепортировал теже.",
					events: ['reconnected', 'reconnectedToNewServer']
				});

				this._funcInternalConnected();

				this.emit('reconnected');
				this.emit('reconnectedToNewServer');
				this.emit('__reconnectedToNewServer__');
			} else {
				this.emit('warn', {
					desc: "[TeleportClient] Warn: После своего перезапуска сервера прислал серверные объекты отличные от старых, рекомендую обновить страницу.",
					events: ['serverObjectsChanged', 'reconnected', 'reconnectedToNewServer'],
					newObjectProps: objectProps,
					oldObjectProps: this._valueServerObjectsProps
				});

				this._funcInternalConnected();

				this.isServerObjectChanged = true;
				this.emit('serverObjectsChanged');
				this.emit('reconnected');
				this.emit('reconnectedToNewServer');
				this.emit('__reconnectedToNewServer__');
			}

			function isPropsEqual(newObjectProps, oldObjectProps) {
				return JSON.stringify(newObjectProps) == JSON.stringify(oldObjectProps);
			};
		};

		//end InternalHandler

		//server
		TeleportClient.prototype._funcQuaranteedSendMessage = function(message) {
			if (this._valueWsClient && (this._valueWsClient.readyState == 1)) {
				this._funcWsSendMessage(message);
			} else {
				this.emit('debug', {
					desc: "[TeleportClient] Debug: Соединение с сервером сейчас отсутствует, когда оно будет восстановленно, это сообщение будет отпрваленно." +
						"Если после востановления соединения станет ясно, что подключился клиент к новому экземпляру серверу (сервер перезапущенн), то сообщение отправленно не будет.",
					message: message
				});

				var reconnectedOldServerHandler = (function(message) {
					return function() {
						this.emit('debug', {
							desc: '[TeleportClient] Debug: Соединение востановленно с прежним экземпляром сервера, или установленно впервые, отправляется сообшение на сервер',
							message: message
						});

						this.removeListener('__reconnectedToNewServer__', reconnectedNewServerHandler);
						this._funcWsSendMessage(message);
					}.bind(this);
				}.bind(this))(message);

				var reconnectedNewServerHandler = (function(message) {
					return function() {
						this.emit('debug', {
							desc: '[TeleportClient] Debug: Переподключение произошло к новому экземпляру сервера, сообщение отправленно не будет.',
							message: message
						});

						this.removeListener('__reconnectedToOldServer__', reconnectedOldServerHandler)
					}.bind(this);
				}.bind(this))(message);

				this.once('__reconnectedToNewServer__', reconnectedNewServerHandler);
				this.once('__reconnectedToOldServer__', reconnectedOldServerHandler);
			}
		};

		TeleportClient.prototype._funcWsSendMessage = function(message) {
			try {
				var string = JSON.stringify(message);

				if (this._valueWsClient && (this._valueWsClient.readyState == 1)) {
					this._valueWsClient.send(string);
				} else {
					this.emit('warn', {
						desc: "[TeleportClient] Warn: сообщение отправленно не будет, так как соединение с сервером потерянно.",
						message: message
					});
				}

			} catch (error) {
				this.emit("warn", {
					desc: "[TeleportClient] Warn: ошибка отправки сообщения на сервер: " + error,
					message: message,
					error: error
				});
			}
		};

		//end server

		//***********************************************************************************************//
		//***********************************************************************************************//
		//***********************************************************************************************//
		//***************************************   TeleportedObject   **********************************//
		//***********************************************************************************************//
		//***********************************************************************************************//
		//***********************************************************************************************//

		/**
			Инициализатор сервернех объектов, 
			все методы будут созданны функцией _funcObjectCreate класса TeleportClient,
			а не силами конструктора класса TeleportedObject, потому что в создаваемых 
			методах проброшенных с сервера объектах 
			потребуется использовать _funcWsSendMessage, класса TeleportClient,
			который исользует ws клиент класса TeleportClient.

			_funcWsSendMessage конечно можно пробросить прибиндив к нему this TeleportClient
			и исполтьзовать внутри TeleportedObject, но это усложняет код и выглядит стремно.

			в качестве альтернативы можно отвязать коннект клиента с сервером от ws сессии,
			и завести какие нибудь дополнительные идентификаторы для обозначения собственно сессий, 
			и тогда можно создать отдельный ws Client в TeleportedObject, и собственно свою собственную
			функцию _funcWsSendMessage запилить, но я не хочу, это усложнит код и вот.

		*/


		util.inherits(TeleportedObject, EventEmitter);

		function TeleportedObject(objectProps) {
			this.__events__ = objectProps.events;
			this.__methods__ = objectProps.methods;
		};

		TeleportClient.prototype._funcObjectCreateAll = function() {
			for (var objectName in this._valueServerObjectsProps) {
				this._funcObjectCreate(objectName);
			}
		};

		/**
			Метод инициализирующий принятый от сервера объект, 
			принимает имя объекта, не очень оптимально, но наглядно
			
		*/
		TeleportClient.prototype._funcObjectCreate = function(objectName) {
			var objectProps = this._valueServerObjectsProps[objectName];
			this.objects[objectName] = new TeleportedObject(objectProps);

			for (var methodIndex = 0; methodIndex < objectProps.methods.length; methodIndex++) {
				var methodName = objectProps.methods[methodIndex];

				this.objects[objectName][methodName] =
					this._funcMethodCreate(objectName, methodName).bind(this);
			}
		};

		/**
			Эта функция принимает строки methodName и objectName.
			И возвражает функцию, для которой эти строки будут доступны через замыкание.
			
			Создаваемая функция, булучи вызванной разбирает входящий массив arguments на собственно 
			аргументы для функции и callback.
			Этому вызову присваивается requestId которому в соответствие ставиться принятый callback.
			После этого запрос отправляется на сервер.
			
			Так как эта функция будет присвоенна полю объекта, то для удобства она возвращает 
			контекст объека из которого она была вызванна.
			Чтобы можно было писать вот такие штуки:
			teleportClient.objects.someObjectName
				.firstMethod(someHandler)
				.secondMethod(someHandler);

		*/
		TeleportClient.prototype._funcMethodCreate = function(objectName, methodName) {
			return function() { //(callback) or (args.., callback) or (args...) or ()
				var args;
				var callback;

				if (arguments.length > 0) {
					var sliceEndIndex = arguments.length - 1;
					var callbackIndex = arguments.length - 1;

					if (typeof(arguments[callbackIndex]) != 'function') sliceEndIndex = arguments.length;
					else callback = arguments[callbackIndex];

					args = Array.prototype.slice.call(arguments, 0, sliceEndIndex);
				}

				if (!callback)
					callback = function(error, result) {
						this.emit('warn', {
							desc: "[TeleportClient] Warn: сервер вернул результат для " + objectName + "." + methodName + " без зарегистрированного на клиенте калбека",
							calledWithArguments: arguments,
							returnedError: error,
							returnedResult: result
						});
					}.bind(this);

				var requestId = this._valueRequests.length;
				this._valueRequests.push(callback);

				this.emit('debug', {
					desc: "[TeleportClient] Debug: вызвын метод серверного объекта: " + objectName + "." + methodName,
					args: args,
					requestId: requestId
				});

				this._funcQuaranteedSendMessage({
					objectName: objectName,
					type: "command",
					command: methodName,
					requestId: requestId,
					peerId: this._valuePeerId,
					args: args
				});

				return this.objects[objectName];
			};
		};

		/**
			Хендлер для калбеков методов серверных объектов.
			формат принимаемого аргумента 
			
			message = {
				type: 'callback',
				command: 'methodName',
				objectName: 'objectName',
				requestId: 0,
				error: null,
				result: someResult
			}

			внутри метода будет вызван калбек поставленный в соответствие с requestId

		*/
		TeleportClient.prototype._funcCallbackHandler = function(message) {
			this.emit('debug', {
				desc: "[TeleportClient] Debug: сервер вернул callback на: " + message.objectName + "." + message.command,
				message: message
			});

			this._valueRequests[message.requestId](message.error, message.result);
			delete this._valueRequests[message.requestId];
		};

		/**
			Хэндлер для событий выбрасываемых серверными объектами
			формат принимаего аргумента

			так как emit принимает неограниченное количество аргументов передаваемых подписчикам, то
			message.args это массив, содержащий переданные аргументы.

			message = {
				type: 'event',
				event: 'eventName',
				objectName: 'someObjectName'
				args: [someArgs]
			}

		*/
		TeleportClient.prototype._funcEventHandler = function(message) {
			this.emit('debug', {
				desc: "[TeleportClient] Debug: сервер передал событие: " + message.objectName + "." + message.event,
				message: message
			});

			var emitArgs = [];
			emitArgs.push(message.event);
			emitArgs = emitArgs.concat(message.args);

			var object = this.objects[message.objectName];

			object.emit.apply(object, emitArgs);
		};

		//end private

		return TeleportClient;
	}
}(window));
},{"events":3,"util":7}],3:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],4:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],5:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],6:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],7:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require("9ApfnP"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":6,"9ApfnP":5,"inherits":4}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvb3B0L25vZGUvbGliL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9waS9ub2RlLmpzL3Byb2R1Y3Rpb24vTXlXZWJDb21wb25lbnRzL1RlbGVwb3J0Q2xpZW50L3Rlc3RQcm9qZWN0L2Jyb3dzZXJpZnktc3R5bGUvbWFpblRlc3QuanMiLCIvaG9tZS9waS9ub2RlLmpzL3Byb2R1Y3Rpb24vTXlXZWJDb21wb25lbnRzL1RlbGVwb3J0Q2xpZW50L3Rlc3RQcm9qZWN0L2Jyb3dzZXJpZnktc3R5bGUvbm9kZV9tb2R1bGVzL3RlbGVwb3J0LWNsaWVudC9UZWxlcG9ydENsaWVudC5qcyIsIi9vcHQvbm9kZS9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCIvb3B0L25vZGUvbGliL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0c19icm93c2VyLmpzIiwiL29wdC9ub2RlL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwiL29wdC9ub2RlL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvdXRpbC9zdXBwb3J0L2lzQnVmZmVyQnJvd3Nlci5qcyIsIi9vcHQvbm9kZS9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3V0aWwvdXRpbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNTBCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIFRlbGVwb3J0Q2xpZW50ID0gcmVxdWlyZSgndGVsZXBvcnQtY2xpZW50Jyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKTtcblxud2luZG93LnRlbGVwb3J0Q2xpZW50ID0gbmV3IFRlbGVwb3J0Q2xpZW50KHtcblx0XHRzZXJ2ZXJBZGRyZXNzOiBcIndzOi8vbG9jYWxob3N0OjgwMDBcIixcblx0XHRhdXRvUmVjb25uZWN0OiAzMDAwXG5cdH0pXG5cdC5vbignZGVidWcnLCBjb25zb2xlLmRlYnVnLmJpbmQoY29uc29sZSkpXG5cdC5vbignaW5mbycsIGNvbnNvbGUuaW5mby5iaW5kKGNvbnNvbGUpKVxuXHQub24oJ3dhcm4nLCBjb25zb2xlLndhcm4uYmluZChjb25zb2xlKSlcblx0Lm9uKCdlcnJvcicsIGNvbnNvbGUuZXJyb3IuYmluZChjb25zb2xlKSlcblx0Lm9uKCdyZWFkeScsIGZ1bmN0aW9uKG9iamVjdHNQcm9wcykge1xuXHRcdC8vZm9yIERlYnVnaW5nXG5cdFx0d2luZG93LnNpbXBsZU9iamVjdCA9IHRlbGVwb3J0Q2xpZW50Lm9iamVjdHMuc2ltcGxlT2JqZWN0OztcblxuXHRcdC8qZXZlbnRzKi9cblx0XHRzaW1wbGVPYmplY3Rcblx0XHRcdC5vbihcblx0XHRcdFx0J2V2ZW50V2l0aE15T3B0aW9ucycsXG5cdFx0XHRcdENyZWF0ZUV2ZW50TG9nZ2VyKCdzaW1wbGVPYmplY3QnLCAnZXZlbnRXaXRoTXlPcHRpb25zJykpXG5cdFx0XHQub24oXG5cdFx0XHRcdCdldmVudFdpdGhvdXRBcmdzJyxcblx0XHRcdFx0Q3JlYXRlRXZlbnRMb2dnZXIoJ3NpbXBsZU9iamVjdCcsICdldmVudFdpdGhvdXRBcmdzJykpXG5cdFx0XHQub24oXG5cdFx0XHRcdCdldmVudFdpdGhVbmxpbUFyZ3MnLFxuXHRcdFx0XHRDcmVhdGVFdmVudExvZ2dlcignc2ltcGxlT2JqZWN0JywgJ2V2ZW50V2l0aFVubGltQXJncycpKVxuXHRcdFx0Lm9uKFxuXHRcdFx0XHQnMTBzZWNJbnRlcnZhbEV2ZW50Jyxcblx0XHRcdFx0Q3JlYXRlRXZlbnRMb2dnZXIoJ3NpbXBsZU9iamVjdCcsICcxMHNlY0ludGVydmFsRXZlbnQnKSk7XG5cblxuXHRcdC8qZnVuY3Mgd2l0aCBjYWxsYmFjayovXG5cdFx0c2ltcGxlT2JqZWN0XG5cdFx0XHQuZnVuYyhcblx0XHRcdFx0J3NpbWVwbGVQYXJhbScsXG5cdFx0XHRcdENyZWF0ZUNhbGxiYWNrTG9nZ2VyKCdzaW1wbGVPYmplY3QnLCAnZnVuYycpKVxuXHRcdFx0LmZ1bmNXaXRob3V0QXJncyhcblx0XHRcdFx0Q3JlYXRlQ2FsbGJhY2tMb2dnZXIoJ3NpbXBsZU9iamVjdCcsICdmdW5jV2l0aG91dEFyZ3MnKSlcblxuXHRcdC8qZnVuY3Mgd2l0aG91dCBjYWxsYmFjayovXG5cdFx0c2ltcGxlT2JqZWN0XG5cdFx0XHQuZnVuY1dpdGhVbmxpbUFyZ3MoZmFsc2UsICcxJywgMiwgMylcblx0XHRcdC5mdW5jV2l0aDEwU2VjRGVsYXkoKTtcblxuXHR9KS5pbml0KCk7XG5cblxuZnVuY3Rpb24gQ3JlYXRlRXZlbnRMb2dnZXIob2JqZWN0TmFtZSwgZXZlbnROYW1lKSB7XG5cdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHR2YXIgb2JqID0ge1xuXHRcdFx0ZGVzYzogdXRpbC5mb3JtYXQoXCJbJXMuZXZlbnRdIEluZm86INC/0L7Qu9GD0YfQtdC90L4g0YHQvtCx0YvRgtC40LUgJXNcIiwgb2JqZWN0TmFtZSwgZXZlbnROYW1lKSxcblx0XHRcdGFyZ3VtZW50czogYXJndW1lbnRzXG5cdFx0fTtcblxuXHRcdHZhciBkZXRhaWxzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGV0YWlscycpO1xuXHRcdGRldGFpbHMuaW5uZXJIVE1MID0gXCI8c3VtbWFyeT5cIiArIG9iai5kZXNjICsgXCI8L3N1bW1hcnk+XCIgKyBcIjxwcmU+XCIgKyBKU09OLnN0cmluZ2lmeShvYmosICcgJywgNCkgKyBcIjwvcHJlXCI7XG5cblx0XHR2YXIgd2VsY29tID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3dlbGNvbScpO1xuXHRcdHdlbGNvbS5wYXJlbnROb2RlLmluc2VydEJlZm9yZShkZXRhaWxzLCB3ZWxjb20pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIENyZWF0ZUNhbGxiYWNrTG9nZ2VyKG9iamVjdE5hbWUsIG1ldGhvZE5hbWUpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKGVycm9yLCByZXN1bHQpIHtcblx0XHR2YXIgb2JqID0ge1xuXHRcdFx0ZGVzYzogdXRpbC5mb3JtYXQoXCJbJXMuY2FsbGJhY2tdIEluZm86INCy0LXRgNC90YPQu9GB0Y8g0YDQtdC30YPQu9GM0YLQsNGCINCy0YvQt9C+0LLQsCDQvNC10YLQvtC00LAgJXNcIiwgb2JqZWN0TmFtZSwgbWV0aG9kTmFtZSksXG5cdFx0XHRyZXN1bHQ6IHJlc3VsdCxcblx0XHRcdGVycm9yOiBlcnJvclxuXHRcdH07XG5cblxuXHRcdHZhciBkZXRhaWxzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGV0YWlscycpO1xuXHRcdGRldGFpbHMuaW5uZXJIVE1MID0gXCI8c3VtbWFyeT5cIiArIG9iai5kZXNjICsgXCI8L3N1bW1hcnk+XCIgKyBcIjxwcmU+XCIgKyBKU09OLnN0cmluZ2lmeShvYmosICcgJywgNCkgKyBcIjwvcHJlXCI7XG5cblx0XHR2YXIgd2VsY29tID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3dlbGNvbScpO1xuXHRcdHdlbGNvbS5wYXJlbnROb2RlLmluc2VydEJlZm9yZShkZXRhaWxzLCB3ZWxjb20pO1xuXHR9XG59IiwiLyoqXG5cdGh0dHBzOi8vZ2l0aHViLmNvbS9uc2themtpL3dlYi1UZWxlcG9ydENsaWVudFxuXHRNSVRcblx0ZnJvbSBydXNzaWEgd2l0aCBsb3ZlLCAyMDE0XG4qL1xuXG5cbi8qXG5uZWVkIGluY2x1ZGU6XG5cdG15LWhlbHBlcnMvdXRpbC5qc1xuXHRteS1oZWxwZXJzL0V2ZW50RW1pdHRlci5qc1xuKi9cblxuLypcblx0cmVxdWlyZWpzLmNvbmZpZyh7XG5cdFx0cGF0aHM6IHtcblx0XHRcdEV2ZW50RW1pdHRlcjogJ2Jvd2VyX2NvbXBvbmVudHMvbXktaGVscGVycy9FdmVudEVtaXR0ZXInLFxuXHRcdFx0dXRpbDogJ2Jvd2VyX2NvbXBvbmVudHMvbXktaGVscGVycy91dGlsJ1xuXHRcdH1cblx0fSk7XG5cblx0b3Jcblx0XG5cdDxzY3JpcHQgc3JjPVwiLi9qcy9zb21lTGlic0ZvbGRlci9teS1oZWxwZXJzL0V2ZW50RW1pdHRlci5qc1wiIHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIj48L3NjcmlwdD5cblx0PHNjcmlwdCBzcmM9XCIuL2pzL3NvbWVMaWJzRm9sZGVyL215LWhlbHBlcnMvdXRpbC5qc1wiIHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIj48L3NjcmlwdD5cbiovXG5cbi8qXG5cdFB1YmxpYzpcblxuXHRcdGluaXRcblx0XHRkZXN0cm95XHRcdFx0XG5cblx0RXZlbnRzOlxuXG5cdFx0ZGVidWcgXG5cdFx0aW5mbyBcblx0XHR3YXJuIFxuXHRcdGVycm9yIFx0XG5cblx0XHRyZWFkeVxuXHRcdGNsb3NlXG5cdFx0ZGVzdHJveWVkXG5cdFx0XG5cdFx0cmVjb25uZWN0ZWRcblx0XHRyZWNvbm5lY3RpbmdcblxuXHRcdHJlY29ubmVjdGVkVG9OZXdTZXJ2ZXJcblx0XHRyZWNvbm5lY3RlZFRvT2xkU2VydmVyXG5cblx0XHRzZXJ2ZXJPYmplY3RzQ2hhbmdlZFxuKi9cblxuXCJ1c2Ugc3RyaWN0XCI7XG5cbihmdW5jdGlvbihuYW1lc3BhY2UpIHtcblxuXHRpZiAobmFtZXNwYWNlLmRlZmluZSAmJiBuYW1lc3BhY2UucmVxdWlyZWpzKSB7XG5cdFx0LyoqXG5cdFx0XHTQoNCw0Lcg0LXRgdGC0YwgZGVmaW5lINC4IHJlcXVpcmVqcyDQt9C90LDRh9C40YIg0L/QvtC00LrQu9GO0YfQtdC9IHJlcXVpcmVqcy5cblx0XHRcdNCX0LDQstC40YHQuNC80L7RgdGC0Lgg0LHRg9C00LXRgiDQv9C10YDQtdC00LDQvdC90Ysg0LIgQ3JlYXRlVGVsZXBvcnRTZXJ2ZXIsIFxuXHRcdFx00LrQvtGC0L7RgNGL0Lkg0LLQtdGA0L3QtdGCINGB0YTQvtGA0LzQuNGA0L7QstCw0L3QvdGL0Lkg0LrQu9Cw0YHRgSBUZWxlcG9ydENsaWVudFxuXG5cdFx0Ki9cblx0XHRkZWZpbmUoXG5cdFx0XHRbXG5cdFx0XHRcdCdFdmVudEVtaXR0ZXInLFxuXHRcdFx0XHQndXRpbCdcblx0XHRcdF0sXG5cdFx0XHRDcmVhdGVUZWxlcG9ydFNlcnZlcik7XG5cdH0gZWxzZSBpZiAoaXNNb2R1bGUoKSkge1xuXHRcdC8qKlxuXHRcdFx00KDQsNC3INC10YHRgtGMIG1vZHVsZS5leHBvcnRzINC30L3QsNGH0LjRgiBicm93c2VyaWZ5INGB0LXQudGH0LDRgSDQv9C+0LTQutC70Y7Rh9Cw0LXRgiDRjdGC0L7RgiDQvNC+0LTRg9C70Yxcblx0XHRcdNCX0LDQstC40YHQuNC80L7RgdGC0Lgg0YPQtNC+0LLQu9C10YLQstC+0YDQuNGCINGB0LDQvCBicm93c2VyaWZ5LiBcblx0XG5cdFx0Ki9cblxuXHRcdHZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cdFx0dmFyIHV0aWwgPSByZXF1aXJlKCd1dGlsJyk7XG5cblx0XHRtb2R1bGUuZXhwb3J0cyA9IENyZWF0ZVRlbGVwb3J0U2VydmVyKEV2ZW50RW1pdHRlciwgdXRpbCk7XG5cdH0gZWxzZSB7XG5cdFx0LyoqXG5cdFx0XHTQmNC90LDRh9C1INGB0YfQuNGC0LDRjiwg0YfRgtC+IFRlbGVwb3J0Q2xpZW50INC/0L7QtNC60LvRjtGH0LXQvSDQsiBcItC60LvQsNGB0YHQuNGH0LXRgdC60LjQuVwiXG5cdFx0XHTQv9GA0L7QtdC60YIsINC30LDQstC40YHQuNC80L7RgdGC0Lgg0YPQtNC+0LLQu9C10YLQstC+0YDQtdC90Ysg0YDQsNC30YDQsNCx0L7RgtGH0LjQutC+0Lwg0L/RgNC+0LXQutGC0LAg0LrQvtGC0L7RgNC+0LzRgyDQvNC+0LkgXG5cdFx0XHTQutC70LDRgdGBINC/0L7QvdCw0LTQvtCx0LjQu9GB0Y8sINC4INC00L7QsdCw0LLQu9GP0Y4g0YHRhNC+0YDQvNC40YDQvtCy0LDQvdC90YvQuSDQutC70LDRgdGBINCyINCz0LvQvtCx0LDQu9GM0L3QvtC1INC/0YDQvtGB0YLRgNCw0L3RgdGC0LLQviDQuNC80LXQvS5cblxuXHRcdCovXG5cdFx0bmFtZXNwYWNlLlRlbGVwb3J0Q2xpZW50ID0gQ3JlYXRlVGVsZXBvcnRTZXJ2ZXIoRXZlbnRFbWl0dGVyLCB1dGlsKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGlzTW9kdWxlKCkge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gbW9kdWxlICYmIG1vZHVsZS5leHBvcnRzO1xuXHRcdH0gY2F0Y2ggKGV4KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gQ3JlYXRlVGVsZXBvcnRTZXJ2ZXIoRXZlbnRFbWl0dGVyLCB1dGlsKSB7XG5cdFx0dXRpbC5pbmhlcml0cyhUZWxlcG9ydENsaWVudCwgRXZlbnRFbWl0dGVyKTtcblxuXHRcdC8qKlxuXHRcdFx00K3RgtC+IFJQQyDQutC70LjQtdC90YIsINGD0LzQtdC10YIg0LLRi9C30YvQstCw0YLRjCDQvNC10YLQvtC00Ysg0YLQtdC70LXQv9C+0YDRgtC40YDQvtCy0LDQvdC90YvRhSDQvtCx0YrQtdC60YLQvtCyINC4INC/0L7Qu9GD0YfQsNGC0Ywg0YHQvtCx0LjRgtC40Y8g0LjQvNC4INCy0YvQsdGA0LDRgdGL0LLQsNC10LzRi9C1LiBcblx0XHRcdNCi0LDQutC20LUg0YPQvNC10LXRgiDQstC+0YHRgdGC0LDQvdCw0LLQu9C40LLQsNGC0Ywg0YHQvtC10LTQuNC90LXQvdC40LUg0YEg0YHQtdGA0LLQtdGA0L7QvCDQsiDRgdC70YPRh9Cw0LUg0YDQsNC30YDRi9Cy0LAg0YHQvtC10LTQuNC90LXQvdC40Y8uXG5cblx0XHRcdNCa0L7QvdGB0YLRgNGD0LrRgtC+0YAg0LrQu9Cw0YHRgdCwIFRlbGVwb3J0Q2xpZW50LCDQv9GA0LjQvdC40LzQsNC10YIg0LXQtNC40L3RgdGC0LLQtdC90L3Ri9C8INC/0LDRgNCw0LzQtdGC0YDQvtC8INC+0LHRitC10LrRgiDRgSDQvtC/0YbQuNGP0LzQuCxcblx0XHRcdNCy0L7Qt9Cy0YDQsNGJ0LDQtdGCINC90L7QstGL0Lkg0L3QtdC40L3QtdGG0LjQsNC70LjQt9C40YDQvtCy0LDQvdC90YvQuSDQvtCx0YrQtdC60YIg0LrQu9Cw0YHRgdCwIFRlbGVwb3J0Q2xpZW50XG5cdFx0XHRcblx0XHRcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdFx0XHRvcHRpb25zID0ge1xuXHRcdFx0XHRzZXJ2ZXJBZGRyZXNzOiBcIndzOi8vbG9jYWxob3N0OjgwMDBcIixcblx0XHRcdFx0YXV0b1JlY29ubmVjdDogMzAwMFxuXHRcdFx0fVxuXG5cdFx0XHRzZXJ2ZXJBZGRyZXNzIC0g0LDQtNGA0LXRgSBUZWxlcG9ydFNlcnZlclxuXHRcdFx0XHRkZWZhdWx0OiBcIndzOi8vbG9jYWxob3N0OjgwMDBcIlxuXG5cdFx0XHRhdXRvUmVjb25uZWN0IC0g0LLRgNC10LzRjyDQt9Cw0LTQtdGA0LbQutC4INC/0LXRgNC10LQg0L/QvtC/0YvRgtC60L7QuSDQv9C10YDQtdC/0L7QtNC60LvRjtGH0L3QuNGPINC6INGB0LXRgNCy0LXRgNGDLlxuXHRcdFx0XHTQtdGB0LvQuCDRh9C40YHQu9C+IC0g0YLQviDRjdGC0L4g0LLRgNC10LzRjyDQt9Cw0LTQtdGA0LbQutC4INCyINC80LjQu9C70LXRgdC10LrRg9C90LTQsNGFXG5cdFx0XHRcdNC10YHQu9C4IGZhbHNlIC0g0YLQviDQv9C10YDQtdC/0L7QtNC60LvRjtGH0LXQvdC40Y8g0L3QtSDQsdGD0LTQtdGCINCy0YvQv9C+0LvQvdC10L3QvdC+LlxuXHRcdFx0XHRkZWZhdWx0OiAzMDAwIG1zZWNcblxuXHRcdFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXHRcdFx00YTQvtGA0LzQsNGCINC40L3QuNGG0LjQsNC70LjRgNGD0LXQvNGL0YUg0L/QvtC70LXQuTpcblxuXHRcdFx00JzQsNGB0YHQuNCyINGBINC60LDQu9Cx0LXQutCw0LzQuCDQtNC70Y8g0LLRi9C30LLQsNC90L3Ri9GFINGC0LXQu9C10L/QvtGA0YLQuNGA0L7QstCw0L3QvdGL0YUg0LzQtdGC0L7QtNC+0LIuXG5cdFx0XHTQsiDQutCw0LbQtNC+0Lwg0YHQvtC+0LHRidC10L3QuNC1INGD0YXQvtC00Y/RidC10Lwg0L3QsCDRgdC10YDQstC10YAg0LXRgdGC0Ywg0L/QvtC70LUgcmVxdWVzdElkLCDQt9C90LDRh9C10L3QuNC1INCyINGN0YLQvtC8INC/0L7Qu9C1INGN0YLQviDQuNC90LTQtdC60YEg0LrQsNC70LvQsdC10LrQsCDQsiDRjdGC0L7QvCDQvNCw0YHRgdC40LLQtTpcblx0XHRcdFxuXHRcdFx0XHR0aGlzLl92YWx1ZVJlcXVlc3RzID0gW1xuXHRcdFx0XHRcdDE6IHNvbWVDYWxsYmFjayxcblx0XHRcdFx0XHQyOiBzZWNvbmRDYWxsYmFja1xuXHRcdFx0XHRdXG5cdFx0XHRcblx0XHRcdNCe0LHRitC10LrRgiDRgdC+0LTQtdGA0LbQsNGJ0LjQuSDRgdCy0L7QudGB0YLQstCwINGC0LXQu9C10L/QvtGA0YLQuNGA0YPQtdC80YvRhSDQvtCx0YrQtdC60YLQvtCyLCDQutC+0YLQvtGA0YvQtSDQv9GA0L7QuNC90LjRhtC40LDQu9C40LfQuNGA0YPRjtGCINC+0LHRitC10LrRgtGLINCyIHRoaXMub2JqZWN0c1xuXHRcdFx00J/QvtC70YPRh9Cw0Y4g0L/RgNC4INC/0LXRgNCy0L7QvCDRg9GB0L/QtdGI0L3QvtC8INGB0L7QtdC00LjQvdC10L3QuNC4INGBINGB0LXRgNCy0LXRgNC+0LwuXG5cblx0XHRcdNCV0YHQu9C4INC/0YDQvtC40LfQvtC50LTQtdGCINGA0LDQt9GK0LXQtNC40L3QtdC90LjQtSDRgSDRgdC10YDQstC10YDQvtC8INC/0L4g0L/RgNC40YfQuNC90LUg0LPRgNGD0YHRgtC90YvRhSDQuNC90YLQtdGA0L3QtdGC0L7Qsiwg0YLQviDQv9C10YDQtdC30LDQv9GA0LDRiNC40LLQsNGC0Ywg0LXQs9C+INC90LXRgiDRgdC80YvRgdC70LAsINC/0L7RgtC+0LzRgyDRh9GC0L4g0L3QsCDRgdC10YDQstC10YDQtSDQvdC40YfQtdCz0L4g0L3QtSDQv9C+0LzQtdC90Y/Qu9C+0YHRjC5cblx0XHRcdNCV0YHQu9C4INC20LUg0YDQsNC30YrQtdC00LjQvdC40LvQviDQv9C+0YLQvtC80YMg0YfRgtC+INGB0LXRgNCy0LXRgCDQsdGL0Lsg0L/QtdGA0LXQt9Cw0L/Rg9GJ0LXQvdC9LCDRgtC+INGB0LLQvtC50YHRgtCy0LAg0YLQtdC70LXQv9C+0YDRgtC40YDRg9C10LzQvNGL0YUg0L7QsdGK0LXQutGC0L7QsiDQsdGD0LTRg9GCINC/0LXRgNC10LfQsNC/0YDQvtGI0LXQvdC90YsuXG5cdFx0XHRcdCog0JXRgdC70Lgg0L7QvdC4INC90LUg0LjQt9C80LXQvdC40LvQuNGB0YwsINGC0L4g0YDQsNCx0L7RgtCwINCx0YPQtNC10YIg0L/RgNC+0LTQvtC70LbQtdC90L3QsC5cblx0XHRcdFx0KiDQmNC70Lgg0LjQt9C80LXQvdC40LvQuNGB0YwsINGC0L4g0LHRg9C00LXRgiDQstGL0LHRgNC+0YjQtdC90L3QviDRgdC+0LHRi9GC0LjQtSBgc2VydmVyT2JqZWN0c0NoYW5nZWRgIFxuXHRcdFx0XHQgKiDQuCDRjyDQsdGLINC90LAg0LzQtdGB0YLQtSDRgdC70L7QstC40LLRiNC10LPQviDQtdCz0L4g0L/RgNC+0LPRgNCw0LzQvNC40YHRgtCwINCy0YvQstGL0LXQuyDQv9C+0LvRjNC30L7QstCw0YLQtdC70Y4g0L/RgNC10LTQu9C+0LbQtdC90LjQtSDQv9C10YDQtdC30LDQs9GA0YPQt9C40YLRjCDRgdGC0YDQsNC90LjRhtGDLlxuXHRcdFx0XHQgICDQn9C+0YLQvtC80YMg0YfRgtC+INC40LfQvNC10L3QtdC90LjQtSDQvdCw0LHQvtGA0LAg0YHQtdGA0LLQtdGA0L3Ri9GFINC+0LHRitC10LrRgtC+0LIg0L3QtdC80LjQvdGD0LXQvNC+ICjQvtCx0YvRh9C90L4pINCy0LvQtdGH0LXRgiDQuNC30LzQtdC90LXQvdC40LUg0LrQu9C40LXQvdGC0YHQutC+0LPQviDRgdGG0LXQvdCw0YDQuNGPLCDQuCDRh9GC0L7QsdGLINC10LPQviDQvtCx0L3QvtCy0LjRgtGMXG5cdFx0XHRcdCAgINC90YPQttC90L4g0L7QsdC90L7QstC40YLRjCDRgdGC0YDQsNC90LjRh9C60YMgKNC90LDRgdC60L7Qu9GM0LrQviDQvNC90LUg0LjQt9Cy0LXRgdGC0L3QviDQvdCw0LPQvtGA0Y/Rh9GD0Y4ganMg0YHQutGA0LjQv9GC0Ysg0L/QvtC00LzQtdC90Y/RgtGMINC90LXQu9GM0LfRjykuXG5cdFx0XHRcdCAqINCi0LDQutC20LUg0L3QtdGB0LzQvtGC0YDRjyDQvdCwINGC0L4g0YfRgtC+INCx0YvQu9C4INC/0L7Qu9GD0YfQtdC90L3RiyDQvdC+0LLRi9C1INGB0LLQvtC50YHRgtCy0LAsXG5cdFx0XHRcdCAgINC+0L3QuCDQvdC1INCx0YPQtNGD0YIg0L/QvtC80LXRidC10L3QvdGLINCyIHRoaXMuX3ZhbHVlU2VydmVyT2JqZWN0c1Byb3BzINC4IHRoaXMub2JqZWN0cyDQvdC1INCx0YPQtNC10YIg0LjQt9C80LXQvdC10L3QvS5cblx0XHRcdFx0ICAg0LjQt9C80LXQvdC40YLRjNGB0Y8g0YLQvtC70YzQutC+INGE0LvQsNCzIHRoaXMuaXNTZXJ2ZXJPYmplY3RDaGFuZ2VkID0gdHJ1ZTtcblxuXHRcdFx0XHR0aGlzLl92YWx1ZVNlcnZlck9iamVjdHNQcm9wcyA9IHtcblx0XHRcdFx0XHQnc29tZVNlcnZlck9iamVjdE5hbWUnOiB7XG5cdFx0XHRcdFx0XHRldmVudHM6IFsnZmlyc3RQZXJtaXRlZEV2ZW50TmFtZScsICdzZWNvbmRQZXJtaXRlZEV2ZW50TmFtZSddLFxuXHRcdFx0XHRcdFx0bWV0aG9kczogWydmaXJzdE1ldGhvZE5hbWUnLCAnc2Vjb25kTWV0aG9kTmFtZSddXG5cdFx0XHRcdFx0fSwgLi4uXG5cdFx0XHRcdH1cblxuXHRcdFx00J7QsdGK0LXQutGCINGB0L7QtNC10YDQttCw0YnQuNC5INCyINGB0LXQsdC1INC/0YDQvtC40L3QuNGG0LjQsNC70LjQt9C40YDQvtCy0LDQvdC90YvQtSDRgtC10LvQtdC/0L7RgNGC0LjRgNC+0LLQsNC90L3Ri9C1INC+0LHRitC10LrRgtGLLlxuXHRcdFx00KMg0L3QuNGFINC10YHRgtGMINC90LXRgdC60L7Qu9GM0LrQviDRgdC70YPQttC10LHQvdGL0YUg0L/QvtC70LXQuSDQuCDQvNC10YLQvtC00Ysg0YPQvdCw0YHQu9C10LTQvtCy0LDQvdC90YvQtSDQvtGCINC60LvQsNGB0YHQsCBFdmVudEVtZXR0ZXIuXG5cdFx0XHRcblx0XHRcdNCc0LXRgtC+0LTRiyDRgdC+0LfQtNCw0LLQsNC10LzRi9C1INCy0L3Rg9GC0YDQuCDRgtC10LvQtdC/0L7RgNGC0LjRgNC+0LLQsNC90L3QvtCz0L4g0L7QsdGK0LXQutGC0LAg0YDQsNC30LHQuNGA0LDRjtGCINC/0YDQuNGF0L7QtNGP0YnQuNC5INC/0YHQtdCy0LTQvtC80LDRgdGB0LjQsiBhcmd1bWVudHMgXG5cdFx0XHTQstGL0LTQtdC70Y/RjtGCINC40Lcg0L3QtdCz0L4g0LDRgNCz0YPQvNC10L3RgtGLINC00LvRjyDQvNC10YLQvtC00LAg0Lgg0LrQsNC70LHQtdC6ICjQtdGB0LvQuCDQutCw0LvQsdC10LrQsCDQvdC10YIsINGC0L4g0YHQvtC30LTQsNC10YLRgdGPINC30LDQs9C70YPRiNC60LApXG5cdFx0XHTQt9Cw0L/RgNC+0YHRgyDQv9GA0LjRgdCy0LDQtdCy0LDRgtC10YHRjyByZXF1ZXN0SWQsINC60LDQu9C70LHQtdC6INC/0L7QtCDRjdGC0LjQvCBpZCDQv9C+0LzQtdGJ0LDQtdGC0YHRjyDQsiB0aGlzLl92YWx1ZVJlcXVlc3RzXG5cdFx0XHTQuCDQt9Cw0L/RgNC+0YEg0L7RgtC/0YDQsNCy0LvRj9C10YLRgdGPINC90LAg0YHQtdGA0LLQtdGALlxuXG5cdFx0XHR0aGlzLm9iamVjdHMgPSB7XG5cdFx0XHRcdCdzb21lU2VydmVyT2JqZWN0TmFtZSc6IHtcblx0XHRcdFx0XHRfX2V2ZW50c19fOiBbJ2ZpcnN0UGVybWl0ZWRFdmVudE5hbWUnLCAnc2Vjb25kUGVybWl0ZWRFdmVudE5hbWUnXSxcblx0XHRcdFx0XHRfX21ldGhvZHNfXzogWydmaXJzdE1ldGhvZE5hbWUnLCAnc2Vjb25kTWV0aG9kTmFtZSddLFxuXHRcdFx0XHRcdGZpcnN0TWV0aG9kTmFtZTogZnVuY3Rpb24oYXJncywgc2Vjb25kQXJnLCBjYWxsYmFjaykgey4uLn0sXG5cdFx0XHRcdFx0c2Vjb25kTWV0aG9kTmFtZTogZnVuY3Rpb24oY2FsbGJhY2spIHsuLi59LFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHQqL1xuXHRcdGZ1bmN0aW9uIFRlbGVwb3J0Q2xpZW50KG9wdGlvbnMpIHtcblx0XHRcdC8vb3B0aW9uc1xuXHRcdFx0dGhpcy5fb3B0aW9uV3NTZXJ2ZXJBZGRyZXNzID0gb3B0aW9ucy5zZXJ2ZXJBZGRyZXNzIHx8IFwid3M6Ly9sb2NhbGhvc3Q6ODAwMFwiO1xuXHRcdFx0dGhpcy5fb3B0aW9uQXV0b1JlY29ubmVjdCA9IChvcHRpb25zLmF1dG9SZWNvbm5lY3QgPT09IHVuZGVmaW5lZCkgPyAzMDAwIDogb3B0aW9ucy5hdXRvUmVjb25uZWN0O1xuXG5cdFx0XHQvL2VuZCBvcHRpb25zXG5cblx0XHRcdC8vcHJpdmF0ZVxuXHRcdFx0dGhpcy5fdmFsdWVXc0NsaWVudCA9IG51bGw7XG5cdFx0XHR0aGlzLl92YWx1ZVJlcXVlc3RzID0gW107XG5cdFx0XHR0aGlzLl92YWx1ZUludGVybmFsUmVxdWVzdHMgPSBbXTtcblxuXHRcdFx0dGhpcy5fdmFsdWVTZXJ2ZXJPYmplY3RzUHJvcHMgPSBudWxsO1xuXHRcdFx0dGhpcy5fdmFsdWVJc0luaXQgPSBmYWxzZTtcblxuXHRcdFx0dGhpcy5fdmFsdWVQZWVySWQgPSBudWxsO1xuXHRcdFx0dGhpcy5fdmFsdWVQZWVyVGltZXN0YW1wID0gbnVsbDtcblxuXHRcdFx0dGhpcy5fdmFsdWVTZXJ2ZXJUaW1lc3RhbXAgPSBudWxsO1xuXHRcdFx0dGhpcy5fdmFsdWVJc1JlYWR5RW1pdGVkID0gZmFsc2U7XG5cblx0XHRcdC8vZW5kIHByaXZhdGVcblxuXHRcdFx0Ly9wdWJsaWNcblx0XHRcdHRoaXMub2JqZWN0cyA9IHt9O1xuXHRcdFx0dGhpcy5pc1NlcnZlck9iamVjdENoYW5nZWQgPSBmYWxzZTtcblxuXHRcdFx0Ly9lbmQgcHVibGljXG5cdFx0fVxuXG5cdFx0Ly9wdWJsaWNcblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKCF0aGlzLl92YWx1ZUlzSW5pdCkge1xuXHRcdFx0XHR0aGlzLl92YWx1ZVBlZXJUaW1lc3RhbXAgPSBuZXcgRGF0ZSgpO1xuXHRcdFx0XHR0aGlzLl9mdW5jV3NJbml0KCk7XG5cblx0XHRcdFx0dGhpcy5fdmFsdWVJc0luaXQgPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0XHTQnNC10YLQvtC0INC00LXRgdGC0YDRg9C60YLQvtCyINC30LDQutGA0YvQstCw0LXRgiDRgdC+0LXQtNC40L3QtdC90LjQtSDRgSDRgdC10YDQstC10YDQvtC8LCDQstGL0LfRi9Cy0LDQtdGCINCy0YHQtSDQvtC20LjQtNCw0Y7RidC40LUg0YDQtdC30YPQu9GM0YLQsNGCINC60LDQu9C10LrQuCDRgSDQvtGI0LjQsdC60L7QuS5cblx0XHRcdNC+0YfQuNGJ0LDQtdGCINC90LXRgdC60L7Qu9GM0LrQviDRgdC70YPQttC10LHQvdGL0YUg0L/QvtC70LXQuSDQuCDQvdCw0LrQvtC90LXRhiDQstGL0LHRgNCw0YHRi9Cy0LDQtdGCIGBkZXN0cm95ZWRgXG5cblx0XHQqL1xuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAodGhpcy5fdmFsdWVJc0luaXQpIHtcblx0XHRcdFx0dGhpcy5lbWl0KCdpbmZvJywge1xuXHRcdFx0XHRcdGRlc2M6ICdbVGVsZXBvcnRDbGllbnRdIEluZm86INCg0LDQsdC+0YLQsCDQutC70LjQtdC90YLQsCDRiNGC0LDRgtC90L4g0L/RgNC10LrRgNCw0YnQtdC90LAsINC90LAg0LLRgdC1INC60LDQu9Cx0LXQutC4INCx0YPQtNC10YIg0LLQvtC30LLRgNCw0YnQtdC90LAg0L7RiNC40LHQutCwLCDRgdC+0LXQtNC40L3QtdC90LjQtSDRgSDRgdC10YDQstC10YDQvtC8INCx0YPQtNC10YIg0LfQsNC60YDRi9GC0L4uJ1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLl9mdW5jQ2xvc2VBbGxSZXF1ZXN0cygpO1xuXG5cdFx0XHRcdHRoaXMub2JqZWN0cyA9IHt9O1xuXHRcdFx0XHR0aGlzLl92YWx1ZVNlcnZlck9iamVjdHNQcm9wcyA9IHt9O1xuXHRcdFx0XHR0aGlzLl92YWx1ZUlzSW5pdCA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLl92YWx1ZVBlZXJJZCA9IG51bGw7XG5cdFx0XHRcdHRoaXMuX3ZhbHVlU2VydmVyVGltZXN0YW1wID0gbnVsbDtcblx0XHRcdFx0dGhpcy5fdmFsdWVQZWVyVGltZXN0YW1wID0gbnVsbDtcblx0XHRcdFx0dGhpcy5fdmFsdWVJc1JlYWR5RW1pdGVkID0gZmFsc2U7XG5cblx0XHRcdFx0dGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ19fcmVjb25uZWN0ZWRUb09sZFNlcnZlcl9fJyk7XG5cdFx0XHRcdHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdfX3JlY29ubmVjdGVkVG9OZXdTZXJ2ZXJfXycpO1xuXG5cdFx0XHRcdGlmICh0aGlzLl92YWx1ZVdzQ2xpZW50KSB7XG5cdFx0XHRcdFx0dGhpcy5fZnVuY1dzQ2xvc2UoKTtcblx0XHRcdFx0XHR0aGlzLmVtaXQoJ2Nsb3NlJyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLmVtaXQoJ2Rlc3Ryb3llZCcpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9O1xuXG5cdFx0Ly9lbmQgcHVibGljXG5cblx0XHQvL3ByaXZhdGVcblx0XHQvL3dzIGNsaWVudFxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY1dzSW5pdCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5fdmFsdWVXc0NsaWVudCA9IG5ldyBXZWJTb2NrZXQodGhpcy5fb3B0aW9uV3NTZXJ2ZXJBZGRyZXNzKTtcblxuXHRcdFx0Ly9vbm1lc3NhZ2Vcblx0XHRcdHRoaXMuX3ZhbHVlV3NDbGllbnQub25tZXNzYWdlID0gdGhpcy5fZnVuY1dzT25NZXNzYWdlLmJpbmQodGhpcyk7XG5cblx0XHRcdC8vb25vcGVuXG5cdFx0XHR0aGlzLl92YWx1ZVdzQ2xpZW50Lm9ub3BlbiA9IChmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5lbWl0KCdpbmZvJywge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBJbmZvOiDRgdC+0LXQtNC40L3QtdC90LjQtSDRgSDRgdC10YDQstC10YDQvtC8INGD0YHRgtCw0L3QvtCy0LvQtdC90L3QvlwiXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbEdldFNlcnZlclRpbWVzdGFtcChcblx0XHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxIYW5kbGVyR2V0VGltZXN0YW1wLmJpbmQodGhpcykpO1xuXHRcdFx0fS5iaW5kKHRoaXMpKTtcblxuXHRcdFx0Ly9vbmVycm9yXG5cdFx0XHR0aGlzLl92YWx1ZVdzQ2xpZW50Lm9uZXJyb3IgPSAoZnVuY3Rpb24oZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5lbWl0KFwiZXJyb3JcIiwge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBFcnJvcjogV2ViU29ja2V0IENsaWVudCDQstGL0LHRgNC+0YHQuNC7INC+0YjQuNCx0LrRgzogXCIgKyBlcnJvcixcblx0XHRcdFx0XHRlcnJvcjogZXJyb3Jcblx0XHRcdFx0fSk7XG5cdFx0XHR9LmJpbmQodGhpcykpO1xuXG5cdFx0XHQvL29uY2xvc2Vcblx0XHRcdHRoaXMuX3ZhbHVlV3NDbGllbnQub25jbG9zZSA9IChmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5lbWl0KCd3YXJuJywge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBXYXJuOiDQodC+0LXQtNC40L3QtdC90LjQtSDRgSDRgdC10YDQstC10YDQvtC8INC/0L7RgtC10YDRj9C90L3Qvi5cIlxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRpZiAodGhpcy5fb3B0aW9uQXV0b1JlY29ubmVjdCAhPT0gZmFsc2UpIHRoaXMuX2Z1bmNXc1JlY29ubmVjdCgpO1xuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHR0aGlzLl9mdW5jV3NDbG9zZSgpO1xuXHRcdFx0XHRcdHRoaXMuZW1pdCgnY2xvc2UnKTtcblx0XHRcdFx0fVxuXHRcdFx0fS5iaW5kKHRoaXMpKTtcblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jV3NPbk1lc3NhZ2UgPSBmdW5jdGlvbihzb3VyY2VNZXNzYWdlKSB7XG5cdFx0XHR2YXIgbWVzc2FnZSA9IEpTT04ucGFyc2Uoc291cmNlTWVzc2FnZS5kYXRhKTtcblxuXHRcdFx0aWYgKG1lc3NhZ2UudHlwZSA9PSBcImNhbGxiYWNrXCIpIHtcblx0XHRcdFx0dGhpcy5fZnVuY0NhbGxiYWNrSGFuZGxlcihtZXNzYWdlKTtcblx0XHRcdH0gZWxzZSBpZiAobWVzc2FnZS50eXBlID09IFwiaW50ZXJuYWxDYWxsYmFja1wiKSB7XG5cdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbENhbGxiYWNrSGFuZGxlcihtZXNzYWdlKTtcblx0XHRcdH0gZWxzZSBpZiAobWVzc2FnZS50eXBlID09IFwiZXZlbnRcIikge1xuXHRcdFx0XHR0aGlzLl9mdW5jRXZlbnRIYW5kbGVyKG1lc3NhZ2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dmFyIGVycm9ySW5mbyA9IHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gV2Fybjog0LTQu9GPINC00LDQvdC90L7Qs9C+INGC0LjQv9CwINGB0L7QvtCx0YnQtdC90LjQuSDQvdC10YIg0YXRjdC90LTQu9C10YDQsDogXCIgKyBtZXNzYWdlLnR5cGUsXG5cdFx0XHRcdFx0bWVzc2FnZTogbWVzc2FnZVxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdHRoaXMuZW1pdChcIndhcm5cIiwgZXJyb3JJbmZvKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jV3NSZWNvbm5lY3QgPSBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZW1pdCgnaW5mbycsIHtcblx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIEluZm86INCR0YPQtNC10YIg0LLRi9C/0L7Qu9C90LXQvdC90L4g0L/QtdGA0LXQv9C+0LTQutC70Y7Rh9C10L3QuNC1INC6INGB0LXRgNCy0LXRgNGDLlwiLFxuXHRcdFx0XHRkZWxheTogdGhpcy5fb3B0aW9uQXV0b1JlY29ubmVjdFxuXHRcdFx0fSk7XG5cblx0XHRcdGlmICh0aGlzLl92YWx1ZVdzQ2xpZW50KSB0aGlzLl9mdW5jV3NDbG9zZSgpO1xuXHRcdFx0dGhpcy5lbWl0KCdyZWNvbm5lY3RpbmcnKTtcblxuXHRcdFx0c2V0VGltZW91dCh0aGlzLl9mdW5jV3NJbml0LmJpbmQodGhpcyksIHRoaXMuX29wdGlvbkF1dG9SZWNvbm5lY3QpO1xuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNXc0Nsb3NlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLl92YWx1ZVdzQ2xpZW50Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKCkge307XG5cdFx0XHR0aGlzLl92YWx1ZVdzQ2xpZW50Lm9ub3BlbiA9IGZ1bmN0aW9uKCkge307XG5cdFx0XHR0aGlzLl92YWx1ZVdzQ2xpZW50Lm9uY2xvc2UgPSBmdW5jdGlvbigpIHt9O1xuXHRcdFx0dGhpcy5fdmFsdWVXc0NsaWVudC5vbmVycm9yID0gZnVuY3Rpb24oKSB7fTtcblxuXHRcdFx0dGhpcy5fdmFsdWVXc0NsaWVudC5jbG9zZSgpO1xuXG5cdFx0XHR0aGlzLl92YWx1ZVdzQ2xpZW50ID0gbnVsbDtcblx0XHR9O1xuXG5cdFx0Ly9lbmQgd3MgY2xpZW50XG5cblx0XHQvL2Nsb3NlIGFsbCBjYWxsYmFja3Ncblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNDbG9zZUFsbFJlcXVlc3RzID0gZnVuY3Rpb24oaXNJbml0RXJyb3IpIHtcblx0XHRcdHZhciBlcnJvckluZm8gPSAoaXNJbml0RXJyb3IpID8gXCJbVGVsZXBvcnRDbGllbnRdIEVycm9yOiDQn9GA0L7QuNC30L7RiNC70LAg0L7RiNC40LHQutCwINC/0YDQuCDRgNC10LPQuNGB0YLRgNCw0YbQuNGPINC60LvQuNC10L3RgtCwINC90LAg0YHQtdGA0LLQtdGA0LUsINC/0L7RjdGC0L7QvNGDINGA0LXQt9GD0LvRjNGC0LDRgiDQstGL0L/QvtC70L3QtdC90LjRjyDQutC+0LzQsNC90LTRiyDQvdC40LrQvtCz0LTQsCDQvdC1INCx0YPQtNC10YIg0LLQvtC30LLRgNCw0YnQtdC90L0uXCIgOlxuXHRcdFx0XHRcIltUZWxlcG9ydENsaWVudF0gRXJyb3I6INCh0L7QtdC00LjQvdC10L3QuNC1INGBINGB0LXRgNCy0LXRgNC+0Lwg0LLQvtGB0YLQsNC90L7QstC70LXQvdC90L4sINC90L4g0Y3RgtC+INC90L7QstGL0Lkg0Y3QutC30LXQvNC/0LvRj9GAINGB0LXRgNCy0LXRgNCwLCDQv9C+0Y3RgtC+0LzRgyDRgNC10LfRg9C70YzRgtCw0YIg0LLRi9C/0L7Qu9C90LXQvdC40Y8g0LrQvtC80LDQvdC00Ysg0L3QuNC60L7Qs9C00LAg0L3QtSDQsdGD0LTQtdGCINCy0L7Qt9Cy0YDQsNGJ0LXQvdC9LlwiO1xuXG5cdFx0XHR3aGlsZSAodGhpcy5fdmFsdWVSZXF1ZXN0cy5sZW5ndGgpIHtcblx0XHRcdFx0dmFyIGNhbGxiYWNrID0gdGhpcy5fdmFsdWVSZXF1ZXN0cy5zaGlmdCgpO1xuXHRcdFx0XHRpZiAoY2FsbGJhY2spIGNhbGxiYWNrKHtcblx0XHRcdFx0XHRkZXNjOiBlcnJvckluZm9cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8vZW5kIGNsb3NlIGFsbCBjYWxsYmFja3NcblxuXHRcdC8vY29ubmN0aW9uIGluaXRcblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNJbnRlcm5hbEdldFNlcnZlclRpbWVzdGFtcCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INC+0YLQv9GA0LDQstC40Lsg0LfQsNC/0YDQvtGBINC90LAg0L/QvtC70YPRh9C10L3QuNC1IHRpbWVzdGFtcC5cIlxuXHRcdFx0fSlcblxuXHRcdFx0dGhpcy5fZnVuY1NlbmRJbnRlcm5hbENvbW1hbmQoe1xuXHRcdFx0XHR0eXBlOiBcImludGVybmFsQ29tbWFuZFwiLFxuXHRcdFx0XHRpbnRlcm5hbENvbW1hbmQ6IFwiZ2V0VGltZXN0YW1wXCIsXG5cdFx0XHR9LCBjYWxsYmFjayk7XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY0ludGVybmFsR2V0UGVlcklkID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0L7RgtC/0YDQsNCy0LjQuyDQt9Cw0L/RgNC+0YEg0L3QsCDQv9C+0LvRg9GH0LXQvdC40LUgcGVlcklkLlwiLFxuXHRcdFx0XHR0aW1lc3RhbXA6IHRoaXMuX3ZhbHVlUGVlclRpbWVzdGFtcFxuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuX2Z1bmNTZW5kSW50ZXJuYWxDb21tYW5kKHtcblx0XHRcdFx0dHlwZTogXCJpbnRlcm5hbENvbW1hbmRcIixcblx0XHRcdFx0aW50ZXJuYWxDb21tYW5kOiBcImdldFBlZXJJZFwiLFxuXHRcdFx0XHRhcmdzOiB7XG5cdFx0XHRcdFx0dGltZXN0YW1wOiB0aGlzLl92YWx1ZVBlZXJUaW1lc3RhbXBcblx0XHRcdFx0fVxuXHRcdFx0fSwgY2FsbGJhY2spO1xuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNJbnRlcm5hbFNldFBlZXJJZCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INC+0YLQv9GA0LDQstC40Lsg0LfQsNC/0YDQvtGBINC90LAg0L/QvtC00YLQstC10YDQttC10L3QuNC1INGD0LbQtSDRgdGD0YnQtdGB0YLQstGD0Y7RidC10LPQviBwZWVySWQuXCIsXG5cdFx0XHRcdHRpbWVzdGFtcDogdGhpcy5fdmFsdWVQZWVyVGltZXN0YW1wLFxuXHRcdFx0XHRwZWVySWQ6IHRoaXMuX3ZhbHVlUGVlcklkXG5cdFx0XHR9KVxuXG5cdFx0XHR0aGlzLl9mdW5jU2VuZEludGVybmFsQ29tbWFuZCh7XG5cdFx0XHRcdHR5cGU6IFwiaW50ZXJuYWxDb21tYW5kXCIsXG5cdFx0XHRcdGludGVybmFsQ29tbWFuZDogXCJzZXRQZWVySWRcIixcblx0XHRcdFx0YXJnczoge1xuXHRcdFx0XHRcdHRpbWVzdGFtcDogdGhpcy5fdmFsdWVQZWVyVGltZXN0YW1wLFxuXHRcdFx0XHRcdHBlZXJJZDogdGhpcy5fdmFsdWVQZWVySWRcblx0XHRcdFx0fVxuXHRcdFx0fSwgY2FsbGJhY2spO1xuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNJbnRlcm5hbEdldE9iamVjdHNQcm9wcyA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INC+0YLQv9GA0LDQstC40Lsg0LfQsNC/0YDQvtGBINC90LAg0L/QvtC70YPRh9C10L3QuNC1INGB0LLQvtC50YHRgtCyINGB0LXRgNCy0LXRgNC90YvRhSDQvtCx0YrQtdC60YLQvtCyLlwiLFxuXHRcdFx0XHRwZWVySWQ6IHRoaXMuX3ZhbHVlUGVlcklkXG5cdFx0XHR9KVxuXG5cdFx0XHR0aGlzLl9mdW5jU2VuZEludGVybmFsQ29tbWFuZCh7XG5cdFx0XHRcdHR5cGU6IFwiaW50ZXJuYWxDb21tYW5kXCIsXG5cdFx0XHRcdGludGVybmFsQ29tbWFuZDogXCJnZXRPYmplY3RzXCIsXG5cdFx0XHRcdGFyZ3M6IHtcblx0XHRcdFx0XHRwZWVySWQ6IHRoaXMuX3ZhbHVlUGVlcklkXG5cdFx0XHRcdH1cblx0XHRcdH0sIGNhbGxiYWNrKTtcblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jSW50ZXJuYWxDb25uZWN0ZWQgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQvtGC0L/RgNCw0LLQuNC7INC/0L7QtNGC0LLQtdGA0LbQtNC10L3QuNC1INC30LDQstC10YDRiNC10L3QuNGPINC/0L7QtNC60LvRjtGH0LXQvdC40Y8uXCIsXG5cdFx0XHRcdHBlZXJJZDogdGhpcy5fdmFsdWVQZWVySWRcblx0XHRcdH0pXG5cblx0XHRcdHRoaXMuX2Z1bmNTZW5kSW50ZXJuYWxDb21tYW5kKHtcblx0XHRcdFx0dHlwZTogXCJpbnRlcm5hbENvbW1hbmRcIixcblx0XHRcdFx0aW50ZXJuYWxDb21tYW5kOiBcImNvbm5lY3Rpb27QoW9tcGxldGVkXCIsXG5cdFx0XHRcdGFyZ3M6IHtcblx0XHRcdFx0XHRwZWVySWQ6IHRoaXMuX3ZhbHVlUGVlcklkXG5cdFx0XHRcdH1cblx0XHRcdH0sIGNhbGxiYWNrKTtcblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jSW50ZXJuYWxSZWNvbm5lY3RlZCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INC+0YLQv9GA0LDQstC40Lsg0L/QvtC00YLQstC10YDQttC00LXQvdC40LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0L/QtdGA0LXQv9C+0LTQutC70Y7Rh9C10L3QuNGPLlwiLFxuXHRcdFx0XHRwZWVySWQ6IHRoaXMuX3ZhbHVlUGVlcklkXG5cdFx0XHR9KVxuXG5cdFx0XHR0aGlzLl9mdW5jU2VuZEludGVybmFsQ29tbWFuZCh7XG5cdFx0XHRcdHR5cGU6IFwiaW50ZXJuYWxDb21tYW5kXCIsXG5cdFx0XHRcdGludGVybmFsQ29tbWFuZDogXCJyZWNvbm5lY3Rpb25Db21wbGV0ZWRcIixcblx0XHRcdFx0YXJnczoge1xuXHRcdFx0XHRcdHBlZXJJZDogdGhpcy5fdmFsdWVQZWVySWRcblx0XHRcdFx0fVxuXHRcdFx0fSwgY2FsbGJhY2spO1xuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNTZW5kSW50ZXJuYWxDb21tYW5kID0gZnVuY3Rpb24obWVzc2FnZSwgY2FsbGJhY2spIHtcblx0XHRcdGlmIChjYWxsYmFjaykge1xuXHRcdFx0XHRtZXNzYWdlLmludGVybmFsUmVxdWVzdElkID0gdGhpcy5fdmFsdWVJbnRlcm5hbFJlcXVlc3RzLmxlbmd0aDtcblx0XHRcdFx0dGhpcy5fdmFsdWVJbnRlcm5hbFJlcXVlc3RzLnB1c2goY2FsbGJhY2spO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9mdW5jV3NTZW5kTWVzc2FnZShtZXNzYWdlKTtcblx0XHR9O1xuXG5cdFx0Ly9lbmQgY29ubmN0aW9uIGluaXRcblxuXHRcdC8qKlxuXHRcdFx00YXRjdC90LTQu9C10YAg0LTQu9GPINC+0YLQstC10YLQvtCyINC90LAg0YHQtdGA0LLQuNGB0L3Ri9C1INC30LDQv9GA0L7RgdGLINC6INGB0LXRgNCy0LXRgNGDXG5cdFx0XG5cdFx0Ki9cblx0XHQvL0ludGVybmFsSGFuZGxlclxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY0ludGVybmFsQ2FsbGJhY2tIYW5kbGVyID0gZnVuY3Rpb24obWVzc2FnZSkge1xuXHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDRgdC10YDQstC10YAg0LLQtdGA0L3Rg9C7IGludGVybmFsQ2FsbGJhY2sg0L3QsDogXCIgKyBtZXNzYWdlLmludGVybmFsQ29tbWFuZCxcblx0XHRcdFx0bWVzc2FnZTogbWVzc2FnZVxuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuX3ZhbHVlSW50ZXJuYWxSZXF1ZXN0c1ttZXNzYWdlLmludGVybmFsUmVxdWVzdElkXShtZXNzYWdlLmVycm9yLCBtZXNzYWdlLnJlc3VsdCk7XG5cdFx0XHRkZWxldGUgdGhpcy5fdmFsdWVJbnRlcm5hbFJlcXVlc3RzW21lc3NhZ2UuaW50ZXJuYWxSZXF1ZXN0SWRdO1xuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNJbnRlcm5hbEhhbmRsZXJHZXRUaW1lc3RhbXAgPSBmdW5jdGlvbihlcnJvciwgbmV3U2VydmVyVGltZXN0YW1wKSB7XG5cdFx0XHRpZiAoIXRoaXMuX3ZhbHVlSXNSZWFkeUVtaXRlZCkge1xuXHRcdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0J/QvtC70YPRh9C10L3QvSB0aW1lc3RhbXAsINGN0YLQviDQv9C10YDQstC+0LUg0L/QvtC00LrQu9GO0YfQtdC90LjQtSDQuiDRgdC10YDQstC10YDRgywg0LfQsNC/0YDQsNGI0LjQstCw0Y4gcGVlcklkLlwiLFxuXHRcdFx0XHRcdHRpbWVzdGFtcDogbmV3U2VydmVyVGltZXN0YW1wXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRoaXMuX3ZhbHVlU2VydmVyVGltZXN0YW1wID0gbmV3U2VydmVyVGltZXN0YW1wO1xuXG5cdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbEdldFBlZXJJZChcblx0XHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxIYW5kbGVyR2V0UGVlcklkLmJpbmQodGhpcykpO1xuXHRcdFx0fSBlbHNlIGlmIChuZXdTZXJ2ZXJUaW1lc3RhbXAgIT0gdGhpcy5fdmFsdWVTZXJ2ZXJUaW1lc3RhbXApIHtcblx0XHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INCf0L7Qu9GD0YfQtdC90L3Ri9C5IHRpbWVzdGFtcCDQvtGC0LvQuNGH0LDQtdGC0YHRjyDQvtGCINC/0YDQvtGI0LvQvtCz0L4sINGB0LXRgNCy0LXRgCDQsdGL0Lsg0L/QtdGA0LXQt9Cw0L/Rg9GJ0LXQvdC9LCBcIiArXG5cdFx0XHRcdFx0XHRcItC30LDQv9GA0LDRiNC40LLQsNGOINC90L7QstGL0LkgcGVlcklkLCDQvdCwINCy0YHQtSDQutCw0LvQsdC10LrQuCDQvtC20LjQtNCw0Y7RidC40LUg0YDQtdC30YPQu9GM0YLQsNGCINCy0L7Qt9Cy0YDQsNGJ0LDRjiDQvtGI0LjQsdC60YMuXCIsXG5cdFx0XHRcdFx0cmVxdWVzdENvdW50OiB0aGlzLl92YWx1ZVJlcXVlc3RzLmxlbmd0aCxcblx0XHRcdFx0XHRvbGRUaW1lc3RhbXA6IHRoaXMuX3ZhbHVlU2VydmVyVGltZXN0YW1wLFxuXHRcdFx0XHRcdG5ld1RpbWVzdGFtcDogbmV3U2VydmVyVGltZXN0YW1wLFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLl92YWx1ZVNlcnZlclRpbWVzdGFtcCA9IG5ld1NlcnZlclRpbWVzdGFtcDtcblx0XHRcdFx0dGhpcy5fZnVuY0Nsb3NlQWxsUmVxdWVzdHMoKTtcblxuXHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxHZXRQZWVySWQoXG5cdFx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsSGFuZGxlckdldFBlZXJJZC5iaW5kKHRoaXMpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQn9C+0LvRg9GH0LXQvdC9IHRpbWVzdGFtcCwg0L7QvSDRgdC+0L7RgtCy0LXRgtGB0YLQstGD0LXRgiDRgdGC0LDRgNC+0LzRgywg0L7RgtC/0YDQsNCy0LvRj9GOINC90LAg0YHQtdGA0LLQtdGAINGB0LLQvtC5IHBlZXJJZC5cIixcblx0XHRcdFx0XHR0aW1lc3RhbXA6IG5ld1NlcnZlclRpbWVzdGFtcFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxTZXRQZWVySWQoXG5cdFx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsSGFuZGxlclNldFBlZXJJZC5iaW5kKHRoaXMpKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jSW50ZXJuYWxIYW5kbGVyR2V0UGVlcklkID0gZnVuY3Rpb24oZXJyb3IsIHBlZXJJZCkge1xuXHRcdFx0aWYgKCF0aGlzLl92YWx1ZUlzUmVhZHlFbWl0ZWQpIHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0J/QvtC70YPRh9C10L3QvSBwZWVySWQsINC30LDQv9GA0LDRiNC40LLQsNGOINGB0LLQvtC50YHRgtCy0LAg0YHQtdGA0LLQtdGA0L3Ri9GFINC+0LHRitC10LrRgtC+0LIuXCIsXG5cdFx0XHRcdHBlZXJJZDogcGVlcklkXG5cdFx0XHR9KTtcblx0XHRcdGVsc2UgdGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQn9C+0LvRg9GH0LXQvdC9IHBlZXJJZCwg0L/QtdGA0LXQv9C+0LTQutC70Y7Rh9C10L3QuNC1INC/0YDQvtC40LfQvtGI0LvQviDQuNC3LdC30LAg0L/QtdGA0LXQt9Cw0L/Rg9GB0LrQsCDRgdC10YDQstC10YDQsCBcIiArXG5cdFx0XHRcdFx0XCLQv9GA0L7QstC10YDRj9GOINC40LfQvNC10L3QuNC70LjRgdGMINC70Lgg0YHQstC+0LnRgdGC0LLQsCDRgdC10YDQstC10YDQvdGL0YUg0L7QsdGK0LXQutGC0L7Qsi4g0JjQu9C4INC40Lct0LfQsCDQuNGB0YLQtdGH0LXQvdC40Y8g0LLRgNC10LzQtdC90Lgg0L7QttC40LTQsNC90LjRjyDRgdC10YDQstC10YDQvtC8IFwiICtcblx0XHRcdFx0XHRcItC/0LXRgNC10L/QvtC00LrQu9GO0YfQtdC90LjRjyDRjdGC0L7Qs9C+INC60LvQuNC10L3RgtCwLlwiLFxuXHRcdFx0XHRwZWVySWQ6IHBlZXJJZFxuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuX3ZhbHVlUGVlcklkID0gcGVlcklkO1xuXG5cdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxHZXRPYmplY3RzUHJvcHMoXG5cdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbEhhbmRsZXJHZXRPYmplY3RzLmJpbmQodGhpcykpO1xuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNJbnRlcm5hbEhhbmRsZXJTZXRQZWVySWQgPSBmdW5jdGlvbihlcnJvcikge1xuXHRcdFx0aWYgKGVycm9yKSB7XG5cdFx0XHRcdHZhciBlcnJvckluZm8gPSB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIEVycm9yOiDQndC1INGD0LTQsNC70L7RgdGMINCy0L7RgdGB0YLQsNC90L7QstC40YLRjCDRgdC+0LXQtNC40L3QtdC90LjQtSDRgSDRgdC10YDQstC10YDQvtC8LCDQt9Cw0L/RgNC+0YEg0L3QsCDRg9GB0YLQsNC90L7QstC60YMgcGVlcklkLCDQstC10YDQvdGD0Lsg0L7RiNC40LHQutGDLiBcIiArXG5cdFx0XHRcdFx0XHRcItCf0L7Qv9GA0L7QsdGD0Y4g0L/QvtC70YPRh9C40YLRjCDQvdC+0LLRi9C5IHBlZXJJZC5cIixcblx0XHRcdFx0XHRlcnJvcjogZXJyb3Jcblx0XHRcdFx0fTtcblxuXHRcdFx0XHR0aGlzLmVtaXQoXCJlcnJvclwiLCBlcnJvckluZm8pO1xuXHRcdFx0XHR0aGlzLl9mdW5jQ2xvc2VBbGxSZXF1ZXN0cygnaW5pdCBlcnJvcicpO1xuXG5cdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbEdldFBlZXJJZChcblx0XHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxIYW5kbGVyR2V0UGVlcklkLmJpbmQodGhpcykpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsUmVjb25uZWN0ZWQoKTtcblxuXHRcdFx0XHR0aGlzLmVtaXQoJ2luZm8nLCB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIEluZm86INCh0L7QtdC00LjQvdC10L3QuNC1INGBINGB0LXRgNCy0LXRgNC+0Lwg0LLQvtGB0YLQsNC90L7QstC70LXQvdC90L4uXCIsXG5cdFx0XHRcdFx0cGVlcklkOiB0aGlzLl92YWx1ZVBlZXJJZCxcblx0XHRcdFx0XHRldmVudHM6IFsncmVjb25uZWN0ZWQnLCAncmVjb25uZWN0ZWRUb09sZFNlcnZlciddXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRoaXMuZW1pdCgncmVjb25uZWN0ZWQnKTtcblx0XHRcdFx0dGhpcy5lbWl0KCdyZWNvbm5lY3RlZFRvT2xkU2VydmVyJyk7XG5cdFx0XHRcdHRoaXMuZW1pdCgnX19yZWNvbm5lY3RlZFRvT2xkU2VydmVyX18nKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jSW50ZXJuYWxIYW5kbGVyR2V0T2JqZWN0cyA9IGZ1bmN0aW9uKGVycm9yLCBvYmplY3RQcm9wcykge1xuXHRcdFx0aWYgKCF0aGlzLl92YWx1ZUlzUmVhZHlFbWl0ZWQpIHtcblx0XHRcdFx0dGhpcy5fdmFsdWVTZXJ2ZXJPYmplY3RzUHJvcHMgPSBvYmplY3RQcm9wcztcblxuXHRcdFx0XHR0aGlzLl9mdW5jT2JqZWN0Q3JlYXRlQWxsKCk7XG5cdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbENvbm5lY3RlZCgpO1xuXG5cdFx0XHRcdHRoaXMuZW1pdCgnaW5mbycsIHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gSW5mbzog0YHQtdGA0LLQtdGA0L3Ri9C1INC+0LHRitC10LrRgtGLINC40L3QuNGG0LjQsNC70LjQt9C40YDQvtCy0LDQvdC90YssINC60LvQuNC10L3RgiDQs9C+0YLQvtCyINC6INGA0LDQsdC+0YLQtS5cIixcblx0XHRcdFx0XHRldmVudHM6IFsncmVhZHknXSxcblx0XHRcdFx0XHRzZXJ2ZXJPYmplY3RzUHJvcHM6IHRoaXMuX3ZhbHVlU2VydmVyT2JqZWN0c1Byb3BzXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLl92YWx1ZUlzUmVhZHlFbWl0ZWQgPSB0cnVlO1xuXG5cdFx0XHRcdHRoaXMuZW1pdCgncmVhZHknLCB0aGlzLl92YWx1ZVNlcnZlck9iamVjdHNQcm9wcyk7XG5cdFx0XHR9IGVsc2UgaWYgKGlzUHJvcHNFcXVhbChvYmplY3RQcm9wcywgdGhpcy5fdmFsdWVTZXJ2ZXJPYmplY3RzUHJvcHMpKSB7XG5cdFx0XHRcdHRoaXMuZW1pdCgnaW5mbycsIHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gSW5mbzog0KHQtdGA0LLQtdGAINCx0YvQuyDQv9C10YDQtdC30LDQv9GD0YnQtdC90L0sINC90L4g0L7QsdGK0LXQutGC0Ysg0YLQtdC70LXQv9C+0YDRgtC40YDQvtCy0LDQuyDRgtC10LbQtS5cIixcblx0XHRcdFx0XHRldmVudHM6IFsncmVjb25uZWN0ZWQnLCAncmVjb25uZWN0ZWRUb05ld1NlcnZlciddXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbENvbm5lY3RlZCgpO1xuXG5cdFx0XHRcdHRoaXMuZW1pdCgncmVjb25uZWN0ZWQnKTtcblx0XHRcdFx0dGhpcy5lbWl0KCdyZWNvbm5lY3RlZFRvTmV3U2VydmVyJyk7XG5cdFx0XHRcdHRoaXMuZW1pdCgnX19yZWNvbm5lY3RlZFRvTmV3U2VydmVyX18nKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuZW1pdCgnd2FybicsIHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gV2Fybjog0J/QvtGB0LvQtSDRgdCy0L7QtdCz0L4g0L/QtdGA0LXQt9Cw0L/Rg9GB0LrQsCDRgdC10YDQstC10YDQsCDQv9GA0LjRgdC70LDQuyDRgdC10YDQstC10YDQvdGL0LUg0L7QsdGK0LXQutGC0Ysg0L7RgtC70LjRh9C90YvQtSDQvtGCINGB0YLQsNGA0YvRhSwg0YDQtdC60L7QvNC10L3QtNGD0Y4g0L7QsdC90L7QstC40YLRjCDRgdGC0YDQsNC90LjRhtGDLlwiLFxuXHRcdFx0XHRcdGV2ZW50czogWydzZXJ2ZXJPYmplY3RzQ2hhbmdlZCcsICdyZWNvbm5lY3RlZCcsICdyZWNvbm5lY3RlZFRvTmV3U2VydmVyJ10sXG5cdFx0XHRcdFx0bmV3T2JqZWN0UHJvcHM6IG9iamVjdFByb3BzLFxuXHRcdFx0XHRcdG9sZE9iamVjdFByb3BzOiB0aGlzLl92YWx1ZVNlcnZlck9iamVjdHNQcm9wc1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxDb25uZWN0ZWQoKTtcblxuXHRcdFx0XHR0aGlzLmlzU2VydmVyT2JqZWN0Q2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdHRoaXMuZW1pdCgnc2VydmVyT2JqZWN0c0NoYW5nZWQnKTtcblx0XHRcdFx0dGhpcy5lbWl0KCdyZWNvbm5lY3RlZCcpO1xuXHRcdFx0XHR0aGlzLmVtaXQoJ3JlY29ubmVjdGVkVG9OZXdTZXJ2ZXInKTtcblx0XHRcdFx0dGhpcy5lbWl0KCdfX3JlY29ubmVjdGVkVG9OZXdTZXJ2ZXJfXycpO1xuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBpc1Byb3BzRXF1YWwobmV3T2JqZWN0UHJvcHMsIG9sZE9iamVjdFByb3BzKSB7XG5cdFx0XHRcdHJldHVybiBKU09OLnN0cmluZ2lmeShuZXdPYmplY3RQcm9wcykgPT0gSlNPTi5zdHJpbmdpZnkob2xkT2JqZWN0UHJvcHMpO1xuXHRcdFx0fTtcblx0XHR9O1xuXG5cdFx0Ly9lbmQgSW50ZXJuYWxIYW5kbGVyXG5cblx0XHQvL3NlcnZlclxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY1F1YXJhbnRlZWRTZW5kTWVzc2FnZSA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcblx0XHRcdGlmICh0aGlzLl92YWx1ZVdzQ2xpZW50ICYmICh0aGlzLl92YWx1ZVdzQ2xpZW50LnJlYWR5U3RhdGUgPT0gMSkpIHtcblx0XHRcdFx0dGhpcy5fZnVuY1dzU2VuZE1lc3NhZ2UobWVzc2FnZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0KHQvtC10LTQuNC90LXQvdC40LUg0YEg0YHQtdGA0LLQtdGA0L7QvCDRgdC10LnRh9Cw0YEg0L7RgtGB0YPRgtGB0YLQstGD0LXRgiwg0LrQvtCz0LTQsCDQvtC90L4g0LHRg9C00LXRgiDQstC+0YHRgdGC0LDQvdC+0LLQu9C10L3QvdC+LCDRjdGC0L4g0YHQvtC+0LHRidC10L3QuNC1INCx0YPQtNC10YIg0L7RgtC/0YDQstCw0LvQtdC90L3Qvi5cIiArXG5cdFx0XHRcdFx0XHRcItCV0YHQu9C4INC/0L7RgdC70LUg0LLQvtGB0YLQsNC90L7QstC70LXQvdC40Y8g0YHQvtC10LTQuNC90LXQvdC40Y8g0YHRgtCw0L3QtdGCINGP0YHQvdC+LCDRh9GC0L4g0L/QvtC00LrQu9GO0YfQuNC70YHRjyDQutC70LjQtdC90YIg0Log0L3QvtCy0L7QvNGDINGN0LrQt9C10LzQv9C70Y/RgNGDINGB0LXRgNCy0LXRgNGDICjRgdC10YDQstC10YAg0L/QtdGA0LXQt9Cw0L/Rg9GJ0LXQvdC9KSwg0YLQviDRgdC+0L7QsdGJ0LXQvdC40LUg0L7RgtC/0YDQsNCy0LvQtdC90L3QviDQvdC1INCx0YPQtNC10YIuXCIsXG5cdFx0XHRcdFx0bWVzc2FnZTogbWVzc2FnZVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR2YXIgcmVjb25uZWN0ZWRPbGRTZXJ2ZXJIYW5kbGVyID0gKGZ1bmN0aW9uKG1lc3NhZ2UpIHtcblx0XHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRcdFx0XHRkZXNjOiAnW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0KHQvtC10LTQuNC90LXQvdC40LUg0LLQvtGB0YLQsNC90L7QstC70LXQvdC90L4g0YEg0L/RgNC10LbQvdC40Lwg0Y3QutC30LXQvNC/0LvRj9GA0L7QvCDRgdC10YDQstC10YDQsCwg0LjQu9C4INGD0YHRgtCw0L3QvtCy0LvQtdC90L3QviDQstC/0LXRgNCy0YvQtSwg0L7RgtC/0YDQsNCy0LvRj9C10YLRgdGPINGB0L7QvtCx0YjQtdC90LjQtSDQvdCwINGB0LXRgNCy0LXRgCcsXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IG1lc3NhZ2Vcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHR0aGlzLnJlbW92ZUxpc3RlbmVyKCdfX3JlY29ubmVjdGVkVG9OZXdTZXJ2ZXJfXycsIHJlY29ubmVjdGVkTmV3U2VydmVySGFuZGxlcik7XG5cdFx0XHRcdFx0XHR0aGlzLl9mdW5jV3NTZW5kTWVzc2FnZShtZXNzYWdlKTtcblx0XHRcdFx0XHR9LmJpbmQodGhpcyk7XG5cdFx0XHRcdH0uYmluZCh0aGlzKSkobWVzc2FnZSk7XG5cblx0XHRcdFx0dmFyIHJlY29ubmVjdGVkTmV3U2VydmVySGFuZGxlciA9IChmdW5jdGlvbihtZXNzYWdlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0XHRcdFx0ZGVzYzogJ1tUZWxlcG9ydENsaWVudF0gRGVidWc6INCf0LXRgNC10L/QvtC00LrQu9GO0YfQtdC90LjQtSDQv9GA0L7QuNC30L7RiNC70L4g0Log0L3QvtCy0L7QvNGDINGN0LrQt9C10LzQv9C70Y/RgNGDINGB0LXRgNCy0LXRgNCwLCDRgdC+0L7QsdGJ0LXQvdC40LUg0L7RgtC/0YDQsNCy0LvQtdC90L3QviDQvdC1INCx0YPQtNC10YIuJyxcblx0XHRcdFx0XHRcdFx0bWVzc2FnZTogbWVzc2FnZVxuXHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdHRoaXMucmVtb3ZlTGlzdGVuZXIoJ19fcmVjb25uZWN0ZWRUb09sZFNlcnZlcl9fJywgcmVjb25uZWN0ZWRPbGRTZXJ2ZXJIYW5kbGVyKVxuXHRcdFx0XHRcdH0uYmluZCh0aGlzKTtcblx0XHRcdFx0fS5iaW5kKHRoaXMpKShtZXNzYWdlKTtcblxuXHRcdFx0XHR0aGlzLm9uY2UoJ19fcmVjb25uZWN0ZWRUb05ld1NlcnZlcl9fJywgcmVjb25uZWN0ZWROZXdTZXJ2ZXJIYW5kbGVyKTtcblx0XHRcdFx0dGhpcy5vbmNlKCdfX3JlY29ubmVjdGVkVG9PbGRTZXJ2ZXJfXycsIHJlY29ubmVjdGVkT2xkU2VydmVySGFuZGxlcik7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY1dzU2VuZE1lc3NhZ2UgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR2YXIgc3RyaW5nID0gSlNPTi5zdHJpbmdpZnkobWVzc2FnZSk7XG5cblx0XHRcdFx0aWYgKHRoaXMuX3ZhbHVlV3NDbGllbnQgJiYgKHRoaXMuX3ZhbHVlV3NDbGllbnQucmVhZHlTdGF0ZSA9PSAxKSkge1xuXHRcdFx0XHRcdHRoaXMuX3ZhbHVlV3NDbGllbnQuc2VuZChzdHJpbmcpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuZW1pdCgnd2FybicsIHtcblx0XHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBXYXJuOiDRgdC+0L7QsdGJ0LXQvdC40LUg0L7RgtC/0YDQsNCy0LvQtdC90L3QviDQvdC1INCx0YPQtNC10YIsINGC0LDQuiDQutCw0Log0YHQvtC10LTQuNC90LXQvdC40LUg0YEg0YHQtdGA0LLQtdGA0L7QvCDQv9C+0YLQtdGA0Y/QvdC90L4uXCIsXG5cdFx0XHRcdFx0XHRtZXNzYWdlOiBtZXNzYWdlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5lbWl0KFwid2FyblwiLCB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIFdhcm46INC+0YjQuNCx0LrQsCDQvtGC0L/RgNCw0LLQutC4INGB0L7QvtCx0YnQtdC90LjRjyDQvdCwINGB0LXRgNCy0LXRgDogXCIgKyBlcnJvcixcblx0XHRcdFx0XHRtZXNzYWdlOiBtZXNzYWdlLFxuXHRcdFx0XHRcdGVycm9yOiBlcnJvclxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly9lbmQgc2VydmVyXG5cblx0XHQvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqLy9cblx0XHQvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqLy9cblx0XHQvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqLy9cblx0XHQvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAgIFRlbGVwb3J0ZWRPYmplY3QgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqLy9cblx0XHQvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqLy9cblx0XHQvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqLy9cblx0XHQvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqLy9cblxuXHRcdC8qKlxuXHRcdFx00JjQvdC40YbQuNCw0LvQuNC30LDRgtC+0YAg0YHQtdGA0LLQtdGA0L3QtdGFINC+0LHRitC10LrRgtC+0LIsIFxuXHRcdFx00LLRgdC1INC80LXRgtC+0LTRiyDQsdGD0LTRg9GCINGB0L7Qt9C00LDQvdC90Ysg0YTRg9C90LrRhtC40LXQuSBfZnVuY09iamVjdENyZWF0ZSDQutC70LDRgdGB0LAgVGVsZXBvcnRDbGllbnQsXG5cdFx0XHTQsCDQvdC1INGB0LjQu9Cw0LzQuCDQutC+0L3RgdGC0YDRg9C60YLQvtGA0LAg0LrQu9Cw0YHRgdCwIFRlbGVwb3J0ZWRPYmplY3QsINC/0L7RgtC+0LzRgyDRh9GC0L4g0LIg0YHQvtC30LTQsNCy0LDQtdC80YvRhSBcblx0XHRcdNC80LXRgtC+0LTQsNGFINC/0YDQvtCx0YDQvtGI0LXQvdC90YvRhSDRgSDRgdC10YDQstC10YDQsCDQvtCx0YrQtdC60YLQsNGFIFxuXHRcdFx00L/QvtGC0YDQtdCx0YPQtdGC0YHRjyDQuNGB0L/QvtC70YzQt9C+0LLQsNGC0YwgX2Z1bmNXc1NlbmRNZXNzYWdlLCDQutC70LDRgdGB0LAgVGVsZXBvcnRDbGllbnQsXG5cdFx0XHTQutC+0YLQvtGA0YvQuSDQuNGB0L7Qu9GM0LfRg9C10YIgd3Mg0LrQu9C40LXQvdGCINC60LvQsNGB0YHQsCBUZWxlcG9ydENsaWVudC5cblxuXHRcdFx0X2Z1bmNXc1NlbmRNZXNzYWdlINC60L7QvdC10YfQvdC+INC80L7QttC90L4g0L/RgNC+0LHRgNC+0YHQuNGC0Ywg0L/RgNC40LHQuNC90LTQuNCyINC6INC90LXQvNGDIHRoaXMgVGVsZXBvcnRDbGllbnRcblx0XHRcdNC4INC40YHQv9C+0LvRgtGM0LfQvtCy0LDRgtGMINCy0L3Rg9GC0YDQuCBUZWxlcG9ydGVkT2JqZWN0LCDQvdC+INGN0YLQviDRg9GB0LvQvtC20L3Rj9C10YIg0LrQvtC0INC4INCy0YvQs9C70Y/QtNC40YIg0YHRgtGA0LXQvNC90L4uXG5cblx0XHRcdNCyINC60LDRh9C10YHRgtCy0LUg0LDQu9GM0YLQtdGA0L3QsNGC0LjQstGLINC80L7QttC90L4g0L7RgtCy0Y/Qt9Cw0YLRjCDQutC+0L3QvdC10LrRgiDQutC70LjQtdC90YLQsCDRgSDRgdC10YDQstC10YDQvtC8INC+0YIgd3Mg0YHQtdGB0YHQuNC4LFxuXHRcdFx00Lgg0LfQsNCy0LXRgdGC0Lgg0LrQsNC60LjQtSDQvdC40LHRg9C00Ywg0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQuNC00LXQvdGC0LjRhNC40LrQsNGC0L7RgNGLINC00LvRjyDQvtCx0L7Qt9C90LDRh9C10L3QuNGPINGB0L7QsdGB0YLQstC10L3QvdC+INGB0LXRgdGB0LjQuSwgXG5cdFx0XHTQuCDRgtC+0LPQtNCwINC80L7QttC90L4g0YHQvtC30LTQsNGC0Ywg0L7RgtC00LXQu9GM0L3Ri9C5IHdzIENsaWVudCDQsiBUZWxlcG9ydGVkT2JqZWN0LCDQuCDRgdC+0LHRgdGC0LLQtdC90L3QviDRgdCy0L7RjiDRgdC+0LHRgdGC0LLQtdC90L3Rg9GOXG5cdFx0XHTRhNGD0L3QutGG0LjRjiBfZnVuY1dzU2VuZE1lc3NhZ2Ug0LfQsNC/0LjQu9C40YLRjCwg0L3QviDRjyDQvdC1INGF0L7Rh9GDLCDRjdGC0L4g0YPRgdC70L7QttC90LjRgiDQutC+0LQg0Lgg0LLQvtGCLlxuXG5cdFx0Ki9cblxuXG5cdFx0dXRpbC5pbmhlcml0cyhUZWxlcG9ydGVkT2JqZWN0LCBFdmVudEVtaXR0ZXIpO1xuXG5cdFx0ZnVuY3Rpb24gVGVsZXBvcnRlZE9iamVjdChvYmplY3RQcm9wcykge1xuXHRcdFx0dGhpcy5fX2V2ZW50c19fID0gb2JqZWN0UHJvcHMuZXZlbnRzO1xuXHRcdFx0dGhpcy5fX21ldGhvZHNfXyA9IG9iamVjdFByb3BzLm1ldGhvZHM7XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY09iamVjdENyZWF0ZUFsbCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0Zm9yICh2YXIgb2JqZWN0TmFtZSBpbiB0aGlzLl92YWx1ZVNlcnZlck9iamVjdHNQcm9wcykge1xuXHRcdFx0XHR0aGlzLl9mdW5jT2JqZWN0Q3JlYXRlKG9iamVjdE5hbWUpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvKipcblx0XHRcdNCc0LXRgtC+0LQg0LjQvdC40YbQuNCw0LvQuNC30LjRgNGD0Y7RidC40Lkg0L/RgNC40L3Rj9GC0YvQuSDQvtGCINGB0LXRgNCy0LXRgNCwINC+0LHRitC10LrRgiwgXG5cdFx0XHTQv9GA0LjQvdC40LzQsNC10YIg0LjQvNGPINC+0LHRitC10LrRgtCwLCDQvdC1INC+0YfQtdC90Ywg0L7Qv9GC0LjQvNCw0LvRjNC90L4sINC90L4g0L3QsNCz0LvRj9C00L3QvlxuXHRcdFx0XG5cdFx0Ki9cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNPYmplY3RDcmVhdGUgPSBmdW5jdGlvbihvYmplY3ROYW1lKSB7XG5cdFx0XHR2YXIgb2JqZWN0UHJvcHMgPSB0aGlzLl92YWx1ZVNlcnZlck9iamVjdHNQcm9wc1tvYmplY3ROYW1lXTtcblx0XHRcdHRoaXMub2JqZWN0c1tvYmplY3ROYW1lXSA9IG5ldyBUZWxlcG9ydGVkT2JqZWN0KG9iamVjdFByb3BzKTtcblxuXHRcdFx0Zm9yICh2YXIgbWV0aG9kSW5kZXggPSAwOyBtZXRob2RJbmRleCA8IG9iamVjdFByb3BzLm1ldGhvZHMubGVuZ3RoOyBtZXRob2RJbmRleCsrKSB7XG5cdFx0XHRcdHZhciBtZXRob2ROYW1lID0gb2JqZWN0UHJvcHMubWV0aG9kc1ttZXRob2RJbmRleF07XG5cblx0XHRcdFx0dGhpcy5vYmplY3RzW29iamVjdE5hbWVdW21ldGhvZE5hbWVdID1cblx0XHRcdFx0XHR0aGlzLl9mdW5jTWV0aG9kQ3JlYXRlKG9iamVjdE5hbWUsIG1ldGhvZE5hbWUpLmJpbmQodGhpcyk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdFx00K3RgtCwINGE0YPQvdC60YbQuNGPINC/0YDQuNC90LjQvNCw0LXRgiDRgdGC0YDQvtC60LggbWV0aG9kTmFtZSDQuCBvYmplY3ROYW1lLlxuXHRcdFx00Jgg0LLQvtC30LLRgNCw0LbQsNC10YIg0YTRg9C90LrRhtC40Y4sINC00LvRjyDQutC+0YLQvtGA0L7QuSDRjdGC0Lgg0YHRgtGA0L7QutC4INCx0YPQtNGD0YIg0LTQvtGB0YLRg9C/0L3RiyDRh9C10YDQtdC3INC30LDQvNGL0LrQsNC90LjQtS5cblx0XHRcdFxuXHRcdFx00KHQvtC30LTQsNCy0LDQtdC80LDRjyDRhNGD0L3QutGG0LjRjywg0LHRg9C70YPRh9C4INCy0YvQt9Cy0LDQvdC90L7QuSDRgNCw0LfQsdC40YDQsNC10YIg0LLRhdC+0LTRj9GJ0LjQuSDQvNCw0YHRgdC40LIgYXJndW1lbnRzINC90LAg0YHQvtCx0YHRgtCy0LXQvdC90L4gXG5cdFx0XHTQsNGA0LPRg9C80LXQvdGC0Ysg0LTQu9GPINGE0YPQvdC60YbQuNC4INC4IGNhbGxiYWNrLlxuXHRcdFx00K3RgtC+0LzRgyDQstGL0LfQvtCy0YMg0L/RgNC40YHQstCw0LjQstCw0LXRgtGB0Y8gcmVxdWVzdElkINC60L7RgtC+0YDQvtC80YMg0LIg0YHQvtC+0YLQstC10YLRgdGC0LLQuNC1INGB0YLQsNCy0LjRgtGM0YHRjyDQv9GA0LjQvdGP0YLRi9C5IGNhbGxiYWNrLlxuXHRcdFx00J/QvtGB0LvQtSDRjdGC0L7Qs9C+INC30LDQv9GA0L7RgSDQvtGC0L/RgNCw0LLQu9GP0LXRgtGB0Y8g0L3QsCDRgdC10YDQstC10YAuXG5cdFx0XHRcblx0XHRcdNCi0LDQuiDQutCw0Log0Y3RgtCwINGE0YPQvdC60YbQuNGPINCx0YPQtNC10YIg0L/RgNC40YHQstC+0LXQvdC90LAg0L/QvtC70Y4g0L7QsdGK0LXQutGC0LAsINGC0L4g0LTQu9GPINGD0LTQvtCx0YHRgtCy0LAg0L7QvdCwINCy0L7Qt9Cy0YDQsNGJ0LDQtdGCIFxuXHRcdFx00LrQvtC90YLQtdC60YHRgiDQvtCx0YrQtdC60LAg0LjQtyDQutC+0YLQvtGA0L7Qs9C+INC+0L3QsCDQsdGL0LvQsCDQstGL0LfQstCw0L3QvdCwLlxuXHRcdFx00KfRgtC+0LHRiyDQvNC+0LbQvdC+INCx0YvQu9C+INC/0LjRgdCw0YLRjCDQstC+0YIg0YLQsNC60LjQtSDRiNGC0YPQutC4OlxuXHRcdFx0dGVsZXBvcnRDbGllbnQub2JqZWN0cy5zb21lT2JqZWN0TmFtZVxuXHRcdFx0XHQuZmlyc3RNZXRob2Qoc29tZUhhbmRsZXIpXG5cdFx0XHRcdC5zZWNvbmRNZXRob2Qoc29tZUhhbmRsZXIpO1xuXG5cdFx0Ki9cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNNZXRob2RDcmVhdGUgPSBmdW5jdGlvbihvYmplY3ROYW1lLCBtZXRob2ROYW1lKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7IC8vKGNhbGxiYWNrKSBvciAoYXJncy4uLCBjYWxsYmFjaykgb3IgKGFyZ3MuLi4pIG9yICgpXG5cdFx0XHRcdHZhciBhcmdzO1xuXHRcdFx0XHR2YXIgY2FsbGJhY2s7XG5cblx0XHRcdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0dmFyIHNsaWNlRW5kSW5kZXggPSBhcmd1bWVudHMubGVuZ3RoIC0gMTtcblx0XHRcdFx0XHR2YXIgY2FsbGJhY2tJbmRleCA9IGFyZ3VtZW50cy5sZW5ndGggLSAxO1xuXG5cdFx0XHRcdFx0aWYgKHR5cGVvZihhcmd1bWVudHNbY2FsbGJhY2tJbmRleF0pICE9ICdmdW5jdGlvbicpIHNsaWNlRW5kSW5kZXggPSBhcmd1bWVudHMubGVuZ3RoO1xuXHRcdFx0XHRcdGVsc2UgY2FsbGJhY2sgPSBhcmd1bWVudHNbY2FsbGJhY2tJbmRleF07XG5cblx0XHRcdFx0XHRhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwLCBzbGljZUVuZEluZGV4KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghY2FsbGJhY2spXG5cdFx0XHRcdFx0Y2FsbGJhY2sgPSBmdW5jdGlvbihlcnJvciwgcmVzdWx0KSB7XG5cdFx0XHRcdFx0XHR0aGlzLmVtaXQoJ3dhcm4nLCB7XG5cdFx0XHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBXYXJuOiDRgdC10YDQstC10YAg0LLQtdGA0L3Rg9C7INGA0LXQt9GD0LvRjNGC0LDRgiDQtNC70Y8gXCIgKyBvYmplY3ROYW1lICsgXCIuXCIgKyBtZXRob2ROYW1lICsgXCIg0LHQtdC3INC30LDRgNC10LPQuNGB0YLRgNC40YDQvtCy0LDQvdC90L7Qs9C+INC90LAg0LrQu9C40LXQvdGC0LUg0LrQsNC70LHQtdC60LBcIixcblx0XHRcdFx0XHRcdFx0Y2FsbGVkV2l0aEFyZ3VtZW50czogYXJndW1lbnRzLFxuXHRcdFx0XHRcdFx0XHRyZXR1cm5lZEVycm9yOiBlcnJvcixcblx0XHRcdFx0XHRcdFx0cmV0dXJuZWRSZXN1bHQ6IHJlc3VsdFxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fS5iaW5kKHRoaXMpO1xuXG5cdFx0XHRcdHZhciByZXF1ZXN0SWQgPSB0aGlzLl92YWx1ZVJlcXVlc3RzLmxlbmd0aDtcblx0XHRcdFx0dGhpcy5fdmFsdWVSZXF1ZXN0cy5wdXNoKGNhbGxiYWNrKTtcblxuXHRcdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0LLRi9C30LLRi9C9INC80LXRgtC+0LQg0YHQtdGA0LLQtdGA0L3QvtCz0L4g0L7QsdGK0LXQutGC0LA6IFwiICsgb2JqZWN0TmFtZSArIFwiLlwiICsgbWV0aG9kTmFtZSxcblx0XHRcdFx0XHRhcmdzOiBhcmdzLFxuXHRcdFx0XHRcdHJlcXVlc3RJZDogcmVxdWVzdElkXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRoaXMuX2Z1bmNRdWFyYW50ZWVkU2VuZE1lc3NhZ2Uoe1xuXHRcdFx0XHRcdG9iamVjdE5hbWU6IG9iamVjdE5hbWUsXG5cdFx0XHRcdFx0dHlwZTogXCJjb21tYW5kXCIsXG5cdFx0XHRcdFx0Y29tbWFuZDogbWV0aG9kTmFtZSxcblx0XHRcdFx0XHRyZXF1ZXN0SWQ6IHJlcXVlc3RJZCxcblx0XHRcdFx0XHRwZWVySWQ6IHRoaXMuX3ZhbHVlUGVlcklkLFxuXHRcdFx0XHRcdGFyZ3M6IGFyZ3Ncblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0cmV0dXJuIHRoaXMub2JqZWN0c1tvYmplY3ROYW1lXTtcblx0XHRcdH07XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdFx00KXQtdC90LTQu9C10YAg0LTQu9GPINC60LDQu9Cx0LXQutC+0LIg0LzQtdGC0L7QtNC+0LIg0YHQtdGA0LLQtdGA0L3Ri9GFINC+0LHRitC10LrRgtC+0LIuXG5cdFx0XHTRhNC+0YDQvNCw0YIg0L/RgNC40L3QuNC80LDQtdC80L7Qs9C+INCw0YDQs9GD0LzQtdC90YLQsCBcblx0XHRcdFxuXHRcdFx0bWVzc2FnZSA9IHtcblx0XHRcdFx0dHlwZTogJ2NhbGxiYWNrJyxcblx0XHRcdFx0Y29tbWFuZDogJ21ldGhvZE5hbWUnLFxuXHRcdFx0XHRvYmplY3ROYW1lOiAnb2JqZWN0TmFtZScsXG5cdFx0XHRcdHJlcXVlc3RJZDogMCxcblx0XHRcdFx0ZXJyb3I6IG51bGwsXG5cdFx0XHRcdHJlc3VsdDogc29tZVJlc3VsdFxuXHRcdFx0fVxuXG5cdFx0XHTQstC90YPRgtGA0Lgg0LzQtdGC0L7QtNCwINCx0YPQtNC10YIg0LLRi9C30LLQsNC9INC60LDQu9Cx0LXQuiDQv9C+0YHRgtCw0LLQu9C10L3QvdGL0Lkg0LIg0YHQvtC+0YLQstC10YLRgdGC0LLQuNC1INGBIHJlcXVlc3RJZFxuXG5cdFx0Ki9cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNDYWxsYmFja0hhbmRsZXIgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG5cdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INGB0LXRgNCy0LXRgCDQstC10YDQvdGD0LsgY2FsbGJhY2sg0L3QsDogXCIgKyBtZXNzYWdlLm9iamVjdE5hbWUgKyBcIi5cIiArIG1lc3NhZ2UuY29tbWFuZCxcblx0XHRcdFx0bWVzc2FnZTogbWVzc2FnZVxuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuX3ZhbHVlUmVxdWVzdHNbbWVzc2FnZS5yZXF1ZXN0SWRdKG1lc3NhZ2UuZXJyb3IsIG1lc3NhZ2UucmVzdWx0KTtcblx0XHRcdGRlbGV0ZSB0aGlzLl92YWx1ZVJlcXVlc3RzW21lc3NhZ2UucmVxdWVzdElkXTtcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0XHTQpdGN0L3QtNC70LXRgCDQtNC70Y8g0YHQvtCx0YvRgtC40Lkg0LLRi9Cx0YDQsNGB0YvQstCw0LXQvNGL0YUg0YHQtdGA0LLQtdGA0L3Ri9C80Lgg0L7QsdGK0LXQutGC0LDQvNC4XG5cdFx0XHTRhNC+0YDQvNCw0YIg0L/RgNC40L3QuNC80LDQtdCz0L4g0LDRgNCz0YPQvNC10L3RgtCwXG5cblx0XHRcdNGC0LDQuiDQutCw0LogZW1pdCDQv9GA0LjQvdC40LzQsNC10YIg0L3QtdC+0LPRgNCw0L3QuNGH0LXQvdC90L7QtSDQutC+0LvQuNGH0LXRgdGC0LLQviDQsNGA0LPRg9C80LXQvdGC0L7QsiDQv9C10YDQtdC00LDQstCw0LXQvNGL0YUg0L/QvtC00L/QuNGB0YfQuNC60LDQvCwg0YLQvlxuXHRcdFx0bWVzc2FnZS5hcmdzINGN0YLQviDQvNCw0YHRgdC40LIsINGB0L7QtNC10YDQttCw0YnQuNC5INC/0LXRgNC10LTQsNC90L3Ri9C1INCw0YDQs9GD0LzQtdC90YLRiy5cblxuXHRcdFx0bWVzc2FnZSA9IHtcblx0XHRcdFx0dHlwZTogJ2V2ZW50Jyxcblx0XHRcdFx0ZXZlbnQ6ICdldmVudE5hbWUnLFxuXHRcdFx0XHRvYmplY3ROYW1lOiAnc29tZU9iamVjdE5hbWUnXG5cdFx0XHRcdGFyZ3M6IFtzb21lQXJnc11cblx0XHRcdH1cblxuXHRcdCovXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jRXZlbnRIYW5kbGVyID0gZnVuY3Rpb24obWVzc2FnZSkge1xuXHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDRgdC10YDQstC10YAg0L/QtdGA0LXQtNCw0Lsg0YHQvtCx0YvRgtC40LU6IFwiICsgbWVzc2FnZS5vYmplY3ROYW1lICsgXCIuXCIgKyBtZXNzYWdlLmV2ZW50LFxuXHRcdFx0XHRtZXNzYWdlOiBtZXNzYWdlXG5cdFx0XHR9KTtcblxuXHRcdFx0dmFyIGVtaXRBcmdzID0gW107XG5cdFx0XHRlbWl0QXJncy5wdXNoKG1lc3NhZ2UuZXZlbnQpO1xuXHRcdFx0ZW1pdEFyZ3MgPSBlbWl0QXJncy5jb25jYXQobWVzc2FnZS5hcmdzKTtcblxuXHRcdFx0dmFyIG9iamVjdCA9IHRoaXMub2JqZWN0c1ttZXNzYWdlLm9iamVjdE5hbWVdO1xuXG5cdFx0XHRvYmplY3QuZW1pdC5hcHBseShvYmplY3QsIGVtaXRBcmdzKTtcblx0XHR9O1xuXG5cdFx0Ly9lbmQgcHJpdmF0ZVxuXG5cdFx0cmV0dXJuIFRlbGVwb3J0Q2xpZW50O1xuXHR9XG59KHdpbmRvdykpOyIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsImlmICh0eXBlb2YgT2JqZWN0LmNyZWF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAvLyBpbXBsZW1lbnRhdGlvbiBmcm9tIHN0YW5kYXJkIG5vZGUuanMgJ3V0aWwnIG1vZHVsZVxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgY3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ3Rvci5wcm90b3R5cGUsIHtcbiAgICAgIGNvbnN0cnVjdG9yOiB7XG4gICAgICAgIHZhbHVlOiBjdG9yLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuICB9O1xufSBlbHNlIHtcbiAgLy8gb2xkIHNjaG9vbCBzaGltIGZvciBvbGQgYnJvd3NlcnNcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIHZhciBUZW1wQ3RvciA9IGZ1bmN0aW9uICgpIHt9XG4gICAgVGVtcEN0b3IucHJvdG90eXBlID0gc3VwZXJDdG9yLnByb3RvdHlwZVxuICAgIGN0b3IucHJvdG90eXBlID0gbmV3IFRlbXBDdG9yKClcbiAgICBjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGN0b3JcbiAgfVxufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxucHJvY2Vzcy5uZXh0VGljayA9IChmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGNhblNldEltbWVkaWF0ZSA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gICAgJiYgd2luZG93LnNldEltbWVkaWF0ZTtcbiAgICB2YXIgY2FuUG9zdCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gICAgJiYgd2luZG93LnBvc3RNZXNzYWdlICYmIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyXG4gICAgO1xuXG4gICAgaWYgKGNhblNldEltbWVkaWF0ZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGYpIHsgcmV0dXJuIHdpbmRvdy5zZXRJbW1lZGlhdGUoZikgfTtcbiAgICB9XG5cbiAgICBpZiAoY2FuUG9zdCkge1xuICAgICAgICB2YXIgcXVldWUgPSBbXTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgICAgICAgIHZhciBzb3VyY2UgPSBldi5zb3VyY2U7XG4gICAgICAgICAgICBpZiAoKHNvdXJjZSA9PT0gd2luZG93IHx8IHNvdXJjZSA9PT0gbnVsbCkgJiYgZXYuZGF0YSA9PT0gJ3Byb2Nlc3MtdGljaycpIHtcbiAgICAgICAgICAgICAgICBldi5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICBpZiAocXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZm4gPSBxdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgICAgICBxdWV1ZS5wdXNoKGZuKTtcbiAgICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZSgncHJvY2Vzcy10aWNrJywgJyonKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgc2V0VGltZW91dChmbiwgMCk7XG4gICAgfTtcbn0pKCk7XG5cbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufVxuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzQnVmZmVyKGFyZykge1xuICByZXR1cm4gYXJnICYmIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnXG4gICAgJiYgdHlwZW9mIGFyZy5jb3B5ID09PSAnZnVuY3Rpb24nXG4gICAgJiYgdHlwZW9mIGFyZy5maWxsID09PSAnZnVuY3Rpb24nXG4gICAgJiYgdHlwZW9mIGFyZy5yZWFkVUludDggPT09ICdmdW5jdGlvbic7XG59IiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCl7XG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxudmFyIGZvcm1hdFJlZ0V4cCA9IC8lW3NkaiVdL2c7XG5leHBvcnRzLmZvcm1hdCA9IGZ1bmN0aW9uKGYpIHtcbiAgaWYgKCFpc1N0cmluZyhmKSkge1xuICAgIHZhciBvYmplY3RzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIG9iamVjdHMucHVzaChpbnNwZWN0KGFyZ3VtZW50c1tpXSkpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0cy5qb2luKCcgJyk7XG4gIH1cblxuICB2YXIgaSA9IDE7XG4gIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICB2YXIgbGVuID0gYXJncy5sZW5ndGg7XG4gIHZhciBzdHIgPSBTdHJpbmcoZikucmVwbGFjZShmb3JtYXRSZWdFeHAsIGZ1bmN0aW9uKHgpIHtcbiAgICBpZiAoeCA9PT0gJyUlJykgcmV0dXJuICclJztcbiAgICBpZiAoaSA+PSBsZW4pIHJldHVybiB4O1xuICAgIHN3aXRjaCAoeCkge1xuICAgICAgY2FzZSAnJXMnOiByZXR1cm4gU3RyaW5nKGFyZ3NbaSsrXSk7XG4gICAgICBjYXNlICclZCc6IHJldHVybiBOdW1iZXIoYXJnc1tpKytdKTtcbiAgICAgIGNhc2UgJyVqJzpcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoYXJnc1tpKytdKTtcbiAgICAgICAgfSBjYXRjaCAoXykge1xuICAgICAgICAgIHJldHVybiAnW0NpcmN1bGFyXSc7XG4gICAgICAgIH1cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB4O1xuICAgIH1cbiAgfSk7XG4gIGZvciAodmFyIHggPSBhcmdzW2ldOyBpIDwgbGVuOyB4ID0gYXJnc1srK2ldKSB7XG4gICAgaWYgKGlzTnVsbCh4KSB8fCAhaXNPYmplY3QoeCkpIHtcbiAgICAgIHN0ciArPSAnICcgKyB4O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgKz0gJyAnICsgaW5zcGVjdCh4KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn07XG5cblxuLy8gTWFyayB0aGF0IGEgbWV0aG9kIHNob3VsZCBub3QgYmUgdXNlZC5cbi8vIFJldHVybnMgYSBtb2RpZmllZCBmdW5jdGlvbiB3aGljaCB3YXJucyBvbmNlIGJ5IGRlZmF1bHQuXG4vLyBJZiAtLW5vLWRlcHJlY2F0aW9uIGlzIHNldCwgdGhlbiBpdCBpcyBhIG5vLW9wLlxuZXhwb3J0cy5kZXByZWNhdGUgPSBmdW5jdGlvbihmbiwgbXNnKSB7XG4gIC8vIEFsbG93IGZvciBkZXByZWNhdGluZyB0aGluZ3MgaW4gdGhlIHByb2Nlc3Mgb2Ygc3RhcnRpbmcgdXAuXG4gIGlmIChpc1VuZGVmaW5lZChnbG9iYWwucHJvY2VzcykpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZXhwb3J0cy5kZXByZWNhdGUoZm4sIG1zZykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG5cbiAgaWYgKHByb2Nlc3Mubm9EZXByZWNhdGlvbiA9PT0gdHJ1ZSkge1xuICAgIHJldHVybiBmbjtcbiAgfVxuXG4gIHZhciB3YXJuZWQgPSBmYWxzZTtcbiAgZnVuY3Rpb24gZGVwcmVjYXRlZCgpIHtcbiAgICBpZiAoIXdhcm5lZCkge1xuICAgICAgaWYgKHByb2Nlc3MudGhyb3dEZXByZWNhdGlvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgICAgIH0gZWxzZSBpZiAocHJvY2Vzcy50cmFjZURlcHJlY2F0aW9uKSB7XG4gICAgICAgIGNvbnNvbGUudHJhY2UobXNnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IobXNnKTtcbiAgICAgIH1cbiAgICAgIHdhcm5lZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cbiAgcmV0dXJuIGRlcHJlY2F0ZWQ7XG59O1xuXG5cbnZhciBkZWJ1Z3MgPSB7fTtcbnZhciBkZWJ1Z0Vudmlyb247XG5leHBvcnRzLmRlYnVnbG9nID0gZnVuY3Rpb24oc2V0KSB7XG4gIGlmIChpc1VuZGVmaW5lZChkZWJ1Z0Vudmlyb24pKVxuICAgIGRlYnVnRW52aXJvbiA9IHByb2Nlc3MuZW52Lk5PREVfREVCVUcgfHwgJyc7XG4gIHNldCA9IHNldC50b1VwcGVyQ2FzZSgpO1xuICBpZiAoIWRlYnVnc1tzZXRdKSB7XG4gICAgaWYgKG5ldyBSZWdFeHAoJ1xcXFxiJyArIHNldCArICdcXFxcYicsICdpJykudGVzdChkZWJ1Z0Vudmlyb24pKSB7XG4gICAgICB2YXIgcGlkID0gcHJvY2Vzcy5waWQ7XG4gICAgICBkZWJ1Z3Nbc2V0XSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbXNnID0gZXhwb3J0cy5mb3JtYXQuYXBwbHkoZXhwb3J0cywgYXJndW1lbnRzKTtcbiAgICAgICAgY29uc29sZS5lcnJvcignJXMgJWQ6ICVzJywgc2V0LCBwaWQsIG1zZyk7XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWJ1Z3Nbc2V0XSA9IGZ1bmN0aW9uKCkge307XG4gICAgfVxuICB9XG4gIHJldHVybiBkZWJ1Z3Nbc2V0XTtcbn07XG5cblxuLyoqXG4gKiBFY2hvcyB0aGUgdmFsdWUgb2YgYSB2YWx1ZS4gVHJ5cyB0byBwcmludCB0aGUgdmFsdWUgb3V0XG4gKiBpbiB0aGUgYmVzdCB3YXkgcG9zc2libGUgZ2l2ZW4gdGhlIGRpZmZlcmVudCB0eXBlcy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqIFRoZSBvYmplY3QgdG8gcHJpbnQgb3V0LlxuICogQHBhcmFtIHtPYmplY3R9IG9wdHMgT3B0aW9uYWwgb3B0aW9ucyBvYmplY3QgdGhhdCBhbHRlcnMgdGhlIG91dHB1dC5cbiAqL1xuLyogbGVnYWN5OiBvYmosIHNob3dIaWRkZW4sIGRlcHRoLCBjb2xvcnMqL1xuZnVuY3Rpb24gaW5zcGVjdChvYmosIG9wdHMpIHtcbiAgLy8gZGVmYXVsdCBvcHRpb25zXG4gIHZhciBjdHggPSB7XG4gICAgc2VlbjogW10sXG4gICAgc3R5bGl6ZTogc3R5bGl6ZU5vQ29sb3JcbiAgfTtcbiAgLy8gbGVnYWN5Li4uXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDMpIGN0eC5kZXB0aCA9IGFyZ3VtZW50c1syXTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gNCkgY3R4LmNvbG9ycyA9IGFyZ3VtZW50c1szXTtcbiAgaWYgKGlzQm9vbGVhbihvcHRzKSkge1xuICAgIC8vIGxlZ2FjeS4uLlxuICAgIGN0eC5zaG93SGlkZGVuID0gb3B0cztcbiAgfSBlbHNlIGlmIChvcHRzKSB7XG4gICAgLy8gZ290IGFuIFwib3B0aW9uc1wiIG9iamVjdFxuICAgIGV4cG9ydHMuX2V4dGVuZChjdHgsIG9wdHMpO1xuICB9XG4gIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5zaG93SGlkZGVuKSkgY3R4LnNob3dIaWRkZW4gPSBmYWxzZTtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5kZXB0aCkpIGN0eC5kZXB0aCA9IDI7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguY29sb3JzKSkgY3R4LmNvbG9ycyA9IGZhbHNlO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmN1c3RvbUluc3BlY3QpKSBjdHguY3VzdG9tSW5zcGVjdCA9IHRydWU7XG4gIGlmIChjdHguY29sb3JzKSBjdHguc3R5bGl6ZSA9IHN0eWxpemVXaXRoQ29sb3I7XG4gIHJldHVybiBmb3JtYXRWYWx1ZShjdHgsIG9iaiwgY3R4LmRlcHRoKTtcbn1cbmV4cG9ydHMuaW5zcGVjdCA9IGluc3BlY3Q7XG5cblxuLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9BTlNJX2VzY2FwZV9jb2RlI2dyYXBoaWNzXG5pbnNwZWN0LmNvbG9ycyA9IHtcbiAgJ2JvbGQnIDogWzEsIDIyXSxcbiAgJ2l0YWxpYycgOiBbMywgMjNdLFxuICAndW5kZXJsaW5lJyA6IFs0LCAyNF0sXG4gICdpbnZlcnNlJyA6IFs3LCAyN10sXG4gICd3aGl0ZScgOiBbMzcsIDM5XSxcbiAgJ2dyZXknIDogWzkwLCAzOV0sXG4gICdibGFjaycgOiBbMzAsIDM5XSxcbiAgJ2JsdWUnIDogWzM0LCAzOV0sXG4gICdjeWFuJyA6IFszNiwgMzldLFxuICAnZ3JlZW4nIDogWzMyLCAzOV0sXG4gICdtYWdlbnRhJyA6IFszNSwgMzldLFxuICAncmVkJyA6IFszMSwgMzldLFxuICAneWVsbG93JyA6IFszMywgMzldXG59O1xuXG4vLyBEb24ndCB1c2UgJ2JsdWUnIG5vdCB2aXNpYmxlIG9uIGNtZC5leGVcbmluc3BlY3Quc3R5bGVzID0ge1xuICAnc3BlY2lhbCc6ICdjeWFuJyxcbiAgJ251bWJlcic6ICd5ZWxsb3cnLFxuICAnYm9vbGVhbic6ICd5ZWxsb3cnLFxuICAndW5kZWZpbmVkJzogJ2dyZXknLFxuICAnbnVsbCc6ICdib2xkJyxcbiAgJ3N0cmluZyc6ICdncmVlbicsXG4gICdkYXRlJzogJ21hZ2VudGEnLFxuICAvLyBcIm5hbWVcIjogaW50ZW50aW9uYWxseSBub3Qgc3R5bGluZ1xuICAncmVnZXhwJzogJ3JlZCdcbn07XG5cblxuZnVuY3Rpb24gc3R5bGl6ZVdpdGhDb2xvcihzdHIsIHN0eWxlVHlwZSkge1xuICB2YXIgc3R5bGUgPSBpbnNwZWN0LnN0eWxlc1tzdHlsZVR5cGVdO1xuXG4gIGlmIChzdHlsZSkge1xuICAgIHJldHVybiAnXFx1MDAxYlsnICsgaW5zcGVjdC5jb2xvcnNbc3R5bGVdWzBdICsgJ20nICsgc3RyICtcbiAgICAgICAgICAgJ1xcdTAwMWJbJyArIGluc3BlY3QuY29sb3JzW3N0eWxlXVsxXSArICdtJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gc3RyO1xuICB9XG59XG5cblxuZnVuY3Rpb24gc3R5bGl6ZU5vQ29sb3Ioc3RyLCBzdHlsZVR5cGUpIHtcbiAgcmV0dXJuIHN0cjtcbn1cblxuXG5mdW5jdGlvbiBhcnJheVRvSGFzaChhcnJheSkge1xuICB2YXIgaGFzaCA9IHt9O1xuXG4gIGFycmF5LmZvckVhY2goZnVuY3Rpb24odmFsLCBpZHgpIHtcbiAgICBoYXNoW3ZhbF0gPSB0cnVlO1xuICB9KTtcblxuICByZXR1cm4gaGFzaDtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRWYWx1ZShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMpIHtcbiAgLy8gUHJvdmlkZSBhIGhvb2sgZm9yIHVzZXItc3BlY2lmaWVkIGluc3BlY3QgZnVuY3Rpb25zLlxuICAvLyBDaGVjayB0aGF0IHZhbHVlIGlzIGFuIG9iamVjdCB3aXRoIGFuIGluc3BlY3QgZnVuY3Rpb24gb24gaXRcbiAgaWYgKGN0eC5jdXN0b21JbnNwZWN0ICYmXG4gICAgICB2YWx1ZSAmJlxuICAgICAgaXNGdW5jdGlvbih2YWx1ZS5pbnNwZWN0KSAmJlxuICAgICAgLy8gRmlsdGVyIG91dCB0aGUgdXRpbCBtb2R1bGUsIGl0J3MgaW5zcGVjdCBmdW5jdGlvbiBpcyBzcGVjaWFsXG4gICAgICB2YWx1ZS5pbnNwZWN0ICE9PSBleHBvcnRzLmluc3BlY3QgJiZcbiAgICAgIC8vIEFsc28gZmlsdGVyIG91dCBhbnkgcHJvdG90eXBlIG9iamVjdHMgdXNpbmcgdGhlIGNpcmN1bGFyIGNoZWNrLlxuICAgICAgISh2YWx1ZS5jb25zdHJ1Y3RvciAmJiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgPT09IHZhbHVlKSkge1xuICAgIHZhciByZXQgPSB2YWx1ZS5pbnNwZWN0KHJlY3Vyc2VUaW1lcywgY3R4KTtcbiAgICBpZiAoIWlzU3RyaW5nKHJldCkpIHtcbiAgICAgIHJldCA9IGZvcm1hdFZhbHVlKGN0eCwgcmV0LCByZWN1cnNlVGltZXMpO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgLy8gUHJpbWl0aXZlIHR5cGVzIGNhbm5vdCBoYXZlIHByb3BlcnRpZXNcbiAgdmFyIHByaW1pdGl2ZSA9IGZvcm1hdFByaW1pdGl2ZShjdHgsIHZhbHVlKTtcbiAgaWYgKHByaW1pdGl2ZSkge1xuICAgIHJldHVybiBwcmltaXRpdmU7XG4gIH1cblxuICAvLyBMb29rIHVwIHRoZSBrZXlzIG9mIHRoZSBvYmplY3QuXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXModmFsdWUpO1xuICB2YXIgdmlzaWJsZUtleXMgPSBhcnJheVRvSGFzaChrZXlzKTtcblxuICBpZiAoY3R4LnNob3dIaWRkZW4pIHtcbiAgICBrZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModmFsdWUpO1xuICB9XG5cbiAgLy8gSUUgZG9lc24ndCBtYWtlIGVycm9yIGZpZWxkcyBub24tZW51bWVyYWJsZVxuICAvLyBodHRwOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvaWUvZHd3NTJzYnQodj12cy45NCkuYXNweFxuICBpZiAoaXNFcnJvcih2YWx1ZSlcbiAgICAgICYmIChrZXlzLmluZGV4T2YoJ21lc3NhZ2UnKSA+PSAwIHx8IGtleXMuaW5kZXhPZignZGVzY3JpcHRpb24nKSA+PSAwKSkge1xuICAgIHJldHVybiBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gIH1cblxuICAvLyBTb21lIHR5cGUgb2Ygb2JqZWN0IHdpdGhvdXQgcHJvcGVydGllcyBjYW4gYmUgc2hvcnRjdXR0ZWQuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgICAgdmFyIG5hbWUgPSB2YWx1ZS5uYW1lID8gJzogJyArIHZhbHVlLm5hbWUgOiAnJztcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW0Z1bmN0aW9uJyArIG5hbWUgKyAnXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfVxuICAgIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoRGF0ZS5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdkYXRlJyk7XG4gICAgfVxuICAgIGlmIChpc0Vycm9yKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICB2YXIgYmFzZSA9ICcnLCBhcnJheSA9IGZhbHNlLCBicmFjZXMgPSBbJ3snLCAnfSddO1xuXG4gIC8vIE1ha2UgQXJyYXkgc2F5IHRoYXQgdGhleSBhcmUgQXJyYXlcbiAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgYXJyYXkgPSB0cnVlO1xuICAgIGJyYWNlcyA9IFsnWycsICddJ107XG4gIH1cblxuICAvLyBNYWtlIGZ1bmN0aW9ucyBzYXkgdGhhdCB0aGV5IGFyZSBmdW5jdGlvbnNcbiAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgdmFyIG4gPSB2YWx1ZS5uYW1lID8gJzogJyArIHZhbHVlLm5hbWUgOiAnJztcbiAgICBiYXNlID0gJyBbRnVuY3Rpb24nICsgbiArICddJztcbiAgfVxuXG4gIC8vIE1ha2UgUmVnRXhwcyBzYXkgdGhhdCB0aGV5IGFyZSBSZWdFeHBzXG4gIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgfVxuXG4gIC8vIE1ha2UgZGF0ZXMgd2l0aCBwcm9wZXJ0aWVzIGZpcnN0IHNheSB0aGUgZGF0ZVxuICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBEYXRlLnByb3RvdHlwZS50b1VUQ1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgfVxuXG4gIC8vIE1ha2UgZXJyb3Igd2l0aCBtZXNzYWdlIGZpcnN0IHNheSB0aGUgZXJyb3JcbiAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgfVxuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCAmJiAoIWFycmF5IHx8IHZhbHVlLmxlbmd0aCA9PSAwKSkge1xuICAgIHJldHVybiBicmFjZXNbMF0gKyBiYXNlICsgYnJhY2VzWzFdO1xuICB9XG5cbiAgaWYgKHJlY3Vyc2VUaW1lcyA8IDApIHtcbiAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ3JlZ2V4cCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ1tPYmplY3RdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cblxuICBjdHguc2Vlbi5wdXNoKHZhbHVlKTtcblxuICB2YXIgb3V0cHV0O1xuICBpZiAoYXJyYXkpIHtcbiAgICBvdXRwdXQgPSBmb3JtYXRBcnJheShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXlzKTtcbiAgfSBlbHNlIHtcbiAgICBvdXRwdXQgPSBrZXlzLm1hcChmdW5jdGlvbihrZXkpIHtcbiAgICAgIHJldHVybiBmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXksIGFycmF5KTtcbiAgICB9KTtcbiAgfVxuXG4gIGN0eC5zZWVuLnBvcCgpO1xuXG4gIHJldHVybiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcyk7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpIHtcbiAgaWYgKGlzVW5kZWZpbmVkKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJ3VuZGVmaW5lZCcsICd1bmRlZmluZWQnKTtcbiAgaWYgKGlzU3RyaW5nKHZhbHVlKSkge1xuICAgIHZhciBzaW1wbGUgPSAnXFwnJyArIEpTT04uc3RyaW5naWZ5KHZhbHVlKS5yZXBsYWNlKC9eXCJ8XCIkL2csICcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKSArICdcXCcnO1xuICAgIHJldHVybiBjdHguc3R5bGl6ZShzaW1wbGUsICdzdHJpbmcnKTtcbiAgfVxuICBpZiAoaXNOdW1iZXIodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnJyArIHZhbHVlLCAnbnVtYmVyJyk7XG4gIGlmIChpc0Jvb2xlYW4odmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnJyArIHZhbHVlLCAnYm9vbGVhbicpO1xuICAvLyBGb3Igc29tZSByZWFzb24gdHlwZW9mIG51bGwgaXMgXCJvYmplY3RcIiwgc28gc3BlY2lhbCBjYXNlIGhlcmUuXG4gIGlmIChpc051bGwodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnbnVsbCcsICdudWxsJyk7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0RXJyb3IodmFsdWUpIHtcbiAgcmV0dXJuICdbJyArIEVycm9yLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSArICddJztcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRBcnJheShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXlzKSB7XG4gIHZhciBvdXRwdXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB2YWx1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICBpZiAoaGFzT3duUHJvcGVydHkodmFsdWUsIFN0cmluZyhpKSkpIHtcbiAgICAgIG91dHB1dC5wdXNoKGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsXG4gICAgICAgICAgU3RyaW5nKGkpLCB0cnVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dC5wdXNoKCcnKTtcbiAgICB9XG4gIH1cbiAga2V5cy5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgIGlmICgha2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBrZXksIHRydWUpKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpIHtcbiAgdmFyIG5hbWUsIHN0ciwgZGVzYztcbiAgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodmFsdWUsIGtleSkgfHwgeyB2YWx1ZTogdmFsdWVba2V5XSB9O1xuICBpZiAoZGVzYy5nZXQpIHtcbiAgICBpZiAoZGVzYy5zZXQpIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyL1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0dldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoZGVzYy5zZXQpIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG4gIGlmICghaGFzT3duUHJvcGVydHkodmlzaWJsZUtleXMsIGtleSkpIHtcbiAgICBuYW1lID0gJ1snICsga2V5ICsgJ10nO1xuICB9XG4gIGlmICghc3RyKSB7XG4gICAgaWYgKGN0eC5zZWVuLmluZGV4T2YoZGVzYy52YWx1ZSkgPCAwKSB7XG4gICAgICBpZiAoaXNOdWxsKHJlY3Vyc2VUaW1lcykpIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCBkZXNjLnZhbHVlLCBudWxsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciA9IGZvcm1hdFZhbHVlKGN0eCwgZGVzYy52YWx1ZSwgcmVjdXJzZVRpbWVzIC0gMSk7XG4gICAgICB9XG4gICAgICBpZiAoc3RyLmluZGV4T2YoJ1xcbicpID4gLTEpIHtcbiAgICAgICAgaWYgKGFycmF5KSB7XG4gICAgICAgICAgc3RyID0gc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICcgKyBsaW5lO1xuICAgICAgICAgIH0pLmpvaW4oJ1xcbicpLnN1YnN0cigyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdHIgPSAnXFxuJyArIHN0ci5zcGxpdCgnXFxuJykubWFwKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgICAgIHJldHVybiAnICAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tDaXJjdWxhcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuICBpZiAoaXNVbmRlZmluZWQobmFtZSkpIHtcbiAgICBpZiAoYXJyYXkgJiYga2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gICAgbmFtZSA9IEpTT04uc3RyaW5naWZ5KCcnICsga2V5KTtcbiAgICBpZiAobmFtZS5tYXRjaCgvXlwiKFthLXpBLVpfXVthLXpBLVpfMC05XSopXCIkLykpIHtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cigxLCBuYW1lLmxlbmd0aCAtIDIpO1xuICAgICAgbmFtZSA9IGN0eC5zdHlsaXplKG5hbWUsICduYW1lJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8oXlwifFwiJCkvZywgXCInXCIpO1xuICAgICAgbmFtZSA9IGN0eC5zdHlsaXplKG5hbWUsICdzdHJpbmcnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmFtZSArICc6ICcgKyBzdHI7XG59XG5cblxuZnVuY3Rpb24gcmVkdWNlVG9TaW5nbGVTdHJpbmcob3V0cHV0LCBiYXNlLCBicmFjZXMpIHtcbiAgdmFyIG51bUxpbmVzRXN0ID0gMDtcbiAgdmFyIGxlbmd0aCA9IG91dHB1dC5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3VyKSB7XG4gICAgbnVtTGluZXNFc3QrKztcbiAgICBpZiAoY3VyLmluZGV4T2YoJ1xcbicpID49IDApIG51bUxpbmVzRXN0Kys7XG4gICAgcmV0dXJuIHByZXYgKyBjdXIucmVwbGFjZSgvXFx1MDAxYlxcW1xcZFxcZD9tL2csICcnKS5sZW5ndGggKyAxO1xuICB9LCAwKTtcblxuICBpZiAobGVuZ3RoID4gNjApIHtcbiAgICByZXR1cm4gYnJhY2VzWzBdICtcbiAgICAgICAgICAgKGJhc2UgPT09ICcnID8gJycgOiBiYXNlICsgJ1xcbiAnKSArXG4gICAgICAgICAgICcgJyArXG4gICAgICAgICAgIG91dHB1dC5qb2luKCcsXFxuICAnKSArXG4gICAgICAgICAgICcgJyArXG4gICAgICAgICAgIGJyYWNlc1sxXTtcbiAgfVxuXG4gIHJldHVybiBicmFjZXNbMF0gKyBiYXNlICsgJyAnICsgb3V0cHV0LmpvaW4oJywgJykgKyAnICcgKyBicmFjZXNbMV07XG59XG5cblxuLy8gTk9URTogVGhlc2UgdHlwZSBjaGVja2luZyBmdW5jdGlvbnMgaW50ZW50aW9uYWxseSBkb24ndCB1c2UgYGluc3RhbmNlb2ZgXG4vLyBiZWNhdXNlIGl0IGlzIGZyYWdpbGUgYW5kIGNhbiBiZSBlYXNpbHkgZmFrZWQgd2l0aCBgT2JqZWN0LmNyZWF0ZSgpYC5cbmZ1bmN0aW9uIGlzQXJyYXkoYXIpIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYXIpO1xufVxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcblxuZnVuY3Rpb24gaXNCb29sZWFuKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nO1xufVxuZXhwb3J0cy5pc0Jvb2xlYW4gPSBpc0Jvb2xlYW47XG5cbmZ1bmN0aW9uIGlzTnVsbChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsID0gaXNOdWxsO1xuXG5mdW5jdGlvbiBpc051bGxPclVuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGxPclVuZGVmaW5lZCA9IGlzTnVsbE9yVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuZXhwb3J0cy5pc051bWJlciA9IGlzTnVtYmVyO1xuXG5mdW5jdGlvbiBpc1N0cmluZyhhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnO1xufVxuZXhwb3J0cy5pc1N0cmluZyA9IGlzU3RyaW5nO1xuXG5mdW5jdGlvbiBpc1N5bWJvbChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnO1xufVxuZXhwb3J0cy5pc1N5bWJvbCA9IGlzU3ltYm9sO1xuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuZXhwb3J0cy5pc1VuZGVmaW5lZCA9IGlzVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc1JlZ0V4cChyZSkge1xuICByZXR1cm4gaXNPYmplY3QocmUpICYmIG9iamVjdFRvU3RyaW5nKHJlKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7XG59XG5leHBvcnRzLmlzUmVnRXhwID0gaXNSZWdFeHA7XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuZXhwb3J0cy5pc09iamVjdCA9IGlzT2JqZWN0O1xuXG5mdW5jdGlvbiBpc0RhdGUoZCkge1xuICByZXR1cm4gaXNPYmplY3QoZCkgJiYgb2JqZWN0VG9TdHJpbmcoZCkgPT09ICdbb2JqZWN0IERhdGVdJztcbn1cbmV4cG9ydHMuaXNEYXRlID0gaXNEYXRlO1xuXG5mdW5jdGlvbiBpc0Vycm9yKGUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KGUpICYmXG4gICAgICAob2JqZWN0VG9TdHJpbmcoZSkgPT09ICdbb2JqZWN0IEVycm9yXScgfHwgZSBpbnN0YW5jZW9mIEVycm9yKTtcbn1cbmV4cG9ydHMuaXNFcnJvciA9IGlzRXJyb3I7XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuZXhwb3J0cy5pc0Z1bmN0aW9uID0gaXNGdW5jdGlvbjtcblxuZnVuY3Rpb24gaXNQcmltaXRpdmUoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGwgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ251bWJlcicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3ltYm9sJyB8fCAgLy8gRVM2IHN5bWJvbFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3VuZGVmaW5lZCc7XG59XG5leHBvcnRzLmlzUHJpbWl0aXZlID0gaXNQcmltaXRpdmU7XG5cbmV4cG9ydHMuaXNCdWZmZXIgPSByZXF1aXJlKCcuL3N1cHBvcnQvaXNCdWZmZXInKTtcblxuZnVuY3Rpb24gb2JqZWN0VG9TdHJpbmcobykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pO1xufVxuXG5cbmZ1bmN0aW9uIHBhZChuKSB7XG4gIHJldHVybiBuIDwgMTAgPyAnMCcgKyBuLnRvU3RyaW5nKDEwKSA6IG4udG9TdHJpbmcoMTApO1xufVxuXG5cbnZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJyxcbiAgICAgICAgICAgICAgJ09jdCcsICdOb3YnLCAnRGVjJ107XG5cbi8vIDI2IEZlYiAxNjoxOTozNFxuZnVuY3Rpb24gdGltZXN0YW1wKCkge1xuICB2YXIgZCA9IG5ldyBEYXRlKCk7XG4gIHZhciB0aW1lID0gW3BhZChkLmdldEhvdXJzKCkpLFxuICAgICAgICAgICAgICBwYWQoZC5nZXRNaW51dGVzKCkpLFxuICAgICAgICAgICAgICBwYWQoZC5nZXRTZWNvbmRzKCkpXS5qb2luKCc6Jyk7XG4gIHJldHVybiBbZC5nZXREYXRlKCksIG1vbnRoc1tkLmdldE1vbnRoKCldLCB0aW1lXS5qb2luKCcgJyk7XG59XG5cblxuLy8gbG9nIGlzIGp1c3QgYSB0aGluIHdyYXBwZXIgdG8gY29uc29sZS5sb2cgdGhhdCBwcmVwZW5kcyBhIHRpbWVzdGFtcFxuZXhwb3J0cy5sb2cgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJyVzIC0gJXMnLCB0aW1lc3RhbXAoKSwgZXhwb3J0cy5mb3JtYXQuYXBwbHkoZXhwb3J0cywgYXJndW1lbnRzKSk7XG59O1xuXG5cbi8qKlxuICogSW5oZXJpdCB0aGUgcHJvdG90eXBlIG1ldGhvZHMgZnJvbSBvbmUgY29uc3RydWN0b3IgaW50byBhbm90aGVyLlxuICpcbiAqIFRoZSBGdW5jdGlvbi5wcm90b3R5cGUuaW5oZXJpdHMgZnJvbSBsYW5nLmpzIHJld3JpdHRlbiBhcyBhIHN0YW5kYWxvbmVcbiAqIGZ1bmN0aW9uIChub3Qgb24gRnVuY3Rpb24ucHJvdG90eXBlKS4gTk9URTogSWYgdGhpcyBmaWxlIGlzIHRvIGJlIGxvYWRlZFxuICogZHVyaW5nIGJvb3RzdHJhcHBpbmcgdGhpcyBmdW5jdGlvbiBuZWVkcyB0byBiZSByZXdyaXR0ZW4gdXNpbmcgc29tZSBuYXRpdmVcbiAqIGZ1bmN0aW9ucyBhcyBwcm90b3R5cGUgc2V0dXAgdXNpbmcgbm9ybWFsIEphdmFTY3JpcHQgZG9lcyBub3Qgd29yayBhc1xuICogZXhwZWN0ZWQgZHVyaW5nIGJvb3RzdHJhcHBpbmcgKHNlZSBtaXJyb3IuanMgaW4gcjExNDkwMykuXG4gKlxuICogQHBhcmFtIHtmdW5jdGlvbn0gY3RvciBDb25zdHJ1Y3RvciBmdW5jdGlvbiB3aGljaCBuZWVkcyB0byBpbmhlcml0IHRoZVxuICogICAgIHByb3RvdHlwZS5cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IHN1cGVyQ3RvciBDb25zdHJ1Y3RvciBmdW5jdGlvbiB0byBpbmhlcml0IHByb3RvdHlwZSBmcm9tLlxuICovXG5leHBvcnRzLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcblxuZXhwb3J0cy5fZXh0ZW5kID0gZnVuY3Rpb24ob3JpZ2luLCBhZGQpIHtcbiAgLy8gRG9uJ3QgZG8gYW55dGhpbmcgaWYgYWRkIGlzbid0IGFuIG9iamVjdFxuICBpZiAoIWFkZCB8fCAhaXNPYmplY3QoYWRkKSkgcmV0dXJuIG9yaWdpbjtcblxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGFkZCk7XG4gIHZhciBpID0ga2V5cy5sZW5ndGg7XG4gIHdoaWxlIChpLS0pIHtcbiAgICBvcmlnaW5ba2V5c1tpXV0gPSBhZGRba2V5c1tpXV07XG4gIH1cbiAgcmV0dXJuIG9yaWdpbjtcbn07XG5cbmZ1bmN0aW9uIGhhc093blByb3BlcnR5KG9iaiwgcHJvcCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCk7XG59XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiOUFwZm5QXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiXX0=
