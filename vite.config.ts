import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The ACN Newswire API allows specific dev origins, not any localhost port:
    // http://localhost:5173 gets an access-control-allow-origin header back and
    // http://localhost:5174 gets none. Vite's default behaviour on a busy port
    // is to quietly take the next one, which would start the app on an origin
    // the API refuses — and the symptom is every request failing CORS, which
    // looks nothing like "wrong port". Fail to start instead.
    port: 5173,
    strictPort: true,
  },
})
