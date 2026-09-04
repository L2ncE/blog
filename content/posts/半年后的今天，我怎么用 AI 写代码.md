---
title: 半年后的今天，我怎么用 AI 写代码
description: 分享 AI Coding 实践稳定下来后的工具栈与日常 SOP，从 grill 对齐到 Ensemble Review，以及为什么人工 Review 成了新瓶颈。
date: 2026-09-02
taxonomies:
  categories: ["AI"]
  tags: ["杂谈", "AI", "Agent", "AI Coding"]
---

半年前 Agent 爆发的三月我在公司内分享过一次《Harness Engineering》，八月初又分享了《我把 Claude Code 换成 Pi》。三月给 AI 加约束，八月给 AI 减约束，再到今天看其实 AI Coding 的实践已经稳定下来了。

| 时间        | 分享                    | 关键词 |
| --------- | --------------------- | --- |
| 26 年 3 月  | Harness Engineering   | 加约束 |
| 26 年 8 月初 | 我把 Claude Code 换成了 Pi | 减约束 |
| 26 年 8 月底 | 这篇                    | 稳定态 |

## 一、回顾历史分享

三月份那篇的背景是一个系统做架构升级，需求复杂、边界情况多，AI 很容易在某个细节上悄悄跑偏，你发现的时候已经在错误方向上浪费了大量时间。当时的答案是加约束，Superpowers 提供流程纪律和 TDD 的执行策略，gstack 提供多角色 review。在当时这套 SOP 效果很好，brainstorm 阶段追问出很多并发写入的边界问题，/review 发现竞态条件，都是测试阶段很难发现的 case。

但这套流程代价也很大。Superpowers 是个非常重量级的框架，一个流程跑下来注入的上下文非常庞大，经常一天烧掉几亿 token，但效果还比不上现在 matt skills 的几句话。从现在的视角看原因很明显，模型能力强了之后原来那些为了让模型跑得更稳而加的护栏，都成了注意力里的噪音。

