// Shared client code (gametypes.js) expects underscore as `_`.
// Keep native Map intact — overwriting it breaks fetch()/undici (AI NPCs).
var NativeMap = global.Map;
global._ = require('underscore');

var fs = require('fs'),
    Metrics = require('./metrics'),
    AiRouter = require('./ai/router'),
    aiSettings = require('./ai-settings'),
    admin = require('./admin');

if (global.Map !== NativeMap) {
    global.Map = NativeMap;
}

function applyAiEnv(config) {
    if (process.env.AI_ENABLED !== undefined) {
        config.ai_enabled = process.env.AI_ENABLED === '1' || process.env.AI_ENABLED === 'true';
    }
    if (process.env.AI_PROVIDER) {
        config.ai_provider = process.env.AI_PROVIDER;
    }
    if (process.env.AI_MODEL) {
        config.ai_model = process.env.AI_MODEL;
    }
    if (process.env.OLLAMA_BASE_URL) {
        config.ollama_base_url = process.env.OLLAMA_BASE_URL;
    }
    if (process.env.OLLAMA_CLOUD_BASE_URL) {
        config.ollama_cloud_base_url = process.env.OLLAMA_CLOUD_BASE_URL;
    }
    if (process.env.AI_TIMEOUT_MS) {
        config.ai_timeout_ms = parseInt(process.env.AI_TIMEOUT_MS, 10) || config.ai_timeout_ms;
    }
    return config;
}

function main(config) {
    var ws = require("./ws"),
        WorldServer = require("./worldserver"),
        Log = require('./log'),
        _ = require('underscore'),
        server = new ws.MultiVersionWebsocketServer(config.port),
        metrics = config.metrics_enabled ? new Metrics(config) : null;
        worlds = [],
        lastTotalPlayers = 0,
        aiRouter = new AiRouter(config),
        checkPopulationInterval = setInterval(function() {
            if(metrics && metrics.isReady) {
                metrics.getTotalPlayers(function(totalPlayers) {
                    if(totalPlayers !== lastTotalPlayers) {
                        lastTotalPlayers = totalPlayers;
                        _.each(worlds, function(world) {
                            world.updatePopulation(totalPlayers);
                        });
                    }
                });
            }
        }, 1000);

    // worldserver/map historically leaked constructors onto global; undici needs native Map.
    if (global.Map !== NativeMap) {
        global.Map = NativeMap;
    }
    
    switch(config.debug_level) {
        case "error":
            log = new Log(Log.ERROR); break;
        case "debug":
            log = new Log(Log.DEBUG); break;
        case "info":
            log = new Log(Log.INFO); break;
    };
    
    log.info("Starting BrowserQuest game server...");
    if (aiRouter.isEnabled()) {
        log.info("AI NPCs enabled via provider=" + (config.ai_provider || 'openai') + " model=" + (config.ai_model || '(unset)'));
    } else {
        log.info("AI NPCs disabled (classic scripted dialogue)");
    }

    server.setAdminHandler(admin.createAdminHandler({
        config: config,
        aiRouter: aiRouter,
        onReload: function(updated) {
            config = updated;
            aiRouter.updateConfig(updated);
            log.info("AI settings reloaded (enabled=" + !!updated.ai_enabled +
                ", provider=" + (updated.ai_provider || '') +
                ", model=" + (updated.ai_model || '') + ")");
        }
    }));
    
    server.onConnect(function(connection) {
        var world, // the one in which the player will be spawned
            connect = function() {
                if(world) {
                    var player = new Player(connection, world);
                    player.aiRouter = aiRouter;
                    world.connect_callback(player);
                }
            };
        
        if(metrics) {
            metrics.getOpenWorldCount(function(open_world_count) {
                // choose the least populated world among open worlds
                world = _.min(_.first(worlds, open_world_count), function(w) { return w.playerCount; });
                connect();
            });
        }
        else {
            // simply fill each world sequentially until they are full
            world = _.detect(worlds, function(world) {
                return world.playerCount < config.nb_players_per_world;
            });
            world.updatePopulation();
            connect();
        }
    });

    server.onError(function() {
        log.error(Array.prototype.join.call(arguments, ", "));
    });
    
    var onPopulationChange = function() {
        metrics.updatePlayerCounters(worlds, function(totalPlayers) {
            _.each(worlds, function(world) {
                world.updatePopulation(totalPlayers);
            });
        });
        metrics.updateWorldDistribution(getWorldDistribution(worlds));
    };

    _.each(_.range(config.nb_worlds), function(i) {
        var world = new WorldServer('world'+ (i+1), config.nb_players_per_world, server);
        world.run(config.map_filepath);
        worlds.push(world);
        if(metrics) {
            world.onPlayerAdded(onPopulationChange);
            world.onPlayerRemoved(onPopulationChange);
        }
    });
    
    server.onRequestStatus(function() {
        return JSON.stringify(getWorldDistribution(worlds));
    });
    
    if(config.metrics_enabled) {
        metrics.ready(function() {
            onPopulationChange(); // initialize all counters to 0 when the server starts
        });
    }
    
    process.on('uncaughtException', function (e) {
        log.error('uncaughtException: ' + e + (e && e.stack ? '\n' + e.stack : ''));
    });
}

function getWorldDistribution(worlds) {
    var distribution = [];
    
    _.each(worlds, function(world) {
        distribution.push(world.playerCount);
    });
    return distribution;
}

function getConfigFile(path, callback) {
    fs.readFile(path, 'utf8', function(err, json_string) {
        if(err) {
            console.error("Could not open config file:", err.path);
            callback(null);
        } else {
            callback(JSON.parse(json_string));
        }
    });
}

var defaultConfigPath = './server/config.json',
    customConfigPath = './server/config_local.json';

process.argv.forEach(function (val, index, array) {
    if(index === 2) {
        customConfigPath = val;
    }
});

getConfigFile(defaultConfigPath, function(defaultConfig) {
    getConfigFile(customConfigPath, function(localConfig) {
        var config = localConfig || defaultConfig;
        if(config && localConfig && defaultConfig) {
            Object.keys(defaultConfig).forEach(function(key) {
                if (config[key] === undefined) {
                    config[key] = defaultConfig[key];
                }
            });
        }
        if(config) {
            config = applyAiEnv(config);
            config = aiSettings.mergeAiIntoConfig(config, aiSettings.loadSecrets());
            main(config);
        } else {
            console.error("Server cannot start without any configuration file.");
            process.exit(1);
        }
    });
});
