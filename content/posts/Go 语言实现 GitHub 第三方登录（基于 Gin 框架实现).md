---
title: Go 语言实现 GitHub 第三方登录（基于 Gin 框架实现)
date: 2022-03-13
taxonomies:
  categories: ["Golang"]
  tags: ["Go", "Golang", "OAuth2", "github"]
---

## 前言

在我们制作网站或者制作 APP 的时候，经常就会想到去实现一个第三方登录，因为 GitHub 的相关接口已经非常完善，所以这次用 GitHub 进行演示。

## OAuth2.0

### OAuth2.0是什么

说到第三方登录，那不得不谈的就是 OAuth2.0 。 OAuth2.0 是 OAuth 协议的延续版本，但不向前兼容 OAuth 1.0 (即完全废止了 OAuth1.0 )。 OAuth 2.0 关注客户端开发者的简易性。要么通过组织在资源拥有者和 HTTP 服务商之间的被批准的交互动作代表用户，要么允许第三方应用代表用户获得访问的权限。同时为 Web 应用，桌面应用和手机，和起居室设备提供专门的认证流程。2012年10月， OAuth 2.0 协议正式发布为 RFC 6749 。

### OAuth2.0有什么用

-   **第三方应用登录：** 比如利用 QQ ，微博，微信授权登录到其他网站或 App 。
-   **分布式或微服务项目中授权：** 在 Go 分布式或微服务开发时，后端业务拆分成若干服务，服务之间或前端进行请求调用时，为了安全认证，可以利用 OAuth2.0 进行认证授权。

## 实现方法

我们需要先在 GitHub 上进行登记处理，依次按以下操作进行.

![image-20220313172451550](https://picture.lanlance.cn/i/2023/08/10/64d4736b218b9.png)

![image-20220313172526740](https://picture.lanlance.cn/i/2023/08/10/64d476035db20.png)

![image-20220313172544797](https://picture.lanlance.cn/i/2023/08/10/64d4761f7358c.png)

callback URL 最为重要，此地址为重定向回的 URL 。

![image20220313172600886](https://picture.lanlance.cn/i/2023/08/10/64d47635c11f5.png)

![image-20220313172625131](https://picture.lanlance.cn/i/2023/08/10/64d4764820084.png)

Client ID 和 secrets 会在后面有帮助。

### 前端页面

因为博主并不会前端，所以只起了一个非常简单的页面，并命为`register.html`，图标随意找一个或者不用都行

```html
 <a href="https://github.com/login/oauth/authorize?
 client_id=a915******53c297a8ea&redirect_uri=www.*****.work/login/register.html">
 <img src="image2/github.jpeg" alt=""></a>
```

client_id 为上文中所获得的，url 需要和 GitHub 中输入的保持一致

![image-20220313173756982](https://picture.lanlance.cn/i/2023/08/10/64d4768ac948e.png)

### 后端实现

**model层**

```go
type Conf struct {
    ClientId     string
    ClientSecret string //GitHub里所获取
    RedirectUrl  string //重定向URL
}

type Token struct {
    AccessToken string `json:"access_token"` //唯一有用，所以只传了这个
}
```

**service层**

```go
var conf = model.Conf{
   ClientId:     "a91******c53c297a8ea",
   ClientSecret: "d39c4******b4d493b17745ac2db24f699be08f",
   RedirectUrl:  "http://42.192.***.29:8080/oauth",
}

//获取地址
func GetTokenAuthUrl(code string) string {
   return fmt.Sprintf(
      "https://github.com/login/oauth/access_token?client_id=%s&client_secret=%s&code=%s",
      conf.ClientId, conf.ClientSecret, code,
   )
}

func GetToken(url string) (*model.Token, error) {

   // 形成请求
   var req *http.Request
   var err error
   if req, err = http.NewRequest(http.MethodGet, url, nil); err != nil {
      return nil, err
   }
   req.Header.Set("accept", "application/json")

   // 发送请求并获得响应
   var httpClient = http.Client{}
   var res *http.Response
   if res, err = httpClient.Do(req); err != nil {
      return nil, err
   }

   // 将响应体解析为 token，并返回
   var token model.Token
   if err = json.NewDecoder(res.Body).Decode(&token); err != nil {
      return nil, err
   }
   return &token, nil
}

func GetUserInfo(token *model.Token) (map[string]interface{}, error) {

   // 形成请求
   var userInfoUrl = "https://api.github.com/user" // github用户信息获取接口
   var req *http.Request
   var err error
   if req, err = http.NewRequest(http.MethodGet, userInfoUrl, nil); err != nil {
      return nil, err
   }
   req.Header.Set("accept", "application/json")
   req.Header.Set("Authorization", fmt.Sprintf("token %s", token.AccessToken))

   // 发送请求并获取响应
   var client = http.Client{}
   var res *http.Response
   if res, err = client.Do(req); err != nil {
      return nil, err
   }
   // 将响应的数据写入 userInfo 中，并返回
   var userInfo = make(map[string]interface{})
   if err = json.NewDecoder(res.Body).Decode(&userInfo); err != nil {
      return nil, err
   }
   return userInfo, nil
}
```

**api层**

```go
func Oauth(ctx *gin.Context) {
   var err error
   // 获取 code
   var code = ctx.Query("code")
   // 通过 code, 获取 token
   var tokenAuthUrl = service.GetTokenAuthUrl(code)
   var token *model.Token
   if token, err = service.GetToken(tokenAuthUrl); err != nil {
      tool.RespInternalError(ctx)
      return
   }
​
   // 通过token，获取用户信息
   var userInfo map[string]interface{}
   userInfo, err = service.GetUserInfo(token)
   if err != nil {
      tool.RespInternalError(ctx)
      return
   }
   user := userInfo["login"].(string)//获取GitHub用户的注册名便于注册
   c := model.MyClaims{
      Username: user,
      StandardClaims: jwt.StandardClaims{
         NotBefore: time.Now().Unix() - 60,
         ExpiresAt: time.Now().Unix() + 6000000,
         Issuer:    "xx",
      },
   }
   t := jwt.NewWithClaims(jwt.SigningMethodHS256, c)
   s, err := t.SignedString(mySigningKey)
   if err != nil {
      tool.RespInternalError(ctx)
   }
   tool.RespSuccessfulWithTwoDate2(ctx, user, s)//向前端传出token以及用户名

}
```

最后将其注册在你的路由中即可。

## 效果

由于没有前端，只能看看网页呈现的JSON格式资源

![image-20220313193624273](https://picture.lanlance.cn/i/2023/08/10/64d4769e99046.png)

## 结语
如果有没弄清楚的地方欢迎大家向我提问，我都会尽力解答

这是我的 GitHub 主页 [github.com/L2ncE](https://github.com/L2ncE)，欢迎大家 **Follow/Star/Fork** 三连
