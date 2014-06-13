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

"use strict";

(function(namespace) {

	if (namespace.define) {
		/**
			Раз есть define значит подключен requirejs.
			Зависимости будет переданны в CreateTeleportServer, 
			который вернет сформированный класс TeleportClient

		*/
		define(
			[
				'EventEmitter',
				'util'
			],
			CreateTeleportServer);
	} else {
		/**
			Иначе считаю, что TeleportClient подключен в "классический"
			проект, зависимости удовлетворены разработчиком проекта которому мой 
			класс понадобился, и добавляю сформированный класс в глобальное пространство имен.

		*/
		namespace.TeleportClient = CreateTeleportServer(EventEmitter, util);
	}

	function CreateTeleportServer(EventEmitter, util) {
		util.inherits(TeleportClient, EventEmitter);

		/**
			Конструктор класса TeleportClient, 
			
			формат принимаего аргумента:
			options = {
				serverAddress: "ws://localhost:8000",
				isDebug: true
			}

			формат инициалируемых полей:
			this._valueRequests = [
				1: someCallback,
				2: secondCallback
			]

			this.objects = {
				'someServerObjectName': {
					__events__ = ['firstPermitedEventName', 'secondPermitedEventName'],
					__methods__ = ['firstMethodName', 'secondMethodName'],
					firstMethodName: function() {...},
					secondMethodName: function() {...},
				}
			}

		*/
		function TeleportClient(options) {
			//options
			this._optionWsServerAddress = options.serverAddress;
			this._optionIsDebug = options.isDebug;

			//end options

			//private
			this._valueWsClient = null;
			this._valueRequests = [];
			this._valueServerObjectsProps = null;
			this._valueIsInit = false;

			//end private

			//public
			this.objects = {};

			//end public
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
			if (this._optionIsDebug) this.emit('debug', {
				desc: "[TeleportClient] Debug: отправил запрос на получение методов"
			})

			this._funcWsSendMessage({
				type: "internalCommand",
				internalCommand: "getObjects",
			});
		};

		/**
			хэндлер для ответов на сервисные запросы к серверу

			если поступил ответ на команду getObjects, то полученные свойства серверные объектов обрабатываются,
			создаются клиентские прокси объекты, для их методов создаются прокси методы.
			класс клиентских объектов наследует класс EventEmitter. для того чтобы пробрасывать серверные события. 
			после обработки всех объектов на сервер будет переденанно собщение objectСreationСompleted.	


			формат принимаего аргумента
			message = {
				type: 'internalCallback'
				internalCommand: 'getObjects',
				error: null,
				result: {
					someObjectName: {
						methods: ['firstMethod'],
						events: ['firstEventName']
					}
				}
			}	

		*/
		TeleportClient.prototype._funcInternalCallbackHandler = function(message) {
			if (message.internalCommand == "getObjects") {
				if (message.error) {
					var errorInfo = {
						desc: "[TeleportClient] Error: запрос на получение свойств серверных объектов, вернул ошибку.",
						message: message
					};

					this.emit("error", errorInfo);
				} else {
					this.emit('info', {
						desc: "[TeleportClient] Info: свойства серверных объектов полученны.",
						message: message
					});

					this._valueServerObjectsProps = message.result;

					for (var objectName in this._valueServerObjectsProps) {
						this._funcObjectCreate(objectName);
					}

					this.emit('ready', this._valueServerObjectsProps);

					this._funcWsSendMessage({
						type: "internalCommand",
						internalCommand: "objectСreationСompleted",
					})
				}
			} else {
				var errorInfo = {
					desc: "[TeleportClient] Error: пришел ответ на неожиданную команду: " + message.internalCommand,
					message: message
				};

				this.emit("warn", errorInfo);
			}
		};



		//server
		TeleportClient.prototype._funcWsOnOpen = function() {
			this.emit('info', {
				desc: "[TeleportClient] Info: соединение с сервером установленно"
			});

			this._funcWsSessionInit();
		}

		/**
			Хендлер для всех типов сообщений принмаемых от сервера, вызвается непосредственно
			ws клиентом.
			
			обязательным полем для принятого аргумента является type
			message = {
				type: 'someType',
				...
			}
			
		*/
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

				this.emit("warn", errorInfo);
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

				this.emit("warn", errorInfo);
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

				if (this._optionIsDebug) this.emit('debug', {
					desc: "[TeleportClient] Debug: вызвын метод серверного объекта: " + objectName + "." + methodName,
					args: args,
					requestId: requestId
				});

				this._funcWsSendMessage({
					objectName: objectName,
					type: "command",
					command: methodName,
					requestId: requestId,
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
			if (this._optionIsDebug) this.emit('debug', {
				desc: "[TeleportClient] Debug: сервер вернул callback на: " + message.objectName + "." + message.command,
				message: message
			});

			this._valueRequests[message.requestId](message.error, message.result);
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
			if (this._optionIsDebug) this.emit('debug', {
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