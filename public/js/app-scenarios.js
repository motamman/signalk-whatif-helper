/**
 * app-scenarios.js - Scenarios management functionality
 */

let scenarios = []
let resourcesAvailable = true
let editingScenarioId = null // Track if we're editing an existing scenario

/**
 * Load saved scenarios
 */
async function loadScenarios() {
  const listEl = document.getElementById('scenarios-list')
  listEl.innerHTML = '<p>Loading scenarios...</p>'

  try {
    const result = await fetchScenarios()

    if (result.unavailable) {
      resourcesAvailable = false
      listEl.innerHTML = '<p class="warning">Resources API not available. Scenarios require SignalK v2 with Resources API enabled.</p>'
      return
    }

    scenarios = Array.isArray(result) ? result : []
    renderScenarios()
  } catch (error) {
    console.error('Error loading scenarios:', error)
    listEl.innerHTML = `<p class="error">Error loading scenarios: ${error.message}</p>`
  }
}

/**
 * Render the scenarios list
 */
function renderScenarios() {
  const listEl = document.getElementById('scenarios-list')

  if (scenarios.length === 0) {
    listEl.innerHTML = '<p>No saved scenarios. Create paths and save them as a scenario to replay later.</p>'
    return
  }

  const html = scenarios.map(scenario => `
    <div class="scenario-item" data-id="${scenario.id}">
      <div class="scenario-info">
        <div class="scenario-name">${escapeHtml(scenario.name)}</div>
        <div class="scenario-meta">
          ${scenario.paths.length} path${scenario.paths.length !== 1 ? 's' : ''}
          &bull; Created ${formatDate(scenario.createdAt)}
        </div>
        ${scenario.description ? `<div class="scenario-description">${escapeHtml(scenario.description)}</div>` : ''}
      </div>
      <div class="scenario-actions">
        <button class="btn btn-primary btn-run" data-id="${scenario.id}">Run</button>
        <button class="btn btn-secondary btn-edit" data-id="${scenario.id}">Edit</button>
        <button class="btn btn-danger btn-delete" data-id="${scenario.id}">Delete</button>
      </div>
    </div>
  `).join('')

  listEl.innerHTML = html

  // Add event listeners
  listEl.querySelectorAll('.btn-run').forEach(btn => {
    btn.addEventListener('click', () => handleRunScenario(btn.dataset.id))
  })
  listEl.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => handleEditScenario(btn.dataset.id))
  })
  listEl.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteScenario(btn.dataset.id))
  })
}

/**
 * Handle run scenario
 */
async function handleRunScenario(id) {
  const scenario = scenarios.find(s => s.id === id)
  if (!scenario) return

  if (!confirm(`Run scenario "${scenario.name}"? This will apply ${scenario.paths.length} path(s).`)) {
    return
  }

  try {
    const result = await runScenario(id)
    showStatus(`Scenario "${scenario.name}" applied: ${result.applied} succeeded, ${result.failed} failed`,
      result.failed > 0 ? 'warning' : 'success')

    // Refresh paths list
    loadPaths()
  } catch (error) {
    console.error('Error running scenario:', error)
    showStatus(error.message, 'error')
  }
}

/**
 * Handle edit scenario - populate form with scenario data
 */
function handleEditScenario(id) {
  const scenario = scenarios.find(s => s.id === id)
  if (!scenario) return

  // Set editing state
  editingScenarioId = id

  // Populate form fields
  document.getElementById('scenario-name').value = scenario.name
  document.getElementById('scenario-description').value = scenario.description || ''

  // Convert paths to text format
  const pathsText = scenario.paths.map(p => {
    let line = `${p.path}: ${JSON.stringify(p.value)}`
    if (p.meta?.units) line += ` units=${p.meta.units}`
    if (p.meta?.description) line += ` description="${p.meta.description}"`
    if (p.enablePut) line += ' PUT'
    return line
  }).join('\n')

  document.getElementById('scenario-paths').value = pathsText

  // Update form button text
  updateFormButtonText()

  // Scroll to form
  document.getElementById('save-scenario-form').scrollIntoView({ behavior: 'smooth' })

  showStatus(`Editing scenario "${scenario.name}"`, 'info')
}

/**
 * Update form UI based on editing state
 */
