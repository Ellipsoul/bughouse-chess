# TamperMonkey Script - Relay Bughouse Game Links

This TamperMonkey script automatically adds "Ellipviewer" buttons to bughouse
games on chess.com, allowing you to quickly open games in the Relay bughouse
analysis tool.

## What It Does

The script works in two contexts:

1. **Game History Pages**: When viewing a player's game history (e.g.,
   `https://www.chess.com/member/username`), the script automatically detects
   bughouse games and replaces the standard game link with an "Ellipviewer"
   button that opens the game directly in Relay.

2. **Live Game Pages**: When viewing an individual live game, the script adds an
   "Ellipviewer" button to the game controls, allowing you to quickly switch to
   the Relay analysis view.

The script handles pagination automatically - when you navigate to different
pages of game history, the buttons will continue to appear on new games.

## Installation

### Step 1: Install a User Script Manager Extension

You need a browser extension to run TamperMonkey/GreaseMonkey scripts. Choose
the appropriate extension for your browser:

#### Chrome / Edge / Brave / Opera

- **TamperMonkey** (Recommended):
  [Install from Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- **Violentmonkey** (Alternative):
  [Install from Chrome Web Store](https://chrome.google.com/webstore/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag)

#### Firefox

- **TamperMonkey** (Recommended):
  [Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- **Violentmonkey** (Alternative):
  [Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/)
- **Greasemonkey** (Classic):
  [Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)

#### Safari

- **TamperMonkey**:
  [Install from Safari Extensions](https://apps.apple.com/us/app/tampermonkey/id1482490089)

#### Other Browsers

- Most Chromium-based browsers support TamperMonkey from the Chrome Web Store
- For other browsers, check if they support TamperMonkey or Violentmonkey
  extensions

### Step 2: Install the Script from Greasy Fork

1. **Click the installation link**:
   [Install from Greasy Fork](https://greasyfork.org/en/scripts/560180-relay-bughouse-game-links)

2. You will be redirected to your user script manager (TamperMonkey,
   Violentmonkey, etc.)

3. Click the **"Install"** or **"Install script"** button in the dialog that
   appears

4. The script will be automatically installed and enabled

5. You can verify installation by:
   - Opening your user script manager dashboard
   - Looking for "Relay - Bughouse Game Links" in your script list
   - Ensuring it has a green checkmark or is marked as enabled

6. Try out the script
   - Navigate to a chess.com player's game history page (e.g.,
     `https://www.chess.com/member/ellipsoul/games`)
   - Check that the buttons are now rendered

![Tampermonkey Buttons](/public/assets/tampermonkey_buttons.png)

### Alternative: Manual Installation

If you prefer to install manually or the Greasy Fork link is unavailable:

1. Open your user script manager dashboard:
   - **TamperMonkey**: Click the TamperMonkey icon → "Dashboard"
   - **Violentmonkey**: Click the Violentmonkey icon → "Dashboard"
   - **Greasemonkey**: Click the Greasemonkey icon → "Manage User Scripts"

2. Click the **"+"** or **"Create new script"** button

3. Copy the entire contents of `user_scripts/ellipviewer_tampermonkey.js` from
   this repository

4. Paste it into the script editor, replacing any default content

5. Save the script:
   - **TamperMonkey**: Press `Ctrl+S` (Windows/Linux) or `Cmd+S` (Mac), or click
     "File" → "Save"
   - **Violentmonkey**: Click "Save" button
   - **Greasemonkey**: Click "Save" button

6. The script should now be active and enabled

## Usage

### Game History Pages

1. Navigate to any chess.com member profile page (e.g.,
   `https://www.chess.com/member/username`)
2. Click on the "Games" tab to view their game history
3. Bughouse games will automatically show "Ellipviewer" buttons instead of
   standard links
4. Click the button to open the game in Relay in a new tab
5. The buttons will continue to appear as you navigate through different pages
   of game history

### Live Game Pages

1. Navigate to any chess.com live game page (e.g.,
   `https://www.chess.com/game/live/123456789012`)
2. Look for the "Ellipviewer" button in the game controls area
3. Click it to open the game in Relay in a new tab

## Troubleshooting

### Buttons Don't Appear

- **Check script is enabled**: Open your user script manager dashboard and
  verify the script has a green checkmark or is marked as enabled
- **Refresh the page**: The script runs on page load, so try refreshing the
  chess.com page
- **Check browser console**: Open browser developer tools (F12) and look for any
  error messages prefixed with `[Relay Bughouse Links]`
- **Verify URL matches**: The script only runs on `chess.com/game/live/*` and
  `chess.com/member/*` URLs
- **Check extension is active**: Ensure your user script manager extension
  (TamperMonkey, etc.) is enabled and running

### Buttons Disappear After Pagination

- This should be fixed in version 1.1.0+. The script uses continuous polling to
  handle single-page application navigation
- If you're experiencing this issue, try:
  - Updating to the latest version of the script
  - Refreshing the page
  - Checking the browser console for errors

### Wrong Games Getting Buttons

- The script uses heuristics to detect bughouse games (checking if the 4th table
  cell is empty)
- If regular chess games are incorrectly identified, this may indicate chess.com
  changed their page structure
- Please report this issue so the detection logic can be improved

### Script Not Running

- **Check extension permissions**: Some browsers require you to grant
  permissions for extensions to run on specific sites
- **Verify script matches URL**: Ensure you're on a supported URL
  (`chess.com/game/live/*` or `chess.com/member/*`)
- **Check for conflicts**: Other extensions or scripts might interfere - try
  disabling other extensions temporarily

## Updating the Script

### Automatic Updates (Greasy Fork)

If you installed from Greasy Fork, updates are typically automatic:

- Greasy Fork will notify you when a new version is available
- Your user script manager will prompt you to update
- Click "Update" when prompted

### Manual Updates

1. Open your user script manager dashboard
2. Find the "Relay - Bughouse Game Links" script
3. Click "Edit" to open the script editor
4. Replace the script contents with the latest version from this repository or
   Greasy Fork
5. Save the script (Ctrl+S / Cmd+S)

## Technical Details

- **Script Version**: 1.1.0
- **Namespace**: `https://bughouse.aronteh.com`
- **License**: GPL-3.0
- **Compatible URLs**:
  - `https://www.chess.com/game/live/*`
  - `https://www.chess.com/member/*`
- **Permissions**: None (runs with standard page permissions)

The script uses continuous polling (every second) to handle single-page
application navigation, ensuring buttons appear reliably even when the DOM is
replaced during pagination.
