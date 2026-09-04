---
title: 读懂 Pi 的上下文压缩机制
description: 结合 Chroma 的 context rot 研究解读 Pi 的 compaction 设计，从上下文膨胀、压缩流程到缓存代价，以及我在压缩和清空之间的取舍。
date: 2026-08-17
slug: pi-context-compaction
aliases: ["/posts/du-dong-pi-de-shang-xia-wen-ya-suo-ji-zhi/"]
taxonomies:
  categories: ["AI"]
  tags: ["AI", "Agent", "Pi", "LLM"]
---

长时间使用 Coding Agent 的人都会碰到同一个问题，上下文越滚越大，效果越来越差。模型每读一个文件、每跑一次搜索、每改一处代码，这些过程和结果都会追加进对话历史，之后的每一次请求都会完整带着这些上下文。

上下文变长首先降低质量。各家模型在大海捞针（NIAH）这类 Benchmark 里都能拿接近满分，长上下文看起来已经被解决了，但 Chroma 的 context rot 研究指出，这类测试只考字面检索，把一句已知的话埋进一堆无关文本里再让模型找出来，而真实任务需要语义层面的理解和推理。Chroma 把任务难度固定、只增加输入长度后，测试的 18 个模型性能全部随输入变长而下降，而且降得不均匀。

研究里有两个结论对 Coding Agent 场景尤其要命：

- 一个是干扰项，和问题主题相关但不能回答问题的内容，哪怕只放一条，性能就明显下滑，输入越长下滑越明显，而长会话的历史里全是这种半相关的片段。
- 另一个是 LongMemEval 的对比，只给相关片段时模型表现很好，但换成完整 11 万 token 的历史就大幅下滑，因为模型被迫在同一轮里同时做两件事，先从长历史里找出相关部分，再基于找到的内容推理，检索和推理互相挤占。

就在前几天，Pi 发布了一篇博客详解他们的压缩机制（compaction）设计，把上下文怎么膨胀、压缩怎么触发、缓存付出什么代价等进行了深入分析。

## 上下文是怎么一步步膨胀的

Pi 发给模型的每次请求，都带着 system prompt、AGENTS.md、工具定义和完整的对话历史。举个具体的例子，你让模型改一个 bug，它先调 read 工具看文件，Agent 执行完把文件内容拼回请求里再发一次，模型看完可能又调一个 grep，来回几轮才给出答案。一个 turn 里每次请求都带着之前的一切，包括你的文件内容、搜索结果、模型自己的中间想法等等。

历史只增不减，越往后越贵也越慢。总有一次，下一次请求会超出窗口，返回类似 Request exceeds the maximum size 的报错，这时候会话就进行不下去了。

```text
request 1:
[system][tools][user]

after request 1:
[system][tools][user][assistant: tool call][tool result][assistant]

request 2:
[system][tools][user][assistant: tool call][tool result][assistant][user]

...

[system][tools][user][assistant][....][tool result][user]
                                                      ^
                                             exceeds context window
```

## 上下文满了之后的两种动作

一种是直接开新会话。历史清零，之前的决策和没做完的事全部丢掉。听起来损失很大，但结合前面说的 context rot，腐化上下文比没上下文效果更差，有时候丢掉历史反而是更正确的选择。

另一种就是 compaction，把旧历史交给一次 LLM 请求压缩成一份摘要，用摘要替换掉原来的内容，给新消息腾出空间，会话得以继续。

```text
before compaction:
[system + tools][older turns][recent retained messages]

after compaction:
[system][tools][summary][recent turns][new user message]
```

## Pi 的压缩流程

Pi 在每个 turn 结束后检查上下文占用，接近窗口上限就自动触发压缩，手动敲 /compact 也可以随时触发。除此之外还有一种兜底机制，当 turn 跑到一半撞上溢出报错时，Pi 会当场压缩再继续，任务不至于直接报废。

触发时机挑在 turn 结束是有讲究的。turn 还在跑时，每次请求都是在前一次的基础上追加，LLM 的缓存前缀能一直复用，此时压缩缓存损失最小。

压缩并非全删。Pi 会保留最近一段消息原样不动，保留多少由一个可配置的 token 预算控制，默认 2 万，折合 5 到 20 个 turn。在此之前的内容全部序列化，交给一次单独的 LLM 请求去总结。这个请求和平时对话有三处不同：

- system prompt 变更，告诉模型它是一个上下文总结助手。
- user message 变更，要求输出一份结构化摘要，覆盖目标、进展和关键决策。
- 请求本身独立于会话历史，所以可以换一个便宜的模型来跑，不占用主对话的成本。

摘要以纯文本存回会话。这一点让摘要可移植，此时在 Pi 里换模型，新模型接着用同一份摘要，不用重压一遍。

Pi 本身可扩展，作者在文末留了个实验入口，让 Pi 自己写一个扩展来换掉默认的压缩 prompt，就可以测自己的摘要策略。我把这段理解为作者的态度，compaction 的做法没有标准答案，当前实现只是作者认为的最佳实践。

> The ideal outcome of a good summarization for a coding agent is like a handoff briefing from one shift to the next.

原文这句类比我很认同，好的压缩摘要就像换班交接，旧上下文里大部分东西已经和接下来无关，只需要把还在起作用的部分交代清楚。

## 压缩的隐藏代价是缓存全失效

Prompt caching 靠前缀精确匹配省钱，LLM Provider 会对命中缓存的部分给很低的折扣价，例如 DeepSeek V4 Flash 当命中缓存时基本就是不要钱。在压缩之后，保留的那段 turn 内容没变，但它前面的前缀变了，从 system prompt 直接接上摘要。前缀变化后之前攒下的缓存全部作废，压缩后的第一个请求需要重新计算，之后的新请求再重新攒缓存。

```text
cached before compaction:
[system][tools][older history][recent retained turns]
<-------------------- cached prefix -------------------->

first request after compaction:
[system][tools][summary][recent retained turns][new user message]
<-- reusable -->^
                |
        first changed token
                |
                +-- everything after this point must be recomputed
```

所以压缩是有隐性成本的，压缩做得越频繁，缓存重建的成本就越多。

## 我的取舍

上下文压缩中有三个变量在互相牵制，信息保真度、上下文长度、缓存命中率。压缩得频繁，上下文确实短了，缓存却反复作废，摘要过程还必然丢掉一部分细节；压缩频率低，缓存命中率高了，但模型则会长时间处于超长上下文中，降智和幻觉都会更明显。

我的做法是看前后内容的相关性。前面聊过的东西后面还用得上，compaction 才值得做；要是前后话题已经不相关，我会直接 clear 开一个新会话，摘要都不需要。摘要丢掉的细节，压缩的时候谁也不知道哪条以后会用得上，本质是一次有损压缩，细节消失不可逆。

## 参考

- earendil.com/posts/compaction-in-pi
- trychroma.com/research/context-rot
- pi.dev/docs/latest/compaction
- github.com/earendil-works/pi
