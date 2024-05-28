---
title: 快速上手 Go 微服务开发 | CloudWeGo 101
date: 2023-03-30
taxonomies:
  categories: ["CloudWeGo", "Golang"]
  tags: ["CloudWeGo", "bytedance", "开源", "Go", "Golang", "字节跳动"]
---

## 前言

有非常多的同学对微服务开发感到无从下手，这些困难不是并不来自对微服务的理解，而是来自如何上手开发微服务。实际上开发微服务并不困难，这篇文章会详细的带大家从零到一通过 CloudWeGo 的开源框架来学习如何进行微服务的开发。

## CloudWeGo

CloudWeGo 是一套由字节跳动开源的、可快速构建企业级云原生微服务架构的中间件集合。CloudWeGo 项目共同的特点是高性能、高扩展性、高可靠，专注于微服务通信与治理。

### CloudWeGo-Kitex

Kitex[kaɪt’eks] 字节跳动内部的 Golang 微服务 RPC 框架，具有高性能、强可扩展的特点，在字节内部已广泛使用。如果对微服务性能有要求，又希望定制扩展融入自己的治理体系，Kitex 会是一个不错的选择。

### CloudWeGo-Hertz

Hertz[həːts] 是一个 Golang 微服务 HTTP 框架，在设计之初参考了其他开源框架 fasthttp、gin、echo 的优势， 并结合字节跳动内部的需求，使其具有高易用性、高性能、高扩展性等特点，目前在字节跳动内部已广泛使用。 如今越来越多的微服务选择使用 Golang，如果对微服务性能有要求，又希望框架能够充分满足内部的可定制化需求，Hertz 会是一个不错的选择。

## 开发

### 前置准备

