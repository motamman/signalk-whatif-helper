/**
 * app-main.js - Main application initialization
 */

/**
 * Initialize WebSocket connection
 */
function initWebSocket() {
  const statusEl = document.getElementById('ws-status')
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}${WS_PATH}`

  try {
    wsConnection = new WebSocket(wsUrl)

    wsConnection.onopen = () => {
      console.log('WebSocket connected')
      statusEl.textContent = 'Connected'
      statusEl.className = 'status connected'

      // Clear reconnect timeout
      if (wsReconnectTimeout) {
        clearTimeout(wsReconnectTimeout)
        wsReconnectTimeout = null
      }

      // Subscribe to all paths initially
      wsConnection.send(JSON.stringify({
        type: 'subscribe',
        paths: ['*']
      }))
    }

    wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleWSMessage(data)
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    wsConnection.onclose = () => {
      console.log('WebSocket disconnected')
      statusEl.textContent = 'Disconnected'
      statusEl.className = 'status disconnected'

      // Attempt reconnection
      scheduleReconnect()
    }

    wsConnection.onerror = (error) => {
      console.error('WebSocket error:', error)
      statusEl.textContent = 'Error'
      statusEl.className = 'status disconnected'
    }
  } catch (error) {
    console.error('Failed to create WebSocket:', error)
    statusEl.textContent = 'Error'
    statusEl.className = 'status disconnected'
    scheduleReconnect()
  }
}

/**
 * Schedule WebSocket reconnection
 */
function scheduleReconnect() {
  if (wsReconnectTimeout) {
    return
  }

  wsReconnectTimeout = setTimeout(() => {
    wsReconnectTimeout = null
    console.log('Attempting WebSocket reconnection...')
    initWebSocket()
  }, 5000)
}

/**
 * Handle incoming WebSocket messages
 */
function handleWSMessage(data) {
  // Update paths list with new values
  if (data.type === 'update' && data.path) {
    const idx = allPaths.findIndex(p => p.path === data.path.path)
    if (idx !== -1) {
      allPaths[idx] = { ...allPaths[idx], ...data.path }
      // Only re-render if path is visible
      if (filteredPaths.some(p => p.path === data.path.path)) {
        renderPaths()
      }
    }
  }

  // Handle full update
  if (data.type === 'full' && data.paths) {
    // Merge with existing paths
    data.paths.forEach(newPath => {
      const idx = allPaths.findIndex(p => p.path === newPath.path)
      if (idx !== -1) {
        allPaths[idx] = { ...allPaths[idx], ...newPath }
      }
    })
    applyFilters()
  }

  // Forward to editor handler
  handleEditorWSMessage(data)
}

/**
 * Initialize the application
 */
async function init() {
  console.log('Initializing What-If Helper...')

  // Setup UI components
  setupTabs()
  setupPathBrowser()
  setupEditor()
  setupCreateForm()
  setupPutHandlers()
  setupScenarios()

  // Load initial data
  await Promise.all([
    loadPaths(),
    loadPutHandlers(),
    loadUnits(),
    loadScenarios()
  ])

  // Populate unit filter
  populateUnitFilter()

  // Initialize WebSocket
  initWebSocket()

  console.log('What-If Helper initialized')
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init)
