---
title: 基于 Hertz 和 Kitex 的 Go 微服务项目 | 开源项目推荐（自己给自己打广子）
date: 2023-01-23
taxonomies:
  categories: ["CloudWeGo", "Golang"]
  tags: ["CloudWeGo", "Go", "Golang", "Hertz", "KiteX"]
---

>这个项目到了今天和文章中的内容有较大差异，由于作者在23年中就开始了实习，没有太多时间维护该项目，所以一直没太关心和更新。这个项目我准备作为毕业论文的项目
到时应该会更新到3.0版本，也是我理想中的项目，敬请期待。
> 
>写在2024.5.28

## FreeCar

FreeCar 是一个基于 Hertz 与 Kitex 的全栈微服务项目，欢迎 Star。

项目地址：[CyanAsterisk/FreeCar](https://github.com/CyanAsterisk/FreeCar)

## Hertz

[Hertz](https://github.com/cloudwego/hertz) 是一个超大规模的企业级微服务 HTTP 框架，具有高易用性、易扩展、低时延等特点。

Hertz 默认使用自研的高性能网络库 Netpoll，在一些特殊场景中，相较于 go net，Hertz 在 QPS、时延上均具有一定优势。

在内部实践中，某些典型服务，如框架占比较高的服务、网关等服务，迁移 Hertz 后相比 Gin 框架，资源使用显著减少，**CPU** **使用率随流量大小降低 30%—60%** 。

> 关于 Hertz 更多的信息可移步至 [cloudwego/hertz](https://github.com/cloudwego/hertz)

## 技术栈

|   功能           |       实现                |
| ------------ | --------------------- |
| HTTP 框架    | Hertz                 |
| RPC 框架     | Kitex                 |
| 数据库       | MongoDB、MySQL        |
| 配置中心     | Nacos                 |
| 服务发现中心 | Nacos                 |
| 消息队列     | RabbitMQ              |
| 链路追踪     | Jaeger                |
| 集群监控     | Prometheus            |
| 限流中间件   | hertz-contrib/limiter |
| 部署         | docker-compose        |
| 对象存储     | 腾讯云 COS            |
| CI           | GitHub Actions        |

## 项目架构

### 调用关系

![image.png](https://picture.lanlance.cn/i/2023/08/10/64d479aa2278e.png)

### 技术架构

![image.png](https://picture.lanlance.cn/i/2023/08/10/64d479bf03dba.png)

### 服务关系


![image.png](https://picture.lanlance.cn/i/2023/08/10/64d479d1af450.png)

## 页面展示

![image.png](https://picture.lanlance.cn/i/2023/08/10/64d479e71d858.png)

## 目录介绍

| 目录   | 介绍         |
| ------ | ------------ |
| Server | 项目核心部分 |
| Shared | 可复用代码   |
| Static | 微信小程序代码 |

## 服务介绍

| 目录      | 介绍                |
|---------|-------------------|
| API     | 基于 Hertz 的网关服务
| Auth    | 用户认证服务            |
| Blob    | 与图片和腾讯云 COS 相关的服务 |
| Car     | 汽车服务              |
| Profile | 主页与图片识别服务         |
| Trip    | 行程服务              |

## 快速开始

### 启动基础环境

```shell
make start
```

### 配置 Nacos

> 在浏览器上访问 `http://127.0.0.1:8848/nacos/index.html#/login` 进行登录。
>
> 默认命名空间以及配置组等请参考各个 `config.yaml` 配置文件。

![image.png](https://picture.lanlance.cn/i/2023/08/10/64d479fb2c66b.png)
![image.png](https://picture.lanlance.cn/i/2023/08/10/64d47a0b85aaf.png)


关于配置中心的详细配置，[详见](https://github.com/CyanAsterisk/FreeCar/blob/dev/static/docs/NACOS_CONFIG.md)。

### 生成数据表

```shell
make migrate
```

### 启动 HTTP 服务

```shell
make api
```

### 启动微服务

```shell
make auth
make blob
make car
make profile
make trip
```

### Jaeger

> 在浏览器上访问 `http://127.0.0.1:16686/`

![image.png](https://picture.lanlance.cn/i/2023/08/10/64d47a1fb465c.png)

### Prometheus

> 在浏览器上访问 `http://127.0.0.1:3000/`

![image.png](https://picture.lanlance.cn/i/2023/08/10/64d47a435d42f.png)

## API 请求

项目的 API 请求示例[详见](https://github.com/CyanAsterisk/FreeCar/blob/dev/static/docs/API_REQUEST.md)。

## 开发指南

通过直接阅读源码来了解此项目是非常困难的，在此提供开发指南方便开发者快速了解并上手此项目包括 Kitex、Hertz 等框架。

### 前置准备

通过快速开始中的命令快速启动所需的工具与环境，若需要特殊定制请修改 `docker-compose.yaml` 与 Nacos 配置中的内容。

### IDL

在开发之前我们需要定义好 IDL 文件，其中 hz
为开发者提供了许多定制化的 [api 注解](https://www.cloudwego.io/zh/docs/hertz/tutorials/toolkit/toolkit/#%E6%94%AF%E6%8C%81%E7%9A%84-api-%E6%B3%A8%E8%A7%A3)。

示例代码：

```thrift
namespace go auth

struct LoginRequest {
    1: string code
}

struct LoginResponse {
    1: i64 accountID
}

service AuthService {
    LoginResponse Login(1: LoginRequest req)
}
```

### 代码生成

#### Kitex

在新增服务目录下执行，每次仅需更改服务名与 IDL 路径。

##### 服务端

```shell
kitex -service auth -module github.com/CyanAsterisk/FreeCar ./../../idl/auth.thrift
```

##### 客户端

```shell
kitex -module github.com/CyanAsterisk/FreeCar ./../../idl/auth.thrift
```

注意项：

- 用 `-module github.com/CyanAsterisk/FreeCar` 该参数用于指定生成代码所属的 Go 模块，避免路径问题。
- 当前服务需要调用其他服务时需生成客户端文件。

#### Hertz

##### 初始化

```shell
hz new -idl ./../../idl/api.proto -mod github.com/CyanAsterisk/FreeCar/server/cmd/api
```

##### 更新

```shell
hz update -I -idl ./../../idl/api.proto
```

注意项：

- 用 `-module github.com/CyanAsterisk/FreeCar/server/cmd/api` 该参数用于指定生成代码所属的 Go 模块，避免路径问题。

### 业务开发

在代码生成完毕后需要先将一些必须组件添加到项目中。由于 api 层不必再次添加，因此以下主要讲解关于 Kitex-Server
部分，代码位于 `server/cmd` 下。

#### Config

参考 `server/cmd/auth/config`，为微服务的配置结构体。

#### Global

参考 `server/cmd/auth/global`，为微服务提供可全局调用的方法。

#### Initialize

参考 `server/cmd/auth/initialize`，提供必要组件的初始化功能，其中 `nacos.go` `flag.go` `logger.go` 为必须项。

#### Tool

参考 `server/cmd/auth/tool`，提供微服务的工具函数，其中 `port.go` 为必须项。

#### API

在写网关层的业务逻辑时，仅需要每次更新 IDL 与新的微服务客户端代码，若需要添加新的组件直接添加即可，项目高度可拔插，架构与微服务层相似。

网关层的业务逻辑在 `server/cmd/api/biz` 下，大部分代码会自动生成。若需要单独新增路由需要到 `server/cmd/api/router.go` 中。

关于中间件的使用，只需要在 `server/cmd/api/biz/router/api/middleware.go` 中添加中间件逻辑即可。

## 许可证

FreeCar 在 GNU General Public 许可证 3.0 版下开源。

## 总结

这个项目还是花费的不少时间，欢迎大家学习，如果 Star 是对我们最大的鼓励！

## 参考

- [CyanAsterisk/FreeCar](https://github.com/CyanAsterisk/FreeCar)
- [cloudwego/hertz](https://github.com/cloudwego/hertz)
- [cloudwego/kitex](https://github.com/cloudwego/kitex)