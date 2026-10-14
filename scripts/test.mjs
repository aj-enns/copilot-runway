import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fromRoot } from "./lib.mjs";

const tests = (await readdir(fromRoot("tests"))).filter((name) => name.endsWith(".test.mjs")).sort();
if (!tests.length) throw new Error("No unit tests found");
const result = spawnSync(process.execPath, ["--test", "--test-reporter=spec", ...tests.map((name) => fromRoot("tests", name))], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
