---
title: 解读字节开源 HTTP 框架 Hertz | 核心结构与入口的实现
date: 2022-08-02
taxonomies:
  categories: ["Golang", "CloudWeGo"]
  tags: ["Go", "Golang", "CloudWeGo", "Hertz"]
---

## 前言

作为一个接触开源社区快要一年的准大二生，对开源社区进行贡献的同时自己也想要造一个属于自己的框架，在边学边写的过程中发现了很多自己不足，正巧 CSG 正在举行解析 Hertz 源码的活动，就趁着这个机会学习一下企业级的框架内部的实现并给我自己的框架提供一点思路。


## Hertz

[Hertz](https://github.com/cloudwego/hertz) 是一个超大规模的企业级微服务 HTTP 框架，具有高易用性、易扩展、低时延等特点。

Hertz 默认使用自研的高性能网络库 Netpoll，在一些特殊场景中，相较于 go net，Hertz 在 QPS、时延上均具有一定优势。

在内部实践中，某些典型服务，如框架占比较高的服务、网关等服务，迁移 Hertz 后相比 Gin 框架，资源使用显著减少，**CPU** **使用率随流量大小降低 30%—60%** 。

> 关于 Hertz 更多的信息可移步至 [cloudwego/hertz](https://github.com/cloudwego/hertz)

## Hertz 核心结构与入口的实现

### Hertz

学习一个框架首先就要学习他的核心结构，而 Hertz 框架的核心结构与入口正是和自己同名的文件 `hertz.go` 。文件并不冗长，说是短小精悍也不为过。

核心结构在文件的开头，并有一行醒目的注释
```go
// Hertz is the core struct of hertz.
type Hertz struct {
   *route.Engine
}
```
注释的意思是说这里的 Hertz 结构体就是整个框架的核心结构，结构体中封装了 `route` 下的 `Engine` ，而引擎中则包含有所有的方法，如果想要使用这个框架就必须依靠这个引擎。

### New

```go
// New creates a hertz instance without any default config.
func New(opts ...config.Option) *Hertz {
   options := config.NewOptions(opts)
   h := &Hertz{
      Engine: route.NewEngine(options),
   }
   return h
}
```

New 是引擎的构造函数，可以新建一个 `Engine` 实例并且不会包含默认的配置，但可以自己自定义相关的配置，在构造好后会将实例返回出去。

### Defalt

平常我们的开发中一般会使用 `Defalt` 而不会直接使用 `New` ，因为 `Defalt` 会使用默认中间件 `Recovery` ，在 Gin 框架中还会带有日志中间件。

```go
// Default creates a hertz instance with default middlewares.
func Default(opts ...config.Option) *Hertz {
   h := New(opts...)
   h.Use(recovery.Recovery())

   return h
}
```

调用 `Default` 函数时会先 New 一个 `Engine` 实例，并使用 `Recovery` 中间件， `Recovery` 的实现非常简单，使用 `defer` 挂载上错误恢复的函数，在这个函数中调用  *recover()* ，捕获 **panic** ，并且将堆栈信息打印在日志中，向用户返回 *Internal Server Error* 。可以避免因为 **panic** 发生而导致整个程序终止。

除此之外 `Defalt` 也支持自定义配置信息

### Spin

在 CloudWeGo 给的示例代码中我们可以发现在最后一行都会调用 *Spin()* ，如果是像我一样平常更多使用 `Gin` 框架的同学可能就不太懂它的含义。根据注释所讲， *Spin()*  运行服务器直到捕获 *os.Signal* 。 **SIGTERM** 触发器立即关闭。 **SIGHUP|SIGINT** 触发正常关闭。

```go
// Spin runs the server until catching os.Signal.
// SIGTERM triggers immediately close.
// SIGHUP|SIGINT triggers graceful shutdown.
func (h *Hertz) Spin() {
   errCh := make(chan error)
   go func() {
      errCh <- h.Run()
   }()

   if err := waitSignal(errCh); err != nil {
      hlog.Errorf("HERTZ: Receive close signal: error=%v", err)
      if err := h.Engine.Close(); err != nil {
         hlog.Errorf("HERTZ: Close error=%v", err)
      }
      return
   }

   hlog.Infof("HERTZ: Begin graceful shutdown, wait at most num=%d seconds...", h.GetOptions().ExitWaitTimeout/time.Second)

   ctx, cancel := context.WithTimeout(context.Background(), h.GetOptions().ExitWaitTimeout)
   defer cancel()

   if err := h.Shutdown(ctx); err != nil {
      hlog.Errorf("HERTZ: Shutdown error=%v", err)
   }
}
```

在代码实现中我们会先 make 一个通道，并跑一个携程来等待接收信息，当接受到关闭的信号后就会优雅的关掉程序。关于其中的 *waitSignal* 我们在下面继续解读。

### waitSignal

在这个函数中我们会等待信号，并有一个 select 来对应接下来的操作，其中有强制退出以及优雅退出，如果有错误也会将 err 返回回去。

```go
func waitSignal(errCh chan error) error {
   signals := make(chan os.Signal, 1)
   signal.Notify(signals, syscall.SIGINT, syscall.SIGHUP, syscall.SIGTERM)

   select {
   case sig := <-signals:
      switch sig {
      case syscall.SIGTERM:
         // force exit
         return errors.New(sig.String()) // nolint
      case syscall.SIGHUP, syscall.SIGINT:
         // graceful shutdown
         return nil
      }
   case err := <-errCh:
      return err
   }

   return nil
}
```

### 小结

在此之后我们就已经将 `hertz.go` 的源码解读完了，但是只看到源码可能还是会有不懂的地方，我们接下来就用 CloudWeGo 的例子来进一步看看是怎样使用的

## 简单实战

我们直接看 `hertz-examples/hello/main.go`

```go
package main

import (
	"context"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/protocol/consts"
)

func main() {
	// server.Default() creates a Hertz with recovery middleware.
	// If you need a pure hertz, you can use server.New()
	h := server.Default()

	h.GET("/hello", func(ctx context.Context, c *app.RequestContext) {
		c.String(consts.StatusOK, "Hello hertz!")
	})

	h.Spin()
}
```

进入 **main** 函数的第一行就告知了使用 `Defalt` 会自带错误恢复中间件，若想要纯净的实例请使用 `New` 。接下来他就调用了 *server.Default()* ，然后是就是一个 **GET** 请求的路由，会打印出 "Hello hertz!" 。最后调用了 *Spin()* ，等待结束信号。

## 结语

分析了这一个 go 文件就花费了不少时间，对于源码解读还需要继续努力。

如果有没弄清楚的地方欢迎大家向我提问，我都会尽力解答。

这是我的 GitHub 主页 [github.com/L2ncE](https://github.com/L2ncE)

欢迎大家 **Follow/Star/Fork** 三连