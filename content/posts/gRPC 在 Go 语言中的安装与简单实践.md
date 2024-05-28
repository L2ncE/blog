---
title: gRPC 在 Go 语言中的安装与简单实践
date: 2022-03-12
taxonomies:
  categories: ["Golang"]
  tags: ["Go", "Golang", "gRPC"]
---

现在非常流行微服务，而 RPC 框架是微服务中不可或缺的一环，gRPC 是其中一个非常出色的 RPC 框架，所以借此机会来记录一下 gRPC 在 Go 语言中的安装使用以及运用。

PS.刚弄好 WSL 开发环境不久，所以这次都是在 WSL 环境下进行的。

## gRPC 是什么

### RPC

RPC 是远程过程调用（Remote Procedure Call）的缩写形式。SAP 系统 RPC 调用的原理其实很简单，有一些类似于三层构架的 C/S 系统，第三方的客户程序通过接口调用 SAP 内部的标准或自定义函数，获得函数返回的数据进行处理后显示或打印。

### gRPC

更多人可能接触的更多的是基于 **REST** 的通信。我们已经看到，REST 是一种灵活的体系结构样式，它定义了对实体资源的基于CRUD的操作。 客户端使用请求/响应通信模型跨 HTTP 与资源进行交互。尽管 REST 是广泛实现的，但一种较新的通信技术 **gRPC** 已在各个生态中获得巨大的动力。

gRPC，其实就是 RPC 框架的一种，前面带了一个 g ，代表是 RPC 中的大哥，龙头老大的意思，另外 g 也有 global 的意思，意思是全球化比较 fashion ，是一个**高性能、开源和通用**的 RPC 框架，基于 **ProtoBuf(Protocol Buffers)**  序列化协议开发，且支持众多开发语言。面向服务端和移动端，基于 HTTP/2 设计，带来诸如双向流、流控、头部压缩、单 TCP 连接上的多复用请求等特。这些特性使得其在移动设备上表现更好，更省电和节省空间占用。

在 gRPC 里**客户端**应用可以像调用本地对象一样直接调用另一台不同的机器上**服务端**应用的方法，使得您能够更容易地创建分布式应用和服务。与许多 RPC 系统类似，gRPC 也是基于以下理念：定义一个**服务**，指定其能够被远程调用的方法（包含参数和返回类型）。在服务端实现这个接口，并运行一个 gRPC 服务器来处理客户端调用。在客户端拥有一个**存根**能够像服务端一样的方法。

## gRPC的安装

在了解完 RPC 以及 gRPC 之后我们就要开始进行 gRPC 的安装，其实 gRPC 的安装非常简单，直接拉取第三方包就可以了，难点是 protobuf 的安装
>protobuf (protocol buffer) 是谷歌内部的混合语言数据标准。通过将结构化的数据进行序列化(串行化)，用于通讯协议、数据存储等领域的语言无关、平台无关、可扩展的序列化结构数据格式。

```go
//go mod拉一下这两个库
google.golang.org/grpc
google.golang.org/protobuf
```

```bash
wget https://github.com/protocolbuffers/protobuf/releases/download/v21.1/protoc-21.1-linux-x86_64.zip
```

将解压后得到的`protoc`二进制文件移动到`$GOPATH/bin`里

PS.一定要配置好 GOPATH ，不然无法使用 protoc

```go
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
```

在安装好这两个之后检查一下 `$GOPATH/bin` 路径中是否有相对应的二进制文件，如果没有就去 /pkg/mod 中找到这两个包，运行 `go build` 编译成二进制文件再放进 `$GOPATH/bin` 中

此时基本已经大功告成，我们在终端输入 `protoc --version` 检查版本，若没问题就表明我们 protobuf 安装成功了

现在我们就可以打开一个新项目，愉快的使用 gRPC 进行开发

## gRPC 的使用

为了让大家更加清楚，这次我会在之前使用 http 框架 gin 的项目上进行开发，并且使用更改密码这个功能来进行示范。

首先我们要创建一个 `rpc` 文件夹，然后其中还会有 `server` `client` `pd`文件夹，分别放有服务端，客户端以及 protobuf 自动生成的代码。

### 编写 proto 文件

关于 proto 文件的语法就不在这里赘述了，感兴趣可以上网查一下

