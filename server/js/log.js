/**
 * Minimal logger compatible with the old npm `log` package API used by BrowserQuest.
 */
var LEVELS = {
    ERROR: 0,
    INFO: 1,
    DEBUG: 2
};

function Log(level) {
    this.level = typeof level === 'number' ? level : LEVELS.INFO;
}

Log.ERROR = LEVELS.ERROR;
Log.INFO = LEVELS.INFO;
Log.DEBUG = LEVELS.DEBUG;

Log.prototype.error = function(message) {
    if (this.level >= LEVELS.ERROR) {
        console.error('[ERROR]', message);
    }
};

Log.prototype.info = function(message) {
    if (this.level >= LEVELS.INFO) {
        console.info('[INFO]', message);
    }
};

Log.prototype.debug = function(message) {
    if (this.level >= LEVELS.DEBUG) {
        console.log('[DEBUG]', message);
    }
};

module.exports = Log;
