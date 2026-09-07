define(['area'], function(Area) {

    var MUSIC_MAX_VOLUME = 0.32;
    var FADE_OUT_STEP = 0.015;
    var FADE_IN_STEP = 0.01;
    var FADE_INTERVAL_MS = 40;

    var AudioManager = Class.extend({
        init: function(game) {
            var self = this;
        
            this.enabled = true;
            this.extension = Detect.canPlayMP3() ? "mp3" : "ogg";
            this.sounds = {};
            this.game = game;
            this.currentMusic = null;
            this.areas = [];
            this.musicMaxVolume = MUSIC_MAX_VOLUME;
            this.victoryPlaying = false;
            this.musicNames = [
                "village", "beach", "forest", "cave", "desert", "lavaland", "boss",
                "theme", "combat_rats", "combat_goblins", "combat_bats", "victory"
            ];
            this.soundNames = ["loot", "hit1", "hit2", "hurt", "heal", "chat", "revive", "death", "firefox", "achievement", "kill1", "kill2", "noloot", "teleport", "chest", "npc", "npc-end"];
            
            var loadSoundFiles = function() {
                var counter = _.size(self.soundNames);
                log.info("Loading sound files...");
                _.each(self.soundNames, function(name) { self.loadSound(name, function() {
                        counter -= 1;
                        if(counter === 0) {
                            if(!Detect.isSafari()) { // Disable music on Safari - See bug 738008
                                loadMusicFiles();
                            }
                        }
                    });
                });
            };
            
            var loadMusicFiles = function() {
                if(!self.game.renderer.mobile) { // disable music on mobile devices
                    log.info("Loading music files...");
                    var names = self.musicNames.slice(0);
                    // Load the village music first, as players always start here
                    self.loadMusic(names.shift(), function() {
                        _.each(names, function(name) {
                            self.loadMusic(name);
                        });
                    });
                }
            };
        
            if(!(Detect.isSafari() && Detect.isWindows())) {
                loadSoundFiles();
            } else {
                this.enabled = false; // Disable audio on Safari Windows
            }
        },
    
        toggle: function() {
            if(this.enabled) {
                this.enabled = false;
            
                if(this.currentMusic) {
                    this.resetMusic(this.currentMusic);
                }
            } else {
                this.enabled = true;
            
                if(this.currentMusic) {
                    this.currentMusic = null;
                }
                this.updateMusic();
            }
        },
    
        load: function (basePath, name, loaded_callback, channels) {
            var path = basePath + name + "." + this.extension,
                sound = document.createElement('audio'),
                self = this;
            
            sound.addEventListener('canplaythrough', function (e) {
                this.removeEventListener('canplaythrough', arguments.callee, false);
                log.debug(path + " is ready to play.");
                if(loaded_callback) {
                    loaded_callback();
                }
            }, false);
            sound.addEventListener('error', function (e) {
                log.error("Error: "+ path +" could not be loaded.");
                self.sounds[name] = null;
            }, false);
        
            sound.preload = "auto";
            sound.autobuffer = true;
            sound.volume = this.musicMaxVolume;
            sound.src = path;
            sound.load();
        
            this.sounds[name] = [sound];
            _.times(channels - 1, function() {
                self.sounds[name].push(sound.cloneNode(true));
            });
        },
    
        loadSound: function(name, handleLoaded) {
            this.load("audio/sounds/", name, handleLoaded, 4);
            // SFX slightly quieter than classic full-blast
            _.each(this.sounds[name] || [], function(sound) {
                sound.volume = 0.7;
            });
        },
    
        loadMusic: function(name, handleLoaded) {
            this.load("audio/music/", name, handleLoaded, 1);
            if(!this.sounds[name] || !this.sounds[name][0]) {
                return;
            }
            var music = this.sounds[name][0];
            music.loop = (name !== 'victory');
            music.volume = 0;
            if(music.loop) {
                music.addEventListener('ended', function() {
                    if(!music.paused) {
                        music.play();
                    }
                }, false);
            }
        },
    
        getSound: function(name) {
            if(!this.sounds[name]) {
                return null;
            }
            var sound = _.detect(this.sounds[name], function(sound) {
                return sound.ended || sound.paused;
            });
            if(sound && sound.ended) {
                sound.currentTime = 0;
            } else {
                sound = this.sounds[name][0];
            }
            return sound;
        },
    
        playSound: function(name) {
            var sound = this.enabled && this.getSound(name);
            if(sound) {
                sound.volume = 0.7;
                sound.play();
            }
        },
    
        addArea: function(x, y, width, height, musicName) {
            var area = new Area(x, y, width, height);
            area.musicName = musicName;
            this.areas.push(area);
        },

        getZoneMusicName: function(entity) {
            var area = _.detect(this.areas, function(area) {
                return area.contains(entity);
            });
            return area ? area.musicName : null;
        },

        getCombatMusicName: function() {
            var player = this.game.player,
                kinds = [],
                self = this;

            if(!player) {
                return null;
            }

            _.each(player.attackers, function(attacker) {
                if(attacker && attacker.kind) {
                    kinds.push(attacker.kind);
                }
            });

            if(player.target && player.target.kind && Types.isMob(player.target.kind)) {
                kinds.push(player.target.kind);
            }

            if(kinds.length === 0) {
                return null;
            }

            if(_.include(kinds, Types.Entities.RAT)) {
                return 'combat_rats';
            }
            if(_.include(kinds, Types.Entities.BAT)) {
                return 'combat_bats';
            }
            if(_.include(kinds, Types.Entities.GOBLIN) ||
               _.include(kinds, Types.Entities.SNAKE) ||
               _.include(kinds, Types.Entities.SKELETON) ||
               _.include(kinds, Types.Entities.SKELETON2) ||
               _.include(kinds, Types.Entities.OGRE) ||
               _.include(kinds, Types.Entities.CRAB) ||
               _.include(kinds, Types.Entities.EYE) ||
               _.include(kinds, Types.Entities.SPECTRE) ||
               _.include(kinds, Types.Entities.DEATHKNIGHT) ||
               _.include(kinds, Types.Entities.BOSS)) {
                return 'combat_goblins';
            }

            return 'combat_goblins';
        },

        getDesiredMusicName: function() {
            if(this.victoryPlaying) {
                return 'victory';
            }
            return this.getCombatMusicName() || this.getZoneMusicName(this.game.player) || 'theme';
        },
    
        getSurroundingMusic: function(entity) {
            var name = this.getCombatMusicName() || this.getZoneMusicName(entity) || 'theme',
                sound = this.getSound(name);

            if(!sound) {
                return null;
            }
            return { sound: sound, name: name };
        },
    
        updateMusic: function() {
            if(!this.enabled || this.victoryPlaying) {
                return;
            }

            var name = this.getDesiredMusicName(),
                sound = this.getSound(name),
                music;

            if(!sound) {
                this.fadeOutCurrentMusic();
                return;
            }

            music = { sound: sound, name: name };
            if(!this.isCurrentMusic(music)) {
                this.transitionToMusic(music);
            }
        },
    
        isCurrentMusic: function(music) {
            return this.currentMusic && (music.name === this.currentMusic.name);
        },

        transitionToMusic: function(music) {
            var previous = this.currentMusic,
                self = this;

            if(!this.enabled || !music || !music.sound) {
                return;
            }

            this.currentMusic = music;

            if(previous && previous.sound && previous.name !== music.name) {
                this.fadeOutMusic(previous, function(oldMusic) {
                    self.resetMusic(oldMusic);
                });
            }

            if(music.sound.fadingOut) {
                this.clearFadeOut(music);
            }

            try {
                if(music.sound.paused || music.sound.ended) {
                    music.sound.currentTime = 0;
                }
            } catch(e) {}

            music.sound.volume = 0;
            var playPromise = music.sound.play();
            if(playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(function() {});
            }
            this.fadeInMusic(music);
        },
    
        playMusic: function(music) {
            this.transitionToMusic(music);
        },
    
        resetMusic: function(music) {
            if(music && music.sound && music.sound.readyState > 0) {
                music.sound.pause();
                try {
                    music.sound.currentTime = 0;
                } catch(e) {}
            }
        },
    
        fadeOutMusic: function(music, ended_callback) {
            var self = this;
            if(music && music.sound && !music.sound.fadingOut) {
                this.clearFadeIn(music);
                music.sound.fadingOut = setInterval(function() {
                    var volume = music.sound.volume - FADE_OUT_STEP;
                
                    if(self.enabled && volume >= FADE_OUT_STEP) {
                        music.sound.volume = volume;
                    } else {
                        music.sound.volume = 0;
                        self.clearFadeOut(music);
                        if(ended_callback) {
                            ended_callback(music);
                        }
                    }
                }, FADE_INTERVAL_MS);
            }
        },
    
        fadeInMusic: function(music) {
            var self = this,
                cap = this.musicMaxVolume;
            if(music && music.sound && !music.sound.fadingIn) {
                this.clearFadeOut(music);
                music.sound.fadingIn = setInterval(function() {
                    var volume = music.sound.volume + FADE_IN_STEP;

                    if(self.enabled && volume < cap - FADE_IN_STEP) {
                        music.sound.volume = volume;
                    } else {
                        music.sound.volume = cap;
                        self.clearFadeIn(music);
                    }
                }, FADE_INTERVAL_MS);
            }
        },
    
        clearFadeOut: function(music) {
            if(music.sound && music.sound.fadingOut) {
                clearInterval(music.sound.fadingOut);
                music.sound.fadingOut = null;
            }
        },
        
        clearFadeIn: function(music) {
            if(music.sound && music.sound.fadingIn) {
                clearInterval(music.sound.fadingIn);
                music.sound.fadingIn = null;
            }
        },
    
        fadeOutCurrentMusic : function() {
            var self = this;
            if(this.currentMusic) {
                var fading = this.currentMusic;
                this.currentMusic = null;
                this.fadeOutMusic(fading, function(music) {
                    self.resetMusic(music);
                });
            }
        },

        /**
         * After a combat kill, play the short victory sting then return to zone/theme.
         */
        onMobKilled: function(kind) {
            var stillFighting = !!this.getCombatMusicName();

            if(stillFighting) {
                this.updateMusic();
                return;
            }

            if(!this.enabled || this.victoryPlaying) {
                this.updateMusic();
                return;
            }

            var victory = this.getSound('victory');
            if(!victory) {
                this.updateMusic();
                return;
            }

            this.victoryPlaying = true;
            this.transitionToMusic({ sound: victory, name: 'victory' });

            var self = this;
            var finish = function() {
                victory.removeEventListener('ended', finish);
                self.victoryPlaying = false;
                self.updateMusic();
            };
            victory.addEventListener('ended', finish);
            // Safety if ended event is missed
            setTimeout(function() {
                if(self.victoryPlaying) {
                    finish();
                }
            }, 12000);
        }
    });
    
    return AudioManager;
});
