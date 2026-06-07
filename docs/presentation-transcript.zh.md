# OpenSuper 分享原稿整理（中文）

说明：本文件基于作者粘贴的原始分享文本整理而成，主要做了术语归一、错字修正和段落结构化，尽量保持原始表达意图不变。可作为后续提炼分享稿、录视频稿、讲法分析的事实来源。

## 1. 项目起点：为什么会有 OpenSuper

OpenSpec 和 Superpowers 是当下做 AI Coding workflow 时非常有代表性的两个项目。在日常使用过程中，我们一定会有组合 skill 的需求，但问题是两套 skill 的技能命令是分散的，没办法自动触发，并且其中有的部分 skill 我可能并不是那么想用。

比如：

- 我更喜欢用 Superpowers 的 TDD 执行方式；
- 但在需求归档和 spec 生命周期管理上，我更需要 OpenSpec 的 archive 能力，而不是一次性做完就结束。

所以问题就来了：

- 怎么组合市面上这两套高 star 项目；
- 怎么让它们自动触发、互相取长补短；
- 怎么让整个状态流转更可靠；
- 怎么自然融合两边都会产出的 spec / 文档。

OpenSuper 就是组合这两者产生的项目。它想做的事情很直接：**把 OpenSpec 管需求的能力，和 Superpowers 管实现的能力，接到同一条流程里。** 它不改这两套东西，只做组合调度。

## 2. OpenSpec 和 Superpowers 分别擅长什么

### OpenSpec 擅长什么

OpenSpec 很擅长管理 spec 的生命周期：

- 当前需求放在哪里；
- 变更材料放在哪里；
- 最后怎么归档；
- 整条线怎么走。

所以它更对应 WHAT，也就是“要改什么内容”。OpenSpec 能很好地列出大纲，能管理 proposal、design、tasks、spec 和 archive。

但 OpenSpec 也有一些不好用的地方：

- 它的 proposal 和 task 能说明要做什么；
- 但不等于已经说明怎么做；
- 到了工程设计阶段，Agent 还要补方案、补边界、补判断；
- 这个地方正是设计缺口，OpenSpec 的需求澄清能力并没有那么强。

### Superpowers 擅长什么

Superpowers 补的是 HOW，也就是“怎么去做”。

它会：

- 先澄清需求；
- 再做深度设计；
- 然后写计划；
- 按 TDD 推进；
- 最后验证和收尾；
- 中间会不断和用户交互，沟通细节。

也就是说，它把真正实现时需要的链路拉细了。

## 3. 只靠 Markdown 为什么不够

两者都会产出 spec 文档，但如果只靠 Markdown，也会存在另一个问题：

- task 打勾了，不代表阶段状态可靠；
- 人是能够通过看文档猜出来现在大概在哪一步的；
- 但 Agent 下一轮回来，不一定能稳定判断当前到底走到哪一步；
- 所以断点恢复才是核心问题。

下一次会话开始时，通常的断点恢复流程是：

1. 先读文档；
2. 再扫代码；
3. 然后再推断阶段。

代码还没写，token 已经花在恢复现场上了。

OpenSuper 通过一个轻量状态机机制来实现断点恢复，要省掉的就是这段“重新找路”的成本。它不是再造一套方法论，更像是一条稳定轨道，把 OpenSpec 和 Superpowers 放进同一个项目流程里，让两边各做自己擅长的事，并在执行过程中对齐两边产出的文档。

## 4. OpenSuper 在中间做什么

OpenSpec 管需求世界：

- 需求是什么；
- proposal 怎么写；
- spec 怎么变更；
- 最后怎么归档；

这些都属于 WHAT，它负责把要做的事讲清楚。

Superpowers 管执行方法：

- 头脑风暴；
- 技术设计；
- 实现计划；
- 执行；
- 验证；
- 收尾；

这些都属于 HOW，它负责把怎么做拆细。

OpenSuper 站在中间，把 WHAT 和 HOW 接起来：

