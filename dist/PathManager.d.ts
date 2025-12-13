/**
 * PathManager - Handles path listing, value setting, and path creation
 */
import { ServerAPI, PathInfo, PathMeta, PathFilter } from './types';
export declare class PathManager {
    private app;
    private createdPaths;
    private selfContext;
    constructor(app: ServerAPI);
    /**
     * Get the proper vessel context (URN) for deltas
     */
    private initSelfContext;
    /**
     * Get all paths from SignalK data model
     */
    getAllPaths(filter?: PathFilter): Promise<PathInfo[]>;
    /**
     * Fetch paths from SignalK HTTP API
     */
    private fetchPathsFromAPI;
    /**
     * Recursively extract paths from nested SignalK data
     */
    private extractPaths;
    /**
     * Get a single path's details
     */
    getPath(path: string): Promise<PathInfo | null>;
    /**
     * Set a value on a path by injecting a delta
     * Source is set to provided source, or auto-generated as <original_source>.whatif-helper
     */
    setValue(path: string, value: any, source?: string): Promise<void>;
    /**
     * Create a new path with initial value and optional metadata
     */
    createPath(path: string, value: any, meta?: PathMeta): Promise<void>;
    /**
     * Get list of paths created by this plugin
     */
    getCreatedPaths(): string[];
    /**
     * Check if a path was created by this plugin
     */
    isCreatedPath(path: string): boolean;
    /**
     * Get available base units (common SignalK units)
     */
    getAvailableUnits(): {
        unit: string;
        description: string;
    }[];
}
//# sourceMappingURL=PathManager.d.ts.map