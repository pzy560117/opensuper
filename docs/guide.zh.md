# OpenSuper Guide（中文）

这份文档把 OpenSuper 仓库与“OpenSpec / Superpowers / CLAUDE.md / Harness Engineering”这套实践方法一一对齐。目标不是介绍孤立工具，而是说明它们如何共同组成一条可控、可恢复、可验证的 AI Coding 工程流程。

## 0. 为什么这个仓库值得单独讲

`pzy560117/opensuper` 不是“把几个流行工具放在一起”的展示仓库，而是作者本人围绕真实 AI Coding 工作流反复打磨出来的工程样本。理解这一点很重要，因为它决定了这份仓库文档的阅读方式：

- 它不是第三方综述，而是作者对自己实践中反复出现的问题做的结构化回应。
- 它不是孤立 Prompt 集合，而是把 Prompt、状态、脚本、测试、发布链路组合成一个完整 harness。
- 它不是“OpenSpec + Superpowers 的简单胶水层”，而是试图回答一个更具体的问题：怎样把规格、设计、计划、实现、验证、归档串成一条能断点恢复、能控制质量、能减少 token 浪费的工程链。

### 从作者视角看，这个项目主要在解决什么

1. OpenSpec 很强，但更偏 WHAT 管理；Superpowers 很强，但更偏 HOW 执行。单独使用时，中间会留下不少“靠人脑补”和“靠下次会话重新理解”的缝隙。
2. 真实 AI Coding 里，最大成本常常不是第一次生成代码，而是断点续跑、状态漂移、规格漏同步、任务勾选不及时、分支收尾不干净。
3. 很多团队已经在用 `CLAUDE.md`、Guide、测试、Review、Lint，但这些约束通常是散的。OpenSuper 的价值在于把这些散落机制接成一条带状态机的流程。

### 为什么它适合作为讲解样本

- 它同时覆盖了工具编排、仓库规则、状态脚本、测试护栏、发布流程，不只停在概念层。
- 它把“方法论”落成了可检查的仓库事实：技能文件、shell 脚本、Vitest、GitHub Actions、README、CHANGELOG。
- 它能直接展示作者的工程取向：不满足于“能跑”，而是追求“能恢复、能验证、能归档、能复用”。

所以，下面的分析不应被理解成“如何使用一个现成工具”，而更应该被理解成“作者如何把自己的 AI Coding 方法沉淀成一个可重复执行的仓库产品”。

如果要专门看“这个项目是怎么来的、演进过程中做了什么”，读 [origin-and-evolution.zh.md](origin-and-evolution.zh.md)。

## 0.1 为什么尤其适合 C/C++ 和 TS 项目

图片里特别提到“尤其适合针对 C/C++ 和 TS 项目”，这不是偶然。作者把 OpenSuper 打磨成现在这个形态，本质上正是在回应这两类项目里最典型、也最容易被 AI 放大的工程问题。

### C/C++ 项目为什么更需要这套东西

- **构建链复杂**：CMake / Ninja / Make / Bazel / MSBuild 往往不只是“一条 build 命令”，而是平台、编译器、配置、依赖和生成物共同作用。AI 如果没有明确规格和验证口径，很容易只改通一个局部路径。
- **头文件与实现耦合高**：一次改动可能跨多个 `.h/.hpp/.cc/.cpp`，还会影响 ABI、宏、模板实例化和链接行为。没有计划与变更边界时，模型很容易出现“局部修了、整体坏了”。
- **错误成本高**：内存、并发、生命周期、未定义行为这类问题，往往不会在表面代码改动处暴露，必须依赖编译、测试、sanitizer、review 等多层 Sensors。
- **跨平台差异大**：Windows / Linux / macOS，GCC / Clang / MSVC，经常不是同一套行为。OpenSuper 里对 shell、命令、隔离和验证的强调，对这类项目尤其关键。

### TS 项目为什么也非常适合

