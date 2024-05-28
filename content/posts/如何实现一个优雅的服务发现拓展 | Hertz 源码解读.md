---
title: 如何实现一个优雅的服务发现拓展 | Hertz 源码解读
date: 2022-11-12
taxonomies:
  categories: ["Golang", "CloudWeGo"]
  tags: ["Go", "Golang", "CloudWeGo", "Hertz", "服务发现"]
---

## 前言

在[上一篇文章](https://juejin.cn/post/7165375689464479780)中已经解读了 Hertz 中服务注册的实现，在这一篇文章中我们会重点解读 Hertz 的服务发现部分。

## Hertz

[Hertz](https://github.com/cloudwego/hertz) 是一个超大规模的企业级微服务 HTTP 框架，具有高易用性、易扩展、低时延等特点。

Hertz 默认使用自研的高性能网络库 Netpoll，在一些特殊场景中，相较于 go net，Hertz 在 QPS、时延上均具有一定优势。

在内部实践中，某些典型服务，如框架占比较高的服务、网关等服务，迁移 Hertz 后相比 Gin 框架，资源使用显著减少，**CPU** **使用率随流量大小降低 30%—60%** 。

> 关于 Hertz 更多的信息可移步至 [cloudwego/hertz](https://github.com/cloudwego/hertz)

## 服务发现拓展

Hertz 支持自定义发现模块，使用者可自行扩展集成其他注册中心，该扩展定义在 `pkg/app/client/discovery` 下。

### 拓展接口

#### 服务发现接口定义与实现

服务发现接口中共有三个方法。

1. `Resolve` 作为 Resolve 的核心方法，它会从 target key 中获取我们需要的服务发现结果 Result 。
2. `Target` 从 Hertz 提供的对端 TargetInfo 中解析出 `Resolve` 需要使用的唯一 target ，同时这个 target 将作为缓存的唯一 key 。
3. `Name` 用于指定 Resolver 的唯一名称， 同时 Hertz 会用它来缓存和复用 Resolver。

```go
type Resolver interface {
	// Target should return a description for the given target that is suitable for being a key for cache.
	Target(ctx context.Context, target *TargetInfo) string

	// Resolve returns a list of instances for the given description of a target.
	Resolve(ctx context.Context, desc string) (Result, error)

	// Name returns the name of the resolver.
	Name() string
}
```

这三个方法在 `discovery.go` 的后续代码中进行了实现。

```go
// SynthesizedResolver synthesizes a Resolver using a resolve function.
type SynthesizedResolver struct {
	TargetFunc  func(ctx context.Context, target *TargetInfo) string
	ResolveFunc func(ctx context.Context, key string) (Result, error)
	NameFunc    func() string
}

func (sr SynthesizedResolver) Target(ctx context.Context, target *TargetInfo) string {
	if sr.TargetFunc == nil {
		return ""
	}
	return sr.TargetFunc(ctx, target)
}

func (sr SynthesizedResolver) Resolve(ctx context.Context, key string) (Result, error) {
	return sr.ResolveFunc(ctx, key)
}

// Name implements the Resolver interface
func (sr SynthesizedResolver) Name() string {
	if sr.NameFunc == nil {
		return ""
	}
	return sr.NameFunc()
}
```

在这里的 SynthesizedResolver 中有三个解析函数分别用于三个实现进行解析。

#### TargetInfo 定义

在上文中已经提到，`Target` 方法会从 TargetInfo 中解析出 `Resolve` 需要使用的唯一 target 。

```go
type TargetInfo struct {
	Host string
	Tags map[string]string
}
```

#### instance 接口定义与实现

Instance 中包含了来自目标服务实例的信息。其中有三个方法。

1. `Address` 为目标服务的地址 。
2. `Weight` 为目标服务的权重 。
3. `Tag` 为目标服务的标签，以键值对的形式存在。

```go
// Instance contains information of an instance from the target service.
type Instance interface {
	Address() net.Addr
	Weight() int
	Tag(key string) (value string, exist bool)
}
```

这三个方法在 `discovery.go` 的后续代码中进行了实现。

```go
type instance struct {
	addr   net.Addr
	weight int
	tags   map[string]string
}

func (i *instance) Address() net.Addr {
	return i.addr
}

func (i *instance) Weight() int {
	if i.weight > 0 {
		return i.weight
	}
	return registry.DefaultWeight
}

func (i *instance) Tag(key string) (value string, exist bool) {
	value, exist = i.tags[key]
	return
}
```

#### NewInstance

`NewInstance` 使用给定的 network、address 和 tags 创建一个实例。

```go
// NewInstance creates an Instance using the given network, address and tags
func NewInstance(network, address string, weight int, tags map[string]string) Instance {
	return &instance{
		addr:   utils.NewNetAddr(network, address),
		weight: weight,
		tags:   tags,
	}
}
```

#### Result

在上文中也提到过，`Resolve` 方法会从 target key 中获取我们需要的服务发现结果 Result 。Result 包含服务发现中的结果。会缓存实例列表，并可以使用 CacheKey 将实例列表映射到缓存中。

```go
// Result contains the result of service discovery process.
// the instance list can/should be cached and CacheKey can be used to map the instance list in cache.
type Result struct {
	CacheKey  string
	Instances []Instance
}
```

### client 中间件

client 中间件定义在 `pkg/app/client/middlewares/client` 下。

#### Discovery

`Discovery` 将使用 `BalancerFactory` 构造一个中间件。首先读取通过 `Apply` 方法应用我们传入的配置，详细的配置信息定义在了 `pkg/app/client/middlewares/client/sd/options.go` 下。接着将我们设置的服务发现中心、负载均衡器和负载均衡配置赋值给 `lbConfig` ，调用 `NewBalancerFactory` 将 `lbConfig` 传入，最后返回一个 client.Middleware 类型的匿名函数。

```go
// Discovery will construct a middleware with BalancerFactory.
func Discovery(resolver discovery.Resolver, opts ...ServiceDiscoveryOption) client.Middleware {
	options := &ServiceDiscoveryOptions{
		Balancer: loadbalance.NewWeightedBalancer(),
		LbOpts:   loadbalance.DefaultLbOpts,
		Resolver: resolver,
	}
	options.Apply(opts)

	lbConfig := loadbalance.Config{
		Resolver: options.Resolver,
		Balancer: options.Balancer,
		LbOpts:   options.LbOpts,
	}

	f := loadbalance.NewBalancerFactory(lbConfig)
	return func(next client.Endpoint) client.Endpoint {
		// ...
	}
}
```

#### 实现原理

服务发现中间件的实现原理实则就是上文中我们没有解析的 `Discovery` 最后一部分。我们会在中间件重置 Host。当请求中的配置不为空且 `IsSD()` 配置为 Ture 时，我们会获取一个实例，并调用 `SetHost` 对 Host 进行重置。

```go
return func(ctx context.Context, req *protocol.Request, resp *protocol.Response) (err error) {
  if req.Options() != nil && req.Options().IsSD() {
    ins, err := f.GetInstance(ctx, req)
    if err != nil {
      return err
    }
    req.SetHost(ins.Address().String())
  }
  return next(ctx, req, resp)
}
```

### 服务发现的实现解析

#### 定时刷新

在实践中，我们的服务发现信息会经常进行更新。Hertz 使用了 `refresh` 方法来定期刷新我们的服务发现信息。我们会通过一个 for range 循环进行刷新，其中循环的间隔时间为配置中的 `RefreshInterval` 。接着我们通过 `sync` 库函数中的 `Range` 方法遍历缓存中的键值对来进行刷新。

```go
// refresh is used to update service discovery information periodically.
func (b *BalancerFactory) refresh() {
	for range time.Tick(b.opts.RefreshInterval) {
		b.cache.Range(func(key, value interface{}) bool {
			res, err := b.resolver.Resolve(context.Background(), key.(string))
			if err != nil {
				hlog.SystemLogger().Warnf("resolver refresh failed, key=%s error=%s", key, err.Error())
				return true
			}
			renameResultCacheKey(&res, b.resolver.Name())
			cache := value.(*cacheResult)
			cache.res.Store(res)
			atomic.StoreInt32(&cache.expire, 0)
			b.balancer.Rebalance(res)
			return true
		})
	}
}
```

#### resolver 的缓存

在 `NewBalancerFactory` 的注释中我们可以知道，当在缓存中得到与 target 相同的 key 时，我们会从缓存得到并复用此负载均衡，让我们简单解析一下它的实现。我们将服务发现中心、负载均衡器和负载均衡配置共同传入 `cacheKey` 函数中得到 uniqueKey 。

```go
func cacheKey(resolver, balancer string, opts Options) string {
	return fmt.Sprintf("%s|%s|{%s %s}", resolver, balancer, opts.RefreshInterval, opts.ExpireInterval)
}
```

接着我们会使用 `Load` 方法从 map 中寻找是否有相同的 uniqueKey ，若有，我们直接返回此负载均衡。若无，我们会将其加入到缓存之中。

```go
func NewBalancerFactory(config Config) *BalancerFactory {
	config.LbOpts.Check()
	uniqueKey := cacheKey(config.Resolver.Name(), config.Balancer.Name(), config.LbOpts)
	val, ok := balancerFactories.Load(uniqueKey)
	if ok {
		return val.(*BalancerFactory)
	}
	val, _, _ = balancerFactoriesSfg.Do(uniqueKey, func() (interface{}, error) {
		b := &BalancerFactory{
			opts:     config.LbOpts,
			resolver: config.Resolver,
			balancer: config.Balancer,
		}
		go b.watcher()
		go b.refresh()
		balancerFactories.Store(uniqueKey, b)
		return b, nil
	})
	return val.(*BalancerFactory)
}
```

如果不缓存进行复用会有一个问题，在 middleware 初始化执行两个协程时候，如果用户每次都 new 一个 client ，那就会造成协程泄露。

## 总结

在这篇文章中我们了解到了 Hertz 服务发现的接口定义、 client 中间件的设计以及服务发现实现中使用定时刷新以及缓存的原因与实现。

## 参考

- [cloudwego/hertz](https://github.com/cloudwego/hertz)