"use strict"

(function(namespace) {

	if (namespace.define) {
		/**
        Раз есть define значит подключен requirejs.
        Зависимости будет переданны в CreateLog, 
        который вернет сформированный класс Log

      */
		define(
			CreateLog);
	} else {
		/**
        Иначе считаю, что Log подключен в "классический"
        проект, зависимости удовлетворены разработчиком проекта которому мой 
        класс понадобился, и добавляю сформированный класс в глобальное пространство имен.

      */
		namespace.Log = CreateLog();
	}

	function CreateLog() {

		var Log = function(desc) {
			this.logBody = {
				desc: desc
			};
		};

		Log.prototype.add = function(name, value) {
			this.logBody[name] = value;
		};

		Log.prototype.extract = function() {
			return this.logBody;
		};

		return Log;
	}
}(window));