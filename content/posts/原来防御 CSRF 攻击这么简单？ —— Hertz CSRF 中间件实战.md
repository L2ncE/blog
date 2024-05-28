---
title: 原来防御 CSRF 攻击这么简单？ —— Hertz CSRF 中间件实战
date: 2022-12-04
taxonomies:
  categories: ["Golang", "CloudWeGo"]
  tags: ["Go", "Golang", "CloudWeGo", "csrf", "安全"]
---

## Hertz

[Hertz](https://github.com/cloudwego/hertz) 是一个超大规模的企业级微服务 HTTP 框架，具有高易用性、易扩展、低时延等特点。

Hertz 默认使用自研的高性能网络库 Netpoll，在一些特殊场景中，相较于 go net，Hertz 在 QPS、时延上均具有一定优势。

在内部实践中，某些典型服务，如框架占比较高的服务、网关等服务，迁移 Hertz 后相比 Gin 框架，资源使用显著减少，**CPU** **使用率随流量大小降低 30%—60%** 。

> 关于 Hertz 更多的信息可移步至 [cloudwego/hertz](https://github.com/cloudwego/hertz)

## CSRF

**跨站请求伪造**（英语：Cross-site request forgery），也被称为 **one-click attack** 或者 **session riding**，通常缩写为 **CSRF** 或者 **XSRF**， 是一种挟制用户在当前已登录的Web应用程序上执行非本意的操作的攻击方法。跟跨网站脚本（XSS）相比，**XSS** 利用的是用户对指定网站的信任，CSRF 利用的是网站对用户网页浏览器的信任。

## Hertz CSRF 实战

在 Hertz 中使用反向代理需要拉取社区提供的 [CSRF](https://github.com/hertz-contrib/csrf) 拓展。

```sh
$ go get github.com/hertz-contrib/csrf
```

### 基本使用

```go
package main
​
import (
  "context"
​
  "github.com/cloudwego/hertz/pkg/app"
  "github.com/cloudwego/hertz/pkg/app/server"
  "github.com/hertz-contrib/csrf"
  "github.com/hertz-contrib/sessions"
  "github.com/hertz-contrib/sessions/cookie"
)
​
func main() {
  h := server.Default()
​
  store := cookie.NewStore([]byte("secret"))
  h.Use(sessions.Sessions("session", store))
  h.Use(csrf.New())
​
  h.GET("/protected", func(c context.Context, ctx *app.RequestContext) {
    ctx.String(200, csrf.GetToken(ctx))
  })
​
  h.POST("/protected", func(c context.Context, ctx *app.RequestContext) {
    ctx.String(200, "CSRF token is valid")
  })
​
  h.Spin()
}
```

首先我们调用 sessions 拓展自定义一个测试用的 session ，因为后续的 token 即是通过 session 进行的生成。接下来直接使用 CSRF 中间件即可。

我们注册两个路由进行测试，先使用 GET 方法调用 `GetToken()` 函数获得通过 CSRF 中间件产生的 token。由于我们没有自定义 `KeyLookup` 选项，所以默认的值为 `header:X-CSRF-TOKEN`，我们将获得的 token 放入到 Key 为 `X-CSRF-TOKEN` 的头部中即可，若 token 无效或 Key 值设置不正确都会调用 `ErrorFunc` 返回错误。

**测试**

```go
$ curl 127.0.0.1:8888/protected
​
UMhM-eqB9CYjeuZO5o-9wJsQhb8KLQUpcRlYQnYagT4=
```

```
$ curl -X POST 127.0.0.1:8888/protected -H "X-CSRF-TOKEN=UMhM-eqB9CYjeuZO5o-9wJsQhb8KLQUpcRlYQnYagT4="
​
CSRF token is valid
```

### 自定义配置

| 配置项           | 默认值                                                                           | 介绍                                                              |
| ------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Secret        | "csrfSecret"                                                                  | 用于生成令牌（必要配置）                                                    |
| IgnoreMethods | "GET", "HEAD", "OPTIONS", "TRACE"                                             | 被忽略的方法将将视为无需 CSRF 保护                                            |
| Next          | nil                                                                           | Next 定义了一个函数，当返回真时，跳过这个 CSRF 中间件。                               |
| KeyLookup     | header：X-CSRF-TOKEN                                                           | KeyLookup 是一个"<source>：<key>"形式的字符串，用于创建一个从请求中提取令牌的Extractor。   |
| ErrorFunc     | `func(ctx context.Context, c *app.RequestContext) { panic(c.Errors.Last()) }` | 当 app.HandlerFunc 返回一个错误时，ErrorFunc 被执行                         |
| Extractor     | 基于 KeyLookup 创建                                                               | Extractor 返回 csrf token。如果设置此项，它将被用来代替基于 KeyLookup 的 Extractor。 |

#### WithSecret

```go
package main
​
import (
  "context"
  
  "github.com/cloudwego/hertz/pkg/app"
  "github.com/cloudwego/hertz/pkg/app/server"
  "github.com/hertz-contrib/csrf"
  "github.com/hertz-contrib/sessions"
  "github.com/hertz-contrib/sessions/cookie"
)
​
func main() {
  h := server.Default()
  
  store := cookie.NewStore([]byte("store"))
  h.Use(sessions.Sessions("csrf-session", store))
  h.Use(csrf.New(csrf.WithSecret("your_secret")))
  
  h.GET("/protected", func(c context.Context, ctx *app.RequestContext) {
    ctx.String(200, csrf.GetToken(ctx))
  })
  
  h.POST("/protected", func(c context.Context, ctx *app.RequestContext) {
    ctx.String(200, "CSRF token is valid")
  })
  h.Spin()
}
```

`WithSecret` 用于帮助用户设置自定义 secret 用于签发 token。通过自定义 secret 能提高生成 token 的安全性。

#### WithIgnoredMethods

```go
package main
​
import (
  "context"
​
  "github.com/cloudwego/hertz/pkg/app"
  "github.com/cloudwego/hertz/pkg/app/server"
  "github.com/hertz-contrib/csrf"
  "github.com/hertz-contrib/sessions"
  "github.com/hertz-contrib/sessions/cookie"
)
​
func main() {
  h := server.Default()
​
  store := cookie.NewStore([]byte("secret"))
  h.Use(sessions.Sessions("session", store))
  h.Use(csrf.New(csrf.WithIgnoredMethods([]string{"GET", "HEAD", "TRACE"})))
​
  h.GET("/protected", func(c context.Context, ctx *app.RequestContext) {
    ctx.String(200, csrf.GetToken(ctx))
  })
​
  h.OPTIONS("/protected", func(c context.Context, ctx *app.RequestContext) {
    ctx.String(200, "success")
  })
  h.Spin()
}
```

在 RFC7231 中，GET、HEAD、OPTIONS、TRACE 方法被认定为安全的方法，所以默认不在这四个方法中使用 CSRF 中间件。若使用时有其他需求，可以对忽略的方法进行配置，在上面的代码中取消了对 OPTIONS 方法的忽略，所以通过 OPTIONS 方法直接访问这个接口是不被允许的。

#### WithErrorFunc

```go
package main
​
import (
  "context"
  "fmt"
  "net/http"
  
  "github.com/cloudwego/hertz/pkg/app"
  "github.com/cloudwego/hertz/pkg/app/server"
  "github.com/hertz-contrib/csrf"
  "github.com/hertz-contrib/sessions"
  "github.com/hertz-contrib/sessions/cookie"
​
)
​
func myErrFunc(c context.Context, ctx *app.RequestContext) {
  if ctx.Errors.Last() == nil {
    fmt.Errorf("myErrFunc called when no error occurs")
  }
  ctx.AbortWithMsg(ctx.Errors.Last().Error(), http.StatusBadRequest)
}
​
func main() {
  h := server.Default()
​
  store := cookie.NewStore([]byte("store"))
  h.Use(sessions.Sessions("csrf-session", store))
  h.Use(csrf.New(csrf.WithErrorFunc(myErrFunc)))
​
  h.GET("/protected", func(c context.Context, ctx *app.RequestContext) {
    ctx.String(200, csrf.GetToken(ctx))
  })
  h.POST("/protected", func(c context.Context, ctx *app.RequestContext) {
    ctx.String(200, "CSRF token is valid")
  })
​
  h.Spin()
}
```

中间件提供了 `WithErrorFunc` 方便用户自定义错误处理逻辑。当用户需要有自己的错误处理逻辑时可以使用此项配置。在配置之后出现错误时则会进入到自己配置的逻辑之中。

#### WithKeyLookup

```go
package main
​
import (
  "context"
  
  "github.com/cloudwego/hertz/pkg/app"
  "github.com/cloudwego/hertz/pkg/app/server"
  "github.com/hertz-contrib/csrf"
  "github.com/hertz-contrib/sessions"
  "github.com/hertz-contrib/sessions/cookie"
)
​
func main() {
  h := server.Default()
​
  store := cookie.NewStore([]byte("store"))
  h.Use(sessions.Sessions("csrf-session", store))
  h.Use(csrf.New(csrf.WithKeyLookUp("form：csrf")))
​
  h.GET("/protected", func(c context.Context, ctx *app.RequestContext) {
    ctx.String(200, csrf.GetToken(ctx))
  })
  h.POST("/protected", func(c context.Context, ctx *app.RequestContext) {
    ctx.String(200, "CSRF token is valid")
  })
​
  h.Spin()
}
```

CSRF 中间件提供了 `WithKeyLookUp` 帮助用户设置 keyLookup。中间件将会从 source （支持的 source 包括 header、param、query、form）中提取 token。格式为 `<source>：<key>`，默认值为 `header：X-CSRF-TOKEN`。

#### WithNext

```go
package main
​
import (
  "context"
  
  "github.com/cloudwego/hertz/pkg/app"
  "github.com/cloudwego/hertz/pkg/app/server"
  "github.com/hertz-contrib/csrf"
  "github.com/hertz-contrib/sessions"
  "github.com/hertz-contrib/sessions/cookie"
)
​
func isPostMethod(_ context.Context, ctx *app.RequestContext) bool {
  if string(ctx.Method()) == "POST" {
    return true
  } else {
    return false
  }
}
​
func main() {
  h := server.Default()
​
  store := cookie.NewStore([]byte("store"))
  h.Use(sessions.Sessions("csrf-session", store))
​
  //  skip csrf middleware when request method is post
  h.Use(csrf.New(csrf.WithNext(isPostMethod)))
​
  h.POST("/protected", func(c context.Context, ctx *app.RequestContext) {
    ctx.String(200, "success even no csrf-token in header")
  })
  h.Spin()
}
```

使用此配置时可以在用户设置的某些条件下跳过此项中间件的使用。

#### WithExtractor

```go
package main
​
import (
  "context"
  "errors"
  
  "github.com/cloudwego/hertz/pkg/app"
  "github.com/cloudwego/hertz/pkg/app/server"
  "github.com/hertz-contrib/csrf"
  "github.com/hertz-contrib/sessions"
  "github.com/hertz-contrib/sessions/cookie"
)
​
func myExtractor(c context.Context, ctx *app.RequestContext) (string, error) {
  token ：= ctx.FormValue("csrf-token")
  if token == nil {
    return "", errors.New("missing token in form-data")
  }
  return string(token), nil
}
​
func main() {
  h := server.Default()
​
  store := cookie.NewStore([]byte("secret"))
  h.Use(sessions.Sessions("csrf-session", store))
  h.Use(csrf.New(csrf.WithExtractor(myExtractor)))
​
  h.GET("/protected", func(c context.Context, ctx *app.RequestContext) {
    ctx.String(200, csrf.GetToken(ctx))
  })
  h.POST("/protected", func(c context.Context, ctx *app.RequestContext) {
    ctx.String(200, "CSRF token is valid")
  })
​
  h.Spin()
}
```

默认的 Extractor 是通过 KeyLookup 进行的获取，若用户想配置为其他逻辑也是支持的。

## 注意项

-   此中间价需要搭配 sessions 中间件进行使用，底层逻辑实现高度依赖 sessions。

## 参考

-   [cloudwego/hertz](https://github.com/cloudwego/hertz)
-   [hertz-contrib/csrf](https://github.com/hertz-contrib/csrf)
-   [hertz-contrib/sessions](https://github.com/hertz-contrib/sessions)
