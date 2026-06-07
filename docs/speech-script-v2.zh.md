# OpenSuper 正式口播稿 V2（中文）

大家好，今天我想讲的不是某一个 AI Coding 工具怎么用，而是一套我自己做出来的、把 AI Coding 真正工程化的系统。这个项目叫 `OpenSuper`，仓库是 `pzy560117/opensuper`。

如果只用一句话来定义它，我会这么说：

> OpenSuper 不是一个简单把 OpenSpec 和 Superpowers 接起来的工具，而是一套把需求、设计、计划、实现、验证、归档接成完整执行链，同时又把规则、讲法和知识沉淀成仓库文档系统的工程化工作流。

也就是说，今天要讲的对象，不只是一个 CLI，不只是几个 skills，也不只是一些 Prompt。我要讲的是两条线：

1. 它作为一套工程系统，是怎么成立的。
2. 它作为一套文档系统，又是怎么把方法论固化下来的。

## 一、为什么会有 OpenSuper

OpenSuper 不是从“我要做一个新工具”开始的。

它真正的起点，是我在真实 AI Coding 使用过程中遇到的一个很具体的问题：单个工具都很强，但它们之间有缝。

比如 OpenSpec，它非常擅长管理需求和 spec 生命周期。当前需求放在哪里，change 放在哪里，proposal、design、tasks 怎么组织，最后怎么 archive，这条线是很清楚的。所以它很适合做 WHAT，也就是回答“要改什么”。

但问题在于，知道“要改什么”，不等于已经知道“怎么改”。到了工程设计和实现阶段，Agent 还需要补方案、补边界、补判断，这些并不是 OpenSpec 最擅长的部分。

再看 Superpowers，它补的是 HOW。它擅长澄清需求、深度设计、写计划、按 TDD 推进实现、最后做验证和收尾。也就是说，它把真正实现时需要的链路拉细了。

所以这两个项目各自都很强，但把它们放到真实工程里单独用时，会出现一个很典型的问题：

- OpenSpec 更偏 WHAT；
- Superpowers 更偏 HOW；
- 规则文件能约束行为；
- 测试、Lint、Review 能校验结果；

但这些东西是散的。

真正让人痛苦的，往往不是第一轮代码写不出来，而是下面这些问题：

- 会话断掉了怎么恢复；
- 当前 change 已经走到哪个阶段；
- spec 和实现是不是已经漂了；
- task 勾完了是不是就真的结束了；
- 分支和工作区有没有混乱；
- verify 和 archive 到底有没有可靠收口。

这些问题如果靠人脑去记，在短任务里还勉强能扛；但在长任务、多轮会话、多需求并行、甚至多台机器切换的时候，就会非常痛苦。

所以 OpenSuper 的出发点，不是“做个新方法论”，而是更直接的一件事：

> 我需要一条稳定轨道，把 OpenSpec 的 WHAT、Superpowers 的 HOW、规则文件、状态、验证和归档接起来。

## 二、OpenSuper 先做对了什么

OpenSuper 做对的第一件事，是没有试图去重写 OpenSpec，也没有试图去重写 Superpowers。

它做的是组合调度。

这点非常重要，因为很多人一遇到这种问题，第一反应就是重造一套自己的系统，把所有事情都吞掉。但 OpenSuper 不是这么做的。它很克制，它承认两边已经各自很强，所以它只做一件事：

把两边各自擅长的能力，接到同一条流程里。

所以你可以把 OpenSuper 理解成一个中间层：

- 左边是 OpenSpec 的需求材料；
- 右边是 Superpowers 的实现方法；
- 中间是一条明确的流程轨道。

OpenSpec 负责把要做的事情讲清楚；
Superpowers 负责把怎么做拆细；
OpenSuper 负责把阶段状态和 skill 触发点对齐。

这意味着它不是两堆文档的简单拼接，而是一个 shared state 之上的阶段系统。

## 三、这套工程系统到底长什么样

如果我今天只讲工程系统，我会把 OpenSuper 拆成四层。

### 第一层：五阶段主链

OpenSuper 先定义了一条五阶段主流程：

1. open
2. design
3. build
4. verify
5. archive

这五个阶段不是好看而已，它的意义是让 AI 不再靠临场猜下一步，而是明确进入一条有上下文、有前后关系的工程链。

