# Living Screenshots

A lightweight static tool for composing layered SVG screenshots into a subtle 3D “living screenshot” hero image. It uses plain HTML, CSS, and browser JavaScript. There is no build step.

## What It Does

- Layers four SVG files into a CSS 3D stack.
- Lets you tune scene rotation, layer offsets, depth, motion, background, and display image placement.
- Supports laptop dark, laptop light, and monitor display backgrounds.
- Can mirror only the display image while leaving the screenshot layers unchanged.
- Persists local control values in `localStorage`.
- Exports the current frame as a transparent PNG when served over `http://` or `https://`.

## Running Locally

The app should be opened through a local web server rather than directly as a `file://` page, because PNG export and asset loading rely on browser fetch behavior.

On macOS, double-click:

```text
Start Living Screenshots.command
```

Or run a simple server from the project folder:

```sh
python3 -m http.server 8787
```

Then open:

```text
http://127.0.0.1:8787/index.html
```

## GitHub Pages

This project is ready to run as a static GitHub Pages site. Publish the repository root as the Pages source. No build command is required.

Recommended Pages setup:

1. The current product-specific SVG screenshot layers are intentionally ignored by git. Replace them with generic/public-safe versions before publishing a complete demo.
2. Keep the same four layer filenames in each asset folder when possible:
   - `Background.svg`
   - `Middle Ground.svg`
   - `Middle foreround.svg`
   - `Foreround.svg`
3. Push `index.html`, `assets/`, `.nojekyll`, and this README.
4. In GitHub, enable Pages for the repository root or `/docs` if you later move the files there.

Because screenshot SVGs are currently ignored, add public-safe replacements by updating `.gitignore` or by force-adding the intended generic SVG files.

### Important Privacy Note

The current local git history was created as a rollback point and may include product-specific screenshot assets. Do not push this local history to a public repository until those assets have been replaced or the public repository history has been rebuilt from a sanitized copy.

A safe public workflow is:

1. Keep this local repository as your private rollback backup.
2. Replace proprietary assets with generic assets.
3. Copy the sanitized project into a fresh repository, or rewrite history before pushing.
4. Review `assets/` before the first public push.

## Adding Asset Folders

The app includes built-in asset folders and also tries to discover SVG folders inside `assets/` when the host provides directory listings. Some static hosts do not expose directory listings. In that case, the built-in folders still work, and the “Choose Folder” button can load local folders in supported browsers.

For GitHub Pages, the most reliable path is to replace the existing built-in folder contents or add new folders and wire them into `builtInAssetSets` in `index.html` if automatic discovery is not available.

## Files

- `index.html` - the complete app.
- `assets/` - SVG layers and display background images.
- `Start Living Screenshots.command` - local macOS launcher for a simple Python web server.
- `.nojekyll` - tells GitHub Pages to serve files as-is.