- **改动面宽且快**：TS 项目通常迭代很快，前后端、Node 服务、工具链、脚本、前端 UI 会互相牵连。AI 很容易在“看起来编译通过”的情况下留下类型漂移、接口不一致或行为回归。
- **表面反馈太快，容易误判完成**：很多 TS 项目 `pnpm dev` 一跑就能看到页面或接口，但“能启动”不代表“规格满足、边界清楚、验证充分”。
- **单仓 / Monorepo 常见**：包之间依赖多、脚本多、子项目多，更需要用 spec 和 plan 管住改动范围，用 worktree/branch 管住上下文污染。
- **规则表面天然丰富**：TS 项目通常本来就有 ESLint、Prettier、Vitest/Jest、类型检查、Playwright/Cypress。OpenSuper 很适合把这些现成 Sensors 串进完整链路，而不是只把它们当零散命令。

### 两者的共同点

- 都不是“写一段代码就结束”的项目，而是高度依赖约束、上下文和验证闭环。
- 都很容易让 AI 在局部最优里走偏。
- 都特别适合把“规格先行 + 分阶段执行 + 隔离 + Sensors + 归档沉淀”作为默认工作方式。

## 1. OpenSpec：从需求到可执行规格

### 为什么 AI Coding 更需要规格先行

- 模型很擅长快速产出，但也更容易在边界不清时产生幻觉、返工和隐性偏差。
- 规格不是额外负担，而是把“需求、约束、变更范围、验收口径”前置，减少后续失控。
- OpenSuper 的定位不是替代 OpenSpec，而是把 OpenSpec 产出的 change 结构接入后续设计、实现、验证、归档链路。

### OpenSpec 核心流程与 OpenSuper 对照

| OpenSpec | OpenSuper 中的承接点 | 产物 / 作用 |
| --- | --- | --- |
| `propose` | `/opensuper-open` | proposal、design、tasks、初始化状态 |
| `apply` | `/opensuper-design` + `/opensuper-build` | 设计文档、实现计划、代码变更 |
| `verify` | `/opensuper-verify` | 验证报告、分支处理、guard 校验 |
| `archive` | `/opensuper-archive` | delta spec 同步、归档、状态标注 |

对 C/C++ 和 TS 项目来说，这个映射尤其重要，因为它把“先说清楚边界，再动复杂构建链或大面积类型面”的顺序固定了下来。

### 这在仓库里落在哪里

- `assets/skills-zh/opensuper-open/`：change 初始化与 OpenSpec 入口。
- `assets/skills-zh/opensuper/`：五阶段主工作流。
- `assets/skills/opensuper/scripts/`：状态、guard、archive、schema 校验。
- `README-zh.md`：对外说明工作流和状态结构。

### 作为作者项目，这一层的关键设计判断

- 作者没有把 OpenSpec 当成“生成 proposal 的前置工具”，而是把它当成整条链路的 change 容器。
- 重点不是“先有 spec”这句口号，而是让后续 design、plan、verify、archive 都围绕同一个 change 运转。
- 这解释了为什么仓库里会显式强调 proposal / design / tasks / delta spec / archive 的连续性，而不是只强调某一个阶段。

对于 C/C++，这能防止模型直接下手改 build graph、头文件边界或线程模型；对于 TS，这能防止模型在没有界定 API、类型和组件职责时就大面积改代码。

## 2. Superpowers / CLAUDE.md / Guide：给 AI 建立开发纪律

### Superpowers 的价值

- 把大任务拆成“澄清 → 设计 → 计划 → 实现 → 验证”。
- 限制模型一次吃完整头大象，要求显式计划、显式验证、显式收尾。
- 用流程约束模型，而不是只靠单轮 Prompt 祈祷结果正确。

这对 C/C++ 和 TS 的价值尤其大：

- C/C++ 项目更怕“跳过设计直接改实现”，因为一个设计判断可能影响模块边界、线程安全、内存所有权或编译单元组织。
- TS 项目更怕“一口气改很多文件”，因为 UI、类型、接口、脚本和测试经常一起漂。

### CLAUDE.md / Guide 的三层结构

