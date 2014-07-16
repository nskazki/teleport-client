var TeleportServer = require('../../TeleportServer');
var SocketsController = require('../../TeleportServer/libs/SocketsController');

var PeerController = require('../libs/PeerController');
var SocketController = require('../libs/SocketController');
var TeleportClient = require('..');

var WebSocketServer = require('socket.io');

var events = require('events');
var assert = require('assert');

var port = 9000;
var url = 'ws://localhost:';

describe('SocketController', function() {
	beforeEach(function() {
		port++;
	});

	it('#new', function(done) {
		var socketController = new SocketController(url + port, 300);
		socketController.destroy();
		done();
	})

	it('!socketConnect', function(done) {
		var server = new WebSocketServer(port);
		var socketController = new SocketController(url + port, 300);

		socketController.on('socketConnect', function() {
			socketController.destroy();
			done();
		});
	});

	it('!socketDisconnect', function(done) {
		var server = new SocketsController(port);
		var socketController = new SocketController(url + port, 300);

		socketController.on('socketConnect', function() {
			server.destroy();
		})
		socketController.on('socketDisconnect', function() {
			socketController.destroy();
			done();
		});
	});

	it('!socketMessage', function(done) {
		var server = new SocketsController(port);
		var socketController = new SocketController(url + port, 300);
		var peersController = new events.EventEmitter();
		server.up(peersController);

		server.on('socketConnection', function(id) {
			peersController.emit('needSocketSend', id, 'hello');
		});

		socketController.on('socketMessage', function(message) {
			assert.equal('hello', message);

			socketController.destroy();
			server.destroy();

			done();
		})
	});

	it('!socketReconnect', function(done) {
		var server = new SocketsController(port);
		var socketController = new SocketController(url + port, 300);

		socketController.on('socketConnect', function() {
			server.destroy();
		});

		server.on('serverDestroyed', function() {
			server = new SocketsController(port);
		});

		socketController.on('socketReconnect', function() {
			server.destroy();
			socketController.destroy();

			done()
		})
	});
});

describe('TeleportClient', function() {



	it('#new', function() {
		var teleportClient = new TeleportClient({
			serverAddress: 'ws://localhost:' + port,
			autoReconnect: 500
		});
	});


})