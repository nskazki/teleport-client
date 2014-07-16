﻿/**
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
				'util',
				'socketio'
			],
			CreateTeleportServer);
	} else if (isModule()) {
		/**
			Раз есть module.exports значит browserify сейчас подключает этот модуль
			Зависимости удовлетворит сам browserify. 

		*/

		var EventEmitter = require('events').EventEmitter;
		var util = require('util');
		var WebSocket = require('socket.io-client');

		module.exports = CreateTeleportServer(EventEmitter, util, WebSocket);
	} else {
		/**
			Иначе считаю, что TeleportClient подключен в "классический"
			проект, зависимости удовлетворены разработчиком проекта которому мой 
			класс понадобился, и добавляю сформированный класс в глобальное пространство имен.

		*/
		namespace.TeleportClient = CreateTeleportServer(namespace.EventEmitter, namespace.util, namespace.io);
	}

	function isModule() {
		try {
			return module && module.exports;
		} catch (ex) {
			return false;
		}
	}

	function CreateTeleportServer(EventEmitter, util, WebSocket) {
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
			this._valueWsClient = new WebSocket(this._optionWsServerAddress, {
				forceNew: true,
				reconnection: false
			});

			//onmessage
			this._valueWsClient.on('message', this._funcWsOnMessage.bind(this));

			//onopen
			this._valueWsClient.on('connect', function() {
				this.emit('info', {
					desc: "[TeleportClient] Info: соединение с сервером установленно"
				});

				this._funcInternalGetServerTimestamp(
					this._funcInternalHandlerGetTimestamp.bind(this));
			}.bind(this));

			//onerror
			this._valueWsClient.on('error', function(error) {
				this.emit("error", {
					desc: "[TeleportClient] Error: WebSocket Client выбросил ошибку: " + error,
					error: error
				});
			}.bind(this));

			//onclose
			var onDisconnect = function() {
				this.emit('warn', {
					desc: "[TeleportClient] Warn: Соединение с сервером потерянно."
				});

				if (this._optionAutoReconnect !== false) this._funcWsReconnect();
				else {
					this._funcWsClose();
					this.emit('close');
				}
			};

			this._valueWsClient.on('disconnect', onDisconnect.bind(this));
			this._valueWsClient.on('connect_error', onDisconnect.bind(this));
		};

		TeleportClient.prototype._funcWsOnMessage = function(sourceMessage) {
			var message = JSON.parse(sourceMessage);

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
			this._valueWsClient.removeAllListeners();
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
			if (this._valueWsClient && (this._valueWsClient.connected)) {
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

				if (this._valueWsClient && (this._valueWsClient.connected)) {
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
}(eval.valueOf()('this')));