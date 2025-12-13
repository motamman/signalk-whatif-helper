/**
 * SignalK What-If Helper Plugin
 *
 * A webapp for browsing, modifying, and creating SignalK paths
 * for testing and simulation purposes.
 */

import { IRouter, Request, Response } from 'express'
import {
  ServerAPI,
  Plugin,
  PluginConfig,
  CreatePathRequest,
  SetValueRequest,
  RegisterPutRequest,
  PathFilter
} from './types'
import { PathManager } from './PathManager'
import { PutHandlerManager } from './PutHandlerManager'
import { WebSocketServer } from './WebSocketServer'

const PLUGIN_ID = 'signalk-whatif-helper'

module.exports = (app: ServerAPI): Plugin => {
  let pathManager: PathManager
  let putHandlerManager: PutHandlerManager
  let wsServer: WebSocketServer

  const plugin: Plugin = {
    id: PLUGIN_ID,
    name: 'What-If Helper',
    description: 'Browse, modify, and create SignalK paths for testing and simulation',

    schema: () => ({
      type: 'object',
      properties: {}
    }),

    start: async (_config: PluginConfig) => {
      app.debug('Starting What-If Helper plugin')

      // Initialize managers
      pathManager = new PathManager(app)
      putHandlerManager = new PutHandlerManager(app, pathManager)
      wsServer = new WebSocketServer(app, pathManager)

      // Get the HTTP server for WebSocket
      const server = (app as any).server || (app as any)._server

      if (server) {
        wsServer.initialize(server, `/plugins/${PLUGIN_ID}/stream`)
        app.debug('WebSocket server initialized')
      } else {
        app.error('Cannot start WebSocket server - app.server is not available')
      }

      app.debug('What-If Helper plugin started')
    },

    stop: () => {
      app.debug('Stopping What-If Helper plugin')

      // Unregister all PUT handlers
      if (putHandlerManager) {
        putHandlerManager.unregisterAll()
      }

      // Close WebSocket server
      if (wsServer) {
        wsServer.close()
      }

      app.debug('What-If Helper plugin stopped')
    },

    registerWithRouter: (router: IRouter) => {
      // ============================================
      // PATH ROUTES
      // ============================================

      /**
       * GET /paths - List all paths with optional filtering
       */
      router.get('/paths', async (req: Request, res: Response) => {
        try {
          const filter: PathFilter = {}

          if (req.query.search) {
            filter.search = String(req.query.search)
          }
          if (req.query.hasValue === 'true') {
            filter.hasValue = true
          }
          if (req.query.hasMeta === 'true') {
            filter.hasMeta = true
          }
          if (req.query.baseUnit) {
            filter.baseUnit = String(req.query.baseUnit)
          }

          const paths = await pathManager.getAllPaths(filter)
          res.json(paths)
        } catch (error) {
          app.error(`Error listing paths: ${error}`)
          res.status(500).json({ error: 'Failed to list paths' })
        }
      })

      /**
       * GET /paths/:path - Get single path details
       * Path is passed as URL-encoded parameter
       */
      router.get('/paths/*', async (req: Request, res: Response) => {
        // Skip if this looks like another route
        if (req.path === '/paths' || req.path.endsWith('/value')) {
          return res.status(404).json({ error: 'Path not found' })
        }

        try {
          // Extract path from URL (everything after /paths/)
          const skPath = req.params[0]

          if (!skPath) {
            return res.status(400).json({ error: 'Path required' })
          }

          const pathInfo = await pathManager.getPath(skPath)

          if (!pathInfo) {
            return res.status(404).json({ error: 'Path not found' })
          }

          // Add PUT handler info
          const hasPut = putHandlerManager.hasPutHandler(skPath)

          res.json({
            ...pathInfo,
            hasPutHandler: hasPut
          })
        } catch (error) {
          app.error(`Error getting path: ${error}`)
          res.status(500).json({ error: 'Failed to get path' })
        }
      })

      /**
       * POST /paths - Create a new path
       */
      router.post('/paths', async (req: Request, res: Response) => {
        try {
          const body: CreatePathRequest = req.body

          if (!body.path) {
            return res.status(400).json({ error: 'Path is required' })
          }

          if (body.value === undefined) {
            return res.status(400).json({ error: 'Value is required' })
          }

          // Validate path format (basic SignalK path validation)
          // Segments can be alphanumeric (starting with letter) or purely numeric
          if (
            !/^([a-zA-Z][a-zA-Z0-9]*|[0-9]+)(\.([a-zA-Z][a-zA-Z0-9]*|[0-9]+))*$/.test(body.path)
          ) {
            return res.status(400).json({
              error: 'Invalid path format. Use dot-separated segments (alphanumeric or numeric).'
            })
          }

          await pathManager.createPath(body.path, body.value, body.meta)

          // Optionally register PUT handler
          if (body.enablePut) {
            putHandlerManager.registerHandler(body.path, { acceptAllSources: true })
          }

          res.status(201).json({
            path: body.path,
            value: body.value,
            meta: body.meta,
            hasPutHandler: body.enablePut ?? false
          })
        } catch (error) {
          app.error(`Error creating path: ${error}`)
          res.status(500).json({ error: 'Failed to create path' })
        }
      })

      /**
       * PUT /value/:path - Set value on a path
       * Using /value/ prefix to avoid conflict with GET /paths/*
       */
      router.put('/value/*', async (req: Request, res: Response) => {
        try {
          const skPath = req.params[0]

          if (!skPath) {
            return res.status(400).json({ error: 'Path required' })
          }

          const body: SetValueRequest = req.body

          if (body.value === undefined) {
            return res.status(400).json({ error: 'Value is required' })
          }

          await pathManager.setValue(skPath, body.value, body.source)

          res.json({
            path: skPath,
            value: body.value,
            source: body.source,
            timestamp: new Date().toISOString()
          })
        } catch (error) {
          app.error(`Error setting value: ${error}`)
          res.status(500).json({ error: 'Failed to set value' })
        }
      })

      // ============================================
      // PUT HANDLER ROUTES
      // ============================================

      /**
       * GET /puts - List all registered PUT handlers
       */
      router.get('/puts', (req: Request, res: Response) => {
        try {
          const handlers = putHandlerManager.getHandlers()
          res.json(handlers)
        } catch (error) {
          app.error(`Error listing PUT handlers: ${error}`)
          res.status(500).json({ error: 'Failed to list PUT handlers' })
        }
      })

      /**
       * POST /puts - Register a PUT handler for a path
       */
      router.post('/puts', (req: Request, res: Response) => {
        try {
          const body: RegisterPutRequest = req.body

          if (!body.path) {
            return res.status(400).json({ error: 'Path is required' })
          }

          if (putHandlerManager.hasPutHandler(body.path)) {
            return res.status(409).json({
              error: 'PUT handler already registered for this path'
            })
          }

          putHandlerManager.registerHandler(body.path, body.options || {})

          res.status(201).json({
            path: body.path,
            registeredAt: new Date().toISOString(),
            acceptAllSources: body.options?.acceptAllSources ?? false
          })
        } catch (error) {
          app.error(`Error registering PUT handler: ${error}`)
          res.status(500).json({ error: 'Failed to register PUT handler' })
        }
      })

      /**
       * DELETE /puts/:path - Unregister a PUT handler
       */
      router.delete('/puts/*', (req: Request, res: Response) => {
        try {
          const skPath = req.params[0]

          if (!skPath) {
            return res.status(400).json({ error: 'Path required' })
          }

          const success = putHandlerManager.unregisterHandler(skPath)

          if (!success) {
            return res.status(404).json({
              error: 'PUT handler not found for this path'
            })
          }

          res.status(204).send()
        } catch (error) {
          app.error(`Error unregistering PUT handler: ${error}`)
          res.status(500).json({ error: 'Failed to unregister PUT handler' })
        }
      })

      // ============================================
      // UTILITY ROUTES
      // ============================================

      /**
       * GET /units - Get available base units
       */
      router.get('/units', (req: Request, res: Response) => {
        try {
          const units = pathManager.getAvailableUnits()
          res.json(units)
        } catch (error) {
          app.error(`Error listing units: ${error}`)
          res.status(500).json({ error: 'Failed to list units' })
        }
      })

      /**
       * GET /created - Get paths created by this plugin
       */
      router.get('/created', (req: Request, res: Response) => {
        try {
          const created = pathManager.getCreatedPaths()
          res.json(created)
        } catch (error) {
          app.error(`Error listing created paths: ${error}`)
          res.status(500).json({ error: 'Failed to list created paths' })
        }
      })

      app.debug('API routes registered')
    }
  }

  return plugin
}
