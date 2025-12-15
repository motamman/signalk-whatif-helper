/**
 * app-api.js - API fetch layer
 */

/**
 * Fetch all paths from the server
 */
async function fetchPaths(filter = {}) {
  const params = new URLSearchParams()

  if (filter.search) params.append('search', filter.search)
  if (filter.hasValue) params.append('hasValue', 'true')
  if (filter.hasMeta) params.append('hasMeta', 'true')
  if (filter.baseUnit) params.append('baseUnit', filter.baseUnit)

  const url = params.toString()
    ? `${API_BASE}/paths?${params.toString()}`
    : `${API_BASE}/paths`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch paths: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Fetch a single path's details
 */
async function fetchPath(path) {
  const response = await fetch(`${API_BASE}/paths/${encodeURIComponent(path)}`)

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    throw new Error(`Failed to fetch path: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Set a value on a path
 */
async function setValue(path, value, source) {
  const body = { value }
  if (source) {
    body.source = source
  }

  const response = await fetch(`${API_BASE}/value/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || 'Failed to set value')
  }

  return response.json()
}

/**
 * Send a PUT request to SignalK (via the standard PUT API)
 */
async function putValue(path, value) {
  // Use the standard SignalK PUT endpoint
  const response = await fetch(`/signalk/v1/api/vessels/self/${path.replace(/\./g, '/')}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.message || error.error || 'PUT request failed')
  }

  return response.json()
}

/**
 * Create a new path
 */
async function createPath(path, value, meta, enablePut) {
  const response = await fetch(`${API_BASE}/paths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, value, meta, enablePut })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || 'Failed to create path')
  }

  return response.json()
}

/**
 * Fetch all PUT handlers
 */
async function fetchPutHandlers() {
  const response = await fetch(`${API_BASE}/puts`)

  if (!response.ok) {
    throw new Error(`Failed to fetch PUT handlers: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Register a PUT handler
 */
async function registerPutHandler(path, options = {}) {
  const response = await fetch(`${API_BASE}/puts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, options })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || 'Failed to register PUT handler')
  }

  return response.json()
}

/**
 * Unregister a PUT handler
 */
async function unregisterPutHandler(path) {
  const response = await fetch(`${API_BASE}/puts/${encodeURIComponent(path)}`, {
    method: 'DELETE'
  })

  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || 'Failed to unregister PUT handler')
  }

  return true
}

/**
 * Fetch available units
 */
async function fetchUnits() {
  const response = await fetch(`${API_BASE}/units`)

  if (!response.ok) {
    throw new Error(`Failed to fetch units: ${response.statusText}`)
  }

  return response.json()
}

// ============================================
// SCENARIO API FUNCTIONS
// ============================================

/**
 * Fetch all saved scenarios
 */
async function fetchScenarios() {
  const response = await fetch(`${API_BASE}/scenarios`)

  if (!response.ok) {
    if (response.status === 503) {
      return { unavailable: true, scenarios: [] }
    }
    throw new Error(`Failed to fetch scenarios: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Fetch a specific scenario
 */
async function fetchScenario(id) {
  const response = await fetch(`${API_BASE}/scenarios/${encodeURIComponent(id)}`)

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    throw new Error(`Failed to fetch scenario: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Save a new scenario
 */
async function saveScenario(name, description, paths) {
  const response = await fetch(`${API_BASE}/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, paths, createdAt: new Date().toISOString() })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || 'Failed to save scenario')
  }

  return response.json()
}

/**
 * Update a scenario
 */
async function updateScenario(id, updates) {
  const response = await fetch(`${API_BASE}/scenarios/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || 'Failed to update scenario')
  }

  return response.json()
}

/**
 * Delete a scenario
 */
async function deleteScenario(id) {
  const response = await fetch(`${API_BASE}/scenarios/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })

  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || 'Failed to delete scenario')
  }

  return true
}

/**
 * Run a saved scenario
 */
async function runScenario(id) {
  const response = await fetch(`${API_BASE}/scenarios/${encodeURIComponent(id)}/run`, {
    method: 'POST'
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || 'Failed to run scenario')
  }

  return response.json()
}
