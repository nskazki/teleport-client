var TeleportServer = require('../../TeleportServer');
var SocketsController = require('../../TeleportServer/libs/SocketsController');

var PeerController = require('../libs/PeerController');
var SocketController = require('../libs/SocketController');
var TeleportClient = require('..');

var WebSocketServer = require('socket.io');

var events = require('events');
var assert = require('assert');
var util = require('util');

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

	it('#up', function(done) {
		var server = new SocketsController(port);
		var socketController = new SocketController(url + port, 300);
		var eventEmitter = new events.EventEmitter();
		socketController.up(eventEmitter);

		eventEmitter.emit('needSocketSend', 'hello');

		server.on('socketMessage', function(id, message) {
			assert.equal(message, 'hello');
			done();
		});
	});
});

describe('PeerController', function() {
	var teleportServer, objWithFuncAndEvents;

	beforeEach(function(done) {
		port++;

		objWithFuncAndEvents = new ClassWithFuncAndEvents();

		teleportServer = new TeleportServer({
			port: port,
			peerDisconnectedTimeout: 50,
			objects: {
				'blank': {
					object: objWithFuncAndEvents,
					methods: ['simpleFunc'],
					events: ['simpleEvent']
				}
			}
		}).on('serverReady', done);
	})

	afterEach(function(done) {
		teleportServer.destroy();
		teleportServer.on('serverDestroyed', done);
	});

	it('#new', function(done) {
		var peerController = new PeerController();
		done();
	})

	it('!peerConnect && !objectsProps', function(done) {
		var socketController = new SocketController(url + port, 300);
		var peerController = new PeerController();

		socketController.up(peerController);
		peerController.down(socketController);

		var count = [];
		peerController.on('peerConnect', function() {
			count.push('peerConnect');

			if (count.length === 2) done();
		});

		peerController.on('objectsProps', function(objectsProps) {
			assert.deepEqual(objectsProps, {
				"blank": {
					"methods": ["simpleFunc"],
					"events": ["simpleEvent"]
				}
			});

			count.push('objectsProps');
		})
	})

	it('!peerReconnecting', function(done) {
		var socketController = new SocketController(url + port, 300);
		var peerController = new PeerController();

		socketController.up(peerController);
		peerController.down(socketController);

		peerController.on('peerConnect', function() {
			//teleportServer.destroy();
		});

		
	})

});

describe('TeleportClient', function() {



	it('#new', function() {
		var teleportClient = new TeleportClient({
			serverAddress: 'ws://localhost:' + port,
			autoReconnect: 500
		});
	});


})

//
util.inherits(ClassWithFuncAndEvents, events.EventEmitter);

function ClassWithFuncAndEvents() {}

ClassWithFuncAndEvents.prototype.simpleFunc = function(arg, callback) {
	callback(null, arg);
};