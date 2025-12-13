/**
 * app-editor.js - Value editor functionality
 */

/**
 * Load the editor for the selected path
 */
async function loadEditor() {
  const emptyEl = document.getElementById('editor-empty')
  const contentEl = document.getElementById('editor-content')

  if (!selectedPath) {
    emptyEl.style.display = 'block'
    contentEl.style.display = 'none'
    return
  }

  emptyEl.style.display = 'none'
  contentEl.style.display = 'block'

  // Set path
  document.getElementById('editor-path').value = selectedPath

  // Clear previous values
  document.getElementById('editor-new-value').value = ''
  document.getElementById('editor-source').value = ''

  // Load path details
  try {
    const pathInfo = await fetchPath(selectedPath)

    if (pathInfo) {
      updateEditorDisplay(pathInfo)
    } else {
      document.getElementById('editor-current-value').textContent = 'Path not found'
    }
  } catch (error) {
    console.error('Error loading path:', error)
    document.getElementById('editor-current-value').textContent = 'Error loading path'
  }

  // Subscribe to updates for this path
  subscribeToPath(selectedPath)
}

/**
 * Update the editor display with path info
 */
function updateEditorDisplay(pathInfo) {
  // Current value
  document.getElementById('editor-current-value').textContent = formatValue(pathInfo.value)

  // Metadata
  const metaEl = document.getElementById('editor-meta')
  if (pathInfo.meta) {
    metaEl.style.display = 'block'
    document.getElementById('meta-units').textContent = pathInfo.meta.units || '-'
    document.getElementById('meta-description').textContent = pathInfo.meta.description || '-'
  } else {
    metaEl.style.display = 'none'
  }

  // PUT status
  const putStatusEl = document.getElementById('put-status')
  const putBtnEl = document.getElementById('btn-put-value')

  if (pathInfo.hasPutHandler) {
    putStatusEl.style.display = 'block'
    putBtnEl.style.display = 'inline-block'
  } else {
    putStatusEl.style.display = 'none'
    putBtnEl.style.display = 'none'
  }

  // Pre-fill new value with current value
  const newValueInput = document.getElementById('editor-new-value')
  if (!newValueInput.value) {
    newValueInput.value = typeof pathInfo.value === 'object'
      ? JSON.stringify(pathInfo.value)
      : String(pathInfo.value ?? '')
  }

  // Pre-fill source with current source (with .whatif-helper appended if not already present)
  const sourceInput = document.getElementById('editor-source')
  if (!sourceInput.value && pathInfo.source) {
    let source = pathInfo.source
    // If source is exactly 'whatif-helper' or ends with '.whatif-helper', keep as-is
    if (source === 'whatif-helper' || source.endsWith('.whatif-helper')) {
      sourceInput.value = source
    } else {
      // Append .whatif-helper for other sources
      sourceInput.value = source + '.whatif-helper'
    }
  }
}

/**
 * Handle set value button click
 */
async function handleSetValue() {
  const path = document.getElementById('editor-path').value
  const valueStr = document.getElementById('editor-new-value').value
  const source = document.getElementById('editor-source').value.trim()

  if (!path) {
    showStatus('No path selected', 'error')
    return
  }

  const value = parseValue(valueStr)

  try {
    await setValue(path, value, source || undefined)
    showStatus(`Value set for ${path}`, 'success')

    // Refresh the display
    const pathInfo = await fetchPath(path)
    if (pathInfo) {
      updateEditorDisplay(pathInfo)
    }

    // Refresh paths list
    loadPaths()
  } catch (error) {
    console.error('Error setting value:', error)
    showStatus(error.message, 'error')
  }
}

/**
 * Handle PUT value button click
 */
async function handlePutValue() {
  const path = document.getElementById('editor-path').value
  const valueStr = document.getElementById('editor-new-value').value

  if (!path) {
    showStatus('No path selected', 'error')
    return
  }

  const value = parseValue(valueStr)

  try {
    await putValue(path, value)
    showStatus(`PUT successful for ${path}`, 'success')

    // Refresh the display
    const pathInfo = await fetchPath(path)
    if (pathInfo) {
      updateEditorDisplay(pathInfo)
    }

    // Refresh paths list
    loadPaths()
  } catch (error) {
    console.error('Error with PUT:', error)
    showStatus(error.message, 'error')
  }
}

/**
 * Subscribe to WebSocket updates for a path
 */
function subscribeToPath(path) {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.send(JSON.stringify({
      type: 'unsubscribeAll'
    }))

    wsConnection.send(JSON.stringify({
      type: 'subscribe',
      paths: [path]
    }))
  }
}

/**
 * Handle WebSocket message for editor updates
 */
function handleEditorWSMessage(data) {
  if (data.type === 'update' && data.path && data.path.path === selectedPath) {
    document.getElementById('editor-current-value').textContent = formatValue(data.path.value)
  }

  if (data.type === 'full' && data.paths) {
    const pathInfo = data.paths.find(p => p.path === selectedPath)
    if (pathInfo) {
      document.getElementById('editor-current-value').textContent = formatValue(pathInfo.value)
    }
  }
}

/**
 * Setup editor event listeners
 */
function setupEditor() {
  document.getElementById('btn-set-value').addEventListener('click', handleSetValue)
  document.getElementById('btn-put-value').addEventListener('click', handlePutValue)

  // Allow Enter key to submit
  document.getElementById('editor-new-value').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSetValue()
    }
  })
}
