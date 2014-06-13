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
 * Работает только с асинхронными методоми серверных объктов, принимающими неограниченное количество аргументов и callback.
 * Выбрасываемые объектами сервера события могут содержать неограниченное количество аргументов.
 * Все аргументы передоваемые на сервер и результаты возвращаемые на клиента проходят через JSON.stringify -> JSON.parse.

<h5>Requirejs совместимый:</h5>
Если подклюна биюлиотека requirejs, то TeleportClient будет сформирован как модуль,
иначе добавлен в глобальную область видимости.

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

<h5>Публичные методы:</h5>
 `init` - метод инициирующий объект.

<h5>Events:</h5>
 * `debug` - логированние клиент-серверного обмена сообщениями. Выбрасывается с одним аргументом, содержащим лог объект.
 * `info` - логированние важных событий, в частности подключение к серверу и получении свойств серверных объектов. Выбрасывается с одним аргументом.
 * `warn` - логированние проблем не влияющих на дальнейшую работы программы. Например получение неожиданного сообщения от сервера, или возврат результата выполнения команды без хендлера. Выбрасывается с одним аргументом.
 * `error` - логированние получение которые делают программу неработоспособной. В частности ошибка соединения с сервером. Выбрасывается с одним аргументом.

 * `ready` - признак успешного соединения с сервром и регистрации всех серверных объектов. Выбрасывается с одним аргументом, содержащим свойства зарегистрированных объектов. 