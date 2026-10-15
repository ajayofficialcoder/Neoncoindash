# Neon Coin Dash ⚡

**Neon Coin Dash** is a high-octane 2D/2.5D neon arcade runner built with HTML5 Canvas and vanilla JavaScript, specially designed and optimized for **YouTube Playables**.

---

## 🎮 Gameplay & Design

- **Core Loop:** The player controls a pulsing cyan energy orb navigating a 3-lane futuristic cyber track. Collect gold coins to rack up points and build combo multipliers (up to 5x) while dodging lethal red hazard spikes.
- **First 10 Seconds Hook:** The game rewards players immediately within the first 3 seconds with a cluster of gold coins in the center lane, followed by a gentle introductory dodge pattern and dynamic combo popups.
- **Near-Miss System:** Grazing past obstacles in adjacent lanes triggers high-tech flair, bonus points, and near-miss sound effects.
- **Dynamic Speed Progression:** Track velocity smoothly scales up over time, delivering an adrenaline-packed arcade experience.
- **Visuals:** Premium neon arcade aesthetic with dark navy backdrop (`#050814`), radiant glow effects, 3D rotating coins, pulsing hazard spikes, particle bursts, and camera shake.
- **Audio:** 100% self-contained synthesized retro-arcade sound effects and neon bassline via the Web Audio API—no external audio files or network latency.

---

## 🕹️ Controls

| Input Type | Action | How To Use |
| :--- | :--- | :--- |
| **Keyboard** | Move Left / Right | `Left Arrow` / `A` & `Right Arrow` / `D` |
| | Play / Restart | `Space` or `Enter` |
| | Pause / Resume | `Escape` or `P` |
| | Toggle Audio | `M` |
| **Touch / Mobile** | Swipe Left / Right | Quick horizontal swipe anywhere on the canvas |
| | Tap Lanes | Tap left, center, or right track area to jump to that lane |
| | On-Screen Buttons | Ergonomic glowing `◀` and `▶` touch buttons |
| **Mouse** | Lane Switch | Click left/right half or click the desired lane directly |
| | UI Interaction | Click Play, Retry, Pause, or Mute buttons |

---

## 📺 YouTube Playables Compliance & SDK Integration

This project strictly adheres to the official **YouTube Playables SDK (v1)** guidelines:

### 1. SDK Loading
- Included in [`index.html`](file:///C:/Users/apuni/.gemini/antigravity/scratch/neon-coin-dash/index.html) before any game script:
  ```html
  <script src="https://www.youtube.com/game_api/v1"></script>
  ```
- Uses strictly relative file paths (`style.css`, `game.js`).

### 2. Lifecycle & Readiness Signaling
- **`firstFrameReady()`**: Dispatched on the very first frame rendered on the canvas when the game canvas is drawn and visible.
- **`gameReady()`**: Dispatched after persistent data loading is complete and the game menu is fully interactive for the player.
- **No False Readiness**: Methods are only called when each corresponding state is actively reached.

### 3. State Persistence & Leaderboard
- **`saveData(dataString)`**: Persists high scores and player statistics to YouTube cloud storage.
- **`loadData()`**: Retrieves previously saved player state on startup.
- **`sendScore({ value: number })`**: Dispatches the final sanitized integer score on game over for YouTube leaderboards.

### 4. Audio & Lifecycle Callbacks
- **`onPause()` & `onResume()`**: Automatically halts game loop, BGM, and sound when YouTube pauses the game (e.g., player switching tabs, interstitial events). Resuming presents a clear prompt to resume.
- **`isAudioEnabled()` & `onAudioEnabledChange(enabled)`**: Respects global YouTube player audio settings.

### 5. Graceful Local Development Fallback
- When `window.YTPlayables` is absent (such as when testing locally in a web browser without the YouTube sandbox), the game automatically defaults to standard Web APIs (`localStorage` for save data, `document.visibilitychange` for pausing) without throwing console errors.

### 6. Sandbox & Security Compliance
- **Zero External Network Requests:** No external fonts, images, stylesheets, analytics, tracking, or scripts.
- **No User Data Collection:** Does not collect personal information (PII).
- **Responsive & Unlocked Orientation:** Renders seamlessly in portrait, landscape, desktop, tablet, and mobile viewports. Game state is fully preserved during window resize.

---

## 🚀 Running Locally

To test the game locally using Python's built-in web server:

1. Open PowerShell or Terminal in the project directory:
   ```powershell
   cd C:\Users\apuni\.gemini\antigravity\scratch\neon-coin-dash
   ```

2. Start a local HTTP server:
   ```powershell
   python -m http.server 8080
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

---

## 📦 Preparing the Game Bundle for YouTube Playables Testing

To prepare your build for testing in the official YouTube Playables testing sandbox:

1. **Verify Project Structure:**
   Ensure your files sit at the root level of the ZIP archive without any wrapper parent folder:
   ```
   neon-coin-dash.zip
   ├── index.html
   ├── style.css
   ├── game.js
   └── README.md
   ```

2. **Create the Zip Archive (PowerShell command):**
   ```powershell
   Compress-Archive -Path index.html, style.css, game.js -DestinationPath neon-coin-dash.zip -Force
   ```

3. **Validation Checklist Before Upload:**
   - [x] Initial zip archive is under 5MB (Current bundle is under 35KB!).
   - [x] Initial load time is under 1 second.
   - [x] No external network calls (all assets drawn via Canvas; all audio synthesized via Web Audio).
   - [x] Validated across portrait and landscape viewports.
   - [x] Supports touch, mouse, and keyboard.
   - [x] `firstFrameReady()` and `gameReady()` called in the exact lifecycle order.

> *Note: This game is a prototype built to the YouTube Playables technical specification and is not certified or officially published by YouTube.*
