"use strict";

var TeleportClient = require('../../');
var util = require('util');

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
	.on('ready', CreateEventLogger('teleportClient', 'ready'))
	.on('reconnect', CreateEventLogger('teleportClient', 'reconnect'))
	.on('reconnectOnOldTerms', CreateEventLogger('teleportClient', 'reconnectOnOldTerms'))
	.on('reconnectAndReinit', CreateEventLogger('teleportClient', 'reconnectAndReinit'))
	.on('reconnecting', CreateEventLogger('teleportClient', 'reconnecting'))
	.on('error', CreateEventLogger('teleportClient', 'error'))
	.on('destroyed', CreateEventLogger('teleportClient', 'destroyed'))
	.on('alreadyDestroyed', CreateEventLogger('teleportClient', 'alreadyDestroyed'))

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