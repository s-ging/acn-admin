// scripts/dev-mock.mjs
// The mock API and a dev server proxying to it, together.
//
// A script rather than `concurrently` + `cross-env` so this costs no
// dependencies — spawning two children and forwarding their output is a dozen
// lines, and the env-var syntax that differs between shells is handled here
// instead of in the npm script.

import { spawn } from 'node:child_process'

const MOCK_PORT = process.env.MOCK_PORT ?? '4000'
const children = []

function start(name, command, args, env) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    // Vite is a shell script on Windows, so it needs a shell to launch.
    shell: process.platform === 'win32',
  })

  const prefix = `[${name}] `
  const relay = stream => {
    stream.setEncoding('utf8')
    stream.on('data', chunk => {
      for (const line of chunk.split('\n')) {
        if (line.trim()) process.stdout.write(prefix + line + '\n')
      }
    })
  }
  relay(child.stdout)
  relay(child.stderr)

  child.on('exit', code => {
    process.stdout.write(`${prefix}exited (${code})\n`)
    // If either half dies the pair is useless, so take the other down with it
    // rather than leaving a dev server proxying to nothing.
    shutdown(code ?? 0)
  })

  children.push(child)
  return child
}

let shuttingDown = false
function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

start('mock', process.execPath, ['mock/server.mjs'], { MOCK_PORT })
start('vite', 'npx', ['vite'], { WIRE_UPSTREAM: `http://localhost:${MOCK_PORT}` })
