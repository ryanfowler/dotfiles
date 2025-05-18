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
    commands: Vec<String>,
    rules: Vec<Rule>,
}

#[derive(Deserialize)]
struct Homebrew {
    formulae: Vec<String>,
    casks: Vec<String>,
    taps: Option<Vec<String>>,
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
    process_commands(&config.commands)?;
    process_rules(&config.rules)?;

    info("All done!");
    Ok(())
}

fn process_homebrew(config: &Homebrew) -> Result<()> {
    info("Installing homebrew taps");
    if let Some(taps) = &config.taps {
        for tap in taps {
            execute("brew", &["tap", tap])?;
        }
    }

    info("Installing homebrew formulae");
    let args = ["install".to_owned(), "--quiet".to_owned()];
    let args: Vec<_> = args.iter().chain(&config.formulae).collect();
    execute("brew", &args)?;

    if env::consts::OS == "macos" {
        info("Installing homebrew casks");
        let args = [
            "install".to_owned(),
            "--quiet".to_owned(),
            "--cask".to_owned(),
        ];
        let args: Vec<_> = args.iter().chain(&config.casks).collect();
        execute("brew", &args)?;
    }

    Ok(())
}

fn process_npm(config: &Npm) -> Result<()> {
    info("Installing npm packages");
    let args = [
        "install".to_owned(),
        "--quiet".to_owned(),
        "--global".to_owned(),
        "--no-fund".to_owned(),
        "--no-update-notifier".to_owned(),
    ];
    let args: Vec<_> = args.iter().chain(&config.packages).collect();
    execute("npm", &args)
}

fn process_commands(commands: &[String]) -> Result<()> {
    info("Running commands");
    for command in commands {
        println!("  running command: \"{}\"", command);
        execute("bash", &["-c", command])?;
    }
    Ok(())
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
        println!("  removed existing file");
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
        Err(Error::msg(status.to_string()))
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
