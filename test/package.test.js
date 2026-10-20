import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import { PACKAGE_NAME, findPurgeProfiles, profilePluginDir } from "../lib/update.js";
import { listInstalledProfiles, stripPluginFromPackage, shouldDeletePluginTree } from "../lib/uninstall.js";
import { installPreset } from "../lib/redteam/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const pkg = JSON.parse(read("package.json"));
const require = createRequire(import.meta.url);

test("scoped package exports, Cordis references and browser loader agree", () => {
  assert.equal(pkg.name, PACKAGE_NAME);
  assert.equal(pkg.repository.url, "git+https://github.com/ipfans/dsh-purge-rebuild.git");
  for (const suffix of ["", "/redteam", "/redteam/store", "/redteam/ui", "/redteam/tools", "/client"]) {
    assert.ok(fs.existsSync(require.resolve(`${PACKAGE_NAME}${suffix}`)));
  }
  for (const file of ["cordis.patch.yml", "presets/redteam/agent.cordis.yml"]) {
    const text = read(file);
    assert.doesNotMatch(text, /name:\s*['"]?dsh-purge(?:\/|['"\s])/);
    assert.doesNotMatch(text, /\{\{cwd\}\}/);
    for (const [, name] of text.matchAll(/name:\s*'(@ipfans\/[^']+)'/g)) {
      assert.ok(fs.existsSync(require.resolve(name)), name);
    }
  }
  let loaded;
  vm.runInNewContext(read("client.js"), {
    window: { __ModuleLoader__: { load(module) { loaded = module; } } },
  });
  assert.equal(loaded.id, PACKAGE_NAME);
  assert.equal(typeof loaded.factory, "function");
});

function temporaryHome(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-package-"));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  t.after(() => {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    fs.rmSync(home, { recursive: true, force: true });
  });
  return home;
}

test("update and uninstall find the scoped installation and preserve other bundles", (t) => {
  const home = temporaryHome(t);
  const profile = path.join(home, "profiles", "desktop");
  const moduleDir = path.join(profile, "node_modules", PACKAGE_NAME);
  fs.mkdirSync(moduleDir, { recursive: true });
  const config = {
    dependencies: { before: "1", [PACKAGE_NAME]: "^1.1.72", after: "2" },
    dsh: { profile: { bundles: ["before", PACKAGE_NAME, "after"] } },
  };
  fs.writeFileSync(path.join(profile, "package.json"), JSON.stringify(config));
  assert.deepEqual(findPurgeProfiles().map((entry) => entry.name), ["desktop"]);
  assert.equal(profilePluginDir(profile), fs.realpathSync(moduleDir));
  assert.deepEqual(listInstalledProfiles(home).map((entry) => entry.name), ["desktop"]);
  assert.equal(shouldDeletePluginTree(moduleDir, home), true);
  assert.equal(shouldDeletePluginTree(root, home), false);
  assert.equal(stripPluginFromPackage(config), true);
  assert.deepEqual(config.dependencies, { before: "1", after: "2" });
  assert.deepEqual(config.dsh.profile.bundles, ["before", "after"]);
  assert.equal(stripPluginFromPackage(config), false);
});

test("uninstall recognizes object bundle declarations without matching upstream or similar packages", () => {
  const config = {
    dependencies: { "dsh-purge": "file:upstream", [`${PACKAGE_NAME}-other`]: "1" },
    bundles: [
      { id: "custom-id", name: PACKAGE_NAME },
      { package: PACKAGE_NAME },
      `${PACKAGE_NAME}@1.1.72`,
      "dsh-purge",
      `${PACKAGE_NAME}-other`,
    ],
  };
  assert.equal(stripPluginFromPackage(config), true);
  assert.deepEqual(config.bundles, ["dsh-purge", `${PACKAGE_NAME}-other`]);
  assert.equal(Object.keys(config.dependencies).length, 2);
});

test("existing presets migrate only the tools package and remain idempotent", (t) => {
  const home = temporaryHome(t);
  const target = path.join(home, ".agent-presets", "redteam");
  fs.mkdirSync(target, { recursive: true });
  const file = path.join(target, "agent.cordis.yml");
  const template = read("presets/redteam/agent.cordis.yml");
  for (const oldName of ["dsh-redteam-mode/tools", "dsh-purge/redteam/tools"]) {
    const source = template.replace(`'${PACKAGE_NAME}/redteam/tools'`, oldName)
      + "\n# user customization stays here\n";
    fs.writeFileSync(file, oldName === "dsh-purge/redteam/tools" ? source.replaceAll("\n", "\r\n") : source);
    installPreset();
    const result = fs.readFileSync(file, "utf8");
    assert.match(result, /name: '@ipfans\/dsh-purge-rebuild\/redteam\/tools'/);
    assert.ok(result.endsWith("# user customization stays here\n"));
    installPreset();
    assert.equal(fs.readFileSync(file, "utf8"), result);
  }
});
