const os = require("os");
const path = require("path");
const { performance } = require("perf_hooks");

const fs = require("./files");

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

async function getApps(dir) {
    const files = await fs.readDir(dir);
    return await filterDirs(files);
}

async function filterDirs(files) {
    const dirs = [];
    for (const file of files) {
        const isDir = await fs.isDir(file);
        if (isDir) {
            dirs.push(file);
        }
    }
    return dirs;
}

async function processApps(dirs) {
    dirs.sort();
    const ps = dirs.map(async (dir) => {
        return await processApp(dir);
    });
    return Promise.all(ps);
}

async function processApp(dir) {
    const config = await parseAppConfig(dir);
    const bakExt = ".bak";
    const results = [];
    for (const rule of config.rules) {
        const res = { rule };
        try {
            await processAppRule(config.dir, rule);
            res.status = "ok";
        } catch (e) {
            res.status = "error";
            res.message = e.message;
        } finally {
            results.push(res);
        }
    }
    return { app: dir, results };
}

async function processAppRule(dir, rule) {
    const exists = await fs.exists(rule.destination);
    if (exists) {
        await fs.copyFile(rule.destination, `${rule.destination}.bak`);
        await fs.remove(rule.destination);
    }
    const filepath = path.join(dir, rule.filename);
    await fs.symlink(filepath, rule.destination);
}

async function parseAppConfig(dir) {
    const raw = await fs.readFile(path.join(dir, "config.json"));
    const config = JSON.parse(raw);
    if (!config.rules) {
        throw new Error(`${dir}: no rules defined`);
    }
    if (!Array.isArray(config.rules)) {
        throw new Error(`${dir}: rules must be an array`);
    }
    const rules = config.rules.map((v, i) => {
        if (typeof v !== "object") {
            throw new Error(`${dir}: rule ${i} must be an object`);
        }
        if (!v.filename || typeof v.filename !== "string") {
            throw new Error(`${dir}: rule ${i} must provide a valid filename`);
        }
        let destination = v.destination || "";
        const plat = v[platform];
        if (plat && plat.destination && typeof plat.destination === "string") {
            destination = plat.destination;
        }
        destination = destination.replace("{home}", homedir);
        return {
            filename: v.filename,
            destination,
        };
    });
    return { dir, rules };
}
