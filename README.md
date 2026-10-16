# Living Screenshots

A static Three.js scene editor for layered SVG screenshots hovering above an unbranded 3D laptop or desktop display. No compilation or build step is needed. Both devices are generated from geometry rather than photographic images or downloaded models.

[GitHub Pages](https://adrian3.github.io/dynamic-screenshot-generator/)

## Checkpoint

The previous CSS editor, including both demos and the photographic display color controls, is preserved in commit `7b4c960` and the Git tag `css-editor-checkpoint`. That checkpoint has been pushed to GitHub.

The laptop-only 3D editor with four public demos is preserved in commit `a9756df`, before desktop support.

The 3D editor remembers only the selected folder and animation under `living-screenshots-3d-preferences-v1`. Older full-state storage is migrated by retaining those two choices and discarding its camera, appearance, layer and playback overrides. Reset App, available in the toolbar and Settings, clears current and legacy 3D app preferences and restores all defaults without deleting unrelated site storage. CSS poses are not automatically converted to 3D camera positions.

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
- Four animation presets, selected below the demo/folder dropdown: Sway (a subtle axis pivot), Camera Tour (three views over 12 seconds), Fly In (a one-second entrance with continuous gentle sway), and Inversion (two captured views with an angle-linked white-to-black device finish). Play and pause retain the current animation phase.
- Mouse and touch orbit and zoom, remembered folder/animation selections, and reduced-motion support.
- CSS and image export controls remain removed.

The renderer uses studio environment lighting, metal/roughness materials, and contact shadows. SVG panels use unlit textures so their interface colors remain consistent. The original SVG files remain the editable source assets; rendering converts them to textures up to 1920 pixels wide, or 1280 on narrow screens.

### Control Coverage

Roll is exposed as **Roll (Z)** in Scene Orientation and each layer, and as an axis option in Living Motion. Scene roll rotates the camera around its viewing axis; layer roll rotates that SVG around its local Z axis. The JSON key remains `rotateZ` for compatibility. Music and Architecture start at zero roll.

All current visual settings in `demo.json` have editor controls: camera orientation/FOV/scale; device model, position, scale, visibility, lid angle or screen tilt; body finish/color and shared screen color; grid, shadows, background, drawer state and resolution; motion preset/enabled/axis/intensity/duration/depth; and each layer's position, orientation, scale and opacity. Device controls switch with the selected model; resolution is in Settings; layer controls are in their expandable sections. Sway and Fly In show axis/intensity/speed controls; Camera Tour and Inversion instead show cycle duration (12,000-90,000 ms). Fly In's entrance has a fixed one-second duration, independent of its sway speed. Layer depth remains available in every mode.

The only JSON runtime field without a direct control is `animation.time`, which records the captured animation phase. It is not stored in browser preferences, and reloading starts playback from the beginning. SVG filenames are asset mappings configured by the folder/JSON, not visual controls. `laptop.screenColor` is a legacy JSON name for the screen color shared by both device models. The control labeled **Speed** stores cycle duration in milliseconds, so larger values mean slower motion. Lighting, shadow softness/opacity, geometry, camera target, the 16:9 ratio and orbit limits remain fixed renderer choices rather than hidden preset settings.

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

Choosing a demo loads its JSON visual defaults while carrying the current animation through the switch. Its preset, axis, intensity, speed, duration, Z Depth, play/pause state, playback phase and Fly In entrance progress remain unchanged within the session. The values are captured when the new SVGs finish loading, so playback can continue during loading and control edits made during that time are retained. Camera composition, device, colors, individual layers, grid, shadows, background, drawer state and resolution use the new demo's defaults. Reloading still discards all temporary edits and starts the remembered animation from its beginning; only the folder and animation selection are stored in the browser. Switching animation presets resets camera and motion settings to the new preset's starting settings. The copy icon in Assets copies complete current scene JSON, including temporary edits, using the selected SVG filenames. It does not download or overwrite files. The adjacent reset icon rereads that demo's JSON, including its animation settings, without carrying the previous animation edits; an unreadable configuration does not discard the current arrangement. Reset App clears the two app storage keys and reloads the first published demo. Presets respect reduced-motion preferences on load; Play can explicitly enable motion. Browsers without local-storage access still run the editor, but cannot remember selections.

### Animation Loops

Switching animations during playback uses one shared 600 ms transition from the currently visible camera, zoom, layer depth/scale, device opacity and material colors into the new moving preset. It uses existing Three.js interpolation and quintic easing, with no extra dependency or per-preset-pair definitions. Rapid selections retarget from the visible frame rather than queueing old transitions. Pause freezes an active blend; selecting a preset while already paused previews its starting frame immediately. Reduced-motion mode also switches immediately. Folder changes reuse this easing for the camera and layer spacing, including the different laptop/desktop look-at centers, while retaining animation timing. SVG artwork, device geometry and theme finishes swap directly rather than morphing; an in-progress Fly In fade keeps its exact progress. Orbit dragging takes over the camera, while replay, reset and manual device changes cancel the temporary blend. Transition state is never saved to browser storage.

`animation.preset` selects `sway` (the legacy/default motion), `tour`, `fly-in`, or `inversion`. Sway retains its existing axis, angle and `speed` fields. Camera Tour uses `animation.duration`, defaulting to 12,000 ms: hold view one from 0-3 seconds, transition from 3-4, hold view two from 4-7, transition from 7-8, hold view three from 8-11, then transition back to view one from 11-12. Changing duration preserves the 3:1 hold/transition ratio. The route uses the three supplied Chess Demo captures' exact visible `capture.camera` angles/FOV/zoom, including their captured Sway offsets, rather than the different base `scene` angles. It does not change the selected demo's device, colors or layers. Old browser duration overrides no longer affect this timing.

Selecting Camera Tour or resetting its camera anchors the scene to the authored first view. Desktops use the captured zoom exactly; laptops use the same angles with a wider starting scale of 1.24 to keep the deeper base in frame. This is an ordinary editable Scene Scale value, and copied JSON reports the actual zoom. Changing device during Camera Tour resets its framing for the new model. Three.js quintic smootherstep easing connects consecutive views, including the final return to the first, with continuous velocity and acceleration and no overshoot below the horizon or beyond the captured zoom. Scene controls can reanchor the path; dragging restarts it around the newly arranged view without snapping on release. Only the preset selection is remembered between visits; edited duration and animation phase are not. Pausing/resuming and changing duration preserve phase within the current session.

Fly In starts from the supplied Dashboard capture (34-degree FOV, X 17.4181, Y -32.4552, roll 0, scale 1.65) and gently sways around it during and after the entrance. Its axis, intensity and speed use the same controls as Sway (default Y pivot, 4.5 degrees, nine-second cycle). Selecting it or reloading with it selected starts the entrance once all four SVG textures are ready; switching demo folders preserves the existing entrance progress instead of replaying it. The device fades in and the layers settle from enlarged scales and progressively greater screen-relative depths over one second, then remain in place while the sway continues. These are temporary rendering offsets, not changes to saved layer settings. Play/Pause freezes or resumes both motions without restarting the fade. The replay icon beside it restarts the entrance and sway. Separate entrance and sway clocks prevent orbit dragging or speed edits from replaying or rescaling the fade. Reduced-motion users and disabled entrances see the fully assembled static scene until they explicitly play or replay. Reset Camera restores the base captured view without replaying the entrance. Device, colors, grid, background and layer arrangement remain those of the selected demo.

Inversion has its own two captured views, not Camera Tour's three-view path. It starts at X 10.502273787313399, Y -46.89161613805969, scale 1.087515179232779; the opposite view is X 10.444554570895505, Y 39.46420242537315, scale 1.0875151792327815. Both have FOV 34 and roll 0, with no additional laptop zoom adjustment. Selecting Inversion or resetting its camera sets Z Depth to 2.5. The default 12-second loop holds the starting view for 4.5 seconds, transitions to the opposite view over 1.5 seconds, holds that view for 4.5 seconds, then transitions back over 1.5 seconds. Editing duration preserves the 3:1 hold/transition ratio. The near-white starting color matches the capture's `#fdfdfd`; the opposite view is `#000000`, blending in linear color space through intermediate angles and the return trip. Its finish follows the actual camera yaw, including manual dragging, rather than an independent color timer. Laptop keycaps and legends blend with the body; the bezel, display artwork and canvas colors do not change. The body picker shows the animated color and is read-only during Inversion, as are the finish swatches. Switching presets restores the original saved body finish, and copied JSON adds the visible animated color at `capture.bodyColor` without overwriting the saved base color. Desktop models support the same effect. Metallic highlights remain visible even at the black endpoint.

### Camera Snapshots

Copied JSON retains the full version-1 demo settings and adds `capture.demo` plus `capture.camera`. That camera snapshot contains the exact visible field of view (`perspective`), elevation (`rotateX`), azimuth (`rotateY`), roll (`rotateZ`), zoom (`scale`), world position, look-at target, orientation quaternion and aspect ratio. The normal `scene` fields remain the arranged base settings, so copying an animated frame does not silently change the demo. `capture.camera` includes the motion offset actually visible at the moment of copying. Existing JSON parsing safely ignores this extra capture metadata.

For three custom keyframes, keep the same demo and device, pause, arrange each camera view and use Copy scene JSON. Share the three complete JSON objects in the desired playback order. Device placement, lid/screen tilt, layer placement/depth, theme and SVG filenames are included, so the reference composition can be reproduced without guessing. The browser [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText) is used; if access is unavailable or denied, the same JSON opens selected in a dialog for manual copying.

Hosted pages, including GitHub Pages, show the built-in demo dropdown and hide Choose Folder and Rescan. Both controls remain in the markup and are shown automatically on `localhost`, `.localhost` subdomains, `127.0.0.1`, and IPv6 loopback (`::1`). Hosted mode also skips directory-listing requests.

Local servers that expose directory listings can discover new folders automatically, including their JSON configurations. Choose Folder reads SVGs and `demo.json` from local directories in browsers supporting the [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access). The API can also work on HTTPS-hosted sites with user permission; hiding it in the public demo is a UI choice, not a GitHub Pages limitation. Add published folder names to `assets/demos.json` to register new examples on GitHub Pages; no JavaScript edits or compilation are needed.

The product-specific legacy SVG folders have been removed. The old photographic device assets remain available in the repository checkpoint and are not loaded by the 3D renderer.

## Files And Licenses

- `index.html`, `style.css`: editor interface.
- `app.js`: scene, camera, layer loading, motion, controls, and live editing state.
- `editor-preferences.js`: selection-only local storage and legacy migration.
- `demo-config.js`: shared editor ranges, configuration validation, and clipboard serialization.
- `camera-motion.js`: Sway/Camera Tour/Fly In/Inversion sampling and exact visible-camera snapshots.
- `assets/demos.json`: published demo folder index. Each folder contains its own `demo.json` and SVGs.
- `laptop.js`: original procedural laptop geometry.
- `desktop.js`: original procedural desktop display and stand geometry.
- `display-geometry.js`: shared rounded outlines, screen surfaces, and thin display shells.
- `icons.js`: selected Lucide icons; ISC license in `vendor/LUCIDE-LICENSE`.
- `vendor/three/`: pinned Three.js 0.186.1 and required addons; MIT license included.

High resolution in Settings allows a device pixel ratio up to 2 instead of 1.5. Mobile layouts reduce the screenshot texture size. Paused scenes render only when controls or the viewport change.

## Tests

Run `node --test tests/*.test.mjs` for configuration validation, preset/control coverage, selection-only preferences and migration, authored camera poses and loop continuity, bounded interpolation and exact visible-camera JSON capture tests. No test packages or build step are required.
