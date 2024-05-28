---
title: 从 Netpoll 中寻找 BIO/NIO 编程模型的对比 | Netpoll 源码解读
date: 2022-11-03
taxonomies:
  categories: ["Golang", "CloudWeGo"]
  tags: ["Go", "Golang", "CloudWeGo", "Netpoll", "计算机网络"]
---

## 前言

最近在阅读《Go 组件设计与实现》这本小册，其中让我很感兴趣的一点是为什么在字节开源中间件团队 [CloudWeGo](https://github.com/cloudwego) 所开发的网络库 Netpoll 中使用了 NIO 模型，而没有使用 Go 标准库中所使用到的 BIO 编程模型。

## Netpoll

[Netpoll](https://github.com/cloudwego/netpoll) 是字节跳动内部的 Golang 高性能、I/O 非阻塞的网络库，专注于 RPC 场景。

RPC 通常有较重的处理逻辑（业务逻辑、编解码），耗时长，不能像 Redis 一样采用串行处理(必须异步)。而 Go 的标准库 net 设计了 BIO(Blocking I/O) 模式的 API，为了保证异步处理，RPC 框架设计上需要为每个连接都分配一个 goroutine，这在空闲连接较多时，产生大量的空闲 goroutine，增加调度开销。此外，[net.Conn](https://github.com/golang/go/blob/master/src/net/net.go) 没有提供检查连接活性的 API，很难设计出高效的连接池，池中的失效连接无法及时清理，复用低效。

开源社区目前缺少专注于 RPC 方案的 Go 网络库。类似的项目如：[evio](https://github.com/tidwall/evio) , [gnet](https://github.com/panjf2000/gnet) 等，均面向 Redis, Haproxy 这样的场景。

因此 Netpoll 应运而生，它借鉴了 evio 和 Netty 的优秀设计，具有出色的 [性能](https://github.com/cloudwego/netpoll/blob/main/README_CN.md#%e6%80%a7%e8%83%bd)，更适用于微服务架构。 同时，Netpoll 还提供了一些 [特性](https://github.com/cloudwego/netpoll/blob/main/README_CN.md#%e7%89%b9%e6%80%a7)，推荐在 RPC 框架中作为底层网络库。

## NIO 与 BIO

### BIO

同步并阻塞，服务器实现模式为一个连接一个线程，即客户端有连接请求时服务器端就需要启动一个线程进行处理，如果这个连接不做任何事情会造成不必要的线程开销，当然可以通过线程池机制改善。

### NIO

同步非阻塞，服务器实现模式为一个请求一个线程，即客户端发送的连接请求都会注册到多路复用器上，多路复用器轮询到连接有I/O请求时才启动一个线程进行处理。

### 效率对比

让我们回到前言中的问题——为何在 Netpoll 中使用了 NIO 模型？让我们虚构一个场景，若有 N 个连接满负载传输时，此时的连接利用率为100%。在 BIO 模型中会有 N 个 goroutine ，在 NIO 模型会有小于等于 N 个 goroutine 。而在第二个场景中，此时有 N 个连接满负载传输并挂起 4N 个空闲连接，此时的连接利用率为20%。重点来了，此时的 BIO 模型中会有 5N 个 goroutine ，而 NIO 模型中也只有小于等于 N 个 goroutine 。

![image.png](https://picture.lanlance.cn/i/2022/11/03/63633e3eb9bb0.png)

### 为什么选择 NIO

在 Go Net 中使用了 BIO 模型作为网络服务，在 RPC 调用场景下， goroutine 数量过多会影响调度。除此之外由于 Conn 难以探活，维护连接池的成本高。

## 深入源码

为了对比 BIO/NIO 的区别，我们可以深入 Netpoll 和 Go Net 的源码进行分析。

### Netpoll

```go
// NewEventLoop .
func NewEventLoop(onRequest OnRequest, ops ...Option) (EventLoop, error) {
   opts := &options{
      onRequest: onRequest,
   }
   for _, do := range ops {
      do.f(opts)
   }
   return &eventLoop{
      opts: opts,
      stop: make(chan error, 1),
   }, nil
}
```

`EventLoop` 是一个事件驱动的调度器，一个真正的 NIO Server，负责连接管理、事件调度等。而下面的 `Server` 实现了 `EventLoop`，调用 `Server` 时需要将 `EventLoop` 所绑定的 `Listener` 传入来提供服务。值得一提的是 `Server` 为阻塞式调用，直到发生 `panic` 等错误，或者由用户主动调用 `Shutdown` 时才会触发退出。

```go
// Serve implements EventLoop.
func (evl *eventLoop) Serve(ln net.Listener) error {
   npln, err := ConvertListener(ln)
   if err != nil {
      return err
   }
   evl.Lock()
   evl.svr = newServer(npln, evl.opts, evl.quit)
   evl.svr.Run()
   evl.Unlock()

   err = evl.waitQuit()
   // ensure evl will not be finalized until Serve returns
   runtime.SetFinalizer(evl, nil)
   return err
}
```

通过这样的设计就能保证客户端发送的连接请求都会注册到多路复用器上，多路复用器轮询到连接有I/O请求时才启动一个线程进行处理。

### Go Net

Go Net 的源码比较长，我们直接截取 `func (srv *Server) Serve(l net.Listener) error` 的关键部分。

```go
for {
   rw, err := l.Accept()
   if err != nil {
      select {
      case <-srv.getDoneChan():
         return ErrServerClosed
      default:
      }
      if ne, ok := err.(net.Error); ok && ne.Temporary() {
         if tempDelay == 0 {
            tempDelay = 5 * time.Millisecond
         } else {
            tempDelay *= 2
         }
         if max := 1 * time.Second; tempDelay > max {
            tempDelay = max
         }
         srv.logf("http: Accept error: %v; retrying in %v", err, tempDelay)
         time.Sleep(tempDelay)
         continue
      }
      return err
   }
   connCtx := ctx
   if cc := srv.ConnContext; cc != nil {
      connCtx = cc(connCtx, rw)
      if connCtx == nil {
         panic("ConnContext returned nil")
      }
   }
   tempDelay = 0
   c := srv.newConn(rw)
   c.setState(c.rwc, StateNew, runHooks) // before Serve can return
   go c.serve(connCtx)
}
```
Go Net 中的 `Serve` 接受 `Listener` 上的传入连接，为每个连接创建一个新的 goroutine。这里的 goroutine 读取请求然后调用 `srv.Handler` 来进行响应。此时如果这个连接不做任何事情就会造成不必要的线程开销。

## 结语
如果有没弄清楚的地方欢迎大家向我提问，我都会尽力解答。

这是我的 GitHub 主页 [github.com/L2ncE](https://github.com/L2ncE)，欢迎大家 **Follow/Star/Fork** 三连。