```protobuf
syntax = "proto3";

package changePW;

option go_package = "./changePW";

message changeReq {
  string old_password = 1;
  string new_password = 2;
  string username = 3;
}

message changeRes {
  bool status = 1;
  string msg = 2;
}

service changePW {
  rpc changePW (changeReq) returns (changeRes);
}
```

因为每次都输入命令行语句非常麻烦，所以我使用的是一个 sh 脚本，在文件中放下面的代码
```sh
protoc --go_out=. --go_opt=paths=source_relative --go-grpc_out=. --go-grpc_opt=paths=source_relative ./changePW.proto
```
在终端中 `./build.sh.cmd` 后自动生成代码

### 编写服务端代码

```go
type server struct {
   changePW.UnimplementedChangePWServer
}

func main() {
   err := dao.InitDB()
   listen, err := net.Listen("tcp", ":50002")
   if err != nil {
      log.Println("net.Listen ERR: ", err)
      return
   }

   s := grpc.NewServer()
   changePW.RegisterChangePWServer(s, &server{}) //注册这一个服务

   if err = s.Serve(listen); err != nil { //监听
      log.Println(err)
      return
   }
}

func (s *server) ChangePW(ctx context.Context, req *changePW.ChangeReq) (res *changePW.ChangeRes, err error) {
   res = &changePW.ChangeRes{
      Status: false,
      Msg:    "更改密码错误",
   }

   user, err := dao.SelectUserByUsername(req.Username)
   if err != nil {
      if err == sql.ErrNoRows {
         return res, nil
      }
      return res, err
   }

   if user.Password != req.OldPassword {
      return &changePW.ChangeRes{
         Status: false,
         Msg:    "密码不符",
      }, nil
   }
   err = dao.UpdatePassword(req.Username, req.NewPassword)

   if err != nil {
      return &changePW.ChangeRes{
         Status: false,
         Msg:    "更改密码错误",
      }, nil
   }
   return &changePW.ChangeRes{
      Status: true,
      Msg:    "成功",
   }, nil
}
```
其中数据访问层的代码需要自行编写，值得一提的是必须在服务端中有初始化数据库的动作，不然会报 panic 。

### 客户端

```go
func CallChangePw(endpoint string, oldPassword string, newPassword string, username string) (res *changePW.ChangeRes) {
   conn, err := grpc.Dial(endpoint, grpc.WithTransportCredentials(insecure.NewCredentials()))
   if err != nil {
      log.Println(err)
      return &changePW.ChangeRes{
         Status: false,
         Msg:    err.Error(),
      }
   }
   defer conn.Close()
   client := changePW.NewChangePWClient(conn)
   res, err = client.ChangePW(context.Background(),
      &changePW.ChangeReq{
         OldPassword: oldPassword,
         NewPassword: newPassword,
         Username:    username,
      },
   )
   if err != nil {
      log.Println(err)
      return &changePW.ChangeRes{
         Status: false,
         Msg:    err.Error(),
      }
   }
   fmt.Println("res = ", res)
   return res
}
```

### API层

在此层使用 gin 框架。

```go
func changePasswordRPC(ctx *gin.Context) {
   oldPassword := ctx.PostForm("old_password")
   newPassword := ctx.PostForm("new_password")
   iUsername, _ := ctx.Get("username")
   username := iUsername.(string)
   l1 := len([]rune(newPassword))
   if l1 > 16 {
      tool.RespErrorWithDate(ctx, "密码请在16位以内")
      return
   }
   res := client.CallChangePw("127.0.0.1:50002", oldPassword, newPassword, username)
   if res.Status == true {
      tool.RespSuccessfulWithDate(ctx, res.Msg)
      return
   }
   tool.RespErrorWithDate(ctx, res.Msg)
   return
}
```

最后在路由中进行调用

```go
userGroup := engine.Group("/user")
{
   userGroup.Use(auth)
   userGroup.POST("/password", changePassword) //修改密码
   userGroup.POST("/rpc/password", changePasswordRPC)
}
```

## 结语
如果有没弄清楚的地方欢迎大家向我提问，我都会尽力解答

这是我的GitHub主页 [github.com/L2ncE](https://github.com/L2ncE)，欢迎大家**Follow/Star/Fork**三连

## 参考

[https://zhuanlan.zhihu.com/p/411315625](https://zhuanlan.zhihu.com/p/411315625)