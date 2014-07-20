"use strict";

window.teleportClient = new TeleportClient({
	serverAddress: "ws://localhost:8000",
	autoReconnect: 3000
}).on('ready', function(objectsProps) {
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

});


function CreateEventLogger(objectName, eventName) {
	return function() {
		var obj = {
			desc: "[" + objectName + ".event] Info: получено событие " + eventName,
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
			desc: "[" + objectName + ".callback] Info: вернулся результат вызова метода " + methodName,
			result: result,
			error: error
		};


		var details = document.createElement('details');
		details.innerHTML = "<summary>" + obj.desc + "</summary>" + "<pre>" + JSON.stringify(obj, ' ', 4) + "</pre";

		var welcom = document.getElementById('welcom');
		welcom.parentNode.insertBefore(details, welcom);
	}
}