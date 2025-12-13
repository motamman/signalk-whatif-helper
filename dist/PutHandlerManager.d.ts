/**
 * PutHandlerManager - Manages PUT handler registration for paths
 */
import { ServerAPI, PutHandlerInfo, PutOptions } from './types';
import { PathManager } from './PathManager';
export declare class PutHandlerManager {
    private app;
    private pathManager;
    private handlers;
    private unregisterFunctions;
    constructor(app: ServerAPI, pathManager: PathManager);
    /**
     * Register a PUT handler for a path
     */
    registerHandler(path: string, options?: PutOptions): void;
    /**
     * Unregister a PUT handler
     */
    unregisterHandler(path: string): boolean;
    /**
     * Get all registered PUT handlers
     */
    getHandlers(): PutHandlerInfo[];
    /**
     * Check if a path has a PUT handler
     */
    hasPutHandler(path: string): boolean;
    /**
     * Get handler info for a specific path
     */
    getHandler(path: string): PutHandlerInfo | undefined;
    /**
     * Unregister all handlers (called on plugin stop)
     */
    unregisterAll(): void;
}
//# sourceMappingURL=PutHandlerManager.d.ts.map