- 左边是 OpenSpec 的需求材料；
- 右边是 Superpowers 的实现方法；
- 中间输出一条 open / design / build / verify / archive 的流程。

OpenSuper 不替代 OpenSpec，也不替代 Superpowers，它只负责把阶段状态和 skill 触发点对齐。这样两套能力就不是两堆文档了：

- proposal / spec 生命周期 / archive 状态；
- brainstorming / design doc / execution plan；

这些会进入同一条 shared state。

## 5. 五阶段完整流程

完整流程可以拆成五个阶段，每一段都有自己的命令和产物，不靠 Agent 临场猜下一步。

### 第一段：OpenSuper Open

这里由 OpenSpec 接手，打开 change，生成：

- proposal
- design
- tasks

先把这次到底要改什么固定住。

### 第二段：OpenSuper Design

OpenSpec 的产物会交给 Superpowers 继续细化。重点不是马上写代码，而是先把：

- 边界
- 方案
- 风险

讲清楚。

### 第三段：OpenSuper Build

这里进入工程实现：

- plan
- TDD
- subagent

都在这一段接上。能按计划推进，就不要临时乱跑。

### 第四段：OpenSuper Verify

这里 OpenSpec 和 Superpowers 会一起收口：

- 一边处理文档；
- 一边处理代码收尾。

测试要过，报告要有，需求和实现也要对齐，不是跑完代码就算验证结束。

### 第五段：OpenSuper Archive

这里所有的需求变更会同步回 main spec，change 进入 archive，状态机会补全文档状态。

到这个时候，OpenSpec 和 Superpowers 产出的文档会进行双向关联，到这里产出的 spec 关联文档才不会留下半截流程。

所以：

- 需求不是代码写完就结束；
- task 勾完也不够；
- 真正结束是实现、文档和状态都对齐。

## 6. 三层内容结构

使用 OpenSuper 初始化之后，项目会被分成三层：

1. 一层放 OpenSuper 核心脚本；
2. 一层放 OpenSpec 的 change 和状态；
3. 一层放 Superpowers 的设计文档和计划。

OpenSuper 是 skill 的核心入口。用户在使用的时候，不管当前状态如何，都可以通过这个入口继续工作。

它会先检测当前 spec 状态，读取 workflow、phase，然后决定下一步该进哪个阶段。

所以入口不是“直接干活”，而是：

1. 先判断现场；
2. 再路由动作。

## 7. 长任务恢复能力

当我们面对长程任务做到一半，工具关掉了、电脑切换了或者中途离开了的情况，回来之后不应该重新讲一遍背景，而是直接输入：

`/opensuper continue`

它会从当前 spec 状态恢复现场，不再需要重新探索项目。

如果项目里有多个活跃 spec，OpenSuper 会先把它们列出来。当你选择具体的某个 change 时，它再进入阶段判断，这样就不会把几个需求的状态混在一起。

选定之后，它会定位当前阶段，比如现在是 build，就从 build 继续，而不是重新扫描项目。

长程任务真正需要的就是这种明确的继续位置，这种设计能够极大减轻使用认知负担。拿到 skill 后不再需要记多个命令，而是直接 `/opensuper continue` 就好。

## 8. 轻量状态机是怎么支撑恢复的

支撑恢复能力的是轻量状态机。每个 OpenSpec change 都绑定自己的状态，也就是说，状态不是全局混在一起，而是跟着具体需求走。

这里面最关键的是：

- `workflow`
- `phase`

`workflow` 决定走完整流程、hotfix 还是 tweak；
`phase` 决定现在卡在 design、build、verify 还是 archive。

再往下是恢复上下文所需要的字段：

- design doc 在哪；
- plan 在哪；
- build mode 是什么；
- 当前是否在隔离分支里；
- verify result；
- verified at；

这些字段不复杂，但足够判断下一步是不是可以继续。

关键是：**状态不能靠 Agent 手改。**

OpenSuper 要通过脚本写回状态，只有条件真的满足，阶段才允许流转，这样能减少“看起来完成”的状态漂移。

## 9. 守护脚本和状态脚本

