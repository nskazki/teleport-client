"use strict"

define(function() {
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
});