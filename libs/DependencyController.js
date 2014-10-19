/*
    i use angular dependency manager logic.
    https://github.com/angular/angular.js
*/

/*
    Events:
        applyDependencesError

    note: 

        > test.print.bind(test).apply({param: 2}, [])
        1
        > test.print.apply({param: 2}, [])
        2
*/

var assert = require('assert');

var patternMatching = require('pattern-matching');
module.exports = DependencyController;

var debug = require('debug')('TeleportClient-DependencyController');
var util = require('util');
var events = require('events');


util.inherits(DependencyController, events.EventEmitter);

function DependencyController() {
    this._objects = null;
    this._objectsProps = null;

    this._isInit = true;
    this._isReady = false;

    this._queue = [];
}

DependencyController.prototype.down = function(objectsController) {

    objectsController.once('objectsControllerReady', function(objectsProps, objects) {

        this._objects = objects;
        this._objectsProps = objectsProps;
        this._isReady = true;

        this._callQueue();

    }.bind(this));
}

DependencyController.prototype._callQueue = function() {
    while (this._queue.length) {
        var fn = this._queue.shift();
        this.applyDependences(fn);
    }
}

DependencyController.prototype.applyDependences = function(fn, context) {
    if (this._isReady) {
        var dependsNames = annotate(fn);
        var dependsObjs = dependsNames.map(function(depName) {
            var obj = this._objects[depName];
            if (!obj) throw new Error('DependencyController: dependency not found, name: ' + depName);

            return obj;
        }.bind(this));

        if (patternMatching(fn, 'array')) {
            fn = fn[fn.length - 1];
        }

        try {
            fn.apply(context, dependsObjs);
        } catch (ex) {
            debug('#applyDependences - some subscriber function throw error -> !applyDependencesError, ex: %s', ex.toString());
            setTimeout(this.emit.bind(this, 'applyDependencesError', ex), 0);
        }
    } else {
        this._queue.push(fn);
    }
}



var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
var FN_ARG_SPLIT = /,/;
var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

function annotate(fn) {
    var depends = null;

    if (patternMatching(fn, 'function')) {
        if (!(depends = fn.dependences)) {

            depends = [];
            if (fn.length) {
                var fnText = fn.toString().replace(STRIP_COMMENTS, '');
                var argDecl = fnText.match(FN_ARGS)[1].split(FN_ARG_SPLIT);

                argDecl.forEach(function(arg) {
                    arg.replace(FN_ARG, function(all, underscore, name) {
                        depends.push(name);
                    });
                });
            }

            fn.depends = depends;
        }
    } else if (patternMatching(fn, 'array')) {
        var last = fn.length - 1;

        assert(patternMatching(fn[last], 'function'), 'DependencyController: last arg in array not a function, array: ' + fn.toString());

        depends = fn.slice(0, last);
        fn[last].depends = depends;
    } else {
        throw new Error('DependencyController: not valid param (not function or array), param: ' + fn.toString())
    }

    if (depends.length === 0) {
        throw new Error('DependencyController: fn without depends, param: ' + fn.toString());
    }

    return depends;
}