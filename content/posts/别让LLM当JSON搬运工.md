+++
title = "别让LLM当JSON搬运工"
description = "回看 Cloudflare 两篇 Code Mode 文章，从 token 搬运的浪费讲到 schema 挤占上下文，梳理 Agent 使用工具方式的三代演进，把昂贵的算力留给思考，把搬运交还给代码。"
date = 2026-08-24
slug = "llm-json-mover"
taxonomies.categories = ["AI"]
taxonomies.tags = ["杂谈", "AI", "Agent", "LLM", "MCP"]
+++

从使用 Coding Agent 开始我就一直都不喜欢用 MCP，工具 schema 会长期占用上下文，而它提供的能力大部分都能被 Skill 加 CLI 覆盖，但这个偏好长期说不清具体原因。最近回看 Cloudflare 的两篇文章，去年九月的《Code Mode, the better way to use MCP》和今年二月的续篇，才发现这个长期的模糊混沌其实很清楚。两篇文章的共同论点是，Agent 使用工具的方式正在换代。

## LLM 成了调度器

传统 tool calling 的运作方式是模型输出一段特殊 token 包裹的 JSON，解析后调用 MCP server 再把结果喂回模型，模型接着生成下一段 JSON。单次调用的问题较少，但需要串联多个工具的任务上会吃力容易失败。

例如现在需要找出某个 Github 仓库中最近 100 个 issue 中的 bug label 按点赞数排序并返回前 5 条。这个任务如果用代码只需要一行 filter 加一行 sort 就能干完，而 tool calling 需要先 list_issues() 把 100 个 issue 的完整 JSON 灌进 context，模型读完后再发起下一个调用，又回来一堆 JSON。中间这些数据模型并不需要理解，它只是要把上一轮结果搬运到下一轮参数里，可这些数据仍然要变成 token，完整走一遍模型的 forward pass。

一个工具的输出经常只是要被复制到下一个工具的输入中，但却必须经过神经网络，浪费时间、电力和 token。Cloudflare 认为这是在用最贵的神经网络做最便宜的字符串搬运，LLM 在这个流程里只是充当了 by token 计费的调度器。

## 为什么 LLM 写代码更顺手

更根本的解释在训练分布上。tool calling 依赖的特殊 token 在自然语料里不存在，厂商只能靠构造出来的样本训练模型掌握这套格式，样本量天然有限，模型用起来并不熟练。而 Coding 的情况完全相反，数百万个开源项目给模型喂过海量的真实 API 调用代码。Cloudflare 原文里有一句话值得整段引用。

> Making an LLM perform tasks with tool calling is like putting Shakespeare through a month-long class in Mandarin and then asking him to write a play in it. It's just not going to be his best work.

模型面对 tool calling 格式就像让莎士比亚上一个月的中文速成班，再让他用中文写一部话剧。MCP server 的设计指南总在劝开发者把接口做得尽量简单，原因就是模型接不住复杂的 tool call。但让同一个模型面对同样复杂度的真实 API 去写代码反而没什么困难。Cloudflare 的 Code Mode 把 schema 从 MCP server 拉下来转成一套带有完整接口文档的 TypeScript API 加载进上下文，此后模型只需执行一段代码跑在隔离的 sandbox 中，执行完把 console.log 的输出交还给 Agent Loop。

## Schema 大量占用上下文

除了多步调用的 token 浪费之外，MCP 的每个工具都要向模型声明名字、description、JSON schema 和返回值，一个 MCP server 有 50 个工具，这些定义会一直占用上下文，工具说明书在任务还没开始就把窗口占用了不少。

整个 Cloudflare API 有超过 2500 个 endpoint，从 DNS、Zero Trust 到 Workers、R2 等，按传统方式做成 MCP tools 的话，用 tiktoken 实测工具定义要消耗约 117 万 token，比现在 SOTA 模型的整个 context window 还大。

