/**
 * app-state.js - Global state management
 */

// API base URL (relative to current origin for embedded webapp)
const API_BASE = '/plugins/signalk-whatif-helper'
const WS_PATH = '/plugins/signalk-whatif-helper/stream'

// Global state
let allPaths = []
let filteredPaths = []
let selectedPath = null
let putHandlers = []
let availableUnits = []
let wsConnection = null
let wsReconnectTimeout = null
