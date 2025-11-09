# PotionWatch (scaffold)

This is a scaffold for the PotionWatch dashboard (React + Vite + Tailwind).

Quick start (from the `potionwatch` folder):

1. npm install
2. npm run dev

Notes:
- This project includes a WebSocket simulator in `src/services/websocket.js` that emits randomized level updates so the UI can demonstrate live updates.
- Map uses `maplibre-gl` with a public demo style. Replace with your tiles/server later.
- The `usePotionStore` Zustand store holds cauldrons, alerts and history.

Next steps:
- Run `npm install` to install dependencies.
- Optionally wire to a real backend (FastAPI) at `/api/history` and WebSocket `/api/live`.
