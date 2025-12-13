# <img src="public/assets/icon_set/icon_128x128.png" width="48" height="48" align="absmiddle"> SignalK What-If Helper

A SignalK webapp dev utility for modifying, and creating SignalK paths for testing and simulation.

## Features

- **Path Browser**: List and filter all SignalK paths with real-time values
- **Value Editor**: Select any path and modify its value with custom source labels
- **Path Creator**: Create new paths with initial values, metadata, and unit definitions
- **PUT Handler Management**: Register and manage PUT handlers for paths

## Installation

### From npm (when published)

```bash
npm install signalk-whatif-helper
```

### From source

```bash
cd ~/.signalk/node_modules
git clone https://github.com/motamman/signalk-whatif-helper.git
cd signalk-whatif-helper
npm install
npm run build
```

Then restart SignalK server.

## Usage

After installation, access the webapp from the SignalK webapp menu or navigate directly to:

```
http://localhost:3000/signalk-whatif-helper/
```

### Path Browser Tab

Browse all available SignalK paths with filtering options:

- **Search**: Filter paths by name (e.g., "navigation", "tanks")
- **Has Value**: Show only paths with non-null values
- **Has Meta**: Show only paths with metadata defined
- **Base Unit**: Filter by unit type (m/s, rad, K, etc.)

Click "Edit" on any path to open it in the Value Editor.

### Value Editor Tab

Modify values for existing paths:

- **Current Value**: Displays the live value with real-time WebSocket updates
- **Metadata**: Shows units and description if available
- **New Value**: Enter a new value (supports numbers, strings, booleans, and JSON objects)
- **Source**: Customize the `$source` label (defaults to `<original_source>.whatif-helper`)
- **Set Value**: Inject the value directly into SignalK's data model
- **PUT Value**: Send via SignalK's PUT API (only available if a PUT handler is registered)

### Create Path Tab

Create new SignalK paths:

- **Path**: Enter the path name (e.g., `tanks.fuel.1.currentLevel`)
- **Initial Value**: Set the starting value
- **Base Unit**: Select from common SignalK units (ratio, m/s, K, Pa, bool, etc.)
- **Description**: Optional description for the path metadata
- **Enable PUT**: Optionally register a PUT handler for the new path

### PUT Handlers Tab

Manage PUT handlers for paths:

- View all registered PUT handlers
- Register new PUT handlers for existing paths
- Unregister PUT handlers
- Test PUT functionality

## API Endpoints

The plugin exposes the following REST API endpoints:

### Paths

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/plugins/signalk-whatif-helper/paths` | List all paths (supports query filters) |
| GET | `/plugins/signalk-whatif-helper/paths/:path` | Get single path details |
| POST | `/plugins/signalk-whatif-helper/paths` | Create a new path |
| PUT | `/plugins/signalk-whatif-helper/value/:path` | Set value on a path |

### PUT Handlers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/plugins/signalk-whatif-helper/puts` | List registered PUT handlers |
| POST | `/plugins/signalk-whatif-helper/puts` | Register a PUT handler |
| DELETE | `/plugins/signalk-whatif-helper/puts/:path` | Unregister a PUT handler |

### Utilities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/plugins/signalk-whatif-helper/units` | List available base units |
| GET | `/plugins/signalk-whatif-helper/created` | List paths created by this plugin |

### WebSocket

Connect to `/plugins/signalk-whatif-helper/stream` for real-time path value updates.

**Subscribe to paths:**
```json
{
  "type": "subscribe",
  "paths": ["navigation.speedOverGround", "tanks.fuel.0.currentLevel"]
}
```

**Unsubscribe:**
```json
{
  "type": "unsubscribe",
  "path": "navigation.speedOverGround"
}
```

## Source Labeling

When modifying values, the plugin uses a distinctive source label to identify injected data:

- For existing paths: `<original_source>.whatif-helper` (e.g., `n2k-01.whatif-helper`)
- For new paths: `whatif-helper`

This makes it easy to identify simulated/test values in SignalK's data model.

## Use Cases

### Testing Instrument Displays

Inject specific values to test how your instrument displays handle edge cases:

```javascript
// Test speedometer at maximum
PUT /plugins/signalk-whatif-helper/value/navigation.speedOverGround
{ "value": 25.72 }  // ~50 knots
```

### Simulating Sensor Data

Create virtual sensors for development:

```javascript
// Create a virtual tank sensor
POST /plugins/signalk-whatif-helper/paths
{
  "path": "tanks.fuel.virtual.currentLevel",
  "value": 0.75,
  "meta": { "units": "ratio", "description": "Virtual fuel tank" },
  "enablePut": true
}
```

### Integration Testing

Test how your SignalK consumers react to specific data patterns without needing physical sensors.

## Data Persistence

**Important**: Values injected by this plugin are ephemeral and will not persist across SignalK server restarts. This is by design for testing and simulation purposes.

## Development

### Build from source

```bash
npm install
npm run build
```

### Watch mode

```bash
npm run dev
```

### Project Structure

```
signalk-whatif-helper/
├── src/
│   ├── index.ts           # Plugin entry point
│   ├── types.ts           # TypeScript interfaces
│   ├── PathManager.ts     # Path operations
│   ├── PutHandlerManager.ts # PUT handler management
│   └── WebSocketServer.ts # Real-time updates
├── public/
│   ├── index.html         # Webapp UI
│   └── js/
│       ├── app-main.js    # Initialization
│       ├── app-api.js     # API layer
│       ├── app-state.js   # State management
│       ├── app-utils.js   # Utilities
│       ├── app-paths.js   # Path browser
│       ├── app-editor.js  # Value editor
│       ├── app-create.js  # Path creation
│       └── app-puts.js    # PUT handlers
└── dist/                  # Compiled JavaScript
```

## Requirements

- SignalK Server v1.x or v2.x
- Node.js 16+

## License

MIT License - see [LICENSE](LICENSE) file.

## Author

Maurice Tamman <maurice@zennora.sv>

## Contributing

Contributions are welcome! Please open an issue or submit a pull request at:
https://github.com/motamman/signalk-whatif-helper

## Support

For bugs and feature requests, please use the [GitHub Issues](https://github.com/motamman/signalk-whatif-helper/issues) page.
