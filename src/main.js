import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

function main() {
  try {
    run();
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exit(1);
  }
}

function run() {
  const rawConfig = fs.readFileSync("./config.yaml", "utf8");
  const config = YAML.parse(rawConfig);

  processHomebrew(config.homebrew);
  processNpm(config.npm);
  processCommands(config.commands);
  processRules(config.rules);

  info("All done!");
}

function processHomebrew(config) {
  info("Installing homebrew taps");
  for (const tap of config.taps ?? []) {
    execute("brew", ["tap", tap]);
  }

  info("Installing homebrew formulae");
  execute("brew", ["install", "--quiet", ...config.formulae]);

  if (osName() === "macos") {
    info("Installing homebrew casks");
    execute("brew", ["install", "--quiet", "--cask", ...config.casks]);
  }
}

function processNpm(config) {
  info("Installing npm packages");
  execute("npm", [
    "install",
    "--quiet",
    "--global",
    "--ignore-scripts",
    "--no-fund",
    "--no-update-notifier",
    ...config.packages,
  ]);
}

function processCommands(commands) {
  info("Running commands");
  for (const command of commands) {
    console.log(`  running command: "${command}"`);
    execute("bash", ["-c", command]);
  }
}

function processRules(rules) {
  info("Linking configuration files");
  for (const rule of rules) {
    processRule(rule);
  }
}

function processRule(rule) {
  console.log(`\n  processing: ${JSON.stringify(rule.src)}`);

  const dstConfig = rule.dst;
  let dstRaw;
  if (typeof dstConfig === "string") {
    dstRaw = dstConfig;
  } else {
    dstRaw = dstConfig[osName()];
    if (!dstRaw) {
      console.log(`  skipping: no matching dst for os ${osName()}`);
      return;
    }
  }

  const src = fs.realpathSync(path.resolve(envsubst(rule.src)));
  const dst = envsubst(dstRaw);

  const dstDir = path.dirname(dst);
  if (!dstDir || dstDir === ".") {
    throw new Error("dst does not have a parent directory");
  }
  fs.mkdirSync(dstDir, { recursive: true });

  try {
    const meta = fs.lstatSync(dst);
    if (meta.isFile()) {
      const dstBak = backupPath(dst);
      console.log(`  creating backup: ${JSON.stringify(dstBak)}`);
      fs.copyFileSync(dst, dstBak);
    } else if (meta.isSymbolicLink() && fs.readlinkSync(dst) === src) {
      console.log(`  link already exists: ${JSON.stringify(dst)}`);
      return;
    }

    fs.unlinkSync(dst);
    console.log("  removed existing file");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  console.log(`  creating link: ${JSON.stringify(dst)}`);
  fs.symlinkSync(src, dst);
}

function execute(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${cmd} exited with status ${result.status}`);
  }
}

function envsubst(value) {
  return value.replace(/\$([A-Z_][A-Z0-9_]*)|\$\{([^}]+)\}/g, (_, bareName, bracedExpr) => {
    if (bareName) {
      return process.env[bareName] ?? "";
    }

    const defaultMatch = bracedExpr.match(/^([A-Z_][A-Z0-9_]*)(:?-)(.*)$/);
    if (defaultMatch) {
      const [, name, operator, defaultValue] = defaultMatch;
      const envValue = process.env[name];
      return operator === ":-"
        ? envValue || defaultValue
        : envValue ?? defaultValue;
    }

    return process.env[bracedExpr] ?? "";
  });
}

function backupPath(filePath) {
  return `${filePath}.bak`;
}

function osName() {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "linux") return "linux";
  return process.platform;
}

function info(msg) {
  console.log(`\n\x1b[1m===> ${msg}\x1b[0m`);
}

main();
