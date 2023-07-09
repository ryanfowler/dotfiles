use std::{
    collections::BTreeMap,
    env,
    ffi::{OsStr, OsString},
    fs,
    io::Write,
    os::unix::{self, prelude::OsStringExt},
    path::{Path, PathBuf},
    process::{self, exit},
};

use anyhow::{Error, Result};
use serde::Deserialize;
use termcolor::{ColorChoice, ColorSpec, StandardStream, WriteColor};

#[derive(Deserialize)]
struct Config {
    homebrew: Homebrew,
    npm: Npm,
    rules: Vec<Rule>,
}

#[derive(Deserialize)]
struct Homebrew {
    formulae: Vec<String>,
    casks: Vec<String>,
}

#[derive(Deserialize)]
struct Npm {
    packages: Vec<String>,
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

    process_homebrew(&config.homebrew)?;
    process_npm(&config.npm)?;
    process_rules(&config.rules)?;

    info("All done!");
    Ok(())
}

fn process_homebrew(config: &Homebrew) -> Result<()> {
    info("Installing homebrew formulae");
    let mut formulae = config.formulae.clone();
    let mut args = Vec::with_capacity(2 + config.formulae.len());
    args.push("install".to_owned());
    args.push("--quiet".to_owned());
    args.append(&mut formulae);
    execute("brew", &args)?;

    if env::consts::OS == "macos" {
        info("Installing homebrew casks");
        let mut casks = config.casks.clone();
        let mut args = Vec::with_capacity(3 + config.casks.len());
        args.push("install".to_owned());
        args.push("--quiet".to_owned());
        args.push("--cask".to_owned());
        args.append(&mut casks);
        execute("brew", &args)?;
    }

    Ok(())
}

fn process_npm(config: &Npm) -> Result<()> {
    info("Installing npm packages");
    let mut packages = config.packages.clone();
    let mut args = Vec::with_capacity(3 + packages.len());
    args.push("install".to_owned());
    args.push("--quiet".to_owned());
    args.push("-g".to_owned());
    args.append(&mut packages);
    execute("npm", &args)
}

fn process_rules(rules: &[Rule]) -> Result<()> {
    info("Linking configuration files");
    for rule in rules {
        process_rule(rule)?;
    }
    Ok(())
}

fn process_rule(rule: &Rule) -> Result<()> {
    println!("\n  processing: {:?}", &rule.src);

    let dst = match &rule.dst {
        Destination::PathBuf(path) => path,
        Destination::OsPathBufs(paths) => match paths.get(env::consts::OS) {
            Some(path) => path,
            None => {
                println!("  skipping: no matching dst for os {}", env::consts::OS);
                return Ok(());
            }
        },
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
            println!("  creating backup: {:?}", &dst_bak);
            fs::copy(&dst, &dst_bak)?;
        } else if meta.is_symlink() && fs::read_link(&dst)? == src {
            println!("  link already exists: {:?}", &dst);
            return Ok(());
        }
        fs::remove_file(&dst)?;
        println!("removed existing file");
    }

    // Create a new symlink.
    println!("  creating link: {:?}", &dst);
    unix::fs::symlink(src, &dst)?;
    Ok(())
}

fn execute<S: AsRef<OsStr>>(cmd: &str, args: &[S]) -> Result<()> {
    let status = process::Command::new(cmd)
        .args(args)
        .stdin(process::Stdio::inherit())
        .stdout(process::Stdio::inherit())
        .stderr(process::Stdio::inherit())
        .status()?;
    if status.success() {
        Ok(())
    } else {
        Err(Error::msg(format!("received status: {}", status)))
    }
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
    let mut stdout = StandardStream::stdout(ColorChoice::Auto);
    _ = stdout.set_color(ColorSpec::new().set_bold(true));
    _ = writeln!(&mut stdout, "\n===> {msg}");
    _ = stdout.reset();
}
