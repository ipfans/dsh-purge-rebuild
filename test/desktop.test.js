import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scheduleAsarSwapRestart, repairOfficialCliAfterUnpack } from "../lib/desktop.js";
import { clearStaleExtractedApps } from "../lib/official-update.js";

test("a slow or failed PowerShell helper never makes the host exit first", (t) => {
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  const spawn = childProcess.spawn;
  const setTimeout = globalThis.setTimeout;
  const timers = [];
  const child = new EventEmitter();
  child.unref = () => {};
  let command;
  childProcess.spawn = (...args) => { command = args; return child; };
  syncBuiltinESMExports();
  Object.defineProperty(process, "platform", { value: "win32" });
  globalThis.setTimeout = (fn) => { timers.push(fn); return { unref() {} }; };
  t.after(() => {
    childProcess.spawn = spawn;
    syncBuiltinESMExports();
    Object.defineProperty(process, "platform", platform);
    globalThis.setTimeout = setTimeout;
    fs.rmSync(command[1][command[1].indexOf("-File") + 1], { force: true });
  });
  for (const runtime of [null, { requestRestart() { throw new Error("helper owns restart"); } }]) {
    assert.equal(scheduleAsarSwapRestart({
      exe: "C:\\Harness\\DeepSeek Harness.exe", asar: "C:\\Harness\\resources\\app.asar",
      exit: true, runtime,
    }).scheduled, true);
  }
  child.emit("error", new Error("PowerShell unavailable"));
  assert.equal(command[0], "powershell.exe");
  assert.deepEqual(timers, []);
  if (platform.value === "win32") {
    childProcess.execFileSync("powershell.exe", ["-NoProfile", "-Command", [
      "$tokens = $null; $errors = $null",
      "[void][System.Management.Automation.Language.Parser]::ParseFile($env:DSH_PURGE_TEST_SCRIPT, [ref]$tokens, [ref]$errors)",
      "if ($errors.Count) { throw ($errors | Out-String) }",
    ].join("; ")], {
      env: { ...process.env, DSH_PURGE_TEST_SCRIPT: command[1][command[1].indexOf("-File") + 1] },
      timeout: 10000,
    });
  }
});

test("stale extracted app cleanup preserves the shared runtime and unrelated directories", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-cleanup-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const resources = path.join(root, "resources");
  const runtime = path.join(resources, "runtime");
  fs.mkdirSync(runtime, { recursive: true });
  fs.writeFileSync(path.join(runtime, "versions.json"), '{"runtime":"fixture"}');
  for (const name of ["app.dshpurge-prev-1", "app.dshpurge-failed-2", "app", "app.dshpurge-preview"]) {
    const app = path.join(resources, name);
    fs.mkdirSync(app);
    fs.symlinkSync(runtime, path.join(app, "runtime"), process.platform === "win32" ? "junction" : "dir");
  }
  clearStaleExtractedApps(path.join(root, "DeepSeek Harness.exe"));
  assert.equal(fs.readFileSync(path.join(runtime, "versions.json"), "utf8"), '{"runtime":"fixture"}');
  assert.deepEqual(fs.readdirSync(resources).sort(), ["app", "app.dshpurge-preview", "runtime"]);
});

test("Windows runtime junction targets the installation, independently of the host cwd", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-runtime-"));
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: "win32" });
  t.after(() => {
    Object.defineProperty(process, "platform", platform);
    fs.rmSync(root, { recursive: true, force: true });
  });
  const resources = path.join(root, "resources");
  const runtime = path.join(resources, "runtime");
  fs.mkdirSync(runtime, { recursive: true });
  fs.mkdirSync(path.join(resources, "app"));
  const result = repairOfficialCliAfterUnpack(path.join(root, "DeepSeek Harness.exe"));
  assert.equal(result.symlink.ok, true);
  const link = path.join(resources, "app", "runtime");
  assert.equal(fs.realpathSync(link), fs.realpathSync(runtime));
  const other = path.join(root, "other-runtime");
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, "keep"), "untouched");
  fs.unlinkSync(link);
  fs.symlinkSync(other, link, platform.value === "win32" ? "junction" : "dir");
  repairOfficialCliAfterUnpack(path.join(root, "DeepSeek Harness.exe"));
  assert.equal(fs.realpathSync(link), fs.realpathSync(runtime));
  assert.equal(fs.readFileSync(path.join(other, "keep"), "utf8"), "untouched");
});
