/**
 * SignalK What-If Helper Type Definitions
 */
export interface ServerAPI {
    debug: (msg: string) => void;
    error: (msg: string) => void;
    getSelfPath: (path: string) => any;
    getPath: (path: string) => any;
    handleMessage: (id: string, delta: Delta) => void;
    registerPutHandler: (context: string, path: string, callback: PutHandler, source?: string) => () => void;
    streambundle: {
        getSelfBus: (path?: string) => any;
        getBus: (path?: string) => any;
    };
    on?: (event: string, callback: (...args: any[]) => void) => void;
    removeListener?: (event: string, callback: (...args: any[]) => void) => void;
}
export interface Plugin {
    id: string;
    name: string;
    description: string;
    schema: () => object;
    start: (config: PluginConfig) => void;
    stop?: () => void;
    registerWithRouter?: (router: any) => void;
}
export interface PluginConfig {
}
export interface Delta {
    context?: string;
    updates: Update[];
}
export interface Update {
    source?: Source;
    timestamp?: string;
    values: PathValue[];
}
export interface Source {
    label: string;
    type?: string;
    src?: string;
}
export interface PathValue {
    path: string;
    value: any;
}
export interface PathInfo {
    path: string;
    value: any;
    timestamp?: string;
    source?: string;
    meta?: PathMeta;
}
export interface PathMeta {
    units?: string;
    description?: string;
    displayName?: string;
    shortName?: string;
    longName?: string;
    zones?: Zone[];
}
export interface Zone {
    lower?: number;
    upper?: number;
    state: string;
    message?: string;
}
export type PutHandler = (context: string, path: string, value: any, callback: (result: PutResult) => void) => PutResult | void;
export interface PutResult {
    state: 'COMPLETED' | 'PENDING' | 'FAILED';
    statusCode?: number;
    message?: string;
}
export interface PutHandlerInfo {
    path: string;
    registeredAt: string;
    acceptAllSources: boolean;
}
export interface PutOptions {
    acceptAllSources?: boolean;
}
export interface CreatePathRequest {
    path: string;
    value: any;
    meta?: PathMeta;
    enablePut?: boolean;
}
export interface SetValueRequest {
    value: any;
    source?: string;
}
export interface RegisterPutRequest {
    path: string;
    options?: PutOptions;
}
export interface WSMessage {
    type: 'subscribe' | 'unsubscribe' | 'unsubscribeAll';
    paths?: string[];
    path?: string;
}
export interface WSUpdate {
    type: 'update' | 'full' | 'error';
    paths?: PathInfo[];
    path?: PathInfo;
    message?: string;
}
export interface PathFilter {
    search?: string;
    hasValue?: boolean;
    hasMeta?: boolean;
    baseUnit?: string;
}
//# sourceMappingURL=types.d.ts.map