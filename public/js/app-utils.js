/**
 * app-utils.js - Utility functions
 */

/**
 * Show a status message toast
 */
function showStatus(message, type = 'info') {
  const el = document.getElementById('status-message')
  el.textContent = message
  el.className = `status-message ${type} show`

  setTimeout(() => {
    el.classList.remove('show')
  }, 3000)
}

/**
 * Parse a value string into the appropriate type
 */
function parseValue(str) {
  if (str === '') return ''

  // Boolean
  if (str === 'true') return true
  if (str === 'false') return false

  // Number
  const num = Number(str)
  if (!isNaN(num) && str.trim() !== '') return num

  // Try JSON
  try {
    return JSON.parse(str)
  } catch (e) {
    // Return as string
    return str
  }
}

/**
 * Format a value for display
 */
function formatValue(value) {
  if (value === null || value === undefined) {
    return '-'
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number') {
    // Format with reasonable precision
    if (Number.isInteger(value)) {
      return value.toString()
    }
    return value.toFixed(4)
  }

  return String(value)
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(ts) {
  if (!ts) return '-'

  try {
    const date = new Date(ts)
    return date.toLocaleTimeString()
  } catch (e) {
    return ts
  }
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Switch to a tab
 */
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName)
  })

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`)
  })
}

/**
 * Setup tab click handlers
 */
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab)
    })
  })
}

/**
 * Debounce function for search input
 */
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}
