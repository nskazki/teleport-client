'use strict';

var TeleportServer = require('../../TeleportServer');
var SocketsController = require('../../TeleportServer/libs/SocketsController');

var PeerController = require('../libs/PeerController');
var SocketController = require('../libs/SocketController');
var ObjectsController = require('../libs/ObjectsController');
var DependencyController = require('../libs/DependencyController');

var TeleportClient = require('..');

var events = require('events');
var assert = require('assert');
var util = require('util');

var port = 9000;
var url = 'ws://localhost:';

var debug = require('debug')('TeleportClient-test');

describe('SocketController', function() {
	var socketController, peersController;
	var socketsController;

	beforeEach(function(done) {
		debug('----beforeEach----');

		port++;

		socketController = new SocketController(url + port, 300);


		socketsController = new SocketsController(port);
		socketsController.on('socketsControllerReady', function() {
			debug('----beforeEach----');
			done();
		});

		peersController = new events.EventEmitter();
		socketsController.up(peersController);
	});

	afterEach(function(done) {
		debug('----afterEach----');

		peersController.removeAllListeners();

		socketsController
			.removeAllListeners()
			.on('socketsControllerDestroyed', function() {
				socketsController.removeAllListeners();
				debug('----afterEach----');
				done();
			})
			.on('socketsControllerAlreadyDestroyed', function() {
				socketsController.removeAllListeners();
				debug('----afterEach----');
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
	var authFuncClient = function(callback) {
		callback(null, 'some data');
	};
	var authFuncServer = function(authData, callback) {
		callback(null, authData === 'some data');
	};

	beforeEach(function(done) {
		debug('----beforeEach----');

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
			},
			authFunc: authFuncServer
		}).on('ready', function() {
			debug('----beforeEach----');
			done();
		});

		socketController = new SocketController(url + port, 300);
		peerController = new PeerController(authFuncClient);
		objectsController = new events.EventEmitter();

		socketController.up(peerController);
		peerController.down(socketController).up(objectsController);
	})

	afterEach(function(done) {
		debug('----afterEach----');

		objWithFuncAndEvents.removeAllListeners();

		teleportServer
			.removeAllListeners()
			.on('destroyed', function() {
				teleportServer.removeAllListeners();
				debug('----afterEach----');
				done();
			})
			.on('alreadyDestroyed', function() {
				teleportServer.removeAllListeners();
				debug('----afterEach----');
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
				},
				authFunc: authFuncServer
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
					resultArgs: [null, 'hello']
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
					resultArgs: [null, 'hello']
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
	var teleportServer, objWithFuncAndEvents;
	var peerController, socketController, objectsController;

	var authFuncClient = function(callback) {
		callback(null, 'some data');
	};
	var authFuncServer = function(authData, callback) {
		callback(null, authData === 'some data');
	};

	beforeEach(function(done) {
		debug('----beforeEach----');
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
			},
			authFunc: authFuncServer
		}).on('ready', function() {
			debug('----beforeEach----');
			done();
		});

		socketController = new SocketController(url + port, 300);
		peerController = new PeerController(authFuncClient);
		objectsController = new ObjectsController();

		socketController.up(peerController);
		peerController.down(socketController).up(objectsController);
		objectsController.down(peerController);
	});

	afterEach(function(done) {
		debug('----afterEach----');
		objWithFuncAndEvents.removeAllListeners();

		teleportServer
			.removeAllListeners()
			.on('destroyed', function() {
				teleportServer.removeAllListeners();
				debug('----afterEach----');
				done();
			})
			.on('alreadyDestroyed', function() {
				teleportServer.removeAllListeners();
				debug('----afterEach----');
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
					},
					authFunc: authFuncServer
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

describe('DependencyController', function() {
	var teleportServer, objWithFuncAndEvents;
	var peerController, socketController, objectsController, dependencyController;

	var authFuncClient = function(callback) {
		callback(null, 'some data');
	};
	var authFuncServer = function(authData, callback) {
		callback(null, authData === 'some data');
	};

	beforeEach(function(done) {
		debug('----beforeEach----');
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
			},
			authFunc: authFuncServer
		}).on('ready', function() {
			debug('----beforeEach----');
			done();
		});

		socketController = new SocketController(url + port, 300);
		peerController = new PeerController(authFuncClient);
		objectsController = new ObjectsController();
		dependencyController = new DependencyController();

		socketController.up(peerController);
		peerController.down(socketController).up(objectsController);
		objectsController.down(peerController);
		dependencyController.down(objectsController);
	});

	afterEach(function(done) {
		debug('----afterEach----');
		objWithFuncAndEvents.removeAllListeners();

		teleportServer
			.removeAllListeners()
			.on('destroyed', function() {
				teleportServer.removeAllListeners();
				debug('----afterEach----');
				done();
			})
			.on('alreadyDestroyed', function() {
				teleportServer.removeAllListeners();
				debug('----afterEach----');
				done();
			})
			.destroy();

		socketController.removeAllListeners().destroy();
		peerController.removeAllListeners().destroy();
		objectsController.removeAllListeners().destroy();
	});

	it('#get function', function(done) {
		dependencyController.get(function(blank) {
			blank.simpleFunc(null, done);
		})
	})

	it('#get array', function(done) {
		dependencyController.get(['blank',
			function(blank) {
				blank.simpleFunc(null, done)
			}
		])
	})

	it('#get after ~objectsControllerReady', function(done) {
		objectsController.on('objectsControllerReady', function() {
			dependencyController.get(function(blank) {
				blank.simpleFunc(null, done);
			});
		});
	});
})

describe('TeleportClient', function() {
	var teleportServer, teleportClient, objWithFuncAndEvents;
	var authFuncClient = function(callback) {
		callback(null, 'some data');
	};
	var authFuncServer = function(authData, callback) {
		callback(null, authData === 'some data');
	};

	beforeEach(function(done) {
		debug('----beforeEach----');

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
			},
			authFunc: authFuncServer
		}).on('ready', function() {
			debug('----beforeEach----');
			done();
		});

		teleportClient = new TeleportClient({
			serverAddress: url + port,
			autoReconnect: 300,
			authFunc: authFuncClient
		});
	});

	afterEach(function(done) {
		debug('----afterEach----');

		objWithFuncAndEvents.removeAllListeners();

		teleportServer
			.removeAllListeners()
			.on('destroyed', function() {
				teleportServer.removeAllListeners();
				debug('----afterEach----');
				done();
			})
			.on('alreadyDestroyed', function() {
				teleportServer.removeAllListeners();
				debug('----afterEach----');
				done();
			})
			.destroy();

		teleportClient.destroy();
	});

	it('first contact', function(done) {
		var count = [];

		teleportClient.on('ready', function() {
			count.push('ready');

			if (count.length === 2) done();
		});

		teleportServer.on('clientConnection', function(id) {
			assert.equal(id, 0);

			count.push('clientConnection');
		});
	})

	it('event', function(done) {
		teleportClient.on('ready', function() {
			objWithFuncAndEvents.emit('simpleEvent');
			teleportClient.objects.blank.on('simpleEvent', done);
		});
	});

	it('command', function(done) {
		teleportClient.on('ready', function() {
			teleportClient.objects.blank.simpleFunc(null, done);
		});
	})

	it('#ready, use objects from eventArgs', function(done) {
		teleportClient.on('ready', function(objectsProps, objects) {
			objects.blank.simpleFunc(null, done);
		})
	})

	it('#applyDependences', function(done) {
		teleportClient.applyDependences(function(blank) {
			blank.simpleFunc(null, done);
		});
	})

	it('#applyDependences func with dependences field', function(done) {
		var func = function(obj) {
			obj.simpleFunc(null, done);
		};
		func.dependences = ['blank'];

		teleportClient.applyDependences(func);
	})

	it('#applyDependences send and receive Eng chars', function(done) {
		teleportClient.applyDependences(function(blank) {
			blank.simpleFunc('Eng', function(err, result) {
				assert.equal(result, 'Eng');
				done(err, result);
			});
		});
	})

	it('#applyDependences send and receive Ru chars', function(done) {
		teleportClient.applyDependences(function(blank) {
			blank.simpleFunc('Привет', function(err, result) {
				assert.equal(result, 'Привет');
				done(err, result);
			});
		});
	})
});

//
util.inherits(ClassWithFuncAndEvents, events.EventEmitter);

function ClassWithFuncAndEvents() {}

ClassWithFuncAndEvents.prototype.simpleFunc = function(arg, callback) {
	callback(null, arg);
};