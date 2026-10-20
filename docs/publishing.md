# 发布 @ipfans/dsh-purge-rebuild

本分支基于 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge)，原作者为小杨（YuJunZhiXue）。保留原有 LICENSE 和署名。当前 LICENSE 明文限制修改、改名和公开再分发；公开发布前需确认有适用授权，配置工作流不改变该许可。

## 一次性创建 npm 包

npm 要求配置 Trusted Publisher 的包已经存在。仓库代码不能替代 npm 账号的首次创建、2FA 或包设置操作。

在有 `@ipfans` 发布权限的账号下，从已审查的发布提交运行：

```sh
npm login --registry=https://registry.npmjs.org
npm test
npm pack --dry-run
npm publish --access public --registry=https://registry.npmjs.org
```

首次发布只在维护者本地使用交互式认证，GitHub Actions 不需要 `NPM_TOKEN` / `NODE_AUTH_TOKEN` secret。不要在尚未创建的包上直接运行 OIDC 发布。

## 配置 Trusted Publisher

打开 npm 包 `@ipfans/dsh-purge-rebuild` 的 **Settings → Trusted publishing → GitHub Actions**，填写：

| 字段 | 值 |
| --- | --- |
| Organization or user | `ipfans` |
| Repository | `dsh-purge-rebuild` |
| Workflow filename | `release.yml` |
| Environment name | 留空（工作流未指定 environment） |
| Allowed actions | 启用直接 `npm publish` |

工作流文件名只填 `release.yml`，不包含 `.github/workflows/`。新建信任关系后须在两天内成功发布一次；过期则删除并重建配置。验证成功后可在 Publishing access 中禁止长期 token 发布。

依据：[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)、[npm trust 的包存在要求](https://docs.npmjs.com/cli/v11/commands/npm-trust/)。本流程使用 GitHub 托管 runner、Node 24、npm 11（至少 11.5.1），发布 job 具有 `id-token: write`；公开仓库的公开包会自动生成 provenance。

## 后续版本

首次本地发布后，推送同一提交对应的 tag；工作流确认 npm 包完整性与该 tag 的打包结果一致后，跳过重复发布并创建 GitHub Release。内容不一致会失败，不能覆盖。

后续每次发布必须先修改 `package.json` 的版本，并将 `release-notes.md` 第一行更新为 `# <版本>`，提交后再推送对应 tag，例如：

```sh
# 示例：1.1.72 已在本地首次发布，准备好 1.1.73 的代码和发行说明后
git tag v1.1.73
git push origin v1.1.73
```

`.github/workflows/release.yml` 会：

1. 在 Linux、Windows、macOS 的 Node 24 上运行回归测试。
2. 校验 tag、包名、repository URL 和发行说明，检查模块导入和 npm 打包内容。
3. 版本尚不存在时用 OIDC 执行 `npm publish`；已存在时校验完整性。正式版本进入 `latest`，含预发布后缀的版本进入 `next`。
4. 创建 GitHub Release 并上传源码 zip。

手动运行 Release 时同样必须选择对应 tag；选择分支不会发布。npm 已存在的同版本不能覆盖，也不能用重跑来发布不同内容。如果 npm 发布成功而 GitHub Release 步骤失败，可以重跑；完整性校验通过后只补齐 GitHub Release。

普通 push / PR 的 `test.yml` 另测 Node 18 和 24。测试使用临时目录与模拟进程，不会修改或重启本机 Harness。

## 安装与迁移

首次 npm 发布完成后：

```sh
dsh plugin --profile web add @ipfans/dsh-purge-rebuild
```

桌面 profile 若由 Electron 独占管理，使用桌面插件安装入口；旧 CLI 的 `profile "desktop" is managed exclusively by the Electron application` 不能靠改包名解决。也可完全退出桌面端，备份实际 profile 的 `package.json` 后手动配置：

```json
{
  "dependencies": {
    "@ipfans/dsh-purge-rebuild": "^1.1.72"
  },
  "dsh": {
    "profile": {
      "bundles": ["@ipfans/dsh-purge-rebuild"]
    }
  }
}
```

将这两项合并进已有配置，保留其他依赖和 bundles。迁移旧版时，把原 `dsh-purge` bundle **原位替换**为新包名，依赖键也一并替换，不要同时加载两份；已安装时也不要 remove/add 来改变顺序。发布前可用 `"file:../../plugins/dsh-purge"` 指向本地仓库。然后在该 profile 运行 `pnpm install`，重启并应用。

npm 包名改变，CLI 命令仍为 `dsh-purge`，既有数据目录和界面插件 ID 保持不变。

## 0.2.1 修复与验证边界

- #132 / #142：补丁 #40 支持 `requiredContexts` 形状，保留 required 上下文过滤；无法识别的现存目标会报兼容错误并阻止重启，显示补丁号和路径。
- #114 / #136：只在宿主注册 `cwd` 时生成目录后缀，静态配置不再依赖它；用户自定义模板原样保留。
- #142：换包 helper 负责停止进程和重启；宿主不再用固定延时抢先退出。PowerShell 先停止父进程，记录启动、退出、挪包重试和错误。清理识别遗留的 `app.dshpurge-failed-*`；Windows runtime junction 使用安装目录的绝对目标，不再受宿主 cwd 影响。
- `resources/runtime` 被清空的来源尚未复现。清理回归测试确认符号链接/junction 的共享目标保留；本修改不自动下载或重建官方 runtime。实际目录已缺失时，需要先修复官方安装。

本地回归不能替代 Windows/macOS 官方客户端的实机验收，也不能证明其他补丁适配所有 0.2.1 构建。
