# Lalo Random

A map-first random coordinate generator built with React, Vite and Tailwind CSS.

## Features

- Draw coordinates anywhere in the world
- Restrict draws to selected countries
- Exclude selected countries
- Choose equal-country or approximate-land-area weighting
- Optionally avoid ocean coordinates
- Visualize the generated point on the built-in world map
- Copy coordinates to the clipboard
- Fully local generation with no account or tracking

The original dataset of 197 simplified sovereign-state polygons and its geographic sampling engine are preserved in `lib/coordinate-engine.js`.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Project structure

- `app/lalo-random.tsx` — product UI and interactions
- `app/globals.css` — responsive visual system
- `lib/coordinate-engine.js` — source geographic data and sampling logic
- `components/ui` — reusable interface primitives

## Deployment

Every push to `main` runs a clean Vite build and deploys `dist/` to the live Firebase Hosting channel through GitHub Actions. The workflow can also be launched manually from the Actions tab.
