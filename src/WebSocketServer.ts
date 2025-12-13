/**
 * WebSocketServer - Real-time value updates via WebSocket
 */

import WebSocket from 'ws'
import { ServerAPI, WSMessage, WSUpdate, PathInfo } from './types'
import { PathManager } from './PathManager'

interface WhatIfClient {
  ws: WebSocket
  id: string
  subscriptions: Set<string>
}

export class WebSocketServer {
  private app: ServerAPI
  private pathManager: PathManager
  private wss: WebSocket.Server | null = null
  private clients: Set<WhatIfClient> = new Set()
  private clientIdCounter = 0
  private wsPath: string = ''
  private upgradeHandler: ((request: any, socket: any, head: any) => void) | null = null
  private httpServer: any = null
  private deltaUnsubscribe: (() => void) | null = null

  constructor(app: ServerAPI, pathManager: PathManager) {
    this.app = app
    this.pathManager = pathManager
  }

  /**
   * Initialize WebSocket server on HTTP server upgrade
   */
  initialize(server: any, path: string): void {
    this.wsPath = path
    this.httpServer = server

    // Create WebSocket server in noServer mode to avoid conflicts
    this.wss = new WebSocket.Server({ noServer: true })

    this.wss.on('connection', (ws: WebSocket) => {
      const client: WhatIfClient = {
        ws,
        id: `client-${++this.clientIdCounter}`,
        subscriptions: new Set()
      }

      this.clients.add(client)
      this.app.debug(`WhatIfWS: Client ${client.id} connected (${this.clients.size} total)`)

      // Send initial connection confirmation
      this.send(client, {
        type: 'full',
        paths: []
      })

      ws.on('message', (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString())
          this.handleMessage(client, message)
        } catch (_error) {
          this.sendError(client, 'Invalid message format')
        }
      })

      ws.on('close', () => {
        this.clients.delete(client)
        this.app.debug(`WhatIfWS: Client ${client.id} disconnected (${this.clients.size} total)`)
      })

      ws.on('error', (error) => {
        this.app.error(`WhatIfWS: Client ${client.id} error: ${error}`)
        this.clients.delete(client)
      })
    })

    // Create upgrade handler function
    this.upgradeHandler = (request: any, socket: any, head: any) => {
      const pathname = new URL(request.url, `http://${request.headers.host}`).pathname

      // Only handle upgrades for our specific path
      if (pathname === this.wsPath) {
        this.app.debug(`WhatIfWS: Handling upgrade for ${pathname}`)
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request)
        })
      }
      // Otherwise, let SignalK's WebSocket handler deal with it
    }

    // Attach upgrade handler to HTTP server
    server.on('upgrade', this.upgradeHandler)

    this.app.debug(`WhatIfWS: WebSocket server initialized at ${path} (noServer mode)`)

    // Subscribe to SignalK delta stream
    this.subscribeToDeltaStream()
  }

  /**
   * Subscribe to SignalK delta stream for all paths
   */
  private subscribeToDeltaStream(): void {
    try {
      const bus = this.app.streambundle?.getSelfBus?.()

      if (bus && bus.onValue) {
        this.deltaUnsubscribe = bus.onValue((delta: any) => {
          this.handleDelta(delta)
        })
        this.app.debug('WhatIfWS: Subscribed to delta stream')
      } else {
        this.app.debug('WhatIfWS: Delta stream not available')
      }
    } catch (error) {
      this.app.debug(`WhatIfWS: Could not subscribe to delta stream: ${error}`)
    }
  }

  /**
   * Handle incoming delta and broadcast to subscribed clients
   */
  private handleDelta(delta: any): void {
    if (!delta || !delta.path) return

    const path = delta.path
    const value = delta.value
    const timestamp = delta.timestamp
    const source = delta.$source || delta.source?.label

    // Build path info
    const pathInfo: PathInfo = {
      path,
      value,
      timestamp,
      source
    }

    // Send to clients subscribed to this path
    for (const client of this.clients) {
      if (client.subscriptions.has(path) || client.subscriptions.has('*')) {
        this.send(client, {
          type: 'update',
          path: pathInfo
        })
      }
    }
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(client: WhatIfClient, message: WSMessage): void {
    switch (message.type) {
      case 'subscribe':
        if (message.paths) {
          for (const path of message.paths) {
            client.subscriptions.add(path)
            this.app.debug(`WhatIfWS: Client ${client.id} subscribed to ${path}`)
          }
        } else if (message.path) {
          client.subscriptions.add(message.path)
          this.app.debug(`WhatIfWS: Client ${client.id} subscribed to ${message.path}`)
        }

        // Send current values for subscribed paths
        this.sendCurrentValues(client)
        break

      case 'unsubscribe':
        if (message.paths) {
          for (const path of message.paths) {
            client.subscriptions.delete(path)
          }
        } else if (message.path) {
          client.subscriptions.delete(message.path)
        }
        break

      case 'unsubscribeAll':
        client.subscriptions.clear()
        break

      default:
        this.sendError(client, `Unknown message type: ${(message as any).type}`)
    }
  }

  /**
   * Send current values for subscribed paths
   */
  private async sendCurrentValues(client: WhatIfClient): Promise<void> {
    const paths: PathInfo[] = []

    if (client.subscriptions.has('*')) {
      // Get all paths
      const allPaths = await this.pathManager.getAllPaths()
      paths.push(...allPaths)
    } else {
      // Get specific paths
      for (const path of client.subscriptions) {
        const pathInfo = await this.pathManager.getPath(path)
        if (pathInfo) {
          paths.push(pathInfo)
        }
      }
    }

    this.send(client, {
      type: 'full',
      paths
    })
  }

  /**
   * Send message to client
   */
  private send(client: WhatIfClient, message: WSUpdate): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message))
    }
  }

  /**
   * Send error message to client
   */
  private sendError(client: WhatIfClient, message: string): void {
    this.send(client, {
      type: 'error',
      message
    })
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(message: WSUpdate): void {
    for (const client of this.clients) {
      this.send(client, message)
    }
  }

  /**
   * Clean up WebSocket server
   */
  close(): void {
    // Unsubscribe from delta stream
    if (this.deltaUnsubscribe) {
      this.deltaUnsubscribe()
      this.deltaUnsubscribe = null
    }

    // Remove upgrade event handler from HTTP server
    if (this.httpServer && this.upgradeHandler) {
      this.httpServer.removeListener('upgrade', this.upgradeHandler)
      this.app.debug('WhatIfWS: Removed upgrade handler from HTTP server')
      this.upgradeHandler = null
    }

    // Close all client connections
    for (const client of this.clients) {
      client.ws.close()
    }
    this.clients.clear()

    // Close WebSocket server
    if (this.wss) {
      this.wss.close()
      this.wss = null
    }

    this.app.debug('WhatIfWS: WebSocket server closed')
  }
}
