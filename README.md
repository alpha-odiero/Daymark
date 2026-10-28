# Daymark Journal

A simple, offline-capable journal/PWA built with HTML, CSS, and JavaScript. Vite is used for bundling/development.

## Features
- Add/edit/delete journal entries
- Local storage persistence
- Stats/visualization
- Progressive Web App (service worker + manifest)

## Scripts
```bash
npm install
npm run dev
npm run build
npm run preview
```

## Structure
- `index.html` - entry point
- `app.js` - app logic
- `style.css` - styles
- `public/sw.js` - service worker
- `vite.config.js` - Vite config
- `dist/` - build output

## Deployment
Configured for Vercel (`vercel.json`).
