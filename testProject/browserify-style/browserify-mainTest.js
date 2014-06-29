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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvb3B0L25vZGUvbGliL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9waS9ub2RlLmpzL3Byb2R1Y3Rpb24vTXlXZWJDb21wb25lbnRzL1RlbGVwb3J0Q2xpZW50L3Rlc3RQcm9qZWN0L2Jyb3dzZXJpZnktc3R5bGUvbWFpblRlc3QuanMiLCIvaG9tZS9waS9ub2RlLmpzL3Byb2R1Y3Rpb24vTXlXZWJDb21wb25lbnRzL1RlbGVwb3J0Q2xpZW50L3Rlc3RQcm9qZWN0L2Jyb3dzZXJpZnktc3R5bGUvbm9kZV9tb2R1bGVzL3RlbGVwb3J0LWNsaWVudC9UZWxlcG9ydENsaWVudC5qcyIsIi9vcHQvbm9kZS9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCIvb3B0L25vZGUvbGliL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0c19icm93c2VyLmpzIiwiL29wdC9ub2RlL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwiL29wdC9ub2RlL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvdXRpbC9zdXBwb3J0L2lzQnVmZmVyQnJvd3Nlci5qcyIsIi9vcHQvbm9kZS9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3V0aWwvdXRpbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9TQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgVGVsZXBvcnRDbGllbnQgPSByZXF1aXJlKCd0ZWxlcG9ydC1jbGllbnQnKTtcbnZhciB1dGlsID0gcmVxdWlyZSgndXRpbCcpO1xuXG53aW5kb3cudGVsZXBvcnRDbGllbnQgPSBuZXcgVGVsZXBvcnRDbGllbnQoe1xuXHRcdHNlcnZlckFkZHJlc3M6IFwid3M6Ly9sb2NhbGhvc3Q6ODAwMFwiLFxuXHRcdGF1dG9SZWNvbm5lY3Q6IDMwMDBcblx0fSlcblx0Lm9uKCdkZWJ1ZycsIGNvbnNvbGUuZGVidWcuYmluZChjb25zb2xlKSlcblx0Lm9uKCdpbmZvJywgY29uc29sZS5pbmZvLmJpbmQoY29uc29sZSkpXG5cdC5vbignd2FybicsIGNvbnNvbGUud2Fybi5iaW5kKGNvbnNvbGUpKVxuXHQub24oJ2Vycm9yJywgY29uc29sZS5lcnJvci5iaW5kKGNvbnNvbGUpKVxuXHQub24oJ3JlYWR5JywgZnVuY3Rpb24ob2JqZWN0c1Byb3BzKSB7XG5cdFx0Ly9mb3IgRGVidWdpbmdcblx0XHR3aW5kb3cuc2ltcGxlT2JqZWN0ID0gdGVsZXBvcnRDbGllbnQub2JqZWN0cy5zaW1wbGVPYmplY3Q7O1xuXG5cdFx0LypldmVudHMqL1xuXHRcdHNpbXBsZU9iamVjdFxuXHRcdFx0Lm9uKFxuXHRcdFx0XHQnZXZlbnRXaXRoTXlPcHRpb25zJyxcblx0XHRcdFx0Q3JlYXRlRXZlbnRMb2dnZXIoJ3NpbXBsZU9iamVjdCcsICdldmVudFdpdGhNeU9wdGlvbnMnKSlcblx0XHRcdC5vbihcblx0XHRcdFx0J2V2ZW50V2l0aG91dEFyZ3MnLFxuXHRcdFx0XHRDcmVhdGVFdmVudExvZ2dlcignc2ltcGxlT2JqZWN0JywgJ2V2ZW50V2l0aG91dEFyZ3MnKSlcblx0XHRcdC5vbihcblx0XHRcdFx0J2V2ZW50V2l0aFVubGltQXJncycsXG5cdFx0XHRcdENyZWF0ZUV2ZW50TG9nZ2VyKCdzaW1wbGVPYmplY3QnLCAnZXZlbnRXaXRoVW5saW1BcmdzJykpXG5cdFx0XHQub24oXG5cdFx0XHRcdCcxMHNlY0ludGVydmFsRXZlbnQnLFxuXHRcdFx0XHRDcmVhdGVFdmVudExvZ2dlcignc2ltcGxlT2JqZWN0JywgJzEwc2VjSW50ZXJ2YWxFdmVudCcpKTtcblxuXG5cdFx0LypmdW5jcyB3aXRoIGNhbGxiYWNrKi9cblx0XHRzaW1wbGVPYmplY3Rcblx0XHRcdC5mdW5jKFxuXHRcdFx0XHQnc2ltZXBsZVBhcmFtJyxcblx0XHRcdFx0Q3JlYXRlQ2FsbGJhY2tMb2dnZXIoJ3NpbXBsZU9iamVjdCcsICdmdW5jJykpXG5cdFx0XHQuZnVuY1dpdGhvdXRBcmdzKFxuXHRcdFx0XHRDcmVhdGVDYWxsYmFja0xvZ2dlcignc2ltcGxlT2JqZWN0JywgJ2Z1bmNXaXRob3V0QXJncycpKVxuXG5cdFx0LypmdW5jcyB3aXRob3V0IGNhbGxiYWNrKi9cblx0XHRzaW1wbGVPYmplY3Rcblx0XHRcdC5mdW5jV2l0aFVubGltQXJncyhmYWxzZSwgJzEnLCAyLCAzKVxuXHRcdFx0LmZ1bmNXaXRoMTBTZWNEZWxheSgpO1xuXG5cdH0pLmluaXQoKTtcblxuXG5mdW5jdGlvbiBDcmVhdGVFdmVudExvZ2dlcihvYmplY3ROYW1lLCBldmVudE5hbWUpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdHZhciBvYmogPSB7XG5cdFx0XHRkZXNjOiB1dGlsLmZvcm1hdChcIlslcy5ldmVudF0gSW5mbzog0L/QvtC70YPRh9C10L3QviDRgdC+0LHRi9GC0LjQtSAlc1wiLCBvYmplY3ROYW1lLCBldmVudE5hbWUpLFxuXHRcdFx0YXJndW1lbnRzOiBhcmd1bWVudHNcblx0XHR9O1xuXG5cdFx0dmFyIGRldGFpbHMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkZXRhaWxzJyk7XG5cdFx0ZGV0YWlscy5pbm5lckhUTUwgPSBcIjxzdW1tYXJ5PlwiICsgb2JqLmRlc2MgKyBcIjwvc3VtbWFyeT5cIiArIFwiPHByZT5cIiArIEpTT04uc3RyaW5naWZ5KG9iaiwgJyAnLCA0KSArIFwiPC9wcmVcIjtcblxuXHRcdHZhciB3ZWxjb20gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2VsY29tJyk7XG5cdFx0d2VsY29tLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGRldGFpbHMsIHdlbGNvbSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gQ3JlYXRlQ2FsbGJhY2tMb2dnZXIob2JqZWN0TmFtZSwgbWV0aG9kTmFtZSkge1xuXHRyZXR1cm4gZnVuY3Rpb24oZXJyb3IsIHJlc3VsdCkge1xuXHRcdHZhciBvYmogPSB7XG5cdFx0XHRkZXNjOiB1dGlsLmZvcm1hdChcIlslcy5jYWxsYmFja10gSW5mbzog0LLQtdGA0L3Rg9C70YHRjyDRgNC10LfRg9C70YzRgtCw0YIg0LLRi9C30L7QstCwINC80LXRgtC+0LTQsCAlc1wiLCBvYmplY3ROYW1lLCBtZXRob2ROYW1lKSxcblx0XHRcdHJlc3VsdDogcmVzdWx0LFxuXHRcdFx0ZXJyb3I6IGVycm9yXG5cdFx0fTtcblxuXG5cdFx0dmFyIGRldGFpbHMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkZXRhaWxzJyk7XG5cdFx0ZGV0YWlscy5pbm5lckhUTUwgPSBcIjxzdW1tYXJ5PlwiICsgb2JqLmRlc2MgKyBcIjwvc3VtbWFyeT5cIiArIFwiPHByZT5cIiArIEpTT04uc3RyaW5naWZ5KG9iaiwgJyAnLCA0KSArIFwiPC9wcmVcIjtcblxuXHRcdHZhciB3ZWxjb20gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2VsY29tJyk7XG5cdFx0d2VsY29tLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGRldGFpbHMsIHdlbGNvbSk7XG5cdH1cbn0iLCIvKipcblx0aHR0cHM6Ly9naXRodWIuY29tL25za2F6a2kvd2ViLVRlbGVwb3J0Q2xpZW50XG5cdE1JVFxuXHRmcm9tIHJ1c3NpYSB3aXRoIGxvdmUsIDIwMTRcbiovXG5cblxuLypcbm5lZWQgaW5jbHVkZTpcblx0bXktaGVscGVycy91dGlsLmpzXG5cdG15LWhlbHBlcnMvRXZlbnRFbWl0dGVyLmpzXG4qL1xuXG4vKlxuXHRyZXF1aXJlanMuY29uZmlnKHtcblx0XHRwYXRoczoge1xuXHRcdFx0RXZlbnRFbWl0dGVyOiAnYm93ZXJfY29tcG9uZW50cy9teS1oZWxwZXJzL0V2ZW50RW1pdHRlcicsXG5cdFx0XHR1dGlsOiAnYm93ZXJfY29tcG9uZW50cy9teS1oZWxwZXJzL3V0aWwnXG5cdFx0fVxuXHR9KTtcblxuXHRvclxuXHRcblx0PHNjcmlwdCBzcmM9XCIuL2pzL3NvbWVMaWJzRm9sZGVyL215LWhlbHBlcnMvRXZlbnRFbWl0dGVyLmpzXCIgdHlwZT1cInRleHQvamF2YXNjcmlwdFwiPjwvc2NyaXB0PlxuXHQ8c2NyaXB0IHNyYz1cIi4vanMvc29tZUxpYnNGb2xkZXIvbXktaGVscGVycy91dGlsLmpzXCIgdHlwZT1cInRleHQvamF2YXNjcmlwdFwiPjwvc2NyaXB0PlxuXG5cdG9yIFxuXG5cdHVzZSBicm93c2VyaWZ5IDopXG4qL1xuXG4vKlxuXHRQdWJsaWM6XG5cblx0XHRpbml0XG5cdFx0ZGVzdHJveVx0XHRcdFxuXG5cdEV2ZW50czpcblxuXHRcdGRlYnVnIFxuXHRcdGluZm8gXG5cdFx0d2FybiBcblx0XHRlcnJvciBcdFxuXG5cdFx0cmVhZHlcblx0XHRjbG9zZVxuXHRcdGRlc3Ryb3llZFxuXHRcdFxuXHRcdHJlY29ubmVjdGVkXG5cdFx0cmVjb25uZWN0aW5nXG5cblx0XHRyZWNvbm5lY3RlZFRvTmV3U2VydmVyXG5cdFx0cmVjb25uZWN0ZWRUb09sZFNlcnZlclxuXG5cdFx0c2VydmVyT2JqZWN0c0NoYW5nZWRcbiovXG5cblwidXNlIHN0cmljdFwiO1xuXG4oZnVuY3Rpb24obmFtZXNwYWNlKSB7XG5cblx0aWYgKG5hbWVzcGFjZS5kZWZpbmUgJiYgbmFtZXNwYWNlLnJlcXVpcmVqcykge1xuXHRcdC8qKlxuXHRcdFx00KDQsNC3INC10YHRgtGMIGRlZmluZSDQuCByZXF1aXJlanMg0LfQvdCw0YfQuNGCINC/0L7QtNC60LvRjtGH0LXQvSByZXF1aXJlanMuXG5cdFx0XHTQl9Cw0LLQuNGB0LjQvNC+0YHRgtC4INCx0YPQtNC10YIg0L/QtdGA0LXQtNCw0L3QvdGLINCyIENyZWF0ZVRlbGVwb3J0U2VydmVyLCBcblx0XHRcdNC60L7RgtC+0YDRi9C5INCy0LXRgNC90LXRgiDRgdGE0L7RgNC80LjRgNC+0LLQsNC90L3Ri9C5INC60LvQsNGB0YEgVGVsZXBvcnRDbGllbnRcblxuXHRcdCovXG5cdFx0ZGVmaW5lKFxuXHRcdFx0W1xuXHRcdFx0XHQnRXZlbnRFbWl0dGVyJyxcblx0XHRcdFx0J3V0aWwnXG5cdFx0XHRdLFxuXHRcdFx0Q3JlYXRlVGVsZXBvcnRTZXJ2ZXIpO1xuXHR9IGVsc2UgaWYgKGlzTW9kdWxlKCkpIHtcblx0XHQvKipcblx0XHRcdNCg0LDQtyDQtdGB0YLRjCBtb2R1bGUuZXhwb3J0cyDQt9C90LDRh9C40YIgYnJvd3NlcmlmeSDRgdC10LnRh9Cw0YEg0L/QvtC00LrQu9GO0YfQsNC10YIg0Y3RgtC+0YIg0LzQvtC00YPQu9GMXG5cdFx0XHTQl9Cw0LLQuNGB0LjQvNC+0YHRgtC4INGD0LTQvtCy0LvQtdGC0LLQvtGA0LjRgiDRgdCw0LwgYnJvd3NlcmlmeS4gXG5cblx0XHQqL1xuXG5cdFx0dmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblx0XHR2YXIgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKTtcblxuXHRcdG1vZHVsZS5leHBvcnRzID0gQ3JlYXRlVGVsZXBvcnRTZXJ2ZXIoRXZlbnRFbWl0dGVyLCB1dGlsKTtcblx0fSBlbHNlIHtcblx0XHQvKipcblx0XHRcdNCY0L3QsNGH0LUg0YHRh9C40YLQsNGOLCDRh9GC0L4gVGVsZXBvcnRDbGllbnQg0L/QvtC00LrQu9GO0YfQtdC9INCyIFwi0LrQu9Cw0YHRgdC40YfQtdGB0LrQuNC5XCJcblx0XHRcdNC/0YDQvtC10LrRgiwg0LfQsNCy0LjRgdC40LzQvtGB0YLQuCDRg9C00L7QstC70LXRgtCy0L7RgNC10L3RiyDRgNCw0LfRgNCw0LHQvtGC0YfQuNC60L7QvCDQv9GA0L7QtdC60YLQsCDQutC+0YLQvtGA0L7QvNGDINC80L7QuSBcblx0XHRcdNC60LvQsNGB0YEg0L/QvtC90LDQtNC+0LHQuNC70YHRjywg0Lgg0LTQvtCx0LDQstC70Y/RjiDRgdGE0L7RgNC80LjRgNC+0LLQsNC90L3Ri9C5INC60LvQsNGB0YEg0LIg0LPQu9C+0LHQsNC70YzQvdC+0LUg0L/RgNC+0YHRgtGA0LDQvdGB0YLQstC+INC40LzQtdC9LlxuXG5cdFx0Ki9cblx0XHRuYW1lc3BhY2UuVGVsZXBvcnRDbGllbnQgPSBDcmVhdGVUZWxlcG9ydFNlcnZlcihFdmVudEVtaXR0ZXIsIHV0aWwpO1xuXHR9XG5cblx0ZnVuY3Rpb24gaXNNb2R1bGUoKSB7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBtb2R1bGUgJiYgbW9kdWxlLmV4cG9ydHM7XG5cdFx0fSBjYXRjaCAoZXgpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBDcmVhdGVUZWxlcG9ydFNlcnZlcihFdmVudEVtaXR0ZXIsIHV0aWwpIHtcblx0XHR1dGlsLmluaGVyaXRzKFRlbGVwb3J0Q2xpZW50LCBFdmVudEVtaXR0ZXIpO1xuXG5cdFx0LyoqXG5cdFx0XHTQrdGC0L4gUlBDINC60LvQuNC10L3Rgiwg0YPQvNC10LXRgiDQstGL0LfRi9Cy0LDRgtGMINC80LXRgtC+0LTRiyDRgtC10LvQtdC/0L7RgNGC0LjRgNC+0LLQsNC90L3Ri9GFINC+0LHRitC10LrRgtC+0LIg0Lgg0L/QvtC70YPRh9Cw0YLRjCDRgdC+0LHQuNGC0LjRjyDQuNC80Lgg0LLRi9Cx0YDQsNGB0YvQstCw0LXQvNGL0LUuIFxuXHRcdFx00KLQsNC60LbQtSDRg9C80LXQtdGCINCy0L7RgdGB0YLQsNC90LDQstC70LjQstCw0YLRjCDRgdC+0LXQtNC40L3QtdC90LjQtSDRgSDRgdC10YDQstC10YDQvtC8INCyINGB0LvRg9GH0LDQtSDRgNCw0LfRgNGL0LLQsCDRgdC+0LXQtNC40L3QtdC90LjRjy5cblxuXHRcdFx00JrQvtC90YHRgtGA0YPQutGC0L7RgCDQutC70LDRgdGB0LAgVGVsZXBvcnRDbGllbnQsINC/0YDQuNC90LjQvNCw0LXRgiDQtdC00LjQvdGB0YLQstC10L3QvdGL0Lwg0L/QsNGA0LDQvNC10YLRgNC+0Lwg0L7QsdGK0LXQutGCINGBINC+0L/RhtC40Y/QvNC4LFxuXHRcdFx00LLQvtC30LLRgNCw0YnQsNC10YIg0L3QvtCy0YvQuSDQvdC10LjQvdC10YbQuNCw0LvQuNC30LjRgNC+0LLQsNC90L3Ri9C5INC+0LHRitC10LrRgiDQutC70LDRgdGB0LAgVGVsZXBvcnRDbGllbnRcblx0XHRcdFxuXHRcdFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblx0XHRcdG9wdGlvbnMgPSB7XG5cdFx0XHRcdHNlcnZlckFkZHJlc3M6IFwid3M6Ly9sb2NhbGhvc3Q6ODAwMFwiLFxuXHRcdFx0XHRhdXRvUmVjb25uZWN0OiAzMDAwXG5cdFx0XHR9XG5cblx0XHRcdHNlcnZlckFkZHJlc3MgLSDQsNC00YDQtdGBIFRlbGVwb3J0U2VydmVyXG5cdFx0XHRcdGRlZmF1bHQ6IFwid3M6Ly9sb2NhbGhvc3Q6ODAwMFwiXG5cblx0XHRcdGF1dG9SZWNvbm5lY3QgLSDQstGA0LXQvNGPINC30LDQtNC10YDQttC60Lgg0L/QtdGA0LXQtCDQv9C+0L/Ri9GC0LrQvtC5INC/0LXRgNC10L/QvtC00LrQu9GO0YfQvdC40Y8g0Log0YHQtdGA0LLQtdGA0YMuXG5cdFx0XHRcdNC10YHQu9C4INGH0LjRgdC70L4gLSDRgtC+INGN0YLQviDQstGA0LXQvNGPINC30LDQtNC10YDQttC60Lgg0LIg0LzQuNC70LvQtdGB0LXQutGD0L3QtNCw0YVcblx0XHRcdFx00LXRgdC70LggZmFsc2UgLSDRgtC+INC/0LXRgNC10L/QvtC00LrQu9GO0YfQtdC90LjRjyDQvdC1INCx0YPQtNC10YIg0LLRi9C/0L7Qu9C90LXQvdC90L4uXG5cdFx0XHRcdGRlZmF1bHQ6IDMwMDAgbXNlY1xuXG5cdFx0XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdFx0XHTRhNC+0YDQvNCw0YIg0LjQvdC40YbQuNCw0LvQuNGA0YPQtdC80YvRhSDQv9C+0LvQtdC5OlxuXG5cdFx0XHTQnNCw0YHRgdC40LIg0YEg0LrQsNC70LHQtdC60LDQvNC4INC00LvRjyDQstGL0LfQstCw0L3QvdGL0YUg0YLQtdC70LXQv9C+0YDRgtC40YDQvtCy0LDQvdC90YvRhSDQvNC10YLQvtC00L7Qsi5cblx0XHRcdNCyINC60LDQttC00L7QvCDRgdC+0L7QsdGJ0LXQvdC40LUg0YPRhdC+0LTRj9GJ0LXQvCDQvdCwINGB0LXRgNCy0LXRgCDQtdGB0YLRjCDQv9C+0LvQtSByZXF1ZXN0SWQsINC30L3QsNGH0LXQvdC40LUg0LIg0Y3RgtC+0Lwg0L/QvtC70LUg0Y3RgtC+INC40L3QtNC10LrRgSDQutCw0LvQu9Cx0LXQutCwINCyINGN0YLQvtC8INC80LDRgdGB0LjQstC1OlxuXHRcdFx0XG5cdFx0XHRcdHRoaXMuX3ZhbHVlUmVxdWVzdHMgPSBbXG5cdFx0XHRcdFx0MTogc29tZUNhbGxiYWNrLFxuXHRcdFx0XHRcdDI6IHNlY29uZENhbGxiYWNrXG5cdFx0XHRcdF1cblx0XHRcdFxuXHRcdFx00J7QsdGK0LXQutGCINGB0L7QtNC10YDQttCw0YnQuNC5INGB0LLQvtC50YHRgtCy0LAg0YLQtdC70LXQv9C+0YDRgtC40YDRg9C10LzRi9GFINC+0LHRitC10LrRgtC+0LIsINC60L7RgtC+0YDRi9C1INC/0YDQvtC40L3QuNGG0LjQsNC70LjQt9C40YDRg9GO0YIg0L7QsdGK0LXQutGC0Ysg0LIgdGhpcy5vYmplY3RzXG5cdFx0XHTQn9C+0LvRg9GH0LDRjiDQv9GA0Lgg0L/QtdGA0LLQvtC8INGD0YHQv9C10YjQvdC+0Lwg0YHQvtC10LTQuNC90LXQvdC40Lgg0YEg0YHQtdGA0LLQtdGA0L7QvC5cblxuXHRcdFx00JXRgdC70Lgg0L/RgNC+0LjQt9C+0LnQtNC10YIg0YDQsNC30YrQtdC00LjQvdC10L3QuNC1INGBINGB0LXRgNCy0LXRgNC+0Lwg0L/QviDQv9GA0LjRh9C40L3QtSDQs9GA0YPRgdGC0L3Ri9GFINC40L3RgtC10YDQvdC10YLQvtCyLCDRgtC+INC/0LXRgNC10LfQsNC/0YDQsNGI0LjQstCw0YLRjCDQtdCz0L4g0L3QtdGCINGB0LzRi9GB0LvQsCwg0L/QvtGC0L7QvNGDINGH0YLQviDQvdCwINGB0LXRgNCy0LXRgNC1INC90LjRh9C10LPQviDQvdC1INC/0L7QvNC10L3Rj9C70L7RgdGMLlxuXHRcdFx00JXRgdC70Lgg0LbQtSDRgNCw0LfRitC10LTQuNC90LjQu9C+INC/0L7RgtC+0LzRgyDRh9GC0L4g0YHQtdGA0LLQtdGAINCx0YvQuyDQv9C10YDQtdC30LDQv9GD0YnQtdC90L0sINGC0L4g0YHQstC+0LnRgdGC0LLQsCDRgtC10LvQtdC/0L7RgNGC0LjRgNGD0LXQvNC80YvRhSDQvtCx0YrQtdC60YLQvtCyINCx0YPQtNGD0YIg0L/QtdGA0LXQt9Cw0L/RgNC+0YjQtdC90L3Riy5cblx0XHRcdFx0KiDQldGB0LvQuCDQvtC90Lgg0L3QtSDQuNC30LzQtdC90LjQu9C40YHRjCwg0YLQviDRgNCw0LHQvtGC0LAg0LHRg9C00LXRgiDQv9GA0L7QtNC+0LvQttC10L3QvdCwLlxuXHRcdFx0XHQqINCY0LvQuCDQuNC30LzQtdC90LjQu9C40YHRjCwg0YLQviDQsdGD0LTQtdGCINCy0YvQsdGA0L7RiNC10L3QvdC+INGB0L7QsdGL0YLQuNC1IGBzZXJ2ZXJPYmplY3RzQ2hhbmdlZGAgXG5cdFx0XHRcdCAqINC4INGPINCx0Ysg0L3QsCDQvNC10YHRgtC1INGB0LvQvtCy0LjQstGI0LXQs9C+INC10LPQviDQv9GA0L7Qs9GA0LDQvNC80LjRgdGC0LAg0LLRi9Cy0YvQtdC7INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjiDQv9GA0LXQtNC70L7QttC10L3QuNC1INC/0LXRgNC10LfQsNCz0YDRg9C30LjRgtGMINGB0YLRgNCw0L3QuNGG0YMuXG5cdFx0XHRcdCAgINCf0L7RgtC+0LzRgyDRh9GC0L4g0LjQt9C80LXQvdC10L3QuNC1INC90LDQsdC+0YDQsCDRgdC10YDQstC10YDQvdGL0YUg0L7QsdGK0LXQutGC0L7QsiDQvdC10LzQuNC90YPQtdC80L4gKNC+0LHRi9GH0L3Qvikg0LLQu9C10YfQtdGCINC40LfQvNC10L3QtdC90LjQtSDQutC70LjQtdC90YLRgdC60L7Qs9C+INGB0YbQtdC90LDRgNC40Y8sINC4INGH0YLQvtCx0Ysg0LXQs9C+INC+0LHQvdC+0LLQuNGC0Yxcblx0XHRcdFx0ICAg0L3Rg9C20L3QviDQvtCx0L3QvtCy0LjRgtGMINGB0YLRgNCw0L3QuNGH0LrRgyAo0L3QsNGB0LrQvtC70YzQutC+INC80L3QtSDQuNC30LLQtdGB0YLQvdC+INC90LDQs9C+0YDRj9GH0YPRjiBqcyDRgdC60YDQuNC/0YLRiyDQv9C+0LTQvNC10L3Rj9GC0Ywg0L3QtdC70YzQt9GPKS5cblx0XHRcdFx0ICog0KLQsNC60LbQtSDQvdC10YHQvNC+0YLRgNGPINC90LAg0YLQviDRh9GC0L4g0LHRi9C70Lgg0L/QvtC70YPRh9C10L3QvdGLINC90L7QstGL0LUg0YHQstC+0LnRgdGC0LLQsCxcblx0XHRcdFx0ICAg0L7QvdC4INC90LUg0LHRg9C00YPRgiDQv9C+0LzQtdGJ0LXQvdC90Ysg0LIgdGhpcy5fdmFsdWVTZXJ2ZXJPYmplY3RzUHJvcHMg0LggdGhpcy5vYmplY3RzINC90LUg0LHRg9C00LXRgiDQuNC30LzQtdC90LXQvdC9LlxuXHRcdFx0XHQgICDQuNC30LzQtdC90LjRgtGM0YHRjyDRgtC+0LvRjNC60L4g0YTQu9Cw0LMgdGhpcy5pc1NlcnZlck9iamVjdENoYW5nZWQgPSB0cnVlO1xuXG5cdFx0XHRcdHRoaXMuX3ZhbHVlU2VydmVyT2JqZWN0c1Byb3BzID0ge1xuXHRcdFx0XHRcdCdzb21lU2VydmVyT2JqZWN0TmFtZSc6IHtcblx0XHRcdFx0XHRcdGV2ZW50czogWydmaXJzdFBlcm1pdGVkRXZlbnROYW1lJywgJ3NlY29uZFBlcm1pdGVkRXZlbnROYW1lJ10sXG5cdFx0XHRcdFx0XHRtZXRob2RzOiBbJ2ZpcnN0TWV0aG9kTmFtZScsICdzZWNvbmRNZXRob2ROYW1lJ11cblx0XHRcdFx0XHR9LCAuLi5cblx0XHRcdFx0fVxuXG5cdFx0XHTQntCx0YrQtdC60YIg0YHQvtC00LXRgNC20LDRidC40Lkg0LIg0YHQtdCx0LUg0L/RgNC+0LjQvdC40YbQuNCw0LvQuNC30LjRgNC+0LLQsNC90L3Ri9C1INGC0LXQu9C10L/QvtGA0YLQuNGA0L7QstCw0L3QvdGL0LUg0L7QsdGK0LXQutGC0YsuXG5cdFx0XHTQoyDQvdC40YUg0LXRgdGC0Ywg0L3QtdGB0LrQvtC70YzQutC+INGB0LvRg9C20LXQsdC90YvRhSDQv9C+0LvQtdC5INC4INC80LXRgtC+0LTRiyDRg9C90LDRgdC70LXQtNC+0LLQsNC90L3Ri9C1INC+0YIg0LrQu9Cw0YHRgdCwIEV2ZW50RW1ldHRlci5cblx0XHRcdFxuXHRcdFx00JzQtdGC0L7QtNGLINGB0L7Qt9C00LDQstCw0LXQvNGL0LUg0LLQvdGD0YLRgNC4INGC0LXQu9C10L/QvtGA0YLQuNGA0L7QstCw0L3QvdC+0LPQviDQvtCx0YrQtdC60YLQsCDRgNCw0LfQsdC40YDQsNGO0YIg0L/RgNC40YXQvtC00Y/RidC40Lkg0L/RgdC10LLQtNC+0LzQsNGB0YHQuNCyIGFyZ3VtZW50cyBcblx0XHRcdNCy0YvQtNC10LvRj9GO0YIg0LjQtyDQvdC10LPQviDQsNGA0LPRg9C80LXQvdGC0Ysg0LTQu9GPINC80LXRgtC+0LTQsCDQuCDQutCw0LvQsdC10LogKNC10YHQu9C4INC60LDQu9Cx0LXQutCwINC90LXRgiwg0YLQviDRgdC+0LfQtNCw0LXRgtGB0Y8g0LfQsNCz0LvRg9GI0LrQsClcblx0XHRcdNC30LDQv9GA0L7RgdGDINC/0YDQuNGB0LLQsNC10LLQsNGC0LXRgdGPIHJlcXVlc3RJZCwg0LrQsNC70LvQsdC10Log0L/QvtC0INGN0YLQuNC8IGlkINC/0L7QvNC10YnQsNC10YLRgdGPINCyIHRoaXMuX3ZhbHVlUmVxdWVzdHNcblx0XHRcdNC4INC30LDQv9GA0L7RgSDQvtGC0L/RgNCw0LLQu9GP0LXRgtGB0Y8g0L3QsCDRgdC10YDQstC10YAuXG5cblx0XHRcdHRoaXMub2JqZWN0cyA9IHtcblx0XHRcdFx0J3NvbWVTZXJ2ZXJPYmplY3ROYW1lJzoge1xuXHRcdFx0XHRcdF9fZXZlbnRzX186IFsnZmlyc3RQZXJtaXRlZEV2ZW50TmFtZScsICdzZWNvbmRQZXJtaXRlZEV2ZW50TmFtZSddLFxuXHRcdFx0XHRcdF9fbWV0aG9kc19fOiBbJ2ZpcnN0TWV0aG9kTmFtZScsICdzZWNvbmRNZXRob2ROYW1lJ10sXG5cdFx0XHRcdFx0Zmlyc3RNZXRob2ROYW1lOiBmdW5jdGlvbihhcmdzLCBzZWNvbmRBcmcsIGNhbGxiYWNrKSB7Li4ufSxcblx0XHRcdFx0XHRzZWNvbmRNZXRob2ROYW1lOiBmdW5jdGlvbihjYWxsYmFjaykgey4uLn0sXG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdCovXG5cdFx0ZnVuY3Rpb24gVGVsZXBvcnRDbGllbnQob3B0aW9ucykge1xuXHRcdFx0Ly9vcHRpb25zXG5cdFx0XHR0aGlzLl9vcHRpb25Xc1NlcnZlckFkZHJlc3MgPSBvcHRpb25zLnNlcnZlckFkZHJlc3MgfHwgXCJ3czovL2xvY2FsaG9zdDo4MDAwXCI7XG5cdFx0XHR0aGlzLl9vcHRpb25BdXRvUmVjb25uZWN0ID0gKG9wdGlvbnMuYXV0b1JlY29ubmVjdCA9PT0gdW5kZWZpbmVkKSA/IDMwMDAgOiBvcHRpb25zLmF1dG9SZWNvbm5lY3Q7XG5cblx0XHRcdC8vZW5kIG9wdGlvbnNcblxuXHRcdFx0Ly9wcml2YXRlXG5cdFx0XHR0aGlzLl92YWx1ZVdzQ2xpZW50ID0gbnVsbDtcblx0XHRcdHRoaXMuX3ZhbHVlUmVxdWVzdHMgPSBbXTtcblx0XHRcdHRoaXMuX3ZhbHVlSW50ZXJuYWxSZXF1ZXN0cyA9IFtdO1xuXG5cdFx0XHR0aGlzLl92YWx1ZVNlcnZlck9iamVjdHNQcm9wcyA9IG51bGw7XG5cdFx0XHR0aGlzLl92YWx1ZUlzSW5pdCA9IGZhbHNlO1xuXG5cdFx0XHR0aGlzLl92YWx1ZVBlZXJJZCA9IG51bGw7XG5cdFx0XHR0aGlzLl92YWx1ZVBlZXJUaW1lc3RhbXAgPSBudWxsO1xuXG5cdFx0XHR0aGlzLl92YWx1ZVNlcnZlclRpbWVzdGFtcCA9IG51bGw7XG5cdFx0XHR0aGlzLl92YWx1ZUlzUmVhZHlFbWl0ZWQgPSBmYWxzZTtcblxuXHRcdFx0Ly9lbmQgcHJpdmF0ZVxuXG5cdFx0XHQvL3B1YmxpY1xuXHRcdFx0dGhpcy5vYmplY3RzID0ge307XG5cdFx0XHR0aGlzLmlzU2VydmVyT2JqZWN0Q2hhbmdlZCA9IGZhbHNlO1xuXG5cdFx0XHQvL2VuZCBwdWJsaWNcblx0XHR9XG5cblx0XHQvL3B1YmxpY1xuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAoIXRoaXMuX3ZhbHVlSXNJbml0KSB7XG5cdFx0XHRcdHRoaXMuX3ZhbHVlUGVlclRpbWVzdGFtcCA9IG5ldyBEYXRlKCk7XG5cdFx0XHRcdHRoaXMuX2Z1bmNXc0luaXQoKTtcblxuXHRcdFx0XHR0aGlzLl92YWx1ZUlzSW5pdCA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHRcdNCc0LXRgtC+0LQg0LTQtdGB0YLRgNGD0LrRgtC+0LIg0LfQsNC60YDRi9Cy0LDQtdGCINGB0L7QtdC00LjQvdC10L3QuNC1INGBINGB0LXRgNCy0LXRgNC+0LwsINCy0YvQt9GL0LLQsNC10YIg0LLRgdC1INC+0LbQuNC00LDRjtGJ0LjQtSDRgNC10LfRg9C70YzRgtCw0YIg0LrQsNC70LXQutC4INGBINC+0YjQuNCx0LrQvtC5LlxuXHRcdFx00L7Rh9C40YnQsNC10YIg0L3QtdGB0LrQvtC70YzQutC+INGB0LvRg9C20LXQsdC90YvRhSDQv9C+0LvQtdC5INC4INC90LDQutC+0L3QtdGGINCy0YvQsdGA0LDRgdGL0LLQsNC10YIgYGRlc3Ryb3llZGBcblxuXHRcdCovXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcblx0XHRcdGlmICh0aGlzLl92YWx1ZUlzSW5pdCkge1xuXHRcdFx0XHR0aGlzLmVtaXQoJ2luZm8nLCB7XG5cdFx0XHRcdFx0ZGVzYzogJ1tUZWxlcG9ydENsaWVudF0gSW5mbzog0KDQsNCx0L7RgtCwINC60LvQuNC10L3RgtCwINGI0YLQsNGC0L3QviDQv9GA0LXQutGA0LDRidC10L3QsCwg0L3QsCDQstGB0LUg0LrQsNC70LHQtdC60Lgg0LHRg9C00LXRgiDQstC+0LfQstGA0LDRidC10L3QsCDQvtGI0LjQsdC60LAsINGB0L7QtdC00LjQvdC10L3QuNC1INGBINGB0LXRgNCy0LXRgNC+0Lwg0LHRg9C00LXRgiDQt9Cw0LrRgNGL0YLQvi4nXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRoaXMuX2Z1bmNDbG9zZUFsbFJlcXVlc3RzKCk7XG5cblx0XHRcdFx0dGhpcy5vYmplY3RzID0ge307XG5cdFx0XHRcdHRoaXMuX3ZhbHVlU2VydmVyT2JqZWN0c1Byb3BzID0ge307XG5cdFx0XHRcdHRoaXMuX3ZhbHVlSXNJbml0ID0gZmFsc2U7XG5cdFx0XHRcdHRoaXMuX3ZhbHVlUGVlcklkID0gbnVsbDtcblx0XHRcdFx0dGhpcy5fdmFsdWVTZXJ2ZXJUaW1lc3RhbXAgPSBudWxsO1xuXHRcdFx0XHR0aGlzLl92YWx1ZVBlZXJUaW1lc3RhbXAgPSBudWxsO1xuXHRcdFx0XHR0aGlzLl92YWx1ZUlzUmVhZHlFbWl0ZWQgPSBmYWxzZTtcblxuXHRcdFx0XHR0aGlzLnJlbW92ZUFsbExpc3RlbmVycygnX19yZWNvbm5lY3RlZFRvT2xkU2VydmVyX18nKTtcblx0XHRcdFx0dGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ19fcmVjb25uZWN0ZWRUb05ld1NlcnZlcl9fJyk7XG5cblx0XHRcdFx0aWYgKHRoaXMuX3ZhbHVlV3NDbGllbnQpIHtcblx0XHRcdFx0XHR0aGlzLl9mdW5jV3NDbG9zZSgpO1xuXHRcdFx0XHRcdHRoaXMuZW1pdCgnY2xvc2UnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuZW1pdCgnZGVzdHJveWVkJyk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH07XG5cblx0XHQvL2VuZCBwdWJsaWNcblxuXHRcdC8vcHJpdmF0ZVxuXHRcdC8vd3MgY2xpZW50XG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jV3NJbml0ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLl92YWx1ZVdzQ2xpZW50ID0gbmV3IFdlYlNvY2tldCh0aGlzLl9vcHRpb25Xc1NlcnZlckFkZHJlc3MpO1xuXG5cdFx0XHQvL29ubWVzc2FnZVxuXHRcdFx0dGhpcy5fdmFsdWVXc0NsaWVudC5vbm1lc3NhZ2UgPSB0aGlzLl9mdW5jV3NPbk1lc3NhZ2UuYmluZCh0aGlzKTtcblxuXHRcdFx0Ly9vbm9wZW5cblx0XHRcdHRoaXMuX3ZhbHVlV3NDbGllbnQub25vcGVuID0gKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLmVtaXQoJ2luZm8nLCB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIEluZm86INGB0L7QtdC00LjQvdC10L3QuNC1INGBINGB0LXRgNCy0LXRgNC+0Lwg0YPRgdGC0LDQvdC+0LLQu9C10L3QvdC+XCJcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsR2V0U2VydmVyVGltZXN0YW1wKFxuXHRcdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbEhhbmRsZXJHZXRUaW1lc3RhbXAuYmluZCh0aGlzKSk7XG5cdFx0XHR9LmJpbmQodGhpcykpO1xuXG5cdFx0XHQvL29uZXJyb3Jcblx0XHRcdHRoaXMuX3ZhbHVlV3NDbGllbnQub25lcnJvciA9IChmdW5jdGlvbihlcnJvcikge1xuXHRcdFx0XHR0aGlzLmVtaXQoXCJlcnJvclwiLCB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIEVycm9yOiBXZWJTb2NrZXQgQ2xpZW50INCy0YvQsdGA0L7RgdC40Lsg0L7RiNC40LHQutGDOiBcIiArIGVycm9yLFxuXHRcdFx0XHRcdGVycm9yOiBlcnJvclxuXHRcdFx0XHR9KTtcblx0XHRcdH0uYmluZCh0aGlzKSk7XG5cblx0XHRcdC8vb25jbG9zZVxuXHRcdFx0dGhpcy5fdmFsdWVXc0NsaWVudC5vbmNsb3NlID0gKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLmVtaXQoJ3dhcm4nLCB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIFdhcm46INCh0L7QtdC00LjQvdC10L3QuNC1INGBINGB0LXRgNCy0LXRgNC+0Lwg0L/QvtGC0LXRgNGP0L3QvdC+LlwiXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGlmICh0aGlzLl9vcHRpb25BdXRvUmVjb25uZWN0ICE9PSBmYWxzZSkgdGhpcy5fZnVuY1dzUmVjb25uZWN0KCk7XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuX2Z1bmNXc0Nsb3NlKCk7XG5cdFx0XHRcdFx0dGhpcy5lbWl0KCdjbG9zZScpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LmJpbmQodGhpcykpO1xuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNXc09uTWVzc2FnZSA9IGZ1bmN0aW9uKHNvdXJjZU1lc3NhZ2UpIHtcblx0XHRcdHZhciBtZXNzYWdlID0gSlNPTi5wYXJzZShzb3VyY2VNZXNzYWdlLmRhdGEpO1xuXG5cdFx0XHRpZiAobWVzc2FnZS50eXBlID09IFwiY2FsbGJhY2tcIikge1xuXHRcdFx0XHR0aGlzLl9mdW5jQ2FsbGJhY2tIYW5kbGVyKG1lc3NhZ2UpO1xuXHRcdFx0fSBlbHNlIGlmIChtZXNzYWdlLnR5cGUgPT0gXCJpbnRlcm5hbENhbGxiYWNrXCIpIHtcblx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsQ2FsbGJhY2tIYW5kbGVyKG1lc3NhZ2UpO1xuXHRcdFx0fSBlbHNlIGlmIChtZXNzYWdlLnR5cGUgPT0gXCJldmVudFwiKSB7XG5cdFx0XHRcdHRoaXMuX2Z1bmNFdmVudEhhbmRsZXIobWVzc2FnZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2YXIgZXJyb3JJbmZvID0ge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBXYXJuOiDQtNC70Y8g0LTQsNC90L3QvtCz0L4g0YLQuNC/0LAg0YHQvtC+0LHRidC10L3QuNC5INC90LXRgiDRhdGN0L3QtNC70LXRgNCwOiBcIiArIG1lc3NhZ2UudHlwZSxcblx0XHRcdFx0XHRtZXNzYWdlOiBtZXNzYWdlXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0dGhpcy5lbWl0KFwid2FyblwiLCBlcnJvckluZm8pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNXc1JlY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbWl0KCdpbmZvJywge1xuXHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gSW5mbzog0JHRg9C00LXRgiDQstGL0L/QvtC70L3QtdC90L3QviDQv9C10YDQtdC/0L7QtNC60LvRjtGH0LXQvdC40LUg0Log0YHQtdGA0LLQtdGA0YMuXCIsXG5cdFx0XHRcdGRlbGF5OiB0aGlzLl9vcHRpb25BdXRvUmVjb25uZWN0XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKHRoaXMuX3ZhbHVlV3NDbGllbnQpIHRoaXMuX2Z1bmNXc0Nsb3NlKCk7XG5cdFx0XHR0aGlzLmVtaXQoJ3JlY29ubmVjdGluZycpO1xuXG5cdFx0XHRzZXRUaW1lb3V0KHRoaXMuX2Z1bmNXc0luaXQuYmluZCh0aGlzKSwgdGhpcy5fb3B0aW9uQXV0b1JlY29ubmVjdCk7XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY1dzQ2xvc2UgPSBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuX3ZhbHVlV3NDbGllbnQub25tZXNzYWdlID0gZnVuY3Rpb24oKSB7fTtcblx0XHRcdHRoaXMuX3ZhbHVlV3NDbGllbnQub25vcGVuID0gZnVuY3Rpb24oKSB7fTtcblx0XHRcdHRoaXMuX3ZhbHVlV3NDbGllbnQub25jbG9zZSA9IGZ1bmN0aW9uKCkge307XG5cdFx0XHR0aGlzLl92YWx1ZVdzQ2xpZW50Lm9uZXJyb3IgPSBmdW5jdGlvbigpIHt9O1xuXG5cdFx0XHR0aGlzLl92YWx1ZVdzQ2xpZW50LmNsb3NlKCk7XG5cblx0XHRcdHRoaXMuX3ZhbHVlV3NDbGllbnQgPSBudWxsO1xuXHRcdH07XG5cblx0XHQvL2VuZCB3cyBjbGllbnRcblxuXHRcdC8vY2xvc2UgYWxsIGNhbGxiYWNrc1xuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY0Nsb3NlQWxsUmVxdWVzdHMgPSBmdW5jdGlvbihpc0luaXRFcnJvcikge1xuXHRcdFx0dmFyIGVycm9ySW5mbyA9IChpc0luaXRFcnJvcikgPyBcIltUZWxlcG9ydENsaWVudF0gRXJyb3I6INCf0YDQvtC40LfQvtGI0LvQsCDQvtGI0LjQsdC60LAg0L/RgNC4INGA0LXQs9C40YHRgtGA0LDRhtC40Y8g0LrQu9C40LXQvdGC0LAg0L3QsCDRgdC10YDQstC10YDQtSwg0L/QvtGN0YLQvtC80YMg0YDQtdC30YPQu9GM0YLQsNGCINCy0YvQv9C+0LvQvdC10L3QuNGPINC60L7QvNCw0L3QtNGLINC90LjQutC+0LPQtNCwINC90LUg0LHRg9C00LXRgiDQstC+0LfQstGA0LDRidC10L3QvS5cIiA6XG5cdFx0XHRcdFwiW1RlbGVwb3J0Q2xpZW50XSBFcnJvcjog0KHQvtC10LTQuNC90LXQvdC40LUg0YEg0YHQtdGA0LLQtdGA0L7QvCDQstC+0YHRgtCw0L3QvtCy0LvQtdC90L3Qviwg0L3QviDRjdGC0L4g0L3QvtCy0YvQuSDRjdC60LfQtdC80L/Qu9GP0YAg0YHQtdGA0LLQtdGA0LAsINC/0L7RjdGC0L7QvNGDINGA0LXQt9GD0LvRjNGC0LDRgiDQstGL0L/QvtC70L3QtdC90LjRjyDQutC+0LzQsNC90LTRiyDQvdC40LrQvtCz0LTQsCDQvdC1INCx0YPQtNC10YIg0LLQvtC30LLRgNCw0YnQtdC90L0uXCI7XG5cblx0XHRcdHdoaWxlICh0aGlzLl92YWx1ZVJlcXVlc3RzLmxlbmd0aCkge1xuXHRcdFx0XHR2YXIgY2FsbGJhY2sgPSB0aGlzLl92YWx1ZVJlcXVlc3RzLnNoaWZ0KCk7XG5cdFx0XHRcdGlmIChjYWxsYmFjaykgY2FsbGJhY2soe1xuXHRcdFx0XHRcdGRlc2M6IGVycm9ySW5mb1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly9lbmQgY2xvc2UgYWxsIGNhbGxiYWNrc1xuXG5cdFx0Ly9jb25uY3Rpb24gaW5pdFxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY0ludGVybmFsR2V0U2VydmVyVGltZXN0YW1wID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0L7RgtC/0YDQsNCy0LjQuyDQt9Cw0L/RgNC+0YEg0L3QsCDQv9C+0LvRg9GH0LXQvdC40LUgdGltZXN0YW1wLlwiXG5cdFx0XHR9KVxuXG5cdFx0XHR0aGlzLl9mdW5jU2VuZEludGVybmFsQ29tbWFuZCh7XG5cdFx0XHRcdHR5cGU6IFwiaW50ZXJuYWxDb21tYW5kXCIsXG5cdFx0XHRcdGludGVybmFsQ29tbWFuZDogXCJnZXRUaW1lc3RhbXBcIixcblx0XHRcdH0sIGNhbGxiYWNrKTtcblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jSW50ZXJuYWxHZXRQZWVySWQgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQvtGC0L/RgNCw0LLQuNC7INC30LDQv9GA0L7RgSDQvdCwINC/0L7Qu9GD0YfQtdC90LjQtSBwZWVySWQuXCIsXG5cdFx0XHRcdHRpbWVzdGFtcDogdGhpcy5fdmFsdWVQZWVyVGltZXN0YW1wXG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5fZnVuY1NlbmRJbnRlcm5hbENvbW1hbmQoe1xuXHRcdFx0XHR0eXBlOiBcImludGVybmFsQ29tbWFuZFwiLFxuXHRcdFx0XHRpbnRlcm5hbENvbW1hbmQ6IFwiZ2V0UGVlcklkXCIsXG5cdFx0XHRcdGFyZ3M6IHtcblx0XHRcdFx0XHR0aW1lc3RhbXA6IHRoaXMuX3ZhbHVlUGVlclRpbWVzdGFtcFxuXHRcdFx0XHR9XG5cdFx0XHR9LCBjYWxsYmFjayk7XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY0ludGVybmFsU2V0UGVlcklkID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0L7RgtC/0YDQsNCy0LjQuyDQt9Cw0L/RgNC+0YEg0L3QsCDQv9C+0LTRgtCy0LXRgNC20LXQvdC40LUg0YPQttC1INGB0YPRidC10YHRgtCy0YPRjtGJ0LXQs9C+IHBlZXJJZC5cIixcblx0XHRcdFx0dGltZXN0YW1wOiB0aGlzLl92YWx1ZVBlZXJUaW1lc3RhbXAsXG5cdFx0XHRcdHBlZXJJZDogdGhpcy5fdmFsdWVQZWVySWRcblx0XHRcdH0pXG5cblx0XHRcdHRoaXMuX2Z1bmNTZW5kSW50ZXJuYWxDb21tYW5kKHtcblx0XHRcdFx0dHlwZTogXCJpbnRlcm5hbENvbW1hbmRcIixcblx0XHRcdFx0aW50ZXJuYWxDb21tYW5kOiBcInNldFBlZXJJZFwiLFxuXHRcdFx0XHRhcmdzOiB7XG5cdFx0XHRcdFx0dGltZXN0YW1wOiB0aGlzLl92YWx1ZVBlZXJUaW1lc3RhbXAsXG5cdFx0XHRcdFx0cGVlcklkOiB0aGlzLl92YWx1ZVBlZXJJZFxuXHRcdFx0XHR9XG5cdFx0XHR9LCBjYWxsYmFjayk7XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY0ludGVybmFsR2V0T2JqZWN0c1Byb3BzID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0L7RgtC/0YDQsNCy0LjQuyDQt9Cw0L/RgNC+0YEg0L3QsCDQv9C+0LvRg9GH0LXQvdC40LUg0YHQstC+0LnRgdGC0LIg0YHQtdGA0LLQtdGA0L3Ri9GFINC+0LHRitC10LrRgtC+0LIuXCIsXG5cdFx0XHRcdHBlZXJJZDogdGhpcy5fdmFsdWVQZWVySWRcblx0XHRcdH0pXG5cblx0XHRcdHRoaXMuX2Z1bmNTZW5kSW50ZXJuYWxDb21tYW5kKHtcblx0XHRcdFx0dHlwZTogXCJpbnRlcm5hbENvbW1hbmRcIixcblx0XHRcdFx0aW50ZXJuYWxDb21tYW5kOiBcImdldE9iamVjdHNcIixcblx0XHRcdFx0YXJnczoge1xuXHRcdFx0XHRcdHBlZXJJZDogdGhpcy5fdmFsdWVQZWVySWRcblx0XHRcdFx0fVxuXHRcdFx0fSwgY2FsbGJhY2spO1xuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNJbnRlcm5hbENvbm5lY3RlZCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INC+0YLQv9GA0LDQstC40Lsg0L/QvtC00YLQstC10YDQttC00LXQvdC40LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0L/QvtC00LrQu9GO0YfQtdC90LjRjy5cIixcblx0XHRcdFx0cGVlcklkOiB0aGlzLl92YWx1ZVBlZXJJZFxuXHRcdFx0fSlcblxuXHRcdFx0dGhpcy5fZnVuY1NlbmRJbnRlcm5hbENvbW1hbmQoe1xuXHRcdFx0XHR0eXBlOiBcImludGVybmFsQ29tbWFuZFwiLFxuXHRcdFx0XHRpbnRlcm5hbENvbW1hbmQ6IFwiY29ubmVjdGlvbtChb21wbGV0ZWRcIixcblx0XHRcdFx0YXJnczoge1xuXHRcdFx0XHRcdHBlZXJJZDogdGhpcy5fdmFsdWVQZWVySWRcblx0XHRcdFx0fVxuXHRcdFx0fSwgY2FsbGJhY2spO1xuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNJbnRlcm5hbFJlY29ubmVjdGVkID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0L7RgtC/0YDQsNCy0LjQuyDQv9C+0LTRgtCy0LXRgNC20LTQtdC90LjQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQv9C10YDQtdC/0L7QtNC60LvRjtGH0LXQvdC40Y8uXCIsXG5cdFx0XHRcdHBlZXJJZDogdGhpcy5fdmFsdWVQZWVySWRcblx0XHRcdH0pXG5cblx0XHRcdHRoaXMuX2Z1bmNTZW5kSW50ZXJuYWxDb21tYW5kKHtcblx0XHRcdFx0dHlwZTogXCJpbnRlcm5hbENvbW1hbmRcIixcblx0XHRcdFx0aW50ZXJuYWxDb21tYW5kOiBcInJlY29ubmVjdGlvbkNvbXBsZXRlZFwiLFxuXHRcdFx0XHRhcmdzOiB7XG5cdFx0XHRcdFx0cGVlcklkOiB0aGlzLl92YWx1ZVBlZXJJZFxuXHRcdFx0XHR9XG5cdFx0XHR9LCBjYWxsYmFjayk7XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY1NlbmRJbnRlcm5hbENvbW1hbmQgPSBmdW5jdGlvbihtZXNzYWdlLCBjYWxsYmFjaykge1xuXHRcdFx0aWYgKGNhbGxiYWNrKSB7XG5cdFx0XHRcdG1lc3NhZ2UuaW50ZXJuYWxSZXF1ZXN0SWQgPSB0aGlzLl92YWx1ZUludGVybmFsUmVxdWVzdHMubGVuZ3RoO1xuXHRcdFx0XHR0aGlzLl92YWx1ZUludGVybmFsUmVxdWVzdHMucHVzaChjYWxsYmFjayk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2Z1bmNXc1NlbmRNZXNzYWdlKG1lc3NhZ2UpO1xuXHRcdH07XG5cblx0XHQvL2VuZCBjb25uY3Rpb24gaW5pdFxuXG5cdFx0LyoqXG5cdFx0XHTRhdGN0L3QtNC70LXRgCDQtNC70Y8g0L7RgtCy0LXRgtC+0LIg0L3QsCDRgdC10YDQstC40YHQvdGL0LUg0LfQsNC/0YDQvtGB0Ysg0Log0YHQtdGA0LLQtdGA0YNcblx0XHRcblx0XHQqL1xuXHRcdC8vSW50ZXJuYWxIYW5kbGVyXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jSW50ZXJuYWxDYWxsYmFja0hhbmRsZXIgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG5cdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INGB0LXRgNCy0LXRgCDQstC10YDQvdGD0LsgaW50ZXJuYWxDYWxsYmFjayDQvdCwOiBcIiArIG1lc3NhZ2UuaW50ZXJuYWxDb21tYW5kLFxuXHRcdFx0XHRtZXNzYWdlOiBtZXNzYWdlXG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5fdmFsdWVJbnRlcm5hbFJlcXVlc3RzW21lc3NhZ2UuaW50ZXJuYWxSZXF1ZXN0SWRdKG1lc3NhZ2UuZXJyb3IsIG1lc3NhZ2UucmVzdWx0KTtcblx0XHRcdGRlbGV0ZSB0aGlzLl92YWx1ZUludGVybmFsUmVxdWVzdHNbbWVzc2FnZS5pbnRlcm5hbFJlcXVlc3RJZF07XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY0ludGVybmFsSGFuZGxlckdldFRpbWVzdGFtcCA9IGZ1bmN0aW9uKGVycm9yLCBuZXdTZXJ2ZXJUaW1lc3RhbXApIHtcblx0XHRcdGlmICghdGhpcy5fdmFsdWVJc1JlYWR5RW1pdGVkKSB7XG5cdFx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQn9C+0LvRg9GH0LXQvdC9IHRpbWVzdGFtcCwg0Y3RgtC+INC/0LXRgNCy0L7QtSDQv9C+0LTQutC70Y7Rh9C10L3QuNC1INC6INGB0LXRgNCy0LXRgNGDLCDQt9Cw0L/RgNCw0YjQuNCy0LDRjiBwZWVySWQuXCIsXG5cdFx0XHRcdFx0dGltZXN0YW1wOiBuZXdTZXJ2ZXJUaW1lc3RhbXBcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGhpcy5fdmFsdWVTZXJ2ZXJUaW1lc3RhbXAgPSBuZXdTZXJ2ZXJUaW1lc3RhbXA7XG5cblx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsR2V0UGVlcklkKFxuXHRcdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbEhhbmRsZXJHZXRQZWVySWQuYmluZCh0aGlzKSk7XG5cdFx0XHR9IGVsc2UgaWYgKG5ld1NlcnZlclRpbWVzdGFtcCAhPSB0aGlzLl92YWx1ZVNlcnZlclRpbWVzdGFtcCkge1xuXHRcdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0J/QvtC70YPRh9C10L3QvdGL0LkgdGltZXN0YW1wINC+0YLQu9C40YfQsNC10YLRgdGPINC+0YIg0L/RgNC+0YjQu9C+0LPQviwg0YHQtdGA0LLQtdGAINCx0YvQuyDQv9C10YDQtdC30LDQv9GD0YnQtdC90L0sIFwiICtcblx0XHRcdFx0XHRcdFwi0LfQsNC/0YDQsNGI0LjQstCw0Y4g0L3QvtCy0YvQuSBwZWVySWQsINC90LAg0LLRgdC1INC60LDQu9Cx0LXQutC4INC+0LbQuNC00LDRjtGJ0LjQtSDRgNC10LfRg9C70YzRgtCw0YIg0LLQvtC30LLRgNCw0YnQsNGOINC+0YjQuNCx0LrRgy5cIixcblx0XHRcdFx0XHRyZXF1ZXN0Q291bnQ6IHRoaXMuX3ZhbHVlUmVxdWVzdHMubGVuZ3RoLFxuXHRcdFx0XHRcdG9sZFRpbWVzdGFtcDogdGhpcy5fdmFsdWVTZXJ2ZXJUaW1lc3RhbXAsXG5cdFx0XHRcdFx0bmV3VGltZXN0YW1wOiBuZXdTZXJ2ZXJUaW1lc3RhbXAsXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRoaXMuX3ZhbHVlU2VydmVyVGltZXN0YW1wID0gbmV3U2VydmVyVGltZXN0YW1wO1xuXHRcdFx0XHR0aGlzLl9mdW5jQ2xvc2VBbGxSZXF1ZXN0cygpO1xuXG5cdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbEdldFBlZXJJZChcblx0XHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxIYW5kbGVyR2V0UGVlcklkLmJpbmQodGhpcykpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INCf0L7Qu9GD0YfQtdC90L0gdGltZXN0YW1wLCDQvtC9INGB0L7QvtGC0LLQtdGC0YHRgtCy0YPQtdGCINGB0YLQsNGA0L7QvNGDLCDQvtGC0L/RgNCw0LLQu9GP0Y4g0L3QsCDRgdC10YDQstC10YAg0YHQstC+0LkgcGVlcklkLlwiLFxuXHRcdFx0XHRcdHRpbWVzdGFtcDogbmV3U2VydmVyVGltZXN0YW1wXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbFNldFBlZXJJZChcblx0XHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxIYW5kbGVyU2V0UGVlcklkLmJpbmQodGhpcykpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNJbnRlcm5hbEhhbmRsZXJHZXRQZWVySWQgPSBmdW5jdGlvbihlcnJvciwgcGVlcklkKSB7XG5cdFx0XHRpZiAoIXRoaXMuX3ZhbHVlSXNSZWFkeUVtaXRlZCkgdGhpcy5lbWl0KCdkZWJ1ZycsIHtcblx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQn9C+0LvRg9GH0LXQvdC9IHBlZXJJZCwg0LfQsNC/0YDQsNGI0LjQstCw0Y4g0YHQstC+0LnRgdGC0LLQsCDRgdC10YDQstC10YDQvdGL0YUg0L7QsdGK0LXQutGC0L7Qsi5cIixcblx0XHRcdFx0cGVlcklkOiBwZWVySWRcblx0XHRcdH0pO1xuXHRcdFx0ZWxzZSB0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INCf0L7Qu9GD0YfQtdC90L0gcGVlcklkLCDQv9C10YDQtdC/0L7QtNC60LvRjtGH0LXQvdC40LUg0L/RgNC+0LjQt9C+0YjQu9C+INC40Lct0LfQsCDQv9C10YDQtdC30LDQv9GD0YHQutCwINGB0LXRgNCy0LXRgNCwIFwiICtcblx0XHRcdFx0XHRcItC/0YDQvtCy0LXRgNGP0Y4g0LjQt9C80LXQvdC40LvQuNGB0Ywg0LvQuCDRgdCy0L7QudGB0YLQstCwINGB0LXRgNCy0LXRgNC90YvRhSDQvtCx0YrQtdC60YLQvtCyLiDQmNC70Lgg0LjQty3Qt9CwINC40YHRgtC10YfQtdC90LjRjyDQstGA0LXQvNC10L3QuCDQvtC20LjQtNCw0L3QuNGPINGB0LXRgNCy0LXRgNC+0LwgXCIgK1xuXHRcdFx0XHRcdFwi0L/QtdGA0LXQv9C+0LTQutC70Y7Rh9C10L3QuNGPINGN0YLQvtCz0L4g0LrQu9C40LXQvdGC0LAuXCIsXG5cdFx0XHRcdHBlZXJJZDogcGVlcklkXG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5fdmFsdWVQZWVySWQgPSBwZWVySWQ7XG5cblx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbEdldE9iamVjdHNQcm9wcyhcblx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsSGFuZGxlckdldE9iamVjdHMuYmluZCh0aGlzKSk7XG5cdFx0fTtcblxuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY0ludGVybmFsSGFuZGxlclNldFBlZXJJZCA9IGZ1bmN0aW9uKGVycm9yKSB7XG5cdFx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdFx0dmFyIGVycm9ySW5mbyA9IHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRXJyb3I6INCd0LUg0YPQtNCw0LvQvtGB0Ywg0LLQvtGB0YHRgtCw0L3QvtCy0LjRgtGMINGB0L7QtdC00LjQvdC10L3QuNC1INGBINGB0LXRgNCy0LXRgNC+0LwsINC30LDQv9GA0L7RgSDQvdCwINGD0YHRgtCw0L3QvtCy0LrRgyBwZWVySWQsINCy0LXRgNC90YPQuyDQvtGI0LjQsdC60YMuIFwiICtcblx0XHRcdFx0XHRcdFwi0J/QvtC/0YDQvtCx0YPRjiDQv9C+0LvRg9GH0LjRgtGMINC90L7QstGL0LkgcGVlcklkLlwiLFxuXHRcdFx0XHRcdGVycm9yOiBlcnJvclxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdHRoaXMuZW1pdChcImVycm9yXCIsIGVycm9ySW5mbyk7XG5cdFx0XHRcdHRoaXMuX2Z1bmNDbG9zZUFsbFJlcXVlc3RzKCdpbml0IGVycm9yJyk7XG5cblx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsR2V0UGVlcklkKFxuXHRcdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbEhhbmRsZXJHZXRQZWVySWQuYmluZCh0aGlzKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9mdW5jSW50ZXJuYWxSZWNvbm5lY3RlZCgpO1xuXG5cdFx0XHRcdHRoaXMuZW1pdCgnaW5mbycsIHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gSW5mbzog0KHQvtC10LTQuNC90LXQvdC40LUg0YEg0YHQtdGA0LLQtdGA0L7QvCDQstC+0YHRgtCw0L3QvtCy0LvQtdC90L3Qvi5cIixcblx0XHRcdFx0XHRwZWVySWQ6IHRoaXMuX3ZhbHVlUGVlcklkLFxuXHRcdFx0XHRcdGV2ZW50czogWydyZWNvbm5lY3RlZCcsICdyZWNvbm5lY3RlZFRvT2xkU2VydmVyJ11cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGhpcy5lbWl0KCdyZWNvbm5lY3RlZCcpO1xuXHRcdFx0XHR0aGlzLmVtaXQoJ3JlY29ubmVjdGVkVG9PbGRTZXJ2ZXInKTtcblx0XHRcdFx0dGhpcy5lbWl0KCdfX3JlY29ubmVjdGVkVG9PbGRTZXJ2ZXJfXycpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNJbnRlcm5hbEhhbmRsZXJHZXRPYmplY3RzID0gZnVuY3Rpb24oZXJyb3IsIG9iamVjdFByb3BzKSB7XG5cdFx0XHRpZiAoIXRoaXMuX3ZhbHVlSXNSZWFkeUVtaXRlZCkge1xuXHRcdFx0XHR0aGlzLl92YWx1ZVNlcnZlck9iamVjdHNQcm9wcyA9IG9iamVjdFByb3BzO1xuXG5cdFx0XHRcdHRoaXMuX2Z1bmNPYmplY3RDcmVhdGVBbGwoKTtcblx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsQ29ubmVjdGVkKCk7XG5cblx0XHRcdFx0dGhpcy5lbWl0KCdpbmZvJywge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBJbmZvOiDRgdC10YDQstC10YDQvdGL0LUg0L7QsdGK0LXQutGC0Ysg0LjQvdC40YbQuNCw0LvQuNC30LjRgNC+0LLQsNC90L3Riywg0LrQu9C40LXQvdGCINCz0L7RgtC+0LIg0Log0YDQsNCx0L7RgtC1LlwiLFxuXHRcdFx0XHRcdGV2ZW50czogWydyZWFkeSddLFxuXHRcdFx0XHRcdHNlcnZlck9iamVjdHNQcm9wczogdGhpcy5fdmFsdWVTZXJ2ZXJPYmplY3RzUHJvcHNcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRoaXMuX3ZhbHVlSXNSZWFkeUVtaXRlZCA9IHRydWU7XG5cblx0XHRcdFx0dGhpcy5lbWl0KCdyZWFkeScsIHRoaXMuX3ZhbHVlU2VydmVyT2JqZWN0c1Byb3BzKTtcblx0XHRcdH0gZWxzZSBpZiAoaXNQcm9wc0VxdWFsKG9iamVjdFByb3BzLCB0aGlzLl92YWx1ZVNlcnZlck9iamVjdHNQcm9wcykpIHtcblx0XHRcdFx0dGhpcy5lbWl0KCdpbmZvJywge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBJbmZvOiDQodC10YDQstC10YAg0LHRi9C7INC/0LXRgNC10LfQsNC/0YPRidC10L3QvSwg0L3QviDQvtCx0YrQtdC60YLRiyDRgtC10LvQtdC/0L7RgNGC0LjRgNC+0LLQsNC7INGC0LXQttC1LlwiLFxuXHRcdFx0XHRcdGV2ZW50czogWydyZWNvbm5lY3RlZCcsICdyZWNvbm5lY3RlZFRvTmV3U2VydmVyJ11cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGhpcy5fZnVuY0ludGVybmFsQ29ubmVjdGVkKCk7XG5cblx0XHRcdFx0dGhpcy5lbWl0KCdyZWNvbm5lY3RlZCcpO1xuXHRcdFx0XHR0aGlzLmVtaXQoJ3JlY29ubmVjdGVkVG9OZXdTZXJ2ZXInKTtcblx0XHRcdFx0dGhpcy5lbWl0KCdfX3JlY29ubmVjdGVkVG9OZXdTZXJ2ZXJfXycpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5lbWl0KCd3YXJuJywge1xuXHRcdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBXYXJuOiDQn9C+0YHQu9C1INGB0LLQvtC10LPQviDQv9C10YDQtdC30LDQv9GD0YHQutCwINGB0LXRgNCy0LXRgNCwINC/0YDQuNGB0LvQsNC7INGB0LXRgNCy0LXRgNC90YvQtSDQvtCx0YrQtdC60YLRiyDQvtGC0LvQuNGH0L3Ri9C1INC+0YIg0YHRgtCw0YDRi9GFLCDRgNC10LrQvtC80LXQvdC00YPRjiDQvtCx0L3QvtCy0LjRgtGMINGB0YLRgNCw0L3QuNGG0YMuXCIsXG5cdFx0XHRcdFx0ZXZlbnRzOiBbJ3NlcnZlck9iamVjdHNDaGFuZ2VkJywgJ3JlY29ubmVjdGVkJywgJ3JlY29ubmVjdGVkVG9OZXdTZXJ2ZXInXSxcblx0XHRcdFx0XHRuZXdPYmplY3RQcm9wczogb2JqZWN0UHJvcHMsXG5cdFx0XHRcdFx0b2xkT2JqZWN0UHJvcHM6IHRoaXMuX3ZhbHVlU2VydmVyT2JqZWN0c1Byb3BzXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRoaXMuX2Z1bmNJbnRlcm5hbENvbm5lY3RlZCgpO1xuXG5cdFx0XHRcdHRoaXMuaXNTZXJ2ZXJPYmplY3RDaGFuZ2VkID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5lbWl0KCdzZXJ2ZXJPYmplY3RzQ2hhbmdlZCcpO1xuXHRcdFx0XHR0aGlzLmVtaXQoJ3JlY29ubmVjdGVkJyk7XG5cdFx0XHRcdHRoaXMuZW1pdCgncmVjb25uZWN0ZWRUb05ld1NlcnZlcicpO1xuXHRcdFx0XHR0aGlzLmVtaXQoJ19fcmVjb25uZWN0ZWRUb05ld1NlcnZlcl9fJyk7XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIGlzUHJvcHNFcXVhbChuZXdPYmplY3RQcm9wcywgb2xkT2JqZWN0UHJvcHMpIHtcblx0XHRcdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KG5ld09iamVjdFByb3BzKSA9PSBKU09OLnN0cmluZ2lmeShvbGRPYmplY3RQcm9wcyk7XG5cdFx0XHR9O1xuXHRcdH07XG5cblx0XHQvL2VuZCBJbnRlcm5hbEhhbmRsZXJcblxuXHRcdC8vc2VydmVyXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jUXVhcmFudGVlZFNlbmRNZXNzYWdlID0gZnVuY3Rpb24obWVzc2FnZSkge1xuXHRcdFx0aWYgKHRoaXMuX3ZhbHVlV3NDbGllbnQgJiYgKHRoaXMuX3ZhbHVlV3NDbGllbnQucmVhZHlTdGF0ZSA9PSAxKSkge1xuXHRcdFx0XHR0aGlzLl9mdW5jV3NTZW5kTWVzc2FnZShtZXNzYWdlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQodC+0LXQtNC40L3QtdC90LjQtSDRgSDRgdC10YDQstC10YDQvtC8INGB0LXQudGH0LDRgSDQvtGC0YHRg9GC0YHRgtCy0YPQtdGCLCDQutC+0LPQtNCwINC+0L3QviDQsdGD0LTQtdGCINCy0L7RgdGB0YLQsNC90L7QstC70LXQvdC90L4sINGN0YLQviDRgdC+0L7QsdGJ0LXQvdC40LUg0LHRg9C00LXRgiDQvtGC0L/RgNCy0LDQu9C10L3QvdC+LlwiICtcblx0XHRcdFx0XHRcdFwi0JXRgdC70Lgg0L/QvtGB0LvQtSDQstC+0YHRgtCw0L3QvtCy0LvQtdC90LjRjyDRgdC+0LXQtNC40L3QtdC90LjRjyDRgdGC0LDQvdC10YIg0Y/RgdC90L4sINGH0YLQviDQv9C+0LTQutC70Y7Rh9C40LvRgdGPINC60LvQuNC10L3RgiDQuiDQvdC+0LLQvtC80YMg0Y3QutC30LXQvNC/0LvRj9GA0YMg0YHQtdGA0LLQtdGA0YMgKNGB0LXRgNCy0LXRgCDQv9C10YDQtdC30LDQv9GD0YnQtdC90L0pLCDRgtC+INGB0L7QvtCx0YnQtdC90LjQtSDQvtGC0L/RgNCw0LLQu9C10L3QvdC+INC90LUg0LHRg9C00LXRgi5cIixcblx0XHRcdFx0XHRtZXNzYWdlOiBtZXNzYWdlXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHZhciByZWNvbm5lY3RlZE9sZFNlcnZlckhhbmRsZXIgPSAoZnVuY3Rpb24obWVzc2FnZSkge1xuXHRcdFx0XHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdFx0XHRcdGRlc2M6ICdbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQodC+0LXQtNC40L3QtdC90LjQtSDQstC+0YHRgtCw0L3QvtCy0LvQtdC90L3QviDRgSDQv9GA0LXQttC90LjQvCDRjdC60LfQtdC80L/Qu9GP0YDQvtC8INGB0LXRgNCy0LXRgNCwLCDQuNC70Lgg0YPRgdGC0LDQvdC+0LLQu9C10L3QvdC+INCy0L/QtdGA0LLRi9C1LCDQvtGC0L/RgNCw0LLQu9GP0LXRgtGB0Y8g0YHQvtC+0LHRiNC10L3QuNC1INC90LAg0YHQtdGA0LLQtdGAJyxcblx0XHRcdFx0XHRcdFx0bWVzc2FnZTogbWVzc2FnZVxuXHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdHRoaXMucmVtb3ZlTGlzdGVuZXIoJ19fcmVjb25uZWN0ZWRUb05ld1NlcnZlcl9fJywgcmVjb25uZWN0ZWROZXdTZXJ2ZXJIYW5kbGVyKTtcblx0XHRcdFx0XHRcdHRoaXMuX2Z1bmNXc1NlbmRNZXNzYWdlKG1lc3NhZ2UpO1xuXHRcdFx0XHRcdH0uYmluZCh0aGlzKTtcblx0XHRcdFx0fS5iaW5kKHRoaXMpKShtZXNzYWdlKTtcblxuXHRcdFx0XHR2YXIgcmVjb25uZWN0ZWROZXdTZXJ2ZXJIYW5kbGVyID0gKGZ1bmN0aW9uKG1lc3NhZ2UpIHtcblx0XHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRcdFx0XHRkZXNjOiAnW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0J/QtdGA0LXQv9C+0LTQutC70Y7Rh9C10L3QuNC1INC/0YDQvtC40LfQvtGI0LvQviDQuiDQvdC+0LLQvtC80YMg0Y3QutC30LXQvNC/0LvRj9GA0YMg0YHQtdGA0LLQtdGA0LAsINGB0L7QvtCx0YnQtdC90LjQtSDQvtGC0L/RgNCw0LLQu9C10L3QvdC+INC90LUg0LHRg9C00LXRgi4nLFxuXHRcdFx0XHRcdFx0XHRtZXNzYWdlOiBtZXNzYWdlXG5cdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0dGhpcy5yZW1vdmVMaXN0ZW5lcignX19yZWNvbm5lY3RlZFRvT2xkU2VydmVyX18nLCByZWNvbm5lY3RlZE9sZFNlcnZlckhhbmRsZXIpXG5cdFx0XHRcdFx0fS5iaW5kKHRoaXMpO1xuXHRcdFx0XHR9LmJpbmQodGhpcykpKG1lc3NhZ2UpO1xuXG5cdFx0XHRcdHRoaXMub25jZSgnX19yZWNvbm5lY3RlZFRvTmV3U2VydmVyX18nLCByZWNvbm5lY3RlZE5ld1NlcnZlckhhbmRsZXIpO1xuXHRcdFx0XHR0aGlzLm9uY2UoJ19fcmVjb25uZWN0ZWRUb09sZFNlcnZlcl9fJywgcmVjb25uZWN0ZWRPbGRTZXJ2ZXJIYW5kbGVyKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jV3NTZW5kTWVzc2FnZSA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHZhciBzdHJpbmcgPSBKU09OLnN0cmluZ2lmeShtZXNzYWdlKTtcblxuXHRcdFx0XHRpZiAodGhpcy5fdmFsdWVXc0NsaWVudCAmJiAodGhpcy5fdmFsdWVXc0NsaWVudC5yZWFkeVN0YXRlID09IDEpKSB7XG5cdFx0XHRcdFx0dGhpcy5fdmFsdWVXc0NsaWVudC5zZW5kKHN0cmluZyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5lbWl0KCd3YXJuJywge1xuXHRcdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIFdhcm46INGB0L7QvtCx0YnQtdC90LjQtSDQvtGC0L/RgNCw0LLQu9C10L3QvdC+INC90LUg0LHRg9C00LXRgiwg0YLQsNC6INC60LDQuiDRgdC+0LXQtNC40L3QtdC90LjQtSDRgSDRgdC10YDQstC10YDQvtC8INC/0L7RgtC10YDRj9C90L3Qvi5cIixcblx0XHRcdFx0XHRcdG1lc3NhZ2U6IG1lc3NhZ2Vcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLmVtaXQoXCJ3YXJuXCIsIHtcblx0XHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gV2Fybjog0L7RiNC40LHQutCwINC+0YLQv9GA0LDQstC60Lgg0YHQvtC+0LHRidC10L3QuNGPINC90LAg0YHQtdGA0LLQtdGAOiBcIiArIGVycm9yLFxuXHRcdFx0XHRcdG1lc3NhZ2U6IG1lc3NhZ2UsXG5cdFx0XHRcdFx0ZXJyb3I6IGVycm9yXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvL2VuZCBzZXJ2ZXJcblxuXHRcdC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovL1xuXHRcdC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovL1xuXHRcdC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovL1xuXHRcdC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICAgVGVsZXBvcnRlZE9iamVjdCAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovL1xuXHRcdC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovL1xuXHRcdC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovL1xuXHRcdC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovL1xuXG5cdFx0LyoqXG5cdFx0XHTQmNC90LjRhtC40LDQu9C40LfQsNGC0L7RgCDRgdC10YDQstC10YDQvdC10YUg0L7QsdGK0LXQutGC0L7QsiwgXG5cdFx0XHTQstGB0LUg0LzQtdGC0L7QtNGLINCx0YPQtNGD0YIg0YHQvtC30LTQsNC90L3RiyDRhNGD0L3QutGG0LjQtdC5IF9mdW5jT2JqZWN0Q3JlYXRlINC60LvQsNGB0YHQsCBUZWxlcG9ydENsaWVudCxcblx0XHRcdNCwINC90LUg0YHQuNC70LDQvNC4INC60L7QvdGB0YLRgNGD0LrRgtC+0YDQsCDQutC70LDRgdGB0LAgVGVsZXBvcnRlZE9iamVjdCwg0L/QvtGC0L7QvNGDINGH0YLQviDQsiDRgdC+0LfQtNCw0LLQsNC10LzRi9GFIFxuXHRcdFx00LzQtdGC0L7QtNCw0YUg0L/RgNC+0LHRgNC+0YjQtdC90L3Ri9GFINGBINGB0LXRgNCy0LXRgNCwINC+0LHRitC10LrRgtCw0YUgXG5cdFx0XHTQv9C+0YLRgNC10LHRg9C10YLRgdGPINC40YHQv9C+0LvRjNC30L7QstCw0YLRjCBfZnVuY1dzU2VuZE1lc3NhZ2UsINC60LvQsNGB0YHQsCBUZWxlcG9ydENsaWVudCxcblx0XHRcdNC60L7RgtC+0YDRi9C5INC40YHQvtC70YzQt9GD0LXRgiB3cyDQutC70LjQtdC90YIg0LrQu9Cw0YHRgdCwIFRlbGVwb3J0Q2xpZW50LlxuXG5cdFx0XHRfZnVuY1dzU2VuZE1lc3NhZ2Ug0LrQvtC90LXRh9C90L4g0LzQvtC20L3QviDQv9GA0L7QsdGA0L7RgdC40YLRjCDQv9GA0LjQsdC40L3QtNC40LIg0Log0L3QtdC80YMgdGhpcyBUZWxlcG9ydENsaWVudFxuXHRcdFx00Lgg0LjRgdC/0L7Qu9GC0YzQt9C+0LLQsNGC0Ywg0LLQvdGD0YLRgNC4IFRlbGVwb3J0ZWRPYmplY3QsINC90L4g0Y3RgtC+INGD0YHQu9C+0LbQvdGP0LXRgiDQutC+0LQg0Lgg0LLRi9Cz0LvRj9C00LjRgiDRgdGC0YDQtdC80L3Qvi5cblxuXHRcdFx00LIg0LrQsNGH0LXRgdGC0LLQtSDQsNC70YzRgtC10YDQvdCw0YLQuNCy0Ysg0LzQvtC20L3QviDQvtGC0LLRj9C30LDRgtGMINC60L7QvdC90LXQutGCINC60LvQuNC10L3RgtCwINGBINGB0LXRgNCy0LXRgNC+0Lwg0L7RgiB3cyDRgdC10YHRgdC40LgsXG5cdFx0XHTQuCDQt9Cw0LLQtdGB0YLQuCDQutCw0LrQuNC1INC90LjQsdGD0LTRjCDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INC40LTQtdC90YLQuNGE0LjQutCw0YLQvtGA0Ysg0LTQu9GPINC+0LHQvtC30L3QsNGH0LXQvdC40Y8g0YHQvtCx0YHRgtCy0LXQvdC90L4g0YHQtdGB0YHQuNC5LCBcblx0XHRcdNC4INGC0L7Qs9C00LAg0LzQvtC20L3QviDRgdC+0LfQtNCw0YLRjCDQvtGC0LTQtdC70YzQvdGL0Lkgd3MgQ2xpZW50INCyIFRlbGVwb3J0ZWRPYmplY3QsINC4INGB0L7QsdGB0YLQstC10L3QvdC+INGB0LLQvtGOINGB0L7QsdGB0YLQstC10L3QvdGD0Y5cblx0XHRcdNGE0YPQvdC60YbQuNGOIF9mdW5jV3NTZW5kTWVzc2FnZSDQt9Cw0L/QuNC70LjRgtGMLCDQvdC+INGPINC90LUg0YXQvtGH0YMsINGN0YLQviDRg9GB0LvQvtC20L3QuNGCINC60L7QtCDQuCDQstC+0YIuXG5cblx0XHQqL1xuXG5cblx0XHR1dGlsLmluaGVyaXRzKFRlbGVwb3J0ZWRPYmplY3QsIEV2ZW50RW1pdHRlcik7XG5cblx0XHRmdW5jdGlvbiBUZWxlcG9ydGVkT2JqZWN0KG9iamVjdFByb3BzKSB7XG5cdFx0XHR0aGlzLl9fZXZlbnRzX18gPSBvYmplY3RQcm9wcy5ldmVudHM7XG5cdFx0XHR0aGlzLl9fbWV0aG9kc19fID0gb2JqZWN0UHJvcHMubWV0aG9kcztcblx0XHR9O1xuXG5cdFx0VGVsZXBvcnRDbGllbnQucHJvdG90eXBlLl9mdW5jT2JqZWN0Q3JlYXRlQWxsID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRmb3IgKHZhciBvYmplY3ROYW1lIGluIHRoaXMuX3ZhbHVlU2VydmVyT2JqZWN0c1Byb3BzKSB7XG5cdFx0XHRcdHRoaXMuX2Z1bmNPYmplY3RDcmVhdGUob2JqZWN0TmFtZSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdFx00JzQtdGC0L7QtCDQuNC90LjRhtC40LDQu9C40LfQuNGA0YPRjtGJ0LjQuSDQv9GA0LjQvdGP0YLRi9C5INC+0YIg0YHQtdGA0LLQtdGA0LAg0L7QsdGK0LXQutGCLCBcblx0XHRcdNC/0YDQuNC90LjQvNCw0LXRgiDQuNC80Y8g0L7QsdGK0LXQutGC0LAsINC90LUg0L7Rh9C10L3RjCDQvtC/0YLQuNC80LDQu9GM0L3Qviwg0L3QviDQvdCw0LPQu9GP0LTQvdC+XG5cdFx0XHRcblx0XHQqL1xuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY09iamVjdENyZWF0ZSA9IGZ1bmN0aW9uKG9iamVjdE5hbWUpIHtcblx0XHRcdHZhciBvYmplY3RQcm9wcyA9IHRoaXMuX3ZhbHVlU2VydmVyT2JqZWN0c1Byb3BzW29iamVjdE5hbWVdO1xuXHRcdFx0dGhpcy5vYmplY3RzW29iamVjdE5hbWVdID0gbmV3IFRlbGVwb3J0ZWRPYmplY3Qob2JqZWN0UHJvcHMpO1xuXG5cdFx0XHRmb3IgKHZhciBtZXRob2RJbmRleCA9IDA7IG1ldGhvZEluZGV4IDwgb2JqZWN0UHJvcHMubWV0aG9kcy5sZW5ndGg7IG1ldGhvZEluZGV4KyspIHtcblx0XHRcdFx0dmFyIG1ldGhvZE5hbWUgPSBvYmplY3RQcm9wcy5tZXRob2RzW21ldGhvZEluZGV4XTtcblxuXHRcdFx0XHR0aGlzLm9iamVjdHNbb2JqZWN0TmFtZV1bbWV0aG9kTmFtZV0gPVxuXHRcdFx0XHRcdHRoaXMuX2Z1bmNNZXRob2RDcmVhdGUob2JqZWN0TmFtZSwgbWV0aG9kTmFtZSkuYmluZCh0aGlzKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0XHTQrdGC0LAg0YTRg9C90LrRhtC40Y8g0L/RgNC40L3QuNC80LDQtdGCINGB0YLRgNC+0LrQuCBtZXRob2ROYW1lINC4IG9iamVjdE5hbWUuXG5cdFx0XHTQmCDQstC+0LfQstGA0LDQttCw0LXRgiDRhNGD0L3QutGG0LjRjiwg0LTQu9GPINC60L7RgtC+0YDQvtC5INGN0YLQuCDRgdGC0YDQvtC60Lgg0LHRg9C00YPRgiDQtNC+0YHRgtGD0L/QvdGLINGH0LXRgNC10Lcg0LfQsNC80YvQutCw0L3QuNC1LlxuXHRcdFx0XG5cdFx0XHTQodC+0LfQtNCw0LLQsNC10LzQsNGPINGE0YPQvdC60YbQuNGPLCDQsdGD0LvRg9GH0Lgg0LLRi9C30LLQsNC90L3QvtC5INGA0LDQt9Cx0LjRgNCw0LXRgiDQstGF0L7QtNGP0YnQuNC5INC80LDRgdGB0LjQsiBhcmd1bWVudHMg0L3QsCDRgdC+0LHRgdGC0LLQtdC90L3QviBcblx0XHRcdNCw0YDQs9GD0LzQtdC90YLRiyDQtNC70Y8g0YTRg9C90LrRhtC40Lgg0LggY2FsbGJhY2suXG5cdFx0XHTQrdGC0L7QvNGDINCy0YvQt9C+0LLRgyDQv9GA0LjRgdCy0LDQuNCy0LDQtdGC0YHRjyByZXF1ZXN0SWQg0LrQvtGC0L7RgNC+0LzRgyDQsiDRgdC+0L7RgtCy0LXRgtGB0YLQstC40LUg0YHRgtCw0LLQuNGC0YzRgdGPINC/0YDQuNC90Y/RgtGL0LkgY2FsbGJhY2suXG5cdFx0XHTQn9C+0YHQu9C1INGN0YLQvtCz0L4g0LfQsNC/0YDQvtGBINC+0YLQv9GA0LDQstC70Y/QtdGC0YHRjyDQvdCwINGB0LXRgNCy0LXRgC5cblx0XHRcdFxuXHRcdFx00KLQsNC6INC60LDQuiDRjdGC0LAg0YTRg9C90LrRhtC40Y8g0LHRg9C00LXRgiDQv9GA0LjRgdCy0L7QtdC90L3QsCDQv9C+0LvRjiDQvtCx0YrQtdC60YLQsCwg0YLQviDQtNC70Y8g0YPQtNC+0LHRgdGC0LLQsCDQvtC90LAg0LLQvtC30LLRgNCw0YnQsNC10YIgXG5cdFx0XHTQutC+0L3RgtC10LrRgdGCINC+0LHRitC10LrQsCDQuNC3INC60L7RgtC+0YDQvtCz0L4g0L7QvdCwINCx0YvQu9CwINCy0YvQt9Cy0LDQvdC90LAuXG5cdFx0XHTQp9GC0L7QsdGLINC80L7QttC90L4g0LHRi9C70L4g0L/QuNGB0LDRgtGMINCy0L7RgiDRgtCw0LrQuNC1INGI0YLRg9C60Lg6XG5cdFx0XHR0ZWxlcG9ydENsaWVudC5vYmplY3RzLnNvbWVPYmplY3ROYW1lXG5cdFx0XHRcdC5maXJzdE1ldGhvZChzb21lSGFuZGxlcilcblx0XHRcdFx0LnNlY29uZE1ldGhvZChzb21lSGFuZGxlcik7XG5cblx0XHQqL1xuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY01ldGhvZENyZWF0ZSA9IGZ1bmN0aW9uKG9iamVjdE5hbWUsIG1ldGhvZE5hbWUpIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbigpIHsgLy8oY2FsbGJhY2spIG9yIChhcmdzLi4sIGNhbGxiYWNrKSBvciAoYXJncy4uLikgb3IgKClcblx0XHRcdFx0dmFyIGFyZ3M7XG5cdFx0XHRcdHZhciBjYWxsYmFjaztcblxuXHRcdFx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHR2YXIgc2xpY2VFbmRJbmRleCA9IGFyZ3VtZW50cy5sZW5ndGggLSAxO1xuXHRcdFx0XHRcdHZhciBjYWxsYmFja0luZGV4ID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7XG5cblx0XHRcdFx0XHRpZiAodHlwZW9mKGFyZ3VtZW50c1tjYWxsYmFja0luZGV4XSkgIT0gJ2Z1bmN0aW9uJykgc2xpY2VFbmRJbmRleCA9IGFyZ3VtZW50cy5sZW5ndGg7XG5cdFx0XHRcdFx0ZWxzZSBjYWxsYmFjayA9IGFyZ3VtZW50c1tjYWxsYmFja0luZGV4XTtcblxuXHRcdFx0XHRcdGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDAsIHNsaWNlRW5kSW5kZXgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFjYWxsYmFjaylcblx0XHRcdFx0XHRjYWxsYmFjayA9IGZ1bmN0aW9uKGVycm9yLCByZXN1bHQpIHtcblx0XHRcdFx0XHRcdHRoaXMuZW1pdCgnd2FybicsIHtcblx0XHRcdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIFdhcm46INGB0LXRgNCy0LXRgCDQstC10YDQvdGD0Lsg0YDQtdC30YPQu9GM0YLQsNGCINC00LvRjyBcIiArIG9iamVjdE5hbWUgKyBcIi5cIiArIG1ldGhvZE5hbWUgKyBcIiDQsdC10Lcg0LfQsNGA0LXQs9C40YHRgtGA0LjRgNC+0LLQsNC90L3QvtCz0L4g0L3QsCDQutC70LjQtdC90YLQtSDQutCw0LvQsdC10LrQsFwiLFxuXHRcdFx0XHRcdFx0XHRjYWxsZWRXaXRoQXJndW1lbnRzOiBhcmd1bWVudHMsXG5cdFx0XHRcdFx0XHRcdHJldHVybmVkRXJyb3I6IGVycm9yLFxuXHRcdFx0XHRcdFx0XHRyZXR1cm5lZFJlc3VsdDogcmVzdWx0XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9LmJpbmQodGhpcyk7XG5cblx0XHRcdFx0dmFyIHJlcXVlc3RJZCA9IHRoaXMuX3ZhbHVlUmVxdWVzdHMubGVuZ3RoO1xuXHRcdFx0XHR0aGlzLl92YWx1ZVJlcXVlc3RzLnB1c2goY2FsbGJhY2spO1xuXG5cdFx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdFx0ZGVzYzogXCJbVGVsZXBvcnRDbGllbnRdIERlYnVnOiDQstGL0LfQstGL0L0g0LzQtdGC0L7QtCDRgdC10YDQstC10YDQvdC+0LPQviDQvtCx0YrQtdC60YLQsDogXCIgKyBvYmplY3ROYW1lICsgXCIuXCIgKyBtZXRob2ROYW1lLFxuXHRcdFx0XHRcdGFyZ3M6IGFyZ3MsXG5cdFx0XHRcdFx0cmVxdWVzdElkOiByZXF1ZXN0SWRcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGhpcy5fZnVuY1F1YXJhbnRlZWRTZW5kTWVzc2FnZSh7XG5cdFx0XHRcdFx0b2JqZWN0TmFtZTogb2JqZWN0TmFtZSxcblx0XHRcdFx0XHR0eXBlOiBcImNvbW1hbmRcIixcblx0XHRcdFx0XHRjb21tYW5kOiBtZXRob2ROYW1lLFxuXHRcdFx0XHRcdHJlcXVlc3RJZDogcmVxdWVzdElkLFxuXHRcdFx0XHRcdHBlZXJJZDogdGhpcy5fdmFsdWVQZWVySWQsXG5cdFx0XHRcdFx0YXJnczogYXJnc1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRyZXR1cm4gdGhpcy5vYmplY3RzW29iamVjdE5hbWVdO1xuXHRcdFx0fTtcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0XHTQpdC10L3QtNC70LXRgCDQtNC70Y8g0LrQsNC70LHQtdC60L7QsiDQvNC10YLQvtC00L7QsiDRgdC10YDQstC10YDQvdGL0YUg0L7QsdGK0LXQutGC0L7Qsi5cblx0XHRcdNGE0L7RgNC80LDRgiDQv9GA0LjQvdC40LzQsNC10LzQvtCz0L4g0LDRgNCz0YPQvNC10L3RgtCwIFxuXHRcdFx0XG5cdFx0XHRtZXNzYWdlID0ge1xuXHRcdFx0XHR0eXBlOiAnY2FsbGJhY2snLFxuXHRcdFx0XHRjb21tYW5kOiAnbWV0aG9kTmFtZScsXG5cdFx0XHRcdG9iamVjdE5hbWU6ICdvYmplY3ROYW1lJyxcblx0XHRcdFx0cmVxdWVzdElkOiAwLFxuXHRcdFx0XHRlcnJvcjogbnVsbCxcblx0XHRcdFx0cmVzdWx0OiBzb21lUmVzdWx0XG5cdFx0XHR9XG5cblx0XHRcdNCy0L3Rg9GC0YDQuCDQvNC10YLQvtC00LAg0LHRg9C00LXRgiDQstGL0LfQstCw0L0g0LrQsNC70LHQtdC6INC/0L7RgdGC0LDQstC70LXQvdC90YvQuSDQsiDRgdC+0L7RgtCy0LXRgtGB0YLQstC40LUg0YEgcmVxdWVzdElkXG5cblx0XHQqL1xuXHRcdFRlbGVwb3J0Q2xpZW50LnByb3RvdHlwZS5fZnVuY0NhbGxiYWNrSGFuZGxlciA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcblx0XHRcdHRoaXMuZW1pdCgnZGVidWcnLCB7XG5cdFx0XHRcdGRlc2M6IFwiW1RlbGVwb3J0Q2xpZW50XSBEZWJ1Zzog0YHQtdGA0LLQtdGAINCy0LXRgNC90YPQuyBjYWxsYmFjayDQvdCwOiBcIiArIG1lc3NhZ2Uub2JqZWN0TmFtZSArIFwiLlwiICsgbWVzc2FnZS5jb21tYW5kLFxuXHRcdFx0XHRtZXNzYWdlOiBtZXNzYWdlXG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5fdmFsdWVSZXF1ZXN0c1ttZXNzYWdlLnJlcXVlc3RJZF0obWVzc2FnZS5lcnJvciwgbWVzc2FnZS5yZXN1bHQpO1xuXHRcdFx0ZGVsZXRlIHRoaXMuX3ZhbHVlUmVxdWVzdHNbbWVzc2FnZS5yZXF1ZXN0SWRdO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHRcdNCl0Y3QvdC00LvQtdGAINC00LvRjyDRgdC+0LHRi9GC0LjQuSDQstGL0LHRgNCw0YHRi9Cy0LDQtdC80YvRhSDRgdC10YDQstC10YDQvdGL0LzQuCDQvtCx0YrQtdC60YLQsNC80Lhcblx0XHRcdNGE0L7RgNC80LDRgiDQv9GA0LjQvdC40LzQsNC10LPQviDQsNGA0LPRg9C80LXQvdGC0LBcblxuXHRcdFx00YLQsNC6INC60LDQuiBlbWl0INC/0YDQuNC90LjQvNCw0LXRgiDQvdC10L7Qs9GA0LDQvdC40YfQtdC90L3QvtC1INC60L7Qu9C40YfQtdGB0YLQstC+INCw0YDQs9GD0LzQtdC90YLQvtCyINC/0LXRgNC10LTQsNCy0LDQtdC80YvRhSDQv9C+0LTQv9C40YHRh9C40LrQsNC8LCDRgtC+XG5cdFx0XHRtZXNzYWdlLmFyZ3Mg0Y3RgtC+INC80LDRgdGB0LjQsiwg0YHQvtC00LXRgNC20LDRidC40Lkg0L/QtdGA0LXQtNCw0L3QvdGL0LUg0LDRgNCz0YPQvNC10L3RgtGLLlxuXG5cdFx0XHRtZXNzYWdlID0ge1xuXHRcdFx0XHR0eXBlOiAnZXZlbnQnLFxuXHRcdFx0XHRldmVudDogJ2V2ZW50TmFtZScsXG5cdFx0XHRcdG9iamVjdE5hbWU6ICdzb21lT2JqZWN0TmFtZSdcblx0XHRcdFx0YXJnczogW3NvbWVBcmdzXVxuXHRcdFx0fVxuXG5cdFx0Ki9cblx0XHRUZWxlcG9ydENsaWVudC5wcm90b3R5cGUuX2Z1bmNFdmVudEhhbmRsZXIgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG5cdFx0XHR0aGlzLmVtaXQoJ2RlYnVnJywge1xuXHRcdFx0XHRkZXNjOiBcIltUZWxlcG9ydENsaWVudF0gRGVidWc6INGB0LXRgNCy0LXRgCDQv9C10YDQtdC00LDQuyDRgdC+0LHRi9GC0LjQtTogXCIgKyBtZXNzYWdlLm9iamVjdE5hbWUgKyBcIi5cIiArIG1lc3NhZ2UuZXZlbnQsXG5cdFx0XHRcdG1lc3NhZ2U6IG1lc3NhZ2Vcblx0XHRcdH0pO1xuXG5cdFx0XHR2YXIgZW1pdEFyZ3MgPSBbXTtcblx0XHRcdGVtaXRBcmdzLnB1c2gobWVzc2FnZS5ldmVudCk7XG5cdFx0XHRlbWl0QXJncyA9IGVtaXRBcmdzLmNvbmNhdChtZXNzYWdlLmFyZ3MpO1xuXG5cdFx0XHR2YXIgb2JqZWN0ID0gdGhpcy5vYmplY3RzW21lc3NhZ2Uub2JqZWN0TmFtZV07XG5cblx0XHRcdG9iamVjdC5lbWl0LmFwcGx5KG9iamVjdCwgZW1pdEFyZ3MpO1xuXHRcdH07XG5cblx0XHQvL2VuZCBwcml2YXRlXG5cblx0XHRyZXR1cm4gVGVsZXBvcnRDbGllbnQ7XG5cdH1cbn0od2luZG93KSk7IiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiaWYgKHR5cGVvZiBPYmplY3QuY3JlYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gIC8vIGltcGxlbWVudGF0aW9uIGZyb20gc3RhbmRhcmQgbm9kZS5qcyAndXRpbCcgbW9kdWxlXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICBjdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDdG9yLnByb3RvdHlwZSwge1xuICAgICAgY29uc3RydWN0b3I6IHtcbiAgICAgICAgdmFsdWU6IGN0b3IsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9XG4gICAgfSk7XG4gIH07XG59IGVsc2Uge1xuICAvLyBvbGQgc2Nob29sIHNoaW0gZm9yIG9sZCBicm93c2Vyc1xuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgdmFyIFRlbXBDdG9yID0gZnVuY3Rpb24gKCkge31cbiAgICBUZW1wQ3Rvci5wcm90b3R5cGUgPSBzdXBlckN0b3IucHJvdG90eXBlXG4gICAgY3Rvci5wcm90b3R5cGUgPSBuZXcgVGVtcEN0b3IoKVxuICAgIGN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gY3RvclxuICB9XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG5wcm9jZXNzLm5leHRUaWNrID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2FuU2V0SW1tZWRpYXRlID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cuc2V0SW1tZWRpYXRlO1xuICAgIHZhciBjYW5Qb3N0ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cucG9zdE1lc3NhZ2UgJiYgd2luZG93LmFkZEV2ZW50TGlzdGVuZXJcbiAgICA7XG5cbiAgICBpZiAoY2FuU2V0SW1tZWRpYXRlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZikgeyByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZShmKSB9O1xuICAgIH1cblxuICAgIGlmIChjYW5Qb3N0KSB7XG4gICAgICAgIHZhciBxdWV1ZSA9IFtdO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IGV2LnNvdXJjZTtcbiAgICAgICAgICAgIGlmICgoc291cmNlID09PSB3aW5kb3cgfHwgc291cmNlID09PSBudWxsKSAmJiBldi5kYXRhID09PSAncHJvY2Vzcy10aWNrJykge1xuICAgICAgICAgICAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goZm4pO1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKCdwcm9jZXNzLXRpY2snLCAnKicpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufSkoKTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59XG5cbi8vIFRPRE8oc2h0eWxtYW4pXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNCdWZmZXIoYXJnKSB7XG4gIHJldHVybiBhcmcgJiYgdHlwZW9mIGFyZyA9PT0gJ29iamVjdCdcbiAgICAmJiB0eXBlb2YgYXJnLmNvcHkgPT09ICdmdW5jdGlvbidcbiAgICAmJiB0eXBlb2YgYXJnLmZpbGwgPT09ICdmdW5jdGlvbidcbiAgICAmJiB0eXBlb2YgYXJnLnJlYWRVSW50OCA9PT0gJ2Z1bmN0aW9uJztcbn0iLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsKXtcbi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG52YXIgZm9ybWF0UmVnRXhwID0gLyVbc2RqJV0vZztcbmV4cG9ydHMuZm9ybWF0ID0gZnVuY3Rpb24oZikge1xuICBpZiAoIWlzU3RyaW5nKGYpKSB7XG4gICAgdmFyIG9iamVjdHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgb2JqZWN0cy5wdXNoKGluc3BlY3QoYXJndW1lbnRzW2ldKSk7XG4gICAgfVxuICAgIHJldHVybiBvYmplY3RzLmpvaW4oJyAnKTtcbiAgfVxuXG4gIHZhciBpID0gMTtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciBsZW4gPSBhcmdzLmxlbmd0aDtcbiAgdmFyIHN0ciA9IFN0cmluZyhmKS5yZXBsYWNlKGZvcm1hdFJlZ0V4cCwgZnVuY3Rpb24oeCkge1xuICAgIGlmICh4ID09PSAnJSUnKSByZXR1cm4gJyUnO1xuICAgIGlmIChpID49IGxlbikgcmV0dXJuIHg7XG4gICAgc3dpdGNoICh4KSB7XG4gICAgICBjYXNlICclcyc6IHJldHVybiBTdHJpbmcoYXJnc1tpKytdKTtcbiAgICAgIGNhc2UgJyVkJzogcmV0dXJuIE51bWJlcihhcmdzW2krK10pO1xuICAgICAgY2FzZSAnJWonOlxuICAgICAgICB0cnkge1xuICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShhcmdzW2krK10pO1xuICAgICAgICB9IGNhdGNoIChfKSB7XG4gICAgICAgICAgcmV0dXJuICdbQ2lyY3VsYXJdJztcbiAgICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgfVxuICB9KTtcbiAgZm9yICh2YXIgeCA9IGFyZ3NbaV07IGkgPCBsZW47IHggPSBhcmdzWysraV0pIHtcbiAgICBpZiAoaXNOdWxsKHgpIHx8ICFpc09iamVjdCh4KSkge1xuICAgICAgc3RyICs9ICcgJyArIHg7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciArPSAnICcgKyBpbnNwZWN0KHgpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gc3RyO1xufTtcblxuXG4vLyBNYXJrIHRoYXQgYSBtZXRob2Qgc2hvdWxkIG5vdCBiZSB1c2VkLlxuLy8gUmV0dXJucyBhIG1vZGlmaWVkIGZ1bmN0aW9uIHdoaWNoIHdhcm5zIG9uY2UgYnkgZGVmYXVsdC5cbi8vIElmIC0tbm8tZGVwcmVjYXRpb24gaXMgc2V0LCB0aGVuIGl0IGlzIGEgbm8tb3AuXG5leHBvcnRzLmRlcHJlY2F0ZSA9IGZ1bmN0aW9uKGZuLCBtc2cpIHtcbiAgLy8gQWxsb3cgZm9yIGRlcHJlY2F0aW5nIHRoaW5ncyBpbiB0aGUgcHJvY2VzcyBvZiBzdGFydGluZyB1cC5cbiAgaWYgKGlzVW5kZWZpbmVkKGdsb2JhbC5wcm9jZXNzKSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBleHBvcnRzLmRlcHJlY2F0ZShmbiwgbXNnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cblxuICBpZiAocHJvY2Vzcy5ub0RlcHJlY2F0aW9uID09PSB0cnVlKSB7XG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgdmFyIHdhcm5lZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBkZXByZWNhdGVkKCkge1xuICAgIGlmICghd2FybmVkKSB7XG4gICAgICBpZiAocHJvY2Vzcy50aHJvd0RlcHJlY2F0aW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtc2cpO1xuICAgICAgfSBlbHNlIGlmIChwcm9jZXNzLnRyYWNlRGVwcmVjYXRpb24pIHtcbiAgICAgICAgY29uc29sZS50cmFjZShtc2cpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihtc2cpO1xuICAgICAgfVxuICAgICAgd2FybmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gZGVwcmVjYXRlZDtcbn07XG5cblxudmFyIGRlYnVncyA9IHt9O1xudmFyIGRlYnVnRW52aXJvbjtcbmV4cG9ydHMuZGVidWdsb2cgPSBmdW5jdGlvbihzZXQpIHtcbiAgaWYgKGlzVW5kZWZpbmVkKGRlYnVnRW52aXJvbikpXG4gICAgZGVidWdFbnZpcm9uID0gcHJvY2Vzcy5lbnYuTk9ERV9ERUJVRyB8fCAnJztcbiAgc2V0ID0gc2V0LnRvVXBwZXJDYXNlKCk7XG4gIGlmICghZGVidWdzW3NldF0pIHtcbiAgICBpZiAobmV3IFJlZ0V4cCgnXFxcXGInICsgc2V0ICsgJ1xcXFxiJywgJ2knKS50ZXN0KGRlYnVnRW52aXJvbikpIHtcbiAgICAgIHZhciBwaWQgPSBwcm9jZXNzLnBpZDtcbiAgICAgIGRlYnVnc1tzZXRdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBtc2cgPSBleHBvcnRzLmZvcm1hdC5hcHBseShleHBvcnRzLCBhcmd1bWVudHMpO1xuICAgICAgICBjb25zb2xlLmVycm9yKCclcyAlZDogJXMnLCBzZXQsIHBpZCwgbXNnKTtcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlYnVnc1tzZXRdID0gZnVuY3Rpb24oKSB7fTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRlYnVnc1tzZXRdO1xufTtcblxuXG4vKipcbiAqIEVjaG9zIHRoZSB2YWx1ZSBvZiBhIHZhbHVlLiBUcnlzIHRvIHByaW50IHRoZSB2YWx1ZSBvdXRcbiAqIGluIHRoZSBiZXN0IHdheSBwb3NzaWJsZSBnaXZlbiB0aGUgZGlmZmVyZW50IHR5cGVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogVGhlIG9iamVjdCB0byBwcmludCBvdXQuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0cyBPcHRpb25hbCBvcHRpb25zIG9iamVjdCB0aGF0IGFsdGVycyB0aGUgb3V0cHV0LlxuICovXG4vKiBsZWdhY3k6IG9iaiwgc2hvd0hpZGRlbiwgZGVwdGgsIGNvbG9ycyovXG5mdW5jdGlvbiBpbnNwZWN0KG9iaiwgb3B0cykge1xuICAvLyBkZWZhdWx0IG9wdGlvbnNcbiAgdmFyIGN0eCA9IHtcbiAgICBzZWVuOiBbXSxcbiAgICBzdHlsaXplOiBzdHlsaXplTm9Db2xvclxuICB9O1xuICAvLyBsZWdhY3kuLi5cbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gMykgY3R4LmRlcHRoID0gYXJndW1lbnRzWzJdO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSA0KSBjdHguY29sb3JzID0gYXJndW1lbnRzWzNdO1xuICBpZiAoaXNCb29sZWFuKG9wdHMpKSB7XG4gICAgLy8gbGVnYWN5Li4uXG4gICAgY3R4LnNob3dIaWRkZW4gPSBvcHRzO1xuICB9IGVsc2UgaWYgKG9wdHMpIHtcbiAgICAvLyBnb3QgYW4gXCJvcHRpb25zXCIgb2JqZWN0XG4gICAgZXhwb3J0cy5fZXh0ZW5kKGN0eCwgb3B0cyk7XG4gIH1cbiAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LnNob3dIaWRkZW4pKSBjdHguc2hvd0hpZGRlbiA9IGZhbHNlO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmRlcHRoKSkgY3R4LmRlcHRoID0gMjtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5jb2xvcnMpKSBjdHguY29sb3JzID0gZmFsc2U7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguY3VzdG9tSW5zcGVjdCkpIGN0eC5jdXN0b21JbnNwZWN0ID0gdHJ1ZTtcbiAgaWYgKGN0eC5jb2xvcnMpIGN0eC5zdHlsaXplID0gc3R5bGl6ZVdpdGhDb2xvcjtcbiAgcmV0dXJuIGZvcm1hdFZhbHVlKGN0eCwgb2JqLCBjdHguZGVwdGgpO1xufVxuZXhwb3J0cy5pbnNwZWN0ID0gaW5zcGVjdDtcblxuXG4vLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FOU0lfZXNjYXBlX2NvZGUjZ3JhcGhpY3Ncbmluc3BlY3QuY29sb3JzID0ge1xuICAnYm9sZCcgOiBbMSwgMjJdLFxuICAnaXRhbGljJyA6IFszLCAyM10sXG4gICd1bmRlcmxpbmUnIDogWzQsIDI0XSxcbiAgJ2ludmVyc2UnIDogWzcsIDI3XSxcbiAgJ3doaXRlJyA6IFszNywgMzldLFxuICAnZ3JleScgOiBbOTAsIDM5XSxcbiAgJ2JsYWNrJyA6IFszMCwgMzldLFxuICAnYmx1ZScgOiBbMzQsIDM5XSxcbiAgJ2N5YW4nIDogWzM2LCAzOV0sXG4gICdncmVlbicgOiBbMzIsIDM5XSxcbiAgJ21hZ2VudGEnIDogWzM1LCAzOV0sXG4gICdyZWQnIDogWzMxLCAzOV0sXG4gICd5ZWxsb3cnIDogWzMzLCAzOV1cbn07XG5cbi8vIERvbid0IHVzZSAnYmx1ZScgbm90IHZpc2libGUgb24gY21kLmV4ZVxuaW5zcGVjdC5zdHlsZXMgPSB7XG4gICdzcGVjaWFsJzogJ2N5YW4nLFxuICAnbnVtYmVyJzogJ3llbGxvdycsXG4gICdib29sZWFuJzogJ3llbGxvdycsXG4gICd1bmRlZmluZWQnOiAnZ3JleScsXG4gICdudWxsJzogJ2JvbGQnLFxuICAnc3RyaW5nJzogJ2dyZWVuJyxcbiAgJ2RhdGUnOiAnbWFnZW50YScsXG4gIC8vIFwibmFtZVwiOiBpbnRlbnRpb25hbGx5IG5vdCBzdHlsaW5nXG4gICdyZWdleHAnOiAncmVkJ1xufTtcblxuXG5mdW5jdGlvbiBzdHlsaXplV2l0aENvbG9yKHN0ciwgc3R5bGVUeXBlKSB7XG4gIHZhciBzdHlsZSA9IGluc3BlY3Quc3R5bGVzW3N0eWxlVHlwZV07XG5cbiAgaWYgKHN0eWxlKSB7XG4gICAgcmV0dXJuICdcXHUwMDFiWycgKyBpbnNwZWN0LmNvbG9yc1tzdHlsZV1bMF0gKyAnbScgKyBzdHIgK1xuICAgICAgICAgICAnXFx1MDAxYlsnICsgaW5zcGVjdC5jb2xvcnNbc3R5bGVdWzFdICsgJ20nO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBzdHI7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBzdHlsaXplTm9Db2xvcihzdHIsIHN0eWxlVHlwZSkge1xuICByZXR1cm4gc3RyO1xufVxuXG5cbmZ1bmN0aW9uIGFycmF5VG9IYXNoKGFycmF5KSB7XG4gIHZhciBoYXNoID0ge307XG5cbiAgYXJyYXkuZm9yRWFjaChmdW5jdGlvbih2YWwsIGlkeCkge1xuICAgIGhhc2hbdmFsXSA9IHRydWU7XG4gIH0pO1xuXG4gIHJldHVybiBoYXNoO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFZhbHVlKGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcykge1xuICAvLyBQcm92aWRlIGEgaG9vayBmb3IgdXNlci1zcGVjaWZpZWQgaW5zcGVjdCBmdW5jdGlvbnMuXG4gIC8vIENoZWNrIHRoYXQgdmFsdWUgaXMgYW4gb2JqZWN0IHdpdGggYW4gaW5zcGVjdCBmdW5jdGlvbiBvbiBpdFxuICBpZiAoY3R4LmN1c3RvbUluc3BlY3QgJiZcbiAgICAgIHZhbHVlICYmXG4gICAgICBpc0Z1bmN0aW9uKHZhbHVlLmluc3BlY3QpICYmXG4gICAgICAvLyBGaWx0ZXIgb3V0IHRoZSB1dGlsIG1vZHVsZSwgaXQncyBpbnNwZWN0IGZ1bmN0aW9uIGlzIHNwZWNpYWxcbiAgICAgIHZhbHVlLmluc3BlY3QgIT09IGV4cG9ydHMuaW5zcGVjdCAmJlxuICAgICAgLy8gQWxzbyBmaWx0ZXIgb3V0IGFueSBwcm90b3R5cGUgb2JqZWN0cyB1c2luZyB0aGUgY2lyY3VsYXIgY2hlY2suXG4gICAgICAhKHZhbHVlLmNvbnN0cnVjdG9yICYmIHZhbHVlLmNvbnN0cnVjdG9yLnByb3RvdHlwZSA9PT0gdmFsdWUpKSB7XG4gICAgdmFyIHJldCA9IHZhbHVlLmluc3BlY3QocmVjdXJzZVRpbWVzLCBjdHgpO1xuICAgIGlmICghaXNTdHJpbmcocmV0KSkge1xuICAgICAgcmV0ID0gZm9ybWF0VmFsdWUoY3R4LCByZXQsIHJlY3Vyc2VUaW1lcyk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICAvLyBQcmltaXRpdmUgdHlwZXMgY2Fubm90IGhhdmUgcHJvcGVydGllc1xuICB2YXIgcHJpbWl0aXZlID0gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpO1xuICBpZiAocHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIHByaW1pdGl2ZTtcbiAgfVxuXG4gIC8vIExvb2sgdXAgdGhlIGtleXMgb2YgdGhlIG9iamVjdC5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSk7XG4gIHZhciB2aXNpYmxlS2V5cyA9IGFycmF5VG9IYXNoKGtleXMpO1xuXG4gIGlmIChjdHguc2hvd0hpZGRlbikge1xuICAgIGtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh2YWx1ZSk7XG4gIH1cblxuICAvLyBJRSBkb2Vzbid0IG1ha2UgZXJyb3IgZmllbGRzIG5vbi1lbnVtZXJhYmxlXG4gIC8vIGh0dHA6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9pZS9kd3c1MnNidCh2PXZzLjk0KS5hc3B4XG4gIGlmIChpc0Vycm9yKHZhbHVlKVxuICAgICAgJiYgKGtleXMuaW5kZXhPZignbWVzc2FnZScpID49IDAgfHwga2V5cy5pbmRleE9mKCdkZXNjcmlwdGlvbicpID49IDApKSB7XG4gICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgfVxuXG4gIC8vIFNvbWUgdHlwZSBvZiBvYmplY3Qgd2l0aG91dCBwcm9wZXJ0aWVzIGNhbiBiZSBzaG9ydGN1dHRlZC5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICB2YXIgbmFtZSA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbRnVuY3Rpb24nICsgbmFtZSArICddJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9XG4gICAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShEYXRlLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ2RhdGUnKTtcbiAgICB9XG4gICAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgICByZXR1cm4gZm9ybWF0RXJyb3IodmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBiYXNlID0gJycsIGFycmF5ID0gZmFsc2UsIGJyYWNlcyA9IFsneycsICd9J107XG5cbiAgLy8gTWFrZSBBcnJheSBzYXkgdGhhdCB0aGV5IGFyZSBBcnJheVxuICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICBhcnJheSA9IHRydWU7XG4gICAgYnJhY2VzID0gWydbJywgJ10nXTtcbiAgfVxuXG4gIC8vIE1ha2UgZnVuY3Rpb25zIHNheSB0aGF0IHRoZXkgYXJlIGZ1bmN0aW9uc1xuICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICB2YXIgbiA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgIGJhc2UgPSAnIFtGdW5jdGlvbicgKyBuICsgJ10nO1xuICB9XG5cbiAgLy8gTWFrZSBSZWdFeHBzIHNheSB0aGF0IHRoZXkgYXJlIFJlZ0V4cHNcbiAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBkYXRlcyB3aXRoIHByb3BlcnRpZXMgZmlyc3Qgc2F5IHRoZSBkYXRlXG4gIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIERhdGUucHJvdG90eXBlLnRvVVRDU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBlcnJvciB3aXRoIG1lc3NhZ2UgZmlyc3Qgc2F5IHRoZSBlcnJvclxuICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgZm9ybWF0RXJyb3IodmFsdWUpO1xuICB9XG5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwICYmICghYXJyYXkgfHwgdmFsdWUubGVuZ3RoID09IDApKSB7XG4gICAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyBicmFjZXNbMV07XG4gIH1cblxuICBpZiAocmVjdXJzZVRpbWVzIDwgMCkge1xuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW09iamVjdF0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuXG4gIGN0eC5zZWVuLnB1c2godmFsdWUpO1xuXG4gIHZhciBvdXRwdXQ7XG4gIGlmIChhcnJheSkge1xuICAgIG91dHB1dCA9IGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpO1xuICB9IGVsc2Uge1xuICAgIG91dHB1dCA9IGtleXMubWFwKGZ1bmN0aW9uKGtleSkge1xuICAgICAgcmV0dXJuIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpO1xuICAgIH0pO1xuICB9XG5cbiAgY3R4LnNlZW4ucG9wKCk7XG5cbiAgcmV0dXJuIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSkge1xuICBpZiAoaXNVbmRlZmluZWQodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgndW5kZWZpbmVkJywgJ3VuZGVmaW5lZCcpO1xuICBpZiAoaXNTdHJpbmcodmFsdWUpKSB7XG4gICAgdmFyIHNpbXBsZSA9ICdcXCcnICsgSlNPTi5zdHJpbmdpZnkodmFsdWUpLnJlcGxhY2UoL15cInxcIiQvZywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpICsgJ1xcJyc7XG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKHNpbXBsZSwgJ3N0cmluZycpO1xuICB9XG4gIGlmIChpc051bWJlcih2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdudW1iZXInKTtcbiAgaWYgKGlzQm9vbGVhbih2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdib29sZWFuJyk7XG4gIC8vIEZvciBzb21lIHJlYXNvbiB0eXBlb2YgbnVsbCBpcyBcIm9iamVjdFwiLCBzbyBzcGVjaWFsIGNhc2UgaGVyZS5cbiAgaWYgKGlzTnVsbCh2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCdudWxsJywgJ251bGwnKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRFcnJvcih2YWx1ZSkge1xuICByZXR1cm4gJ1snICsgRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpICsgJ10nO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpIHtcbiAgdmFyIG91dHB1dCA9IFtdO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHZhbHVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgIGlmIChoYXNPd25Qcm9wZXJ0eSh2YWx1ZSwgU3RyaW5nKGkpKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBTdHJpbmcoaSksIHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0LnB1c2goJycpO1xuICAgIH1cbiAgfVxuICBrZXlzLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgaWYgKCFrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICBvdXRwdXQucHVzaChmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLFxuICAgICAgICAgIGtleSwgdHJ1ZSkpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSkge1xuICB2YXIgbmFtZSwgc3RyLCBkZXNjO1xuICBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih2YWx1ZSwga2V5KSB8fCB7IHZhbHVlOiB2YWx1ZVtrZXldIH07XG4gIGlmIChkZXNjLmdldCkge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXIvU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tTZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cbiAgaWYgKCFoYXNPd25Qcm9wZXJ0eSh2aXNpYmxlS2V5cywga2V5KSkge1xuICAgIG5hbWUgPSAnWycgKyBrZXkgKyAnXSc7XG4gIH1cbiAgaWYgKCFzdHIpIHtcbiAgICBpZiAoY3R4LnNlZW4uaW5kZXhPZihkZXNjLnZhbHVlKSA8IDApIHtcbiAgICAgIGlmIChpc051bGwocmVjdXJzZVRpbWVzKSkge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIGRlc2MudmFsdWUsIG51bGwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCBkZXNjLnZhbHVlLCByZWN1cnNlVGltZXMgLSAxKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdHIuaW5kZXhPZignXFxuJykgPiAtMSkge1xuICAgICAgICBpZiAoYXJyYXkpIHtcbiAgICAgICAgICBzdHIgPSBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJykuc3Vic3RyKDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0ciA9ICdcXG4nICsgc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0NpcmN1bGFyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG4gIGlmIChpc1VuZGVmaW5lZChuYW1lKSkge1xuICAgIGlmIChhcnJheSAmJiBrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBuYW1lID0gSlNPTi5zdHJpbmdpZnkoJycgKyBrZXkpO1xuICAgIGlmIChuYW1lLm1hdGNoKC9eXCIoW2EtekEtWl9dW2EtekEtWl8wLTldKilcIiQvKSkge1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyKDEsIG5hbWUubGVuZ3RoIC0gMik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ25hbWUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmFtZSA9IG5hbWUucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJylcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyheXCJ8XCIkKS9nLCBcIidcIik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ3N0cmluZycpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuYW1lICsgJzogJyArIHN0cjtcbn1cblxuXG5mdW5jdGlvbiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcykge1xuICB2YXIgbnVtTGluZXNFc3QgPSAwO1xuICB2YXIgbGVuZ3RoID0gb3V0cHV0LnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXIpIHtcbiAgICBudW1MaW5lc0VzdCsrO1xuICAgIGlmIChjdXIuaW5kZXhPZignXFxuJykgPj0gMCkgbnVtTGluZXNFc3QrKztcbiAgICByZXR1cm4gcHJldiArIGN1ci5yZXBsYWNlKC9cXHUwMDFiXFxbXFxkXFxkP20vZywgJycpLmxlbmd0aCArIDE7XG4gIH0sIDApO1xuXG4gIGlmIChsZW5ndGggPiA2MCkge1xuICAgIHJldHVybiBicmFjZXNbMF0gK1xuICAgICAgICAgICAoYmFzZSA9PT0gJycgPyAnJyA6IGJhc2UgKyAnXFxuICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgb3V0cHV0LmpvaW4oJyxcXG4gICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgYnJhY2VzWzFdO1xuICB9XG5cbiAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyAnICcgKyBvdXRwdXQuam9pbignLCAnKSArICcgJyArIGJyYWNlc1sxXTtcbn1cblxuXG4vLyBOT1RFOiBUaGVzZSB0eXBlIGNoZWNraW5nIGZ1bmN0aW9ucyBpbnRlbnRpb25hbGx5IGRvbid0IHVzZSBgaW5zdGFuY2VvZmBcbi8vIGJlY2F1c2UgaXQgaXMgZnJhZ2lsZSBhbmQgY2FuIGJlIGVhc2lseSBmYWtlZCB3aXRoIGBPYmplY3QuY3JlYXRlKClgLlxuZnVuY3Rpb24gaXNBcnJheShhcikge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShhcik7XG59XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5mdW5jdGlvbiBpc0Jvb2xlYW4oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnYm9vbGVhbic7XG59XG5leHBvcnRzLmlzQm9vbGVhbiA9IGlzQm9vbGVhbjtcblxuZnVuY3Rpb24gaXNOdWxsKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGwgPSBpc051bGw7XG5cbmZ1bmN0aW9uIGlzTnVsbE9yVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbE9yVW5kZWZpbmVkID0gaXNOdWxsT3JVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5leHBvcnRzLmlzTnVtYmVyID0gaXNOdW1iZXI7XG5cbmZ1bmN0aW9uIGlzU3RyaW5nKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N0cmluZyc7XG59XG5leHBvcnRzLmlzU3RyaW5nID0gaXNTdHJpbmc7XG5cbmZ1bmN0aW9uIGlzU3ltYm9sKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCc7XG59XG5leHBvcnRzLmlzU3ltYm9sID0gaXNTeW1ib2w7XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG5leHBvcnRzLmlzVW5kZWZpbmVkID0gaXNVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzUmVnRXhwKHJlKSB7XG4gIHJldHVybiBpc09iamVjdChyZSkgJiYgb2JqZWN0VG9TdHJpbmcocmUpID09PSAnW29iamVjdCBSZWdFeHBdJztcbn1cbmV4cG9ydHMuaXNSZWdFeHAgPSBpc1JlZ0V4cDtcblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG5cbmZ1bmN0aW9uIGlzRGF0ZShkKSB7XG4gIHJldHVybiBpc09iamVjdChkKSAmJiBvYmplY3RUb1N0cmluZyhkKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuZXhwb3J0cy5pc0RhdGUgPSBpc0RhdGU7XG5cbmZ1bmN0aW9uIGlzRXJyb3IoZSkge1xuICByZXR1cm4gaXNPYmplY3QoZSkgJiZcbiAgICAgIChvYmplY3RUb1N0cmluZyhlKSA9PT0gJ1tvYmplY3QgRXJyb3JdJyB8fCBlIGluc3RhbmNlb2YgRXJyb3IpO1xufVxuZXhwb3J0cy5pc0Vycm9yID0gaXNFcnJvcjtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xuXG5mdW5jdGlvbiBpc1ByaW1pdGl2ZShhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbCB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnbnVtYmVyJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnIHx8ICAvLyBFUzYgc3ltYm9sXG4gICAgICAgICB0eXBlb2YgYXJnID09PSAndW5kZWZpbmVkJztcbn1cbmV4cG9ydHMuaXNQcmltaXRpdmUgPSBpc1ByaW1pdGl2ZTtcblxuZXhwb3J0cy5pc0J1ZmZlciA9IHJlcXVpcmUoJy4vc3VwcG9ydC9pc0J1ZmZlcicpO1xuXG5mdW5jdGlvbiBvYmplY3RUb1N0cmluZyhvKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobyk7XG59XG5cblxuZnVuY3Rpb24gcGFkKG4pIHtcbiAgcmV0dXJuIG4gPCAxMCA/ICcwJyArIG4udG9TdHJpbmcoMTApIDogbi50b1N0cmluZygxMCk7XG59XG5cblxudmFyIG1vbnRocyA9IFsnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLFxuICAgICAgICAgICAgICAnT2N0JywgJ05vdicsICdEZWMnXTtcblxuLy8gMjYgRmViIDE2OjE5OjM0XG5mdW5jdGlvbiB0aW1lc3RhbXAoKSB7XG4gIHZhciBkID0gbmV3IERhdGUoKTtcbiAgdmFyIHRpbWUgPSBbcGFkKGQuZ2V0SG91cnMoKSksXG4gICAgICAgICAgICAgIHBhZChkLmdldE1pbnV0ZXMoKSksXG4gICAgICAgICAgICAgIHBhZChkLmdldFNlY29uZHMoKSldLmpvaW4oJzonKTtcbiAgcmV0dXJuIFtkLmdldERhdGUoKSwgbW9udGhzW2QuZ2V0TW9udGgoKV0sIHRpbWVdLmpvaW4oJyAnKTtcbn1cblxuXG4vLyBsb2cgaXMganVzdCBhIHRoaW4gd3JhcHBlciB0byBjb25zb2xlLmxvZyB0aGF0IHByZXBlbmRzIGEgdGltZXN0YW1wXG5leHBvcnRzLmxvZyA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnJXMgLSAlcycsIHRpbWVzdGFtcCgpLCBleHBvcnRzLmZvcm1hdC5hcHBseShleHBvcnRzLCBhcmd1bWVudHMpKTtcbn07XG5cblxuLyoqXG4gKiBJbmhlcml0IHRoZSBwcm90b3R5cGUgbWV0aG9kcyBmcm9tIG9uZSBjb25zdHJ1Y3RvciBpbnRvIGFub3RoZXIuXG4gKlxuICogVGhlIEZ1bmN0aW9uLnByb3RvdHlwZS5pbmhlcml0cyBmcm9tIGxhbmcuanMgcmV3cml0dGVuIGFzIGEgc3RhbmRhbG9uZVxuICogZnVuY3Rpb24gKG5vdCBvbiBGdW5jdGlvbi5wcm90b3R5cGUpLiBOT1RFOiBJZiB0aGlzIGZpbGUgaXMgdG8gYmUgbG9hZGVkXG4gKiBkdXJpbmcgYm9vdHN0cmFwcGluZyB0aGlzIGZ1bmN0aW9uIG5lZWRzIHRvIGJlIHJld3JpdHRlbiB1c2luZyBzb21lIG5hdGl2ZVxuICogZnVuY3Rpb25zIGFzIHByb3RvdHlwZSBzZXR1cCB1c2luZyBub3JtYWwgSmF2YVNjcmlwdCBkb2VzIG5vdCB3b3JrIGFzXG4gKiBleHBlY3RlZCBkdXJpbmcgYm9vdHN0cmFwcGluZyAoc2VlIG1pcnJvci5qcyBpbiByMTE0OTAzKS5cbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjdG9yIENvbnN0cnVjdG9yIGZ1bmN0aW9uIHdoaWNoIG5lZWRzIHRvIGluaGVyaXQgdGhlXG4gKiAgICAgcHJvdG90eXBlLlxuICogQHBhcmFtIHtmdW5jdGlvbn0gc3VwZXJDdG9yIENvbnN0cnVjdG9yIGZ1bmN0aW9uIHRvIGluaGVyaXQgcHJvdG90eXBlIGZyb20uXG4gKi9cbmV4cG9ydHMuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuXG5leHBvcnRzLl9leHRlbmQgPSBmdW5jdGlvbihvcmlnaW4sIGFkZCkge1xuICAvLyBEb24ndCBkbyBhbnl0aGluZyBpZiBhZGQgaXNuJ3QgYW4gb2JqZWN0XG4gIGlmICghYWRkIHx8ICFpc09iamVjdChhZGQpKSByZXR1cm4gb3JpZ2luO1xuXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoYWRkKTtcbiAgdmFyIGkgPSBrZXlzLmxlbmd0aDtcbiAgd2hpbGUgKGktLSkge1xuICAgIG9yaWdpbltrZXlzW2ldXSA9IGFkZFtrZXlzW2ldXTtcbiAgfVxuICByZXR1cm4gb3JpZ2luO1xufTtcblxuZnVuY3Rpb24gaGFzT3duUHJvcGVydHkob2JqLCBwcm9wKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKTtcbn1cblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCI5QXBmblBcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSJdfQ==