在 open 阶段，OpenSpec 负责打开 change，生成 proposal、design、tasks，先把“这次到底要改什么”固定住。

在 design 阶段，OpenSpec 的产物会交给 Superpowers 继续细化。重点不是马上写代码，而是先把边界、方案和风险讲清楚。

在 build 阶段，真正进入工程实现。这里会接上 plan、TDD、subagent、执行策略等能力。

在 verify 阶段，OpenSpec 和 Superpowers 一起收口。一边看文档，一边看代码，测试要过，验证报告要有，需求和实现要对齐。

在 archive 阶段，所有需求变更同步回主 spec，change 进入 archive，状态和文档一起收尾。

所以它解决的不是“怎么更快写第一段代码”，而是“怎么把一整个 change 的生命周期走完整”。

### 第二层：轻量状态机

但如果只有五阶段说明，这还不够。

因为只靠 Markdown 文档，会有一个很现实的问题：

- task 打勾了，不代表阶段真的可靠；
- 人可以猜出来大概在哪一步；
- 但 Agent 下一轮回来，不一定能稳定判断。

这就是为什么 OpenSuper 的第二层不是文档，而是状态机。

每个 OpenSpec change 都会绑定一个独立状态，而不是全局混在一起。这里最关键的状态包括：

- `workflow`
- `phase`
- `design_doc`
- `plan`
- `build_mode`
- `isolation`
- `verify_result`
- `verified_at`
- `verification_report`
- `branch_status`

这些字段不复杂，但足够回答一个关键问题：

> 下一轮会话回来时，系统能不能不重新扫全项目，就知道自己现在该从哪里继续。

这也是我认为 OpenSuper 最有辨识度的点之一。它真正省掉的，不是几条命令，而是断点恢复时那段重新找路、重新理解现场、重新消耗 token 的成本。

### 第三层：守护脚本和硬约束

只有状态还不够，状态还必须可靠。

所以 OpenSuper 的第三层，是守护脚本和硬约束。

这里面最核心的是四个脚本：

- `opensuper-state.sh`
- `opensuper-guard.sh`
- `opensuper-archive.sh`
- `opensuper-yaml-validate.sh`

它们不是附属工具，而是这套系统能不能站住的根基。

`opensuper-state.sh` 负责统一读写状态；
`opensuper-guard.sh` 是阶段闸门；
`opensuper-archive.sh` 负责收尾与归档自动化；
`opensuper-yaml-validate.sh` 负责校验必填字段、枚举值、路径引用和未知字段。

这意味着 OpenSuper 不只是“给你建议”，而是把很多关键点升级成了脚本级硬约束。

比如：

- `isolation` 必须是 `branch` 或 `worktree`；
- `build_mode` 必须明确；
- `verification_report` 必须存在；
- `branch_status` 必须处理完成；
- 项目可以显式配置 `build_command / verify_command`。

这层的价值，我最喜欢用一句话来概括：

> OpenSuper 把“容易忘”变成“忘不了”，把“看起来完成”变成“必须证明完成”。

### 第四层：产品化与工程质量

如果到这里为止，它还只是一个内部 workflow 原型。

真正让 OpenSuper长成“工程系统”的，是第四层：产品化和工程质量。

也就是它没有停在“我本地能用”，而是继续长成了一个可以安装、可以验证、可以发布、可以维护的仓库产品。

它有：

- `opensuper init`
- `opensuper status`
- `opensuper doctor`
- `opensuper update`

它支持：

- JSON 输出
- 多平台 skill 分发
- 中英文技能
- GitHub Actions
- PR title lint
- release 工作流
- Changelog 持续维护

这说明它已经不是个人工作流草稿，而是有明确产品边界、有测试覆盖、有发布链路的仓库系统。

## 四、为什么这套工程尤其适合 C/C++ 和 TS 项目

这里我想特别强调一下，因为这不是一句“顺便适合”的话，而是 OpenSuper 很强的一个定位。

### C/C++ 项目

对 C/C++ 项目来说，最痛苦的问题从来不是写出几行代码，而是：

- 构建链复杂；
- 平台差异大；
- 头文件和实现耦合高；
- 一个错误可能牵动 ABI、生命周期、线程安全和链接行为；
- 编译过了也不等于行为安全。

这类项目最怕 AI 在没有设计边界和验证口径的情况下直接下手。

