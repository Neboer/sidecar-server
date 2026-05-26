# dev-sidecar

原项目参考 https://github.com/docmirror/dev-sidecar

本项目fork了原项目，并且将其变成了一个可以简易安装+无头启动的Linux cli服务器，并保留其完整核心功能。

## 安装

1. 下载最新release中的 tar.gz / zip 包，解压。
2. 系统需要安装 nodejs 、npm 和 pnpm。
  ```bash
  pnpm config set registry https://registry.npmmirror.com
  ```
3. 进入解压后的目录，安装依赖。
  ```bash
  pnpm install
  ```
4. 配置服务器

服务器运行之前，需要将最新的规则列表导入。方法为

下载
`https://raw.giteeusercontent.com/wangliang181230/dev-sidecar-config/raw/main/remote_config.json`
到
`~/.dev-sidecar/remote_config.json5`

这一步非常重要，必须完成，否则大多数规则不会生效

5. 启动服务器。
  ```bash
  start-server.sh
  ```
  Windows 用户请执行 ps1.

## 使用

服务器会启动一个代理服务器，默认地址是 `127.0.0.1:31181`。

最好将sidecar证书安装进你使用的ca证书库，其证书路径为 `~/.dev-sidecar/dev-sidecar.ca.crt`

比如在Linux系统中，可以将证书复制到 `/usr/local/share/ca-certificates/` 目录下，并运行 `sudo update-ca-certificates` 来更新系统的CA证书库。

如果希望Python信任，可以将证书路径添加到环境变量 `SSL_CERT_FILE` 中：

```bash
export SSL_CERT_FILE=~/.dev-sidecar/dev-sidecar.ca.crt
```