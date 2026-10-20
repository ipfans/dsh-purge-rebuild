# dsh-purge-rebuild

DeepSeek Harness 插件，提供宿主补丁管理、提示词与规则集配置，以及内置安全演练台。适用于官方 Web 和桌面端。

Fork 自 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge)，原作者：小杨（YuJunZhiXue）。

**中文** · [English](README.en.md)

## 功能

| 功能 | 说明 |
| --- | --- |
| 补丁管理 | 分组查看状态，应用、还原和卸载本机 Harness 补丁 |
| 提示词与规则集 | 编辑 `prompt-inject.md`，管理多套规则，选择工作区 `AGENTS.md` / `CLAUDE.md` 的注入策略 |
| Skill 管理 | 从文件夹或压缩包导入技能，由 Harness 加载 |
| 演练台 | 管理授权演练的资产、技能和环境 |
| 会话回退 | 撤回一步或上一轮，通过 Harness 分叉会话继续 |

![清洗面板](docs/preview/dock-clean.png)

[演练台预览](docs/preview/dock-drill.png) · [规则集预览](docs/preview/rules.png)

## 安装

需要 Node.js 18+ 和官方 DeepSeek Harness 0.2；当前补丁目标为 `0.2.1-rc.2`。Windows 无闪窗功能需要 Node.js 22+。Web 与桌面端使用各自的 profile，按需分别安装。

### 从源码安装

```sh
git clone https://github.com/ipfans/dsh-purge-rebuild.git
cd dsh-purge-rebuild
dsh plugin --profile web add .
```

支持 CLI 安装的桌面 profile 可将 `web` 替换为 `desktop`。若提示 desktop profile 由 Electron 管理，使用桌面插件安装入口，或按[手动配置与迁移](docs/publishing.md#安装与迁移)操作。

### 从 npm 安装

```sh
dsh plugin --profile web add @ipfans/dsh-purge-rebuild
```

从上游版本迁移时，将 profile 中的旧包依赖和 bundle **原位替换**为新包名，保留其他插件及顺序。CLI 命令和已有数据目录仍使用 `dsh-purge`。

### 启用

1. 完全退出并重新打开对应宿主；桌面端需要退出托盘。
2. 点击会话标题旁的 **dsh-purge → 清洗 → 应用**。
3. 应用成功后宿主自动重启，再新开一轮对话。

用 `/purge status` 核对宿主路径和补丁状态。关键补丁不兼容时会显示错误并阻止重启；缺失的可选组件会跳过。

## 使用

侧栏提供补丁、提示词、规则集和 Skill 管理。演练台首次使用需完成授权确认，适用于自有或已授权的演练环境。

| 入口 | 常用命令 |
| --- | --- |
| 命令行 | `dsh-purge --status`、`--apply`、`--revert`、`--uninstall`、`--edit` |
| 聊天 | `/purge status`、`/purge apply`、`/purge revert`、`/purge uninstall` |
| 规则集 | `/rules help` |
| 技能 | `/skills help` |
| 会话回退 | `/rewind once`、`/rewind round` |

插件配置见 [cordis.patch.yml](cordis.patch.yml)。运行数据位于当前宿主的 `$DSH_HOME`：

| 路径 | 内容 |
| --- | --- |
| `prompt-inject.md` | 用户提示词 |
| `rules/`、`dsh-purge/` | 规则库与插件状态 |
| `skills/` | Harness 技能 |
| `redteam/` | 演练台数据 |
| `net-scope-allow.txt` | “自己的服务器”名单，每行一个确切 IP 或完整主机名 |

Web 与桌面端可能使用不同的 `$DSH_HOME`，以 `/purge status` 为准。服务器名单可在清洗页编辑，不接受网段、通配符、密钥或密码。

应用补丁前会创建 `.dshpurge.bak` 备份。**还原**保留用户提示词；**卸载**会先还原补丁，再删除提示词、规则库和插件，用户 Skill 保留。卸载前请备份需要保留的配置。

## 开发

仓库使用 JavaScript ESM，回归测试基于 Node.js 内置测试框架，可直接运行：

```sh
npm test
node --check client.js
node --input-type=module -e "import './lib/index.js'"
npm pack --dry-run
```

测试使用临时目录与模拟进程，不修改本机 Harness。CI 在 Linux、Windows、macOS 上检查 Node.js 18 和 24；官方客户端的安装、应用与重启仍需实机验证。

| 目录 / 文件 | 职责 |
| --- | --- |
| `lib/index.js`、`bin/` | 插件入口、HTTP 接口与命令行 |
| `lib/core.js`、`lib/identity.js` | 补丁应用与提示词组装 |
| `lib/desktop.js`、`lib/official-update.js` | 桌面宿主与官方包更新 |
| `client.js`、`lib/redteam/` | 侧栏与演练台 |
| `presets/`、`skills/` | 随包预设与技能 |
| `scripts/`、`test/` | 构建脚本与回归测试 |

修改演练台前端 `lib/redteam/client.js` 后，运行 `npm run build:client`，一并提交生成的 `client.js`。外层侧栏直接在 `client.js` 中维护。

仅在更新内置默认提示词时运行 `npm run embed-prompt`；它需要未纳入版本控制的 `lib/default-prompt-inject.md`，普通开发无需执行。

- 修改代码前，按任务查看 [AGENTS.md](AGENTS.md) 中的入口和验证要求。
- 发布新版本时，遵循[发布流程](docs/publishing.md)；版本变更记录在 [release-notes.md](release-notes.md)。
- 报告问题时，在 [Issues](https://github.com/ipfans/dsh-purge-rebuild/issues) 附上 Harness / 插件版本、操作系统、profile 和补丁错误路径。

## 许可

保留上游 [LICENSE](LICENSE) 与[商业许可说明](LICENSE-COMMERCIAL.md)。
