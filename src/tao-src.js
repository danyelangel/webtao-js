//Dependencies: Firebase
"use strict";

/* tao main */
/**
 * Merge defaults with user options
 * @private
 * @param {Object} defaults Default settings
 * @param {Object} options User options
 * @returns {Object} Merged values of defaults and options
 */

// Base function.
//Dependencies: Firebase
function Tao(loginObject, clientApi) {
    var name = loginObject.name,
        url = loginObject.url,
        id = loginObject.id,
        _metadataRef = new Firebase(url + '/metadata/' + id),
        exports = {},
        clientApiStatus,
        taoStatus;

    //Class initialization

    function constructor() {
        //Check data
        if (!checkinput()) {
            return false;
        }

        //Create status object for clientApi
        clientApiStatus = new Status(clientApi.name, clientApi.statusMessages);

        //Set metadata name and turn on device
        _metadataRef.child('name').set(name);
        _metadataRef.child('isTurnedOn').set(true);

        //Set disconnect callbacks to destroy objects
        removeOnDisconnect(
            [
                'isTurnedOn'
            ]
        );

        //Call metadata ready callback
        _metadataRef.once('value', _metadataReady);

        //Listen for client API
        _metadataRef.child('api').on('value', _clientApi);
    }

    //Internal Functions

    //For checking the initial inputs (name, url, id)
    function checkinput() {
        if (typeof loginObject.name != 'string' || loginObject.name.length < 4) {
            error('name');
            return false;
        }
        if (typeof loginObject.url != 'string' || loginObject.url.length < 10) {
            error('url');
            return false;
        }
        if (typeof loginObject.id != 'string' || loginObject.id.length != 20) {
            error('id');
            return false;
        }
        return true;
    }

    //Make the exposed channels be removed when this client is disconnected.
    function removeOnDisconnect(channels) {
        channels.map(function (item) {
            _metadataRef.child(item).onDisconnect().remove();
        });
    }

    //Callback function when metadata is already fetched from Firebase
    function _metadataReady(snapshot) {
        var input = snapshot.child('input').val(),
            output = snapshot.child('output').val();

        exports._outputRef = new Firebase(url + '/channels/' + output);
        exports._inputRef = new Firebase(url + '/channels/' + input);

        exports.onReadyCallback(snapshot.val());

        taoStatus = new Status('tao', {});
    }

    //Callback function when api call is received
    function _clientApi(data) {
        if (data.val()) {
            clientApi.api(_metadataRef.child('api'), data.val());
            clientApiStatus.set(data.val());
        }
    }

    // *** Logs errors in the console in a cute way ***
    function error(err) {
        console.log('*** TaoConnect has encountered an error: ' + err + ' ***');
    }

    // Option extender
    function extend(defaults, options) {
        var extended = {};
        var prop;
        for (prop in defaults) {
            if (Object.prototype.hasOwnProperty.call(defaults, prop)) {
                extended[prop] = defaults[prop];
            }
        }
        for (prop in options) {
            if (Object.prototype.hasOwnProperty.call(options, prop)) {
                extended[prop] = options[prop];
            }
        }
        return extended;
    }

    //Class Methods

    function getMetadata(callback) {
        _metadataRef.once('value', callback);
    }

    function onReady(callback) {
        exports.onReadyCallback = callback;
    }

    exports.getMetadata = getMetadata;
    exports.onReady = onReady;

    //SubClasses
    function Channel(options) {
        var _enabled,
            _data,
            channelRef,
            metadataRef,
            defaults = {
                dataFormat: 'midi'
            },
            settings = extend(defaults, options),
            name = settings.name,
            type = settings.type,
            dataFormat = settings.dataFormat;



        //Constructor function
        function constructor() {
            if (type == "input") {
                channelRef = exports._inputRef.child(dataFormat).child(name);
            } else if (type == "output") {
                channelRef = exports._outputRef.child(dataFormat).child(name);
            }

            metadataRef = _metadataRef.child('channels').child(type).child(name);

            if (type == "input") {
                enable();

                metadataRef.child('enabled').on('value', function (snapchat) {
                    if (snapchat.val()) {
                        enable();
                    } else {
                        disable();
                    }
                });
            }
            channelRef.child('enabled').on('value', function (snapchat) {
                _enabled = snapchat.val();
            });

        }

        //Set functions

        function enable() {
            _enabled = true;
            metadataRef.child('enabled').set(true);
            channelRef.child('enabled').set(true);
        }

        function disable() {
            _enabled = false;
            metadataRef.child('enabled').set(false);
            channelRef.child('enabled').set(false);
        }

        function isEnabled() {
            return _enabled;
        }

        //Get functions

        function getData(callback) {
            var _onDataready = function (snapshot) {
                if (isEnabled()) {
                    var data = snapshot.val();
                    callback(data);
                } else {
                    callback(_data);
                }
            };
            channelRef.child('data').once('value', _onDataready);
        }

        function watch(callback) {
            var _onDatachange = function (snapshot) {
                if (isEnabled()) {
                    callback(snapshot.val());
                }
            };
            channelRef.child('data').on('value', _onDatachange);
            channelRef.child('data').once('value', _onDatachange);
        }

        function onEnable(callback) {
            var _onEnable = function (snapshot) {
                if (snapshot.val()) {
                    callback();
                }
            };
            channelRef.child('enabled').once('value', _onEnable);
            channelRef.child('enabled').on('value', _onEnable);
        }

        function onDisable(callback) {
            var _onDisable = function (snapshot) {
                if (!snapshot.val()) {
                    callback();
                }
            };
            channelRef.child('enabled').once('value', _onDisable);
            channelRef.child('enabled').on('value', _onDisable);
        }

        function disconnect() {
            channelRef.child('data').off('value');
        }

        function setData(data) {
            if (isEnabled()) {
                channelRef.child('data').set(data);
            } else {
                console.log('Could not set data. Channel is disabled.');
            }
        }

        function removeOnDisconnect() {
            channelRef.child('data').onDisconnect().remove();
        }

        this.setData = setData;
        this.disconnect = disconnect;
        this.getData = getData;
        this.enable = enable;
        this.disable = disable;
        this.isEnabled = isEnabled;
        this.removeOnDisconnect = removeOnDisconnect;
        this.watch = watch;
        this.onEnable = onEnable;
        this.onDisable = onDisable;

        constructor();
        getData(function (data) {
            _data = data;
        });
    }

    function Status(name, options) {

        var defaults = {
                statusMessages: {},
                logEnabled: true
            },
            settings = extend(defaults, options);

        var ref = _metadataRef.child('moduleStatus').child(name);

        function log(data) {
            var date = new Date();
            ref.child('statusLog').child(date.toString()).set(data);
        }

        function set(data) {
            if (data) {
                ref.child('status').set(data);

                //Set the status description if it exists
                if (settings.statusMessages[data]) {
                    ref.child('statusDescription').set(settings.statusMessages[data]);
                } else {
                    ref.child('statusDescription').set('Unknown status');
                }

                //Log if log is enabled
                if (settings.logEnabled) {
                    log(data);
                }
            }
        }

        this.set = set;
    }

    exports.Channel = Channel;
    exports.Status = Status;

    constructor();

    return exports;
}

// Version.
Tao.VERSION = '0.0.1';