use std::{
    collections::BTreeMap,
    env,
    ffi::OsString,
    fs,
    io::Write,
    os::unix::{self, prelude::OsStringExt},
    path::{Path, PathBuf},
    process::{self, exit},
};

use anyhow::{Error, Result};
use serde::Deserialize;

#[derive(Deserialize)]
struct Config {
    rules: Vec<Rule>,
}

#[derive(Deserialize)]
struct Rule {
    src: PathBuf,
    dst: Destination,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Destination {
    PathBuf(PathBuf),
    OsPathBufs(BTreeMap<String, PathBuf>),
}

fn main() {
    if let Err(err) = run() {
        println!("error: {err}");
        exit(1);
    }
}

fn run() -> Result<()> {
    let raw_config = fs::read_to_string("./config.yaml")?;
    let config: Config = serde_yaml::from_str(&raw_config)?;

    for rule in config.rules {
        process_rule(&rule)?;
    }

    Ok(())
}

fn process_rule(rule: &Rule) -> Result<()> {
    info(&format!("processing: {:?}", &rule.src));

    let dst = match &rule.dst {
        Destination::PathBuf(path) => path,
        Destination::OsPathBufs(paths) => paths
            .get(env::consts::OS)
            .ok_or_else(|| Error::msg(format!("no matching os found: {:?}", &rule.src)))?,
    };

    // Use envsubst on paths.
    let src = fs::canonicalize(envsubst(&rule.src)?)?;
    let dst = envsubst(dst)?;

    // Create the containing directory for the "dst", if necessary.
    let dst_dir = dst
        .parent()
        .ok_or_else(|| Error::msg("dst does not have a parent directory"))?;
    fs::create_dir_all(dst_dir)?;

    // Make a backup of any existing file that will be overwritten.
    if let Ok(meta) = fs::symlink_metadata(&dst) {
        if meta.is_file() {
            let mut dst_bak = PathBuf::from(&dst);
            if let Some(ext) = dst_bak.extension() {
                let mut ext = ext.to_os_string();
                ext.push(".bak");
                dst_bak.set_extension(ext);
            } else {
                dst_bak.set_extension("bak");
            }
            info(&format!("creating backup: {:?}", &dst_bak));
            fs::copy(&dst, &dst_bak)?;
        }
        fs::remove_file(&dst)?;
        info("removed existing file");
    }

    // Create a new symlink.
    info(&format!("creating link: {:?}", &dst));
    unix::fs::symlink(src, &dst)?;
    println!();
    Ok(())
}

fn envsubst(orig: &Path) -> Result<PathBuf> {
    let mut child = process::Command::new("envsubst")
        .stdin(process::Stdio::piped())
        .stdout(process::Stdio::piped())
        .spawn()?;
    {
        let mut stdin = child.stdin.take().unwrap();
        stdin.write_all(orig.to_str().unwrap().as_bytes())?;
    }
    let output = child.wait_with_output()?;
    Ok(PathBuf::from(OsString::from_vec(output.stdout)))
}

fn info(msg: &str) {
    println!("info: {msg}");
}
