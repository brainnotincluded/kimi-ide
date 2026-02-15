# Media Assets

This folder contains visual assets for the Kimi IDE extension.

## Files

### Icons
- `icon.svg` - Main extension icon (SVG source)
- `icon-dark.svg` - Icon optimized for dark themes (16x16, 24x24)
- `icon-light.svg` - Icon optimized for light themes (16x16, 24x24)
- `icon.png` - Main extension icon in PNG format (128x128)

### Logo
- `logo.svg` - Full logo with text for README and documentation
- `logo.png` - Logo in PNG format for README

### Demo & Screenshots
- `demo.gif` - Animated demonstration of extension features
- `chat-panel-preview.png` - Screenshot of the chat panel interface

## Icon Design Guidelines

The icons follow VS Code design principles:
- **Simple**: Minimal details, clean shapes
- **Monoline**: Consistent stroke width
- **Scalable**: Works at 16px and larger sizes
- **Theme-aware**: Separate versions for light/dark themes

## Colors

- Primary: `#6366f1` (Indigo)
- Secondary: `#8b5cf6` (Violet)
- Accent: `#ec4899` (Pink)
- Dark text: `#1e1e1e`
- Light text: `#ffffff`

## Generating PNGs from SVGs

```bash
# Using ImageMagick
convert -background none icon.svg -resize 128x128 icon.png
convert -background none logo.svg -resize 400x120 logo.png

# Using Inkscape
inkscape icon.svg --export-filename=icon.png -w 128 -h 128
inkscape logo.svg --export-filename=logo.png -w 400 -h 120
```
