/**
 * app-create.js - Create path functionality
 */

let isCreating = false // Prevent duplicate submissions
let createScenarios = [] // Scenarios available for adding paths

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
 * Load scenarios for the create form dropdown
 */
async function loadCreateScenarios() {
  try {
    const result = await fetchScenarios()
    createScenarios = Array.isArray(result) ? result : []
    populateScenarioDropdown()
  } catch (error) {
    console.error('Error loading scenarios for create form:', error)
    createScenarios = []
  }
}

/**
 * Populate the scenario dropdown in create form
 */
function populateScenarioDropdown() {
  const select = document.getElementById('create-scenario-select')
  if (!select) return

  // Clear existing options except the first one
  while (select.options.length > 1) {
    select.remove(1)
  }

  // Add existing scenarios
  createScenarios.forEach(s => {
    const option = document.createElement('option')
    option.value = s.id
    option.textContent = `${s.name} (${s.paths.length} paths)`
    select.appendChild(option)
  })
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
  const addToScenario = document.getElementById('create-add-to-scenario').checked
  const scenarioSelect = document.getElementById('create-scenario-select').value
  const newScenarioName = document.getElementById('create-scenario-name').value.trim()

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

  // Validate scenario name if creating new
  if (addToScenario && scenarioSelect === '__new__' && !newScenarioName) {
    showStatus('Scenario name is required when creating a new scenario', 'error')
    isCreating = false
    return
  }

  try {
    await createPath(path, value, Object.keys(meta).length > 0 ? meta : undefined, enablePut)

    let statusMsg = `Created path: ${path}`

    // Add to scenario if requested
    if (addToScenario) {
      const pathConfig = {
        path,
        value,
        meta: Object.keys(meta).length > 0 ? meta : undefined,
        enablePut: enablePut || undefined
      }

      if (scenarioSelect === '__new__') {
        // Create new scenario with this path
        await saveScenario(newScenarioName, '', [pathConfig])
        statusMsg += ` and created scenario "${newScenarioName}"`
      } else {
        // Add to existing scenario
        const existing = createScenarios.find(s => s.id === scenarioSelect)
        if (existing) {
          const updatedPaths = [...existing.paths, pathConfig]
          await updateScenario(scenarioSelect, { paths: updatedPaths })
          statusMsg += ` and added to scenario "${existing.name}"`
        }
      }

      // Refresh scenarios
      await loadScenarios()
      await loadCreateScenarios()
    }

    showStatus(statusMsg, 'success')

    // Reset form (but keep scenario selection)
    document.getElementById('create-path').value = ''
    document.getElementById('create-value').value = ''
    document.getElementById('create-unit').value = ''
    document.getElementById('create-description').value = ''
    document.getElementById('create-enable-put').checked = false

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

  // Toggle scenario options visibility
  const addToScenarioCheckbox = document.getElementById('create-add-to-scenario')
  const scenarioOptions = document.getElementById('scenario-options')
  const scenarioSelect = document.getElementById('create-scenario-select')
  const scenarioNameInput = document.getElementById('create-scenario-name')

  // Helper to update scenario name input visibility
  function updateScenarioNameVisibility() {
    if (scenarioSelect && scenarioNameInput) {
      scenarioNameInput.style.display = scenarioSelect.value === '__new__' ? 'block' : 'none'
    }
  }

  if (addToScenarioCheckbox && scenarioOptions) {
    addToScenarioCheckbox.addEventListener('change', () => {
      scenarioOptions.style.display = addToScenarioCheckbox.checked ? 'block' : 'none'
      if (addToScenarioCheckbox.checked) {
        loadCreateScenarios()
        // Also update name visibility when showing the section
        updateScenarioNameVisibility()
      }
    })
  }

  // Toggle new scenario name input
  if (scenarioSelect && scenarioNameInput) {
    scenarioSelect.addEventListener('change', updateScenarioNameVisibility)
  }
}
