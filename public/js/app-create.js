/**
 * app-create.js - Create path functionality
 */

let isCreating = false // Prevent duplicate submissions

/**
 * Load available units into the dropdown
 */
async function loadUnits() {
  try {
    availableUnits = await fetchUnits()
    populateUnitDropdown()
  } catch (error) {
    console.error('Error loading units:', error)
  }
}

/**
 * Populate the unit dropdown
 */
function populateUnitDropdown() {
  const select = document.getElementById('create-unit')

  availableUnits.forEach(u => {
    const option = document.createElement('option')
    option.value = u.unit
    option.textContent = `${u.unit || '(none)'} - ${u.description}`
    select.appendChild(option)
  })
}

/**
 * Handle create path form submission
 */
async function handleCreatePath(event) {
  event.preventDefault()

  // Prevent duplicate submissions
  if (isCreating) {
    console.log('Create already in progress, ignoring duplicate')
    return
  }
  isCreating = true

  const path = document.getElementById('create-path').value.trim()
  const valueStr = document.getElementById('create-value').value
  const unit = document.getElementById('create-unit').value
  const description = document.getElementById('create-description').value.trim()
  const enablePut = document.getElementById('create-enable-put').checked

  // Validate path
  if (!path) {
    showStatus('Path is required', 'error')
    isCreating = false
    return
  }

  // Basic path validation (segments can be alphanumeric or purely numeric)
  if (!/^([a-zA-Z][a-zA-Z0-9]*|[0-9]+)(\.([a-zA-Z][a-zA-Z0-9]*|[0-9]+))*$/.test(path)) {
    showStatus('Invalid path format. Use dot-separated segments (alphanumeric or numeric).', 'error')
    isCreating = false
    return
  }

  const value = parseValue(valueStr)

  // Build metadata
  const meta = {}
  if (unit) meta.units = unit
  if (description) meta.description = description

  try {
    await createPath(path, value, Object.keys(meta).length > 0 ? meta : undefined, enablePut)

    showStatus(`Created path: ${path}`, 'success')

    // Reset form
    document.getElementById('create-form').reset()

    // Refresh paths list
    await loadPaths()

    // If PUT was enabled, refresh handlers
    if (enablePut) {
      await loadPutHandlers()
    }

    // Select the new path and switch to editor
    selectPath(path)
    switchTab('editor')
  } catch (error) {
    console.error('Error creating path:', error)
    showStatus(error.message, 'error')
  } finally {
    isCreating = false
  }
}

/**
 * Setup create form event listeners
 */
function setupCreateForm() {
  document.getElementById('create-form').addEventListener('submit', handleCreatePath)
}
