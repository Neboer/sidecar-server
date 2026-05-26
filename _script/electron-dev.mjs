import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import process from 'node:process'

const guiDir = process.cwd()
const require = createRequire(import.meta.url)
const state = {
  closing: false,
  devServer: null,
  electron: null,
}

function spawnCommand (entry, args = [], extraEnv = {}) {
  return spawn(entry, args, {
    cwd: guiDir,
    env: { ...process.env, ...extraEnv },
    shell: false,
    stdio: 'inherit',
    windowsHide: false,
  })
}

function spawnDevServerCommand (entry, args = [], extraEnv = {}) {
  return spawn(entry, args, {
    cwd: guiDir,
    env: { ...process.env, ...extraEnv },
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: false,
  })
}

function resolveVueCliServiceBin () {
  return require.resolve('@vue/cli-service/bin/vue-cli-service.js', {
    paths: [guiDir],
  })
}

function resolveElectronBin () {
  return require('electron')
}

async function waitForServer (url, child) {
  const timeoutAt = Date.now() + 120000

  while (Date.now() < timeoutAt) {
    if (child.exitCode != null || child.signalCode != null) {
      throw new Error('Dev server exited before it became ready')
    }

    try {
      const response = await fetch(url, { method: 'GET' })
      if (response.ok || response.status >= 200) {
        return
      }
    } catch {
      // Keep polling until the dev server is reachable.
    }

    await delay(500)
  }

  throw new Error(`Timed out waiting for ${url}`)
}

async function detectDevServerUrl (child) {
  return new Promise((resolve, reject) => {
    let resolved = false
    let buffer = ''

    const finish = (url) => {
      if (!resolved) {
        resolved = true
        resolve(url)
      }
    }

    const inspectChunk = (chunk) => {
      const text = chunk.toString()
      process.stdout.write(text)
      buffer += text

      const match = buffer.match(/https?:\/\/localhost:(\d+)/i)
      if (match) {
        finish(`http://localhost:${match[1]}`)
      }

      if (buffer.length > 8192) {
        buffer = buffer.slice(-4096)
      }
    }

    child.stdout.on('data', inspectChunk)
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      process.stderr.write(text)
      buffer += text

      const match = buffer.match(/https?:\/\/localhost:(\d+)/i)
      if (match) {
        finish(`http://localhost:${match[1]}`)
      }

      if (buffer.length > 8192) {
        buffer = buffer.slice(-4096)
      }
    })

    child.on('exit', (code, signal) => {
      if (!resolved) {
        reject(new Error(`Dev server exited before its URL was detected (code=${code}, signal=${signal || ''})`))
      }
    })
  })
}

function stopChild (child) {
  if (!child || child.exitCode != null || child.signalCode != null) {
    return
  }

  child.kill('SIGTERM')
}

async function shutdown (code = 0) {
  if (state.closing) {
    return
  }

  state.closing = true
  stopChild(state.electron)
  stopChild(state.devServer)
  process.exitCode = code
}

process.on('SIGINT', () => {
  void shutdown(0)
})
process.on('SIGTERM', () => {
  void shutdown(0)
})

async function main () {
  const vueCliServiceBin = resolveVueCliServiceBin()
  const electronBin = resolveElectronBin()
  state.devServer = spawnDevServerCommand(process.execPath, [vueCliServiceBin, 'serve'])
  state.devServer.on('exit', (code, signal) => {
    if (!state.closing) {
      void shutdown(code ?? (signal ? 1 : 0))
    }
  })

  try {
    const devServerUrl = await detectDevServerUrl(state.devServer)
    console.log(`Dev server URL: ${devServerUrl}`)
    await waitForServer(devServerUrl, state.devServer)
    state.electron = spawnCommand(electronBin, ['.'], {
      WEBPACK_DEV_SERVER_URL: devServerUrl,
    })
    state.electron.on('exit', (code, signal) => {
      void shutdown(code ?? (signal ? 1 : 0))
    })
  } catch (error) {
    console.error(error)
    await shutdown(1)
  }
}

void main()
