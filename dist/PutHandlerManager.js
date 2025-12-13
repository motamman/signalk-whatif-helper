"use strict";
/**
 * PutHandlerManager - Manages PUT handler registration for paths
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PutHandlerManager = void 0;
const SOURCE_LABEL = 'whatif-helper';
class PutHandlerManager {
    constructor(app, pathManager) {
        this.handlers = new Map();
        this.unregisterFunctions = new Map();
        this.app = app;
        this.pathManager = pathManager;
    }
    /**
     * Register a PUT handler for a path
     */
    registerHandler(path, options = {}) {
        // Check if already registered
        if (this.handlers.has(path)) {
            this.app.debug(`PUT handler already registered for ${path}`);
            return;
        }
        this.app.debug(`Registering PUT handler for ${path}`);
        const handler = (context, putPath, value, callback) => {
            this.app.debug(`PUT received for ${putPath}: ${JSON.stringify(value)}`);
            try {
                // Set the value using PathManager
                this.pathManager.setValue(putPath, value);
                const result = {
                    state: 'COMPLETED',
                    statusCode: 200
                };
                if (callback) {
                    callback(result);
                }
                return result;
            }
            catch (error) {
                const result = {
                    state: 'FAILED',
                    statusCode: 500,
                    message: error instanceof Error ? error.message : 'Unknown error'
                };
                if (callback) {
                    callback(result);
                }
                return result;
            }
        };
        // Register with SignalK
        // The context 'vessels.self' is the standard for self vessel
        const unregister = this.app.registerPutHandler('vessels.self', path, handler, options.acceptAllSources ? undefined : SOURCE_LABEL);
        // Store handler info
        this.handlers.set(path, {
            path,
            registeredAt: new Date().toISOString(),
            acceptAllSources: options.acceptAllSources ?? false
        });
        this.unregisterFunctions.set(path, unregister);
    }
    /**
     * Unregister a PUT handler
     */
    unregisterHandler(path) {
        const unregister = this.unregisterFunctions.get(path);
        if (!unregister) {
            return false;
        }
        this.app.debug(`Unregistering PUT handler for ${path}`);
        unregister();
        this.handlers.delete(path);
        this.unregisterFunctions.delete(path);
        return true;
    }
    /**
     * Get all registered PUT handlers
     */
    getHandlers() {
        return Array.from(this.handlers.values());
    }
    /**
     * Check if a path has a PUT handler
     */
    hasPutHandler(path) {
        return this.handlers.has(path);
    }
    /**
     * Get handler info for a specific path
     */
    getHandler(path) {
        return this.handlers.get(path);
    }
    /**
     * Unregister all handlers (called on plugin stop)
     */
    unregisterAll() {
        for (const path of this.handlers.keys()) {
            this.unregisterHandler(path);
        }
    }
}
exports.PutHandlerManager = PutHandlerManager;
//# sourceMappingURL=PutHandlerManager.js.map