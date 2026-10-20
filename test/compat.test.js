import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ALL_PATCHES, applyReplacementsToText, applyPatches, patchStatus, summarizeApplyReport } from "../lib/core.js";
import { hostPromptKeepsInject } from "../lib/host-clean.js";
import { rewritePromptAssembly } from "../lib/identity.js";

const completePatch = ALL_PATCHES.find((patch) => patch.id === 40);
const assemblySource = (required = true) => `
const transformed = await this.ctx.waterfall(scopeTarget(this, scope), "system-prompt/assemble", assembly, context, () => Promise.resolve(assembly));
if (completeSection === void 0 && !runtimeContextSuppressed) return transformed;
${required ? "const requiredContexts = new Set([...contextByName.values()].filter((entry) => entry.required === true).map((entry) => entry.name));\n" : ""}return {
  ...transformed,
  sections: completeSection === void 0 ? transformed.sections : [completeSection],
  contexts: runtimeContextSuppressed ? ${required ? "transformed.contexts.filter((entry) => requiredContexts.has(entry.name))" : "[]"} : transformed.contexts
};`;

for (const required of [false, true]) {
  for (const newline of ["\n", "\r\n"]) {
    test(`complete prompt preserves host context semantics (${required ? "0.2.1" : "legacy"}, ${JSON.stringify(newline)})`, async () => {
      const input = assemblySource(required).replaceAll("\n", newline);
      const patched = applyReplacementsToText(input, completePatch);
      assert.equal(patched.changed, true);
      assert.equal(applyReplacementsToText(patched.text, completePatch).changed, false);
      assert.equal(hostPromptKeepsInject(patched.text), true);
      const run = new (Object.getPrototypeOf(async function () {}).constructor)(
        "scopeTarget", "scope", "assembly", "context", "completeSection",
        "runtimeContextSuppressed", "contextByName", patched.text,
      );
      const complete = { name: "persona", text: "original" };
      const assembledComplete = { ...complete, text: "transformed" };
      const inject = { name: "dsh-purge", text: "operator text" };
      const contexts = [{ name: "cwd" }, { name: "optional" }];
      const transformed = { sections: [assembledComplete, inject], contexts };
      for (const hasComplete of [false, true]) {
        for (const suppressed of [false, true]) {
          const result = await run.call(
            { ctx: { waterfall: async () => transformed } },
            () => null, null, {}, {}, hasComplete ? complete : undefined, suppressed,
            new Map([["cwd", { name: "cwd", required: true }]]),
          );
          assert.deepEqual(result.contexts, suppressed ? (required ? [contexts[0]] : []) : contexts);
          assert.deepEqual(result.sections, [inject, assembledComplete]);
        }
      }
    });
  }
}

test("unrecognized complete-prompt shape is a compatibility error", async (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "dsh-compat-"));
  const previousHome = process.env.DSH_HOME;
  process.env.DSH_HOME = path.join(root, "home");
  t.after(() => {
    if (previousHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousHome;
    rmSync(root, { recursive: true, force: true });
  });
  const base = path.join(root, "node_modules", "@deepseek-ai");
  const file = path.join(base, "dsh-system-prompt", "lib", "index.js");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, assemblySource().replace("contextByName.values()", "newContexts.values()"));
  assert.equal((await patchStatus(base, [completePatch]))[40], "unmatched");
  const report = await applyPatches(base, [completePatch]);
  assert.equal(report[0].status, "pattern_not_found");
  assert.equal(summarizeApplyReport(report).failed.length, 1);
  writeFileSync(file, applyReplacementsToText(assemblySource(), completePatch).text);
  const nested = path.join(base, "dsh", "node_modules", "@deepseek-ai", "dsh-system-prompt", "lib", "index.js");
  mkdirSync(path.dirname(nested), { recursive: true });
  writeFileSync(nested, "unknown system-prompt/assemble implementation");
  assert.equal((await patchStatus(base, [completePatch]))[40], "unmatched");
  const mixed = await applyPatches(base, [completePatch]);
  assert.equal(mixed[0].status, "pattern_not_found");
  assert.equal(mixed[0].path, nested);
});

for (const variables of [undefined, {}, { provider: "test", model: "test" }, { cwd: undefined }, { cwd: "/workspace" }]) {
  test(`generated cwd suffix uses registered variables: ${JSON.stringify(variables)}`, () => {
    for (const suffix of [undefined, "", "Your working directory is {{cwd}}.", "Working directory: {{cwd}}."]) {
      const input = {
        variables,
        sections: suffix === undefined ? [] : [{ name: "deployment:persona-suffix", text: suffix }],
      };
      const original = structuredClone(input);
      const output = rewritePromptAssembly(input, "", { capabilityProtocol: false });
      const generated = output.sections.find((section) => section.name === "deployment:persona-suffix");
      assert.equal(generated.text, variables?.cwd === undefined ? "" : "Your working directory is {{cwd}}.");
      assert.deepEqual(input, original);
    }
  });
}

test("custom suffixes and non-interpolated user content are preserved", () => {
  const input = {
    variables: { model: "test" },
    sections: [{ name: "deployment:persona-suffix", text: "Example: {{cwd}}", interpolate: false }],
  };
  assert.equal(rewritePromptAssembly(input, "", { capabilityProtocol: false }).sections[0].text, input.sections[0].text);
});

test("stripping old host persona does not introduce an unregistered variable", () => {
  const input = {
    variables: { model: "test", provider: "test" },
    sections: [{
      name: "deployment:persona-prefix",
      text: "You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}. Keep this instruction.",
    }],
  };
  const output = rewritePromptAssembly(input, "", { capabilityProtocol: false });
  assert.equal(output.sections[0].text, "Keep this instruction.");
});