function updateFormButtonText() {
  const submitBtn = document.querySelector('#save-scenario-form button[type="submit"]')
  const cancelBtn = document.getElementById('cancel-edit-btn')
  const title = document.getElementById('scenario-form-title')

  if (submitBtn) {
    submitBtn.textContent = editingScenarioId ? 'Update Scenario' : 'Save Scenario'
  }
  if (cancelBtn) {
    cancelBtn.style.display = editingScenarioId ? 'inline-block' : 'none'
  }
  if (title) {
    title.textContent = editingScenarioId ? 'Edit Scenario' : 'Save New Scenario'
  }
}

/**
 * Cancel editing and reset form
 */
function cancelEdit() {
  editingScenarioId = null
  document.getElementById('scenario-name').value = ''
  document.getElementById('scenario-description').value = ''
  document.getElementById('scenario-paths').value = ''
  updateFormButtonText()
}

/**
 * Handle delete scenario
 */
async function handleDeleteScenario(id) {
  const scenario = scenarios.find(s => s.id === id)
  if (!scenario) return

  if (!confirm(`Delete scenario "${scenario.name}"?`)) {
    return
  }

  try {
    await deleteScenario(id)
    showStatus(`Scenario "${scenario.name}" deleted`, 'success')
    await loadScenarios()
  } catch (error) {
    console.error('Error deleting scenario:', error)
    showStatus(error.message, 'error')
  }
}

/**
 * Handle save/update scenario
 */
async function handleSaveScenario(event) {
  event.preventDefault()

  const nameInput = document.getElementById('scenario-name')
  const descInput = document.getElementById('scenario-description')
  const name = nameInput.value.trim()
  const description = descInput.value.trim()

  if (!name) {
    showStatus('Scenario name is required', 'error')
    return
  }

  // Get paths to save - collect from the create form or use selected paths
  const pathsToSave = collectPathsForScenario()

  if (pathsToSave.length === 0) {
    showStatus('No paths to save. Enter paths in the text area.', 'error')
    return
  }

  try {
    if (editingScenarioId) {
      // Update existing scenario
      await updateScenario(editingScenarioId, {
        name,
        description,
        paths: pathsToSave
      })
      showStatus(`Scenario "${name}" updated with ${pathsToSave.length} path(s)`, 'success')
    } else {
      // Create new scenario
      await saveScenario(name, description, pathsToSave)
      showStatus(`Scenario "${name}" saved with ${pathsToSave.length} path(s)`, 'success')
    }

    // Reset form and editing state
    cancelEdit()

    // Reload scenarios
    await loadScenarios()
    await loadCreateScenarios()
  } catch (error) {
    console.error('Error saving scenario:', error)
    showStatus(error.message, 'error')
  }
}

/**
 * Collect paths for scenario from the input
 * Format: path: value [units=unit] [PUT]
 * Example: tanks.fuel.0.currentLevel: 0.5 units=ratio PUT
 */
function collectPathsForScenario() {
  const pathsInput = document.getElementById('scenario-paths')
  const pathsText = pathsInput.value.trim()

  if (!pathsText) {
    return []
  }

  const paths = []
  const lines = pathsText.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const path = trimmed.substring(0, colonIndex).trim()
    let rest = trimmed.substring(colonIndex + 1).trim()

    // Check for PUT flag
    const enablePut = rest.toUpperCase().includes(' PUT')
    if (enablePut) {
      rest = rest.replace(/\s+PUT\b/gi, '').trim()
    }

    // Check for units=xxx
    let units = null
    const unitsMatch = rest.match(/\s+units=(\S+)/i)
    if (unitsMatch) {
      units = unitsMatch[1]
      rest = rest.replace(/\s+units=\S+/gi, '').trim()
    }

    // Check for description="xxx"
    let description = null
    const descMatch = rest.match(/\s+description="([^"]+)"/i)
    if (descMatch) {
      description = descMatch[1]
      rest = rest.replace(/\s+description="[^"]+"/gi, '').trim()
    }

    try {
      const value = parseValue(rest)
      const pathConfig = { path, value }

      // Add meta if units or description specified
      if (units || description) {
        pathConfig.meta = {}
        if (units) pathConfig.meta.units = units
        if (description) pathConfig.meta.description = description
      }

      // Add PUT flag
      if (enablePut) {
        pathConfig.enablePut = true
      }

      paths.push(pathConfig)
    } catch (e) {
      console.warn(`Invalid value for path ${path}: ${rest}`)
    }
  }

  return paths
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown'
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Setup scenarios event listeners
 */
function setupScenarios() {
  const form = document.getElementById('save-scenario-form')
  if (form) {
    form.addEventListener('submit', handleSaveScenario)
  }
}
