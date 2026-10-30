# Daymark Journal

A thoughtful, offline-capable journal, reading tracker, and PWA built with HTML, CSS, and vanilla JavaScript. Vite is used for development and bundling.

## Features

- Add, edit, and delete journal entries, books, tasks, and goals
- Local storage persistence with JSON import/export
- Reading and activity statistics
- Discover book recommendations from Open Library
- Free public-domain books with in-app reading and downloads
- Progressive Web App with installable manifest, offline shell, and native install prompt
- Responsive desktop, tablet, mobile, and installed PWA layouts

## Navigation

- **Home** and **Library** are available directly in the top navigation.
- **Get Inspired** is a dropdown containing:
  - Discover
  - Free Books
- **Personal Workspace** is a dropdown containing:
  - Journal
  - To Do
  - Goals
- **Docs** opens this guide inside the app.

The mobile menu uses the same grouped structure. Dropdowns support click/tap, keyboard focus, active states, outside-click closing, and Escape. Selecting any item closes the menu and navigates to the page.

## PWA installation

- `public/manifest.webmanifest` defines the app name, start URL, standalone display, theme, and 192px/512px icons (including a maskable icon).
- `public/sw.js` caches the app shell, uses network-first navigation, and provides an offline fallback.
- The **Get App** button uses the browser's `beforeinstallprompt` event. When available, it stores the deferred prompt and triggers the native install flow on click.
- Installation success is reported only after the browser fires `appinstalled`. Cancelled installations are reported as cancelled.
- If native installation is unavailable, the app shows browser-specific instructions (Safari on iOS, browser menu on Android/desktop) instead of claiming the app was installed.
- Installation requires HTTPS (or localhost for development).

## Lazy loading

- Free Books uses paginated catalogue requests with a **Load more books** button and an IntersectionObserver sentinel for automatic loading near the end of the list.
- Discover uses Open Library pagination with a **Load more recommendations** button and an IntersectionObserver sentinel.
- Requests are de-duplicated with loading guards, request IDs, and ID/title checks. Loaded results are cached in memory/localStorage where appropriate.
- Loading indicators are shown in the catalog, the load-more buttons, and the page loader.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Structure

- `index.html` - app shell, navigation, install button, and modals
- `app.js` - application state, routing, rendering, PWA install flow, and lazy loading
- `style.css` - design system and responsive layouts
- `public/sw.js` - service worker (offline shell + runtime cache)
- `public/manifest.webmanifest` - PWA manifest
- `public/icons/` - install icons (192, 512, maskable)
- `vite.config.js` - Vite config
- `vercel.json` - deployment, rewrites, and PWA headers
- `dist/` - build output

## Deployment

Configured for Vercel. The build output directory is `dist`. Vercel serves the site over HTTPS, which is required for service workers and PWA installation. `vercel.json` also sets the service worker to no-cache and the manifest content type to `application/manifest+json`.