![](https://raw.githubusercontent.com/L2ncE/images/main/PicGoArtificial%20Analysis%20Intelligence%20Index%20(30%20Aug%20'26).png)

八月初那篇讲了 Harness 换成 Pi 的原因。Databricks 拿几百万行的代码库实测过，同一个模型换不同 Harness，质量基本持平的情况下任务成本能差出两倍以上，Pi 每轮喂给模型的上下文只有其他 Harness 的三分之一左右。

## 二、开发工具栈

Anthropic 最近发了一篇博客讲上下文工程的新规则，里面明确说他们为 Claude 5 代模型砍掉了 Claude Code 超过八成的 system prompt。官方承认模型强了之后，之前的大段指令反而稀释注意力。

轻量化是共同的方向，Claude Code、Codex、Pi 挑顺手的用就好。工具不是重点，下面简单推荐几个我日常在用的工具。

一是 matt skills，[Matt Pocock](https://www.aihero.dev/skills) 的 Skill 集合，他应该是全世界最会写 Skill 的男人，我日常用的五个如下。

| Skill           | 作用                                                  |
| --------------- | --------------------------------------------------- |
| grill-me        | 苏格拉底式追问，把模糊想法问清楚                                    |
| grill-with-docs | grill 加强版，逐问对齐的同时落 ADR 和术语表                         |
| to-spec         | 把对齐结果写成 spec 文档                                     |
| to-tickets      | 把 spec 拆成垂直切片的 tickets，带依赖 DAG                      |
| implement       | subagent 拉取 ticket 实现，内部执行 TDD 和 code-review，自己修到过审 |

二是 [ponytail](https://github.com/DietrichGebert/ponytail)，用于消除 AI Slop。LLM 写代码经常爱写一堆没意义的内容。防御性的空检查，永远不会有第二个实现的 interface，给常量再包一层 private 常量，注释里写满过程性标注等等。这些内容单看也许没问题，但长期下来无论是人维护还是 AI 维护都是负担。ponytail 的作用就是卡控这些内容，这个逻辑要不要存在、代码库里有没有现成的、标准库能不能干、能不能一行写完，都答不上来才许写新代码。使用后 diff 明显变短，而短 diff 是好 review 的前提。

三是 subagent 加 worktree。并发跑多个任务时用 git worktree 做隔离，各改各的避免冲突，worktree 是 git 的通用概念，哪个 Harness 都能用；在 Claude Code 和 Codex 里 subagent 是原生的。而 Pi 秉持 Less is More 的思路，原生并不提供 subagent，原因是作者认为使用 tmux 等原语即可实现 subagent 的并行、避免上下文腐化等功能。我日常使用 [Herdr](https://herdr.dev/)，可以理解为 AI 时代的 tmux，比 subagent 更轻，还能让 Pi 直接操纵里面的 Claude Code、Codex 这些进程。

## 三、日常 Coding SOP

![](https://raw.githubusercontent.com/L2ncE/images/main/PicGoPasted%20image%2020260902212541.png)

先用 grill-me / grill-with-docs 对齐上下文。这个阶段和 AI 一轮一轮脑暴对齐需求的边界、约束等。对齐后用 to-spec 产出 spec 文档，人工 Review 一遍，这是第一道人工门控。spec 过了用 to-tickets 垂直切片拆分任务，每个 ticket 可独立交付执行。接着派 subagent 跑 implement，一个 ticket 一个 subagent，worktree 隔离并发执行，执行内部走 tdd + code-review。全部完成后做 PR 级的 review，最后人工 CR 把关。

当然这套链路也不算轻，如果是单文件的局部小改，边界清楚，验证成本低，直接 Main Agent 对齐快速改动即可。但轻流程有两条底线，改动前依然需要先出简单方案等人授权，改完必须跑测试。流程可以分级，纪律不能分级。

## 四、人工 Review 是新的瓶颈

Anthropic 前阵子发了一篇 [AI-native SDLC 的 playbook](https://claude.com/blog/the-ai-native-sdlc-playbook)，里面有个结论是代码生成已经快到飞起，软件开发的瓶颈移到了 Coding 的左右两侧，出方案、Review、部署上线这些环节还在以人的速度跑。

我的体验是，当前软件开发的并发上限卡在人的 Review 带宽上。

![](https://raw.githubusercontent.com/L2ncE/images/main/PicGoPasted%20image%2020260902212614.png)

Claude Code、Codex 随便开，worktree 随便建，这些层面的并发几乎免费，但一个人同时处理四个 Session 就比较勉强了，如果处理八条一定会有遗漏。所以未来 Harness 的竞争点，我认为会往压缩人工 Review 成本的方向走。

Ensemble Review 是我现在压缩 Review 成本的手段，原理是让不同厂商的模型交叉审查同一段代码。每个模型都有系统性盲区，GPT 看不出的问题 DeepSeek 可能一眼就看到了，单一模型自审等于让考生自己改卷子。我的配置是四路对抗 Reviewer，GPT、GLM、DeepSeek、Kimi 分别拉起一个 subagent 同时使用干净上下文，跑同一个审查 skill。

但大模型 Review 再多，最后还是得让人来判断，四路结论摆在一起，这个判断仍然是人的活。

## 五、软件工程思维仍关键

吴恩达最近有篇 [文章](https://charonhub.deeplearning.ai/the-ai-engineering-skills-map-in-detail-software-engineering-fundamentals/) 讲 AI 时代的软件工程基本功，里面有个观点我很认同。不懂软件基础的人 Vibe Coding 可以完成开发，但麻烦在于 Agent 可能已经帮他做了一堆糟糕的取舍，而他自己都不知道哪些取舍发生过。接口延迟、可用性、一致性、成本，这些 trade-off 即使有 AI 后也不会消失，而人的判断会越来越重要。

AI Coding 迭代速度太快，这次分享的内容可能三个月后就会过时。但有几件事我确定不会过时。一件是对系统的理解，选延迟还是选系统成本，要简单还是要可扩展，一致性优先还是可用性优先，这些判断大模型它只能给选项，给不了你最优结论。另一件是工程直觉，哪段代码可疑，哪个需求有坑，哪条 Review 意见是噪音，这也是 AI 替代不了的。

## 参考

- Harness Engineering，AI Coding 从随兴到可信的工程化路径
- [我把 Claude Code 换成了 Pi](https://lanlance.cn/posts/wo-ba-claude-code-huan-cheng-liao-pi/)
- [The new rules of context engineering for Claude 5 generation models](https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models)
- [The AI-native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook)
- [The AI Engineering Skills Map In Detail, Software Engineering Fundamentals](https://charonhub.deeplearning.ai/the-ai-engineering-skills-map-in-detail-software-engineering-fundamentals/)
- [Matt Pocock 的 Skills](https://www.aihero.dev/skills)
