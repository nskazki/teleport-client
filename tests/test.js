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
	var socketController, peersController;
	var socketsController;

	beforeEach(function(done) {
		port++;

		socketController = new SocketController(url + port, 300);


		socketsController = new SocketsController(port);
		socketsController.on('serverReady', done);

		peersController = new events.EventEmitter();
		socketsController.up(peersController);
	});

	afterEach(function(done) {
		peersController.removeAllListeners();

		socketsController
			.removeAllListeners()
			.on('serverDestroyed', function() {
				socketsController.removeAllListeners();
				done();
			})
			.on('alreadyServerDestroyed', function() {
				socketsController.removeAllListeners();
				done();
			})
			.destroy();

		socketController.removeAllListeners().destroy();
	})

	it('!socketConnect', function(done) {
		socketController.on('socketConnect', function() {
			socketController.destroy();
			done();
		});
	});

	it('!socketDisconnect', function(done) {
		socketController.on('socketConnect', function() {
			socketsController.destroy();
		})
		socketController.on('socketDisconnect', function() {
			done();
		});
	});

	it('!socketMessage', function(done) {
		socketsController.on('socketConnection', function(id) {
			peersController.emit('needSocketSend', id, 'hello');
		});

		socketController.on('socketMessage', function(message) {
			assert.equal('hello', message);

			done();
		})
	});

	it('!socketReconnect', function(done) {
		socketController.on('socketConnect', function() {
			socketsController.destroy();
		});

		socketsController.on('serverDestroyed', function() {
			socketsController = new SocketsController(port);
		});

		socketController.on('socketReconnect', function() {
			done()
		})
	});
});

describe('PeerController', function() {
	var teleportServer, objWithFuncAndEvents;

	beforeEach(function(done) {
		port++;

		objWithFuncAndEvents = new ClassWithFuncAndEvents();

		teleportServer = new TeleportServer({
			port: port,
			peerDisconnectedTimeout: 500,
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

		objWithFuncAndEvents.removeAllListeners();

		teleportServer
			.removeAllListeners()
			.on('serverDestroyed', function() {
				teleportServer.removeAllListeners();
				done();
			})
			.on('alreadyServerDestroyed', function() {
				teleportServer.removeAllListeners();
				done();
			})
			.destroy();
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
			teleportServer.destroy();
		});

		peerController.on('peerReconnecting', function() {
			done();
		})
	});

	it('!peerReconnectWithNewId', function(done) {
		var socketController = new SocketController(url + port, 300);
		var peerController = new PeerController();

		socketController.up(peerController);
		peerController.down(socketController);

		peerController.on('peerConnect', function() {
			teleportServer.destroy();
		});

		teleportServer.on('serverDestroyed', function() {
			teleportServer = new TeleportServer({
				port: port,
				peerDisconnectedTimeout: 500,
				objects: {
					'blank': {
						object: objWithFuncAndEvents,
						methods: ['simpleFunc'],
						events: ['simpleEvent']
					}
				}
			});
		})

		peerController.on('peerReconnectWithNewId', done);
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