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

	or 

	use browserify :)
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
		namespace.TeleportClient = CreateTeleportServer(namespace.EventEmitter, namespace.util);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvb3B0L25vZGUvbGliL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9waS9ub2RlLmpzL3Byb2R1Y3Rpb24vTXlXZWJDb21wb25lbnRzL1RlbGVwb3J0Q2xpZW50L3Rlc3RQcm9qZWN0L2Jyb3dzZXJpZnktc3R5bGUvbWFpblRlc3QuanMiLCIvaG9tZS9waS9ub2RlLmpzL3Byb2R1Y3Rpb24vTXlXZWJDb21wb25lbnRzL1RlbGVwb3J0Q2xpZW50L3Rlc3RQcm9qZWN0L2Jyb3dzZXJpZnktc3R5bGUvbm9kZV9tb2R1bGVzL3RlbGVwb3J0LWNsaWVudC9UZWxlcG9ydENsaWVudC5qcyIsIi9vcHQvbm9kZS9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCIvb3B0L25vZGUvbGliL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0c19icm93c2VyLmpzIiwiL29wdC9ub2RlL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwiL29wdC9ub2RlL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvdXRpbC9zdXBwb3J0L2lzQnVmZmVyQnJvd3Nlci5qcyIsIi9vcHQvbm9kZS9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3V0aWwvdXRpbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9TQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgVGVsZXBvcnRDbGllbnQgPSByZXF1aXJlKCd0ZWxlcG9ydC1jbGllbnQnKTtcbnZhciB1dGlsID0gcmVxdWlyZSgndXRpbCcpO1xuXG53aW5kb3cudGVsZXBvcnRDbGllbnQgPSBuZXcgVGVsZXBvcnRDbGllbnQoe1xuXHRcdHNlcnZlckFkZHJlc3M6IFwid3M6Ly9sb2NhbGhvc3Q6ODAwMFwiLFxuXHRcdGF1dG9SZWNvbm5lY3Q6IDMwMDBcblx0fSlcblx0Lm9uKCdkZWJ1ZycsIGNvbnNvbGUuZGVidWcuYmluZChjb25zb2xlKSlcblx0Lm9uKCdpbmZvJywgY29uc29sZS5pbmZvLmJpbmQoY29uc29sZSkpXG5cdC5vbignd2FybicsIGNvbnNvbGUud2Fybi5iaW5kKGNvbnNvbGUpKVxuXHQub24oJ2Vycm9yJywgY29uc29sZS5lcnJvci5iaW5kKGNvbnNvbGUpKVxuXHQub24oJ3JlYWR5JywgZnVuY3Rpb24ob2JqZWN0c1Byb3BzKSB7XG5cdFx0Ly9mb3IgRGVidWdpbmdcblx0XHR3aW5kb3cuc2ltcGxlT2JqZWN0ID0gdGVsZXBvcnRDbGllbnQub2JqZWN0cy5zaW1wbGVPYmplY3Q7O1xuXG5cdFx0LypldmVudHMqL1xuXHRcdHNpbXBsZU9iamVjdFxuXHRcdFx0Lm9uKFxuXHRcdFx0XHQnZXZlbnRXaXRoTXlPcHRpb25zJyxcblx0XHRcdFx0Q3JlYXRlRXZlbnRMb2dnZXIoJ3NpbXBsZU9iamVjdCcsICdldmVudFdpdGhNeU9wdGlvbnMnKSlcblx0XHRcdC5vbihcblx0XHRcdFx0J2V2ZW50V2l0aG91dEFyZ3MnLFxuXHRcdFx0XHRDcmVhdGVFdmVudExvZ2dlcignc2ltcGxlT2JqZWN0JywgJ2V2ZW50V2l0aG91dEFyZ3MnKSlcblx0XHRcdC5vbihcblx0XHRcdFx0J2V2ZW50V2l0aFVubGltQXJncycsXG5cdFx0XHRcdENyZWF0ZUV2ZW50TG9nZ2VyKCdzaW1wbGVPYmplY3QnLCAnZXZlbnRXaXRoVW5saW1BcmdzJykpXG5cdFx0XHQub24oXG5cdFx0XHRcdCcxMHNlY0ludGVydmFsRXZlbnQnLFxuXHRcdFx0XHRDcmVhdGVFdmVudExvZ2dlcignc2ltcGxlT2JqZWN0JywgJzEwc2VjSW50ZXJ2YWxFdmVudCcpKTtcblxuXG5cdFx0LypmdW5jcyB3aXRoIGNhbGxiYWNrKi9cblx0XHRzaW1wbGVPYmplY3Rcblx0XHRcdC5mdW5jKFxuXHRcdFx0XHQnc2ltZXBsZVBhcmFtJyxcblx0XHRcdFx0Q3JlYXRlQ2FsbGJhY2tMb2dnZXIoJ3NpbXBsZU9iamVjdCcsICdmdW5jJykpXG5cdFx0XHQuZnVuY1dpdGhvdXRBcmdzKFxuXHRcdFx0XHRDcmVhdGVDYWxsYmFja0xvZ2dlcignc2ltcGxlT2JqZWN0JywgJ2Z1bmNXaXRob3V0QXJncycpKVxuXG5cdFx0LypmdW5jcyB3aXRob3V0IGNhbGxiYWNrKi9cblx0XHRzaW1wbGVPYmplY3Rcblx0XHRcdC5mdW5jV2l0aFVubGltQXJncyhmYWxzZSwgJzEnLCAyLCAzKVxuXHRcdFx0LmZ1bmNXaXRoMTBTZWNEZWxheSgpO1xuXG5cdH0pLmluaXQoKTtcblxuXG5mdW5jdGlvbiBDcmVhdGVFdmVudExvZ2dlcihvYmplY3ROYW1lLCBldmVudE5hbWUpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdHZhciBvYmogPSB7XG5cdFx0XHRkZXNjOiB1dGlsLmZvcm1hdChcIlslcy5ldmVudF0gSW5mbzog0L/QvtC70YPRh9C10L3QviDRgdC+0LHRi9GC0LjQtSAlc1wiLCBvYmplY3ROYW1lLCBldmVudE5hbWUpLFxuXHRcdFx0YXJndW1lbnRzOiBhcmd1bWVudHNcblx0XHR9O1xuXG5cdFx0dmFyIGRldGFpbHMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkZXRhaWxzJyk7XG5cdFx0ZGV0YWlscy5pbm5lckhUTUwgPSBcIjxzdW1tYXJ5PlwiICsgb2JqLmRlc2MgKyBcIjwvc3VtbWFyeT5cIiArIFwiPHByZT5cIiArIEpTT04uc3RyaW5naWZ5KG9iaiwgJyAnLCA0KSArIFwiPC9wcmVcIjtcblxuXHRcdHZhciB3ZWxjb20gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2VsY29tJyk7XG5cdFx0d2VsY29tLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGRldGFpbHMsIHdlbGNvbSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gQ3JlYXRlQ2FsbGJhY2tMb2dnZXIob2JqZWN0TmFtZSwgbWV0aG9kTmFtZSkge1xuXHRyZXR1cm4gZnVuY3Rpb24oZXJyb3IsIHJlc3VsdCkge1xuXHRcdHZhciBvYmogPSB7XG5cdFx0XHRkZXNjOiB1dGlsLmZvcm1hdChcIlslcy5jYWxsYmFja10gSW5mbzog0LLQtdGA0L3Rg9C70YHRjyDRgNC10LfRg9C70YzRgtCw0YIg0LLRi9C30L7QstCwINC80LXRgtC+0LTQsCAlc1wiLCBvYmplY3ROYW1lLCBtZXRob2ROYW1lKSxcblx0XHRcdHJlc3VsdDogcmVzdWx0LFxuXHRcdFx0ZXJyb3I6IGVycm9yXG5cdFx0fTtcblxuXG5cdFx0dmFyIGRldGFpbHMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkZXRhaWxzJyk7XG5cdFx0ZGV0YWlscy5pbm5lckhUTUwgPSBcIjxzdW1tYXJ5PlwiICsgb2JqLmRlc2MgKyBcIjwvc3VtbWFyeT5cIiArIFwiPHByZT5cIiArIEpTT04uc3RyaW5naWZ5KG9iaiwgJyAnLCA0KSArIFwiPC9wcmVcIjtcblxuXHRcdHZhciB3ZWxjb20gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2VsY29tJyk7XG5cdFx0d2VsY29tLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGRldGFpbHMsIHdlbGNvbSk7XG5cdH1cbn0iLCIvKipcblx0aHR0cHM6Ly9naXRodWIuY29tL25za2F6a2kvd2ViLVRlbGVwb3J0Q2xpZW50XG5cdE1JVFxuXHRmcm9tIHJ1c3NpYSB3aXRoIGxvdmUsIDIwMTRcbiovXG5cblxuLypcbm5lZWQgaW5jbHVkZTpcblx0bXktaGVscGVycy91dGlsLmpzXG5cdG15LWhlbHBlcnMvRXZlbnRFbWl0dGVyLmpzXG4qL1xuXG4vKlxuXHRyZXF1aXJlanMuY29uZmlnKHtcblx0XHRwYXRoczoge1xuXHRcdFx0RXZlbnRFbWl0dGVyOiAnYm93ZXJfY29tcG9uZW50cy9teS1oZWxwZXJzL0V2ZW50RW1pdHRlcicsXG5cdFx0XHR1dGlsOiAnYm93ZXJfY29tcG9uZW50cy9teS1oZWxwZXJzL3V0aWwnXG5cdFx0fVxuXHR9KTtcblxuXHRvclxuXHRcblx0PHNjcmlwdCBzcmM9XCIuL2pzL3NvbWVMaWJzRm9sZGVyL215LWhlbHBlcnMvRXZlbnRFbWl0dGVyLmpzXCIgdHlwZT1cInRleHQvamF2YXNjcmlwdFwiPjwvc2NyaXB0PlxuXHQ8c2NyaXB0IHNyYz1cIi4vanMvc29tZUxpYnNGb2xkZXIvbXktaGVscGVycy91dGlsLmpzXCIgdHlwZT1cInRleHQvamF2YXNjcmlwdFwiPjwvc2NyaXB0PlxuXG5cdG9yIFxuXG5cdHVzZSBicm93c2VyaWZ5IDopXG4qL1xuXG4vKlxuXHRQdWJsaWM6XG5cblx0XHRpbml0XG5cdFx0ZGVzdHJveVx0XHRcdFxuXG5cdEV2ZW50czpcblxuXHRcdGRlYnVnIFxuXHRcdGluZm8gXG5cdFx0d2FybiBcblx0XHRlcnJvciBcdFxuXG5cdFx0cmVhZHlcblx0XHRjbG9zZVxuXHRcdGRlc3Ryb3llZFxuXHRcdFxuXHRcdHJlY29ubmVjdGVkXG5cdFx0cmVjb25uZWN0aW5nXG5cblx0XHRyZWNvbm5lY3RlZFRvTmV3U2VydmVyXG5cdFx0cmVjb25uZWN0ZWRUb09sZFNlcnZlclxuXG5cdFx0c2VydmVyT2JqZWN0c0NoYW5nZWRcbiovXG5cblwidXNlIHN0cmljdFwiO1xuXG4oZnVuY3Rpb24obmFtZXNwYWNlKSB7XG5cblx0aWYgKG5hbWVzcGFjZS5kZWZpbmUgJiYgbmFtZXNwYWNlLnJlcXVpcmVqcykge1xuXHRcdC8qKlxuXHRcdFx00KDQsNC3INC10YHRgtGMIGRlZmluZSDQuCByZXF1aXJlanMg0LfQvdCw0YfQuNGCINC/0L7QtNC60LvRjtGH0LXQvSByZXF1aXJlanMuXG5cdFx0XHTQl9Cw0LLQuNGB0LjQvNC+0YHRgtC4INCx0YPQtNC10YIg0L/QtdGA0LXQtNCw0L3QvdGLINCyIENyZWF0ZVRlbGVwb3J0U2VydmVyLCBcblx0XHRcdNC60L7RgtC+0YDRi9C5INCy0LXRgNC90LXRgiDRgdGE0L7RgNC80LjRgNC+0LLQsNC90L3Ri9C5INC60LvQsNGB0YEgVGVsZXBvcnRDbGllbnRcblxuXHRcdCovXG5cdFx0ZGVmaW5lKFxuXHRcdFx0W1xuXHRcdFx0XHQnRXZlbnRFbWl0dGVyJyxcblx0XHRcdFx0J3V0aWwnXG5cdFx0XHRdLFxuXHRcdFx0Q3JlYXRlVGVsZXBvcnRTZXJ2ZXIpO1xuXHR9IGVsc2UgaWYgKGlzTW9kdWxlKCkpIHtcblx0XHQvKipcblx0XHRcdNCg0LDQtyDQtdGB0YLRjCBtb2R1bGUuZXhwb3J0cyDQt9C90LDRh9C40YIgYnJvd3NlcmlmeSDRgdC10LnRh9Cw0YEg0L/QvtC00LrQu9GO0YfQsNC10YIg0Y3RgtC+0YIg0LzQvtC00YPQu9GMXG5cdFx0XHTQl9Cw0LLQuNGB0LjQvNC+0YHRgtC4INGD0LTQvtCy0LvQtdGC0LLQvtGA0LjRgiDRgdCw0LwgYnJvd3NlcmlmeS4gXG5cblx0XHQqL1xuXG5cdFx0dmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblx0XHR2YXIgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKTtcblxuXHRcdG1vZHVsZS5leHBvcnRzID0gQ3JlYXRlVGVsZXBvcnRTZXJ2ZXIoRXZlbnRFbWl0dGVyLCB1dGlsKTtcblx0fSBlbHNlIHtcblx0XHQvKipcblx0XHRcdNCY0L3QsNGH0LUg0YHRh9C40YLQsNGOLCDRh9GC0L4gVGVsZXBvcnRDbGllbnQg0L/QvtC00LrQu9GO0YfQtdC9INCyIFwi0LrQu9Cw0YHRgdC40YfQtdGB0LrQuNC5XCJcblx0XHRcdNC/0YDQvtC10LrRgiwg0LfQsNCy0LjRgdC40LzQvtGB0YLQuCDRg9C00L7QstC70LXRgtCy0L7RgNC10L3RiyDRgNCw0LfRgNCw0LHQvtGC0YfQuNC60L7QvCDQv9GA0L7QtdC60YLQsCDQutC+0YLQvtGA0L7QvNGDINC80L7QuSBcblx0XHRcdNC60LvQsNGB0YEg0L/QvtC90LDQtNC+0LHQuNC70YHRjywg0Lgg0LTQvtCx0LDQstC70Y/RjiDRgdGE0L7RgNC80LjRgNC+0LLQsNC90L3Ri9C5INC60LvQsNGB0YEg0LIg0LPQu9C+0LHQsNC70YzQvdC+0LUg0L/RgNC+0YHRgtGA0LDQvdGB0YLQstC+INC40LzQtdC9LlxuXG5cdFx0Ki9cblx0XHRuYW1lc3BhY2UuVGVsZXBvcnRDbGllbnQgPSBDcmVhdGVUZWxlcG9ydFNlcnZlcihuYW1lc3BhY2UuRXZlbnRFbWl0dGVyLCBuYW1lc3BhY2UudXRpbCk7XG5cdH1cblxuXHRmdW5jdGlvbiBpc01vZHVsZSgpIHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIG1vZHVsZSAmJiBtb2R1bGUuZXhwb3J0cztcblx0XHR9IGNhdGNoIChleCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIENyZWF0ZVRlbGVwb3J0U2VydmVyKEV2ZW50RW1pdHRlciwgdXRpbCkge1xuXHRcdHV0aWwuaW5oZXJpdHMoVGVsZXBvcnRDbGllbnQsIEV2ZW50RW1pdHRlcik7XG5cblx0XHQvKipcblx0XHRcdNCt0YLQviBSUEMg0LrQu9C40LXQvdGCLCDRg9C80LXQtdGCINCy0YvQt9GL0LLQsNGC0Ywg0LzQtdGC0L7QtNGLINGC0LXQu9C10L/QvtGA0YLQuNGA0L7QstCw0L3QvdGL0YUg0L7QsdGK0LXQutGC0L7QsiDQuCDQv9C+0LvRg9GH0LDRgtGMINGB0L7QsdC40YLQuNGPINC40LzQuCDQstGL0LHRgNCw0YHRi9Cy0LDQtdC80YvQtS4gXG5cdFx0XHTQotCw0LrQttC1INGD0LzQtdC10YIg0LLQvtGB0YHRgtCw0L3QsNCy0LvQuNCy0LDRgtGMINGB0L7QtdC00LjQvdC10L3QuNC1INGBINGB0LXRgNCy0LXRgNC+0Lwg0LIg0YHQu9GD0YfQsNC1INGA0LDQt9GA0YvQstCwINGB0L7QtdC00LjQvdC10L3QuNGPLlxuXG5cdFx0XHTQmtC+0L3RgdGC0YDRg9C60YLQvtGAINC60LvQsNGB0YHQsCBUZWxlcG9ydENsaWVudCwg0L/RgNC40L3QuNC80LDQtdGCINC10LTQuNC90YHRgtCy0LXQvdC90YvQvCDQv9Cw0YDQsNC80LXRgtGA0L7QvCDQvtCx0YrQtdC60YIg0YEg0L7Qv9GG0LjRj9C80LgsXG5cdFx0XHTQstC+0LfQstGA0LDRidCw0LXRgiDQvdC+0LLRi9C5INC90LXQuNC90LXRhtC40LDQu9C40LfQuNGA0L7QstCw0L3QvdGL0Lkg0L7QsdGK0LXQutGCINC60LvQsNGB0YHQsCBUZWxlcG9ydENsaWVudFxuXHRcdFx0XG5cdFx0XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXHRcdFx0b3B0aW9ucyA9IHtcblx0XHRcdFx0c2VydmVyQWRkcmVzczogXCJ3czovL2xvY2FsaG9zdDo4MDAwXCIsXG5cdFx0XHRcdGF1dG9SZWNvbm5lY3Q6IDMwMDBcblx0XHRcdH1cblxuXHRcdFx0c2VydmVyQWRkcmVzcyAtINCw0LTRgNC10YEgVGVsZXBvcnRTZXJ2ZXJcblx0XHRcdFx0ZGVmYXVsdDogXCJ3czovL2xvY2FsaG9zdDo4MDAwXCJcblxuXHRcdFx0YXV0b1JlY29ubmVjdCAtINCy0YDQtdC80Y8g0LfQsNC00LXRgNC20LrQuCDQv9C10YDQtdC0INC/0L7Qv9GL0YLQutC+0Lkg0L/QtdGA0LXQv9C+0LTQutC70Y7Rh9C90LjRjyDQuiDRgdC10YDQstC10YDRgy5cblx0XHRcdFx00LXRgdC70Lgg0YfQuNGB0LvQviAtINGC0L4g0Y3RgtC+INCy0YDQtdC80Y8g0LfQsNC00LXRgNC20LrQuCDQsiDQvNC40LvQu9C10YHQtdC60YPQvdC00LDRhVxuXHRcdFx0XHTQtdGB0LvQuCBmYWxzZSAtINGC0L4g0L/QtdGA0LXQv9C+0LTQutC70Y7Rh9C10L3QuNGPINC90LUg0LHRg9C00LXRgiDQstGL0L/QvtC70L3QtdC90L3Qvi5cblx0XHRcdFx0ZGVmYXVsdDogMzAwMCBtc2VjXG5cblx0XHRcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblx0XHRcdNGE0L7RgNC80LDRgiDQuNC90LjRhtC40LDQu9C40YDRg9C10LzRi9GFINC/0L7Qu9C10Lk6XG5cblx0XHRcdNCc0LDRgdGB0LjQsiDRgSDQutCw0LvQsdC10LrQsNC80Lgg0LTQu9GPINCy0YvQt9Cy0LDQvdC90YvRhSDRgtC10LvQtdC/0L7RgNGC0LjRgNC+0LLQsNC90L3Ri9GFINC80LXRgtC+0LTQvtCyLlxuXHRcdFx00LIg0LrQsNC20LTQvtC8INGB0L7QvtCx0YnQtdC90LjQtSDRg9GF0L7QtNGP0YnQtdC8INC90LAg0YHQtdGA0LLQtdGAINC10YHRgtGMINC/0L7Qu9C1IHJlcXVlc3RJZCwg0LfQvdCw0YfQtdC90LjQtSDQsiDRjdGC0L7QvCDQv9C+0LvQtSDRjdGC0L4g0LjQvdC00LXQutGBINC60LDQu9C70LHQtdC60LAg0LIg0Y3RgtC+0Lwg0LzQsNGB0YHQuNCy0LU6XG5cdFx0XHRcblx0XHRcdFx0dGhpcy5fdmFsdWVSZXF1ZXN0cyA9IFtcblx0XHRcdFx0XHQxOiBzb21lQ2FsbGJhY2ssXG5cdFx0XHRcdFx0Mjogc2Vjb25kQ2FsbGJhY2tcblx0XHRcdFx0XVxuXHRcdFx0XG5cdFx0XHTQntCx0YrQtdC60YIg0YHQvtC00LXRgNC20LDRidC40Lkg0YHQstC+0LnRgdGC0LLQsCDRgtC10LvQtdC/0L7RgNGC0LjRgNGD0LXQvNGL0YUg0L7QsdGK0LXQutGC0L7Qsiwg0LrQvtGC0L7RgNGL0LUg0L/RgNC+0LjQvdC40YbQuNCw0LvQuNC30LjRgNGD0Y7RgiDQvtCx0YrQtdC60YLRiyDQsiB0aGlzLm9iamVjdHNcblx0XHRcdNCf0L7Qu9GD0YfQsNGOINC/0YDQuCDQv9C10YDQstC+0Lwg0YPRgdC/0LXRiNC90L7QvCDRgdC+0LXQtNC40L3QtdC90LjQuCDRgSDRgdC10YDQstC10YDQvtC8LlxuXG5cdFx0XHTQldGB0LvQuCDQv9GA0L7QuNC30L7QudC00LXRgiDRgNCw0LfRitC10LTQuNC90LXQvdC40LUg0YEg0YHQtdGA0LLQtdGA0L7QvCDQv9C+INC/0YDQuNGH0LjQvdC1INCz0YDRg9GB0YLQvdGL0YUg0LjQvdGC0LXRgNC90LXRgtC+0LIsINGC0L4g0L/QtdGA0LXQt9Cw0L/RgNCw0YjQuNCy0LDRgtGMINC10LPQviDQvdC10YIg0YHQvNGL0YHQu9CwLCDQv9C+0YLQvtC80YMg0YfRgtC+INC90LAg0YHQtdGA0LLQtdGA0LUg0L3QuNGH0LXQs9C+INC90LUg0L/QvtC80LXQvdGP0LvQvtGB0YwuXG5cdFx0XHTQldGB0LvQuCDQttC1INGA0LDQt9GK0LXQtNC40L3QuNC70L4g0L/QvtGC0L7QvNGDINGH0YLQviDRgdC10YDQstC10YAg0LHRi9C7INC/0LXRgNC10LfQsNC/0YPRidC10L3QvSwg0YLQviDRgdCy0L7QudGB0YLQstCwINGC0LXQu9C10L/QvtGA0YLQuNGA0YPQtdC80LzRi9GFINC+0LHRitC10LrRgtC+0LIg0LHRg9C00YPRgiDQv9C10YDQtdC30LDQv9GA0L7RiNC10L3QvdGLLlxuXHRcdFx0XHQqINCV0YHQu9C4INC+0L3QuCDQvdC1INC40LfQvNC10L3QuNC70LjRgdGMLCDRgtC+INGA0LDQsdC+0YLQsCDQsdGD0LTQtdGCINC/0YDQvtC00L7Qu9C20LXQvdC90LAuXG5cdFx0XHRcdCog0JjQu9C4INC40LfQvNC10L3QuNC70LjRgdGMLCDRgtC+INCx0YPQtNC10YIg0LLRi9Cx0YDQvtGI0LXQvdC90L4g0YHQvtCx0YvRgtC40LUgYHNlcnZlck9iamVjdHNDaGFuZ2VkYCBcblx0XHRcdFx0ICog0Lgg0Y8g0LHRiyDQvdCwINC80LXRgdGC0LUg0YHQu9C+0LLQuNCy0YjQtdCz0L4g0LXQs9C+INC/0YDQvtCz0YDQsNC80LzQuNGB0YLQsCDQstGL0LLRi9C10Lsg0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GOINC/0YDQtdC00LvQvtC20LXQvdC40LUg0L/QtdGA0LXQt9Cw0LPRgNGD0LfQuNGC0Ywg0YHRgtGA0LDQvdC40YbRgy5cblx0XHRcdFx0ICAg0J/QvtGC0L7QvNGDINGH0YLQviDQuNC30LzQtdC90LXQvdC40LUg0L3QsNCx0L7RgNCwINGB0LXRgNCy0LXRgNC90YvRhSDQvtCx0YrQtdC60YLQvtCyINC90LXQvNC40L3Rg9C10LzQviAo0L7QsdGL0YfQvdC+KSDQstC70LXRh9C10YIg0LjQt9C80LXQvdC10L3QuNC1INC60LvQuNC10L3RgtGB0LrQvtCz0L4g0YHRhtC10L3QsNGA0LjRjywg0Lgg0YfRgtC+0LHRiyDQtdCz0L4g0L7QsdC90L7QstC40YLRjFxuXHRcdFx0XHQgICDQvdGD0LbQvdC+INC+0LHQvdC+0LLQuNGC0Ywg0YHRgtGA0LDQvdC40YfQutGDICjQvdCw0YHQutC+0LvRjNC60L4g0LzQvdC1INC40LfQstC10YHRgtC90L4g0L3QsNCz0L7RgNGP0YfRg9GOIGpzINGB0LrRgNC40L/RgtGLINC/0L7QtNC80LXQvdGP0YLRjCDQvdC10LvRjNC30Y8pLlxuXHRcdFx0XHQgKiDQotCw0LrQttC1INC90LXRgdC80L7RgtGA0Y8g0L3QsCDRgtC+INGH0YLQviDQsdGL0LvQuCDQv9C+0LvRg9GH0LXQvdC90Ysg0L3QvtCy0YvQtSDRgdCy0L7QudGB0YLQstCwLFxuXHRcdFx0XHQgICDQvtC90Lgg0L3QtSDQsdGD0LTRg9GCINC/0L7QvNC10YnQtdC90L3RiyDQsiB0aGlzLl92YWx1ZVNlcnZlck9iamVjdHNQcm9wcyDQuCB0aGlzLm9iamVjdHMg0L3QtSDQsdGD0LTQtdGCINC40LfQvNC10L3QtdC90L0uXG5cdFx0XHRcdCAgINC40LfQvNC10L3QuNGC0YzRgdGPINGC0L7Qu9GM0LrQviDRhNC70LDQsyB0aGlzLmlzU2VydmVyT2JqZWN0Q2hhbmdlZCA9IHRydWU7XG5cblx0XHRcdFx0dGhpcy5fdmFsdWVTZXJ2ZXJPYmplY3RzUHJvcHMgPSB7XG5cdFx0XHRcdFx0J3NvbWVTZXJ2ZXJPYmplY3ROYW1lJzoge1xuXHRcdFx0XHRcdFx0ZXZlbnRzOiBbJ2ZpcnN0UGVybWl0ZWRFdmVudE5hbWUnLCAnc2Vjb25kUGVybWl0ZWRFdmVudE5hbWUnXSxcblx0XHRcdFx0XHRcdG1ldGhvZHM6IFsnZmlyc3RNZXRob2ROYW1lJywgJ3NlY29uZE1ldGhvZE5hbWUnXVxuXHRcdFx0XHRcdH0sIC4uLlxuXHRcdFx0XHR9XG5cblx0XHRcdNCe0LHRitC10LrRgiDRgdC+0LTQtdGA0LbQsNGJ0LjQuSDQsiDRgdC10LHQtSDQv9GA0L7QuNC90LjRhtC40LDQu9C40LfQuNGA0L7QstCw0L3QvdGL0LUg0YLQtdC70LXQv9C+0YDRgtC40YDQvtCy0LDQvdC90YvQtSDQvtCx0YrQtdC60YLRiy5cblx0XHRcdNCjINC90LjRhSDQtdGB0YLRjCDQvdC10YHQutC+0LvRjNC60L4g0YHQu9GD0LbQtdCx0L3Ri9GFINC/0L7Qu9C10Lkg0Lgg0LzQtdGC0L7QtNGLINGD0L3QsNGB0LvQtdC00L7QstCw0L3QvdGL0LUg0L7RgiDQutC70LDRgdGB0LAgRXZlbnRFbWV0dGVyLlxuXHRcdFx0XG5cdFx0XHTQnNC10YLQvtC00Ysg0YHQvtC30LTQsNCy0LDQtdC80YvQtSDQstC90YPRgtGA0Lgg0YLQtdC70LXQv9C+0YDRgtC40YDQvtCy0LDQvdC90L7Qs9C+INC+0LHRitC10LrRgtCwINGA0LDQt9Cx0LjRgNCw0Y7RgiDQv9GA0LjRhdC+0LTRj9GJ0LjQuSDQv9GB0LXQstC00L7QvNCw0YHRgdC40LIgYXJndW1lbnRzIFxuXHRcdFx00LLRi9C00LXQu9GP0Y7RgiDQuNC3INC90LXQs9C+INCw0YDQs9GD0LzQtdC90YLRiyDQtNC70Y8g0LzQtdGC0L7QtNCwINC4INC60LDQu9Cx0LXQuiAo0LXRgdC70Lgg0LrQsNC70LHQtdC60LAg0L3QtdGCLCDRgtC+INGB0L7Qt9C00LDQtdGC0YHRjyDQt9Cw0LPQu9GD0YjQutCwKVxuXHRcdFx00LfQsNC/0YDQvtGB0YMg0L/RgNC40YHQstCw0LXQstCw0YLQtdGB0Y8gcmVxdWVzdElkLCDQutCw0LvQu9Cx0LXQuiDQv9C+0LQg0Y3RgtC40LwgaWQg0L/QvtC80LXRidCw0LXRgtGB0Y8g0LIgdGhpcy5fdmFsdWVSZXF1ZXN0c1xuXHRcdFx00Lgg0LfQsNC/0YDQvtGBINC+0YLQv9GA0LDQstC70Y/QtdGC0YHRjyDQvdCwINGB0LXRgNCy0LXRgC5cblxuXHRcdFx0dGhpcy5vYmplY3RzID0ge1xuXHRcdFx0XHQnc29tZVNlcnZlck9iamVjdE5hbWUnOiB7XG5cdFx0XHRcdFx0X19ldmVudHNfXzogWydmaXJzdFBlcm1pdGVkRXZlbnROYW1lJywgJ3NlY29uZFBlcm1pdGVkRXZlbnROYW1lJ10sXG5cdFx0XHRcdFx0X19tZXRob2RzX186IFsnZmlyc3RNZXRob2ROYW1lJywgJ3NlY29uZE1ldGhvZE5hbWUnXSxcblx0XHRcdFx0XHRmaXJzdE1ldGhvZE5hbWU6IGZ1bmN0aW9uKGFyZ3MsIHNlY29uZEFyZywgY2FsbGJhY2spIHsuLi59LFxuXHRcdFx0XHRcdHNlY29uZE1ldGhvZE5hbWU6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7Li4ufSxcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0Ki9cblx0XHRmdW5jdGlvbiBUZWxlcG9ydENsaWVudChvcHRpb25zKSB7XG5cdFx0XHQvL29wdGlvbnNcblx0XHRcdHRoaXMuX29wdGlvbldzU2VydmVyQWRkcmVzcyA9IG9wdGlvbnMuc2VydmVyQWRkcmVzcyB8fCBcIndzOi8vbG9jYWxob3N0OjgwMDBcIjtcblx0XHRcdHRoaXMuX29wdGlvbkF1dG9SZWNvbm5lY3QgPSAob3B0aW9ucy5hdXRvUmVjb25uZWN0ID09PSB1bmRlZmluZWQpID8gMzAwMCA6IG9wdGlvbnMuYXV0b1JlY29ubmVjdDtcblxuXHRcdFx0Ly9lbmQgb3B0aW9uc1xuXG5cdFx0XHQvL3ByaXZhdGVcblx0XHRcdHRoaXMuX3ZhbHVlV3NDbGllbnQgPSBudWxsO1xuXHRcdFx0dGhpcy5fdmFsdWVSZXF1ZXN0cyA9IFtdO1xuXHRcdFx0dGhpcy5fdmFsdWVJbnRlcm5hbFJlcXVlc3RzID0gW107XG5cblx0XHRcdHRoaXMuX3ZhbHVlU2VydmVyT2JqZWN0c1Byb3BzID0gbnVsbDtcblx0XHRcdHRoaXMuX3ZhbHVlSXNJbml0ID0gZmFsc2U7XG5cblx0XHRcdHRoaXMuX3ZhbHVlUGVlcklkID0gbnVsbDtcblx0XHRcdHRoaXMuX3ZhbHVlUGVlclRpbWVzdGFtcCA9IG51bGw7XG5cblx0XHRcdHRoaXMuX3ZhbHVlU2VydmVyVGltZXN0YW1wID0gbnVsbDtcblx0XHRcdHRoaXMuX3ZhbHVlSXNSZWFkeUVtaXRlZCA9IGZhbHNlO1xuXG5cdFx0XHQvL2VuZCBwcml2YXRlXG5cblx0XHRcdC8vcHVibGljXG5cdFx0XHR0aGlzLm9iamVjdHMgPSB7fTtcblx0XHRcdHRoaXMuaXNTZXJ2ZXJPYmplY3RDaGFuZ2VkID0gZmFsc2U7XG5cblx0XHRcdC8vZW5kIHB1YmxpY1xuXHRcdH1cblxuXHRcdC8vcHVibGljXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbigpIHtcblx0XHRcdGlmICghdGhpcy5fdmFsdWVJc0luaXQpIHtcblx0XHRcdFx0dGhpcy5fdmFsdWVQZWVyVGltZXN0YW1wID0gbmV3IERhdGUoKTtcblx0XHRcdFx0dGhpcy5fZnVuY1dzSW5pdCgpO1xuXG5cdFx0XHRcdHRoaXMuX3ZhbHVlSXNJbml0ID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdFx00JzQtdGC0L7QtCDQtNC10YHRgtGA0YPQutGC0L7QsiDQt9Cw0LrRgNGL0LLQsNC10YIg0YHQvtC10LTQuNC90LXQvdC40LUg0YEg0YHQtdGA0LLQtdGA0L7QvCwg0LLRi9C30YvQstCw0LXRgiDQstGB0LUg0L7QttC40LTQsNGO0YnQuNC1INGA0LXQt9GD0LvRjNGC0LDRgiDQutCw0LvQtdC60Lgg0YEg0L7RiNC40LHQutC+0LkuXG5cdFx0XHTQvtGH0LjRidCw0LXRgiDQvdC10YHQutC+0LvRjNC60L4g0YHQu9GD0LbQtdCx0L3Ri9GFINC/0L7Qu9C10Lkg0Lgg0L3QsNC60L7QvdC10YYg0LLRi9Cx0YDQsNGB0YvQstCw0LXRgiBgZGVzdHJveWVkYFxuXG5cdFx0Ki9cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKHRoaXMuX3ZhbHVlSXNJbml0KSB7XG5cdFx0XHRcdHRoaXMuZW1pdCgnaW5mbycsIHtcblx0XHRcdFx0XHRkZXNjOiAnW1RlbGVwb3J0Q2xpZW50XSBJbmZvOiDQoNCw0LHQvtGC0LAg0LrQu9C40LXQvdGC0LAg0YjRgtCw0YLQvdC+INC/0YDQtdC60YDQsNGJ0LXQvdCwLCDQvdCwINCy0YHQtSDQutCw0LvQsdC10LrQuCDQsdGD0LTQtdGCINCy0L7Qt9Cy0YDQsNGJ0LXQvdCwINC+0YjQuNCx0LrQsCwg0YHQvtC10LTQuNC90LXQvdC40LUg0YEg0YHQtdGA0LLQtdGA0L7QvCDQsdGD0LTQtdGCINC30LDQutGA0YvRgtC+Lidcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGhpcy5fZnVuY0Nsb3NlQWxsUmVxdWVzdHMoKTtcblxuXHRcdFx0XHR0aGlzLm9iamVjdHMgPSB7fTtcblx0XHRcdFx0dGhpcy5fdmFsdWVTZXJ2ZXJPYmplY3RzUHJvcHMgPSB7fTtcblx0XHRcdFx0dGhpcy5fdmFsdWVJc0luaXQgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy5fdmFsdWVQZWVySWQgPSBudWxsO1xuXHRcdFx0XHR0aGlzLl92YWx1ZVNlcnZlclRpbWVzdGFtcCA9IG51bGw7XG5cdFx0XHRcdHRoaXMuX3ZhbHVlUGVlclRpbWVzdGFtcCA9IG51bGw7XG5cdFx0XHRcdHRoaXMuX3ZhbHVlSXNSZWFkeUVtaXRlZCA9IGZhbHNlO1xuXG5cdFx0XHRcdHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdfX3JlY29ubmVjdGVkVG9PbGRTZXJ2ZXJfXycpO1xuXHRcdFx0XHR0aGlzLnJlbW92ZUFsbExpc3RlbmVycygnX19yZWNvbm5lY3RlZFRvTmV3U2VydmVyX18nKTtcblxuXHRcdFx0XHRpZiAodGhpcy5fdmFsdWVXc0NsaWVudCkge1xuXHRcdFx0XHRcdHRoaXMuX2Z1bmNXc0Nsb3NlKCk7XG5cdFx0XHRcdFx0dGhpcy5lbWl0KCdjbG9zZScpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5lbWl0KCdkZXN0cm95ZWQnKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblxuXHRcdC8vZW5kIHB1YmxpY1xuXG5cdFx0Ly9wcml2YXRlXG5cdFx0Ly93cyBjbGllbnRcblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNXc0luaXQgPSBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuX3ZhbHVlV3NDbGllbnQgPSBuZXcgV2ViU29ja2V0KHRoaXMuX29wdGlvbldzU2VydmVyQWRkcmVzcyk7XG5cblx0XHRcdC8vb25tZXNzYWdlXG5cdFx0XHR0aGlzLl92YWx1ZVdzQ2xpZW50Lm9ubWVzc2FnZSA9IHRoaXMuX2Z1bmNXc09uTWVzc2FnZS5iaW5kKHRoaXMpO1xuXG5cdFx0XHQvL29ub3BlblxuXHRcdFx0dGhpcy5fdmFsdWVXc0NsaWVudC5vbm9wZW4gPSAoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMuZW1pdCgnaW5mbycsIHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gSW5mbzog0YHQvtC10LTQuNC90LXQvdC40LUg0YEg0YHQtdGA0LLQtdGA0L7QvCDRg9GB0YLQsNC90L7QstC70LXQvdC90L5cIlxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxHZXRTZXJ2ZXJUaW1lc3RhbXAoXG5cdFx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsSGFuZGxlckdldFRpbWVzdGFtcC5iaW5kKHRoaXMpKTtcblx0XHRcdH0uYmluZCh0aGlzKSk7XG5cblx0XHRcdC8vb25lcnJvclxuXHRcdFx0dGhpcy5fdmFsdWVXc0NsaWVudC5vbmVycm9yID0gKGZ1bmN0aW9uKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMuZW1pdChcImVycm9yXCIsIHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRXJyb3I6IFdlYlNvY2tldCBDbGllbnQg0LLRi9Cx0YDQvtGB0LjQuyDQvtGI0LjQsdC60YM6IFwiICsgZXJyb3IsXG5cdFx0XHRcdFx0ZXJyb3I6IGVycm9yXG5cdFx0XHRcdH0pO1xuXHRcdFx0fS5iaW5kKHRoaXMpKTtcblxuXHRcdFx0Ly9vbmNsb3NlXG5cdFx0XHR0aGlzLl92YWx1ZVdzQ2xpZW50Lm9uY2xvc2UgPSAoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMuZW1pdCgnd2FybicsIHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gV2Fybjog0KHQvtC10LTQuNC90LXQvdC40LUg0YEg0YHQtdGA0LLQtdGA0L7QvCDQv9C+0YLQtdGA0Y/QvdC90L4uXCJcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0aWYgKHRoaXMuX29wdGlvbkF1dG9SZWNvbm5lY3QgIT09IGZhbHNlKSB0aGlzLl9mdW5jV3NSZWNvbm5lY3QoKTtcblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fZnVuY1dzQ2xvc2UoKTtcblx0XHRcdFx0XHR0aGlzLmVtaXQoJ2Nsb3NlJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0uYmluZCh0aGlzKSk7XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY1dzT25NZXNzYWdlID0gZnVuY3Rpb24oc291cmNlTWVzc2FnZSkge1xuXHRcdFx0dmFyIG1lc3NhZ2UgPSBKU09OLnBhcnNlKHNvdXJjZU1lc3NhZ2UuZGF0YSk7XG5cblx0XHRcdGlmIChtZXNzYWdlLnR5cGUgPT0gXCJjYWxsYmFja1wiKSB7XG5cdFx0XHRcdHRoaXMuX2Z1bmNDYWxsYmFja0hhbmRsZXIobWVzc2FnZSk7XG5cdFx0XHR9IGVsc2UgaWYgKG1lc3NhZ2UudHlwZSA9PSBcImludGVybmFsQ2FsbGJhY2tcIikge1xuXHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxDYWxsYmFja0hhbmRsZXIobWVzc2FnZSk7XG5cdFx0XHR9IGVsc2UgaWYgKG1lc3NhZ2UudHlwZSA9PSBcImV2ZW50XCIpIHtcblx0XHRcdFx0dGhpcy5fZnVuY0V2ZW50SGFuZGxlcihtZXNzYWdlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHZhciBlcnJvckluZm8gPSB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIFdhcm46INC00LvRjyDQtNCw0L3QvdC+0LPQviDRgtC40L/QsCDRgdC+0L7QsdGJ0LXQvdC40Lkg0L3QtdGCINGF0Y3QvdC00LvQtdGA0LA6IFwiICsgbWVzc2FnZS50eXBlLFxuXHRcdFx0XHRcdG1lc3NhZ2U6IG1lc3NhZ2Vcblx0XHRcdFx0fTtcblxuXHRcdFx0XHR0aGlzLmVtaXQoXCJ3YXJuXCIsIGVycm9ySW5mbyk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY1dzUmVjb25uZWN0ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVtaXQoJ2luZm8nLCB7XG5cdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBJbmZvOiDQkdGD0LTQtdGCINCy0YvQv9C+0LvQvdC10L3QvdC+INC/0LXRgNC10L/QvtC00LrQu9GO0YfQtdC90LjQtSDQuiDRgdC10YDQstC10YDRgy5cIixcblx0XHRcdFx0ZGVsYXk6IHRoaXMuX29wdGlvbkF1dG9SZWNvbm5lY3Rcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAodGhpcy5fdmFsdWVXc0NsaWVudCkgdGhpcy5fZnVuY1dzQ2xvc2UoKTtcblx0XHRcdHRoaXMuZW1pdCgncmVjb25uZWN0aW5nJyk7XG5cblx0XHRcdHNldFRpbWVvdXQodGhpcy5fZnVuY1dzSW5pdC5iaW5kKHRoaXMpLCB0aGlzLl9vcHRpb25BdXRvUmVjb25uZWN0KTtcblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jV3NDbG9zZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5fdmFsdWVXc0NsaWVudC5vbm1lc3NhZ2UgPSBmdW5jdGlvbigpIHt9O1xuXHRcdFx0dGhpcy5fdmFsdWVXc0NsaWVudC5vbm9wZW4gPSBmdW5jdGlvbigpIHt9O1xuXHRcdFx0dGhpcy5fdmFsdWVXc0NsaWVudC5vbmNsb3NlID0gZnVuY3Rpb24oKSB7fTtcblx0XHRcdHRoaXMuX3ZhbHVlV3NDbGllbnQub25lcnJvciA9IGZ1bmN0aW9uKCkge307XG5cblx0XHRcdHRoaXMuX3ZhbHVlV3NDbGllbnQuY2xvc2UoKTtcblxuXHRcdFx0dGhpcy5fdmFsdWVXc0NsaWVudCA9IG51bGw7XG5cdFx0fTtcblxuXHRcdC8vZW5kIHdzIGNsaWVudFxuXG5cdFx0Ly9jbG9zZSBhbGwgY2FsbGJhY2tzXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jQ2xvc2VBbGxSZXF1ZXN0cyA9IGZ1bmN0aW9uKGlzSW5pdEVycm9yKSB7XG5cdFx0XHR2YXIgZXJyb3JJbmZvID0gKGlzSW5pdEVycm9yKSA/IFwiW1RlbGVwb3J0Q2xpZW50XSBFcnJvcjog0J/RgNC+0LjQt9C+0YjQu9CwINC+0YjQuNCx0LrQsCDQv9GA0Lgg0YDQtdCz0LjRgdGC0YDQsNGG0LjRjyDQutC70LjQtdC90YLQsCDQvdCwINGB0LXRgNCy0LXRgNC1LCDQv9C+0Y3RgtC+0LzRgyDRgNC10LfRg9C70YzRgtCw0YIg0LLRi9C/0L7Qu9C90LXQvdC40Y8g0LrQvtC80LDQvdC00Ysg0L3QuNC60L7Qs9C00LAg0L3QtSDQsdGD0LTQtdGCINCy0L7Qt9Cy0YDQsNGJ0LXQvdC9LlwiIDpcblx0XHRcdFx0XCJbVGVsZXBvcnRDbGllbnRdIEVycm9yOiDQodC+0LXQtNC40L3QtdC90LjQtSDRgSDRgdC10YDQstC10YDQvtC8INCy0L7RgdGC0LDQvdC+0LLQu9C10L3QvdC+LCDQvdC+INGN0YLQviDQvdC+0LLRi9C5INGN0LrQt9C10LzQv9C70Y/RgCDRgdC10YDQstC10YDQsCwg0L/QvtGN0YLQvtC80YMg0YDQtdC30YPQu9GM0YLQsNGCINCy0YvQv9C+0LvQvdC10L3QuNGPINC60L7QvNCw0L3QtNGLINC90LjQutC+0LPQtNCwINC90LUg0LHRg9C00LXRgiDQstC+0LfQstGA0LDRidC10L3QvS5cIjtcblxuXHRcdFx0d2hpbGUgKHRoaXMuX3ZhbHVlUmVxdWVzdHMubGVuZ3RoKSB7XG5cdFx0XHRcdHZhciBjYWxsYmFjayA9IHRoaXMuX3ZhbHVlUmVxdWVzdHMuc2hpZnQoKTtcblx0XHRcdFx0aWYgKGNhbGxiYWNrKSBjYWxsYmFjayh7XG5cdFx0XHRcdFx0ZGVzYzogZXJyb3JJbmZvXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvL2VuZCBjbG9zZSBhbGwgY2FsbGJhY2tzXG5cblx0XHQvL2Nvbm5jdGlvbiBpbml0XG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jSW50ZXJuYWxHZXRTZXJ2ZXJUaW1lc3RhbXAgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQvtGC0L/RgNCw0LLQuNC7INC30LDQv9GA0L7RgSDQvdCwINC/0L7Qu9GD0YfQtdC90LjQtSB0aW1lc3RhbXAuXCJcblx0XHRcdH0pXG5cblx0XHRcdHRoaXMuX2Z1bmNTZW5kSW50ZXJuYWxDb21tYW5kKHtcblx0XHRcdFx0dHlwZTogXCJpbnRlcm5hbENvbW1hbmRcIixcblx0XHRcdFx0aW50ZXJuYWxDb21tYW5kOiBcImdldFRpbWVzdGFtcFwiLFxuXHRcdFx0fSwgY2FsbGJhY2spO1xuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNJbnRlcm5hbEdldFBlZXJJZCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INC+0YLQv9GA0LDQstC40Lsg0LfQsNC/0YDQvtGBINC90LAg0L/QvtC70YPRh9C10L3QuNC1IHBlZXJJZC5cIixcblx0XHRcdFx0dGltZXN0YW1wOiB0aGlzLl92YWx1ZVBlZXJUaW1lc3RhbXBcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLl9mdW5jU2VuZEludGVybmFsQ29tbWFuZCh7XG5cdFx0XHRcdHR5cGU6IFwiaW50ZXJuYWxDb21tYW5kXCIsXG5cdFx0XHRcdGludGVybmFsQ29tbWFuZDogXCJnZXRQZWVySWRcIixcblx0XHRcdFx0YXJnczoge1xuXHRcdFx0XHRcdHRpbWVzdGFtcDogdGhpcy5fdmFsdWVQZWVyVGltZXN0YW1wXG5cdFx0XHRcdH1cblx0XHRcdH0sIGNhbGxiYWNrKTtcblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jSW50ZXJuYWxTZXRQZWVySWQgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQvtGC0L/RgNCw0LLQuNC7INC30LDQv9GA0L7RgSDQvdCwINC/0L7QtNGC0LLQtdGA0LbQtdC90LjQtSDRg9C20LUg0YHRg9GJ0LXRgdGC0LLRg9GO0YnQtdCz0L4gcGVlcklkLlwiLFxuXHRcdFx0XHR0aW1lc3RhbXA6IHRoaXMuX3ZhbHVlUGVlclRpbWVzdGFtcCxcblx0XHRcdFx0cGVlcklkOiB0aGlzLl92YWx1ZVBlZXJJZFxuXHRcdFx0fSlcblxuXHRcdFx0dGhpcy5fZnVuY1NlbmRJbnRlcm5hbENvbW1hbmQoe1xuXHRcdFx0XHR0eXBlOiBcImludGVybmFsQ29tbWFuZFwiLFxuXHRcdFx0XHRpbnRlcm5hbENvbW1hbmQ6IFwic2V0UGVlcklkXCIsXG5cdFx0XHRcdGFyZ3M6IHtcblx0XHRcdFx0XHR0aW1lc3RhbXA6IHRoaXMuX3ZhbHVlUGVlclRpbWVzdGFtcCxcblx0XHRcdFx0XHRwZWVySWQ6IHRoaXMuX3ZhbHVlUGVlcklkXG5cdFx0XHRcdH1cblx0XHRcdH0sIGNhbGxiYWNrKTtcblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jSW50ZXJuYWxHZXRPYmplY3RzUHJvcHMgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQvtGC0L/RgNCw0LLQuNC7INC30LDQv9GA0L7RgSDQvdCwINC/0L7Qu9GD0YfQtdC90LjQtSDRgdCy0L7QudGB0YLQsiDRgdC10YDQstC10YDQvdGL0YUg0L7QsdGK0LXQutGC0L7Qsi5cIixcblx0XHRcdFx0cGVlcklkOiB0aGlzLl92YWx1ZVBlZXJJZFxuXHRcdFx0fSlcblxuXHRcdFx0dGhpcy5fZnVuY1NlbmRJbnRlcm5hbENvbW1hbmQoe1xuXHRcdFx0XHR0eXBlOiBcImludGVybmFsQ29tbWFuZFwiLFxuXHRcdFx0XHRpbnRlcm5hbENvbW1hbmQ6IFwiZ2V0T2JqZWN0c1wiLFxuXHRcdFx0XHRhcmdzOiB7XG5cdFx0XHRcdFx0cGVlcklkOiB0aGlzLl92YWx1ZVBlZXJJZFxuXHRcdFx0XHR9XG5cdFx0XHR9LCBjYWxsYmFjayk7XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY0ludGVybmFsQ29ubmVjdGVkID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0L7RgtC/0YDQsNCy0LjQuyDQv9C+0LTRgtCy0LXRgNC20LTQtdC90LjQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQv9C+0LTQutC70Y7Rh9C10L3QuNGPLlwiLFxuXHRcdFx0XHRwZWVySWQ6IHRoaXMuX3ZhbHVlUGVlcklkXG5cdFx0XHR9KVxuXG5cdFx0XHR0aGlzLl9mdW5jU2VuZEludGVybmFsQ29tbWFuZCh7XG5cdFx0XHRcdHR5cGU6IFwiaW50ZXJuYWxDb21tYW5kXCIsXG5cdFx0XHRcdGludGVybmFsQ29tbWFuZDogXCJjb25uZWN0aW9u0KFvbXBsZXRlZFwiLFxuXHRcdFx0XHRhcmdzOiB7XG5cdFx0XHRcdFx0cGVlcklkOiB0aGlzLl92YWx1ZVBlZXJJZFxuXHRcdFx0XHR9XG5cdFx0XHR9LCBjYWxsYmFjayk7XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY0ludGVybmFsUmVjb25uZWN0ZWQgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQvtGC0L/RgNCw0LLQuNC7INC/0L7QtNGC0LLQtdGA0LbQtNC10L3QuNC1INC30LDQstC10YDRiNC10L3QuNGPINC/0LXRgNC10L/QvtC00LrQu9GO0YfQtdC90LjRjy5cIixcblx0XHRcdFx0cGVlcklkOiB0aGlzLl92YWx1ZVBlZXJJZFxuXHRcdFx0fSlcblxuXHRcdFx0dGhpcy5fZnVuY1NlbmRJbnRlcm5hbENvbW1hbmQoe1xuXHRcdFx0XHR0eXBlOiBcImludGVybmFsQ29tbWFuZFwiLFxuXHRcdFx0XHRpbnRlcm5hbENvbW1hbmQ6IFwicmVjb25uZWN0aW9uQ29tcGxldGVkXCIsXG5cdFx0XHRcdGFyZ3M6IHtcblx0XHRcdFx0XHRwZWVySWQ6IHRoaXMuX3ZhbHVlUGVlcklkXG5cdFx0XHRcdH1cblx0XHRcdH0sIGNhbGxiYWNrKTtcblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jU2VuZEludGVybmFsQ29tbWFuZCA9IGZ1bmN0aW9uKG1lc3NhZ2UsIGNhbGxiYWNrKSB7XG5cdFx0XHRpZiAoY2FsbGJhY2spIHtcblx0XHRcdFx0bWVzc2FnZS5pbnRlcm5hbFJlcXVlc3RJZCA9IHRoaXMuX3ZhbHVlSW50ZXJuYWxSZXF1ZXN0cy5sZW5ndGg7XG5cdFx0XHRcdHRoaXMuX3ZhbHVlSW50ZXJuYWxSZXF1ZXN0cy5wdXNoKGNhbGxiYWNrKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fZnVuY1dzU2VuZE1lc3NhZ2UobWVzc2FnZSk7XG5cdFx0fTtcblxuXHRcdC8vZW5kIGNvbm5jdGlvbiBpbml0XG5cblx0XHQvKipcblx0XHRcdNGF0Y3QvdC00LvQtdGAINC00LvRjyDQvtGC0LLQtdGC0L7QsiDQvdCwINGB0LXRgNCy0LjRgdC90YvQtSDQt9Cw0L/RgNC+0YHRiyDQuiDRgdC10YDQstC10YDRg1xuXHRcdFxuXHRcdCovXG5cdFx0Ly9JbnRlcm5hbEhhbmRsZXJcblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNJbnRlcm5hbENhbGxiYWNrSGFuZGxlciA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcblx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0YHQtdGA0LLQtdGAINCy0LXRgNC90YPQuyBpbnRlcm5hbENhbGxiYWNrINC90LA6IFwiICsgbWVzc2FnZS5pbnRlcm5hbENvbW1hbmQsXG5cdFx0XHRcdG1lc3NhZ2U6IG1lc3NhZ2Vcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLl92YWx1ZUludGVybmFsUmVxdWVzdHNbbWVzc2FnZS5pbnRlcm5hbFJlcXVlc3RJZF0obWVzc2FnZS5lcnJvciwgbWVzc2FnZS5yZXN1bHQpO1xuXHRcdFx0ZGVsZXRlIHRoaXMuX3ZhbHVlSW50ZXJuYWxSZXF1ZXN0c1ttZXNzYWdlLmludGVybmFsUmVxdWVzdElkXTtcblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jSW50ZXJuYWxIYW5kbGVyR2V0VGltZXN0YW1wID0gZnVuY3Rpb24oZXJyb3IsIG5ld1NlcnZlclRpbWVzdGFtcCkge1xuXHRcdFx0aWYgKCF0aGlzLl92YWx1ZUlzUmVhZHlFbWl0ZWQpIHtcblx0XHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INCf0L7Qu9GD0YfQtdC90L0gdGltZXN0YW1wLCDRjdGC0L4g0L/QtdGA0LLQvtC1INC/0L7QtNC60LvRjtGH0LXQvdC40LUg0Log0YHQtdGA0LLQtdGA0YMsINC30LDQv9GA0LDRiNC40LLQsNGOIHBlZXJJZC5cIixcblx0XHRcdFx0XHR0aW1lc3RhbXA6IG5ld1NlcnZlclRpbWVzdGFtcFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLl92YWx1ZVNlcnZlclRpbWVzdGFtcCA9IG5ld1NlcnZlclRpbWVzdGFtcDtcblxuXHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxHZXRQZWVySWQoXG5cdFx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsSGFuZGxlckdldFBlZXJJZC5iaW5kKHRoaXMpKTtcblx0XHRcdH0gZWxzZSBpZiAobmV3U2VydmVyVGltZXN0YW1wICE9IHRoaXMuX3ZhbHVlU2VydmVyVGltZXN0YW1wKSB7XG5cdFx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQn9C+0LvRg9GH0LXQvdC90YvQuSB0aW1lc3RhbXAg0L7RgtC70LjRh9Cw0LXRgtGB0Y8g0L7RgiDQv9GA0L7RiNC70L7Qs9C+LCDRgdC10YDQstC10YAg0LHRi9C7INC/0LXRgNC10LfQsNC/0YPRidC10L3QvSwgXCIgK1xuXHRcdFx0XHRcdFx0XCLQt9Cw0L/RgNCw0YjQuNCy0LDRjiDQvdC+0LLRi9C5IHBlZXJJZCwg0L3QsCDQstGB0LUg0LrQsNC70LHQtdC60Lgg0L7QttC40LTQsNGO0YnQuNC1INGA0LXQt9GD0LvRjNGC0LDRgiDQstC+0LfQstGA0LDRidCw0Y4g0L7RiNC40LHQutGDLlwiLFxuXHRcdFx0XHRcdHJlcXVlc3RDb3VudDogdGhpcy5fdmFsdWVSZXF1ZXN0cy5sZW5ndGgsXG5cdFx0XHRcdFx0b2xkVGltZXN0YW1wOiB0aGlzLl92YWx1ZVNlcnZlclRpbWVzdGFtcCxcblx0XHRcdFx0XHRuZXdUaW1lc3RhbXA6IG5ld1NlcnZlclRpbWVzdGFtcCxcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGhpcy5fdmFsdWVTZXJ2ZXJUaW1lc3RhbXAgPSBuZXdTZXJ2ZXJUaW1lc3RhbXA7XG5cdFx0XHRcdHRoaXMuX2Z1bmNDbG9zZUFsbFJlcXVlc3RzKCk7XG5cblx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsR2V0UGVlcklkKFxuXHRcdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbEhhbmRsZXJHZXRQZWVySWQuYmluZCh0aGlzKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0J/QvtC70YPRh9C10L3QvSB0aW1lc3RhbXAsINC+0L0g0YHQvtC+0YLQstC10YLRgdGC0LLRg9C10YIg0YHRgtCw0YDQvtC80YMsINC+0YLQv9GA0LDQstC70Y/RjiDQvdCwINGB0LXRgNCy0LXRgCDRgdCy0L7QuSBwZWVySWQuXCIsXG5cdFx0XHRcdFx0dGltZXN0YW1wOiBuZXdTZXJ2ZXJUaW1lc3RhbXBcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsU2V0UGVlcklkKFxuXHRcdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbEhhbmRsZXJTZXRQZWVySWQuYmluZCh0aGlzKSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY0ludGVybmFsSGFuZGxlckdldFBlZXJJZCA9IGZ1bmN0aW9uKGVycm9yLCBwZWVySWQpIHtcblx0XHRcdGlmICghdGhpcy5fdmFsdWVJc1JlYWR5RW1pdGVkKSB0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INCf0L7Qu9GD0YfQtdC90L0gcGVlcklkLCDQt9Cw0L/RgNCw0YjQuNCy0LDRjiDRgdCy0L7QudGB0YLQstCwINGB0LXRgNCy0LXRgNC90YvRhSDQvtCx0YrQtdC60YLQvtCyLlwiLFxuXHRcdFx0XHRwZWVySWQ6IHBlZXJJZFxuXHRcdFx0fSk7XG5cdFx0XHRlbHNlIHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0J/QvtC70YPRh9C10L3QvSBwZWVySWQsINC/0LXRgNC10L/QvtC00LrQu9GO0YfQtdC90LjQtSDQv9GA0L7QuNC30L7RiNC70L4g0LjQty3Qt9CwINC/0LXRgNC10LfQsNC/0YPRgdC60LAg0YHQtdGA0LLQtdGA0LAgXCIgK1xuXHRcdFx0XHRcdFwi0L/RgNC+0LLQtdGA0Y/RjiDQuNC30LzQtdC90LjQu9C40YHRjCDQu9C4INGB0LLQvtC50YHRgtCy0LAg0YHQtdGA0LLQtdGA0L3Ri9GFINC+0LHRitC10LrRgtC+0LIuINCY0LvQuCDQuNC3LdC30LAg0LjRgdGC0LXRh9C10L3QuNGPINCy0YDQtdC80LXQvdC4INC+0LbQuNC00LDQvdC40Y8g0YHQtdGA0LLQtdGA0L7QvCBcIiArXG5cdFx0XHRcdFx0XCLQv9C10YDQtdC/0L7QtNC60LvRjtGH0LXQvdC40Y8g0Y3RgtC+0LPQviDQutC70LjQtdC90YLQsC5cIixcblx0XHRcdFx0cGVlcklkOiBwZWVySWRcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLl92YWx1ZVBlZXJJZCA9IHBlZXJJZDtcblxuXHRcdFx0dGhpcy5fZnVuY0ludGVybmFsR2V0T2JqZWN0c1Byb3BzKFxuXHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxIYW5kbGVyR2V0T2JqZWN0cy5iaW5kKHRoaXMpKTtcblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jSW50ZXJuYWxIYW5kbGVyU2V0UGVlcklkID0gZnVuY3Rpb24oZXJyb3IpIHtcblx0XHRcdGlmIChlcnJvcikge1xuXHRcdFx0XHR2YXIgZXJyb3JJbmZvID0ge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBFcnJvcjog0J3QtSDRg9C00LDQu9C+0YHRjCDQstC+0YHRgdGC0LDQvdC+0LLQuNGC0Ywg0YHQvtC10LTQuNC90LXQvdC40LUg0YEg0YHQtdGA0LLQtdGA0L7QvCwg0LfQsNC/0YDQvtGBINC90LAg0YPRgdGC0LDQvdC+0LLQutGDIHBlZXJJZCwg0LLQtdGA0L3Rg9C7INC+0YjQuNCx0LrRgy4gXCIgK1xuXHRcdFx0XHRcdFx0XCLQn9C+0L/RgNC+0LHRg9GOINC/0L7Qu9GD0YfQuNGC0Ywg0L3QvtCy0YvQuSBwZWVySWQuXCIsXG5cdFx0XHRcdFx0ZXJyb3I6IGVycm9yXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0dGhpcy5lbWl0KFwiZXJyb3JcIiwgZXJyb3JJbmZvKTtcblx0XHRcdFx0dGhpcy5fZnVuY0Nsb3NlQWxsUmVxdWVzdHMoJ2luaXQgZXJyb3InKTtcblxuXHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxHZXRQZWVySWQoXG5cdFx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsSGFuZGxlckdldFBlZXJJZC5iaW5kKHRoaXMpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbFJlY29ubmVjdGVkKCk7XG5cblx0XHRcdFx0dGhpcy5lbWl0KCdpbmZvJywge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBJbmZvOiDQodC+0LXQtNC40L3QtdC90LjQtSDRgSDRgdC10YDQstC10YDQvtC8INCy0L7RgdGC0LDQvdC+0LLQu9C10L3QvdC+LlwiLFxuXHRcdFx0XHRcdHBlZXJJZDogdGhpcy5fdmFsdWVQZWVySWQsXG5cdFx0XHRcdFx0ZXZlbnRzOiBbJ3JlY29ubmVjdGVkJywgJ3JlY29ubmVjdGVkVG9PbGRTZXJ2ZXInXVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLmVtaXQoJ3JlY29ubmVjdGVkJyk7XG5cdFx0XHRcdHRoaXMuZW1pdCgncmVjb25uZWN0ZWRUb09sZFNlcnZlcicpO1xuXHRcdFx0XHR0aGlzLmVtaXQoJ19fcmVjb25uZWN0ZWRUb09sZFNlcnZlcl9fJyk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY0ludGVybmFsSGFuZGxlckdldE9iamVjdHMgPSBmdW5jdGlvbihlcnJvciwgb2JqZWN0UHJvcHMpIHtcblx0XHRcdGlmICghdGhpcy5fdmFsdWVJc1JlYWR5RW1pdGVkKSB7XG5cdFx0XHRcdHRoaXMuX3ZhbHVlU2VydmVyT2JqZWN0c1Byb3BzID0gb2JqZWN0UHJvcHM7XG5cblx0XHRcdFx0dGhpcy5fZnVuY09iamVjdENyZWF0ZUFsbCgpO1xuXHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxDb25uZWN0ZWQoKTtcblxuXHRcdFx0XHR0aGlzLmVtaXQoJ2luZm8nLCB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIEluZm86INGB0LXRgNCy0LXRgNC90YvQtSDQvtCx0YrQtdC60YLRiyDQuNC90LjRhtC40LDQu9C40LfQuNGA0L7QstCw0L3QvdGLLCDQutC70LjQtdC90YIg0LPQvtGC0L7QsiDQuiDRgNCw0LHQvtGC0LUuXCIsXG5cdFx0XHRcdFx0ZXZlbnRzOiBbJ3JlYWR5J10sXG5cdFx0XHRcdFx0c2VydmVyT2JqZWN0c1Byb3BzOiB0aGlzLl92YWx1ZVNlcnZlck9iamVjdHNQcm9wc1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGhpcy5fdmFsdWVJc1JlYWR5RW1pdGVkID0gdHJ1ZTtcblxuXHRcdFx0XHR0aGlzLmVtaXQoJ3JlYWR5JywgdGhpcy5fdmFsdWVTZXJ2ZXJPYmplY3RzUHJvcHMpO1xuXHRcdFx0fSBlbHNlIGlmIChpc1Byb3BzRXF1YWwob2JqZWN0UHJvcHMsIHRoaXMuX3ZhbHVlU2VydmVyT2JqZWN0c1Byb3BzKSkge1xuXHRcdFx0XHR0aGlzLmVtaXQoJ2luZm8nLCB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIEluZm86INCh0LXRgNCy0LXRgCDQsdGL0Lsg0L/QtdGA0LXQt9Cw0L/Rg9GJ0LXQvdC9LCDQvdC+INC+0LHRitC10LrRgtGLINGC0LXQu9C10L/QvtGA0YLQuNGA0L7QstCw0Lsg0YLQtdC20LUuXCIsXG5cdFx0XHRcdFx0ZXZlbnRzOiBbJ3JlY29ubmVjdGVkJywgJ3JlY29ubmVjdGVkVG9OZXdTZXJ2ZXInXVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxDb25uZWN0ZWQoKTtcblxuXHRcdFx0XHR0aGlzLmVtaXQoJ3JlY29ubmVjdGVkJyk7XG5cdFx0XHRcdHRoaXMuZW1pdCgncmVjb25uZWN0ZWRUb05ld1NlcnZlcicpO1xuXHRcdFx0XHR0aGlzLmVtaXQoJ19fcmVjb25uZWN0ZWRUb05ld1NlcnZlcl9fJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmVtaXQoJ3dhcm4nLCB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIFdhcm46INCf0L7RgdC70LUg0YHQstC+0LXQs9C+INC/0LXRgNC10LfQsNC/0YPRgdC60LAg0YHQtdGA0LLQtdGA0LAg0L/RgNC40YHQu9Cw0Lsg0YHQtdGA0LLQtdGA0L3Ri9C1INC+0LHRitC10LrRgtGLINC+0YLQu9C40YfQvdGL0LUg0L7RgiDRgdGC0LDRgNGL0YUsINGA0LXQutC+0LzQtdC90LTRg9GOINC+0LHQvdC+0LLQuNGC0Ywg0YHRgtGA0LDQvdC40YbRgy5cIixcblx0XHRcdFx0XHRldmVudHM6IFsnc2VydmVyT2JqZWN0c0NoYW5nZWQnLCAncmVjb25uZWN0ZWQnLCAncmVjb25uZWN0ZWRUb05ld1NlcnZlciddLFxuXHRcdFx0XHRcdG5ld09iamVjdFByb3BzOiBvYmplY3RQcm9wcyxcblx0XHRcdFx0XHRvbGRPYmplY3RQcm9wczogdGhpcy5fdmFsdWVTZXJ2ZXJPYmplY3RzUHJvcHNcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsQ29ubmVjdGVkKCk7XG5cblx0XHRcdFx0dGhpcy5pc1NlcnZlck9iamVjdENoYW5nZWQgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLmVtaXQoJ3NlcnZlck9iamVjdHNDaGFuZ2VkJyk7XG5cdFx0XHRcdHRoaXMuZW1pdCgncmVjb25uZWN0ZWQnKTtcblx0XHRcdFx0dGhpcy5lbWl0KCdyZWNvbm5lY3RlZFRvTmV3U2VydmVyJyk7XG5cdFx0XHRcdHRoaXMuZW1pdCgnX19yZWNvbm5lY3RlZFRvTmV3U2VydmVyX18nKTtcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gaXNQcm9wc0VxdWFsKG5ld09iamVjdFByb3BzLCBvbGRPYmplY3RQcm9wcykge1xuXHRcdFx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkobmV3T2JqZWN0UHJvcHMpID09IEpTT04uc3RyaW5naWZ5KG9sZE9iamVjdFByb3BzKTtcblx0XHRcdH07XG5cdFx0fTtcblxuXHRcdC8vZW5kIEludGVybmFsSGFuZGxlclxuXG5cdFx0Ly9zZXJ2ZXJcblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNRdWFyYW50ZWVkU2VuZE1lc3NhZ2UgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG5cdFx0XHRpZiAodGhpcy5fdmFsdWVXc0NsaWVudCAmJiAodGhpcy5fdmFsdWVXc0NsaWVudC5yZWFkeVN0YXRlID09IDEpKSB7XG5cdFx0XHRcdHRoaXMuX2Z1bmNXc1NlbmRNZXNzYWdlKG1lc3NhZ2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INCh0L7QtdC00LjQvdC10L3QuNC1INGBINGB0LXRgNCy0LXRgNC+0Lwg0YHQtdC50YfQsNGBINC+0YLRgdGD0YLRgdGC0LLRg9C10YIsINC60L7Qs9C00LAg0L7QvdC+INCx0YPQtNC10YIg0LLQvtGB0YHRgtCw0L3QvtCy0LvQtdC90L3Qviwg0Y3RgtC+INGB0L7QvtCx0YnQtdC90LjQtSDQsdGD0LTQtdGCINC+0YLQv9GA0LLQsNC70LXQvdC90L4uXCIgK1xuXHRcdFx0XHRcdFx0XCLQldGB0LvQuCDQv9C+0YHQu9C1INCy0L7RgdGC0LDQvdC+0LLQu9C10L3QuNGPINGB0L7QtdC00LjQvdC10L3QuNGPINGB0YLQsNC90LXRgiDRj9GB0L3Qviwg0YfRgtC+INC/0L7QtNC60LvRjtGH0LjQu9GB0Y8g0LrQu9C40LXQvdGCINC6INC90L7QstC+0LzRgyDRjdC60LfQtdC80L/Qu9GP0YDRgyDRgdC10YDQstC10YDRgyAo0YHQtdGA0LLQtdGAINC/0LXRgNC10LfQsNC/0YPRidC10L3QvSksINGC0L4g0YHQvtC+0LHRidC10L3QuNC1INC+0YLQv9GA0LDQstC70LXQvdC90L4g0L3QtSDQsdGD0LTQtdGCLlwiLFxuXHRcdFx0XHRcdG1lc3NhZ2U6IG1lc3NhZ2Vcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dmFyIHJlY29ubmVjdGVkT2xkU2VydmVySGFuZGxlciA9IChmdW5jdGlvbihtZXNzYWdlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0XHRcdFx0ZGVzYzogJ1tUZWxlcG9ydENsaWVudF0gRGVidWc6INCh0L7QtdC00LjQvdC10L3QuNC1INCy0L7RgdGC0LDQvdC+0LLQu9C10L3QvdC+INGBINC/0YDQtdC20L3QuNC8INGN0LrQt9C10LzQv9C70Y/RgNC+0Lwg0YHQtdGA0LLQtdGA0LAsINC40LvQuCDRg9GB0YLQsNC90L7QstC70LXQvdC90L4g0LLQv9C10YDQstGL0LUsINC+0YLQv9GA0LDQstC70Y/QtdGC0YHRjyDRgdC+0L7QsdGI0LXQvdC40LUg0L3QsCDRgdC10YDQstC10YAnLFxuXHRcdFx0XHRcdFx0XHRtZXNzYWdlOiBtZXNzYWdlXG5cdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0dGhpcy5yZW1vdmVMaXN0ZW5lcignX19yZWNvbm5lY3RlZFRvTmV3U2VydmVyX18nLCByZWNvbm5lY3RlZE5ld1NlcnZlckhhbmRsZXIpO1xuXHRcdFx0XHRcdFx0dGhpcy5fZnVuY1dzU2VuZE1lc3NhZ2UobWVzc2FnZSk7XG5cdFx0XHRcdFx0fS5iaW5kKHRoaXMpO1xuXHRcdFx0XHR9LmJpbmQodGhpcykpKG1lc3NhZ2UpO1xuXG5cdFx0XHRcdHZhciByZWNvbm5lY3RlZE5ld1NlcnZlckhhbmRsZXIgPSAoZnVuY3Rpb24obWVzc2FnZSkge1xuXHRcdFx0XHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdFx0XHRcdGRlc2M6ICdbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQn9C10YDQtdC/0L7QtNC60LvRjtGH0LXQvdC40LUg0L/RgNC+0LjQt9C+0YjQu9C+INC6INC90L7QstC+0LzRgyDRjdC60LfQtdC80L/Qu9GP0YDRgyDRgdC10YDQstC10YDQsCwg0YHQvtC+0LHRidC10L3QuNC1INC+0YLQv9GA0LDQstC70LXQvdC90L4g0L3QtSDQsdGD0LTQtdGCLicsXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IG1lc3NhZ2Vcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHR0aGlzLnJlbW92ZUxpc3RlbmVyKCdfX3JlY29ubmVjdGVkVG9PbGRTZXJ2ZXJfXycsIHJlY29ubmVjdGVkT2xkU2VydmVySGFuZGxlcilcblx0XHRcdFx0XHR9LmJpbmQodGhpcyk7XG5cdFx0XHRcdH0uYmluZCh0aGlzKSkobWVzc2FnZSk7XG5cblx0XHRcdFx0dGhpcy5vbmNlKCdfX3JlY29ubmVjdGVkVG9OZXdTZXJ2ZXJfXycsIHJlY29ubmVjdGVkTmV3U2VydmVySGFuZGxlcik7XG5cdFx0XHRcdHRoaXMub25jZSgnX19yZWNvbm5lY3RlZFRvT2xkU2VydmVyX18nLCByZWNvbm5lY3RlZE9sZFNlcnZlckhhbmRsZXIpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNXc1NlbmRNZXNzYWdlID0gZnVuY3Rpb24obWVzc2FnZSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dmFyIHN0cmluZyA9IEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpO1xuXG5cdFx0XHRcdGlmICh0aGlzLl92YWx1ZVdzQ2xpZW50ICYmICh0aGlzLl92YWx1ZVdzQ2xpZW50LnJlYWR5U3RhdGUgPT0gMSkpIHtcblx0XHRcdFx0XHR0aGlzLl92YWx1ZVdzQ2xpZW50LnNlbmQoc3RyaW5nKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLmVtaXQoJ3dhcm4nLCB7XG5cdFx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gV2Fybjog0YHQvtC+0LHRidC10L3QuNC1INC+0YLQv9GA0LDQstC70LXQvdC90L4g0L3QtSDQsdGD0LTQtdGCLCDRgtCw0Log0LrQsNC6INGB0L7QtdC00LjQvdC10L3QuNC1INGBINGB0LXRgNCy0LXRgNC+0Lwg0L/QvtGC0LXRgNGP0L3QvdC+LlwiLFxuXHRcdFx0XHRcdFx0bWVzc2FnZTogbWVzc2FnZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMuZW1pdChcIndhcm5cIiwge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBXYXJuOiDQvtGI0LjQsdC60LAg0L7RgtC/0YDQsNCy0LrQuCDRgdC+0L7QsdGJ0LXQvdC40Y8g0L3QsCDRgdC10YDQstC10YA6IFwiICsgZXJyb3IsXG5cdFx0XHRcdFx0bWVzc2FnZTogbWVzc2FnZSxcblx0XHRcdFx0XHRlcnJvcjogZXJyb3Jcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8vZW5kIHNlcnZlclxuXG5cdFx0Ly8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi8vXG5cdFx0Ly8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi8vXG5cdFx0Ly8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi8vXG5cdFx0Ly8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogICBUZWxlcG9ydGVkT2JqZWN0ICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi8vXG5cdFx0Ly8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi8vXG5cdFx0Ly8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi8vXG5cdFx0Ly8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi8vXG5cblx0XHQvKipcblx0XHRcdNCY0L3QuNGG0LjQsNC70LjQt9Cw0YLQvtGAINGB0LXRgNCy0LXRgNC90LXRhSDQvtCx0YrQtdC60YLQvtCyLCBcblx0XHRcdNCy0YHQtSDQvNC10YLQvtC00Ysg0LHRg9C00YPRgiDRgdC+0LfQtNCw0L3QvdGLINGE0YPQvdC60YbQuNC10LkgX2Z1bmNPYmplY3RDcmVhdGUg0LrQu9Cw0YHRgdCwIFRlbGVwb3J0Q2xpZW50LFxuXHRcdFx00LAg0L3QtSDRgdC40LvQsNC80Lgg0LrQvtC90YHRgtGA0YPQutGC0L7RgNCwINC60LvQsNGB0YHQsCBUZWxlcG9ydGVkT2JqZWN0LCDQv9C+0YLQvtC80YMg0YfRgtC+INCyINGB0L7Qt9C00LDQstCw0LXQvNGL0YUgXG5cdFx0XHTQvNC10YLQvtC00LDRhSDQv9GA0L7QsdGA0L7RiNC10L3QvdGL0YUg0YEg0YHQtdGA0LLQtdGA0LAg0L7QsdGK0LXQutGC0LDRhSBcblx0XHRcdNC/0L7RgtGA0LXQsdGD0LXRgtGB0Y8g0LjRgdC/0L7Qu9GM0LfQvtCy0LDRgtGMIF9mdW5jV3NTZW5kTWVzc2FnZSwg0LrQu9Cw0YHRgdCwIFRlbGVwb3J0Q2xpZW50LFxuXHRcdFx00LrQvtGC0L7RgNGL0Lkg0LjRgdC+0LvRjNC30YPQtdGCIHdzINC60LvQuNC10L3RgiDQutC70LDRgdGB0LAgVGVsZXBvcnRDbGllbnQuXG5cblx0XHRcdF9mdW5jV3NTZW5kTWVzc2FnZSDQutC+0L3QtdGH0L3QviDQvNC+0LbQvdC+INC/0YDQvtCx0YDQvtGB0LjRgtGMINC/0YDQuNCx0LjQvdC00LjQsiDQuiDQvdC10LzRgyB0aGlzIFRlbGVwb3J0Q2xpZW50XG5cdFx0XHTQuCDQuNGB0L/QvtC70YLRjNC30L7QstCw0YLRjCDQstC90YPRgtGA0LggVGVsZXBvcnRlZE9iamVjdCwg0L3QviDRjdGC0L4g0YPRgdC70L7QttC90Y/QtdGCINC60L7QtCDQuCDQstGL0LPQu9GP0LTQuNGCINGB0YLRgNC10LzQvdC+LlxuXG5cdFx0XHTQsiDQutCw0YfQtdGB0YLQstC1INCw0LvRjNGC0LXRgNC90LDRgtC40LLRiyDQvNC+0LbQvdC+INC+0YLQstGP0LfQsNGC0Ywg0LrQvtC90L3QtdC60YIg0LrQu9C40LXQvdGC0LAg0YEg0YHQtdGA0LLQtdGA0L7QvCDQvtGCIHdzINGB0LXRgdGB0LjQuCxcblx0XHRcdNC4INC30LDQstC10YHRgtC4INC60LDQutC40LUg0L3QuNCx0YPQtNGMINC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0LjQtNC10L3RgtC40YTQuNC60LDRgtC+0YDRiyDQtNC70Y8g0L7QsdC+0LfQvdCw0YfQtdC90LjRjyDRgdC+0LHRgdGC0LLQtdC90L3QviDRgdC10YHRgdC40LksIFxuXHRcdFx00Lgg0YLQvtCz0LTQsCDQvNC+0LbQvdC+INGB0L7Qt9C00LDRgtGMINC+0YLQtNC10LvRjNC90YvQuSB3cyBDbGllbnQg0LIgVGVsZXBvcnRlZE9iamVjdCwg0Lgg0YHQvtCx0YHRgtCy0LXQvdC90L4g0YHQstC+0Y4g0YHQvtCx0YHRgtCy0LXQvdC90YPRjlxuXHRcdFx00YTRg9C90LrRhtC40Y4gX2Z1bmNXc1NlbmRNZXNzYWdlINC30LDQv9C40LvQuNGC0YwsINC90L4g0Y8g0L3QtSDRhdC+0YfRgywg0Y3RgtC+INGD0YHQu9C+0LbQvdC40YIg0LrQvtC0INC4INCy0L7Rgi5cblxuXHRcdCovXG5cblxuXHRcdHV0aWwuaW5oZXJpdHMoVGVsZXBvcnRlZE9iamVjdCwgRXZlbnRFbWl0dGVyKTtcblxuXHRcdGZ1bmN0aW9uIFRlbGVwb3J0ZWRPYmplY3Qob2JqZWN0UHJvcHMpIHtcblx0XHRcdHRoaXMuX19ldmVudHNfXyA9IG9iamVjdFByb3BzLmV2ZW50cztcblx0XHRcdHRoaXMuX19tZXRob2RzX18gPSBvYmplY3RQcm9wcy5tZXRob2RzO1xuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNPYmplY3RDcmVhdGVBbGwgPSBmdW5jdGlvbigpIHtcblx0XHRcdGZvciAodmFyIG9iamVjdE5hbWUgaW4gdGhpcy5fdmFsdWVTZXJ2ZXJPYmplY3RzUHJvcHMpIHtcblx0XHRcdFx0dGhpcy5fZnVuY09iamVjdENyZWF0ZShvYmplY3ROYW1lKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0XHTQnNC10YLQvtC0INC40L3QuNGG0LjQsNC70LjQt9C40YDRg9GO0YnQuNC5INC/0YDQuNC90Y/RgtGL0Lkg0L7RgiDRgdC10YDQstC10YDQsCDQvtCx0YrQtdC60YIsIFxuXHRcdFx00L/RgNC40L3QuNC80LDQtdGCINC40LzRjyDQvtCx0YrQtdC60YLQsCwg0L3QtSDQvtGH0LXQvdGMINC+0L/RgtC40LzQsNC70YzQvdC+LCDQvdC+INC90LDQs9C70Y/QtNC90L5cblx0XHRcdFxuXHRcdCovXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jT2JqZWN0Q3JlYXRlID0gZnVuY3Rpb24ob2JqZWN0TmFtZSkge1xuXHRcdFx0dmFyIG9iamVjdFByb3BzID0gdGhpcy5fdmFsdWVTZXJ2ZXJPYmplY3RzUHJvcHNbb2JqZWN0TmFtZV07XG5cdFx0XHR0aGlzLm9iamVjdHNbb2JqZWN0TmFtZV0gPSBuZXcgVGVsZXBvcnRlZE9iamVjdChvYmplY3RQcm9wcyk7XG5cblx0XHRcdGZvciAodmFyIG1ldGhvZEluZGV4ID0gMDsgbWV0aG9kSW5kZXggPCBvYmplY3RQcm9wcy5tZXRob2RzLmxlbmd0aDsgbWV0aG9kSW5kZXgrKykge1xuXHRcdFx0XHR2YXIgbWV0aG9kTmFtZSA9IG9iamVjdFByb3BzLm1ldGhvZHNbbWV0aG9kSW5kZXhdO1xuXG5cdFx0XHRcdHRoaXMub2JqZWN0c1tvYmplY3ROYW1lXVttZXRob2ROYW1lXSA9XG5cdFx0XHRcdFx0dGhpcy5fZnVuY01ldGhvZENyZWF0ZShvYmplY3ROYW1lLCBtZXRob2ROYW1lKS5iaW5kKHRoaXMpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvKipcblx0XHRcdNCt0YLQsCDRhNGD0L3QutGG0LjRjyDQv9GA0LjQvdC40LzQsNC10YIg0YHRgtGA0L7QutC4IG1ldGhvZE5hbWUg0Lggb2JqZWN0TmFtZS5cblx0XHRcdNCYINCy0L7Qt9Cy0YDQsNC20LDQtdGCINGE0YPQvdC60YbQuNGOLCDQtNC70Y8g0LrQvtGC0L7RgNC+0Lkg0Y3RgtC4INGB0YLRgNC+0LrQuCDQsdGD0LTRg9GCINC00L7RgdGC0YPQv9C90Ysg0YfQtdGA0LXQtyDQt9Cw0LzRi9C60LDQvdC40LUuXG5cdFx0XHRcblx0XHRcdNCh0L7Qt9C00LDQstCw0LXQvNCw0Y8g0YTRg9C90LrRhtC40Y8sINCx0YPQu9GD0YfQuCDQstGL0LfQstCw0L3QvdC+0Lkg0YDQsNC30LHQuNGA0LDQtdGCINCy0YXQvtC00Y/RidC40Lkg0LzQsNGB0YHQuNCyIGFyZ3VtZW50cyDQvdCwINGB0L7QsdGB0YLQstC10L3QvdC+IFxuXHRcdFx00LDRgNCz0YPQvNC10L3RgtGLINC00LvRjyDRhNGD0L3QutGG0LjQuCDQuCBjYWxsYmFjay5cblx0XHRcdNCt0YLQvtC80YMg0LLRi9C30L7QstGDINC/0YDQuNGB0LLQsNC40LLQsNC10YLRgdGPIHJlcXVlc3RJZCDQutC+0YLQvtGA0L7QvNGDINCyINGB0L7QvtGC0LLQtdGC0YHRgtCy0LjQtSDRgdGC0LDQstC40YLRjNGB0Y8g0L/RgNC40L3Rj9GC0YvQuSBjYWxsYmFjay5cblx0XHRcdNCf0L7RgdC70LUg0Y3RgtC+0LPQviDQt9Cw0L/RgNC+0YEg0L7RgtC/0YDQsNCy0LvRj9C10YLRgdGPINC90LAg0YHQtdGA0LLQtdGALlxuXHRcdFx0XG5cdFx0XHTQotCw0Log0LrQsNC6INGN0YLQsCDRhNGD0L3QutGG0LjRjyDQsdGD0LTQtdGCINC/0YDQuNGB0LLQvtC10L3QvdCwINC/0L7Qu9GOINC+0LHRitC10LrRgtCwLCDRgtC+INC00LvRjyDRg9C00L7QsdGB0YLQstCwINC+0L3QsCDQstC+0LfQstGA0LDRidCw0LXRgiBcblx0XHRcdNC60L7QvdGC0LXQutGB0YIg0L7QsdGK0LXQutCwINC40Lcg0LrQvtGC0L7RgNC+0LPQviDQvtC90LAg0LHRi9C70LAg0LLRi9C30LLQsNC90L3QsC5cblx0XHRcdNCn0YLQvtCx0Ysg0LzQvtC20L3QviDQsdGL0LvQviDQv9C40YHQsNGC0Ywg0LLQvtGCINGC0LDQutC40LUg0YjRgtGD0LrQuDpcblx0XHRcdHRlbGVwb3J0Q2xpZW50Lm9iamVjdHMuc29tZU9iamVjdE5hbWVcblx0XHRcdFx0LmZpcnN0TWV0aG9kKHNvbWVIYW5kbGVyKVxuXHRcdFx0XHQuc2Vjb25kTWV0aG9kKHNvbWVIYW5kbGVyKTtcblxuXHRcdCovXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jTWV0aG9kQ3JlYXRlID0gZnVuY3Rpb24ob2JqZWN0TmFtZSwgbWV0aG9kTmFtZSkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkgeyAvLyhjYWxsYmFjaykgb3IgKGFyZ3MuLiwgY2FsbGJhY2spIG9yIChhcmdzLi4uKSBvciAoKVxuXHRcdFx0XHR2YXIgYXJncztcblx0XHRcdFx0dmFyIGNhbGxiYWNrO1xuXG5cdFx0XHRcdGlmIChhcmd1bWVudHMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdHZhciBzbGljZUVuZEluZGV4ID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7XG5cdFx0XHRcdFx0dmFyIGNhbGxiYWNrSW5kZXggPSBhcmd1bWVudHMubGVuZ3RoIC0gMTtcblxuXHRcdFx0XHRcdGlmICh0eXBlb2YoYXJndW1lbnRzW2NhbGxiYWNrSW5kZXhdKSAhPSAnZnVuY3Rpb24nKSBzbGljZUVuZEluZGV4ID0gYXJndW1lbnRzLmxlbmd0aDtcblx0XHRcdFx0XHRlbHNlIGNhbGxiYWNrID0gYXJndW1lbnRzW2NhbGxiYWNrSW5kZXhdO1xuXG5cdFx0XHRcdFx0YXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCwgc2xpY2VFbmRJbmRleCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWNhbGxiYWNrKVxuXHRcdFx0XHRcdGNhbGxiYWNrID0gZnVuY3Rpb24oZXJyb3IsIHJlc3VsdCkge1xuXHRcdFx0XHRcdFx0dGhpcy5lbWl0KCd3YXJuJywge1xuXHRcdFx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gV2Fybjog0YHQtdGA0LLQtdGAINCy0LXRgNC90YPQuyDRgNC10LfRg9C70YzRgtCw0YIg0LTQu9GPIFwiICsgb2JqZWN0TmFtZSArIFwiLlwiICsgbWV0aG9kTmFtZSArIFwiINCx0LXQtyDQt9Cw0YDQtdCz0LjRgdGC0YDQuNGA0L7QstCw0L3QvdC+0LPQviDQvdCwINC60LvQuNC10L3RgtC1INC60LDQu9Cx0LXQutCwXCIsXG5cdFx0XHRcdFx0XHRcdGNhbGxlZFdpdGhBcmd1bWVudHM6IGFyZ3VtZW50cyxcblx0XHRcdFx0XHRcdFx0cmV0dXJuZWRFcnJvcjogZXJyb3IsXG5cdFx0XHRcdFx0XHRcdHJldHVybmVkUmVzdWx0OiByZXN1bHRcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0uYmluZCh0aGlzKTtcblxuXHRcdFx0XHR2YXIgcmVxdWVzdElkID0gdGhpcy5fdmFsdWVSZXF1ZXN0cy5sZW5ndGg7XG5cdFx0XHRcdHRoaXMuX3ZhbHVlUmVxdWVzdHMucHVzaChjYWxsYmFjayk7XG5cblx0XHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INCy0YvQt9Cy0YvQvSDQvNC10YLQvtC0INGB0LXRgNCy0LXRgNC90L7Qs9C+INC+0LHRitC10LrRgtCwOiBcIiArIG9iamVjdE5hbWUgKyBcIi5cIiArIG1ldGhvZE5hbWUsXG5cdFx0XHRcdFx0YXJnczogYXJncyxcblx0XHRcdFx0XHRyZXF1ZXN0SWQ6IHJlcXVlc3RJZFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLl9mdW5jUXVhcmFudGVlZFNlbmRNZXNzYWdlKHtcblx0XHRcdFx0XHRvYmplY3ROYW1lOiBvYmplY3ROYW1lLFxuXHRcdFx0XHRcdHR5cGU6IFwiY29tbWFuZFwiLFxuXHRcdFx0XHRcdGNvbW1hbmQ6IG1ldGhvZE5hbWUsXG5cdFx0XHRcdFx0cmVxdWVzdElkOiByZXF1ZXN0SWQsXG5cdFx0XHRcdFx0cGVlcklkOiB0aGlzLl92YWx1ZVBlZXJJZCxcblx0XHRcdFx0XHRhcmdzOiBhcmdzXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHJldHVybiB0aGlzLm9iamVjdHNbb2JqZWN0TmFtZV07XG5cdFx0XHR9O1xuXHRcdH07XG5cblx0XHQvKipcblx0XHRcdNCl0LXQvdC00LvQtdGAINC00LvRjyDQutCw0LvQsdC10LrQvtCyINC80LXRgtC+0LTQvtCyINGB0LXRgNCy0LXRgNC90YvRhSDQvtCx0YrQtdC60YLQvtCyLlxuXHRcdFx00YTQvtGA0LzQsNGCINC/0YDQuNC90LjQvNCw0LXQvNC+0LPQviDQsNGA0LPRg9C80LXQvdGC0LAgXG5cdFx0XHRcblx0XHRcdG1lc3NhZ2UgPSB7XG5cdFx0XHRcdHR5cGU6ICdjYWxsYmFjaycsXG5cdFx0XHRcdGNvbW1hbmQ6ICdtZXRob2ROYW1lJyxcblx0XHRcdFx0b2JqZWN0TmFtZTogJ29iamVjdE5hbWUnLFxuXHRcdFx0XHRyZXF1ZXN0SWQ6IDAsXG5cdFx0XHRcdGVycm9yOiBudWxsLFxuXHRcdFx0XHRyZXN1bHQ6IHNvbWVSZXN1bHRcblx0XHRcdH1cblxuXHRcdFx00LLQvdGD0YLRgNC4INC80LXRgtC+0LTQsCDQsdGD0LTQtdGCINCy0YvQt9Cy0LDQvSDQutCw0LvQsdC10Log0L/QvtGB0YLQsNCy0LvQtdC90L3Ri9C5INCyINGB0L7QvtGC0LLQtdGC0YHRgtCy0LjQtSDRgSByZXF1ZXN0SWRcblxuXHRcdCovXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jQ2FsbGJhY2tIYW5kbGVyID0gZnVuY3Rpb24obWVzc2FnZSkge1xuXHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDRgdC10YDQstC10YAg0LLQtdGA0L3Rg9C7IGNhbGxiYWNrINC90LA6IFwiICsgbWVzc2FnZS5vYmplY3ROYW1lICsgXCIuXCIgKyBtZXNzYWdlLmNvbW1hbmQsXG5cdFx0XHRcdG1lc3NhZ2U6IG1lc3NhZ2Vcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLl92YWx1ZVJlcXVlc3RzW21lc3NhZ2UucmVxdWVzdElkXShtZXNzYWdlLmVycm9yLCBtZXNzYWdlLnJlc3VsdCk7XG5cdFx0XHRkZWxldGUgdGhpcy5fdmFsdWVSZXF1ZXN0c1ttZXNzYWdlLnJlcXVlc3RJZF07XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdFx00KXRjdC90LTQu9C10YAg0LTQu9GPINGB0L7QsdGL0YLQuNC5INCy0YvQsdGA0LDRgdGL0LLQsNC10LzRi9GFINGB0LXRgNCy0LXRgNC90YvQvNC4INC+0LHRitC10LrRgtCw0LzQuFxuXHRcdFx00YTQvtGA0LzQsNGCINC/0YDQuNC90LjQvNCw0LXQs9C+INCw0YDQs9GD0LzQtdC90YLQsFxuXG5cdFx0XHTRgtCw0Log0LrQsNC6IGVtaXQg0L/RgNC40L3QuNC80LDQtdGCINC90LXQvtCz0YDQsNC90LjRh9C10L3QvdC+0LUg0LrQvtC70LjRh9C10YHRgtCy0L4g0LDRgNCz0YPQvNC10L3RgtC+0LIg0L/QtdGA0LXQtNCw0LLQsNC10LzRi9GFINC/0L7QtNC/0LjRgdGH0LjQutCw0LwsINGC0L5cblx0XHRcdG1lc3NhZ2UuYXJncyDRjdGC0L4g0LzQsNGB0YHQuNCyLCDRgdC+0LTQtdGA0LbQsNGJ0LjQuSDQv9C10YDQtdC00LDQvdC90YvQtSDQsNGA0LPRg9C80LXQvdGC0YsuXG5cblx0XHRcdG1lc3NhZ2UgPSB7XG5cdFx0XHRcdHR5cGU6ICdldmVudCcsXG5cdFx0XHRcdGV2ZW50OiAnZXZlbnROYW1lJyxcblx0XHRcdFx0b2JqZWN0TmFtZTogJ3NvbWVPYmplY3ROYW1lJ1xuXHRcdFx0XHRhcmdzOiBbc29tZUFyZ3NdXG5cdFx0XHR9XG5cblx0XHQqL1xuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY0V2ZW50SGFuZGxlciA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcblx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0YHQtdGA0LLQtdGAINC/0LXRgNC10LTQsNC7INGB0L7QsdGL0YLQuNC1OiBcIiArIG1lc3NhZ2Uub2JqZWN0TmFtZSArIFwiLlwiICsgbWVzc2FnZS5ldmVudCxcblx0XHRcdFx0bWVzc2FnZTogbWVzc2FnZVxuXHRcdFx0fSk7XG5cblx0XHRcdHZhciBlbWl0QXJncyA9IFtdO1xuXHRcdFx0ZW1pdEFyZ3MucHVzaChtZXNzYWdlLmV2ZW50KTtcblx0XHRcdGVtaXRBcmdzID0gZW1pdEFyZ3MuY29uY2F0KG1lc3NhZ2UuYXJncyk7XG5cblx0XHRcdHZhciBvYmplY3QgPSB0aGlzLm9iamVjdHNbbWVzc2FnZS5vYmplY3ROYW1lXTtcblxuXHRcdFx0b2JqZWN0LmVtaXQuYXBwbHkob2JqZWN0LCBlbWl0QXJncyk7XG5cdFx0fTtcblxuXHRcdC8vZW5kIHByaXZhdGVcblxuXHRcdHJldHVybiBUZWxlcG9ydENsaWVudDtcblx0fVxufSh3aW5kb3cpKTsiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJpZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICdmdW5jdGlvbicpIHtcbiAgLy8gaW1wbGVtZW50YXRpb24gZnJvbSBzdGFuZGFyZCBub2RlLmpzICd1dGlsJyBtb2R1bGVcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckN0b3IucHJvdG90eXBlLCB7XG4gICAgICBjb25zdHJ1Y3Rvcjoge1xuICAgICAgICB2YWx1ZTogY3RvcixcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcbn0gZWxzZSB7XG4gIC8vIG9sZCBzY2hvb2wgc2hpbSBmb3Igb2xkIGJyb3dzZXJzXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICB2YXIgVGVtcEN0b3IgPSBmdW5jdGlvbiAoKSB7fVxuICAgIFRlbXBDdG9yLnByb3RvdHlwZSA9IHN1cGVyQ3Rvci5wcm90b3R5cGVcbiAgICBjdG9yLnByb3RvdHlwZSA9IG5ldyBUZW1wQ3RvcigpXG4gICAgY3Rvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBjdG9yXG4gIH1cbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhblBvc3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5wb3N0TWVzc2FnZSAmJiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lclxuICAgIDtcblxuICAgIGlmIChjYW5TZXRJbW1lZGlhdGUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmKSB7IHJldHVybiB3aW5kb3cuc2V0SW1tZWRpYXRlKGYpIH07XG4gICAgfVxuXG4gICAgaWYgKGNhblBvc3QpIHtcbiAgICAgICAgdmFyIHF1ZXVlID0gW107XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgICAgICB2YXIgc291cmNlID0gZXYuc291cmNlO1xuICAgICAgICAgICAgaWYgKChzb3VyY2UgPT09IHdpbmRvdyB8fCBzb3VyY2UgPT09IG51bGwpICYmIGV2LmRhdGEgPT09ICdwcm9jZXNzLXRpY2snKSB7XG4gICAgICAgICAgICAgICAgZXYuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZuID0gcXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgZm4oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICAgICAgcXVldWUucHVzaChmbik7XG4gICAgICAgICAgICB3aW5kb3cucG9zdE1lc3NhZ2UoJ3Byb2Nlc3MtdGljaycsICcqJyk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZm4sIDApO1xuICAgIH07XG59KSgpO1xuXG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn1cblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc0J1ZmZlcihhcmcpIHtcbiAgcmV0dXJuIGFyZyAmJiB0eXBlb2YgYXJnID09PSAnb2JqZWN0J1xuICAgICYmIHR5cGVvZiBhcmcuY29weSA9PT0gJ2Z1bmN0aW9uJ1xuICAgICYmIHR5cGVvZiBhcmcuZmlsbCA9PT0gJ2Z1bmN0aW9uJ1xuICAgICYmIHR5cGVvZiBhcmcucmVhZFVJbnQ4ID09PSAnZnVuY3Rpb24nO1xufSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwpe1xuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbnZhciBmb3JtYXRSZWdFeHAgPSAvJVtzZGolXS9nO1xuZXhwb3J0cy5mb3JtYXQgPSBmdW5jdGlvbihmKSB7XG4gIGlmICghaXNTdHJpbmcoZikpIHtcbiAgICB2YXIgb2JqZWN0cyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBvYmplY3RzLnB1c2goaW5zcGVjdChhcmd1bWVudHNbaV0pKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdHMuam9pbignICcpO1xuICB9XG5cbiAgdmFyIGkgPSAxO1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgdmFyIGxlbiA9IGFyZ3MubGVuZ3RoO1xuICB2YXIgc3RyID0gU3RyaW5nKGYpLnJlcGxhY2UoZm9ybWF0UmVnRXhwLCBmdW5jdGlvbih4KSB7XG4gICAgaWYgKHggPT09ICclJScpIHJldHVybiAnJSc7XG4gICAgaWYgKGkgPj0gbGVuKSByZXR1cm4geDtcbiAgICBzd2l0Y2ggKHgpIHtcbiAgICAgIGNhc2UgJyVzJzogcmV0dXJuIFN0cmluZyhhcmdzW2krK10pO1xuICAgICAgY2FzZSAnJWQnOiByZXR1cm4gTnVtYmVyKGFyZ3NbaSsrXSk7XG4gICAgICBjYXNlICclaic6XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGFyZ3NbaSsrXSk7XG4gICAgICAgIH0gY2F0Y2ggKF8pIHtcbiAgICAgICAgICByZXR1cm4gJ1tDaXJjdWxhcl0nO1xuICAgICAgICB9XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4geDtcbiAgICB9XG4gIH0pO1xuICBmb3IgKHZhciB4ID0gYXJnc1tpXTsgaSA8IGxlbjsgeCA9IGFyZ3NbKytpXSkge1xuICAgIGlmIChpc051bGwoeCkgfHwgIWlzT2JqZWN0KHgpKSB7XG4gICAgICBzdHIgKz0gJyAnICsgeDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9ICcgJyArIGluc3BlY3QoeCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBzdHI7XG59O1xuXG5cbi8vIE1hcmsgdGhhdCBhIG1ldGhvZCBzaG91bGQgbm90IGJlIHVzZWQuXG4vLyBSZXR1cm5zIGEgbW9kaWZpZWQgZnVuY3Rpb24gd2hpY2ggd2FybnMgb25jZSBieSBkZWZhdWx0LlxuLy8gSWYgLS1uby1kZXByZWNhdGlvbiBpcyBzZXQsIHRoZW4gaXQgaXMgYSBuby1vcC5cbmV4cG9ydHMuZGVwcmVjYXRlID0gZnVuY3Rpb24oZm4sIG1zZykge1xuICAvLyBBbGxvdyBmb3IgZGVwcmVjYXRpbmcgdGhpbmdzIGluIHRoZSBwcm9jZXNzIG9mIHN0YXJ0aW5nIHVwLlxuICBpZiAoaXNVbmRlZmluZWQoZ2xvYmFsLnByb2Nlc3MpKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGV4cG9ydHMuZGVwcmVjYXRlKGZuLCBtc2cpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfVxuXG4gIGlmIChwcm9jZXNzLm5vRGVwcmVjYXRpb24gPT09IHRydWUpIHtcbiAgICByZXR1cm4gZm47XG4gIH1cblxuICB2YXIgd2FybmVkID0gZmFsc2U7XG4gIGZ1bmN0aW9uIGRlcHJlY2F0ZWQoKSB7XG4gICAgaWYgKCF3YXJuZWQpIHtcbiAgICAgIGlmIChwcm9jZXNzLnRocm93RGVwcmVjYXRpb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyk7XG4gICAgICB9IGVsc2UgaWYgKHByb2Nlc3MudHJhY2VEZXByZWNhdGlvbikge1xuICAgICAgICBjb25zb2xlLnRyYWNlKG1zZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKG1zZyk7XG4gICAgICB9XG4gICAgICB3YXJuZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfVxuXG4gIHJldHVybiBkZXByZWNhdGVkO1xufTtcblxuXG52YXIgZGVidWdzID0ge307XG52YXIgZGVidWdFbnZpcm9uO1xuZXhwb3J0cy5kZWJ1Z2xvZyA9IGZ1bmN0aW9uKHNldCkge1xuICBpZiAoaXNVbmRlZmluZWQoZGVidWdFbnZpcm9uKSlcbiAgICBkZWJ1Z0Vudmlyb24gPSBwcm9jZXNzLmVudi5OT0RFX0RFQlVHIHx8ICcnO1xuICBzZXQgPSBzZXQudG9VcHBlckNhc2UoKTtcbiAgaWYgKCFkZWJ1Z3Nbc2V0XSkge1xuICAgIGlmIChuZXcgUmVnRXhwKCdcXFxcYicgKyBzZXQgKyAnXFxcXGInLCAnaScpLnRlc3QoZGVidWdFbnZpcm9uKSkge1xuICAgICAgdmFyIHBpZCA9IHByb2Nlc3MucGlkO1xuICAgICAgZGVidWdzW3NldF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG1zZyA9IGV4cG9ydHMuZm9ybWF0LmFwcGx5KGV4cG9ydHMsIGFyZ3VtZW50cyk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJyVzICVkOiAlcycsIHNldCwgcGlkLCBtc2cpO1xuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVidWdzW3NldF0gPSBmdW5jdGlvbigpIHt9O1xuICAgIH1cbiAgfVxuICByZXR1cm4gZGVidWdzW3NldF07XG59O1xuXG5cbi8qKlxuICogRWNob3MgdGhlIHZhbHVlIG9mIGEgdmFsdWUuIFRyeXMgdG8gcHJpbnQgdGhlIHZhbHVlIG91dFxuICogaW4gdGhlIGJlc3Qgd2F5IHBvc3NpYmxlIGdpdmVuIHRoZSBkaWZmZXJlbnQgdHlwZXMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iaiBUaGUgb2JqZWN0IHRvIHByaW50IG91dC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0IHRoYXQgYWx0ZXJzIHRoZSBvdXRwdXQuXG4gKi9cbi8qIGxlZ2FjeTogb2JqLCBzaG93SGlkZGVuLCBkZXB0aCwgY29sb3JzKi9cbmZ1bmN0aW9uIGluc3BlY3Qob2JqLCBvcHRzKSB7XG4gIC8vIGRlZmF1bHQgb3B0aW9uc1xuICB2YXIgY3R4ID0ge1xuICAgIHNlZW46IFtdLFxuICAgIHN0eWxpemU6IHN0eWxpemVOb0NvbG9yXG4gIH07XG4gIC8vIGxlZ2FjeS4uLlxuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSAzKSBjdHguZGVwdGggPSBhcmd1bWVudHNbMl07XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDQpIGN0eC5jb2xvcnMgPSBhcmd1bWVudHNbM107XG4gIGlmIChpc0Jvb2xlYW4ob3B0cykpIHtcbiAgICAvLyBsZWdhY3kuLi5cbiAgICBjdHguc2hvd0hpZGRlbiA9IG9wdHM7XG4gIH0gZWxzZSBpZiAob3B0cykge1xuICAgIC8vIGdvdCBhbiBcIm9wdGlvbnNcIiBvYmplY3RcbiAgICBleHBvcnRzLl9leHRlbmQoY3R4LCBvcHRzKTtcbiAgfVxuICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gIGlmIChpc1VuZGVmaW5lZChjdHguc2hvd0hpZGRlbikpIGN0eC5zaG93SGlkZGVuID0gZmFsc2U7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguZGVwdGgpKSBjdHguZGVwdGggPSAyO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmNvbG9ycykpIGN0eC5jb2xvcnMgPSBmYWxzZTtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5jdXN0b21JbnNwZWN0KSkgY3R4LmN1c3RvbUluc3BlY3QgPSB0cnVlO1xuICBpZiAoY3R4LmNvbG9ycykgY3R4LnN0eWxpemUgPSBzdHlsaXplV2l0aENvbG9yO1xuICByZXR1cm4gZm9ybWF0VmFsdWUoY3R4LCBvYmosIGN0eC5kZXB0aCk7XG59XG5leHBvcnRzLmluc3BlY3QgPSBpbnNwZWN0O1xuXG5cbi8vIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQU5TSV9lc2NhcGVfY29kZSNncmFwaGljc1xuaW5zcGVjdC5jb2xvcnMgPSB7XG4gICdib2xkJyA6IFsxLCAyMl0sXG4gICdpdGFsaWMnIDogWzMsIDIzXSxcbiAgJ3VuZGVybGluZScgOiBbNCwgMjRdLFxuICAnaW52ZXJzZScgOiBbNywgMjddLFxuICAnd2hpdGUnIDogWzM3LCAzOV0sXG4gICdncmV5JyA6IFs5MCwgMzldLFxuICAnYmxhY2snIDogWzMwLCAzOV0sXG4gICdibHVlJyA6IFszNCwgMzldLFxuICAnY3lhbicgOiBbMzYsIDM5XSxcbiAgJ2dyZWVuJyA6IFszMiwgMzldLFxuICAnbWFnZW50YScgOiBbMzUsIDM5XSxcbiAgJ3JlZCcgOiBbMzEsIDM5XSxcbiAgJ3llbGxvdycgOiBbMzMsIDM5XVxufTtcblxuLy8gRG9uJ3QgdXNlICdibHVlJyBub3QgdmlzaWJsZSBvbiBjbWQuZXhlXG5pbnNwZWN0LnN0eWxlcyA9IHtcbiAgJ3NwZWNpYWwnOiAnY3lhbicsXG4gICdudW1iZXInOiAneWVsbG93JyxcbiAgJ2Jvb2xlYW4nOiAneWVsbG93JyxcbiAgJ3VuZGVmaW5lZCc6ICdncmV5JyxcbiAgJ251bGwnOiAnYm9sZCcsXG4gICdzdHJpbmcnOiAnZ3JlZW4nLFxuICAnZGF0ZSc6ICdtYWdlbnRhJyxcbiAgLy8gXCJuYW1lXCI6IGludGVudGlvbmFsbHkgbm90IHN0eWxpbmdcbiAgJ3JlZ2V4cCc6ICdyZWQnXG59O1xuXG5cbmZ1bmN0aW9uIHN0eWxpemVXaXRoQ29sb3Ioc3RyLCBzdHlsZVR5cGUpIHtcbiAgdmFyIHN0eWxlID0gaW5zcGVjdC5zdHlsZXNbc3R5bGVUeXBlXTtcblxuICBpZiAoc3R5bGUpIHtcbiAgICByZXR1cm4gJ1xcdTAwMWJbJyArIGluc3BlY3QuY29sb3JzW3N0eWxlXVswXSArICdtJyArIHN0ciArXG4gICAgICAgICAgICdcXHUwMDFiWycgKyBpbnNwZWN0LmNvbG9yc1tzdHlsZV1bMV0gKyAnbSc7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxufVxuXG5cbmZ1bmN0aW9uIHN0eWxpemVOb0NvbG9yKHN0ciwgc3R5bGVUeXBlKSB7XG4gIHJldHVybiBzdHI7XG59XG5cblxuZnVuY3Rpb24gYXJyYXlUb0hhc2goYXJyYXkpIHtcbiAgdmFyIGhhc2ggPSB7fTtcblxuICBhcnJheS5mb3JFYWNoKGZ1bmN0aW9uKHZhbCwgaWR4KSB7XG4gICAgaGFzaFt2YWxdID0gdHJ1ZTtcbiAgfSk7XG5cbiAgcmV0dXJuIGhhc2g7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0VmFsdWUoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzKSB7XG4gIC8vIFByb3ZpZGUgYSBob29rIGZvciB1c2VyLXNwZWNpZmllZCBpbnNwZWN0IGZ1bmN0aW9ucy5cbiAgLy8gQ2hlY2sgdGhhdCB2YWx1ZSBpcyBhbiBvYmplY3Qgd2l0aCBhbiBpbnNwZWN0IGZ1bmN0aW9uIG9uIGl0XG4gIGlmIChjdHguY3VzdG9tSW5zcGVjdCAmJlxuICAgICAgdmFsdWUgJiZcbiAgICAgIGlzRnVuY3Rpb24odmFsdWUuaW5zcGVjdCkgJiZcbiAgICAgIC8vIEZpbHRlciBvdXQgdGhlIHV0aWwgbW9kdWxlLCBpdCdzIGluc3BlY3QgZnVuY3Rpb24gaXMgc3BlY2lhbFxuICAgICAgdmFsdWUuaW5zcGVjdCAhPT0gZXhwb3J0cy5pbnNwZWN0ICYmXG4gICAgICAvLyBBbHNvIGZpbHRlciBvdXQgYW55IHByb3RvdHlwZSBvYmplY3RzIHVzaW5nIHRoZSBjaXJjdWxhciBjaGVjay5cbiAgICAgICEodmFsdWUuY29uc3RydWN0b3IgJiYgdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlID09PSB2YWx1ZSkpIHtcbiAgICB2YXIgcmV0ID0gdmFsdWUuaW5zcGVjdChyZWN1cnNlVGltZXMsIGN0eCk7XG4gICAgaWYgKCFpc1N0cmluZyhyZXQpKSB7XG4gICAgICByZXQgPSBmb3JtYXRWYWx1ZShjdHgsIHJldCwgcmVjdXJzZVRpbWVzKTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIC8vIFByaW1pdGl2ZSB0eXBlcyBjYW5ub3QgaGF2ZSBwcm9wZXJ0aWVzXG4gIHZhciBwcmltaXRpdmUgPSBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSk7XG4gIGlmIChwcmltaXRpdmUpIHtcbiAgICByZXR1cm4gcHJpbWl0aXZlO1xuICB9XG5cbiAgLy8gTG9vayB1cCB0aGUga2V5cyBvZiB0aGUgb2JqZWN0LlxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlKTtcbiAgdmFyIHZpc2libGVLZXlzID0gYXJyYXlUb0hhc2goa2V5cyk7XG5cbiAgaWYgKGN0eC5zaG93SGlkZGVuKSB7XG4gICAga2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHZhbHVlKTtcbiAgfVxuXG4gIC8vIElFIGRvZXNuJ3QgbWFrZSBlcnJvciBmaWVsZHMgbm9uLWVudW1lcmFibGVcbiAgLy8gaHR0cDovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L2llL2R3dzUyc2J0KHY9dnMuOTQpLmFzcHhcbiAgaWYgKGlzRXJyb3IodmFsdWUpXG4gICAgICAmJiAoa2V5cy5pbmRleE9mKCdtZXNzYWdlJykgPj0gMCB8fCBrZXlzLmluZGV4T2YoJ2Rlc2NyaXB0aW9uJykgPj0gMCkpIHtcbiAgICByZXR1cm4gZm9ybWF0RXJyb3IodmFsdWUpO1xuICB9XG5cbiAgLy8gU29tZSB0eXBlIG9mIG9iamVjdCB3aXRob3V0IHByb3BlcnRpZXMgY2FuIGJlIHNob3J0Y3V0dGVkLlxuICBpZiAoa2V5cy5sZW5ndGggPT09IDApIHtcbiAgICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICAgIHZhciBuYW1lID0gdmFsdWUubmFtZSA/ICc6ICcgKyB2YWx1ZS5uYW1lIDogJyc7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ1tGdW5jdGlvbicgKyBuYW1lICsgJ10nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ3JlZ2V4cCcpO1xuICAgIH1cbiAgICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKERhdGUucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAnZGF0ZScpO1xuICAgIH1cbiAgICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIGJhc2UgPSAnJywgYXJyYXkgPSBmYWxzZSwgYnJhY2VzID0gWyd7JywgJ30nXTtcblxuICAvLyBNYWtlIEFycmF5IHNheSB0aGF0IHRoZXkgYXJlIEFycmF5XG4gIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgIGFycmF5ID0gdHJ1ZTtcbiAgICBicmFjZXMgPSBbJ1snLCAnXSddO1xuICB9XG5cbiAgLy8gTWFrZSBmdW5jdGlvbnMgc2F5IHRoYXQgdGhleSBhcmUgZnVuY3Rpb25zXG4gIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgIHZhciBuID0gdmFsdWUubmFtZSA/ICc6ICcgKyB2YWx1ZS5uYW1lIDogJyc7XG4gICAgYmFzZSA9ICcgW0Z1bmN0aW9uJyArIG4gKyAnXSc7XG4gIH1cblxuICAvLyBNYWtlIFJlZ0V4cHMgc2F5IHRoYXQgdGhleSBhcmUgUmVnRXhwc1xuICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIH1cblxuICAvLyBNYWtlIGRhdGVzIHdpdGggcHJvcGVydGllcyBmaXJzdCBzYXkgdGhlIGRhdGVcbiAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgRGF0ZS5wcm90b3R5cGUudG9VVENTdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIH1cblxuICAvLyBNYWtlIGVycm9yIHdpdGggbWVzc2FnZSBmaXJzdCBzYXkgdGhlIGVycm9yXG4gIGlmIChpc0Vycm9yKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gIH1cblxuICBpZiAoa2V5cy5sZW5ndGggPT09IDAgJiYgKCFhcnJheSB8fCB2YWx1ZS5sZW5ndGggPT0gMCkpIHtcbiAgICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArIGJyYWNlc1sxXTtcbiAgfVxuXG4gIGlmIChyZWN1cnNlVGltZXMgPCAwKSB7XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbT2JqZWN0XScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG5cbiAgY3R4LnNlZW4ucHVzaCh2YWx1ZSk7XG5cbiAgdmFyIG91dHB1dDtcbiAgaWYgKGFycmF5KSB7XG4gICAgb3V0cHV0ID0gZm9ybWF0QXJyYXkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5cyk7XG4gIH0gZWxzZSB7XG4gICAgb3V0cHV0ID0ga2V5cy5tYXAoZnVuY3Rpb24oa2V5KSB7XG4gICAgICByZXR1cm4gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSk7XG4gICAgfSk7XG4gIH1cblxuICBjdHguc2Vlbi5wb3AoKTtcblxuICByZXR1cm4gcmVkdWNlVG9TaW5nbGVTdHJpbmcob3V0cHV0LCBiYXNlLCBicmFjZXMpO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByaW1pdGl2ZShjdHgsIHZhbHVlKSB7XG4gIGlmIChpc1VuZGVmaW5lZCh2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCd1bmRlZmluZWQnLCAndW5kZWZpbmVkJyk7XG4gIGlmIChpc1N0cmluZyh2YWx1ZSkpIHtcbiAgICB2YXIgc2ltcGxlID0gJ1xcJycgKyBKU09OLnN0cmluZ2lmeSh2YWx1ZSkucmVwbGFjZSgvXlwifFwiJC9nLCAnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJykgKyAnXFwnJztcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoc2ltcGxlLCAnc3RyaW5nJyk7XG4gIH1cbiAgaWYgKGlzTnVtYmVyKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJycgKyB2YWx1ZSwgJ251bWJlcicpO1xuICBpZiAoaXNCb29sZWFuKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJycgKyB2YWx1ZSwgJ2Jvb2xlYW4nKTtcbiAgLy8gRm9yIHNvbWUgcmVhc29uIHR5cGVvZiBudWxsIGlzIFwib2JqZWN0XCIsIHNvIHNwZWNpYWwgY2FzZSBoZXJlLlxuICBpZiAoaXNOdWxsKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJ251bGwnLCAnbnVsbCcpO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEVycm9yKHZhbHVlKSB7XG4gIHJldHVybiAnWycgKyBFcnJvci5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgKyAnXSc7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0QXJyYXkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5cykge1xuICB2YXIgb3V0cHV0ID0gW107XG4gIGZvciAodmFyIGkgPSAwLCBsID0gdmFsdWUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgaWYgKGhhc093blByb3BlcnR5KHZhbHVlLCBTdHJpbmcoaSkpKSB7XG4gICAgICBvdXRwdXQucHVzaChmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLFxuICAgICAgICAgIFN0cmluZyhpKSwgdHJ1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXRwdXQucHVzaCgnJyk7XG4gICAgfVxuICB9XG4gIGtleXMuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICBpZiAoIWtleS5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgIG91dHB1dC5wdXNoKGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsXG4gICAgICAgICAga2V5LCB0cnVlKSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXksIGFycmF5KSB7XG4gIHZhciBuYW1lLCBzdHIsIGRlc2M7XG4gIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHZhbHVlLCBrZXkpIHx8IHsgdmFsdWU6IHZhbHVlW2tleV0gfTtcbiAgaWYgKGRlc2MuZ2V0KSB7XG4gICAgaWYgKGRlc2Muc2V0KSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0dldHRlci9TZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKGRlc2Muc2V0KSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuICBpZiAoIWhhc093blByb3BlcnR5KHZpc2libGVLZXlzLCBrZXkpKSB7XG4gICAgbmFtZSA9ICdbJyArIGtleSArICddJztcbiAgfVxuICBpZiAoIXN0cikge1xuICAgIGlmIChjdHguc2Vlbi5pbmRleE9mKGRlc2MudmFsdWUpIDwgMCkge1xuICAgICAgaWYgKGlzTnVsbChyZWN1cnNlVGltZXMpKSB7XG4gICAgICAgIHN0ciA9IGZvcm1hdFZhbHVlKGN0eCwgZGVzYy52YWx1ZSwgbnVsbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIGRlc2MudmFsdWUsIHJlY3Vyc2VUaW1lcyAtIDEpO1xuICAgICAgfVxuICAgICAgaWYgKHN0ci5pbmRleE9mKCdcXG4nKSA+IC0xKSB7XG4gICAgICAgIGlmIChhcnJheSkge1xuICAgICAgICAgIHN0ciA9IHN0ci5zcGxpdCgnXFxuJykubWFwKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgICAgIHJldHVybiAnICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKS5zdWJzdHIoMik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RyID0gJ1xcbicgKyBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgICcgKyBsaW5lO1xuICAgICAgICAgIH0pLmpvaW4oJ1xcbicpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbQ2lyY3VsYXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cbiAgaWYgKGlzVW5kZWZpbmVkKG5hbWUpKSB7XG4gICAgaWYgKGFycmF5ICYmIGtleS5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICAgIG5hbWUgPSBKU09OLnN0cmluZ2lmeSgnJyArIGtleSk7XG4gICAgaWYgKG5hbWUubWF0Y2goL15cIihbYS16QS1aX11bYS16QS1aXzAtOV0qKVwiJC8pKSB7XG4gICAgICBuYW1lID0gbmFtZS5zdWJzdHIoMSwgbmFtZS5sZW5ndGggLSAyKTtcbiAgICAgIG5hbWUgPSBjdHguc3R5bGl6ZShuYW1lLCAnbmFtZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuYW1lID0gbmFtZS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKVxuICAgICAgICAgICAgICAgICAucmVwbGFjZSgvKF5cInxcIiQpL2csIFwiJ1wiKTtcbiAgICAgIG5hbWUgPSBjdHguc3R5bGl6ZShuYW1lLCAnc3RyaW5nJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5hbWUgKyAnOiAnICsgc3RyO1xufVxuXG5cbmZ1bmN0aW9uIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKSB7XG4gIHZhciBudW1MaW5lc0VzdCA9IDA7XG4gIHZhciBsZW5ndGggPSBvdXRwdXQucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cikge1xuICAgIG51bUxpbmVzRXN0Kys7XG4gICAgaWYgKGN1ci5pbmRleE9mKCdcXG4nKSA+PSAwKSBudW1MaW5lc0VzdCsrO1xuICAgIHJldHVybiBwcmV2ICsgY3VyLnJlcGxhY2UoL1xcdTAwMWJcXFtcXGRcXGQ/bS9nLCAnJykubGVuZ3RoICsgMTtcbiAgfSwgMCk7XG5cbiAgaWYgKGxlbmd0aCA+IDYwKSB7XG4gICAgcmV0dXJuIGJyYWNlc1swXSArXG4gICAgICAgICAgIChiYXNlID09PSAnJyA/ICcnIDogYmFzZSArICdcXG4gJykgK1xuICAgICAgICAgICAnICcgK1xuICAgICAgICAgICBvdXRwdXQuam9pbignLFxcbiAgJykgK1xuICAgICAgICAgICAnICcgK1xuICAgICAgICAgICBicmFjZXNbMV07XG4gIH1cblxuICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArICcgJyArIG91dHB1dC5qb2luKCcsICcpICsgJyAnICsgYnJhY2VzWzFdO1xufVxuXG5cbi8vIE5PVEU6IFRoZXNlIHR5cGUgY2hlY2tpbmcgZnVuY3Rpb25zIGludGVudGlvbmFsbHkgZG9uJ3QgdXNlIGBpbnN0YW5jZW9mYFxuLy8gYmVjYXVzZSBpdCBpcyBmcmFnaWxlIGFuZCBjYW4gYmUgZWFzaWx5IGZha2VkIHdpdGggYE9iamVjdC5jcmVhdGUoKWAuXG5mdW5jdGlvbiBpc0FycmF5KGFyKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KGFyKTtcbn1cbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5cbmZ1bmN0aW9uIGlzQm9vbGVhbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJztcbn1cbmV4cG9ydHMuaXNCb29sZWFuID0gaXNCb29sZWFuO1xuXG5mdW5jdGlvbiBpc051bGwoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbCA9IGlzTnVsbDtcblxuZnVuY3Rpb24gaXNOdWxsT3JVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsT3JVbmRlZmluZWQgPSBpc051bGxPclVuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cbmV4cG9ydHMuaXNOdW1iZXIgPSBpc051bWJlcjtcblxuZnVuY3Rpb24gaXNTdHJpbmcoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnc3RyaW5nJztcbn1cbmV4cG9ydHMuaXNTdHJpbmcgPSBpc1N0cmluZztcblxuZnVuY3Rpb24gaXNTeW1ib2woYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnc3ltYm9sJztcbn1cbmV4cG9ydHMuaXNTeW1ib2wgPSBpc1N5bWJvbDtcblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbmV4cG9ydHMuaXNVbmRlZmluZWQgPSBpc1VuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNSZWdFeHAocmUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KHJlKSAmJiBvYmplY3RUb1N0cmluZyhyZSkgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufVxuZXhwb3J0cy5pc1JlZ0V4cCA9IGlzUmVnRXhwO1xuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNPYmplY3QgPSBpc09iamVjdDtcblxuZnVuY3Rpb24gaXNEYXRlKGQpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KGQpICYmIG9iamVjdFRvU3RyaW5nKGQpID09PSAnW29iamVjdCBEYXRlXSc7XG59XG5leHBvcnRzLmlzRGF0ZSA9IGlzRGF0ZTtcblxuZnVuY3Rpb24gaXNFcnJvcihlKSB7XG4gIHJldHVybiBpc09iamVjdChlKSAmJlxuICAgICAgKG9iamVjdFRvU3RyaW5nKGUpID09PSAnW29iamVjdCBFcnJvcl0nIHx8IGUgaW5zdGFuY2VvZiBFcnJvcik7XG59XG5leHBvcnRzLmlzRXJyb3IgPSBpc0Vycm9yO1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cbmV4cG9ydHMuaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG5cbmZ1bmN0aW9uIGlzUHJpbWl0aXZlKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnYm9vbGVhbicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdudW1iZXInIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcgfHwgIC8vIEVTNiBzeW1ib2xcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICd1bmRlZmluZWQnO1xufVxuZXhwb3J0cy5pc1ByaW1pdGl2ZSA9IGlzUHJpbWl0aXZlO1xuXG5leHBvcnRzLmlzQnVmZmVyID0gcmVxdWlyZSgnLi9zdXBwb3J0L2lzQnVmZmVyJyk7XG5cbmZ1bmN0aW9uIG9iamVjdFRvU3RyaW5nKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKTtcbn1cblxuXG5mdW5jdGlvbiBwYWQobikge1xuICByZXR1cm4gbiA8IDEwID8gJzAnICsgbi50b1N0cmluZygxMCkgOiBuLnRvU3RyaW5nKDEwKTtcbn1cblxuXG52YXIgbW9udGhzID0gWydKYW4nLCAnRmViJywgJ01hcicsICdBcHInLCAnTWF5JywgJ0p1bicsICdKdWwnLCAnQXVnJywgJ1NlcCcsXG4gICAgICAgICAgICAgICdPY3QnLCAnTm92JywgJ0RlYyddO1xuXG4vLyAyNiBGZWIgMTY6MTk6MzRcbmZ1bmN0aW9uIHRpbWVzdGFtcCgpIHtcbiAgdmFyIGQgPSBuZXcgRGF0ZSgpO1xuICB2YXIgdGltZSA9IFtwYWQoZC5nZXRIb3VycygpKSxcbiAgICAgICAgICAgICAgcGFkKGQuZ2V0TWludXRlcygpKSxcbiAgICAgICAgICAgICAgcGFkKGQuZ2V0U2Vjb25kcygpKV0uam9pbignOicpO1xuICByZXR1cm4gW2QuZ2V0RGF0ZSgpLCBtb250aHNbZC5nZXRNb250aCgpXSwgdGltZV0uam9pbignICcpO1xufVxuXG5cbi8vIGxvZyBpcyBqdXN0IGEgdGhpbiB3cmFwcGVyIHRvIGNvbnNvbGUubG9nIHRoYXQgcHJlcGVuZHMgYSB0aW1lc3RhbXBcbmV4cG9ydHMubG9nID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKCclcyAtICVzJywgdGltZXN0YW1wKCksIGV4cG9ydHMuZm9ybWF0LmFwcGx5KGV4cG9ydHMsIGFyZ3VtZW50cykpO1xufTtcblxuXG4vKipcbiAqIEluaGVyaXQgdGhlIHByb3RvdHlwZSBtZXRob2RzIGZyb20gb25lIGNvbnN0cnVjdG9yIGludG8gYW5vdGhlci5cbiAqXG4gKiBUaGUgRnVuY3Rpb24ucHJvdG90eXBlLmluaGVyaXRzIGZyb20gbGFuZy5qcyByZXdyaXR0ZW4gYXMgYSBzdGFuZGFsb25lXG4gKiBmdW5jdGlvbiAobm90IG9uIEZ1bmN0aW9uLnByb3RvdHlwZSkuIE5PVEU6IElmIHRoaXMgZmlsZSBpcyB0byBiZSBsb2FkZWRcbiAqIGR1cmluZyBib290c3RyYXBwaW5nIHRoaXMgZnVuY3Rpb24gbmVlZHMgdG8gYmUgcmV3cml0dGVuIHVzaW5nIHNvbWUgbmF0aXZlXG4gKiBmdW5jdGlvbnMgYXMgcHJvdG90eXBlIHNldHVwIHVzaW5nIG5vcm1hbCBKYXZhU2NyaXB0IGRvZXMgbm90IHdvcmsgYXNcbiAqIGV4cGVjdGVkIGR1cmluZyBib290c3RyYXBwaW5nIChzZWUgbWlycm9yLmpzIGluIHIxMTQ5MDMpLlxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGN0b3IgQ29uc3RydWN0b3IgZnVuY3Rpb24gd2hpY2ggbmVlZHMgdG8gaW5oZXJpdCB0aGVcbiAqICAgICBwcm90b3R5cGUuXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBzdXBlckN0b3IgQ29uc3RydWN0b3IgZnVuY3Rpb24gdG8gaW5oZXJpdCBwcm90b3R5cGUgZnJvbS5cbiAqL1xuZXhwb3J0cy5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG5cbmV4cG9ydHMuX2V4dGVuZCA9IGZ1bmN0aW9uKG9yaWdpbiwgYWRkKSB7XG4gIC8vIERvbid0IGRvIGFueXRoaW5nIGlmIGFkZCBpc24ndCBhbiBvYmplY3RcbiAgaWYgKCFhZGQgfHwgIWlzT2JqZWN0KGFkZCkpIHJldHVybiBvcmlnaW47XG5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhhZGQpO1xuICB2YXIgaSA9IGtleXMubGVuZ3RoO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgb3JpZ2luW2tleXNbaV1dID0gYWRkW2tleXNbaV1dO1xuICB9XG4gIHJldHVybiBvcmlnaW47XG59O1xuXG5mdW5jdGlvbiBoYXNPd25Qcm9wZXJ0eShvYmosIHByb3ApIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApO1xufVxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIjlBcGZuUFwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIl19
