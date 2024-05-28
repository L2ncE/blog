---
title: 解读开源 HTTP 框架 Hertz | 服务注册拓展实现
date: 2022-11-20
taxonomies:
  categories: ["Golang", "CloudWeGo"]
  tags: ["Go", "Golang", "CloudWeGo", "Hertz", "服务注册"]
---

## 前言

在参与 Hertz 框架的开发迭代过程中，对 Hertz 的主库也越来越熟悉。接下来的几篇文章我将分别解析 Hertz 的服务注册、服务发现和负载均衡拓展，最后会使用适配于  Hertz 的 etcd 拓展进行实战，欢迎大家关注。

## Hertz

[Hertz](https://github.com/cloudwego/hertz) 是一个超大规模的企业级微服务 HTTP 框架，具有高易用性、易扩展、低时延等特点。

Hertz 默认使用自研的高性能网络库 Netpoll，在一些特殊场景中，相较于 go net，Hertz 在 QPS、时延上均具有一定优势。

在内部实践中，某些典型服务，如框架占比较高的服务、网关等服务，迁移 Hertz 后相比 Gin 框架，资源使用显著减少，**CPU** **使用率随流量大小降低 30%—60%** 。

> 关于 Hertz 更多的信息可移步至 [cloudwego/hertz](https://github.com/cloudwego/hertz)

## 服务注册拓展

Hertz 支持自定义注册模块，使用者可自行扩展集成其他注册中心，该扩展定义在 `pkg/app/server/registry` 下。

### 拓展接口与注册信息

#### 服务注册接口定义与实现

服务注册的接口定义和大部分服务注册的实现类似，含有两个方法，一个为服务注册，另一个为服务取消注册。

```Go
// Registry is extension interface of service registry.
type Registry interface {
        Register(info *Info) error
        Deregister(info *Info) error
}
```

这两个方法在 `register.go` 的后续代码中进行了实现。

```Go
// NoopRegistry
type noopRegistry struct{}

func (e noopRegistry) Register(*Info) error {
        return nil
}

func (e noopRegistry) Deregister(*Info) error {
        return nil
}
```

在 `register.go` 中还提供了一个空的 Registry 实现，为 Hertz 配置中服务注册的默认值。

```Go
// NoopRegistry is an empty implement of Registry
var NoopRegistry Registry = &noopRegistry{}
```

同时也是 Hertz 配置中服务注册的默认值。

```Go
func NewOptions(opts []Option) *Options {
    options := &Options{
        // ...
        Registry: registry.NoopRegistry,
    }
    options.Apply(opts)
    return options
}
```

#### 注册信息

在 `registry.go` 中提供了关于注册信息的定义，在使用 `WithRegistry`进行配置服务注册时会初始化注册信息并传入到 `Register` 方法中进行后续逻辑的执行。这些字段仅为建议，具体的使用取决于自己的设计。

```Go
// Info is used for registry.
// The fields are just suggested, which is used depends on design.
type Info struct {
        // ServiceName will be set in hertz by default
        ServiceName string
        // Addr will be set in hertz by default
        Addr net.Addr
        // Weight will be set in hertz by default
        Weight int
        // extend other infos with Tags.
        Tags map[string]string
}
```

### 服务注册的时机

在每次调用 `Spin` 方法时，我们都会运行 `initOnRunHooks` ，而在 `initOnRunHooks` 中包含我们服务注册的时机。

```Go
func (h *Hertz) initOnRunHooks(errChan chan error) {
        // add register func to runHooks
        opt := h.GetOptions()
        h.OnRun = append(h.OnRun, func(ctx context.Context) error {
                go func() {
                        // delay register 1s
                        time.Sleep(1 * time.Second)
                        if err := opt.Registry.Register(opt.RegistryInfo); err != nil {
                                hlog.SystemLogger().Errorf("Register error=%v", err)
                                // pass err to errChan
                                errChan <- err
                        }
                }()
                return nil
        })
}
```

在调用 `initOnRunHooks` 时，我们会将服务注册的匿名函数添加到 runHooks 中，在此函数中我们先启动一个 goroutine ，这里我们会通过 `time.Sleep` 延迟一秒，当异步注册时，服务不一定会启动，所以会延迟一秒来等待服务启动。在此之后调用 `Register` 并将配置中的 Info 传入。若注册时出现错误则将错误传递到 errChan 中。

### 服务取消注册的时机

在接收到程序退出的信号时 Hertz 会进行优雅退出调用 `Shutdown` 方法，在此方法中会进行服务取消注册。首先并发执行 `executeOnShutdownHooks` 并等待它们直到等待超时或完成执行。接着就将查看是否有注册的服务，若有则调用 `Deregister` 进行服务取消注册。

```Go
func (engine *Engine) Shutdown(ctx context.Context) (err error) {
   if atomic.LoadUint32(&engine.status) != statusRunning {
      return errStatusNotRunning
   }
   if !atomic.CompareAndSwapUint32(&engine.status, statusRunning, statusShutdown) {
      return
   }

   ch := make(chan struct{})
   // trigger hooks if any
   go engine.executeOnShutdownHooks(ctx, ch)

   defer func() {
      // ensure that the hook is executed until wait timeout or finish
      select {
      case <-ctx.Done():
         hlog.SystemLogger().Infof("Execute OnShutdownHooks timeout: error=%v", ctx.Err())
         return
      case <-ch:
         hlog.SystemLogger().Info("Execute OnShutdownHooks finish")
         return
      }
   }()

   if opt := engine.options; opt != nil && opt.Registry != nil {
      if err = opt.Registry.Deregister(opt.RegistryInfo); err != nil {
         hlog.SystemLogger().Errorf("Deregister error=%v", err)
         return err
      }
   }

   // call transport shutdown
   if err := engine.transport.Shutdown(ctx); err != ctx.Err() {
      return err
   }

   return
}
```

## 总结

在这篇文章中我们了解到了 Hertz 可支持高度自定义服务注册拓展的实现，并解析了 Hertz 是如何将其集成在了框架的核心部分。

## 参考

- [cloudwego/hertz](https://github.com/cloudwego/hertz)