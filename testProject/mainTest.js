"use strict";

requirejs.config({
	baseUrl: 'bower_components/',
	paths: {
		TeleportClient: '../../TeleportClient', // teleport-client/TeleportClient
		util: 'my-helpers/util',
		EventEmitter: 'my-helpers/EventEmitter'
	}
});


requirejs(['TeleportClient', 'util'], function(TeleportClient, util) {
	//for Debuging
	window.teleportClient = new TeleportClient({
		serverAddress: "ws://nskazki.dyndns.info:8000",
		//serverAddress: "ws://localhost:8000",
		isDebug: false
	});

	(function initTeleportClient() {

		teleportClient
			.on('debug', console.debug.bind(console))
			.on('info', console.info.bind(console))
			.on('warn', console.warn.bind(console))
			.on('error', console.error.bind(console))
			.on('close', function() {
				console.warn({
					desc: "[main] Warn: Соединение с TeleportServer закрылось, будет выполненно переподключение.",
					serverAddress: "ws://nskazki.dyndns.info:8000"
				});

				initTeleportClient();
			})
			.on(
				'ready',
				CreateEventLogger('teleportClient', 'ready'))
			.on(
				'ready',
				function(objectsProps) {
					//for Debuging
					window.simpleObject = teleportClient.objects.simpleObject;;

					var params = {
						simple: 'object',
						with: 'some',
						param: ', wow!'
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
							CreateEventLogger('simpleObject', 'eventWithUnlimArgs'))
						.on(
							'10secIntervalEvent',
							CreateEventLogger('simpleObject', '10secIntervalEvent'));

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
							CreateCallbackLogger('simpleObject', 'simpleFuncWithoutArgs'))
						.simpleFuncWith10SecDelay(
							CreateCallbackLogger('simpleObject', 'simpleFuncWith10SecDelay'));

					/*funcs without callback*/
					simpleObject
						.simpleFunc(params)
						.simpleFuncWithUnlimArgs(false, '1', 2, 3)
						.simpleFuncWithoutArgs()
						.simpleFuncWith10SecDelay();
				}).init();
	})();

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