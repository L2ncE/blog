---
title: 原来防御 CSRF 攻击这么简单？ —— Hertz CSRF 中间件实战
date: 2022-11-25
taxonomies:
  categories: ["Golang", "CloudWeGo"]
  tags: ["Go", "Golang", "CloudWeGo", "反向代理", "Hertz"]
---

## Hertz

[Hertz](https://github.com/cloudwego/hertz) 是一个超大规模的企业级微服务 HTTP 框架，具有高易用性、易扩展、低时延等特点。

Hertz 默认使用自研的高性能网络库 Netpoll，在一些特殊场景中，相较于 go net，Hertz 在 QPS、时延上均具有一定优势。

在内部实践中，某些典型服务，如框架占比较高的服务、网关等服务，迁移 Hertz 后相比 Gin 框架，资源使用显著减少，**CPU** **使用率随流量大小降低 30%—60%** 。

> 关于 Hertz 更多的信息可移步至 [cloudwego/hertz](https://github.com/cloudwego/hertz)

## 反向代理

反向代理在计算机网络中是代理服务器的一种。

服务器根据客户端的请求，从其关系的一组或多组后端服务器（如 Web 服务器）上获取资源，然后再将这些资源返回给客户端，客户端只会得知反向代理的 IP 地址，而不知道在代理服务器后面的服务器集群的存在。

## Hertz 反向代理实战

在 Hertz 中使用反向代理需要拉取社区提供的 [reverseproxy](https://github.com/hertz-contrib/reverseproxy) 拓展。

```sh
$ go get github.com/hertz-contrib/reverseproxy
```

### 基本使用

```go
package main

import (
        "context"

        "github.com/cloudwego/hertz/pkg/app"
        "github.com/cloudwego/hertz/pkg/app/server"
        "github.com/cloudwego/hertz/pkg/common/utils"
        "github.com/hertz-contrib/reverseproxy"
)

func main() {
        h := server.Default(server.WithHostPorts("127.0.0.1:8000"))
        proxy, err := reverseproxy.NewSingleHostReverseProxy("http://127.0.0.1:8000/proxy")
        if err != nil {
                panic(err)
        }
        h.GET("/proxy/backend", func(cc context.Context, c *app.RequestContext) {
                c.JSON(200, utils.H{
                        "msg": "proxy success!!",
                })
        })
        h.GET("/backend", proxy.ServeHTTP)
        h.Spin()
}
```

我们通过 `NewSingleHostReverseProxy` 函数设置了反向代理的目标路径 `/proxy` 。接下来注册路由的路径为反向代理目标路径的子路径 `/proxy/backend` ，最后通过注册 `/backend` 映射反向代理服务 `proxy.ServeHTTP` 。这样我们通过 GET 方法访问 `/backend` 时就会访问到 `/proxy/backend` 中的内容。

```sh
curl 127.0.0.1:8000/backend

{"msg":"proxy success!!"}
```

### 自定义配置

当然，拓展不只是能够实现简单的反向代理，在 reverseproxy 拓展中提供了许多可以自定义的可选项。

| 方法                  | 描述                                  |
| ------------------- | ----------------------------------- |
| `SetDirector`       | 用于指定 protocol.Request               |
| `SetClient`         | 用于指定转发的客户端                          |
| `SetModifyResponse` | 用于指定响应修改方法                          |
| `SetErrorHandler`   | 用于指定处理到达后台的错误或来自 modifyResponse 的错误 |

#### SetDirector & SetClient

我们通过实现一个简单的服务注册发现来进实践使用 `SetDirector` 和 `SetClient` 。

##### Server

```go
package main

import (
        "context"

        "github.com/cloudwego/hertz/pkg/app"
        "github.com/cloudwego/hertz/pkg/app/server"
        "github.com/cloudwego/hertz/pkg/app/server/registry"
        "github.com/cloudwego/hertz/pkg/common/utils"
        "github.com/cloudwego/hertz/pkg/protocol/consts"
        "github.com/hertz-contrib/registry/nacos"
)

func main() {
        addr := "127.0.0.1:8000"
        r, _ := nacos.NewDefaultNacosRegistry()
        h := server.Default(
                server.WithHostPorts(addr),
                server.WithRegistry(r, &registry.Info{
                        ServiceName: "demo.hertz-contrib.reverseproxy",
                        Addr:        utils.NewNetAddr("tcp", addr),
                        Weight:      10,
                }),
        )
        h.GET("/backend", func(cc context.Context, c *app.RequestContext) {
                c.JSON(consts.StatusOK, utils.H{"ping": "pong"})
        })
        h.Spin()
}
```

这里使用了 [hertz-contrib/registry](https://github.com/hertz-contrib/registry) 拓展中 server 端的示例代码，由于这并不是本文的主要内容所以不做展开，关于更多信息可以去到 registry 库中。

##### Client

```go
package main

import (
        "github.com/cloudwego/hertz/pkg/app/client"
        "github.com/cloudwego/hertz/pkg/app/middlewares/client/sd"
        "github.com/cloudwego/hertz/pkg/app/server"
        "github.com/cloudwego/hertz/pkg/common/config"
        "github.com/cloudwego/hertz/pkg/protocol"
        "github.com/hertz-contrib/registry/nacos"
        "github.com/hertz-contrib/reverseproxy"
)

func main() {
        cli, err := client.NewClient()
        if err != nil {
                panic(err)
        }
        r, err := nacos.NewDefaultNacosResolver()
        if err != nil {
                panic(err)
        }
        cli.Use(sd.Discovery(r))
        h := server.New(server.WithHostPorts(":8741"))
        proxy, _ := reverseproxy.NewSingleHostReverseProxy("http://demo.hertz-contrib.reverseproxy")
        proxy.SetClient(cli)
        proxy.SetDirector(func(req *protocol.Request) {
                req.SetRequestURI(string(reverseproxy.JoinURLPath(req, proxy.Target)))
                req.Header.SetHostBytes(req.URI().Host())
                req.Options().Apply([]config.RequestOption{config.WithSD(true)})
        })
        h.GET("/backend", proxy.ServeHTTP)
        h.Spin()
}
```

Client 部分中我们在服务发现使用了反向代理。首先通过 `SetClient` 将使用了服务发现中间件的客户端指定为我们的转发客户端，再使用 `SetDirector` 指定了我们的 protocol.Request ，并在新的 Request 中配置了服务发现的使用。

#### SetModifyResponse & SetErrorHandler

`SetModifyResponse` 与 `SetErrorHandler` 分别设置来自后端的响应以及到达后台错误的处理。 `SetModifyResponse` 实则是在设置反向代理拓展中的 `modifyResponse` ，如果后端返回任意响应，不管状态码是什么，这个方法将会被调用。如果 `modifyResponse` 方法返回一个错误，`errorHandler` 方法将会使用错误做入参被调用。

##### SetModifyResponse

```go
package main

import (
        "github.com/cloudwego/hertz/pkg/app/server"
        "github.com/cloudwego/hertz/pkg/protocol"
        "github.com/hertz-contrib/reverseproxy"
)

func main() {
        h := server.Default(server.WithHostPorts("127.0.0.1:8000"))
        // modify response
        proxy, _ := reverseproxy.NewSingleHostReverseProxy("http://127.0.0.1:8000/proxy")
        proxy.SetModifyResponse(func(resp *protocol.Response) error {
                resp.SetStatusCode(200)
                resp.SetBodyRaw([]byte("change response success"))
                return nil
        })
        h.GET("/modifyResponse", proxy.ServeHTTP)

        h.Spin()
}
```

在这里通过 `SetModifyResponse` 修改 `modifyResponse` 进以改变响应的处理内容。

**测试**

```go
curl 127.0.0.1:8000/modifyResponse

change response success
```

##### SetErrorHandler

```go
package main

import (
        "context"

        "github.com/cloudwego/hertz/pkg/app"
        "github.com/cloudwego/hertz/pkg/app/server"
        "github.com/cloudwego/hertz/pkg/common/utils"
        "github.com/hertz-contrib/reverseproxy"
)

func main() {
        h := server.Default(server.WithHostPorts("127.0.0.1:8002"))
        proxy, err := reverseproxy.NewSingleHostReverseProxy("http://127.0.0.1:8000/proxy")
        if err != nil {
                panic(err)
        }
        proxy.SetErrorHandler(func(c *app.RequestContext, err error) {
                c.Response.SetStatusCode(404)
                c.String(404, "fake 404 not found")
        })

        h.GET("/proxy/backend", func(cc context.Context, c *app.RequestContext) {
                c.JSON(200, utils.H{
                        "msg": "proxy success!!",
                })
        })
        h.GET("/backend", proxy.ServeHTTP)
        h.Spin()
}
```

我们通过 `SetErrorHandler` 指定如何处理到达后台的错误，当有错误到达后台或有来自 `modifyResponse` 的错误时就会运行指定的处理逻辑。

**测试**

```go
curl 127.0.0.1:8002/backend

fake 404 not found
```

### 中间件使用

除了基本使用外，Hertz 反向代理还支持在中间件中使用。

```go
package main

import (
        "context"
        "github.com/cloudwego/hertz/pkg/app"
        "github.com/cloudwego/hertz/pkg/app/server"
        "github.com/cloudwego/hertz/pkg/common/utils"
        "github.com/hertz-contrib/reverseproxy"
)

func main() {
        r := server.Default(server.WithHostPorts("127.0.0.1:9998"))
        r2 := server.Default(server.WithHostPorts("127.0.0.1:9997"))

        proxy, err := reverseproxy.NewSingleHostReverseProxy("http://127.0.0.1:9997")
        if err != nil {
                panic(err)
        }

        r.Use(func(c context.Context, ctx *app.RequestContext) {
                if ctx.Query("country") == "cn" {
                        proxy.ServeHTTP(c, ctx)
                        ctx.Response.Header.Set("key", "value")
                        ctx.Abort()
                } else {
                        ctx.Next(c)
                }
        })

        r.GET("/backend", func(c context.Context, ctx *app.RequestContext) {
                ctx.JSON(200, utils.H{
                        "message": "pong1",
                })
        })

        r2.GET("/backend", func(c context.Context, ctx *app.RequestContext) {
                ctx.JSON(200, utils.H{
                        "message": "pong2",
                })
        })

        go r.Spin()
        r2.Spin()
}
```

在这段实例代码中，首先初始化了两个 Hertz 实例，接着使用 `NewSingleHostReverseProxy` 设置反向代理目标为 9997 端口，在最后对两个实例分别注册了两个路径相同的路由。

**测试1**

```sh
curl 127.0.0.1:9997/backend

{"message":"pong2"}
```

```sh
curl 127.0.0.1:9998/backend

{"message":"pong1"}
```

这段代码的主要部分为中间件使用部分，我们通过 `Use` 使用中间件，在中间件逻辑中，当 `ctx.Query("country") == "cn"` 逻辑成立时调用 `proxy.ServeHTTP(c, ctx)` 使用反向代理，此时再通过实例 r 请求 `/backend` 时就会请求到反向代理目标 9997 端口中的内容。

**测试2**

```sh
curl 127.0.0.1:9998/backend?country=cn

{"message":"pong2"}
```

### 注意项

-   `NewSingleHostReverseProxy` 函数如果没有设置 `config.ClientOption` 将会使用默认的全局 `client.Client` 实例， 如果设置了 `config.ClientOption` 将会初始化一个 `client.Client` 实例。 如果你需要共享一个 `client.Client` 实例，可以使用 `ReverseProxy.SetClient` 来设置。

<!---->

-   反向代理会重置响应头，如果在请求之前修改了响应头将不会生效，这与标准库的行为不一致。

## 参考

-   [cloudwego/hertz](https://github.com/cloudwego/hertz)

<!---->

-   [cloudwego/hertz-examples](https://github.com/cloudwego/hertz-examples)

<!---->

-   [hertz-contrib/reverseproxy](https://github.com/cloudwego/hertz)
