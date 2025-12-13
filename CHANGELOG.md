# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-12-13

### Added

- Initial release
- **Path Browser**: Browse and filter all SignalK paths
  - Search by path name
  - Filter by has value, has metadata, base unit
  - Pagination for large datasets (100 paths per page)
  - Real-time value display
- **Value Editor**: Modify values on existing paths
  - Live value updates via WebSocket
  - Editable source field (`$source`)
  - Support for Set Value (direct injection) and PUT Value (via PUT handler)
  - Auto-generates source as `<original>.whatif-helper`
- **Path Creator**: Create new SignalK paths
  - Path validation for SignalK format (supports numeric segments)
  - Initial value with type parsing (number, boolean, JSON)
  - Metadata support (units, description)
  - Optional PUT handler registration
- **PUT Handler Management**: Register and manage PUT handlers
  - List all registered handlers
  - Register new handlers for any path
  - Unregister handlers
- **WebSocket Server**: Real-time path value updates
  - Subscribe to specific paths or all paths
  - Efficient delta streaming
- **REST API**: Full API for programmatic access
  - Path listing and filtering
  - Value injection
  - PUT handler management
- **Available Units**: Common SignalK units
  - m/s, rad, K, m, Pa, Hz, V, A, W, J, C, kg, m3, m3/s, ratio, s, bool

### Technical

- TypeScript backend with Express router integration
- Vanilla JavaScript frontend (no framework dependencies)
- WebSocket support using `ws` library with `noServer` mode
- Proper SignalK delta format with `$source` and vessel context
- HTTP API fallback when direct app API unavailable
