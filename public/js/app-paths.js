/**
 * app-paths.js - Path browser functionality
 */

// Pagination settings
const PATHS_PER_PAGE = 100
let currentPage = 0

/**
 * Load and display paths
 */
async function loadPaths() {
  const tbody = document.getElementById('paths-table-body')
  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="loading">
        <div class="spinner"></div>
        Loading paths...
      </td>
    </tr>
  `

  try {
    allPaths = await fetchPaths()
    console.log(`Loaded ${allPaths.length} paths from server`)
    currentPage = 0
    applyFilters()
  } catch (error) {
    console.error('Error loading paths:', error)
    showStatus('Failed to load paths', 'error')
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <p>Failed to load paths. <a href="#" onclick="loadPaths(); return false;">Retry</a></p>
        </td>
      </tr>
    `
  }
}

/**
 * Apply current filters to paths
 */
function applyFilters() {
  const searchTerm = document.getElementById('path-search').value.toLowerCase()
  const hasValue = document.getElementById('filter-has-value').checked
  const hasMeta = document.getElementById('filter-has-meta').checked
  const unitFilter = document.getElementById('filter-unit').value

  console.log(`Applying filters: search="${searchTerm}", hasValue=${hasValue}, hasMeta=${hasMeta}, unit="${unitFilter}"`)

  filteredPaths = allPaths.filter(p => {
    // Search filter
    if (searchTerm && !p.path.toLowerCase().includes(searchTerm)) {
      return false
    }

    // Has value filter
    if (hasValue && (p.value === null || p.value === undefined)) {
      return false
    }

    // Has metadata filter
    if (hasMeta && !p.meta) {
      return false
    }

    // Unit filter
    if (unitFilter && p.meta?.units !== unitFilter) {
      return false
    }

    return true
  })

  console.log(`Filtered to ${filteredPaths.length} paths`)
  currentPage = 0
  renderPaths()
}

/**
 * Render the paths table with pagination
 */
function renderPaths() {
  const tbody = document.getElementById('paths-table-body')
  const countEl = document.getElementById('path-count')

  const totalCount = filteredPaths.length
  const startIdx = currentPage * PATHS_PER_PAGE
  const endIdx = Math.min(startIdx + PATHS_PER_PAGE, totalCount)
  const pageCount = Math.ceil(totalCount / PATHS_PER_PAGE)

  // Update count display
  if (totalCount > PATHS_PER_PAGE) {
    countEl.textContent = `${startIdx + 1}-${endIdx} of ${totalCount}`
  } else {
    countEl.textContent = totalCount
  }

  if (totalCount === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <p>No paths found matching your filters.</p>
        </td>
      </tr>
    `
    updatePaginationButtons(0, 0)
    return
  }

  // Get current page of paths
  const pagePaths = filteredPaths.slice(startIdx, endIdx)

  tbody.innerHTML = pagePaths.map(p => {
    const hasPut = putHandlers.some(h => h.path === p.path)
    const badges = []
    if (hasPut) badges.push('<span class="badge badge-put">PUT</span>')

    return `
      <tr data-path="${escapeHtml(p.path)}" class="${selectedPath === p.path ? 'selected' : ''}">
        <td class="path-cell" onclick="selectPath('${escapeHtml(p.path)}')">${escapeHtml(p.path)}</td>
        <td class="value-cell" title="${escapeHtml(formatValue(p.value))}">${escapeHtml(formatValue(p.value))}</td>
        <td>${p.meta?.units || '-'}</td>
        <td class="source-cell">${p.source || '-'}</td>
        <td>
          ${badges.join(' ')}
          <button class="btn-small btn-secondary" onclick="selectPath('${escapeHtml(p.path)}'); switchTab('editor');">Edit</button>
        </td>
      </tr>
    `
  }).join('')

  updatePaginationButtons(currentPage, pageCount)
}

/**
 * Update pagination button visibility
 */
function updatePaginationButtons(current, total) {
  const prevBtn = document.getElementById('prev-page')
  const nextBtn = document.getElementById('next-page')

  if (prevBtn && nextBtn) {
    prevBtn.disabled = current <= 0
    nextBtn.disabled = current >= total - 1

    prevBtn.style.display = total > 1 ? 'inline-block' : 'none'
    nextBtn.style.display = total > 1 ? 'inline-block' : 'none'
  }
}

/**
 * Go to previous page
 */
function prevPage() {
  if (currentPage > 0) {
    currentPage--
    renderPaths()
  }
}

/**
 * Go to next page
 */
function nextPage() {
  const pageCount = Math.ceil(filteredPaths.length / PATHS_PER_PAGE)
  if (currentPage < pageCount - 1) {
    currentPage++
    renderPaths()
  }
}

/**
 * Select a path for editing
 */
function selectPath(path) {
  selectedPath = path
  renderPaths()
  loadEditor()
}

/**
 * Populate unit filter dropdown
 */
function populateUnitFilter() {
  const select = document.getElementById('filter-unit')

  // Get unique units from paths
  const units = new Set()
  allPaths.forEach(p => {
    if (p.meta?.units) {
      units.add(p.meta.units)
    }
  })

  // Add options
  const sortedUnits = Array.from(units).sort()
  sortedUnits.forEach(unit => {
    const option = document.createElement('option')
    option.value = unit
    option.textContent = unit
    select.appendChild(option)
  })
}

/**
 * Setup path browser event listeners
 */
function setupPathBrowser() {
  // Search input with debounce
  const searchInput = document.getElementById('path-search')
  searchInput.addEventListener('input', debounce(applyFilters, 300))

  // Filter checkboxes
  document.getElementById('filter-has-value').addEventListener('change', applyFilters)
  document.getElementById('filter-has-meta').addEventListener('change', applyFilters)
  document.getElementById('filter-unit').addEventListener('change', applyFilters)

  // Refresh button
  document.getElementById('refresh-paths').addEventListener('click', loadPaths)

  // Pagination buttons (if they exist)
  const prevBtn = document.getElementById('prev-page')
  const nextBtn = document.getElementById('next-page')
  if (prevBtn) prevBtn.addEventListener('click', prevPage)
  if (nextBtn) nextBtn.addEventListener('click', nextPage)
}
