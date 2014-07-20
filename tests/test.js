var TeleportServer = require('../../TeleportServer');
var SocketsController = require('../../TeleportServer/libs/SocketsController');

var PeerController = require('../libs/PeerController');
var SocketController = require('../libs/SocketController');
var ObjectsController = require('../libs/ObjectsController');
var TeleportClient = require('..');

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
		socketsController.on('socketsControllerReady', done);

		peersController = new events.EventEmitter();
		socketsController.up(peersController);
	});

	afterEach(function(done) {
		peersController.removeAllListeners();

		socketsController
			.removeAllListeners()
			.on('socketsControllerDestroyed', function() {
				socketsController.removeAllListeners();
				done();
			})
			.on('socketsControllerAlreadyDestroyed', function() {
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

	it('!socketReconnecting', function(done) {
		socketController.on('socketConnect', function() {
			socketsController.destroy();
		})
		socketController.on('socketReconnecting', function() {
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

		socketsController.on('socketsControllerDestroyed', function() {
			socketsController = new SocketsController(port);
		});

		socketController.on('socketReconnect', function() {
			done()
		})
	});
});

describe('PeerController', function() {
	var teleportServer, objWithFuncAndEvents;
	var peerController, socketController, objectsController;

	beforeEach(function(done) {
		port++;

		objWithFuncAndEvents = new ClassWithFuncAndEvents();

		teleportServer = new TeleportServer({
			port: port,
			peerDisconnectedTimeout: 2000,
			objects: {
				'blank': {
					object: objWithFuncAndEvents,
					methods: ['simpleFunc'],
					events: ['simpleEvent']
				}
			}
		}).on('ready', done);

		socketController = new SocketController(url + port, 300);
		peerController = new PeerController();
		objectsController = new events.EventEmitter();

		socketController.up(peerController);
		peerController.down(socketController).up(objectsController);
	})

	afterEach(function(done) {
		objWithFuncAndEvents.removeAllListeners();

		teleportServer
			.removeAllListeners()
			.on('destroyed', function() {
				teleportServer.removeAllListeners();
				done();
			})
			.on('alreadyDestroyed', function() {
				teleportServer.removeAllListeners();
				done();
			})
			.destroy();

		socketController.removeAllListeners().destroy();
		peerController.removeAllListeners().destroy();
		objectsController.removeAllListeners();
	});

	it('!peerConnect && !objectsProps', function(done) {
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
		peerController.on('peerConnect', function() {
			teleportServer.destroy();
		});

		peerController.on('peerReconnecting', function() {
			done();
		})
	});

	it('!peerReconnectWithNewId', function(done) {
		peerController.on('peerConnect', function() {
			teleportServer.destroy();
		});

		teleportServer.on('destroyed', function() {
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

	it('!peerReconnect', function(done) {
		peerController
			.on('peerConnect', function() {
				socketController.destroy();
			})
			.on('peerReconnect', done);

		socketController.on('socketControllerDestroyed', function() {
			peerController._state = 'disconnect';

			socketController = new SocketController(url + port, 300);
			socketController.up(peerController);
			peerController.down(socketController);
		})
	})

	it('~needPeerSend', function(done) {
		peerController
			.on('peerConnect', function() {
				objectsController.emit('needPeerSend', {
					type: 'command',
					objectName: 'blank',
					methodName: 'simpleFunc',
					args: ['hello'],
					requestId: 0
				});
			})
			.on('peerMessage', function(message) {
				assert.deepEqual(message, {
					objectName: "blank",
					type: "callback",
					methodName: "simpleFunc",
					requestId: 0,
					error: null,
					result: "hello"
				});

				done();
			})
	})

	it('~needPeerSend during reconnecting', function(done) {
		peerController
			.on('peerConnect', function() {
				socketController.destroy();
			})
			.on('peerReconnecting', function() {
				objectsController.emit('needPeerSend', {
					type: 'command',
					objectName: 'blank',
					methodName: 'simpleFunc',
					args: ['hello'],
					requestId: 0
				});
			})
			.on('peerMessage', function(message) {
				assert.deepEqual(message, {
					objectName: "blank",
					type: "callback",
					methodName: "simpleFunc",
					requestId: 0,
					error: null,
					result: "hello"
				});

				done();
			})

		socketController.on('socketControllerDestroyed', function() {
			peerController._state = 'disconnect';
			peerController.emit('peerReconnecting');

			socketController = new SocketController(url + port, 300);
			socketController.up(peerController);
			peerController.down(socketController);
		})
	})
});

describe('objectsController', function() {
	beforeEach(function(done) {
		port++;

		objWithFuncAndEvents = new ClassWithFuncAndEvents();

		teleportServer = new TeleportServer({
			port: port,
			peerDisconnectedTimeout: 2000,
			objects: {
				'blank': {
					object: objWithFuncAndEvents,
					methods: ['simpleFunc'],
					events: ['simpleEvent']
				}
			}
		}).on('ready', done);

		socketController = new SocketController(url + port, 300);
		peerController = new PeerController();
		objectsController = new ObjectsController();

		socketController.up(peerController);
		peerController.down(socketController).up(objectsController);
		objectsController.down(peerController);
	});

	afterEach(function(done) {
		objWithFuncAndEvents.removeAllListeners();

		teleportServer
			.removeAllListeners()
			.on('destroyed', function() {
				teleportServer.removeAllListeners();
				done();
			})
			.on('alreadyDestroyed', function() {
				teleportServer.removeAllListeners();
				done();
			})
			.destroy();

		socketController.removeAllListeners().destroy();
		peerController.removeAllListeners().destroy();
		objectsController.removeAllListeners().destroy();
	});

	it('!objectsControllerReady', function(done) {
		objectsController.on('objectsControllerReady', function(objectsProps) {
			assert.deepEqual({
				blank: {
					methods: ['simpleFunc'],
					events: ['simpleEvent']
				}
			}, objectsProps);

			done();
		});
	})

	it('call method', function(done) {
		objectsController.on('objectsControllerReady', function() {
			objectsController._objects.blank.simpleFunc('test', function(error, result) {
				assert.equal(result, 'test');
				done();
			})
		});
	})

	it('intercepr event', function(done) {
		objectsController.on('objectsControllerReady', function() {
			objWithFuncAndEvents.emit('simpleEvent', ':3', 'first arg a citty :)');

			objectsController._objects.blank.on('simpleEvent', function(first, second) {
				assert.equal(':3', first);
				assert.equal('first arg a citty :)', second);

				done();
			});
		});
	});

	it('~peerReconnectWithNewId', function(done) {
		objectsController.on('objectsControllerReady', function() {
			objWithFuncAndEvents.simpleFunc = function() {};

			objectsController._objects.blank.simpleFunc('test', function(error, result) {
				if (error) done();
			})

			teleportServer.destroy();
			teleportServer.on('destroyed', function() {
				teleportServer = new TeleportServer({
					port: port,
					peerDisconnectedTimeout: 2000,
					objects: {
						'blank': {
							object: objWithFuncAndEvents,
							methods: ['simpleFunc'],
							events: ['simpleEvent']
						}
					}
				}).on('ready', done);
			});
		});
	})

	it('call command while ~peerReconnecting', function(done) {
		objectsController.on('objectsControllerReady', function() {
			socketController.emit('socketReconnecting')
		});

		peerController.on('peerReconnecting', function() {
			socketController
				.removeAllListeners()
				.on('socketControllerDestroyed', function() {
					objectsController._objects.blank.simpleFunc('test', function(error, result) {
						assert.equal(result, 'test');
						done();
					});

					socketController = new SocketController(url + port, 300);
					socketController.up(peerController);
					peerController.down(socketController);
				})
				.destroy();
		})
	})
})

describe('TeleportClient', function() {
	var teleportServer, teleportClient, objWithFuncAndEvents;

	beforeEach(function(done) {
		port++;

		objWithFuncAndEvents = new ClassWithFuncAndEvents();

		teleportServer = new TeleportServer({
			port: port,
			peerDisconnectedTimeout: 2000,
			objects: {
				'blank': {
					object: objWithFuncAndEvents,
					methods: ['simpleFunc'],
					events: ['simpleEvent']
				}
			}
		}).on('ready', done);

		teleportClient = new TeleportClient({
			serverAddress: url + port,
			autoReconnect: 300
		});
	});

	afterEach(function(done) {
		objWithFuncAndEvents.removeAllListeners();

		teleportServer
			.removeAllListeners()
			.on('destroyed', function() {
				teleportServer.removeAllListeners();
				done();
			})
			.on('alreadyDestroyed', function() {
				teleportServer.removeAllListeners();
				done();
			})
			.destroy();

		teleportClient.destroy();
	});

	it('first contact', function(done) {
		var count = [];

		teleportClient.on('peerConnect', function() {
			count.push('peerConnect');

			if (count.length === 2) done();
		});

		teleportServer.on('peerConnection', function(id) {
			assert.equal(id, 0);

			count.push('peerConnection');
		});
	})

	it('event', function(done) {
		teleportClient.on('peerConnect', function() {
			objWithFuncAndEvents.emit('simpleEvent');
			teleportClient.objects.blank.on('simpleEvent', done);
		});
	});

	it('command', function(done) {
		teleportClient.on('peerConnect', function() {
			teleportClient.objects.blank.simpleFunc(null, done);
		});
	})
});

//
util.inherits(ClassWithFuncAndEvents, events.EventEmitter);

function ClassWithFuncAndEvents() {}

ClassWithFuncAndEvents.prototype.simpleFunc = function(arg, callback) {
	callback(null, arg);
};