<p align="center">
  <img src="site/sledit.webp" alt="Sleditor mascot" width="120">
</p>

# Sleditor

A browser-based save editor for [Sledding Game](https://store.steampowered.com/app/3438850/Sledding_Game/) (Steam).

Decrypts, lets you edit, and re-encrypts your save files. Runs **entirely in your browser** — no data is sent to any server.

## Usage

1. Open the editor (hosted via GitHub Pages, or locally)
2. Open or drag-and-drop your save file(s)
3. Edit values using the form fields or the Raw JSON tab
4. Click **Download Encrypted** to get the modified save file(s)
5. Replace the original files in your save directory

### Save file locations

**Windows:**
```
%AppData%\..\LocalLow\The Sledding Corporation\Sledding Game\
```

**Linux (Steam Proton):**
```
~/.local/share/Steam/steamapps/compatdata/3438850/pfx/drive_c/users/steamuser/AppData/LocalLow/The Sledding Corporation/Sledding Game/
```

The encrypted files are `DEMO_PlayerSavedStats.json` (currency, inventory, progress) and `DEMO_PlayerSavedSettings.json` (audio, video, gameplay options).

## Editable fields

- **Currency** — points, held points, arcade tickets
- **Lifetime stats** — points earned, spent, gambled, lost, won
- **Equipment** — equipped character, sled, hat, scarf, facewear
- **Inventory** — sleds, buildables, tools, hats, scarves, facewear, dyes, trinkets
- **Progress flags** — tutorial completion, shop/inventory visits
- **Challenge counters** — achievement-related trackers
- **Settings** — audio volumes, video options, gameplay preferences, social/chat toggles
- **Raw JSON** — direct editing of the full save structure

## Running locally

The editor is pure static HTML/CSS/JS with no dependencies. Serve the `site/` directory with any HTTP server:

```sh
cd site
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Technical details

Save files are base64-encoded, containing a 16-byte IV followed by AES-256-CBC encrypted JSON with PKCS7 padding. Decryption and encryption use the browser's [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API).
