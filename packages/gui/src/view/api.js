import lodash from 'lodash'
import path from 'path'
import { createFallbackIpcRenderer, getIpcRenderer, getShell } from './electron.js'

let inited = false
let apiObj = null
const electronIpcRenderer = getIpcRenderer()
const ipcRenderer = electronIpcRenderer || createFallbackIpcRenderer()
const shell = getShell()

function createBrowserFallbackApi () {
  return {
    ipc: {
      on: ipcRenderer.on,
      removeAllListeners: ipcRenderer.removeAllListeners,
      invoke: async () => undefined,
      postMessage: ipcRenderer.postMessage,
      send: ipcRenderer.send,
      async openExternal () {
        return undefined
      },
      openPath () {
        return undefined
      },
    },
    setting: {
      async load () {
        return {}
      },
      async save () {
        return undefined
      },
    },
    status: {
      async get () {
        return {
          server: { enabled: false },
          proxy: { enabled: false },
          plugin: { node: {} },
        }
      },
    },
    config: {
      async get () {
        return { app: {} }
      },
      async save (newConfig = {}) {
        return { allConfig: newConfig }
      },
      async reload () {
        return { app: {} }
      },
      async update (partConfig = {}) {
        return partConfig
      },
      async resetDefault () {
        return { app: {} }
      },
      async removeUserConfig () {
        return undefined
      },
    },
    info: {
      async get () {
        return {
          version: 'browser',
          configProfiles: {
            internal: {},
            sharedRemote: {},
            personalRemote: {},
          },
        }
      },
      async getConfigDir () {
        return ''
      },
      async getLogDir () {
        return ''
      },
      async getSystemPlatform () {
        return 'browser'
      },
    },
    plugin: {
      git: {
        isEnabled () {
          return false
        },
        async close () {
          return undefined
        },
        async start () {
          return undefined
        },
      },
    },
    proxy: {
      async restart () {
        return undefined
      },
    },
    server: {
      async restart () {
        return undefined
      },
    },
    autoStart: {
      enabled () {
        return undefined
      },
    },
  }
}

export function apiInit (app) {
  if (!electronIpcRenderer) {
    apiObj = createBrowserFallbackApi()
    return Promise.resolve(apiObj)
  }

  const invoke = (api, args) => {
    return ipcRenderer.invoke('apiInvoke', [api, args]).catch((e) => {
      const notification = app.config.globalProperties.$notification
      if (notification) {
        notification.error({
          message: 'Api invoke error',
          description: e.message,
        })
      }
      throw e
    })
  }
  const send = (channel, message) => {
    console.log('ipcRenderer.send, channel=', channel, ', message=', message)
    return ipcRenderer.send(channel, message)
  }

  apiObj = {
    ipc: {
      on (channel, callback) {
        ipcRenderer.on(channel, callback)
      },
      removeAllListeners (channel) {
        ipcRenderer.removeAllListeners(channel)
      },
      invoke,
      postMessage (channel, ...args) {
        ipcRenderer.postMessage(channel, ...args)
      },
      send,
      async openExternal (href) {
        if (shell) {
          await shell.openExternal(href)
        }
      },
      openPath (file) {
        if (shell) {
          shell.openPath(path.resolve(file))
        }
      },
    },
  }

  const bindApi = (api, param1) => {
    lodash.set(apiObj, api, (param2) => {
      return invoke(api, param2 || param1)
    })
  }

  if (!inited) {
    return invoke('getApiList').then((list) => {
      inited = true
      for (const item of list) {
        bindApi(item)
      }
      console.log('api inited:', apiObj)
      return apiObj
    })
  }

  return new Promise((resolve) => {
    resolve(apiObj)
  })
}
export function useApi () {
  return apiObj
}
