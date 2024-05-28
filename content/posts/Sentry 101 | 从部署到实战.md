---
title: Sentry 101 | 从部署到实战
date: 2023-08-11
taxonomies:
  categories: ["DevOps"]
  tags: ["DevOps", "Sentry", "运维"]
---

## 前言

在太极实习这段时间对 Sentry 有非常多的实践，借着这个机会我们将深入探讨 Sentry，这是一个强大的错误追踪系统。本文将详细解析 Sentry 的部署过程，并探讨如何在实际项目中利用 Sentry 进行错误追踪和性能监控。我们希望读者通过阅读本文，能全面理解 Sentry 的功能，并能在自己的项目中有效地应用 Sentry。

## 部署自托管

### 最低要求

- **Docker** 19.03.6+
- **Compose** 1.28.0+
- **4 CPU** Cores
- **8 GB** RAM
- **20 GB** Free Disk Space

### 安装 Docker

先让我们尝试输入命令 `docker`，会得到“命令未找到”的提示，还有如何安装的建议：

```sh  
Command 'docker' not found, but can be installed with:  
sudo apt install docker.io  
```  

所以，你只需要按照系统的提示，“照葫芦画瓢”输入命令，安装 `docker.io` 就可以了。为了方便，你还可以使用 `-y`参数来避免确认，实现自动化操作：

```bash  
sudo apt install -y docker.io #安装Docker Engine  
```  

刚才说过，Docker Engine 不像 Docker Desktop 那样可以安装后就直接使用，必须要做一些手工调整才能用起来，所以你还要在安装完毕后执行下面的两条命令：

```bash  
sudo service docker start         #启动docker服务  
sudo usermod -aG docker ${USER}   #当前用户加入docker组  
```  

第一个`service docker start`是启动 Docker 的后台服务，第二个`usermod -aG`是把当前的用户加入 Docker 的用户组。这是因为操作 Docker 必须要有 root 权限，而直接使用 root 用户不够安全，**加入 Docker 用户组是一个比较好的选择，这也是 Docker 官方推荐的做法**。当然，如果只是为了图省事，你也可以直接切换到 root 用户来操作 Docker。

### 安装 Docker Composer

```sh  
sudo curl -SL https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose  
  
sudo chmod +x /usr/local/bin/docker-compose  
  
sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose  
```  

可以通过 `docker-compose version` 来查看版本。

```sh  
docker-compose version  
  
Docker Compose version v2.20.2  
```  

### 安装 Sentry

使用脚本安装是最快的方法，如果需要自定义配置可以更改官方提供的脚本。

```sh  
git clone https://github.com/getsentry/self-hosted sentry  
```  

上面的代码会将库克隆到名为 Sentry 的文件夹中。可以通过将命令末尾的 Sentry 更改为想要的名称来更改。然后 cd 进入刚刚创建的目录并运行以下命令开始安装过程：

```sh  
./install  
```  

安装过程中，会出现提示询问我们是否要创建用户。如果想要安装不会被提示终端，可以运行：

```sh  
./install.sh --skip-user-prompt  
```  

安装需要一段时间，如果安装成功你应该看到以下内容

