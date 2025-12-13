/**
 * PathManager - Handles path listing, value setting, and path creation
 */

import { ServerAPI, PathInfo, PathMeta, PathFilter } from './types'

const PLUGIN_ID = 'signalk-whatif-helper'
const SOURCE_LABEL = 'whatif-helper'

export class PathManager {
  private app: ServerAPI
  private createdPaths: Map<string, PathMeta> = new Map()
  private selfContext: string = 'vessels.self'

  constructor(app: ServerAPI) {
    this.app = app
    this.initSelfContext()
  }

  /**
   * Get the proper vessel context (URN) for deltas
   */
  private initSelfContext(): void {
    try {
      const selfId = (this.app as any).selfId
      if (selfId) {
        this.selfContext = `vessels.${selfId}`
        this.app.debug(`PathManager: Using context ${this.selfContext}`)
      } else {
        this.app.debug(`PathManager: No selfId found, using 'vessels.self'`)
      }
    } catch (e) {
      this.app.debug(`PathManager: Error getting selfId: ${e}`)
    }
  }

  /**
   * Get all paths from SignalK data model
   */
  async getAllPaths(filter?: PathFilter): Promise<PathInfo[]> {
    const paths: PathInfo[] = []

    try {
      // Try direct app API first - use multiple approaches
      let vesselData = null

      // Method 1: getPath with full path
      if ((this.app as any).getPath) {
        vesselData = (this.app as any).getPath('vessels.self')
        this.app.debug(`PathManager: getPath('vessels.self') returned: ${!!vesselData}`)
      }

      // Method 2: getSelfPath with no argument
      if (!vesselData) {
        try {
          vesselData = this.app.getSelfPath('')
          this.app.debug(`PathManager: getSelfPath('') returned: ${!!vesselData}`)
        } catch (e) {
          this.app.debug(`PathManager: getSelfPath('') threw: ${e}`)
        }
      }

      // Method 3: Try streambundle
      if (!vesselData && this.app.streambundle) {
        this.app.debug(`PathManager: streambundle available but not used for listing`)
      }

      this.app.debug(`PathManager: vesselData available: ${!!vesselData}`)

      if (vesselData && typeof vesselData === 'object') {
        this.extractPaths(vesselData, '', paths)
        this.app.debug(`PathManager: Extracted ${paths.length} paths from app API`)
      }

      // If no paths found, try HTTP API fallback
      if (paths.length === 0) {
        this.app.debug('PathManager: Falling back to HTTP API')
        await this.fetchPathsFromAPI(paths)
      }
    } catch (error) {
      this.app.error(`PathManager: Error getting paths: ${error}`)
      // Try HTTP API as fallback
      await this.fetchPathsFromAPI(paths)
    }

    // Apply filters if provided
    let filtered = paths

    if (filter) {
      if (filter.search) {
        const searchLower = filter.search.toLowerCase()
        filtered = filtered.filter(p =>
          p.path.toLowerCase().includes(searchLower)
        )
      }

      if (filter.hasValue === true) {
        filtered = filtered.filter(p =>
          p.value !== null && p.value !== undefined
        )
      }

      if (filter.hasMeta === true) {
        filtered = filtered.filter(p => p.meta !== undefined)
      }

      if (filter.baseUnit) {
        filtered = filtered.filter(p =>
          p.meta?.units === filter.baseUnit
        )
      }
    }

    // Sort by path name
    filtered.sort((a, b) => a.path.localeCompare(b.path))

    return filtered
  }

  /**
   * Fetch paths from SignalK HTTP API
   */
  private async fetchPathsFromAPI(paths: PathInfo[]): Promise<void> {
    try {
      // Get server config
      let hostname = 'localhost'
      let port = 3000
      let protocol = 'http'

      const configSettings = (this.app as any).config?.settings
      if (configSettings) {
        hostname = configSettings.hostname || hostname
        port = configSettings.port || port
        protocol = configSettings.ssl ? 'https' : protocol
      }

      const apiUrl = `${protocol}://${hostname}:${port}/signalk/v1/api/vessels/self`

      this.app.debug(`PathManager: Fetching from ${apiUrl}`)

      const response = await fetch(apiUrl)

      if (!response.ok) {
        this.app.error(`PathManager: HTTP API failed: ${response.statusText}`)
        return
      }

      const data = await response.json()
      this.extractPaths(data, '', paths)
      this.app.debug(`PathManager: Extracted ${paths.length} paths from HTTP API`)
    } catch (error) {
      this.app.error(`PathManager: HTTP API error: ${error}`)
    }
  }

  /**
   * Recursively extract paths from nested SignalK data
   */
  private extractPaths(
    obj: any,
    currentPath: string,
    paths: PathInfo[]
  ): void {
    if (obj === null || obj === undefined) {
      return
    }

    if (typeof obj !== 'object') {
      return
    }

    // Skip special properties
    const skipProps = ['meta', 'timestamp', '$source', 'source', 'values', 'pgn', 'sentence']

    // Check if this object has a value property (it's a leaf node)
    if ('value' in obj) {
      const pathInfo: PathInfo = {
        path: currentPath,
        value: obj.value,
        timestamp: obj.timestamp,
        source: obj.$source || obj.source?.label
      }

      // Check for metadata
      if (obj.meta) {
        pathInfo.meta = obj.meta
      }

      // Check if we have custom metadata for this path
      const customMeta = this.createdPaths.get(currentPath)
      if (customMeta) {
        pathInfo.meta = { ...pathInfo.meta, ...customMeta }
      }

      paths.push(pathInfo)
    }

    // Recurse into nested objects
    for (const key of Object.keys(obj)) {
      if (skipProps.includes(key)) continue
      if (key === 'value') continue // Don't recurse into value

      const child = obj[key]
      if (child && typeof child === 'object') {
        const newPath = currentPath ? `${currentPath}.${key}` : key
        this.extractPaths(child, newPath, paths)
      }
    }
  }

