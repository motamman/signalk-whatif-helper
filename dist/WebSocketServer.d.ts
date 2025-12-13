/**
 * WebSocketServer - Real-time value updates via WebSocket
 */
import { ServerAPI, WSUpdate } from './types';
import { PathManager } from './PathManager';
export declare class WebSocketServer {
    private app;
    private pathManager;
    private wss;
    private clients;
    private clientIdCounter;
    private wsPath;
    private upgradeHandler;
    private httpServer;
    private deltaUnsubscribe;
    constructor(app: ServerAPI, pathManager: PathManager);
    /**
     * Initialize WebSocket server on HTTP server upgrade
     */
    initialize(server: any, path: string): void;
    /**
     * Subscribe to SignalK delta stream for all paths
     */
    private subscribeToDeltaStream;
    /**
     * Handle incoming delta and broadcast to subscribed clients
     */
    private handleDelta;
    /**
     * Handle incoming message from client
     */
    private handleMessage;
    /**
     * Send current values for subscribed paths
     */
    private sendCurrentValues;
    /**
     * Send message to client
     */
    private send;
    /**
     * Send error message to client
     */
    private sendError;
    /**
     * Broadcast to all connected clients
     */
    broadcast(message: WSUpdate): void;
    /**
     * Clean up WebSocket server
     */
    close(): void;
}
//# sourceMappingURL=WebSocketServer.d.ts.map