| 层级 | 在 OpenSuper 中的建议载体 | 主要内容 |
| --- | --- | --- |
| 全局层 | 平台默认规则 / 组织级要求 | 安全边界、基本工程习惯、不可伪造验证 |
| 团队层 | 团队模板、复用 Guide、贡献规范 | 评审方式、提交约定、质量门禁、知识回流 |
| 项目层 | 本仓库的 `CLAUDE.md` / `AGENTS.md` / 技能文件 | 目录地图、状态机约束、技能维护顺序、跨平台注意事项 |

### 本仓库里的角色分工

- `AGENTS.md`：短导航，只放启动顺序、目录地图、全局边界。
- `CLAUDE.md`：项目层可执行规约，说明怎么工作、何时人工介入、哪些约束不能破。
- `assets/skills-zh/` 与 `assets/skills/`：真正驱动阶段行为的指令。
- 本文档：长说明，用来承载方法论与映射关系。

### 作为作者项目，这一层的关键设计判断

- 作者显然不希望仓库规则只停留在一个超长 `CLAUDE.md` 里，因此拆成了短 `AGENTS`、项目规约和长 Guide 三类载体。
- 这种拆分背后的核心思想是：导航、约束、背景知识是三种不同对象，混写会让 AI 和人都更难读。
- 这也说明 OpenSuper 不只是一个 CLI/技能包，而是一个带“规则表面”的工程化产品。

## 3. Worktree / 分支 / 会话隔离

### 为什么必须显式隔离

- OpenSuper 的 `/opensuper-build` 已经把 `isolation` 作为脚本级硬约束，不允许靠“默认当前目录”含糊带过。
- 对 AI 来说，隔离不仅是 Git 策略，也是会话边界、计划边界和验证边界。

### 推荐策略

| 场景 | 推荐方式 | 原因 |
| --- | --- | --- |
| 小改动、单文件修复 | `branch` | 成本低，切换快 |
| 高风险重构、并行任务、现有工作区很脏 | `worktree` | 隔离更强，减少相互污染 |
| 同时推进多个 change | 多 worktree | 避免同会话混线 |

对 C/C++ 项目，`worktree` 往往更值得优先考虑，因为编译产物、生成目录和试验性改动更容易互相污染。对 TS Monorepo，`worktree` 也很适合隔离多包并行修改和依赖升级试验。

### 会话隔离原则

- 一个会话只推进一个明确目标。
- 需要更换目标时，先结束当前验证链路，再开新分支或新 worktree。
- 计划文件、设计文档、验证报告应和改动范围保持一一对应。

### 作为作者项目，这一层的关键设计判断

- 这里最有代表性的地方，是作者把 `isolation` 从经验建议升级成了脚本强约束。
- 这反映的不是 Git 偏好，而是一种 AI Coding 观念：隔离方式会直接影响计划可访问性、状态一致性、验证口径和会话恢复成本。
- 也正因为这是作者自己踩坑后收敛出的规则，所以它被写进状态机和测试，而不是只写进 README 的一句提醒。

## 4. Harness Engineering：让 AI Coding 可控

### Agent = Model + Harness

- Model 负责理解、生成、修改。
- Harness 负责把约束、状态、验证和归档接到模型外侧，避免结果只停留在“看起来合理”。

### Guides 与 Sensors

| 类型 | 在 OpenSuper 中的体现 |
| --- | --- |
| Guides | README、AGENTS、CLAUDE、技能文件、CONTRIBUTING、CHANGELOG |
| Sensors | Vitest、shell tests、lint、format、GitHub Actions、prepublish 检查 |

如果迁移到真实业务仓库，作者更推荐把语言相关 Sensors 接上来：

- **C/C++**：编译、单测、集成测试、`clang-tidy`、`clang-format`、sanitizer、静态分析、review。
- **TS**：`tsc --noEmit`、单测、E2E、ESLint、Prettier、bundle/build、API contract 校验、review。

### 人类角色的变化

在这套流程里，人类不再主要扮演“亲手把每行代码敲出来的人”，而更多承担：

- 定义目标与约束；
- 选择隔离方式和工作模式；
- 审查验证结果是否足够；
- 判断何时接受设计偏差、何时回退补规格；
- 把共性经验沉淀成下一次可复用的规则和模板。

