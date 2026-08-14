---
title: 我把 Claude Code 换成了 Pi
date: 2026-08-04
taxonomies:
  categories: ["AI"]
  tags: ["杂谈", "AI", "Agent", "Pi", "Claude Code"]
---

Databricks 拿自己几百万行的代码库实测了一批 Coding Agent，在同一个模型、同样的 thinking 档位下，变量只有 Harness，结果产物质量基本持平，任务成本能差出 2 倍以上。Pi 每轮喂给模型的上下文，只有其他 Harness 的三分之一左右。

换完之后我就一直高强度用 Pi 到现在，中途一次都没用回 Claude Code。

![](https://raw.githubusercontent.com/L2ncE/images/main/PicGoPasted%20image%2020260811175848.png)

## 为什么是 Pi

### 同样的模型，少得多的成本

![](https://raw.githubusercontent.com/L2ncE/images/main/PicGoEADCBCED-6040-4BBC-A718-62F559A92F20.png)

Databricks 原文里有两句话我很认同。

> "the harness a model is called from dramatically impacts cost and quality"
> "in many cases, simple harnesses like Pi performed best on our workloads"

Pi + Opus 4.8 得分全场最高，成本还显著低于 Claude Code 和 Codex。

原因在于 Harness 每轮对话都要注入大量上下文，system prompt、工具定义、历史消息，塞得越多，每轮烧的 token 越多。按 Databricks 的观察，Pi 不乱往上下文里堆东西，工作集小，收尾也快。

### 不到 1000 token 的 system prompt

Pi 开箱只有 4 个工具，system prompt 加工具定义一共不到 1000 token。Claude Code 这类 Harness 正好相反，新开一个 Session，前面已经垫了一大段上下文，模型还没干活，先被自己分散了注意力。

我的看法是，模型能力越来越强之后，弱模型靠 Harness 兜底，强模型怕 Harness 束缚。复杂的 system prompt 和工具集，是给弱模型准备的拐杖。模型越强，越不需要 Harness 替它拿主意，塞进去的冗余指令反而稀释注意力。

## 快速开始

https://pi.dev/

```sh
curl -fsSL https://pi.dev/install.sh | sh
```

### 个人插件推荐

从上面的描述能够知道，Pi 提供给我们的是一个毛坯房，想要用的舒服也得简单添置些家具。下面的是我日常使用的插件，可以按需安装。

| 名称                     | 一句话说明                                            | 安装方式                                                 |
| ---------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| @ff-labs/pi-fff        | 用 Rust 原生、SIMD 加速的 FFF 模糊搜索替换内置 `find`/`grep` 工具 | `pi install npm:@ff-labs/pi-fff`                     |
| @narumitw/pi-btw       | 新增 `/btw` 旁路提问命令，在临时侧线程快速答疑，不污染主对话               | `pi install npm:@narumitw/pi-btw`                    |
| Dovyski/pi-recap       | 每次交互结束后在状态栏显示斜体小结，并更新终端标签页标题                     | `pi install git:https://github.com/Dovyski/pi-recap` |
| pi-powerline-footer    | Powerline 风格状态栏，带欢迎浮层和 AI 生成的加载提示语               | `pi install npm:pi-powerline-footer`                 |
| pi-subagents           | subagents 的 Pi 实现，可以用 Herdr/Tmux 代替              | `pi install npm:pi-subagents`                        |
| pi-tool-display        | 紧凑渲染工具调用、diff 可视化与输出截断，让 TUI 更清爽                 | `pi install npm:pi-tool-display`                     |
| pi-web-access          | 网页搜索、URL 抓取、GitHub 克隆、PDF 提取                     | `pi install npm:pi-web-access`                       |
| @ogulcancelik/pi-herdr | 通过 Pi 控制 Herdr，代替 subagents                      | `pi install npm:@ogulcancelik/pi-herdr`              |

## 一些 Tips

- 使用 AGENTS.md：Claude Code 读的是 CLAUDE.md，Pi 中需要换成 AGENTS.md（https://agents.md/ ），任何非 Claude Code 的 Harness 都可以直接复用。
- matt 全家桶：全世界最会写 Skill 的人的 Skill 集合，尤其推荐 grill-me，只需两句话即可替代 superpowers、ecc、speckit 等重量级框架。

> 模型能力越来越强，老一套重型框架有点拖后腿：
>
> - superpowers & ecc & speckit => matt skills
> 
> - Claude Code & OpenCode => Pi

- 使用不同厂商的模型交叉 Review 代码：主 Agent 用一个模型干活，Review 时的 subagent 换成别家模型，Ensemble review 能有效避免单一模型的系统性盲区。

![Pi 使用截图](https://raw.githubusercontent.com/L2ncE/images/main/PicGoPasted%20image%2020260804212025.png)

## 我的判断

在模型能力越来越强后，曾经为 LLM 插上翅膀的 Harness 在慢慢变成绊脚石，而轻量级、开源的 Pi 优势会越来越大。
