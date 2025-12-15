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
import { ResourceManager, WhatIfScenario } from './ResourceManager'

const PLUGIN_ID = 'signalk-whatif-helper'

module.exports = (app: ServerAPI): Plugin => {
  let pathManager: PathManager
  let putHandlerManager: PutHandlerManager
  let wsServer: WebSocketServer
  let resourceManager: ResourceManager

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
      resourceManager = new ResourceManager(app)

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

      // ============================================
      // SCENARIO ROUTES
      // ============================================

      /**
       * GET /scenarios - List all saved scenarios
       */
      router.get('/scenarios', async (req: Request, res: Response) => {
        try {
          if (!resourceManager.isAvailable()) {
            return res.status(503).json({ error: 'Resources API not available' })
          }
          const scenarios = await resourceManager.listScenarios()
          res.json(scenarios)
        } catch (error) {
          app.error(`Error listing scenarios: ${error}`)
          res.status(500).json({ error: 'Failed to list scenarios' })
        }
      })

      /**
       * GET /scenarios/:id - Get a specific scenario
       */
      router.get('/scenarios/:id', async (req: Request, res: Response) => {
        try {
          if (!resourceManager.isAvailable()) {
            return res.status(503).json({ error: 'Resources API not available' })
          }
          const scenario = await resourceManager.getScenario(req.params.id)
          if (!scenario) {
            return res.status(404).json({ error: 'Scenario not found' })
          }
          res.json(scenario)
        } catch (error) {
          app.error(`Error getting scenario: ${error}`)
          res.status(500).json({ error: 'Failed to get scenario' })
        }
      })

      /**
       * POST /scenarios - Save a new scenario
       */
      router.post('/scenarios', async (req: Request, res: Response) => {
        try {
          if (!resourceManager.isAvailable()) {
            return res.status(503).json({ error: 'Resources API not available' })
          }

          const body: WhatIfScenario = req.body

          if (!body.name) {
            return res.status(400).json({ error: 'Scenario name is required' })
          }
          if (!body.paths || !Array.isArray(body.paths) || body.paths.length === 0) {
            return res.status(400).json({ error: 'At least one path is required' })
          }

          const id = await resourceManager.saveScenario(body)
          res.status(201).json({ id, ...body })
        } catch (error) {
          app.error(`Error saving scenario: ${error}`)
          res.status(500).json({ error: 'Failed to save scenario' })
        }
      })

      /**
       * PUT /scenarios/:id - Update a scenario
       */
      router.put('/scenarios/:id', async (req: Request, res: Response) => {
        try {
          if (!resourceManager.isAvailable()) {
            return res.status(503).json({ error: 'Resources API not available' })
          }

          await resourceManager.updateScenario(req.params.id, req.body)
          const updated = await resourceManager.getScenario(req.params.id)
          res.json(updated)
        } catch (error) {
          app.error(`Error updating scenario: ${error}`)
          res.status(500).json({ error: 'Failed to update scenario' })
        }
      })

      /**
       * DELETE /scenarios/:id - Delete a scenario
       */
      router.delete('/scenarios/:id', async (req: Request, res: Response) => {
        try {
          if (!resourceManager.isAvailable()) {
            return res.status(503).json({ error: 'Resources API not available' })
          }

          const success = await resourceManager.deleteScenario(req.params.id)
          if (!success) {
            return res.status(404).json({ error: 'Scenario not found' })
          }
          res.status(204).send()
        } catch (error) {
          app.error(`Error deleting scenario: ${error}`)
          res.status(500).json({ error: 'Failed to delete scenario' })
        }
      })

      /**
       * POST /scenarios/:id/run - Run a saved scenario (apply all paths)
       */
      router.post('/scenarios/:id/run', async (req: Request, res: Response) => {
        try {
          if (!resourceManager.isAvailable()) {
            return res.status(503).json({ error: 'Resources API not available' })
          }

          const scenario = await resourceManager.getScenario(req.params.id)
          if (!scenario) {
            return res.status(404).json({ error: 'Scenario not found' })
          }

          app.debug(`Running scenario "${scenario.name}" with ${scenario.paths.length} paths`)

          // Apply all paths in the scenario
          const results: {
            path: string
            success: boolean
            putRegistered?: boolean
            error?: string
          }[] = []

          for (const pathConfig of scenario.paths) {
            app.debug(`Applying path: ${pathConfig.path} = ${JSON.stringify(pathConfig.value)}`)
            try {
              await pathManager.createPath(pathConfig.path, pathConfig.value, pathConfig.meta)

              // Register PUT handler if specified
              let putRegistered = false
              if (pathConfig.enablePut && !putHandlerManager.hasPutHandler(pathConfig.path)) {
                putHandlerManager.registerHandler(pathConfig.path, { acceptAllSources: true })
                putRegistered = true
              }

              results.push({ path: pathConfig.path, success: true, putRegistered })
            } catch (err) {
              results.push({
                path: pathConfig.path,
                success: false,
                error: String(err)
              })
            }
          }

          res.json({
            scenario: scenario.name,
            applied: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            putsRegistered: results.filter((r) => r.putRegistered).length,
            results
          })
        } catch (error) {
          app.error(`Error running scenario: ${error}`)
          res.status(500).json({ error: 'Failed to run scenario' })
        }
      })

      app.debug('API routes registered')
    }
  }

  return plugin
}