![](https://picture.lanlance.cn/i/2023/08/11/64d5c9ed4bc1b.png)

现在我们可以运行提示的命令并且启动 Sentry

```sh  
docker-compose up -d  
```  

>命令执行完毕之后我们可以通过 `http://{server_ip}:9000/` 来访问 Sentry

### 创建用户

如果在运行安装命令时使用了 `--skip-user-prompt`，则需要通过终端创建用户。

```sh  
alias sentry="docker-compose run --rm web"  
sentry createuser  
```  

## Caddy 反向代理

### Caddy

#### Caddy 是什么

Caddy 是一个多功能的 HTTP web 服务器，并且使用 Let's Encrypt 提供的免费证书，自动让网站升级到 HTTPS
#### Caddy 特点

- 缺省启用 HTTP/2 协议，无需任何配置。
- 缺省全站 HTTPS，无需任何配置。（自动申请和续期证书）
- 简单友好的配置文件，支持在线配置 API。
- Golang 开发，几乎无依赖，部署简单。
- 充当 API Gateway, 反向代理后端多个 Web 节点。
#### Caddy 安装

##### Fedora RHEL/CentOS 8

```sh  
$ dnf install 'dnf-command(copr)'  
$ dnf copr enable @caddy/caddy  
$ dnf install caddy  
```  

##### RHEL/CentOS 7

```sh  
$ yum install yum-plugin-copr  
$ yum copr enable @caddy/caddy  
$ yum install caddy  
```  

##### Debian Ubuntu Raspbian

```sh  
$ sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https  
$ curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo tee /etc/apt/trusted.gpg.d/caddy-stable.asc  
$ curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list  
$ sudo apt update  
$ sudo apt install caddy  
```  

##### Arch Linux Manjaro Parabola

```sh  
$ pacman -Syu caddy  
```  

>更多安装方式可以参考官方文档，[Install — Caddy Documentation](https://caddyserver.com/docs/install)

#### Caddy 入门

这里主要介绍我们今天会使用到的反向代理，别的一些功能大家可以到官方文档查阅。

##### Command Line

反向代理 2080 端口到 9000 端口

```sh  
caddy reverse-proxy --from :2080 --to :9000  
```  

通过以下命令进行测试

```sh  
curl -v 127.0.0.1:2080  
```  

##### Caddyfile

这里更加推荐使用 Caddyfile 进行配置，方便许多。我们同样实现上面的功能。

```Caddyfile  
:2080   
reverse_proxy :9000  
```  

通过下面的命令启动

```sh  
caddy run  
```  

通过以下命令进行测试

```sh  
curl -v 127.0.0.1:2080  
```  

如果是使用域名，将第一行更换为域名即可，并且会自动申请证书，开启 HTTPS。

### 为 Sentry 配置域名

首先我们需要通过 DNS 将域名指向我们的服务器 IP，接着就可以将配置写到 Caddyfile 中。

```Caddyfile  
sentry.example.com {  
  
# Set this path to your site's directory.  
  
root * /usr/share/caddy  
  
# Enable the static file server.  
  
file_server  
  
# Another common task is to set up a reverse proxy:  
  
reverse_proxy localhost:9000  
  
# Or serve a PHP site through php-fpm:  
  
# php_fastcgi localhost:9000  
  
}  
```  

现在我们就可以直接通过域名访问 Sentry 的后台管理系统了，如果部署端口不同可以自行进行配置。

## 实战

这里以 Python 为例，如果使用别的语言也是类似的，详细可以参考官方文档。

### 快速开始

1. 首先安装 sentry-sdk

```sh  
pip install --upgrade sentry-sdk  
```  

2. 在项目中初始化 sentry

```python  
import sentry_sdk  
  
sentry_sdk.init(  
    dsn="https://examplePublicKey@o0.ingest.sentry.io/0",  
    # Set traces_sample_rate to 1.0 to capture 100%    # of transactions for performance monitoring.    # We recommend adjusting this value in production.    traces_sample_rate=1.0,)  
```  

这里的 DSN 填写在后台管理创建项目中得到的 DSN。

![dsn](https://picture.lanlance.cn/i/2023/08/25/64e83f4163586.png)

接着在项目中如果出现了报错或日志输出，就能在 Sentry 中得到清晰的结果。

例如下面是一个 HTTPException，他会将报错的位置呈现到 Issue 中。

![img](https://picture.lanlance.cn/i/2023/08/25/64e83eeb9577c.png)

### 配置

默认配置在大多数时候是够用的，但是如果我们需要到线上长期使用可能需要对一些配置进行自定义。例如 `traces_sample_rate` 字段就可以根据线上实际情况进行配置，如果 issue 在运行时比较多的话可以设置为 0.5。

其余配置都可以到官方文档进行参考和修改。

> [https://docs.sentry.io/platforms/python/configuration](https://docs.sentry.io/platforms/python/configuration)

## 总结

本文详细介绍了如何部署和使用 Sentry。我们首先解析了如何使用 Docker 和 Docker Compose 部署 Sentry，然后探讨了如何在项目中利用 Sentry 进行错误追踪和性能监控。最后，我们还详细解析了如何使用 Caddy 为 Sentry 配置域名和 HTTPS。我们希望读者能通过本文，更有效地在自己的项目中应用 Sentry。

## 参考

[caddyserver.com](https://caddyserver.com/docs/)  
https://github.com/getsentry/self-hosted  
[https://docs.sentry.io/](https://docs.sentry.io/)