const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { fileKey, nextMode, shouldExport, targets } = require('../src/export-state');

test('三态循环、SVN 刷新不覆盖排除、全量排除及不同目录同名文件', () => {
    assert.equal(nextMode(), 'include');
    assert.equal(nextMode('include'), 'exclude');
    assert.equal(nextMode('exclude'), 'auto');
    assert.equal(shouldExport({ exportMode: 'exclude', svnModified: true }), false);
    assert.equal(shouldExport({ exportMode: 'include', svnModified: false }), true);
    const items = [
        { input: 'a/中文.xlsx', exportMode: 'exclude', svnModified: true },
        { input: 'a/中文.xlsx', exportMode: 'exclude', svnModified: true },
        { input: 'b/中文.xlsx', exportMode: 'include' },
        { input: '默认.xlsx', exportMode: 'auto' }
    ];
    assert.deepEqual(targets(items), ['b/中文.xlsx']);
    assert.deepEqual(targets(items, true), ['b/中文.xlsx', '默认.xlsx']);
    assert.equal(fileKey('A\\中文.xlsx'), 'a/中文.xlsx');
});

function handlers(environment, shell = { openPath: async () => '' }) {
    const registered = {};
    const app = { requestSingleInstanceLock: () => false, quit() {}, getPath: () => path.join(__dirname, 'tmp') };
    fs.mkdirSync(app.getPath(), { recursive: true });
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8'), {
        require: id => id === 'electron' ? { app, ipcMain: { handle: (name, fn) => registered[name] = fn }, shell } :
            id === './environment' ? environment : require(id),
        __dirname: path.join(__dirname, '../src'), process, Buffer, setTimeout, clearTimeout, setInterval, clearInterval
    });
    return registered;
}

test('SVN 缺失或扫描失败不能报告成功，导表前拦截环境错误', async () => {
    const missing = { success: false, code: 'SVN_MISSING', error: 'missing' };
    const h = handlers({ findSvn: async () => missing, svnStatus: async () => missing });
    assert.equal((await h['check-svn-status']({}, __dirname)).code, 'SVN_MISSING');
    assert.equal((await h['get-all-svn-changes']({}, [{ path: __dirname }])).success, false);
    assert.equal((await h['run-export-bat']({}, {})).code, 'SVN_MISSING');
});

test('SVN 状态保留相对路径，不误匹配不同目录同名文件', async () => {
    const p = path.join(__dirname, '子目录', '中文.xlsx');
    const h = handlers({ svnStatus: async () => ({ success: true, stdout: 'M       ' + p + '\r\n' }) });
    const res = await h['check-svn-status']({}, __dirname);
    assert.equal(res.data[0], '子目录/中文.xlsx');
});

test('Sheet 打开传递中文及特殊字符参数、解包脚本、验证结果并清理临时文件', async () => {
    let extracted;
    const h = handlers({ runFile: async (exe, args) => {
        assert.equal(exe, 'cscript.exe');
        extracted = args[1];
        assert.ok(fs.existsSync(extracted));
        assert.ok(!extracted.includes('.asar'));
        assert.equal(args[3], '中文 & "Sheet"');
        return { stdout: 'SHEET_ACTIVATED', error: null };
    } });
    const res = await h['open-excel']({}, __filename, '中文 & "Sheet"');
    assert.equal(res.sheetActivated, true);
    assert.equal(fs.existsSync(extracted), false);
});

test('Sheet 不存在或隐藏时显示真实失败，自动化不可用时明确说明降级', async () => {
    for (const code of ['SHEET_NOT_FOUND', 'SHEET_HIDDEN', 'SHEET_ACTIVATE_FAILED']) {
        const h = handlers({ runFile: async () => ({ stdout: code, error: new Error(code) }) });
        assert.equal((await h['open-excel']({}, __filename, 'Sheet1')).success, false);
    }
    const h = handlers({ runFile: async () => ({ stdout: '', error: new Error('missing cscript') }) });
    const result = await h['open-excel']({}, __filename, 'Sheet1');
    assert.equal(result.sheetActivated, false);
    assert.match(result.warning, /无法自动定位/);
});

test('SVN 可执行文件发现：PATH 失败后检查标准安装目录；所有失败给安装提示', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/environment.js'), 'utf8');
    for (const installed of [false, true]) {
        const module = { exports: {} };
        vm.runInNewContext(source, { module, Buffer, process: { env: { ProgramFiles: 'C:\\Program Files' } }, require: id => {
            if (id === 'child_process') return { execFile: (file, args, options, callback) => callback(
                installed && file.includes('TortoiseSVN') ? null : new Error('ENOENT'), Buffer.from('1.14'), Buffer.alloc(0)) };
            if (id === 'fs') return { existsSync: () => installed };
            return require(id);
        } });
        const res = await module.exports.findSvn();
        assert.equal(res.success, installed);
        if (!installed) assert.equal(res.code, 'SVN_MISSING');
    }
});
