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