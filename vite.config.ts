import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Where the wire actually lives.
 *
 * Kept in step with the `destination` of the /wire rewrite in vercel.json —
 * these two are the dev and production halves of the same proxy, and they have
 * to agree or the app behaves differently in the two places, which is exactly
 * the class of bug this proxy exists to remove.
 */
const DEFAULT_UPSTREAM = 'https://development.acnnewswire.com'

/**
 * Where the dev proxy forwards to.
 *
 * Overridable so the app can be pointed at the local mock — `npm run dev:mock`
 * sets it to http://localhost:4000. That matters because the real API lives on
 * an Azure VM that gets switched off, and when it is off Cloudflare answers 522
 * or nothing, which leaves nothing to develop or validate against.
 *
 * Note this changes the *proxy target*, not the app's base URL: the browser
 * still calls /wire on its own origin, so the proxy path stays exercised. That
 * is deliberate — pointing the app straight at the mock instead would validate
 * the app while skipping the very thing that broke in production.
 */
const UPSTREAM = process.env.WIRE_UPSTREAM || DEFAULT_UPSTREAM

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      /**
       * The browser never talks to the API directly — see src/lib/api/client.ts.
       *
       * The ACN Newswire API's CORS is an allowlist, not a wildcard: a request
       * from an origin on the list comes back with an
       * `access-control-allow-origin` header and a request from anywhere else
       * comes back with none. So a deployed origin gets blocked, and adding
       * every future preview URL to someone else's server config is not a
       * workable way to ship.
       *
       * Proxying sidesteps it entirely. The browser makes a same-origin request
       * and the server forwards it, and server-to-server has no CORS at all.
       *
       * `changeOrigin` rewrites the Host header to the upstream's, which
       * Cloudflare in front of the API requires for TLS/SNI to match.
       */
      '/wire': {
        target: UPSTREAM,
        // Rewrites the Host header to the target's, which Cloudflare in front
        // of the real API needs for TLS/SNI to match. Harmless for the mock.
        changeOrigin: true,
        rewrite: path => path.replace(/^\/wire/, ''),
      },
    },
  },
})