> 可以直接 Fork 我开发完成的完整项目进行学习 [CloudWeGo-101](https://github.com/L2ncE/CloudWeGo-101)

为了使用到 Hertz 与 Kitex 的命令行工具，我们需要先进行下载。

```sh
go install github.com/cloudwego/kitex/tool/cmd/kitex@latest
go install github.com/cloudwego/hertz/cmd/hz@latest
```

### IDL 与代码生成

微服务的消费者和提供者之间总要有个约定。不跨语言的话，这种语言本身的定义就可以在不同的组件之间直接共享。一旦支持多语言，用一种公共的接口定义语言来定义他们之间的接口能力就是有必要的了。

所以我们在正式开发之前需要先把 IDL 文件定义好，在这里我们使用到的是 Thfift，他的性能会比 Protobuf 更出色一点。

由于我们是入门开发，所以服务方面就只开发开发一个 `user` 服务和 `article` 服务，`article` 服务通过 RPC 调用使用 `user` 的一些服务。

```thrift
namespace go user

struct RegisterRequest {
    1: string username
    2: string password
}

struct ResgisterResponse {}

struct LoginRequest {
    1: string username
    2: string password
}

struct LoginResponse {}

struct GetArticleNumRequest {
    1: i64 user_id
}

struct GetArticleNumResponse {
    1: i64 num
}

struct AddArticleNumRequest {
    1: i64 user_id
}

struct AddArticleNumResponse {}

service UserService {
    LoginResponse Login(1: LoginRequest req)
    ResgisterResponse Register(1: RegisterRequest req)
    GetArticleNumResponse GetArticleNum(1: GetArticleNumRequest req)
    AddArticleNumResponse AddArticleNum(1: AddArticleNumRequest req)
}
```

在 `idl/user.thrift` 中定义了四个服务，分别是用户登录与注册、获取用户发布文章数量与增加用户发布文章的服务的服务，与文章相关的两个服务会被 `article` 这部分来进行调用。

> 事实上一般开发过程中会将这两个服务放到 `article` 中，这里放到 `user` 中方便演示微服务之间的调用

```thrift
namespace go article

struct PostArticleRequest {
    1: string title
    2: string content
}

struct PostArticleResponse {}

service ArticleService {
    PostArticleResponse PostArticle(1: PostArticleRequest req)
}
```

在 `idl/article.thrift` 中只定义了一个发布文章的服务。

> github.com/L2ncE/CloudWeGo-101 需要更换为自己的 go mod 名称，后面不再提醒。

在此之后就可以通过 Kitex 进行代码的自动生成，我们将所有自动生成的代码都放到根目录 `kitex_gen` 中。

```shell
kitex -module github.com/L2ncE/CloudWeGo-101 ./idl/user.thrift
kitex -module github.com/L2ncE/CloudWeGo-101 ./idl/article.thrift
```

新建 `user` 与 `article` 文件夹，分别在各自的路径下依赖 `kitex_gen` 生成业务代码。

```shell
kitex -service user -module github.com/L2ncE/CloudWeGo-101 -use github.com/L2ncE/CloudWeGo-101/kitex_gen  ./../idl/user.thrift
kitex -service article -module github.com/L2ncE/CloudWeGo-101 -use github.com/L2ncE/CloudWeGo-101/kitex_gen  ./../idl/article.thrift
```

在此之后我们把微服务的整个代码框架都生成好了，接下来我们生成使用 Hertz 作为网关的代码，同样的要对网关定义 IDL。

```thrift
namespace go api

struct BaseResponse {
    1: i64 status_code,
    2: string status_msg,
}

// User

struct RegisterRequest {
    1: string username
    2: string password
}

struct ResgisterResponse {
    1: BaseResponse base
}

struct LoginRequest {
    1: string username
    2: string password
}

struct LoginResponse {
    1: BaseResponse base
}

struct GetArticleNumRequest {
    1: i64 user_id
}

struct GetArticleNumResponse {
    1: i64 num
    2: BaseResponse base
}

struct AddArticleNumRequest {
    1: i64 user_id
}

struct AddArticleNumResponse {
    1: BaseResponse base
}

// Article

struct PostArticleRequest {
    1: string title
    2: string content
}

struct PostArticleResponse {
    1: BaseResponse base
}

service ApiService {
    ResgisterResponse Register(1: RegisterRequest req)(api.post="/user/register/");
    LoginResponse Login(1: LoginRequest req)(api.post="/user/login/");
    GetArticleNumResponse GetArticleNum(1: GetArticleNumRequest req)(api.get="/user/article");
    AddArticleNumResponse AddArticleNum(1: AddArticleNumRequest req)(api.post="/user/article");

    PostArticleResponse PostArticle(1: PostArticleRequest req)(api.post="article");
}
```

接着新建一个 `api` 文件夹并进行代码生成。

```shell
hz new -idl ./../../idl/api.thrift -mod github.com/CyanAsterisk/TikGok/server/cmd/api
rm .gitignore go.mod
```

> 需要删除他生成的 `.gitignore` 与 `go.mod`，在新版本中也可以进行设置。

现在所有的代码都生成好了，顺便在根目录中将依赖拉一下

```shell
go mod tidy && go mod verify
```

> 若 `kitex_gen` 报错请将 `github.com/apache/thrift` 的版本回退到 v0.13.0

### 业务逻辑

现在开始写业务逻辑，由于我们是面向 CloudWeGo 的基础进行学习，所以这里不会用的一些花里胡哨的技术栈，也没有配置中心等一系列的工具。

#### 用户

首先实现用户的一系列方法，我个人的开发习惯是先用接口再实现接口，因此我们先把需要用到的接口先定义出来，到后面再进行实现。

```go
// UserServiceImpl implements the last service interface defined in the IDL.
type UserServiceImpl struct {
   MySqlManager
}

// MySqlManager implements database operations.
type MySqlManager interface {
   LoginCheck(ctx context.Context, username, password string) (bool, error)
   CreateUser(ctx context.Context, username, password string) error
   GetArticleNum(ctx context.Context, uid int64) (int64, error)
   ArticleNumPlusOne(ctx context.Context, uid int64) (int64, error)
}
```

现在就可以将各个业务接口进行实现。

```go
// Login implements the UserServiceImpl interface.
func (s *UserServiceImpl) Login(_ context.Context, req *user.LoginRequest) (resp *user.LoginResponse, err error) {
   flag, err := s.MySqlManager.LoginCheck(req.Username, req.Password)
   if err != nil {
      klog.Error("login check error, err :", err)
      return nil, status.Err(codes.Internal, "login error")
   }
   if !flag {
      klog.Info("wrong password")
      return nil, status.Err(codes.Internal, "login error")
   }
   return nil, nil
}

// Register implements the UserServiceImpl interface.
func (s *UserServiceImpl) Register(_ context.Context, req *user.RegisterRequest) (resp *user.ResgisterResponse, err error) {
   err = s.MySqlManager.CreateUser(req.Username, req.Password)
   if err != nil {
      klog.Error("register error, err :", err)
      return nil, status.Err(codes.Internal, "register error")
   }
   return nil, nil
}

// GetArticleNum implements the UserServiceImpl interface.
func (s *UserServiceImpl) GetArticleNum(_ context.Context, req *user.GetArticleNumRequest) (resp *user.GetArticleNumResponse, err error) {
   count, err := s.MySqlManager.GetArticleNum(req.UserId)
   if err != nil {
      klog.Error("get article num error, err :", err)
      return nil, status.Err(codes.Internal, "get article num error")
   }
   return &user.GetArticleNumResponse{Num: count}, nil
}

// AddArticleNum implements the UserServiceImpl interface.
func (s *UserServiceImpl) AddArticleNum(_ context.Context, req *user.AddArticleNumRequest) (resp *user.AddArticleNumResponse, err error) {
   err = s.MySqlManager.ArticleNumPlusOne(req.UserId)
   if err != nil {
      klog.Error("article num plus one error, err :", err)
      return nil, status.Err(codes.Internal, "add article num error")
   }
   return nil, nil
}
```

通过我们定义好的接口就可以将这几个方法实现好，`MySQLManager` 的实现并不是这次项目的重点，这些代码可以到 `user/pkg/mysql.go` 中进行查看。

接下来我们进行 `main` 函数的实现，在 `main` 函数中我们需要进行服务注册还要对数据库相关内容进行初始化。

> 完整的项目还应该有日志、监控、配置中心等组件的初始化。

**数据库初始化**

数据库层面我们用到的是 gorm。

```go
// InitDB to init database
func InitDB() *gorm.DB {
   dsn := "root:123456@tcp(127.0.0.1:3306)/cloudwego?charset=utf8mb4&parseTime=True&loc=Local"
   // global mode
   db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
      NamingStrategy: schema.NamingStrategy{
         SingularTable: true,
      },
   })
   if err != nil {
      klog.Fatalf("init gorm failed: %s", err.Error())
   }
   return db
}
```

**服务注册初始化**

这里我们使用的是 `consul` 并使用 Kitex 提供的 `consul` 中间件进行初始化。

```go
// InitRegistry to init consul
func InitRegistry() (registry.Registry, *registry.Info) {
   r, err := consul.NewConsulRegister("127.0.0.1:8500",
      consul.WithCheck(&api.AgentServiceCheck{
         Interval:                       "7s",
         Timeout:                        "5s",
         DeregisterCriticalServiceAfter: "15s",
      }))
   if err != nil {
      klog.Fatalf("new consul register failed: %s", err.Error())
   }

   // Using snowflake to generate service name.
   sf, err := snowflake.NewNode(4)
   if err != nil {
      klog.Fatalf("generate service name failed: %s", err.Error())
   }
   info := &registry.Info{
      ServiceName: "user_srv",
      Addr:        utils.NewNetAddr("tcp", "127.0.0.1:8881"),
      Tags: map[string]string{
         "ID": sf.Generate().Base36(),
      },
   }
   return r, info
}
```

**main 函数实现**

需要注意的是我们需要将 `MySqlManager` 进行配置好。

```go
func main() {
   r, info := init.InitRegistry()
   db := init.InitDB()

   // Create new server.
   srv := user.NewServer(&UserServiceImpl{
      MySqlManager: mysql.NewUserManager(db),
   },
      server.WithServiceAddr(utils.NewNetAddr("tcp", "127.0.0.1:8881")),
      server.WithRegistry(r),
      server.WithRegistryInfo(info),
      server.WithServerBasicInfo(&rpcinfo.EndpointBasicInfo{ServiceName: "user_srv"}),
   )
   err := srv.Run()
   if err != nil {
      klog.Fatal(err)
   }
}
```

#### 文章

用和上面一样的方法我们可以实现 `article` 部分，但我们这里我们除了需要 `MySqlManager` 之外还需要一个 `UserManager` 用来进行用户文章数的加一。

> 事实上这样的业务逻辑写法是有问题的，无法保证原子性，不过这里只是一个实例，不用太在意

```go
// ArticleServiceImpl implements the last service interface defined in the IDL.
type ArticleServiceImpl struct {
   MySqlManager
   UserManager
}

// UserManager defines the ACL(Anti Corruption Layer)
type UserManager interface {
   ArticleNumPlusOne(uid int64) error
}

// MySqlManager implements database operations.
type MySqlManager interface {
   Post(title, content string, uid int64) error
}

// PostArticle implements the ArticleServiceImpl interface.
func (s *ArticleServiceImpl) PostArticle(_ context.Context, req *article.PostArticleRequest) (resp *article.PostArticleResponse, err error) {
   err = s.MySqlManager.Post(req.Title, req.Content, req.Uid)
   if err != nil {
      klog.Error("post article error, err:", err)
      return nil, status.Err(codes.Internal, "post error")
   }
   err = s.UserManager.ArticleNumPlusOne(req.Uid)
   if err != nil {
      klog.Error("article num plus one error, err:", err)
      return nil, status.Err(codes.Internal, "post error")
   }
   return nil, nil
}
```

同样的，关于 `Manager` 的实现可以到项目源码 `pkg` 包下查看。

在 `article` 中有类似的数据库和服务发现初始化操作，除此之外大家别忘了我们在 `article` 服务中调用了 `user` 服务，因此还需要对 `user` 服务进行调用初始化也就是服务发现。

**user 服务调用初始化**

```go
// InitUser to init user service
func InitUser() user.Client {
   // init resolver
   r, err := consul.NewConsulResolver("127.0.0.1:8500")
   if err != nil {
      klog.Fatalf("new nacos client failed: %s", err.Error())
   }

   // create a new client
   c, err := user.NewClient(
      "user_srv",
      client.WithResolver(r), // service discovery
      client.WithClientBasicInfo(&rpcinfo.EndpointBasicInfo{ServiceName: "user_srv"}),
   )
   if err != nil {
      klog.Fatalf("ERROR: cannot init client: %v\n", err)
   }
   return c
}
```

**main 函数实现**

```go
func main() {
   r, info := init.InitRegistry()
   db := init.InitDB()

   // Create new server.
   srv := article.NewServer(&ArticleServiceImpl{
      MySqlManager: pkg.NewArticleManager(db),
   },
      server.WithServiceAddr(utils.NewNetAddr("tcp", "127.0.0.1:8882")),
      server.WithRegistry(r),
      server.WithRegistryInfo(info),
      server.WithServerBasicInfo(&rpcinfo.EndpointBasicInfo{ServiceName: "article_srv"}),
   )
   err := srv.Run()
   if err != nil {
      klog.Fatal(err)
   }
}
```

至此我们微服务层面的服务就已经全部开发完毕，接下来是基于 Hertz 的网关层开发。

#### 网关

由于我们在网关层并不需要太多逻辑，所以可以直接基于生成的代码进行开发。

详细代码可以直接看仓库，注册和发现的逻辑和上文基本一样。

我们以登录为例看看 `handler` 部分的开发以及设计（只有 Login 部分有逻辑上的代码）

```go
// Login .
// @router /user/login/ [POST]
func Login(ctx context.Context, c *app.RequestContext) {
   var err error
   var req api.LoginRequest
   err = c.BindAndValidate(&req)
   if err != nil {
      c.String(consts.StatusBadRequest, err.Error())
      return
   }

   resp, err := global.GlobalUserClient.Login(ctx, &user.LoginRequest{
      Username: req.Username,
      Password: req.Password,
   })

   if err != nil {
      c.String(consts.StatusBadRequest, err.Error())
      return
   }

   j := middleware.NewJWT()
   claims := middleware.CustomClaims{
      ID: resp.Uid,
      StandardClaims: jwt.StandardClaims{
         NotBefore: time.Now().Unix(),
         ExpiresAt: time.Now().Unix() + 60*60*24*30,
         Issuer:    "L2ncE",
      },
   }
   token, err := j.CreateToken(claims)

   c.JSON(consts.StatusOK, &api.LoginResponse{Token: token})
}
```

通过表单验证进行参数绑定，传入用户名和密码后进行 JWT 的令牌生成，最后返回响应。

在这里大家可能对 `global.GlobalUserClient` 有所疑问，我们在 `biz` 文件夹下新建了一个 `global` 来进行客户端的全局调用。

## 部署

重点提一下服务发现组件 `consul` 的部署。

通过 `Docker` 能够进行快速安装并部署

```shell
docker run -d -p 8500:8500 -p 8300:8300 -p 8301:8301 -p 8302:8302 -p 8600:8600/udp  consul consul agent -dev -client=0.0.0.0
```

## 总结

文章写得很仓促，代码也没有进行测试，不过逻辑肯定是没有问题的。通过这篇文章大家应该就可以大概上手 CloudWeGo 相关组件的开发，更详细的项目可以参考 [FreeCar](https://github.com/CyanAsterisk/FreeCar)。

## 参考

[https://github.com/CyanAsterisk/FreeCar](https://github.com/CyanAsterisk/FreeCar)

[https://github.com/cloudwego/hertz](https://github.com/cloudwego/hertz)

[https://github.com/cloudwego/kitex](https://github.com/cloudwego/kitex)

[https://www.cloudwego.io/zh/](https://www.cloudwego.io/zh/)