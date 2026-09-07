
var cls = require("./lib/class"),
    path = require('path'),
    fs = require('fs'),
    url = require('url'),
    http = require('http'),
    WebSocket = require('ws'),
    Utils = require('./utils'),
    _ = require('underscore'),
    WS = {};

module.exports = WS;

var MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8'
};

var ROOT_DIR = path.resolve(__dirname, '../..');
var CLIENT_DIR = path.join(ROOT_DIR, 'client');
var SHARED_DIR = path.join(ROOT_DIR, 'shared');


/**
 * Abstract Server and Connection classes
 */
var Server = cls.Class.extend({
    init: function(port) {
        this.port = port;
    },
    
    onConnect: function(callback) {
        this.connection_callback = callback;
    },
    
    onError: function(callback) {
        this.error_callback = callback;
    },
    
    broadcast: function(message) {
        throw "Not implemented";
    },
    
    forEachConnection: function(callback) {
        _.each(this._connections, callback);
    },
    
    addConnection: function(connection) {
        this._connections[connection.id] = connection;
    },
    
    removeConnection: function(id) {
        delete this._connections[id];
    },
    
    getConnection: function(id) {
        return this._connections[id];
    }
});


var Connection = cls.Class.extend({
    init: function(id, connection, server) {
        this._connection = connection;
        this._server = server;
        this.id = id;
    },
    
    onClose: function(callback) {
        this.close_callback = callback;
    },
    
    listen: function(callback) {
        this.listen_callback = callback;
    },
    
    broadcast: function(message) {
        throw "Not implemented";
    },
    
    send: function(message) {
        throw "Not implemented";
    },
    
    sendUTF8: function(data) {
        throw "Not implemented";
    },
    
    close: function(logError) {
        var address = this._connection._socket && this._connection._socket.remoteAddress;
        log.info("Closing connection to "+address+". Error: "+logError);
        this._connection.close();
    }
});


/**
 * WebsocketServer
 *
 * Modern WebSocket server using the `ws` package, with static file serving
 * for the client and shared directories (one-command local play).
 */
WS.MultiVersionWebsocketServer = Server.extend({
    _connections: {},
    _counter: 0,
    
    init: function(port) {
        var self = this;
        
        this._super(port);
        this._adminHandler = null;
        
        this._httpServer = http.createServer(function(request, response) {
            self._onHttpRequest(request, response);
        });

        this._httpServer.listen(port, function() {
            log.info("Server is listening on port "+port);
            log.info("Open http://localhost:"+port+" to play");
            log.info("AI admin settings: http://localhost:"+port+"/admin");
        });

        this._wss = new WebSocket.Server({ server: this._httpServer });
        this._wss.on('connection', function(socket, request) {
            var c = new WS.WebSocketConnection(self._createId(), socket, self);
            if(self.connection_callback) {
                self.connection_callback(c);
            }
            self.addConnection(c);
        });

        this._wss.on('error', function(err) {
            if(self.error_callback) {
                self.error_callback(err);
            } else {
                log.error(err);
            }
        });
    },

    setAdminHandler: function(handler) {
        this._adminHandler = handler;
    },

    _onHttpRequest: function(request, response) {
        var pathname = url.parse(request.url).pathname || '/';

        if(pathname === '/status') {
            if(this.status_callback) {
                response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                response.end(this.status_callback());
            } else {
                response.writeHead(204);
                response.end();
            }
            return;
        }

        if(this._adminHandler && this._adminHandler(request, response, pathname)) {
            return;
        }

        this._serveStatic(pathname, response);
    },

    _serveStatic: function(pathname, response) {
        var decoded;
        try {
            decoded = decodeURIComponent(pathname);
        } catch(e) {
            response.writeHead(400);
            response.end('Bad request');
            return;
        }

        if(decoded === '/') {
            decoded = '/index.html';
        }

        var baseDir;
        var relativePath;
        if(decoded.indexOf('/shared/') === 0) {
            baseDir = SHARED_DIR;
            relativePath = decoded.substring('/shared/'.length);
        } else {
            baseDir = CLIENT_DIR;
            relativePath = decoded.replace(/^\//, '');
        }

        var filePath = path.normalize(path.join(baseDir, relativePath));
        if(filePath.indexOf(baseDir) !== 0) {
            response.writeHead(403);
            response.end('Forbidden');
            return;
        }

        fs.stat(filePath, function(err, stats) {
            if(err || !stats.isFile()) {
                response.writeHead(404);
                response.end('Not found');
                return;
            }

            var ext = path.extname(filePath).toLowerCase();
            var contentType = MIME_TYPES[ext] || 'application/octet-stream';
            response.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(filePath).pipe(response);
        });
    },
    
    _createId: function() {
        return '5' + Utils.random(99) + '' + (this._counter++);
    },
    
    broadcast: function(message) {
        this.forEachConnection(function(connection) {
            connection.send(message);
        });
    },
    
    onRequestStatus: function(status_callback) {
        this.status_callback = status_callback;
    }
});


/**
 * Connection class for the `ws` package
 */
WS.WebSocketConnection = Connection.extend({
    init: function(id, connection, server) {
        var self = this;
        
        this._super(id, connection, server);
        
        this._connection.on('message', function(message, isBinary) {
            if(!self.listen_callback) {
                return;
            }

            var data = isBinary ? message.toString() : (typeof message === 'string' ? message : message.toString());
            try {
                self.listen_callback(JSON.parse(data));
            } catch(e) {
                if(e instanceof SyntaxError) {
                    self.close("Received message was not valid JSON.");
                } else {
                    throw e;
                }
            }
        });
        
        this._connection.on('close', function() {
            if(self.close_callback) {
                self.close_callback();
            }
            self._server.removeConnection(self.id);
        });

        this._connection.on('error', function(err) {
            log.error('WebSocket error: ' + err);
        });
    },
    
    send: function(message) {
        this.sendUTF8(JSON.stringify(message));
    },
    
    sendUTF8: function(data) {
        if(this._connection.readyState === WebSocket.OPEN) {
            this._connection.send(data);
        }
    }
});
