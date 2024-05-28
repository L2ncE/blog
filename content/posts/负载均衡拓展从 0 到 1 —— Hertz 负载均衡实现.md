---
title: 负载均衡拓展从 0 到 1 —— Hertz 负载均衡实现
date: 2022-12-20
taxonomies:
  categories: ["Golang", "CloudWeGo"]
  tags: ["Go", "Golang", "CloudWeGo", "负载均衡"]
---

在 Hertz 的服务发现中可以进行配置使用负载均衡来实现服务高可用性与流量均衡。

## Hertz

[Hertz](https://github.com/cloudwego/hertz) 是一个超大规模的企业级微服务 HTTP 框架，具有高易用性、易扩展、低时延等特点。

Hertz 默认使用自研的高性能网络库 Netpoll，在一些特殊场景中，相较于 go net，Hertz 在 QPS、时延上均具有一定优势。

在内部实践中，某些典型服务，如框架占比较高的服务、网关等服务，迁移 Hertz 后相比 Gin 框架，资源使用显著减少，**CPU** **使用率随流量大小降低 30%—60%** 。

> 关于 Hertz 更多的信息可移步至 [cloudwego/hertz](https://github.com/cloudwego/hertz)

## 加权随机算法

Hertz 中的负载均衡使用加权随机算法实现，定义在 `pkg/app/client/loadbalance/weight_random.go` 中。首先我们需要定义 `weightedBalancer` 的结构。

```go
type weightedBalancer struct {
  cachedWeightInfo sync.Map
  sfg              singleflight.Group
}
```

其中包含了一个 sync.Map 类型的缓存权重信息和一个 singleflight.Group 。我们需要让 `weightedBalancer` 实现在 `Loadbalancer` 中定义的四个方法。

### calcWeightInfo

这个方法为此算法的核心方法之一，我们将通过这个方法返回一个权重信息结构体，权重信息结构体中包含实例、各自权重和总权值。

```go
type weightInfo struct {
  instances []discovery.Instance
  entries   []int
  weightSum int
}
```

首先我们声明一个 *weightInfo 类型的变量 w ，将 `instances` 初始化为传入的实例，`weightSum` 初始化为0，`entries` 初始化为一个长度为实例数量的 int 类型切片。

```go
w := &weightInfo{
  instances: make([]discovery.Instance, len(e.Instances)),
  weightSum: 0,
  entries:   make([]int, len(e.Instances)),
}
```

接下来为此方法的核心部分，我们通过下标 idx 遍历传入的实例，当实例的权重大于0时将此下标的实例赋给 w 下标为 cnt 的实例，权重也是如此，再将此权重加到 `weightSum` 中。若小于0则将警告记录到日志中。最后将下标0到 cnt 的实例赋给 `w.instances` 。

```go
var cnt int
​
for idx := range e.Instances {
  weight := e.Instances[idx].Weight()
  if weight > 0 {
    w.instances[cnt] = e.Instances[idx]
    w.entries[cnt] = weight
    w.weightSum += weight
    cnt++
  } else {
    hlog.SystemLogger().Warnf("Invalid weight=%d on instance address=%s", weight, e.Instances[idx].Address())
  }
}
​
w.instances = w.instances[:cnt]
​
return w
```

值得一提的是，为什么会有两个下标分别进行记录？因为当出现 `weight` 不大于0的情况时， w 存放实例的切片中就会存在空值。接下来四个方法会分别实现 `LoadBalancer` 中定义的方法。

### Pick

我们首先会通过 `Load` 方法查看传入的 CacheKey 是否存在，当不存在的时候会调用 singleflight.Group 中的 `Do` 方法，`Do` 会执行并返回给定函数的结果，确保一次只针对给定 Key 执行一次。 如果有重复的 Key 进入，重复的调用会等待原来的调用完成，并收到相同的结果。根据上文对 `calWeightInfo` 的分析，我们会得到 *weightInfo 类型的值并会将其赋值给 wi （此时 wi 为接口类型的变量）。

```go
wi, ok := wb.cachedWeightInfo.Load(e.CacheKey)
  if !ok {
    wi, _, _ = wb.sfg.Do(e.CacheKey, func() (interface{}, error) {
      return wb.calcWeightInfo(e), nil
    })
    wb.cachedWeightInfo.Store(e.CacheKey, wi)
  }
```

再此之后，我们就会执行 CacheKey 存在时的操作，首先将 wi 通过接口断言转换为 *weightInfo 类型并赋值给 w 。当权重总值小于0时我们会返回空，否则我们会调用 `fastrant` 包中的 `Intn` 函数获得一个随机的权重，通过 for 循环遍历 w 的实例，每次让随机得到的权重减去此时遍历到的实例权重，最后当随机权重小于0时返回此时遍历到的实例。

```go
w := wi.(*weightInfo)
if w.weightSum <= 0 {
  return nil
}
​
weight := fastrand.Intn(w.weightSum)
for i := 0; i < len(w.instances); i++ {
  weight -= w.entries[i]
  if weight < 0 {
    return w.instances[i]
  }
}
```

### Rebalance

`Rebalance` 方法会直接将 CacheKey 和通过 `calcWeightInfo` 方法得到的 weightInfo 传入 `Store` 方法中。

```go
// Rebalance implements the Loadbalancer interface.
func (wb *weightedBalancer) Rebalance(e discovery.Result) {
  wb.cachedWeightInfo.Store(e.CacheKey, wb.calcWeightInfo(e))
}
```

### Delete

`Delete` 方法会调用 sync 库中的 `Delete` 方法直接删去传入的 CacheKey 。

```go
// Delete implements the Loadbalancer interface.
func (wb *weightedBalancer) Delete(cacheKey string) {
  wb.cachedWeightInfo.Delete(cacheKey)
}
```

### Name

`Name` 方法会直接返回此算法的名称即 ”weight_random" 。

```go
func (wb *weightedBalancer) Name() string {
	return "weight_random"
}
```

## 轮询算法

在 [loadbalance](https://github.com/hertz-contrib/loadbalance) 拓展库中还提供了基于轮询算法的负载均衡实现，同样的需要先定义 `roundRobinBalancer` 的实现

```go
type roundRobinBalancer struct {
	cachedInfo sync.Map
	sfg        singleflight.Group
}
```

其中包含了一个 sync.Map 类型的缓存信息和一个 singleflight.Group 。我们需要让 `roundRobinBalancer` 实现在 `Loadbalancer` 中定义的四个方法。

### roundRobinInfo

因为轮询算法并不需要权值，因此结构相比加权随机算法会简单许多。结构体中会包含服务实例以及服务的索引用于轮询的实现。

```go
type roundRobinInfo struct {
	instances []discovery.Instance
	index     uint32
}
```

### Pick

与加权随机算法类似，我们也有一段类似的用于判断 CacheKey 是否存在的逻辑。与加权随机算法不同的是这里初始化时会将索引置为0。

```go
ri, ok := rr.cachedInfo.Load(e.CacheKey)
if !ok {
  ri, _, _ = rr.sfg.Do(e.CacheKey, func() (interface{}, error) {
    return &roundRobinInfo{
      instances: e.Instances,
      index:     0,
    }, nil
  })
  rr.cachedInfo.Store(e.CacheKey, ri)
}
```

接下来就是轮询算法的主要逻辑，首先若没有实例传入则返回空，然后将之前的索引值加1，通过原子锁来防止并发数据竞争的问题，最后计算出轮询到达的最新索引。

```go
r := ri.(*roundRobinInfo)
if len(r.instances) == 0 {
  return nil
}

newIdx := atomic.AddUint32(&r.index, 1)
return r.instances[(newIdx-1)%uint32(len(r.instances))]
```

### Rebalance

`Rebalance` 方法会直接将 CacheKey 和初始化的 roundRobinInfo 传入 `Store` 方法中。

```go
// Rebalance implements the Loadbalancer interface.
func (rr *roundRobinBalancer) Rebalance(e discovery.Result) {
	rr.cachedInfo.Store(e.CacheKey, &roundRobinInfo{
		instances: e.Instances,
		index:     0,
	})
}
```

### Delete

`Delete` 方法会调用 sync 库中的 `Delete` 方法直接删去传入的 CacheKey 。

```go
// Delete implements the Loadbalancer interface.
func (rr *roundRobinBalancer) Delete(cacheKey string) {
	rr.cachedInfo.Delete(cacheKey)
}
```

### Name

`Name` 方法会直接返回此算法的名称即 ”round_robin" 。

```go
// Name implements the Loadbalancer interface.
func (rr *roundRobinBalancer) Name() string {
	return "round_robin"
}
```

## 实战

### Server

```go
package main

import (
	"context"
	"log"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/app/server/registry"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/cloudwego/hertz/pkg/protocol/consts"
	"github.com/hertz-contrib/registry/nacos"
)

func main() {
	addr := "127.0.0.1:8001"
	r, err := nacos.NewDefaultNacosRegistry()
	if err != nil {
		log.Fatal(err)
		return
	}
	h := server.Default(
		server.WithHostPorts(addr),
		server.WithRegistry(r, &registry.Info{
			ServiceName: "hertz.test.demo",
			Addr:        utils.NewNetAddr("tcp", addr),
			Weight:      10,
			Tags:        nil,
		}),
	)
	h.GET("/ping", func(c context.Context, ctx *app.RequestContext) {
		ctx.JSON(consts.StatusOK, utils.H{"addr": addr})
	})
	h.Spin()
}
```

使用 Nacos 作为我们的服务发现中心，调用 registry 拓展搭建了一个最简单的 Hertz Server。同时开启三个并且运行在不同的端口上来模拟不同的服务器。

### Client

```go
package main

import (
	"context"
	"log"
	"time"

	"github.com/cloudwego/hertz/pkg/app/client"
	"github.com/cloudwego/hertz/pkg/app/client/loadbalance"
	"github.com/cloudwego/hertz/pkg/app/middlewares/client/sd"
	"github.com/cloudwego/hertz/pkg/common/config"
	"github.com/cloudwego/hertz/pkg/common/hlog"
	roundrobin "github.com/hertz-contrib/loadbalance/round_robin"
	"github.com/hertz-contrib/registry/nacos"
)

func main() {
	client, err := client.NewClient()
	if err != nil {
		panic(err)
	}
	r, err := nacos.NewDefaultNacosResolver()
	if err != nil {
		log.Fatal(err)
		return
	}
	client.Use(sd.Discovery(r, sd.WithLoadBalanceOptions(roundrobin.NewRoundRobinBalancer(), loadbalance.Options{
		RefreshInterval: 5 * time.Second,
		ExpireInterval:  15 * time.Second,
	})))
	for i := 0; i < 10; i++ {
		status, body, err := client.Get(context.Background(), nil, "http://hertz.test.demo/ping", config.WithSD(true))
		if err != nil {
			hlog.Fatal(err)
		}
		hlog.Infof("code=%d,body=%s\n", status, string(body))
	}
}
```

默认使用加权随机算法，在这里配置使用轮询算法来进行服务发现。

**测试**

```
2022/12/22 10:21:34.117821 main.go:50: [Info] code=200,body={"addr":"127.0.0.1:8003"}
2022/12/22 10:21:34.118488 main.go:50: [Info] code=200,body={"addr":"127.0.0.1:8001"}
2022/12/22 10:21:34.119135 main.go:50: [Info] code=200,body={"addr":"127.0.0.1:8002"}
2022/12/22 10:21:34.119339 main.go:50: [Info] code=200,body={"addr":"127.0.0.1:8003"}
2022/12/22 10:21:34.119518 main.go:50: [Info] code=200,body={"addr":"127.0.0.1:8001"}
2022/12/22 10:21:34.119721 main.go:50: [Info] code=200,body={"addr":"127.0.0.1:8002"}
2022/12/22 10:21:34.119929 main.go:50: [Info] code=200,body={"addr":"127.0.0.1:8003"}
2022/12/22 10:21:34.120109 main.go:50: [Info] code=200,body={"addr":"127.0.0.1:8001"}
2022/12/22 10:21:34.120243 main.go:50: [Info] code=200,body={"addr":"127.0.0.1:8002"}
2022/12/22 10:21:34.120384 main.go:50: [Info] code=200,body={"addr":"127.0.0.1:8003"}
```

从测试结果中可以看出访问的地址是通过轮询来进行选择的，测试成功。

## 参考

[cloudwego/hertz](https://github.com/cloudwego/hertz)

[hertz-contrib/loadbalance](https://github.com/hertz-contrib/loadbalance)

[hertz-contrib/registry](https://github.com/hertz-contrib/registry)
