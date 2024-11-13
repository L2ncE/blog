---
title: [WIP]南京大学（NJU）《软件分析》笔记
date: 2024-11-13
taxonomies:
  categories: ["CS"]
  tags: ["NJU", "CS", "软件分析"]
---


[Static Program Analysis](https://tai-e.pascal-lab.net/lectures.html)
# Introduction

## 莱斯定理（Rice's Theorem）

>"Any non-trivial property of the behavior of programs in a r.e. language is undecidable"

不存在 *Perfect static analysis*

## Sound & Complete

| Sound           | Truth                               | Complete         |
| --------------- | ----------------------------------- | ---------------- |
| Overapproximate | All possible true program behaviors | Underapproximate |

报告范围 *Sound* 会更多，为了保证程序可靠，会尽可能多地报 bug，但是可能存在误报。*Complete* 为了确保不“冤枉”程序，会保证所报的 bug 均是确切的 bug，从而导致漏报。

几乎所有的静态分析都是 *Sound*，如图：

![](https://raw.githubusercontent.com/L2ncE/images/main/Picgo/Pasted%20image%2020241112171002.png?token=AWFCEVE4BXPUMD45ZJHRQVLHGRBWU)

图中仅分析了蓝色路径会得到错误的结论 —— *Safe Cast*，而 *Sound* 需要考虑到所有的情况进而得到 *Not Safe Cast* 的结论。

***Useful Static Analysis* —— 在 *Sound* 的前提下，精度与速度间进行有效平衡。**

## Abstraction & Over-approximation

​ *abstraction* 是把具体域映射成抽象域。e.g. 抽象域可以包括：$$+、 -、 0、 \top\text{(unknown)}, \bot\text{(undefined)}$$
*over-approximation* 再对抽象域进行运算关系 (transfer functions) 与控制流 (control flow) 的近似。

![](https://raw.githubusercontent.com/L2ncE/images/main/Picgo/Pasted%20image%2020241112175021.png?token=AWFCEVGNB2HSV73MWF7D34LHGRBZQ)

