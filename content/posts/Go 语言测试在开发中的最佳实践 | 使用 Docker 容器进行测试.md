---
title: Go 语言测试在开发中的最佳实践 | 使用 Docker 容器进行测试
date: 2022-08-06
taxonomies:
  categories: ["Golang"]
  tags: ["Go", "Golang", "Docker", "云原生", "容器", "测试"]
---

## 前言

最近看到很多 Go 语言测试的教程都非常水，只讲了测试最基本的用法，几乎没有涉及到在开发中如何去设计一个很出色的测试。这篇博客将会带领大家一步一步完成一个出色的 `Go-Test`

## 思考

Go 语言拥有一套单元测试和性能测试系统，仅需要添加很少的代码就可以快速测试一段需求代码.

一个好的测试该是什么样的呢，应该是脱离一切外部的限制或者说完成测试后并不会影响正式的开发。并且模拟出真实开发时的情况.

## 实践

### 初始化项目

开启一个项目之后我们首先就要进行 `go mod init` ，后续这个项目也会拉取第三方的库

```shell
$ go mod init awesomeTest
```

为了模拟真实的开发场景，我们使用 `MongoDB` 来进行操作，而为了避免太过复杂，只设置一个 `key` .

>以下操作涉及 MongoDB 的知识，如果不会的同学也不用担心，主要掌握的方法而不是哪个特定的数据库。

首先我们需要在本地运行 `MongoDB` ，推荐使用 `Docker`

接下来我们需要安装操作 `MongoDB` 的第三方依赖

```shell
$ go get "go.mongodb.org/mongo-driver/mongo"
```

然后我们在项目中创建我们所需要的数据

```go
//main.go
package main

import (
   "context"
   "fmt"
   "go.mongodb.org/mongo-driver/bson"
   "go.mongodb.org/mongo-driver/bson/primitive"
   "go.mongodb.org/mongo-driver/mongo"
   "go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
   c := context.Background()
   mc, err := mongo.Connect(c, options.Client().ApplyURI("mongodb://localhost:27017"))
   if err != nil {
      panic(err)
   }
   col := mc.Database("awesomeTest").Collection("test")
   insertRows(c, col)
}

func insertRows(c context.Context, col *mongo.Collection) {
   res, err := col.InsertMany(c, []interface{}{
      bson.M{
         "test_id": "123",
      },
      bson.M{
         "test_id": "456",
      },
   })
   if err != nil {
      panic(err)
   }

   fmt.Printf("%+v", res)
}
```

```
&{InsertedIDs:[ObjectID("62ce8ed4e2aaad4e36242623") ObjectID("62ce8ed4e2aaad4e36
242624")]}
进程 已完成，退出代码为 0
```

在 `main.go` 中我们插入了两个 `test_id` ，并打印出了对应的 `ObjID` ,拿到 `ObjID` 之后我们就可以进行一些简单的测试。

### 初级测试

想要测试我们肯定需要先实现一些方法来进行调用
```go
// mongo/mongo.go
// Mongo定义一个mongodb的数据访问对象
type Mongo struct {
   col *mongo.Collection
}

// 使用NewMongo来初始化一个mongodb的数据访问对象
func NewMongo(db *mongo.Database) *Mongo {
   return &Mongo{
      col: db.Collection("test"),
   }
}
```

接下来可以给 `mongodb` 的数据访问对象实现一些方法，由于是教程，我们不会搞一些很复杂的，但现实开发中肯定会复杂不少，但方法都是一致的。

```go
// mongo/mongo.go
// 将test_id解析为ObjID
func (m *Mongo) ResolveObjID(c context.Context, testID string) (string, error) {
   res := m.col.FindOneAndUpdate(c, bson.M{
      "test_id": testID,
   }, bson.M{
      "$set": bson.M{
         "test_id": testID,
      },
   }, options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After))

   if err := res.Err(); err != nil {
      return "", fmt.Errorf("cannot findOneAndUpdate: %v", err)
   }

   var row struct {
      ID primitive.ObjectID `bson:"_id"`
   }
   err := res.Decode(&row)
   if err != nil {
      return "", fmt.Errorf("cannot decode result: %v", err)
   }
   return row.ID.Hex(), nil
}
```

当我们将上下文以及 `testID` 传进去这个方法之后我们会在 `MongoDB` 中查询相应的 `ObjID` ，并 `return` 出来，若有错误则直接将错误打印并结束程序。

完成这些简单的代码之后就可以开始初级测试，一个非常基础的测试，但可以直接检验方法的正确与否而不需要实例调用。


