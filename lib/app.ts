import os from "os";
import path from "path";
import { performance } from "perf_hooks";

import * as fs from "./files";

const homedir = os.homedir();
const platform = os.platform();

(async () => {
  const start = performance.now();
  try {
    console.log("Starting sync");
    await run();
  } catch (e) {
    console.log("Fatal Error");
    console.log(e);
  } finally {
    const dur = (performance.now() - start).toFixed(0);
    console.log(`\nSynced in ${dur}ms`);
  }
})();

async function run() {
  const APPLICATIONS = "applications";
  const apps = await getApps(APPLICATIONS);
  const out = await processApps(apps);
  out.forEach((res) => {
    console.log(`\n${res.app}:`);
    res.results.forEach((v) => {
      if (v.status === "ok") {
        console.log("success");
        return;
      }
      console.log(`failure\n${v.message}`);
    });
  });
}

async function getApps(dir: string): Promise<string[]> {
  const files = await fs.readDir(dir);
  return await filterDirs(files);
}

async function filterDirs(files: string[]): Promise<string[]> {
  const dirs = [];
  for (const file of files) {
    const isDir = await fs.isDir(file);
    if (isDir) {
      dirs.push(file);
    }
  }
  return dirs;
}

async function processApps(dirs: string[]): Promise<AppResult[]> {
  dirs.sort();
  const ps = dirs.map(async (dir) => {
    return await processApp(dir);
  });
  return Promise.all(ps);
}

interface AppResult {
  app: string;
  results: RuleResult[];
}

interface RuleResult {
  rule: Rule;
  status: string;
  message?: string;
}

async function processApp(dir: string): Promise<AppResult> {
  const rules = await parseAppConfig(dir);
  const results = [];
  for (const rule of rules) {
    const res: RuleResult = { rule, status: "" };
    try {
      await processAppRule(dir, rule);
      res.status = "ok";
    } catch (e) {
      res.status = "error";
      if (hasMessageField(e)) {
        res.message = e.message;
      } else {
        res.message = "unknown error";
      }
    } finally {
      results.push(res);
    }
  }
  return { app: dir, results };
}

async function processAppRule(dir: string, rule: Rule): Promise<void> {
  const exists = await fs.exists(rule.destination);
  if (exists) {
    await fs.copyFile(rule.destination, `${rule.destination}.bak`);
    await fs.remove(rule.destination);
  }
  const filepath = path.join(dir, rule.filename);
  await fs.symlink(filepath, rule.destination);
}

interface Rule {
  destination: string;
  filename: string;
}

interface Platform {
  destination?: string;
}

interface ConfigRule {
  filename: string;
  destination?: string;
  darwin?: Platform;
  linux?: Platform;
}

interface Config {
  rules: ConfigRule[];
}

async function parseAppConfig(dir: string): Promise<Rule[]> {
  const raw = await fs.readFile(path.join(dir, "config.json"));
  const config = JSON.parse(raw) as Config;
  if (!config.rules) {
    throw new Error(`${dir}: no rules defined`);
  }
  return config.rules.map((v, i) => {
    let destination = v.destination;
    if (platform === "darwin" && v.darwin) {
      destination = v.darwin.destination ?? destination;
    } else if (platform === "linux" && v.linux) {
      destination = v.linux.destination ?? destination;
    }
    destination = destination?.replace("{home}", homedir);
    if (!destination || destination === "") {
      throw new Error(`${dir}: rule ${i} must provide a destination`);
    }
    return {
      filename: v.filename,
      destination,
    };
  });
}

function hasMessageField(err: unknown): err is { message: string } {
  return typeof err === "object" && err !== null && "message" in err;
}