OpenSuper 的价值就在于，它会强迫改动回到：

- 规格
- 设计
- 计划
- 验证
- 归档

也就是说，它非常适合把高风险改动拖回到工程轨道里。

### TS 项目

TS 项目则是另一种问题。

它们通常改动快、覆盖广、反馈快，看起来很好做，但也特别容易产生一种错觉：页面能跑起来了，好像就算完成了。

但真实情况往往是：

- UI、类型、接口、脚本、测试会一起漂；
- Monorepo、多包依赖和工具链升级很常见；
- `pnpm dev` 能起不代表边界清楚；
- 能编译不代表行为没有回归。

所以 TS 项目真正需要的，不是让 AI 改得更快，而是让 AI 改得更有边界。

OpenSuper 在 TS 项目里的价值，就是把：

- 类型检查
- lint
- 测试
- E2E
- contract

这些本来就存在的 Sensors，接进完整 verify 链，而不是把它们当成零散命令。

## 五、为什么我说它不只是工程系统，还是文档系统

到这里，如果只讲脚本、状态机、CLI、tests，其实还是不完整。

因为 OpenSuper 还有另一条同样重要的线：文档系统。

很多人会下意识觉得，工程系统是代码，文档只是补充。

但在 OpenSuper 里，文档本身就是工程的一部分。

现在这个仓库里，至少有这些文档表面：

- `README-zh.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/guide.zh.md`
- `docs/origin-and-evolution.zh.md`
- `docs/presentation-transcript.zh.md`
- `docs/talk-track.zh.md`

这些文档不是写着好看，它们各自承担的是不同职责：

- README 负责对外入口；
- AGENTS 负责短导航和全局边界；
- CLAUDE 负责项目规约；
- Guide 负责方法论映射；
- Origin 负责讲项目怎么来的、做了什么；
- Transcript 负责保留原始口播素材；
- Talk-track 负责整理对外讲法。

换句话说，OpenSuper 不只是把执行链做出来了，它还把解释链、规则链和知识回流链也做出来了。

这件事非常关键，因为一个工程如果只能运行、不能解释、不能沉淀、不能传播，它最终还是会高度依赖作者本人。

而 OpenSuper 的文档系统，实际上就在做一件事：

> 把作者自己的 AI Coding 方法论，从“我脑子里知道”变成“仓库里能找到、能复用、能继续生长”的资产。

## 六、这个工程到底应该怎么对外讲

如果今天我要正式对外介绍 OpenSuper，我不会从“这是一个什么命令”开始。

我会直接从下面这段开始：

> AI Coding 最大的问题，不是第一次写不出代码，而是需求、设计、实现、验证、归档之间没有一条稳定轨道。OpenSuper 就是在解决这件事。它把 OpenSpec 的 WHAT、Superpowers 的 HOW、状态机、守护脚本、验证链和归档链接成了一套工程系统；同时又把规则、讲法、起源和经验沉淀成仓库文档系统。它真正想证明的不是 AI 能不能写代码，而是 AI 写代码这件事能不能被工程化，能不能被解释，能不能被复用。

然后我会按下面这个结构讲：

### 第一部分：工程系统

- 五阶段主链
- 状态机
- guard / archive / validate
- CLI / tests / release

### 第二部分：文档系统

- README
- AGENTS
- CLAUDE
- Guide
- Origin
- Transcript
- Talk-track

### 第三部分：作者的方法论

- 不重写 OpenSpec / Superpowers，只做组合调度；
- 不满足于“能跑”，而追求“能恢复、能验证、能归档、能复用”；
- 不把经验留在聊天里，而是继续沉到规则、脚本、测试和文档里。

### 第四部分：语言落地

- 为什么对 C/C++ 很重要；
- 为什么对 TS 很重要；
- 为什么这两类项目最能体现 OpenSuper 的价值。

## 七、最后我想把结论落在这里

OpenSuper 最终证明的，不是“我把两个高 star 项目组合起来了”，而是：

> AI Coding 真正需要的，不只是强模型和强工具，而是一套把执行链、规则链和知识链接起来的工程系统。

如果这套系统只存在于代码里，它还不够完整；  
如果它只存在于文档里，它也不够落地；  
只有当工程系统和文档系统一起存在，它才真正变成一个可以持续演进、可以对外讲清楚、也可以被别人拿走继续用的项目。
