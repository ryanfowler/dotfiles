const fs = require("fs");
const path = require("path");

async function copyFile(src, dest) {
    src = await realPath(src);
    return new Promise((resolve, reject) => {
        fs.copyFile(src, dest, (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

function exists(filepath) {
    return new Promise((resolve) => {
        fs.lstat(filepath, (err) => {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

function isDir(filepath) {
    return new Promise((resolve, reject) => {
        fs.stat(filepath, (err, stats) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(stats.isDirectory());
        });
    });
}

function readDir(filepath) {
    return new Promise((resolve, reject) => {
        fs.readdir(filepath, (err, files) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(
                files.map((file) => {
                    return path.join(filepath, file);
                }),
            );
        });
    });
}

function readFile(filepath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filepath, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(data);
        });
    });
}

function remove(filepath) {
    return new Promise((resolve, reject) => {
        fs.unlink(filepath, (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

async function symlink(src, dest) {
    src = await realPath(src);
    return new Promise((resolve, reject) => {
        fs.symlink(src, dest, (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

function realPath(filepath) {
    return new Promise((resolve, reject) => {
        fs.realpath(filepath, (err, realPath) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(realPath);
        });
    });
}

module.exports = {
    copyFile,
    exists,
    isDir,
    readDir,
    readFile,
    remove,
    symlink,
};