OpenSuper 的 guard 脚本就是阶段闸门：

- 它检查文件是否存在；
- phase 是否匹配；
- 条件是否完成；
- 不满足就 hard stop；
- 只有带上 `--apply` 才真正更新状态。

`opensuper-state.sh` 提供统一读写接口；
`opensuper-yaml-validate.sh` 负责校验：

- 必填字段；
- 枚举值；
- 路径引用；
- 未知字段。

一个负责改，一个负责查，状态就不容易漂。

最后是 `opensuper-archive.sh`：

- 验证入口状态；
- 同步 spec；
- 移动 change；
- 把 archive 写成 `true`；
- 也支持 dry-run preview。

## 10. 安装和初始化体验

从 npm 安装之后进入项目，执行 `opensuper init`，OpenSuper 采用交互式命令完成集成，安装步骤非常简单。

初始化会先确认三件事：

1. 平台配置；
2. 安装范围；
3. skill 语言。

你可以装到当前项目，也可以装到全局目录。

为了方便理解 OpenSuper 的原理，分发时也支持中文或英文。选择依赖后，相关 skill 就会自动就位：

- OpenSpec skills
- Superpowers skills
- OpenSuper skills

Specs 和 plan 这些工作目录也会一起创建好。

平台分发也交给 `opensuper init`：

- Claude Code
- Cursor
- Codex
- OpenCode
- Windsurf
- 以及其他 AI Coding 平台

都会按自己的目录结构放好，你不用手动搬 skill 文件。

## 11. Hotfix 和 Tweak

除了完整流程，还有两个轻量预设：

### OpenSuper Hotfix

当 bug 已经明确时，它会跳过完整 brainstorming 和 design，直接走：

- open
- build
- verify
- archive

适合目标很清楚的修复。

### OpenSuper Tweak

文案调整、配置调整、文档修改、prompt 优化，都可以走这条轻路径。

它比完整流程更轻，但仍然保留 OpenSuper 的入口和状态管理。

## 12. OpenSuper 作为组合 Skill 的参考价值

OpenSuper 还有一个价值：它本身就是组合 skill 的参考。

强工具很多，但真实使用时，你常常只需要其中一部分能力，比如：

- OpenSpec 的状态管理；
- Superpowers 的 TDD 和深度设计；
- 再加上 archive 能力。

难点不是把文档拼在一起，难点是稳定组合和嵌套：

- skill 要真的触发；
- 不能只是让 AI 看着说明仿写文件；
- 状态要可观察；
- 不能看起来像触发了，实际没有跑；
- 多阶段流转不能每一步都靠人提醒。

OpenSuper 把必要选择留给用户，把核心推进交给状态机和守护脚本，所以它也是一个参考样本。

真正能落地的多-skill workflow，不是只会调用命令，而是至少要把四块组合起来：

1. skill 调度；
2. 状态机；
3. 阶段守护；
4. 归档自动化。

## 13. 总结

总结一下：

- OpenSpec 让需求有生命周期；
- Superpowers 让实现有方法论；
- OpenSuper 把两者接成一条可恢复、可验证、可归档的流程。

它留下的不是某一个命令，而是一套组合范式：

- 嵌套 skill 要真正触发；
- 多阶段流程要能自动流转；
- 状态机和守护脚本要让流程可靠落地；
- 组合出来的东西要能在真实项目里跑通。

希望大家能从这个项目里学到好用的知识，一起创造更适合自己的 skill。

## 14. 演示线索

如果接下来做演示，可以按下面这条线走：

1. 在本地项目里输入 `/opensuper` + 一个新需求；
2. 展示它如何触发 `/opensuper-open`；
3. 展示它如何进一步触发 OpenSpec explore；
4. 展示 proposal / design / tasks / spec 结构被创建；
5. 展示 `.opensuper.yaml` 状态初始化；
6. 展示 open 阶段退出前的 guard 校验；
7. 展示自动进入 design；
8. 中途退出后，再输入 `/opensuper continue`；
9. 展示它如何直接恢复到当前活跃 change 和当前 phase。
