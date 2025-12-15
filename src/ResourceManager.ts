/**
 * ResourceManager - Handles saving/loading what-if scenarios using SignalK Resources API
 */

import { ServerAPI } from './types'
import { randomUUID } from 'crypto'

const RESOURCE_TYPE = 'notes'

export interface WhatIfScenario {
  name: string
  description?: string
  paths: ScenarioPath[]
  createdAt: string
  updatedAt?: string
}

export interface ScenarioPath {
  path: string
  value: any
  meta?: {
    units?: string
    description?: string
  }
  enablePut?: boolean
}

export interface SavedScenario extends WhatIfScenario {
  id: string
}

export class ResourceManager {
  private app: ServerAPI

  constructor(app: ServerAPI) {
    this.app = app
  }

  /**
   * Generate a unique UUID for a scenario
   * SignalK Resources API requires valid UUIDs
   */
  private generateId(): string {
    return randomUUID()
  }

  /**
   * Check if a note belongs to our plugin (has whatIfScenario in properties)
   */
  private isOurNote(note: any): boolean {
    return note?.properties?.whatIfScenario !== undefined
  }

  /**
   * Get current vessel position from SignalK
   */
  private getVesselPosition(): { latitude: number; longitude: number } {
    try {
      const pos = (this.app as any).getSelfPath('navigation.position.value')
      if (pos && typeof pos.latitude === 'number' && typeof pos.longitude === 'number') {
        return { latitude: pos.latitude, longitude: pos.longitude }
      }
    } catch (_e) {
      // Fall through to default
    }
    // Default position if not available
    return { latitude: 0, longitude: 0 }
  }

  /**
   * Save a what-if scenario
   */
  async saveScenario(scenario: WhatIfScenario): Promise<string> {
    const resourcesApi = (this.app as any).resourcesApi

    if (!resourcesApi) {
      throw new Error('Resources API not available')
    }

    const id = this.generateId()
    const now = new Date().toISOString()

    const noteData = {
      name: scenario.name,
      description: scenario.description || `What-If scenario with ${scenario.paths.length} paths`,
      mimeType: 'application/json',
      // Notes resource requires position - use current vessel position
      position: this.getVesselPosition(),
      // Store our scenario data in a custom property
      properties: {
        whatIfScenario: {
          ...scenario,
          createdAt: now,
          updatedAt: now
        }
      }
    }

    this.app.debug(`ResourceManager: Saving scenario ${id}: ${scenario.name}`)

    try {
      await resourcesApi.setResource(RESOURCE_TYPE, id, noteData)
      this.app.debug(`ResourceManager: Scenario saved successfully`)
      return id
    } catch (error) {
      this.app.error(`ResourceManager: Failed to save scenario: ${error}`)
      throw error
    }
  }

  /**
   * Get all saved scenarios
   */
  async listScenarios(): Promise<SavedScenario[]> {
    const resourcesApi = (this.app as any).resourcesApi

    if (!resourcesApi) {
      throw new Error('Resources API not available')
    }

    try {
      const notes = await resourcesApi.listResources(RESOURCE_TYPE, {})
      const scenarios: SavedScenario[] = []

      if (notes && typeof notes === 'object') {
        for (const [id, note] of Object.entries(notes as Record<string, any>)) {
          if (this.isOurNote(note)) {
            scenarios.push({
              id,
              ...note.properties.whatIfScenario
            })
          }
        }
      }

      // Sort by creation date, newest first
      scenarios.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      this.app.debug(`ResourceManager: Found ${scenarios.length} scenarios`)
      return scenarios
    } catch (error) {
      this.app.error(`ResourceManager: Failed to list scenarios: ${error}`)
      return []
    }
  }

  /**
   * Get a specific scenario
   */
  async getScenario(id: string): Promise<SavedScenario | null> {
    const resourcesApi = (this.app as any).resourcesApi

    if (!resourcesApi) {
      throw new Error('Resources API not available')
    }

    try {
      const note = await resourcesApi.getResource(RESOURCE_TYPE, id)

      if (this.isOurNote(note)) {
        return {
          id,
          ...note.properties.whatIfScenario
        }
      }

      return null
    } catch (_error) {
      this.app.debug(`ResourceManager: Scenario not found: ${id}`)
      return null
    }
  }

  /**
   * Update a scenario
   */
  async updateScenario(id: string, scenario: Partial<WhatIfScenario>): Promise<void> {
    const resourcesApi = (this.app as any).resourcesApi

    if (!resourcesApi) {
      throw new Error('Resources API not available')
    }

    const existing = await this.getScenario(id)
    if (!existing) {
      throw new Error('Scenario not found')
    }

    const updated = {
      ...existing,
      ...scenario,
      updatedAt: new Date().toISOString()
    }

    const noteData = {
      name: updated.name,
      description: updated.description || `What-If scenario with ${updated.paths.length} paths`,
      mimeType: 'application/json',
      // Notes resource requires position - use current vessel position
      position: this.getVesselPosition(),
      properties: {
        whatIfScenario: updated
      }
    }

    this.app.debug(`ResourceManager: Updating scenario ${id}`)

    try {
      await resourcesApi.setResource(RESOURCE_TYPE, id, noteData)
    } catch (error) {
      this.app.error(`ResourceManager: Failed to update scenario: ${error}`)
      throw error
    }
  }

  /**
   * Delete a scenario
   */
  async deleteScenario(id: string): Promise<boolean> {
    const resourcesApi = (this.app as any).resourcesApi

    if (!resourcesApi) {
      throw new Error('Resources API not available')
    }

    // First verify this is our scenario
    const scenario = await this.getScenario(id)
    if (!scenario) {
      return false
    }

    this.app.debug(`ResourceManager: Deleting scenario ${id}`)

    try {
      await resourcesApi.deleteResource(RESOURCE_TYPE, id)
      return true
    } catch (error) {
      this.app.error(`ResourceManager: Failed to delete scenario: ${error}`)
      return false
    }
  }

  /**
   * Check if Resources API is available
   */
  isAvailable(): boolean {
    return !!(this.app as any).resourcesApi
  }
}
