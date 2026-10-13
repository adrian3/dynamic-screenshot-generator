# Living Screenshots

A lightweight static tool for composing layered SVG screenshots into a subtle 3D “living screenshot” hero image. It uses plain HTML, CSS, and browser JavaScript. There is no build step.

[Live GitHub Pages demo](https://adrian3.github.io/dynamic-screenshot-generator/)

## What It Does

- Layers four SVG files into a CSS 3D stack.
- Lets you tune scene rotation, layer offsets, depth, motion, background, and display image placement.
- Supports laptop dark, laptop light, and monitor display backgrounds.
- Can mirror only the display image while leaving the screenshot layers unchanged.
- Lets you choose a screen color for either laptop or the monitor, using their transparent-screen PNG variants.
- Persists local control values in `localStorage`.
- Exports the current frame as a transparent PNG when served over `http://` or `https://`.

## Chess Showcase

The default example is a four-layer chess blueprint in `assets/Chess Demo/`. Each SVG uses the original screenshot dimensions: `1920 x 1037`.

- `Background.svg`: drafting grid, chessboard, coordinates, and title block.
- `Middle Ground.svg`: a Ruy Lopez position and a knight construction drawing.
- `Middle Foreground.svg`: candidate moves, diagonal geometry, and central control.
- `Foreground.svg`: position analysis and annotation callouts.

The transparent upper sheets use the existing CSS 3D transforms and pivot animation. Z Depth controls their separation; at zero depth the default sheets register as a single composition. These are original SVG drawings with no external fonts, libraries, or proprietary screenshots. Existing saved control values are preserved; Reset App loads the new showcase arrangement.

## Dashboard Showcase

Select `Dashboard demo` in the Folder dropdown to load **Application Observability**, a fictional infrastructure dashboard with synthetic data. Its four SVGs in `assets/Dashboard demo/` use the same `1920 x 1037` dimensions and registered layer arrangement:

- `Background.svg`: application navigation, workspace header, and dashboard containers.
- `Middle Ground.svg`: request throughput, CPU and memory utilization, and host heatmap.
- `Middle Foreground.svg`: live metric summaries and a dense service health table.
- `Foreground.svg`: a latency event annotation and active infrastructure incidents.

Switching examples preserves scene orientation, motion, and layer offsets. The old `chess` selection automatically becomes `Chess Demo` without resetting saved settings.

## Display Screen Color

The Screen color swatch beside Mirror Display changes the computer screen's color and saves it with the other controls. A fitted SVG polygon sits behind the transparent opening in the PNG. The polygon and device share one container, so position, scale, opacity, visibility, and mirroring apply together. The two laptops use the same screen outline; the monitor has its own.

All three device PNGs use `1536 x 1024` coordinates. The fill points are:

- Laptops: `(575,185) (1302,136) (1248,724) (523,689)`.
- Monitor: `(565,204) (1284,143) (1251,701) (525,664)`.

The outlines cover the transparent screen with a small margin inside the opaque bezel. PNG export composites the fill with the device before applying opacity and mirroring, preserving transparency outside the computer.

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

Live site: https://adrian3.github.io/dynamic-screenshot-generator/

Recommended Pages setup:

1. The public chess and dashboard SVG layers are included in the repository. Product-specific folders remain ignored by git.
2. Keep the same four layer filenames in each asset folder when possible:
   - `Background.svg`
   - `Middle Ground.svg`
   - `Middle Foreground.svg`
   - `Foreground.svg`
3. Push `index.html`, `assets/`, `.nojekyll`, and this README.
4. In GitHub, enable Pages for the repository root or `/docs` if you later move the files there.

Both demo folders are registered in `builtInAssetSets`, so the complete examples work on GitHub Pages without directory listings.

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
