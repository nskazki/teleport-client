"use strict"

requirejs.config({
	baseUrl: 'bower_components/',
	paths: {
		TeleportClient: 'teleport-client/TeleportClient',
		util: 'my-helpers/util',
		EventEmitter: 'my-helpers/EventEmitter'
	}
});


requirejs(['TeleportClient', 'util'], function(TeleportClient, util) {
	var teleportClient = new TeleportClient({
		serverAddress: "ws://localhost:8000",
		isDebug: false
	})
		.on('info', logger)
		.on('debug', logger)
		.on('error', logger)
		.init();

	teleportClient
		.on(
			'ready',
			CreateEventLogger('teleportClient', 'ready'))
		.on(
			'ready',
			function(objectsProps) {
				var simpleObject = teleportClient.objects.simpleObject;

				var params = {
					simple: 'object',
					with: 'some',
					param: 'wow!'
				};

				simpleObject
					.on(
						'myOptions',
						CreateEventLogger('simpleObject', 'myOptions'))
					.on(
						'emptyEvent',
						CreateEventLogger('simpleObject', 'emptyEvent'))
					.simpleAsyncFunc(
						params,
						CreateCallbackLogger('simpleObject', 'simpleAsyncFunc'));
			});


	function CreateEventLogger(objectName, eventName) {
		return function(param) {
			logger({
				desc: util.format("[%s.event] Info: получено событие с сервера %s", objectName, eventName),
				param: param
			});
		}
	}

	function CreateCallbackLogger(objectName, methodName) {
		return function(error, result) {
			logger({
				desc: util.format("[%s.callback] Info: вернулся результат вызова метода %s", objectName, methodName),
				result: result,
				error: error
			})
		}
	}

	function logger(log) {
		console.log(log);
	}
});