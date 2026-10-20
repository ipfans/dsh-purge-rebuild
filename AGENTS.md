# 仓库协作指南

## 按任务读取

仅加载当前改动相关的入口，再沿调用关系查找实现：

| 任务 | 先读 |
| --- | --- |
| 宿主补丁、提示词兼容 | `lib/core.js`、`lib/identity.js`、`test/compat.test.js` |
| 桌面重启、换包、清理 | `lib/desktop.js`、`lib/official-update.js`、`lib/restart-desktop.js`、`test/desktop.test.js` |
| 规则集、技能导入 | `lib/rules.js`、`lib/skills.js`；接口调用见 `lib/index.js` |
| 侧栏、演练台 | `client.js`、`lib/redteam/client.js`；后端入口见 `lib/redteam/ui.js` |
| 包名、安装、更新、卸载 | `package.json`、`cordis.patch.yml`、`lib/update.js`、`lib/uninstall.js`、`test/package.test.js` |
| CI、发布、安装迁移 | [docs/publishing.md](docs/publishing.md)，再读对应 `.github/workflows/` 文件 |
| 用户文档 | [README.md](README.md) 与 [README.en.md](README.en.md)；`README.zh-CN.md` 仅保留中文入口 |

## 修改约束

- 补丁作用于已安装的宿主文件。保留备份、重复应用检测和还原路径；未知宿主文件形状应报告补丁号与路径，关键补丁失败时阻止重启。
- 修改路径探测或清理时，覆盖 Web / desktop 各自的 `$DSH_HOME`，以及符号链接 / junction 指向的共享 runtime；测试用临时目录，不对本机安装执行应用、卸载或重启。
- npm 包名与运行时标识不同。保留已有 `dsh-purge` CLI、插件 ID 和数据目录；包引用变化需同步检查 exports、Cordis 配置、浏览器加载器和预设，迁移时保留其他 bundles 及顺序。
- 用户提示词、规则与自定义模板按用户数据处理；兼容修复保留自定义内容。
- 修改演练台前端时编辑 `lib/redteam/client.js`，运行 `npm run build:client`，提交生成的 `client.js`。`client.js` 中 `__DSH_PURGE_DRILL_BEGIN__` / `END` 之间是生成区域，外层侧栏直接编辑。
- 仅更新内置提示词时运行 `npm run embed-prompt`。原文 `lib/default-prompt-inject.md` 被忽略，保持其不入库；普通改动保留现有 `lib/asset-table.js`。

## 完成检查

- 代码改动：按 [README 开发章节](README.md#开发)运行回归、语法、入口导入与打包检查。行为修复在对应 `test/` 文件补充回归用例。
- 桌面或升级逻辑：报告自动化覆盖范围，以及是否完成官方客户端实机验证。
- 文档改动：核对命令与当前代码一致、相对链接可达；功能或使用说明变化同步英文版。
- 提交前运行 `git diff --check`；发布额外遵循发布文档中的版本、tag 与发行说明校验。

<!-- BEGIN COMPOUND CODEX TOOL MAP -->
## Compound Codex Tool Mapping (Claude Compatibility)

This section maps Claude Code plugin tool references to Codex behavior.
Only this block is managed automatically.

Tool mapping:
- Read: use shell reads (cat/sed) or rg
- Write: create files via shell redirection or apply_patch
- Edit/MultiEdit: use apply_patch
- Bash: use shell_command
- Grep: use rg (fallback: grep)
- Glob: use rg --files or find
- LS: use ls via shell_command
- WebFetch/WebSearch: use curl or Context7 for library docs
- AskUserQuestion/Question: present choices as a numbered list in chat and wait for a reply number. For multi-select (multiSelect: true), accept comma-separated numbers. Never skip or auto-configure — always wait for the user's response before proceeding.
- Task/Subagent/Parallel: run sequentially in main thread; use multi_tool_use.parallel for tool calls
- TodoWrite/TodoRead: use file-based todos in todos/ with todo-create skill
- Skill: open the referenced SKILL.md and follow it
- ExitPlanMode: ignore
<!-- END COMPOUND CODEX TOOL MAP -->
