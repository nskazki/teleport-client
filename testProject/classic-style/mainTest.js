"use strict";

window.teleportClient = new TeleportClient({
	serverAddress: "ws://localhost:7000",
	autoReconnect: 3000,
	authFunc: function(callback) {
		callback(null, 'example project');
	}
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

teleportClient
	.on('ready', CreateConsoleEventLogger('ready'))
	.on('reconnect', CreateConsoleEventLogger('reconnect'))
	.on('reconnectOnOldTerms', CreateConsoleEventLogger('reconnectOnOldTerms'))
	.on('reconnectAndReinit', CreateConsoleEventLogger('reconnectAndReinit'))
	.on('reconnecting', CreateConsoleEventLogger('reconnecting'))
	.on('error', CreateConsoleEventLogger('error'))
	.on('destroyed', CreateConsoleEventLogger('destroyed'))
	.on('alreadyDestroyed', CreateConsoleEventLogger('alreadyDestroyed'))

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

//helpers

function CreateConsoleEventLogger(eventName) {
	return function() {
		console.log('eventName: %s, arguments: %s', eventName, Array.prototype.slice(arguments).join());
	};
}