"use strict"

requirejs.config({
	baseUrl: 'bower_components/',
	paths: {
		TeleportClient: '../../TeleportClient', // teleport-client/TeleportClient
		util: 'my-helpers/util',
		EventEmitter: 'my-helpers/EventEmitter'
	}
});


requirejs(['TeleportClient', 'util'], function(TeleportClient, util) {
	var teleportClient = new TeleportClient({
		serverAddress: "ws://nskazki.dyndns.info:8000",
		isDebug: false
	})
		.on('debug', console.log.bind(console))
		.on('info', console.log.bind(console))
		.on('warn', console.log.bind(console))
		.on('error', console.log.bind(console))
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

				/*event*/
				simpleObject
					.on(
						'eventWithMyOptions',
						CreateEventLogger('simpleObject', 'eventWithMyOptions'))
					.on(
						'eventWithoutArgs',
						CreateEventLogger('simpleObject', 'eventWithoutArgs'))
					.on(
						'eventWithUnlimArgs',
						CreateEventLogger('simpleObject', 'eventWithUnlimArgs'));

				/*funcs with callback*/
				simpleObject
					.simpleFunc(
						params,
						CreateCallbackLogger('simpleObject', 'simpleFunc'))
					.simpleFuncWithUnlimArgs(
						false, '1', 2, {
							3: new Date()
						},
						CreateCallbackLogger('simpleObject', 'simpleFuncWithUnlimArgs'))
					.simpleFuncWithoutArgs(
						CreateCallbackLogger('simpleObject', 'simpleFuncWithoutArgs'));

				/*funcs without callback*/
				simpleObject
					.simpleFunc(params)
					.simpleFuncWithUnlimArgs(false, '1', 2, 3)
					.simpleFuncWithoutArgs();
			});


	function CreateEventLogger(objectName, eventName) {
		return function() {
			console.log({
				desc: util.format("[%s.event] Info: получено событие с сервера %s", objectName, eventName),
				arguments: arguments
			});
		}
	}

	function CreateCallbackLogger(objectName, methodName) {
		return function(error, result) {
			console.log({
				desc: util.format("[%s.callback] Info: вернулся результат вызова метода %s", objectName, methodName),
				result: result,
				error: error
			})
		}
	}
});