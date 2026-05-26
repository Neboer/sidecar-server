const fs = require('node:fs')
const path = require('node:path')

const bannerPath = path.join(__dirname, 'banner.txt')
const mitmproxyPath = path.join(__dirname, 'mitmproxy.js')

let DevSidecar
let configLoader

function getDeps () {
  if (!DevSidecar) {
    DevSidecar = require('@docmirror/dev-sidecar')
    configLoader = require('@docmirror/dev-sidecar/src/config/local-config-loader')
  }

  return { DevSidecar, configLoader }
}

function parseArgs (argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      continue
    }

    const raw = token.slice(2)
    if (raw === 'help' || raw === 'h') {
      args.help = true
      continue
    }

    const [key, inlineValue] = raw.split('=', 2)
    if (inlineValue != null) {
      args[key] = inlineValue
      continue
    }

    const next = argv[i + 1]
    if (next != null && !next.startsWith('--')) {
      args[key] = next
      i += 1
    } else {
      args[key] = true
    }
  }
  return args
}

function printUsage () {
  console.log('用法: dev-sidecar-cli [--port 31181] [--host 127.0.0.1] [--help]')
  console.log('默认以默认模式启动：开启请求拦截、开启远程配置、关闭系统代理、关闭增强插件，仅启动本地代理服务。')
}

function buildDefaultServerConfig (baseConfig, argv) {
  const config = structuredClone(baseConfig)
  config.app = config.app || {}
  config.app.mode = 'default'
  config.app.remoteConfig = {
    ...(config.app.remoteConfig || {}),
    enabled: true,
  }

  config.server = config.server || {}
  config.server.enabled = true
  config.server.intercept = {
    ...(config.server.intercept || {}),
    enabled: true,
  }
  config.server.dns = config.server.dns || {}
  config.server.dns.speedTest = {
    ...(config.server.dns.speedTest || {}),
    enabled: true,
  }

  config.proxy = {
    ...(config.proxy || {}),
    enabled: false,
  }

  if (argv.host) {
    config.server.host = argv.host
  }
  if (argv.port) {
    const port = Number.parseInt(argv.port, 10)
    if (!Number.isNaN(port) && port > 0) {
      config.server.port = port
    }
  }

  return config
}

function printStartupSummary (config) {
  const host = config.server?.host || '127.0.0.1'
  const port = config.server?.port || 31181
  const basePath = config.server?.setting?.userBasePath || ''

  console.log('==================== DevSidecar 服务器模式 ====================')
  console.log(`代理服务器地址: http://${host}:${port}`)
  console.log(`代理服务器地址: https://${host}:${port}`)
  console.log(`用户数据目录: ${basePath}`)
  console.log('运行模式: 默认模式（开启请求拦截、关闭系统代理、不安装证书）')
  console.log('============================================================')
}

async function startup () {
  const argv = parseArgs(process.argv)
  if (argv.help) {
    printUsage()
    return
  }

  const banner = fs.readFileSync(bannerPath)
  console.log(banner.toString())

  const { DevSidecar, configLoader } = getDeps()

  let runtimeConfig = DevSidecar.api.config.cloneDefault()
  const userConfigPath = configLoader.getUserConfigPath()
  const userConfig = configLoader.loadConfigFromFile(userConfigPath)
  DevSidecar.api.config.doMerge(runtimeConfig, userConfig)

  runtimeConfig = buildDefaultServerConfig(runtimeConfig, argv)
  DevSidecar.api.config.set(runtimeConfig)

  printStartupSummary(DevSidecar.api.config.get())
  await DevSidecar.api.startup({ mitmproxyPath })
  console.log('dev-sidecar 代理服务已启动，按 Ctrl+C 可退出')
}

async function onClose (signal = 'SIGINT') {
  console.log(`收到 ${signal}，正在关闭 dev-sidecar ...`)
  await DevSidecar.api.shutdown()
  console.log('dev-sidecar 已关闭')
  process.exit(0)
}

process.on('SIGINT', () => onClose('SIGINT'))
process.on('SIGTERM', () => onClose('SIGTERM'))

startup().catch((err) => {
  console.error('dev-sidecar 启动失败:', err)
  process.exit(1)
})
