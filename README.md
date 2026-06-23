> **Note**: This was an experiment and is now frozen in time.

# blue-earth

`blue-earth` is an interactive 3D globe for good-news climate stories, built as a showcase for the WICG HTML-in-Canvas API. The globe is rendered with Three.js, story cards are real HTML elements inside the canvas subtree, and the data pipeline is designed to fetch, extract, geocode, and prepare climate-action stories for the demo.

Current story sources include:

- The Guardian Open Platform
- Positive News
- Carbon Brief
- Yale Environment 360
- Inside Climate News
- Grist
- Yale Climate Connections
- Climate Home News

## Requirements

- Chrome Canary
- The `chrome://flags/#canvas-draw-element` flag enabled
- Node.js and Vite+ (`vp`)

This project is intentionally experimental and currently targets Chromium Canary desktop for the full experience.

## Environment Variables

Create a `.env` file in the project root with:

```bash
GUARDIAN_API_KEY=your_guardian_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GEOAPIFY_API_KEY=your_geoapify_api_key
```

Optional:

```bash
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

What each key is for:

- `GUARDIAN_API_KEY`: fetches source articles from The Guardian Open Platform
- `ANTHROPIC_API_KEY`: extracts the primary location from article title/summary content
- `GEOAPIFY_API_KEY`: geocodes extracted places into latitude/longitude coordinates
- `ANTHROPIC_MODEL`: optional override for the Anthropic model used by the extraction step

## Local Development

Install dependencies:

```bash
vp install
```

Start the dev server:

```bash
vp dev
```

Run validation:

```bash
vp check
vp test
```

Build for production:

```bash
vp build
```

## Story Data

Right now the app ships with fixture story data in [public/data/stories.json](/Users/schalkneethling/dev/opensource/blue-earth/public/data/stories.json:1). That means:

- the interaction model is real
- the card rendering is real
- the current article URLs are placeholders unless the pipeline has been run

To build real story data:

```bash
vp run pipeline:build
```

The generated payload includes a `generatedAt` timestamp, which the UI surfaces so you can see how fresh the current story set is.

Available pipeline steps:

```bash
vp run pipeline:fetch
vp run pipeline:extract
vp run pipeline:geocode
vp run pipeline:build
```

## NASA Texture

The globe now uses NASA’s Blue Marble city-lights texture, stored locally in:

- [src/assets/earth-night-lights.jpg](/Users/schalkneethling/dev/opensource/blue-earth/src/assets/earth-night-lights.jpg:1)

Reference sources:

- [NASA Earth Observatory: The Blue Marble (2002)](https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution)
- [Visible Earth: Earth’s City Lights](https://visibleearth.nasa.gov/images/55167/earths-city-lights)

## Project Structure

```text
blue-earth/
├── public/data/stories.json
├── pipeline/
│   ├── fetch-stories.js
│   ├── extract-locations.js
│   ├── geocode.js
│   ├── build-queue.js
│   └── shared.js
├── src/
│   ├── assets/
│   ├── debug/
│   ├── feed/
│   ├── globe/
│   ├── types/
│   ├── main.ts
│   └── style.css
└── README.md
```

## Notes

- The HTML-in-Canvas interaction model is still experimental, so event behavior may differ from normal DOM expectations.
- If you want to inspect pointer/click behavior, open DevTools and run:

```js
enableBlueEarthEventDebug();
```

Disable it with:

```js
disableBlueEarthEventDebug();
```