```go
// mongo/mongo_test.go
func TestMongo_ResolveAccountID(t *testing.T) {
   c := context.Background()
   mc, err := mongo.Connect(c, options.Client().ApplyURI("mongodb://localhost:27017"))
   if err != nil {
      t.Fatalf("cannot connect mongodb: %v", err)
   }
   m := NewMongo(mc.Database("awesomeTest"))
   id, err := m.ResolveObjID(c, "123")
   if err != nil {
      t.Errorf("faild resolve Obj id for 123: %v", err)
   } else {
      want := "62ce8ed4e2aaad4e36242623"
      if id != want {
         t.Errorf("resolve Obj id: want: %q, got: %q", want, id)
      }
   }
}
```

上述测试样例先连接了数据库并在测试中新建了一个 `MongoDB` 的数据访问对象，然后将 `test_id` 传了进去并解析出相应的 `ObjID` ，若未解析成功或答案不一致则测试失败。

### 再次思考

完成了上述测试之后我们会想，如果这样进行测试的话会连接外部的数据库，甚至是开发中使用的数据库。一个完美的测试应该不会依赖外界或对外界有造成改变的可能，对此我想到了使用现在非常流行的容器工具 `Docker` ，在测试开始时，我们新建一个 `MongoDB` 的容器，在测试结束之后将其关闭，这样就能完美实现我们的想法。

### Docker

