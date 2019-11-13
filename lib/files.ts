import fs from "fs";
import path from "path";

export const copyFile = async (src: string, dest: string): Promise<void> => {
    const realSrc = await realPath(src);
    return new Promise((resolve, reject) => {
        fs.copyFile(realSrc, dest, (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
};

export const exists = async (filepath: string): Promise<boolean> => {
    return new Promise((resolve) => {
        fs.lstat(filepath, (err) => {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
};

export const isDir = (filepath: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        fs.stat(filepath, (err, stats) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(stats.isDirectory());
        });
    });
};

export const readDir = (filepath: string): Promise<string[]> => {
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
};

export const readFile = (filepath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        fs.readFile(filepath, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(data.toString());
        });
    });
};

export const remove = (filepath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        fs.unlink(filepath, (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
};

export const symlink = async (src: string, dest: string): Promise<void> => {
    const realSrc = await realPath(src);
    return new Promise((resolve, reject) => {
        fs.symlink(realSrc, dest, (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
};

export const realPath = (filepath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        fs.realpath(filepath, (err, realPath) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(realPath);
        });
    });
};
