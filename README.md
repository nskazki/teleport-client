TeleportClient
==============

[TeleportServer](https://github.com/MyNodeComponents/TeleportServer)

```
npm install teleport-client --save
```

```
bower install teleport-client --save
```

<h5>Это RPC клиент, умеет:</h5>
 * Подлючаться и авторизовываться на сервере.
 * Получать от сервера список телепортируемых объектов, имена их методов и событий.
 * Генерировать на основе полученного списка соответствующие объекты и методы.
 * Выбрасывать события серверных объектов из сгенирированных.
 * Работает в браузере и под управлением node.js

<h5>Ограничения:</h5>
 * Работает только с объектами.
 * Работает только с асинхронными методоми телепортируемых объектов, принимающими неограниченное количество аргументов и callback.
 * Выбрасываемые телепортированными объектами события могут содержать неограниченное количество аргументов.
 * Все аргументы передоваемые на сервер и результаты возвращаемые на клиента проходят через JSON.stringify -> JSON.parse.
 * Авторизация обязательно, я серьезно передавайте в качестве авторизационных данных хотя бы имя проекта, 
 	<br>не стреляйте себе в ногу лишний раз.
 * Указывать интервалы попыток переподключения обязательно.

<h5>Кил фича:</h5>
Если соединение с сервером кратковременно оборвется, то:
 * Клиент получит все выброшенные телепортированными объектами события за время отсутствия соединения.
 * Если клиентом был вызван некоторый метод до обрыва соединения, 
 	<br>то после переподключения он получит результат этого вызова.
 * Если клиент вызовет метод телепортированного объекта во время отсутствия соединения, 
 	<br>то он будет вызван когда соединение восстановится.

<h5>Подключение:</h5>

 * browserify, node.js:
```js
var TeleportClient = require('teleport-client');

var teleportClient = new TeleportClient({
	serverAddress: "ws://localhost:8000",
	autoReconnect: 3000,
	authFunc: function(callback) {
		callback(null, 'example project');
	}
});
```

 * classic style:
```html
	...
	<script type="text/javascript" src="https://rawgit.com/nskazki/web-TeleportClient/master/dist/TeleportClient.js"></script>
</head>
<body>
	<script type="text/javascript">
		var teleportClient = new TeleportClient({
			serverAddress: "ws://localhost:8000",
			autoReconnect: 3000,
			authFunc: function(callback) {
				callback(null, 'example project');
			}
		});
	</script>
	...
```

<h5>Example:</h5>
```js
var teleportClient = new TeleportClient({
	serverAddress: "ws://localhost:8000",
	autoReconnect: 3000,
	authFunc: function(callback) {
		callback(null, 'example project');
	}
})
	.on('ready', function(objectsProps, objects) {
			console.log(objectsProps);

			objects.ipBox
				.getIps(someCallback)
				.on('newIps', someHandler);
	});

teleportClient.applyDependences(function(logBox) {
	logBox.getLogs(someCallback);
})

teleportClient.applyDependences(['blackBox', function(box) {
	box.getColor(someCallback);
}]);

...
someObj.someFunc.dependences = ['ipBox'];

teleportClient.applyDependences(someObj.someFunc, someObj);

```

<h5>Параметры принимаемые конструктором:</h5>
 * `serverAddress` - адрес и порт TeleportServer.
 * `autoReconnect` - время задержки в миллисекундах перед переподключением к серверу, после разрыва соединения.
 * `authFunc` - функция генерирующая авторизационные данные для подключения к серверу, будет вызвана только один раз.

<h5>Публичные методы:</h5>
 * `destroy` - метод прекращающий работу объекта.
 * `applyDependences` - метод разрешающий зависимости переданной в него функции. Просто взял у angularjs.
 <br>Принимает на вход :
    * функцию или массив содержищий имена зависимостей и функцию.
    * опцианально вторым аргументом принимает контекст с которым будет вызванна функция. 

<h5>Events:</h5>
Эти события отражают текущее состояние TeleportClient.
<br>Выбрасываются без аргументов, если не указанно иное.

 * `ready` - признак успешного соединения с сервром и регистрации всех телепортируемых объектов.
 	<br>Выбрасывается с одним аргументом, содержащим свойства телепортированных объектов.
 * `destroyed` - признак успешного разрушения объекта вызовом метода `destroy`, 
 	<br>содинение с сервером разорванно, все каллбеки ожидающие результат вызваны с ошибкой.
 * `alreadyDestroyed` - будут выброшено если ранее метод `destroy` уже выполнялся.
 * `error` - ошибки ядра (socket.io-client). В качестве аргумента подписчики получат ошибку.
 <br><br>
 * `reconnecting` - признак разрыва соединения, через время указанное в поле `autoReconnect` будет предпринята попытка переподключения.
 * `reconnect` - признак успешного переподключения к серверу.
 * `reconnectOnOldTerms` - соединение востановленно, сервер не перезапущен, время ожидания переподключения сервером не истекло.
 	<br>Выбрасывается вместе с `reconnected`. 
 * `reconnectAndReinit` - признак успешного переподключения к перезапущенному.
 	<br>Или если истекло время ожидания сервером переподключения этого клиента, и поэтому клиент заново зарегистрировался на сервере.
 	<br>Ожидающие результат выполнения каллбеки будут вызванны с ошибкой, команды ожидавшие переподключения так же отправленны не будут, так как это новый экземпляр сервера.
 	<br>Выбрасывается вмете с `reconnected`.

<h5>How to debug:</h5>

DEBUG=TeleportClient* npm test

<h5>HALP</h5>

Надежды мало, но вдруг.
Кто нибудь переведите readme на английский, с меня спасибо :)