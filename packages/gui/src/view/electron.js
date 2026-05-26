function createNoopIpcRenderer () {
  const noop = () => {}

  return {
    on: noop,
    once: noop,
    removeListener: noop,
    removeAllListeners: noop,
    send: noop,
    postMessage: noop,
    invoke: async () => undefined,
  }
}

let cachedElectron

function resolveElectronRequire () {
  if (typeof window !== 'undefined' && typeof window.require === 'function') {
    return window.require
  }

  if (typeof globalThis !== 'undefined' && typeof globalThis.require === 'function') {
    return globalThis.require
  }

  return null
}

export function getElectron () {
  if (cachedElectron !== undefined) {
    return cachedElectron
  }

  const electronRequire = resolveElectronRequire()
  if (!electronRequire) {
    cachedElectron = null
    return cachedElectron
  }

  try {
    cachedElectron = electronRequire('electron')
  } catch (e) {
    cachedElectron = null
  }

  return cachedElectron
}

export function getIpcRenderer () {
  return getElectron()?.ipcRenderer || null
}

export function getShell () {
  return getElectron()?.shell || null
}

export function createFallbackIpcRenderer () {
  return createNoopIpcRenderer()
}