### 作为作者项目，这一层的关键设计判断

- OpenSuper 的作者并没有把 Harness Engineering 讲成抽象理念，而是把它落实成 Guides、Sensors、状态脚本和 release 流程。
- 这说明仓库本身就是一个论点：AI Coding 的关键竞争力不只是模型强弱，而是 surrounding harness 是否足够工程化。
- 从这个角度看，`pzy560117/opensuper` 更像一份“作者的工程主张实现”，而不仅仅是一个 npm 包。

而 C/C++ 与 TS 正是最能体现这个论点的两类项目：

- C/C++ 证明“没有强 harness，AI 很容易写出看似合理但危险的改动”。
- TS 证明“没有强 harness，AI 很容易写出看似高效但边界失真的改动”。

## 4.1 面向 C/C++ 与 TS 的落地建议

### C/C++ 项目推荐

1. 在 `proposal` 和 `design` 阶段明确模块边界、线程模型、所有权、异常策略、平台差异和构建入口。
2. 在 `plan` 阶段显式拆分“接口调整”“实现调整”“构建脚本调整”“验证增强”。
3. 在 `.opensuper.yaml` 或仓库根配置中优先写死 `build_command` / `verify_command`，不要完全依赖自动探测。
4. 把编译成功、核心测试、静态分析、必要 sanitizer 当成 verify 的最小集合。

示例：

```yaml
build_command: cmake -S . -B build -G Ninja && cmake --build build
verify_command: ctest --test-dir build --output-on-failure
```

如果是 Windows/MSVC 项目，也可以用项目实际命令替换，例如：

```yaml
build_command: cmake -S . -B build -G "Visual Studio 17 2022"
verify_command: cmake --build build --config Release && ctest -C Release --test-dir build --output-on-failure
```

### TS 项目推荐

1. 在 `proposal` 和 `design` 阶段明确数据流、类型边界、API contract、组件职责和包边界。
2. 在 `plan` 阶段避免“全仓一起改”，优先按接口层、类型层、实现层、验证层拆分。
3. 让 `verify_command` 至少覆盖类型检查和测试，而不是只跑开发服务器。
4. 对前端项目，建议把关键页面或关键流程的 E2E 纳入 verify；对 Node 服务，建议把 contract test 或集成测试纳入 verify。

示例：

```yaml
build_command: pnpm build
verify_command: pnpm exec tsc --noEmit && pnpm test
```

如果是前端主仓，也可以更严格一些：

```yaml
build_command: pnpm build
verify_command: pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm exec playwright test
```

### 一个作者视角下的经验总结

- C/C++ 项目里，OpenSuper 最有价值的是“把高风险改动拖回到规格、计划和验证轨道里”。
- TS 项目里，OpenSuper 最有价值的是“把高频改动从局部快修拉回到边界一致性和验证闭环里”。
- 两者都说明：AI Coding 真正需要的不是更多自由，而是更清楚的轨道。

## 5. 知识沉淀机制

### 项目个性化知识

- 写入 `CLAUDE.md` 或 `docs/`。
- 例如：状态字段含义、跨平台脚本注意事项、README 资产策略。

### 共性经验

- 先在本仓库通过规则、测试、文档验证有效，再回流到共享模板或上游技能。
- 例如：Windows 上优先选择 Git Bash、README 图片使用 raw GitHub URL、状态脚本要兼容 GNU/BSD 差异。

### “知识库” 与 “可执行规约” 的区别

- 解释背景、原理、权衡：写进 Guide 或文档。
- 约束下一次执行：写进 `AGENTS.md`、`CLAUDE.md`、技能文件、脚本或测试。

如果一条经验既重要又经常被遗忘，就不应只存在于文档里，最好再补一个脚本检查或测试。

### 作为作者项目，这一层的关键设计判断

- 这也是理解本仓库最重要的一点：作者并不满足于“有文章讲过”或“我在会话里解释过”。
- 真正重要的经验会继续下沉，变成规则、测试、状态字段、脚本或发布门禁。
- 因此，这个仓库既是工具仓库，也是作者对自己 AI Coding 工作方法的知识固化仓库。
