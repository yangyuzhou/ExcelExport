const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

function runFile(file, args, options = {}) {
    return new Promise(resolve => execFile(file, args, {
        windowsHide: true, encoding: 'buffer', timeout: 15000, ...options
    }, (error, stdout, stderr) => resolve({ error,
        stdout: iconv.decode(stdout || Buffer.alloc(0), 'gbk'),
        stderr: iconv.decode(stderr || Buffer.alloc(0), 'gbk')
    })));
}

async function findSvn() {
    const candidates = ['svn.exe'];
    for (const root of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
        if (root) candidates.push(path.join(root, 'TortoiseSVN', 'bin', 'svn.exe'));
    }
    for (const file of candidates) {
        if (path.isAbsolute(file) && !fs.existsSync(file)) continue;
        const result = await runFile(file, ['--version', '--quiet']);
        if (!result.error) return { success: true, path: file, version: result.stdout.trim() };
    }
    return { success: false, code: 'SVN_MISSING', error: '未检测到可用的 SVN 命令行工具（svn.exe）。请在 TortoiseSVN 安装程序中启用 command line client tools，安装后重新检测。' };
}

async function svnStatus(targetDir) {
    const environment = await findSvn();
    if (!environment.success) return environment;
    const result = await runFile(environment.path, ['status', targetDir]);
    if (result.error) return { success: false, code: 'SVN_STATUS_FAILED', error: result.stderr.trim() || result.error.message };
    return { success: true, stdout: result.stdout };
}

module.exports = { findSvn, svnStatus, runFile };
