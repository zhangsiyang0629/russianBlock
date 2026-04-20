# OpenCode Agent Instructions

## Project Overview

- **WeChat Mini Game** - Russian Tetris with native Canvas API and ad integration
- **No build system** - Runs directly in WeChat Developer Tools
- **ES6 modules** - Uses `import`/`export`, not CommonJS
- **Entry point**: `game.js` → `js/main.js` → `js/tetris/game.js`

## Development Setup

### Environment
- **Requires WeChat Developer Tools** - No local dev server or build commands
- **ESLint configured** but no lint script - See `.eslintrc.js` for global definitions
- **No package.json** - No npm dependencies or scripts

### Key Global Variables
```javascript
// WeChat mini-game API
wx, canvas, GameGlobal
```

## Code Architecture

### Core Modules
```
js/tetris/
├── grid.js    # 10×20 game grid with collision and line clearing
├── block.js   # Tetromino shapes and rotations (7 classic types)
├── game.js    # Main game loop, input, scoring, revive logic
└── ad.js      # Ad manager with banner and rewarded video support
```

### Entry Flow
1. `game.js` imports `js/main.js`
2. `js/main.js` imports `js/tetris/game.js` after canvas initialization
3. `js/tetris/game.js` manages game state, ads, and rendering

## Ad Integration

### Current State
- **Simulated ads** for development (mock banners + rewarded videos)
- **Ad height**: 80px at top of screen, game area adjusts automatically
- **Revive system**: Watch ad → clear bottom 4 rows → continue game (once per session)

### Switching to Real Ads
Uncomment and configure in `js/tetris/ad.js`:
- `loadWeChatAd()` - Banner ads
- `initRewardedAd()` + `showRewardedAd()` - Rewarded video for revive

## Testing & Validation

### No Test Suite
- No unit/integration tests exist
- Test by running in WeChat Developer Tools
- Manual verification of core mechanics:
  - Block movement/rotation/collision
  - Line clearing and scoring
  - Ad placement and revive flow
  - Touch/input regions (excludes ad area)

### Syntax Checking
```bash
# Verify ES6 module syntax
node -c game.js js/main.js js/render.js js/tetris/*.js
```

## Common Pitfalls

1. **Don't add npm/Node dependencies** - WeChat games run in restricted environment
2. **Use ES6 modules only** - No `require()` or `module.exports`
3. **Ad area is interactive** - Touch input logic excludes top 80px
4. **Game area auto-centers** - Accounts for ad height in `js/tetris/game.js:render()`
5. **Revive is one-time** - `reviveUsed` flag prevents reuse per session

## Key Constraints

- **Canvas-only rendering** - No DOM or WebGL
- **WeChat API only** - No browser-specific APIs (localStorage, fetch, etc.)
- **Portrait mode only** - `game.json` enforces `"deviceOrientation": "portrait"`
- **ES6 syntax** - No TypeScript or build step
- **Minimal dependencies** - Keep file size small for WeChat platform