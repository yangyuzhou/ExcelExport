const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
let privateSvnResolver = null;
function setPrivateSvnResolver(resolver) { privateSvnResolver = resolver; }

function runFile(file, args, options = {}) {
    const started = Date.now();
    const timeoutMs = options.timeout ?? 15000;
    return new Promise(resolve => execFile(file, args, {
        windowsHide: true, encoding: 'buffer', timeout: timeoutMs, ...options
    }, (error, stdout, stderr) => resolve({ error, timeoutMs, durationMs: Date.now() - started,
        timedOut: Boolean(error?.killed && error.code !== 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' && timeoutMs > 0),
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
    // Status can traverse many generated files. Do not apply the short version-probe limit.
    const result = await runFile(environment.path, [...(environment.configDir ? ['--config-dir', environment.configDir] : []), 'status', targetDir], {
        timeout: 180000, maxBuffer: 32 * 1024 * 1024
    });
    if (result.error || /(?:E|W)155007\b/.test(result.stderr)) return describeSvnFailure(result, targetDir);
    return { success: true, stdout: result.stdout };
}

function describeSvnFailure(result, targetDir) {
    const stderr = result.stderr.trim();
    let code = 'SVN_STATUS_FAILED';
    let error = stderr || 'SVN 扫描进程异常退出，未返回具体原因。';
    let suggestion = '请用电脑原有的 TortoiseSVN 检查此目录；可展开技术详情交给项目维护人员排查。';
    if (result.error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        code = 'SVN_STATUS_OUTPUT_LIMIT';
        error = '目录变更过多，扫描结果超过 32 MB，未能完整读取。';
        suggestion = '请检查配置目录是否过大，或使用原有 TortoiseSVN 分目录查看变更。';
    } else if (result.timedOut) {
        code = 'SVN_STATUS_TIMEOUT';
        error = `扫描超过 ${Math.round(result.timeoutMs / 1000)} 秒，已停止等待。`;
        suggestion = '目录文件较多或磁盘繁忙时会扫描较慢。请等待其他 SVN 操作结束后重试；若反复超时，请用原有 TortoiseSVN 检查此目录。';
    } else if (/(?:E|W)155007\b/.test(stderr)) {
        error = '此目录不是 SVN 工作副本，无法读取变更。';
        suggestion = '请在版本设置中确认目录指向已检出的项目。';
    } else if (/E155021\b|E155036\b/.test(stderr)) {
        error = '此工作副本格式与当前 SVN 命令行版本不兼容。';
        suggestion = '请联系项目维护人员确认匹配的 SVN 版本；工具不会自动升级工作副本或覆盖现有 SVN。';
    }
    return { success: false, code, error, suggestion, targetDir,
        details: [stderr, result.error?.message, `退出码：${result.error?.code ?? '无'}；信号：${result.error?.signal ?? '无'}；耗时：${Math.round((result.durationMs || 0) / 1000)} 秒`].filter(Boolean).join('\n') };
}

module.exports = { findSvn, svnStatus, runFile, setPrivateSvnResolver, describeSvnFailure };
