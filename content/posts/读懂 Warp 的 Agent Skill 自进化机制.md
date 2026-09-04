---
title: 读懂 Warp 的 Agent Skill 自进化机制
description: Warp 用两个 Skill 搭起自进化循环，人类反馈由 Improver 定期编译回 Skill 文件，Skill、Memory、Harness 各守一层约束。
date: 2026-08-28
slug: warp-agent-skills
aliases: ["/posts/du-dong-warp-de-agent-skill-zi-jin-hua-ji-zhi/"]
taxonomies:
  categories: ["AI"]
  tags: ["杂谈", "AI", "Agent", "Warp", "Claude"]
---

本周 Anthropic 发布了一篇讲 Warp 构建自进化 Agent 的博客。

在日常工作中，他们发现 Agent 在处理重复任务时第一版 prompt 往往只能做对八成，剩下的部分会持续制造噪音。Warp 内部的 CR Agent 就出了这种情况，工程师们抱怨它给出的评论没有帮助，质量低。开发团队先是手动改 prompt，后来又完善 AGENTS.md 这类上下文文件，有改善但都没有根治。

无论 Agent 在执行什么任务，人对它输出的纠正通常在 session 结束时就消失了，因此根因在反馈的去向上。发现问题后 Warp 用 Skill 搭了一套自进化框架，让反馈随时间累积，持续打磨 Agent 的输出。

## 双 Skill 循环自进化

![](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a8f1a9a1b33f40618a9d59a_selfimprove-loop.jpg)

Warp 把这套系统拆成两个 Skill，由人类提供反馈进行运转。

Base Skill 承载领域知识和工作指令。PR 打开时，Agent 带着这个 Skill 和上下文执行产出 Review。人类对输出给反馈，一个赞或踩均计入指标，但越具体对 Agent 越有帮助。反馈可以细到告诉 Agent 它建议重命名的那个变量，其实符合代码库的命名惯例，这类信息才能告诉 Agent 下次怎么做对。

Improver Skill 是一个观察者 Agent，按计划定期运行。它拉取累积的人类反馈，对比 Agent 当时的建议和人的回应，然后对 Base Skill 提出一个尽量小的修改。

Skill 本身就是普通文件，Agent 改起来非常顺手，修改可以走正常的 PR 流程，可审查、可批准、可合并。合并之后，下一次运行 Base Skill 就自动继承了改进。

Warp 创始人 Zach Lloyd 的原话是：

> File-based skills are a way of encoding knowledge for agents without putting that knowledge directly in the prompt, as something the agent can simply look up in the course of doing its job.

知识放进了 Agent 可以随时查看的文件里，System Prompt 本身保持干净，整个机制都建立在这一点上。Warp 现在把整个开源仓库都跑在这个模式上，Spec、Review、Triage 三类 Agent 各自带着自己的改进循环，上百人贡献的反馈、上千次 CR 记录都在往这些文件里持续迭代。

## Skill 不等于 Memory

文章专门澄清了一个容易混淆的区分。Skill 是程序性的，回答某件事怎么做，跨 Session 保持稳定，只在人审慎决定时修改。而 Memory 由 Agent 在推理时自动写入，永远在变。

Memory 记录发生过什么，Skill 写的是应该怎么做。很多 Agent Memory 系统把两者混在一起，发生过什么全塞进 Memory。Warp 从大量经验里抽象出规则写回 Skill，这是一种更合理的 learning loop 。

## Skill 自进化，但不是 Harness 自进化

这套机制也有它的边界。Skill 再丰富，本质仍是 Markdown 指令塞进 context，靠模型理解后自觉执行，属于软约束。模型可能忘记执行、顺序出错，或者自认为这一步没必要；context 太长腐化时，指令服从度还会下降。

Harness 里的硬约束是另一种东西。把执行写成状态机，checkout 成功才能跑测试，测试通过才能调 Review 工具，Agent 根本没有跳过某一步的权限。

所以在约束强度上，Agent 可进化的内容可以分成三层看：

- Memory，记录发生过什么，比如这个仓库上次出过什么问题，约束最弱
- Skill，写应该怎么做，比如 Review 要关注向后兼容，约束居中
- Harness，规定必须怎么执行，比如必须先跑测试再进 Review，约束最强

拿连续漏跑测试当例子可以看得更清楚。假设 Agent 连续 20 次 Review 都漏掉跑测试，Warp 的思路是往 Skill 里加一条 Always run tests。更成熟的系统会先问为什么会连续漏。

1. 模型不知道该跑，属于 Skill 问题，往 Skill 里写；
2. 模型知道但经常忘，属于 Harness 问题，直接把约束改成 Review 工具在测试成功前不可调用。

后一种做法里，一条被反复违反又验证过关键的规则，从 Policy 晋升成了 Mechanism。

但 Warp 仅留在第二层在如今是好的权宜之计。Improver 改 Skill，最坏结果是 Agent 多说几句废话。Improver 改 Harness，改的就是执行语义本身、工具权限、重试策略，甚至 sandbox 都可能被改到，风险完全不是一个量级。让 Agent 修改承载自己的运行时，已经接近 recursive self-improvement，还需要在生产环境不断探索。

## 写 Skill 的几条经验

Warp 团队给的 Skill 写作经验中我认为比较有价值的：

- 写原则不写规则，把 Skill 当成给聪明人交代事情，"Look for repeated code" 好过一整套变量命名细则
- 解释为什么，让模型能推理和泛化，死板的 if else 逻辑或者指令表做不到
- Skill 保持小而美，在内容中引用文件和脚本，不要一次性全塞进上下文
- 反馈质量大于数量，一位资深工程师的详细反馈价值远超过一大堆点赞

## 写在最后

原文其实讲的是 Self-improving Agent，但我更愿意把这套东西叫 Self-improving Skill，它进化的对象始终是 Skill 文件，LLM 和 Harness Runtime 丝毫未动。轻是它最大的优点，反馈 => 规则写进文件 => 现成的 Git 工作流 => 部署（一个 Skill 文件、一个 GitHub Action 加一个定时任务）。在 Agent 方向上，落地阻力这么小且能实际生产落地产生价值的路径并不多见。

它也确实只是三层里的第二层，但工程节奏本来就该这样，先把反馈编译成 Skill 这一层跑通，再考虑把它晋升成机制。一步一步来比一开始就设计全自动进化的 Harness 靠谱得多。

## 参考

- claude.com/blog/how-warp-builds-self-improving-agents-on-claude
- anthropic.com/webinars/how-warp-builds-self-improving-agents-on-claude
