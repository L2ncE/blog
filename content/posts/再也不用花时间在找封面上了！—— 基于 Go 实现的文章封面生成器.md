---
title: 再也不用花时间在找封面上了！—— 基于 Go 实现的文章封面生成器
date: 2022-12-22
taxonomies:
  categories: ["Golang"]
  tags: ["Go", "Golang", "文章生成"]
---

## 前言

我相信很多人和我一样，每次写文章的时候都会在封面选择上犯难，不想网上搜索，又不想使用之前已经用过的封面。终于，今天我写了一个文章封面自动生成器来帮助大家解决这个难题。

先把项目地址贴出来 **[github.com/LgoLgo/cogen](https://github.com/LgoLgo/cogen)** ，

欢迎大家 Star、Fork ，有问题也可以直接提 issue 。

## 使用

我们首先需要将它拉到我们的仓库中。

```sh
go get -u github.com/LgoLgo/cogen
```

接着就可以直接调用库中的 `CoverGen` 方法进行封面的生成。

```go
package main

import "github.com/LgoLgo/cogen"

func main() {
	cogen.CoverGen(
		cogen.WithTitle("How to generate an article cover by golang"),
		cogen.WithImagePath("example/gopher.png"),
		cogen.WithFontFilePath("font/zads.ttf"),
		cogen.WithFontRGB([]int{0, 0, 0}),
		cogen.WithCoverRGB([]int{250, 235, 215}),
		cogen.WithFontSize(100),
	)
}
```

其中 `WithFontFilePath` 与 `WithImagePath` 非常重要，这两个路径决定了我们字体的选择与封面图片的选择。

最后我们将 main 函数运行一下就能按照我们的配置得到需要的文章封面。

![](https://picture.lanlance.cn/i/2023/08/10/64d479858cc91.png)
其余的配置项在 README 中都有提到，大家按照自己的需求配置即可。

## 总结

如果大家有什么需要优化的地方请提 issue ，或者愿意参与开发可以直接提 PR。如果喜欢这个项目希望大家能够点个 Star ，这是对我最大的鼓励！

## 参考

[github.com/LgoLgo/cogen](https://github.com/LgoLgo/cogen)

[imooc.com/article/319599](https://www.imooc.com/article/319599)