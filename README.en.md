# dsh-purge-rebuild

A DeepSeek Harness plugin for host patch management, prompt and rule configuration, and a built-in security drill workspace. Works with the official Web and desktop hosts.

Fork of [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge), originally authored by 小杨 (YuJunZhiXue).

[中文](README.md) · **English**

## Features

| Feature | Description |
| --- | --- |
| Patch management | Inspect, apply, revert, and uninstall local Harness patches |
| Prompts and rules | Edit `prompt-inject.md`, manage rule sets, and configure workspace `AGENTS.md` / `CLAUDE.md` injection |
| Skills | Import folders or archives for Harness to load |
| Drill workspace | Manage assets, skills, and environments for authorized exercises |
| Conversation rewind | Undo a step or round and continue through a Harness session fork |

![Patch panel](docs/preview/dock-clean.png)

[Drill workspace preview](docs/preview/dock-drill.png) · [Rule sets preview](docs/preview/rules.png)

## Installation

Requires Node.js 18+ and official DeepSeek Harness 0.2; the current patch target is `0.2.1-rc.2`. Hiding console windows on Windows requires Node.js 22+. Web and desktop use separate profiles; install into each host you use.

### From source

```sh
git clone https://github.com/ipfans/dsh-purge-rebuild.git
cd dsh-purge-rebuild
dsh plugin --profile web add .
```

For desktop profiles that support CLI installation, replace `web` with `desktop`. If the CLI reports that Electron manages the desktop profile, use the desktop plugin installer or follow [manual configuration and migration](docs/publishing.md#安装与迁移) (Chinese).

### From npm

```sh
dsh plugin --profile web add @ipfans/dsh-purge-rebuild
```

When migrating from upstream, replace the old dependency and bundle name **in place**, preserving other plugins and their order. The CLI command and existing data directories still use `dsh-purge`.

### Activate

1. Fully exit and reopen the relevant host, including the desktop tray process.
2. Click **dsh-purge → 清洗 → 应用** beside the conversation title.
3. After the host restarts automatically, begin a new conversation turn.

Use `/purge status` to check host paths and patch status. An incompatible critical patch reports an error and prevents restart; missing optional components are skipped.

## Usage

The sidebar manages patches, prompts, rules, and skills. The drill workspace requires authorization confirmation on first use and is intended for environments you own or have permission to test.

| Entry point | Common commands |
| --- | --- |
| CLI | `dsh-purge --status`, `--apply`, `--revert`, `--uninstall`, `--edit` |
| Chat | `/purge status`, `/purge apply`, `/purge revert`, `/purge uninstall` |
| Rules | `/rules help` |
| Skills | `/skills help` |
| Rewind | `/rewind once`, `/rewind round` |

Plugin configuration lives in [cordis.patch.yml](cordis.patch.yml). Runtime data lives under the current host's `$DSH_HOME`:

| Path | Contents |
| --- | --- |
| `prompt-inject.md` | User prompt |
| `rules/`, `dsh-purge/` | Rule library and plugin state |
| `skills/` | Harness skills |
| `redteam/` | Drill workspace data |
| `net-scope-allow.txt` | Owned-server list, one exact IP or full hostname per line |

Web and desktop may use different `$DSH_HOME` directories; check `/purge status`. Edit the server list in the patch panel. It does not accept subnets, wildcards, keys, or passwords.

Patching creates `.dshpurge.bak` backups. **Revert** preserves the user prompt. **Uninstall** first reverts patches, then removes the prompt, rule library, and plugin; user skills are retained. Back up any configuration you want to keep before uninstalling.

## Development

The repository uses JavaScript ESM and Node.js's built-in test runner. Run:

```sh
npm test
node --check client.js
node --input-type=module -e "import './lib/index.js'"
npm pack --dry-run
```

Tests use temporary directories and simulated processes without modifying your Harness installation. CI checks Node.js 18 and 24 on Linux, Windows, and macOS. Installation, patching, and restart behavior still need validation in the official clients.

| Directory / file | Responsibility |
| --- | --- |
| `lib/index.js`, `bin/` | Plugin entry point, HTTP API, and CLI |
| `lib/core.js`, `lib/identity.js` | Patch application and prompt assembly |
| `lib/desktop.js`, `lib/official-update.js` | Desktop host and official package updates |
| `client.js`, `lib/redteam/` | Sidebar and drill workspace |
| `presets/`, `skills/` | Bundled presets and skills |
| `scripts/`, `test/` | Build scripts and regression tests |

After changing `lib/redteam/client.js`, run `npm run build:client` and commit the generated changes to `client.js`. The outer sidebar is maintained directly in `client.js`.

Run `npm run embed-prompt` only when updating the embedded default prompt. It requires the untracked `lib/default-prompt-inject.md` source and is unnecessary for routine development.

- Before changing code, consult the task-specific entry points and checks in [AGENTS.md](AGENTS.md).
- For releases, follow the [publishing guide](docs/publishing.md) (Chinese) and update [release-notes.md](release-notes.md).
- In [bug reports](https://github.com/ipfans/dsh-purge-rebuild/issues), include the Harness and plugin versions, OS, profile, and failing patch path.

## License

The upstream [LICENSE](LICENSE) and [commercial licensing notes](LICENSE-COMMERCIAL.md) are retained.
