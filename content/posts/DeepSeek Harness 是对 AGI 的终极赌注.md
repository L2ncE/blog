---
title: DeepSeek Harness 是对 AGI 的终极赌注
description: DeepSeek 开源 deepseek-harness 的设计哲学分析，读 Cordis 论文看懂热插拔背后的时空可组合性，以及为什么它是下给 AGI 的赌注。
date: 2026-08-14
taxonomies:
  categories: ["AI"]
  tags: ["杂谈", "AI", "Agent", "DeepSeek"]
---

昨晚 DeepSeek 开源了 deepseek-harness(dsh)，第一时间装好后发现没有 TUI 有些诧异，遂回到 GitHub 仓库研究，结果找到了它背后的 Cordis 论文。读下来的判断是，可热插拔这个设计在目前个人应用场景里用处不大，但它是 DeepSeek 对 AGI 目标的下注方向。

## 读源码

仓库 clone 下来用 wc -l 数了一遍，一共 23 万行 TypeScript，五十多个包。所有功能都是插件，包括 LLM 适配器、工具注册表、会话日志、agent loop 本身。底层是 vendor 进仓库的 Cordis 依赖注入容器。

启动就是搭插件树。dsh-base 打底，UI、headless 应用层叠上去，再叠用户自己的 cordis.patch.yml。运行时 HMR 热替换插件，扩展点均为事件瀑布，agent/request、llm/stream、tools/pre-execute，任意插件可以拦截、改写、否决。

贯穿一切的是会话日志，模型可见的必须被记录。会话是 append-only 事件日志，JSONL 持久化加 SQLite 查询视图，UI、fork、resume、telemetry 全部从日志投影。插件想往模型上下文里塞东西，必须走日志。

和 Pi 对比一下，Pi 是 14 万行、10 个包，自研 TUI 一万多行，行数同样按 src 下的 TS 文件统计。dsh 没有终端界面，只有浏览器 UI 和 headless。Pi 的 agent loop 是 runAgentLoop 一个函数，换它得 fork 源码。dsh 的 loop 是 AgentFactory 接口后面的一个插件，写个新插件、改一行配置就能换。dsh 的 loop 核心只有五百来行，turn 和 step 两层循环加一个 inbox 队列，它只是插件树里的普通插件。

两个项目的共同点是都依赖 pi-ai 作为底层 SDK。但在 pi-ai 之上，loop 怎么转、会话怎么存、工具怎么执行，全部各自实现。dsh 的 loop 源码里完全不 import pi-ai，它通过自己的 ctx.llm 接口发请求，只有 pi-ai 的适配器内部依赖。

dsh 里任何满足接口的实现都能装上。Pi 没有这套接口体系，换它的 loop 只能改它自己的源码。反向也不成立，dsh 的插件依赖 Cordis 的 ctx 和 fiber，装不进 Pi。

> 肯定会有同学想到是否可以把 Pi 的 runAgentLoop 塞进 dsh 当 loop 用，理论可行，但那个插件不能只调函数。它不写 dsh 的会话日志。得加一层适配，把 Pi 的事件流转成 dsh 的 session 事件。

## 为什么

dsh 选运行时组合是有代价的，每个组件都得自己实现逆操作。为什么这么设计的答案在 Cordis 的论文中，Cordis 的设计理论叫时空可组合性，作者 Yifan Shi、Wei Zhang、Tianyi Cui（dsh 负责人）。

两个维度。时间维是可逆 effect，每个组件的副作用均带有逆操作和运行时跟踪，卸载等于副作用完整回退，不用重启进程。空间维是响应式 coeffect，组件声明依赖，上下文变了按声明通知，不用各自轮询。

论文第 4.4 节证明了五条性质。temporal composability 保证组件卸载后上下文等同于从未加载，spatial composability 保证组件在加载期间（含自身卸载过程）读到的依赖始终一致。剩下三条是系统级的脚手架。preservation 维持 soundness 不变量（累加器恢复的始终是初始状态）、progress 保证系统不会在激活/停用之间无限循环、confluence 保证不管转换按什么顺序处理最终静止状态一样。

>注意这五条里没有"无影响"。热插拔必然有影响，一个工具没了那么依赖方就收到通知降级。论文保证的是影响被完整管理，要么干净回退，要么明确通知，不出现拔掉插件后系统拿着悬空引用悄悄坏掉的无声故障。

## 目标自进化

![](https://raw.githubusercontent.com/L2ncE/images/main/PicGo034DC51E-423F-48B5-AB96-82E1870B9DF1.png)

从论文最后可以看到 dsh 的最终愿景是实现 harness 的自进化，在 Lilian Weng 七月的文章中也是这个思路，只不过是将 harness 本身当优化目标，让模型自动修改 harness 代码并通过评测保留更优版本，ADAS、AFlow、STOP、Self-Harness、AHE、Meta-Harness 等都属于这个方向，但具体机制各不相同。

同时在自进化的美好愿景里有四个问题暂未解决。

- 可逆性需要实现在每个插件自己身上。框架只追踪你注册了哪些副作用，逆操作写得对不对，定时器清没清、连接关没关等，框架自身是无法验证的。
- 组件替换不等于代码替换。论文保证运行时替换顺序无关，但不管持久状态迁移。
- 写进磁盘的文件、发出去的网络请求、fork 的子进程，都不在 effect 追踪范围，dsh 需要 sandbox 兜底，恰好说明大量副作用本质不可逆。
- 完全可插拔还得自限，AHE 中的自进化框架把 verifier、tracer、模型配置设为 read-only，否则模型会进化出关掉验证器的版本，必须存在一个模型不可进化的奇点，但如何定义这个点本身就是未解问题。

除此之外还有一个前提，模型生成的组件代码必须可靠到人能信任。Lilian 那篇综述里的结论喜忧参半，STOP 的递归自改进在 GPT-4 上有效，换 GPT-3.5 反而退化。harness 更新能力从 9B 到 Opus 4.6 差不多，受益能力却是倒 U，这些结论都出自综述引用的论文。

## 用还是不用

用了一天后我的实际结论是，个人场景下 dsh 的热插拔优势不构成选型理由。我会继续使用 Pi，在插件插拔时会使用论文里说的那套笨办法，进程重启就是进程级的组合回退。论文花两页论证它为什么不够，包括重启丢状态，恢复要等几秒到分钟，想保住可用性还得常备冗余副本。但这些理由在一个人、任务短、随时能重开的场景下全不成立。

dsh 的热插拔什么时候有价值呢？任务跑了几小时，中间想换组件，又不想从头再来；多会话在线服务要 hotfix，不能打断进行中的会话，团队多人共享一套运行时也同理。

模型自进化组件这个愿景，无论 Pi 还是 dsh 现在都没走到，差别是 dsh 把可替换这套机制作为原子能力造好了。DeepSeek 的赌注逻辑是清晰的，机制先造好并继续迭代 harness，模型能力持续变强，直到两者汇合。但这个汇合点在哪儿，Cordis 论文自己也只敢说还有待验证。

## 参考

- github.com/deepseek-ai/deepseek-harness
- github.com/cordiverse/paper
- lilianweng.github.io/posts/2026-07-04-harness
- github.com/earendil-works/pi
