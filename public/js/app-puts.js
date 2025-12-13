/**
 * app-puts.js - PUT handler management functionality
 */

/**
 * Load PUT handlers from server
 */
async function loadPutHandlers() {
  try {
    putHandlers = await fetchPutHandlers()
    renderPutHandlers()
  } catch (error) {
    console.error('Error loading PUT handlers:', error)
    showStatus('Failed to load PUT handlers', 'error')
  }
}

/**
 * Render the PUT handlers list
 */
function renderPutHandlers() {
  const listEl = document.getElementById('put-handlers-list')

  if (putHandlers.length === 0) {
    listEl.innerHTML = `
      <li class="empty-state">
        <p>No PUT handlers registered</p>
      </li>
    `
    return
  }

  listEl.innerHTML = putHandlers.map(h => `
    <li class="handler-item">
      <span class="handler-path">${escapeHtml(h.path)}</span>
      <div class="handler-actions">
        <button class="btn-small btn-secondary" onclick="testPutHandler('${escapeHtml(h.path)}')">Test</button>
        <button class="btn-small btn-danger" onclick="removePutHandler('${escapeHtml(h.path)}')">Remove</button>
      </div>
    </li>
  `).join('')
}

/**
 * Handle register PUT handler button
 */
async function handleRegisterPut() {
  const pathInput = document.getElementById('put-path-input')
  const path = pathInput.value.trim()

  if (!path) {
    showStatus('Path is required', 'error')
    return
  }

  try {
    await registerPutHandler(path, { acceptAllSources: true })
    showStatus(`PUT handler registered for ${path}`, 'success')

    pathInput.value = ''
    await loadPutHandlers()

    // Refresh paths to show PUT badge
    await loadPaths()
  } catch (error) {
    console.error('Error registering PUT handler:', error)
    showStatus(error.message, 'error')
  }
}

/**
 * Remove a PUT handler
 */
async function removePutHandler(path) {
  if (!confirm(`Remove PUT handler for ${path}?`)) {
    return
  }

  try {
    await unregisterPutHandler(path)
    showStatus(`PUT handler removed for ${path}`, 'success')

    await loadPutHandlers()

    // Refresh paths to remove PUT badge
    await loadPaths()
  } catch (error) {
    console.error('Error removing PUT handler:', error)
    showStatus(error.message, 'error')
  }
}

/**
 * Test a PUT handler by opening the editor
 */
function testPutHandler(path) {
  selectPath(path)
  switchTab('editor')
  showStatus(`Selected ${path} for testing. Use the PUT Value button.`, 'info')
}

/**
 * Setup PUT handlers event listeners
 */
function setupPutHandlers() {
  document.getElementById('btn-register-put').addEventListener('click', handleRegisterPut)

  // Allow Enter key to register
  document.getElementById('put-path-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleRegisterPut()
    }
  })
}