Cloudflare 选择用工程手段解决这个问题，只暴露两个工具的 MCP server，search() 和 execute()，合计约 1000 token。模型先调 search() 写代码过滤 spec 信息，把几千个 endpoint 筛到自己需要的那几个，spec 渐进式披露基本不占用上下文。接着调 execute() 在 sandbox 里发起真实调用，分页、检查响应、链式编排等都在一次执行里完成。在 Cloudflare 给的防御 DDoS 攻击例子里，从搜 endpoint、查 schema 到更新配置全程四次 tool call，输入 token 相比原生 MCP server 减少 99.9%。

![](https://raw.githubusercontent.com/L2ncE/images/main/PicGoPasted%20image%2020260821181947.png)

## Everything CLI 的思想

Coding Agent 越来越倾向于给模型一个 shell，而不是一千个预定义的 tool，这与 Code Mode 是同一套思想的不同实现。找最近修改的 20 个 Python 文件并统计其中的 TODO，find 加 xargs grep 一句话干完，换成 tool calling 就是好几轮 turn 往返。代码本身已经是一种工具组合语言，模型生成程序，程序去编排工具，中间不需要大模型参与。

我自己长期用 Skill 加 CLI 的组合，大部分 MCP server 提供的能力，用法说明写清楚的 Skill 加上对应 CLI 就能覆盖，Skill 的渐进式披露也舒服得多，需要时才把细节读进上下文。MCP 把连接、文档、授权这三件事标准化了，但把工具当 tool call 逐个调用的时候没太大的意义。Code Mode 设计正是保留协议、替换用法。

Cloudflare 在续篇里也把 CLI 列为同一条路线，OpenClaw 和 Moltworker 都在做 MCP 到 CLI 的转换。

## Harness 迭代

回头看，Agent 使用工具的方式可以分成三代，分代标准是 workflow 由谁驱动、能力怎么进入上下文，三代至今并存：

- 第一代 Function Calling，工具定义全量预载，模型逐个调用，工具一多定义就会打满上下文
- 第二代 Tool Search / Dynamic Tools，工具渐进式加载，上下文的问题解决了，但 workflow 仍然由 LLM 逐步驱动
- 第三代 Code Mode，模型写程序描述整个 workflow，sandbox 里编排工具和搬运数据，只把最终结果回读给 LLM，LLM 从执行者变成程序生成器

## 半年过去，这个方向怎么样了

回看的价值在于可以用今天的现状去校验当时的判断。Worker Loader API 已经从 closed beta 推进到了今年三月的 open beta，动态加载沙箱代码的底层能力已经生产可用。Anthropic 的同类方案 Programmatic Tool Calling 还停在 beta，至今没有加入到 Claude Code。

这个框架也解释了现在一个很明显的趋势，Agent 之间的差距越来越取决于 Harness，而不单是模型本身。同一个模型，使用传统 tool calling 和使用 Code Mode 加 sandbox，表现可以差得很远，竞争的重心正在从模型参数量往 Harness、tool architecture 转移。Coding 能力随之变成通用 Agent 能力的一部分，模型会写代码已经不只是在帮程序员写软件，代码正在变成 Agent 操作数字世界的中间语言。

## 我的判断

把这两篇压缩成一句话，不要让昂贵的算力去做便宜的程序能做的事。理解任务、推理、规划、写程序留给 LLM，循环、过滤、排序、数据搬运、流程编排交还给普通代码。我一直觉得 MCP 现在的用法有问题，工具定义先占用大量上下文，多步调用再让中间数据反复消耗 Token。该放弃在 tool calling 框架里打补丁了，至于 MCP 本身，我倾向于它会换一种用法活下来，协议层解决交互，执行层交给代码。

## 参考

- blog.cloudflare.com/code-mode/
- blog.cloudflare.com/code-mode-mcp/
- developers.cloudflare.com/agents/model-context-protocol/codemode/
- developers.cloudflare.com/changelog/post/2026-03-24-dynamic-workers-open-beta/
- developers.cloudflare.com/changelog/post/2026-07-22-mcp-codemode-updates/
