const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
let privateSvnResolver = null;
function setPrivateSvnResolver(resolver) { privateSvnResolver = resolver; }

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
        if (!result.error) return { success: true, source:'system', path: file, version: result.stdout.trim() };
    }
    // Read the installed directory too: a newly installed or custom-path SVN may not be on this process's PATH.
    for (const key of ['HKLM\\SOFTWARE\\TortoiseSVN', 'HKLM\\SOFTWARE\\WOW6432Node\\TortoiseSVN']) {
        const registry = await runFile('reg.exe', ['query', key, '/v', 'Directory']);
        const directory = registry.stdout.match(/\bDirectory\s+REG_(?:EXPAND_)?SZ\s+([^\r\n]+)/i)?.[1]?.trim();
        if (!directory || registry.error) continue;
        const file = path.join(directory.replace(/%([^%]+)%/g, (match, name) => process.env[name] || match), 'bin', 'svn.exe');
        if (!fs.existsSync(file)) continue;
        const result = await runFile(file, ['--version', '--quiet']);
        if (!result.error) return { success:true, source:'system', path:file, version:result.stdout.trim() };
    }
    const privateSvn = privateSvnResolver ? await privateSvnResolver() : null;
    if (privateSvn?.success) return privateSvn;
    return { success: false, code: 'SVN_MISSING', error: '未检测到可用的 SVN 命令行组件。工具会自动准备内置组件，无需联网，不修改已有 SVN。' };
}

async function svnStatus(targetDir) {
    const environment = await findSvn();
    if (!environment.success) return environment;
    const result = await runFile(environment.path, [...(environment.configDir ? ['--config-dir', environment.configDir] : []), 'status', targetDir]);
    if (result.error) return { success: false, code: 'SVN_STATUS_FAILED', error: result.stderr.trim() || result.error.message };
    return { success: true, stdout: result.stdout };
}

module.exports = { findSvn, svnStatus, runFile, setPrivateSvnResolver };
