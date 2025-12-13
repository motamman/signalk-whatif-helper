/**
 * PutHandlerManager - Manages PUT handler registration for paths
 */

import {
  ServerAPI,
  PutHandlerInfo,
  PutOptions,
  PutHandler,
  PutResult
} from './types'
import { PathManager } from './PathManager'

const SOURCE_LABEL = 'whatif-helper'

export class PutHandlerManager {
  private app: ServerAPI
  private pathManager: PathManager
  private handlers: Map<string, PutHandlerInfo> = new Map()
  private unregisterFunctions: Map<string, () => void> = new Map()

  constructor(app: ServerAPI, pathManager: PathManager) {
    this.app = app
    this.pathManager = pathManager
  }

  /**
   * Register a PUT handler for a path
   */
  registerHandler(path: string, options: PutOptions = {}): void {
    // Check if already registered
    if (this.handlers.has(path)) {
      this.app.debug(`PUT handler already registered for ${path}`)
      return
    }

    this.app.debug(`Registering PUT handler for ${path}`)

    const handler: PutHandler = (
      context: string,
      putPath: string,
      value: any,
      callback: (result: PutResult) => void
    ): PutResult => {
      this.app.debug(`PUT received for ${putPath}: ${JSON.stringify(value)}`)

      try {
        // Set the value using PathManager
        this.pathManager.setValue(putPath, value)

        const result: PutResult = {
          state: 'COMPLETED',
          statusCode: 200
        }

        if (callback) {
          callback(result)
        }

        return result
      } catch (error) {
        const result: PutResult = {
          state: 'FAILED',
          statusCode: 500,
          message: error instanceof Error ? error.message : 'Unknown error'
        }

        if (callback) {
          callback(result)
        }

        return result
      }
    }

    // Register with SignalK
    // The context 'vessels.self' is the standard for self vessel
    const unregister = this.app.registerPutHandler(
      'vessels.self',
      path,
      handler,
      options.acceptAllSources ? undefined : SOURCE_LABEL
    )

    // Store handler info
    this.handlers.set(path, {
      path,
      registeredAt: new Date().toISOString(),
      acceptAllSources: options.acceptAllSources ?? false
    })

    this.unregisterFunctions.set(path, unregister)
  }

  /**
   * Unregister a PUT handler
   */
  unregisterHandler(path: string): boolean {
    const unregister = this.unregisterFunctions.get(path)

    if (!unregister) {
      return false
    }

    this.app.debug(`Unregistering PUT handler for ${path}`)

    unregister()
    this.handlers.delete(path)
    this.unregisterFunctions.delete(path)

    return true
  }

  /**
   * Get all registered PUT handlers
   */
  getHandlers(): PutHandlerInfo[] {
    return Array.from(this.handlers.values())
  }

  /**
   * Check if a path has a PUT handler
   */
  hasPutHandler(path: string): boolean {
    return this.handlers.has(path)
  }

  /**
   * Get handler info for a specific path
   */
  getHandler(path: string): PutHandlerInfo | undefined {
    return this.handlers.get(path)
  }

  /**
   * Unregister all handlers (called on plugin stop)
   */
  unregisterAll(): void {
    for (const path of this.handlers.keys()) {
      this.unregisterHandler(path)
    }
  }
}
