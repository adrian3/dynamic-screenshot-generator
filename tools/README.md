# Authorized Browser Capture

This workflow captures pages the user is already authorized to view in Chrome. It never reads cookies, credentials, browser profiles, storage or raw page HTML, and it does not submit forms or edit records. Close transient tips/tooltips before starting. Captures and generated real-app demos stay local by default.

## Capture

Requirements: macOS, Node.js, a loaded signed-in Chrome tab, Chrome DevTools open and undocked for that tab, permission to automate Chrome/System Events, and Chrome's existing **Allow JavaScript from Apple Events** permission. The tool does not change that browser permission or install an extension. Disable device emulation. Native screenshot downloads must save automatically to the selected download folder rather than prompting for every file.

```sh
node tools/capture-chrome.mjs \
  --url 'https://example.com/page' \
  --output captures/private/example-run-01
```

Run these commands from the repository root. The default content viewport is 1600 x 900 CSS pixels, or 3200 x 1800 pixels on a 2x display. This gives a high-resolution 16:9 source without browser chrome. The window must fit that viewport on the physical display. Other sizes, a custom `--download-dir`, and a reviewed `--max-tiles` limit are optional. Use a new output directory for each capture; existing captures are never overwritten. Keep the browser on the requested page until the command finishes. Output guards are tied to the actual repository location, not merely the shell's working directory.

The output contains `viewport.png`, overlapping scrolling PNG tiles, and `capture.json`. The manifest records the viewport/DPR, actual scrolling element, same-origin iframe path, scroll range, fixed header/footer bounds, visible panels, and CSS sticky elements. Native Chrome screenshots preserve embedded frames, charts, fonts and custom components. Cross-origin frames remain visible in screenshots, but their inner DOM is not inspected. Browser window size and the selected pane's scroll position are restored after completion or a handled error.

This is deliberately a local, user-session workflow. It depends on Chrome's native screenshot command palette and download behavior, so it is less robust than a dedicated browser extension. Very large pages, loading/lazy content, multiple independent scroll panes, transformed iframes and sticky content may need review or additional captures. The tool rejects a page that changes URL or grows beyond the captured coverage, rather than marking it complete.

## Choose Projections

Review `viewport.png` and the manifest. Choose meaningful visible UI regions to project into the three upper layers. Coordinates are CSS pixels in the original viewport, not retina image pixels. A layout file accepts ordinary editor settings plus those rectangles:

```json
{
  "title": "Captured application",
  "pageColor": "#f2f4f5",
  "settings": {
    "device": "laptop",
    "canvas": { "grid": false, "background": "#ffffff" },
    "laptop": { "finish": "silver", "screenColor": "#f2f4f5" }
  },
  "layers": {
    "middleground": [{ "x": 40, "y": 400, "width": 300, "height": 250 }],
    "middleForeground": [{ "x": 400, "y": 300, "width": 1100, "height": 350 }],
    "foreground": [{ "x": 400, "y": 160, "width": 1100, "height": 100 }]
  }
}
```

Use captured boundaries, not fabricated/redrawn UI. Each selected panel's content is removed from every layer behind it, including overlapping or nested selections, so it appears only once. Removed content is replaced with an opaque page-colored surface, not a transparent hole. Set `pageColor` to the captured page's background (default `#ffffff`); optional `backingColors` entries keyed by layer override it for differently colored containers. Backings cover only that layer's selected rectangles, leaving space outside floating panels transparent. Collapsing the layers reconstructs the screenshot; lifting a panel keeps the page surface independent of the device screen color. Selection is intentionally a separate editorial step: an extension can automate collecting pixels and geometry, while AI or a person decides which panels form a useful visual story.

## Build A Private Demo

```sh
node tools/build-captured-demo.mjs \
  --capture captures/private/example-run-01 \
  --layout captures/private/example-layout.json \
  --output 'assets/Private - Example'
```

The builder creates four self-contained 1920 x 1080 image-backed SVGs, complete `demo.json` editor settings, and a capture-layout manifest. These are real raster screenshots wrapped in SVG, not editable vector reconstructions. They preserve actual text, branding, empty states and data. Raster-backed layers are larger than the hand-drawn public demos; crop/compress their image payloads before an approved production publication if necessary.

The existing local folder discovery finds the new demo. It remains excluded from Git and `assets/demos.json`; hosted GitHub Pages shows only the public examples. Publishing real-app content requires an explicit review and approval, not just adding it to the registry.

The builder also saves `full-content.svg`, `header.svg` and `footer.svg` alongside the raw capture. The long source contains the scrolling pane without repeated fixed navigation. Per-tile screenshots and sticky-element metadata remain available for any layout requiring more careful stitching. These sources prepare future scrolling, but do not add scroll playback or automatic page-to-page transitions to the current renderer.

## Extension Direction

A browser extension could use a user-initiated active-tab grant, native visible-tab screenshots, content scripts for geometry/scrolling, and downloads for this same bundle. Same-origin frame handling is straightforward; inspecting other origins needs their explicit host permissions. No cookie-reading permission is needed. The extension would remove the macOS/DevTools UI dependency and make capture much easier to repeat. It would not inherently replace the editorial work of selecting meaningful layers, checking private data, choosing framing and deciding how pages transition.