  /**
   * Get a single path's details
   */
  async getPath(path: string): Promise<PathInfo | null> {
    const data = this.app.getSelfPath(path)

    if (data === undefined) {
      return null
    }

    const pathInfo: PathInfo = {
      path,
      value: typeof data === 'object' && 'value' in data ? data.value : data,
      timestamp: data?.timestamp,
      source: data?.$source || data?.source?.label
    }

    // Get metadata
    const metaPath = this.app.getSelfPath(`${path}.meta`)
    if (metaPath) {
      pathInfo.meta = metaPath
    }

    // Check for custom metadata
    const customMeta = this.createdPaths.get(path)
    if (customMeta) {
      pathInfo.meta = { ...pathInfo.meta, ...customMeta }
    }

    return pathInfo
  }

  /**
   * Set a value on a path by injecting a delta
   * Source is set to provided source, or auto-generated as <original_source>.whatif-helper
   */
  async setValue(path: string, value: any, source?: string): Promise<void> {
    this.app.debug(`PathManager.setValue called: path=${path}, value=${JSON.stringify(value)}, source=${source}`)

    let sourceLabel: string

    if (source) {
      // Use the provided source directly
      sourceLabel = source
    } else {
      // Auto-generate source from current path's source
      sourceLabel = SOURCE_LABEL
      try {
        const currentData = this.app.getSelfPath(path)
        if (currentData) {
          let originalSource = currentData.$source || currentData.source?.label
          if (originalSource) {
            // Strip any existing .whatif-helper suffix(es) to get the true original source
            const whatifSuffix = `.${SOURCE_LABEL}`
            while (originalSource.endsWith(whatifSuffix)) {
              originalSource = originalSource.slice(0, -whatifSuffix.length)
            }
            // Append our plugin identifier once
            sourceLabel = `${originalSource}.${SOURCE_LABEL}`
          }
        }
      } catch (error) {
        this.app.debug(`Could not get original source for ${path}, using default`)
      }
    }

    const delta = {
      context: this.selfContext,
      updates: [{
        $source: sourceLabel,
        timestamp: new Date().toISOString(),
        values: [{
          path,
          value
        }]
      }]
    }

    this.app.debug(`Sending delta to ${this.selfContext}: ${JSON.stringify(delta)}`)
    this.app.handleMessage(PLUGIN_ID, delta as any)

    // Verify the value was set via HTTP API
    setTimeout(async () => {
      try {
        const response = await fetch(`http://localhost:3000/signalk/v1/api/vessels/self/${path.replace(/\./g, '/')}`)
        if (response.ok) {
          const data = await response.json()
          this.app.debug(`Verification HTTP: ${path} = ${JSON.stringify(data)}`)
        } else {
          this.app.debug(`Verification HTTP: ${path} returned ${response.status}`)
        }
      } catch (e) {
        this.app.debug(`Verification HTTP error: ${e}`)
      }
    }, 500)
  }

  /**
   * Create a new path with initial value and optional metadata
   */
  async createPath(
    path: string,
    value: any,
    meta?: PathMeta
  ): Promise<void> {
    this.app.debug(`Creating path ${path} with value: ${JSON.stringify(value)}`)

    // Store custom metadata
    if (meta) {
      this.createdPaths.set(path, meta)
    }

    // Inject the initial value
    await this.setValue(path, value)

    // Send metadata using the meta array format
    if (meta) {
      this.app.handleMessage(PLUGIN_ID, {
        context: this.selfContext,
        updates: [{
          $source: SOURCE_LABEL,
          timestamp: new Date().toISOString(),
          meta: [{
            path,
            value: meta
          }]
        }]
      } as any)
    }
  }

  /**
   * Get list of paths created by this plugin
   */
  getCreatedPaths(): string[] {
    return Array.from(this.createdPaths.keys())
  }

  /**
   * Check if a path was created by this plugin
   */
  isCreatedPath(path: string): boolean {
    return this.createdPaths.has(path)
  }

  /**
   * Get available base units (common SignalK units)
   */
  getAvailableUnits(): { unit: string; description: string }[] {
    return [
      { unit: 'm/s', description: 'Speed (meters per second)' },
      { unit: 'rad', description: 'Angle (radians)' },
      { unit: 'K', description: 'Temperature (kelvin)' },
      { unit: 'm', description: 'Distance (meters)' },
      { unit: 'Pa', description: 'Pressure (pascals)' },
      { unit: 'Hz', description: 'Frequency (hertz)' },
      { unit: 'V', description: 'Voltage (volts)' },
      { unit: 'A', description: 'Current (amperes)' },
      { unit: 'W', description: 'Power (watts)' },
      { unit: 'J', description: 'Energy (joules)' },
      { unit: 'C', description: 'Charge (coulombs)' },
      { unit: 'kg', description: 'Mass (kilograms)' },
      { unit: 'm3', description: 'Volume (cubic meters)' },
      { unit: 'm3/s', description: 'Flow rate (cubic meters per second)' },
      { unit: 'ratio', description: 'Ratio (0-1)' },
      { unit: 's', description: 'Time (seconds)' },
      { unit: 'bool', description: 'Boolean (true/false)' },
      { unit: '', description: 'No unit (dimensionless)' }
    ]
  }
}
