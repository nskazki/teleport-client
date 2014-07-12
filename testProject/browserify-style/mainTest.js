"use strict";

var window = eval.valueOf()('this');

var TeleportClient = require('../../');
var util = require('util');

window.teleportClient = new TeleportClient({
	serverAddress: "ws://localhost:8000",
	autoReconnect: 3000
})
	.on('debug', console.log.bind(console))
	.on('info', console.log.bind(console))
	.on('warn', console.log.bind(console))
	.on('error', console.log.bind(console))
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
		console.log({
			objectName: objectName,
			eventName: eventName,
			arguments: arguments,
		});
	}
}

function CreateCallbackLogger(objectName, methodName) {
	return function(error, result) {
		console.log({
			objectName: objectName,
			methodName: methodName,
			error: error,
			result: result
		});
	}
}