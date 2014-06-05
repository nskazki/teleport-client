TeleportClient
==============

```
bower install teleport-client --save
```

[TeleportServer](https://github.com/MyNodeComponents/TeleportServer)

<h5>Это RPC клиент, умеет:</h5>
 * Подлучать от сервера список серверных объектов, их методов и типов выбрасываемых событий.
 * Генирировать на основе полученного списка соответствующие объекты и методы.
 * Выбрасывать события серверных объектов из сгенирированных.

<h5>Ограничения:</h5>
 * Работает только с объектами.
 * Работает только с асинхронными методоми объктов, принимающими callback и неограниченное количество аргументов.
 * Выбрасываемые события могут содержать неограниченное количество аргументов.
 * Все аргументы передоваемые на сервер и результаты возвращаемые на клиента проходят через JSON.stringify -> JSON.parse.

<h5>requirejs совместимый</h5>
Если подклюна биюлиотека requirejs, то TeleportClient будет сформирован как модуль,
иначе добавлен в глобальную область видимости.

<h5>Пояснение к Example:</h5>
Конструктор класса TeleportClient, принимает единственным параметром объект с опциями.
Возвращает новый неинециализированный объект класса TeleportClient.

<h5>Example:</h5>
```js
var teleportClient = new TeleportClient({
	serverAddress: "ws://localhost:8000",
	isDebug: true
})
	.on('info', someHandler)
	.on('debug', someHandler)
	.on('error', someHandler)
	.init();

teleportClient.on('ready', function(objectsProps) {
	console.log(objectsProps);

	teleportClient.objects.ipBox
		.getIps(someCallback)
		.on('newIps', someHandler);
});
```