# StoryCrafter + AI (Frontend - Rebuilt)

## How it works
- Use the **Editor** to add Scenes (text + optional image/video) and Characters.
- Click **Preview** → the preview page will automatically generate the story using the AI connector and display it.
- The **Final** page shows the story and references. You can download `.txt` or PDF.

## Setup (Frontend only / mock mode)
No backend? It still works with a mock response so you can demo instantly.
- Open `index.html` in a browser.
- To enable real AI, set `AI_CONFIG.API_BASE_URL` in `assets/js/ai.js` to your backend URL.

## File Map
- `index.html`, `signup.html`, `login.html`, `dashboard.html`, `editor.html`, `preview.html`, `final.html`, `mystories.html`
- `assets/js/storage.js` (localStorage utilities)
- `assets/js/ai.js` (prompt builder + fetch to backend)
- `server/server.js` (optional proxy to OpenAI or other provider)

## Notes
- References are only shown if the AI returns them. If your story is purely fictional, AI should return `references: []`.
- You can change genre/tone at the top of **Editor**.
