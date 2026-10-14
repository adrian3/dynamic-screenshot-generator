# Living Screenshots

A static Three.js scene editor for layered SVG screenshots hovering above an unbranded 3D laptop or desktop display. No compilation or build step is needed. Both devices are generated from geometry rather than photographic images or downloaded models.

[GitHub Pages](https://adrian3.github.io/dynamic-screenshot-generator/)

## Checkpoint

The previous CSS editor, including both demos and the photographic display color controls, is preserved in commit `7b4c960` and the Git tag `css-editor-checkpoint`. That checkpoint has been pushed to GitHub.

The laptop-only 3D editor with four public demos is preserved in commit `a9756df`, before desktop support.

The 3D editor stores settings under `living-screenshots-3d-state-v1`. CSS poses are not automatically converted to 3D camera positions. Reset App, available in the toolbar and Settings, clears the site's local storage (including legacy CSS settings) and restores all defaults.

## Scene

- Procedural laptop with beveled aluminum casing, keyboard, trackpad, speakers, hinge, webcam, and generic ports. There are no logos or branding.
- Procedural desktop display based on the monitor reference: thin widescreen panel, sloped aluminum stem, rounded rectangular base, and adjustable screen tilt.
- Laptop/Desktop selector with separate positioning, scale, visibility, and finish settings. The desktop starts in Silver; existing laptop settings are preserved.
- Space Gray and Silver finishes, plus a custom body color and screen color.
- A 16:9 preview that fits the workspace without changing the composition when the controls drawer opens or closes. Appearance controls sit below the frame.
- Soft shadows with a Shadows checkbox. Disabling shadows also disables their rendering pass.
- Four SVG planes attached to the selected display. At zero Z Depth, they register on the screen; increased depth lifts them along its normal. Desktop tilt moves the panel and all layers together.
- Camera rotation, scale, perspective, lid angle, and individual layer controls.
- Front-only camera orbit: azimuth is constrained to -90 through +90 degrees. Elevation ranges from a horizon-level 0 degrees through 70 degrees above the scene.
- Subtle camera animation moves the complete composition. Play and pause retain the current animation phase.
- Mouse and touch orbit and zoom, local saved settings, and reduced-motion support.
- CSS and image export controls remain removed.

The renderer uses studio environment lighting, metal/roughness materials, and contact shadows. SVG panels use unlit textures so their interface colors remain consistent. The original SVG files remain the editable source assets; rendering converts them to textures up to 1920 pixels wide, or 1280 on narrow screens.

### Control Coverage

Roll is exposed as **Roll (Z)** in Scene Orientation and each layer, and as an axis option in Living Motion. Scene roll rotates the camera around its viewing axis; layer roll rotates that SVG around its local Z axis. The JSON key remains `rotateZ` for compatibility. Music and Architecture start at zero roll.

All current visual settings in `demo.json` have editor controls: camera orientation/FOV/scale; device model, position, scale, visibility, lid angle or screen tilt; body finish/color and shared screen color; grid, shadows, background, drawer state and resolution; motion enabled/axis/intensity/duration/depth; and each layer's position, orientation, scale and opacity. Device controls switch with the selected model; resolution is in Settings; layer controls are in their expandable sections.

The only saved runtime field without a direct control is `animation.time`, which preserves the animation phase. SVG filenames are asset mappings configured by the folder/JSON, not visual controls. `laptop.screenColor` is a legacy JSON name for the screen color shared by both device models. The control labeled **Speed** stores cycle duration in milliseconds, so larger values mean slower motion. Lighting, shadow softness/opacity, geometry, camera target, the 16:9 ratio and orbit limits remain fixed renderer choices rather than hidden preset settings.

## Running

Double-click `Start Living Screenshots.command` on macOS, or serve this folder:

```sh
python3 -m http.server 8787
```

Open [the local app](http://127.0.0.1:8787/index.html). ES modules and asset loading require HTTP or HTTPS rather than `file://`.

GitHub Pages can serve the repository root directly. Runtime dependencies are included locally under `vendor/`, so the app does not depend on a CDN, package installation, or a build service.

## Assets

The built-in examples are `assets/Dashboard demo/`, `assets/Chess Demo/` (Eugene Chess), `assets/Music demo/` (Signal Studio, a music production session), and `assets/Architecture demo/` (Architecture Studio, a courtyard-house plan with structural and environmental overlays). Each uses four SVGs with a 1920 x 1037 view box:

- `Background.svg`
- `Middle Ground.svg`
- `Middle Foreground.svg`
- `Foreground.svg`

Each demo folder is self-contained: its four SVGs and `demo.json` define the full scene. The configuration includes grid, shadows, canvas background, drawer state, resolution, device selection, device positions, finishes, body/screen colors, camera orientation, animation, and each layer's filename, position, rotation, scale, and opacity. Each built-in example has its own presentation defaults and matching screen color:

- Architecture: silver/white desktop, white background, no grid or shadow.
- Music: dark laptop, black background, no grid, low camera elevation (12 degrees).
- Chess: dark desktop, black background, grid on.
- Dashboard: silver/white laptop, white background, grid on.

`demo.json` uses `"version": 1` and the same field names and values as the editor. `canvas.background` is 0 for white through 100 for black; numeric controls are limited to their editor ranges. SVG filenames in `layers` are relative to that demo folder. Omitting settings uses the generic defaults; folders without JSON still load their SVGs. Invalid JSON shows a status warning and uses fallback settings.

For example, a partial configuration is valid:

```json
{
  "version": 1,
  "canvas": { "grid": false, "shadows": true, "background": 0 },
  "device": "laptop",
  "laptop": { "finish": "silver", "screenColor": "#19272b" },
  "scene": { "rotateX": 24, "rotateY": -28 },
  "layers": {
    "foreground": { "file": "Foreground.svg", "z": 0.66, "rotateZ": 3 }
  }
}
```

Choosing a demo loads its JSON defaults plus that demo's local edits. Only edited values are stored as overrides, so updated JSON defaults still apply to untouched controls. Existing saved arrangements and screen-color overrides are migrated without resetting them. The download icon in Assets produces a complete `demo.json` for the current arrangement, using the selected SVG filenames. It does not overwrite repository files. The adjacent reset icon rereads that demo's JSON and clears only its overrides; an unreadable configuration does not discard the current arrangement. Reset App clears all site storage and reloads the first published demo. Presets respect reduced-motion preferences on first load; Play can explicitly enable motion.

Hosted pages, including GitHub Pages, show the built-in demo dropdown and hide Choose Folder and Rescan. Both controls remain in the markup and are shown automatically on `localhost`, `.localhost` subdomains, `127.0.0.1`, and IPv6 loopback (`::1`). Hosted mode also skips directory-listing requests.

Local servers that expose directory listings can discover new folders automatically, including their JSON configurations. Choose Folder reads SVGs and `demo.json` from local directories in browsers supporting the [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access). The API can also work on HTTPS-hosted sites with user permission; hiding it in the public demo is a UI choice, not a GitHub Pages limitation. Add published folder names to `assets/demos.json` to register new examples on GitHub Pages; no JavaScript edits or compilation are needed.

The product-specific legacy SVG folders have been removed. The old photographic device assets remain available in the repository checkpoint and are not loaded by the 3D renderer.

## Files And Licenses

- `index.html`, `style.css`: editor interface.
- `app.js`: scene, camera, layer loading, motion, controls, and saved state.
- `demo-config.js`: shared editor ranges, configuration validation, and override/download serialization.
- `assets/demos.json`: published demo folder index. Each folder contains its own `demo.json` and SVGs.
- `laptop.js`: original procedural laptop geometry.
- `desktop.js`: original procedural desktop display and stand geometry.
- `display-geometry.js`: shared rounded outlines, screen surfaces, and thin display shells.
- `icons.js`: selected Lucide icons; ISC license in `vendor/LUCIDE-LICENSE`.
- `vendor/three/`: pinned Three.js 0.186.1 and required addons; MIT license included.

High resolution in Settings allows a device pixel ratio up to 2 instead of 1.5. Mobile layouts reduce the screenshot texture size. Paused scenes render only when controls or the viewport change.