Docker 是一个开源的应用容器引擎，让开发者可以打包他们的应用以及依赖包到一个可移植的[镜像](https://baike.baidu.com/item/%E9%95%9C%E5%83%8F/1574)中，然后发布到任何流行的 [Linux](https://baike.baidu.com/item/Linux) 或 [Windows](https://baike.baidu.com/item/Windows/165458) 操作系统的机器上，也可以实现[虚拟化](https://baike.baidu.com/item/%E8%99%9A%E6%8B%9F%E5%8C%96/547949)。容器是完全使用[沙箱](https://baike.baidu.com/item/%E6%B2%99%E7%AE%B1/393318)机制，相互之间不会有任何接口。

关于 `Docker` 就介绍到这里，如果不会使用的同学同上，可以去看看我 `Docker` 相关的文章。

为了实践我们上面所想到操作，我们先新建一个 `Docker` 文件夹进行实验 `docker/main.go` 。

首先我们拉取在 Go 语言中操作 `Docker` 的相关第三方包。

```shell
$ go get -u "github.com/docker/docker"
```

大概的思路就是先新建一个新的 `Docker` 镜像并给他找一个空的端口运行，预计了一下大概的测试用时以及其他的时间，我们稳妥地让它存活五秒钟，在时间到后立马将其销毁。
```go
package main

import (
   "context"
   "fmt"
   "github.com/docker/docker/api/types"
   "github.com/docker/docker/api/types/container"
   "github.com/docker/docker/client"
   "github.com/docker/go-connections/nat"
   "time"
)

func main() {
   c, err := client.NewClientWithOpts()
   if err != nil {
      panic(err)
   }

   ctx := context.Background()

   resp, err := c.ContainerCreate(ctx, &container.Config{
      Image: "mongo:latest",
      ExposedPorts: nat.PortSet{
         "27017/tcp": {},
      },
   }, &container.HostConfig{
      PortBindings: nat.PortMap{
         "27017/tcp": []nat.PortBinding{
            {
               HostIP:   "127.0.0.1",
               HostPort: "0", //随意找一个空的端口
            },
         },
      },
   }, nil, nil, "")
   if err != nil {
      panic(err)
   }

   err = c.ContainerStart(ctx, resp.ID, types.ContainerStartOptions{})
   if err != nil {
      panic(err)
   }

   fmt.Println("container started")
   time.Sleep(5 * time.Second)

   inspRes, err := c.ContainerInspect(ctx, resp.ID)
   if err != nil {
      panic(err)
   }

   fmt.Printf("listening at %+v\n",
      inspRes.NetworkSettings.Ports["27017/tcp"][0])


   fmt.Println("killing container")
   err = c.ContainerRemove(ctx, resp.ID, types.ContainerRemoveOptions{
      Force: true,
   })
   if err != nil {
      panic(err)
   }
}
```
用 Go 语言简单实现了一下，并不复杂。

### 进阶测试

在思路理清晰之后我们就要对刚才的测试进行改动，所谓进阶测试当然不可能只测试一组数据，我们会使用到表格驱动测试。

回到刚才的 `Docker` 操作，我们不可能将上面那么多的代码都放进测试中，所以我们新建一个 `mongotesting.go` 文件将此类函数封装在外部。

首先是在 `Docker` 中跑 `MongoDB` 的函数，与上文的区别不大，主要是在创建容器后的操作有所改变。

```go
//mongo/mongotesting.go

func RunWithMongoInDocker(m *testing.M) int {

...

containerID := resp.ID
defer func() {
   err := c.ContainerRemove(ctx, containerID, types.ContainerRemoveOptions{
      Force: true,
   })
   if err != nil {
      panic(err)
   }
}()

err = c.ContainerStart(ctx, containerID, types.ContainerStartOptions{})
if err != nil {
   panic(err)
}

inspRes, err := c.ContainerInspect(ctx, containerID)
if err != nil {
   panic(err)
}
hostPort := inspRes.NetworkSettings.Ports["27017/tcp"][0]
mongoURI = fmt.Sprintf("mongodb://%s:%s", hostPort.HostIP, hostPort.HostPort)

return m.Run()

}
```

调用了一个 `defer` 使其在 **return** 之后就删除掉。

接下来是在 `Docker` 中与 `MongoDB` 创建一个新连接的函数。

```go
//mongo/mongotesting.go

func NewClient(c context.Context) (*mongo.Client, error) {
   if mongoURI == "" {
      return nil, fmt.Errorf("mong uri not set. Please run RunWithMongoInDocker in TestMain")
   }
   return mongo.Connect(c, options.Client().ApplyURI(mongoURI))
}
```

最后是创建 ObjID 的函数，也是非常简单的调用。

```go
//mongo/mongotesting.go

func mustObjID(hex string) primitive.ObjectID {
   ObjID, err := primitive.ObjectIDFromHex(hex)
   if err != nil {
      panic(err)
   }
   return ObjID
}
```

完成这一步准备之后我们就可以开始写最终的测试代码。

在此之前我们再缕一缕思路，我们的想法是在开始测试之前开启一个 `MongoDB` 的 `Docker` 容器，然后测试结束时自动关闭。测试中呢我们使用表格驱动测试，使用两组数据来测试。开始测试后我们先起一个 `MongoDB` 的连接，然后新建一个 `test` 数据库并插入两组数据，接下来写测试样例，然后用一个 `for range` 结构跑完所有的数据并验证正确性。

我们将以上的步骤分为三步走

#### 第一步 新建连接，插入数据

```go
//mongo/mongo_test.go
func TestResolveObjID(t *testing.T) {
c := context.Background()
mc, err := NewClient(c)
if err != nil {
   t.Fatalf("cannot connect mongodb: %v", err)
}

m := NewMongo(mc.Database("test"))
_, err = m.col.InsertMany(c, []interface{}{
   bson.M{
      "_id":     mustObjID("5f7c245ab0361e00ffb9fd6f"),
      "test_id": "testid_1",
   },
   bson.M{
      "_id":     mustObjID("5f7c245ab0361e00ffb9fd70"),
      "test_id": "testid_2",
   },
})
if err != nil {
   t.Fatalf("cannot insert initial values: %v", err)
}

...

}
```

第一步中我们调用了写在 `mongotesting.go` 中的 *NewClient* 来创建一个新的连接，并向其中加入了两组数据。

#### 第二步 加入样例，准备测试

```go
//mongo/mongo_test.go
func TestResolveObjID(t *testing.T) {

...第一步

cases := []struct {
   name   string
   testID string
   want   string
}{
   {
      name:   "existing_user",
      testID: "testid_1",
      want:   "5f7c245ab0361e00ffb9fd6f",
   },
   {
      name:   "another_existing_user",
      testID: "testid_2",
      want:   "5f7c245ab0361e00ffb9fd70",
   },
}

...

}
```

在第二步中我们使用表格驱动测试的方法放入了两个样例准备进行测试。

#### 第三步 遍历样例，使用容器

```go
//mongo/mongo_test.go
func TestResolveObjID(t *testing.T) {

...第一步

...第二步

    for _, cc := range cases {
      t.Run(cc.name, func(t *testing.T) {
         rid, err := m.ResolveObjID(context.Background(), cc.testID)
         if err != nil {
            t.Errorf("faild resolve Obj id for %q: %v", cc.testID, err)
         }
         if rid != cc.want {
            t.Errorf("resolve Obj id: want: %q; got: %q", cc.want, rid)
         }
      })
   }
}
```

在这里我们使用了 `for range` 结构遍历了我们所有了样例，将 `test_id` 解析成了 `ObjID` ，成功对应后就会通过测试，反之会报错。

接下来是最重要的地方，我们需要使用 `Docker` 就还需要在测试文件中加上最后一个函数。

```go
func TestMain(m *testing.M) {
   os.Exit(RunWithMongoInDocker(m))
}
```

在此之后我们的测试就写好了，大家可以打开 `Docker` 来实验一下。

## 结语
如果有没弄清楚的地方欢迎大家向我提问，我都会尽力解答

这是我的 GitHub 主页 [github.com/L2ncE](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2FL2ncE "https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2FL2ncE")

欢迎大家 **Follow/Star/Fork** 三连
