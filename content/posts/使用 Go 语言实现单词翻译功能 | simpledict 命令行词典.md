---
title: 使用 Go 语言实现单词翻译功能 | simpledict 命令行词典
date: 2022-05-07
taxonomies:
  categories: ["Golang"]
  tags: ["Go", "Golang", "计算机网络"]
---

## 思考
如果我们想实现一个命令行词典，自己手写接口肯定非常困难，于是我们想到使用浏览器中的开发者工具进行抓包。拿到接口后再在 IDE 中进行实现。
## 第一步：抓包
我们以[彩云小译](https://fanyi.caiyunapp.com/)为例，

我们首先在输入框中输入一个简单的单词实现一次翻译，例如这样。

>想用啥单词都行，都是一样的

![image.png](https://picture.lanlance.cn/i/2023/08/10/64d47748062c6.png)

之后我们 F12 或者右键检查打开浏览器开发者工具，并在其中选择网络项。

![image.png](https://picture.lanlance.cn/i/2023/08/10/64d4776e7300d.png)


在下面的请求中我们找到叫做 dict 的请求，并在标头中检查请求方法是否为 **POST** 。

![image.png](https://picture.lanlance.cn/i/2023/08/10/64d477597312a.png)

检查完毕之后就可以把将接口拿走，我们可以可以先选择将它复制为 cURL(bash) 。

![image.png](https://picture.lanlance.cn/i/2023/08/10/64d4778475d7e.png)

然后我们转到一个[转译网站](https://curlconverter.com/#go)，它可以将 cURL 转换成 Go 语言的写法(并适用于其他多种语言)。

我们先选择 Go 语言，再将我们刚才复制好的 cURL 粘贴进去。

![image.png](https://picture.lanlance.cn/i/2023/08/10/64d47798de5be.png)

然后我们就可以在下面将 Go 语言复制进我们的 IDE 了。

```go
package main

import (
   "fmt"
   "io/ioutil"
   "log"
   "net/http"
   "strings"
)

func main() {
   client := &http.Client{}
   var data = strings.NewReader(`{"trans_type":"en2zh","source":"good"}`)
   req, err := http.NewRequest("POST", "https://api.interpreter.caiyunai.com/v1/dict", data)
   if err != nil {
      log.Fatal(err)
   }
   req.Header.Set("Accept", "application/json, text/plain, */*")
   req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6")
   req.Header.Set("Connection", "keep-alive")
   req.Header.Set("Content-Type", "application/json;charset=UTF-8")
   req.Header.Set("Origin", "https://fanyi.caiyunapp.com")
   req.Header.Set("Referer", "https://fanyi.caiyunapp.com/")
   req.Header.Set("Sec-Fetch-Dest", "empty")
   req.Header.Set("Sec-Fetch-Mode", "cors")
   req.Header.Set("Sec-Fetch-Site", "cross-site")
   req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.54 Safari/537.36 Edg/101.0.1210.39")
   req.Header.Set("X-Authorization", "token:qgemv4jr1y38jyq6vhvi")
   req.Header.Set("app-name", "xy")
   req.Header.Set("os-type", "web")
   req.Header.Set("sec-ch-ua", `" Not A;Brand";v="99", "Chromium";v="101", "Microsoft Edge";v="101"`)
   req.Header.Set("sec-ch-ua-mobile", "?0")
   req.Header.Set("sec-ch-ua-platform", `"Windows"`)
   resp, err := client.Do(req)
   if err != nil {
      log.Fatal(err)
   }
   defer resp.Body.Close()
   bodyText, err := ioutil.ReadAll(resp.Body)
   if err != nil {
      log.Fatal(err)
   }
   fmt.Printf("%s\n", bodyText)
}
```

至此我们以及将命令行词典的第一步完成。

## 第二步：自定义查询
我们可以看到因为我们在彩云小译中翻译的是单词 go ，所以后续的 cURL 以及拿到的 Go 语言代码中的 "sourse" 键值依旧是 go ，为了我们能自定义输入的单词，可以定义一个结构体。
```go
type DictRequest struct {
   TransType string `json:"trans_type"`
   Source    string `json:"source"`
}
```
这样之后就可以在主函数中自定义翻译请求，通过一个字节的方式传进去
```go
request := DictRequest{TransType: "en2zh", Source: "good"}
buf, err := json.Marshal(request)
if err != nil {
   log.Fatal(err)
}
var data = bytes.NewReader(buf)
```
我们可以运行一下，会发现如果 "source" 中的值不变运行结果也不会改变。
## 第三步：自定义返回值
在上两步的运行结果中我们可以发现传出来的值非常多，有许多值并不是我们需要的内容，所以我们可以将传回来的 JSON 转换成 Go 中的结构体，这样就可以自己选择需要的值。

我们先回到刚才的彩云小译界面，选择标头旁边的预览，将里面的值复制下来。

![image.png](https://picture.lanlance.cn/i/2023/08/10/64d477b08b49a.png)

复制完之后我们可以使用一个[在线转换工具](https://oktools.net/json2go)进行转换，并在其中选择嵌套转换。

![image.png](https://picture.lanlance.cn/i/2023/08/10/64d477c1dbec6.png)

然后将右边的结构体复制到 Go 中即可。


我们可以在 Go 中将其打印出来。
```go
var dictResponse DictResponse
err = json.Unmarshal(bodyText, &dictResponse)
if err != nil {
   log.Fatal(err)
}
fmt.Printf("%#v\n", dictResponse)
```

到这里我们的命令行词典马上就要完成了。
## 第四步：命令行输入单词并查询所需的值
在第二步中实现了自定义查询，但是事实上并不是在命令行中输入，我们可以将词典搜索封装成一个函数在主函数中调用。
```go
fmt.Printf("请输入您想翻译的单词：")
var word string
_, err := fmt.Scanf("%v", &word)
if err != nil {
   fmt.Println(err)
   return
}
   query(word)
```
在 query 函数中打印我们需要的值
```go
fmt.Println(word, "UK:", dictResponse.Dictionary.Prons.En, "US:", dictResponse.Dictionary.Prons.EnUs)
for _, item := range dictResponse.Dictionary.Explanations {
   fmt.Println(item)
```
很多同学可能觉得这样我们的程序就完成了，可是我们并没有判断输入是否为英文，当在命令行输入中文时程序并不会报错，所以我们需要再编写一个判断输入是否为英文的函数。
```go
func ContainsEnglish(str string) bool {
   dictionary := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
   for _, v := range str {
      if strings.Contains(dictionary, string(v)) {
         return true
      }
   }
   return false
}
```
最终我们的程序大功告成，以下为完整代码。
## 完整代码
```go
package main

import (
   "bytes"
   "encoding/json"
   "fmt"
   "io/ioutil"
   "log"
   "net/http"
   "strings"
)

type DictRequest struct {
   TransType string `json:"trans_type"`
   Source    string `json:"source"`
   UserID    string `json:"user_id"`
}

type DictResponse struct {
   Rc   int `json:"rc"`
   Wiki struct {
      KnownInLaguages int `json:"known_in_laguages"`
      Description     struct {
         Source string      `json:"source"`
         Target interface{} `json:"target"`
      } `json:"description"`
      ID   string `json:"id"`
      Item struct {
         Source string `json:"source"`
         Target string `json:"target"`
      } `json:"item"`
      ImageURL  string `json:"image_url"`
      IsSubject string `json:"is_subject"`
      Sitelink  string `json:"sitelink"`
   } `json:"wiki"`
   Dictionary struct {
      Prons struct {
         EnUs string `json:"en-us"`
         En   string `json:"en"`
      } `json:"prons"`
      Explanations []string      `json:"explanations"`
      Synonym      []string      `json:"synonym"`
      Antonym      []string      `json:"antonym"`
      WqxExample   [][]string    `json:"wqx_example"`
      Entry        string        `json:"entry"`
      Type         string        `json:"type"`
      Related      []interface{} `json:"related"`
      Source       string        `json:"source"`
   } `json:"dictionary"`
}

func query(word string) {
   client := &http.Client{}
   request := DictRequest{TransType: "en2zh", Source: word}
   buf, err := json.Marshal(request)
   if err != nil {
      log.Fatal(err)
   }
   var data = bytes.NewReader(buf)
   req, err := http.NewRequest("POST", "https://api.interpreter.caiyunai.com/v1/dict", data)
   if err != nil {
      log.Fatal(err)
   }
   req.Header.Set("Connection", "keep-alive")
   req.Header.Set("DNT", "1")
   req.Header.Set("os-version", "")
   req.Header.Set("sec-ch-ua-mobile", "?0")
   req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36")
   req.Header.Set("app-name", "xy")
   req.Header.Set("Content-Type", "application/json;charset=UTF-8")
   req.Header.Set("Accept", "application/json, text/plain, */*")
   req.Header.Set("device-id", "")
   req.Header.Set("os-type", "web")
   req.Header.Set("X-Authorization", "token:qgemv4jr1y38jyq6vhvi")
   req.Header.Set("Origin", "https://fanyi.caiyunapp.com")
   req.Header.Set("Sec-Fetch-Site", "cross-site")
   req.Header.Set("Sec-Fetch-Mode", "cors")
   req.Header.Set("Sec-Fetch-Dest", "empty")
   req.Header.Set("Referer", "https://fanyi.caiyunapp.com/")
   req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9")
   req.Header.Set("Cookie", "_ym_uid=16456948721020430059; _ym_d=1645694872")
   resp, err := client.Do(req)
   if err != nil {
      log.Fatal(err)
   }
   defer resp.Body.Close()
   bodyText, err := ioutil.ReadAll(resp.Body)
   if err != nil {
      log.Fatal(err)
   }
   if resp.StatusCode != 200 {
      log.Fatal("bad StatusCode:", resp.StatusCode, "body", string(bodyText))
   }
   var dictResponse DictResponse
   err = json.Unmarshal(bodyText, &dictResponse)
   if err != nil {
      log.Fatal(err)
   }
   fmt.Println(word, "UK:", dictResponse.Dictionary.Prons.En, "US:", dictResponse.Dictionary.Prons.EnUs)
   for _, item := range dictResponse.Dictionary.Explanations {
      fmt.Println(item)
   }
}

func ContainsEnglish(str string) bool {
   dictionary := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
   for _, v := range str {
      if strings.Contains(dictionary, string(v)) {
         return true
      }
   }
   return false
}

func main() {
   fmt.Printf("请输入您想翻译的单词：")
   var word string
   _, err := fmt.Scanf("%v", &word)
   if err != nil {
      fmt.Println(err)
      return
   }
   if ContainsEnglish(word) {
      query(word)
      return
   }
   fmt.Println("翻译错误，请输入英文")
   return
}
```
**测试**
```go
请输入您想翻译的单词：gold
gold UK: [gəuld] US: [gold]
n.黄金;金色;金币;财富
a.金的;金子做的;黄金色的


进程 已完成，退出代码为 0
```
```go
请输入您想翻译的单词：金子
翻译错误，请输入英文

进程 已完成，退出代码为 0
```
