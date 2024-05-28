---
title: Go 语言爬虫最佳实践 | 通过正则表达式实现爬虫
date: 2022-02-10
taxonomies:
  categories: ["Golang"]
  tags: ["Go", "Golang", "爬虫"]
---

## 前言
可能很多人都觉得爬虫是 Python 的专属技能，但其实使用 Go 语言可能会实现更加好的效果

### 爬虫
在开始实现爬虫之前我们必须明白一件事，那就是爬虫是什么。网络爬虫（又称为网页蜘蛛，[网络](https://baike.baidu.com/item/%E7%BD%91%E7%BB%9C/143243)机器人，在[FOAF](https://baike.baidu.com/item/FOAF/4916497)社区中间，更经常的称为网页追逐者），是一种按照一定的规则，自动地抓取万维网信息的[程序](https://baike.baidu.com/item/%E7%A8%8B%E5%BA%8F/13831935)或者[脚本](https://baike.baidu.com/item/%E8%84%9A%E6%9C%AC/1697005)。另外一些不常使用的名字还有蚂蚁、自动索引、模拟程序或者蠕虫。

### 怎么撰写爬虫

写爬虫程序有以下几点值得注意

1. 明确目标URL

2. 发送请求，获取应答数据包

3. 保存过滤数据

4. 使用分析数据

## 爬虫实现

### 百度贴吧网页简单爬取

**以重庆邮电大学吧为例**

根据 URL 可以发现规律，每次在 pn 后面多了50。

<https://tieba.baidu.com/f?kw=%E9%87%8D%E5%BA%86%E9%82%AE%E7%94%B5%E5%A4%A7%E5%AD%A6&ie=utf-8&pn=0>

<https://tieba.baidu.com/f?kw=%E9%87%8D%E5%BA%86%E9%82%AE%E7%94%B5%E5%A4%A7%E5%AD%A6&ie=utf-8&pn=50>

<https://tieba.baidu.com/f?kw=%E9%87%8D%E5%BA%86%E9%82%AE%E7%94%B5%E5%A4%A7%E5%AD%A6&ie=utf-8&pn=100>

在找到规律之后我们就可以具体实现了，我们需要使用到 net/http 包来获取页面的数据并通过 IO 操作将其保存在文件中。
```go
package main
​
import (
    "fmt"
    "io"
    "net/http"
    "os"
    "strconv"
)
​
func httpGet(url string) (res string, err error) {
    resp, err1 := http.Get(url)
    if err != nil {
        err = err1 //内部错误传出
        return
    }
    defer resp.Body.Close()
​
    //循环读取数据  传出给调用者
    buf := make([]byte, 4096)
    for {
        n, err2 := resp.Body.Read(buf)
        if n == 0 {
            fmt.Println("读取完成")
            break
        }
        if err2 != nil && err2 != io.EOF {
            err = err2
            return
        }
        //累加数据
        res += string(buf[:n])
    }
    return
}
​
func query(start int, end int) {
    fmt.Printf("正在爬取%d页到%d页...\n", start, end)
​
    //循环爬取数据
    for i := start; i <= end; i++ {
        url := "https://tieba.baidu.com/f?kw=%E9%87%8D%E5%BA%86%E9%82%AE%E7%94%B5%E5%A4%A7%E5%AD%A6&ie=utf-8&pn=" + strconv.Itoa((i-1)*50)
        res, err := httpGet(url)
        if err != nil {
            fmt.Println("err = ", err)
            continue
        }
        //保存为文件
        f, err := os.Create("第" + strconv.Itoa(i) + "页" + ".html")
        if err != nil {
            fmt.Println("err = ", err)
            continue
        }
        f.WriteString(res)
        f.Close() //保存好一个文件就关闭一个
    }
}
​
func main() {
    //指定起始终止页
    var start, end int
    fmt.Print("请输入爬取的起始页(>=1):")
    fmt.Scan(&start)
    fmt.Print("请输入爬取的终止页(>=start):")
    fmt.Scan(&end)
​
    query(start, end)
}
```

### 爬取百度贴吧网页并发版

Go 语言的一大语言特色就是天然支持高并发，而爬虫和并发正可以完美结合，高并发进行爬取可以极大提高爬虫的效率。而高并发的实现并不困难，我们只需要去开启一个协程并使其与主协程同步即可，其他的操作都与非并发版的类似。

```go
package main
​
import (
   "fmt"
   "io"
   "net/http"
   "os"
   "strconv"
)
​
func httpGet(url string) (res string, err error) {
   resp, err1 := http.Get(url)
   if err != nil {
      err = err1 //内部错误传出
      return
   }
   defer resp.Body.Close()
​
   //循环读取数据  传出给调用者
   buf := make([]byte, 4096)
   for {
      n, err2 := resp.Body.Read(buf)
      if n == 0 {
         break
      }
      if err2 != nil && err2 != io.EOF {
         err = err2
         return
      }
      //累加数据
      res += string(buf[:n])
   }
   return
}
​
//爬取单个页面的函数
func spiderPage(i int, page chan int) {
   url := "https://tieba.baidu.com/f?kw=%E9%87%8D%E5%BA%86%E9%82%AE%E7%94%B5%E5%A4%A7%E5%AD%A6&ie=utf-8&pn=" + strconv.Itoa((i-1)*50)
   res, err := httpGet(url)
   if err != nil {
      fmt.Println("err = ", err)
      return
   }
   //保存为文件
   f, err := os.Create("第" + strconv.Itoa(i) + "页" + ".html")
   if err != nil {
      fmt.Println("err = ", err)
      return
   }
   f.WriteString(res)
   f.Close() //保存好一个文件就关闭一个
​
   page <- i //与主协程完成同步
}
​
func query(start int, end int) {
   fmt.Printf("正在爬取%d页到%d页...\n", start, end)
​
   page := make(chan int)
   //循环爬取数据
   for i := start; i <= end; i++ {
      go spiderPage(i, page)
   }
   for i := start; i <= end; i++ {
      fmt.Printf("第%d个页面完成爬取完成\n", <-page)
   }
}
​
func main() {
   //指定起始终止页
   var start, end int
   fmt.Print("请输入爬取的起始页(>=1):")
   fmt.Scan(&start)
   fmt.Print("请输入爬取的终止页(>=start):")
   fmt.Scan(&end)
​
   query(start, end)
}
```

## 正则表达式

**正则表达式**，又称规则表达式 **,** （Regular Expression，在代码中常简写为regex、regexp或RE），是一种文本模式，包括普通字符（例如，a 到 z 之间的字母）和特殊字符（称为"元字符"），是[计算机科学](https://baike.baidu.com/item/%E8%AE%A1%E7%AE%97%E6%9C%BA%E7%A7%91%E5%AD%A6/9132)的一个概念。正则表达式使用单个字符串来描述、匹配一系列匹配某个句法规则的字符串，通常被用来检索、替换那些符合某个模式（规则）的文本。

许多程序设计语言都支持利用正则表达式进行字符串操作。例如，在[Perl](https://baike.baidu.com/item/Perl/851577)中就内建了一个功能强大的正则表达式引擎。正则表达式这个概念最初是由[Unix](https://baike.baidu.com/item/Unix/219943)中的工具软件（例如[sed](https://baike.baidu.com/item/sed/7865963)和[grep](https://baike.baidu.com/item/grep/5997841)）普及开来的，后来在广泛运用于Scala 、PHP、C# 、Java、C++ 、Objective-c、Perl 、Swift、VBScript 、Javascript、Ruby 以及Python等等。正则表达式通常缩写成“regex”，[单数](https://baike.baidu.com/item/%E5%8D%95%E6%95%B0/1658633)有regexp、regex，[复数](https://baike.baidu.com/item/%E5%A4%8D%E6%95%B0/254365)有regexps、regexes、regexen。

### 字符测试

```go
package main
​
import (
    "fmt"
    "regexp"
)
​
func main() {
    str := "abc a7c mfc cat 8ca azc cba"
    //解析
    ret := regexp.MustCompile(`a.c`)
    //提取
    res := ret.FindAllStringSubmatch(str, -1)
    //打印
    fmt.Println(res)
}
```

```
//输出
[[abc] [a7c] [azc]]
​
进程 已完成，退出代码为 0
```

### 小数测试

```go
package main
​
import (
    "fmt"
    "regexp"
)
​
func main() {
    str := "3.14 123.123 .68 haha 1.0 abc 7. ab.3 66.6 123."
    //解析
    ret := regexp.MustCompile(`[0-9]+.[0-9]+`)
    //提取
    res := ret.FindAllStringSubmatch(str, -1)
    //打印
    fmt.Println(res)
}
```

```
//输出
3.14] [123.123] [1.0] [66.6]]
​
进程 已完成，退出代码为 0
```

### 网页标签测试

```go
package main
​
import (
    "fmt"
    "regexp"
)
​
func main() {
    str := `<div class="wrapper">
                <ul style='margin-left: 3px;' id='main-menu' >
                    <li><a href="index.php">首 页</a></li>
                    <li ><a href="user.php" >个人服务</a></li>                           
                    <li><a href="jwglFiles/index.php" target='_blank'  >教学管理文件</a></li>
                    <li><a href="#">培养方案</a> 
                        <ul>
                            <li><a href="pyfa2020/index.php" target='_blank'>2020版培养方案</a></li>
                            <li><a href="pyfa/index.php" target='_blank'>2016版培养方案</a></li>
                            <li><a href="infoNavi.php?dId=000303" target='_blank'>其他版培养方案</a></li>
                            <li><a href="lxs/pyfa/index.php" target='_blank'>留学生</a></li>
                        </ul>
                    </li>                                                                                                   
                    <li><a href="bszn/index.php" target='_blank'  >办事指南</a></li> 
                    <li><a href="kebiao/index.php"   target='_bank'>课表查询</a></li>
                    <li><a href="jxjc/index.php"  target='_bank'  >进程与调停课</a></li>
                    <li><a href="ksap/index.php"  target='_bank'  >考试安排</a></li>         
                    <li><a href="infoNavi.php?dId=000308"  target='_bank'  >表格下载</a></li>
                    <li><a href="infoNavi.php?dId=000310"  target='_bank'  >校历</a></li>
                    <!--
                    <li ><a href="history/index.php" target="_blank">历史数据</a></li> 
                    <li><a href="websiteNavi.php" class="topMenu" >功能网站</a></li>
                    <li><a href="historyData.php" class="topMenu" >数据中心</a></li>  
                    <li ><a href="jwzxlxs/index.php" target="_blank">留学生</a></li>
                    -->

                    <li><a href="infoNavi.php?dId=0007"  target='_bank'  >党建工作</a></li>
                    <li><a href="contact.php" class="popInfo" >联系我们</a></li>  
                </ul>  
                <div style="float: right;color: rgb(221, 221, 221);padding: 9px 10px;">`
    //解析
    ret := regexp.MustCompile(`<li><a href="(?s:(.*?))"`)
    //提取
    res := ret.FindAllStringSubmatch(str, -1)
    //打印
    for _, one := range res {
        //fmt.Println("one[0]=", one[0])
        fmt.Println(one[1])//返回的是一个数组
    }
}
```

```
//输出内容
index.php
jwglFiles/index.php
#
pyfa2020/index.php
pyfa/index.php
infoNavi.php?dId=000303
lxs/pyfa/index.php
bszn/index.php
kebiao/index.php
jxjc/index.php
ksap/index.php
infoNavi.php?dId=000308
infoNavi.php?dId=000310
websiteNavi.php
historyData.php
infoNavi.php?dId=0007
contact.php
```

## 使用正则表达式爬取百度贴吧中的标题（高并发）

> 查标题正则表达式 `class="j_th_tit ">(?s:(.*?))</a>`

```go
package main
​
import (
    "fmt"
    "io"
    "net/http"
    "os"
    "regexp"
    "strconv"
)
​
func httpGet(url string) (res string, err error) {
    resp, err1 := http.Get(url)
    if err != nil {
        err = err1 //内部错误传出
        return
    }
    defer resp.Body.Close()
​
    //循环读取数据  传出给调用者
    buf := make([]byte, 4096)
    for {
        n, err2 := resp.Body.Read(buf)
        if n == 0 {
            break
        }
        if err2 != nil && err2 != io.EOF {
            err = err2
            return
        }
        //累加数据
        res += string(buf[:n])
    }
    return
}
​
func saveFile(i int, title [][]string) {
    f, err := os.Create("第" + strconv.Itoa(i) + "页.txt")
    if err != nil {
        fmt.Println("err = ", err)
        return
    }
    defer f.Close()
    n := len(title)
    for i := 0; i < n; i++ {
        f.WriteString(title[i][1] + "\n")
    }
}
​
//爬取单个页面的函数
func spiderPage(i int, page chan int) {
    url := "https://tieba.baidu.com/f?kw=%E9%87%8D%E5%BA%86%E9%82%AE%E7%94%B5%E5%A4%A7%E5%AD%A6&ie=utf-8&pn=" + strconv.Itoa((i-1)*50)
    res, err := httpGet(url)
    if err != nil {
        fmt.Println("err = ", err)
        return
    }
​
    ret := regexp.MustCompile(`class="j_th_tit ">(?s:(.*?))</a>`)
    titles := ret.FindAllStringSubmatch(res, -1)
    saveFile(i, titles)
    page <- i //与主协程完成同步
}
​
func query(start int, end int) {
    fmt.Printf("正在爬取%d页到%d页...\n", start, end)
​
    page := make(chan int)
    //循环爬取数据
    for i := start; i <= end; i++ {
        go spiderPage(i, page)
    }
    for i := start; i <= end; i++ {
        fmt.Printf("第%d个页面完成爬取完成\n", <-page)
    }
}
​
func main() {
    //指定起始终止页
    var start, end int
    fmt.Print("请输入爬取的起始页(>=1):")
    fmt.Scan(&start)
    fmt.Print("请输入爬取的终止页(>=start):")
    fmt.Scan(&end)
​
    query(start, end)
}
```

## 结语
如果有没弄清楚的地方欢迎大家向我提问，我都会尽力解答

这是我的GitHub主页 [github.com/L2ncE](https://github.com/L2ncE)，欢迎大家 **Follow/Star/Fork** 三连