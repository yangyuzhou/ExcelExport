const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { fileKey, nextMode, shouldExport, targets } = require('../src/export-state');

test('三态循环、增量保留排除、全量忽略排除及不同目录同名文件', () => {
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
    assert.deepEqual(targets(items, true), ['a/中文.xlsx', 'b/中文.xlsx', '默认.xlsx']);
    assert.equal(fileKey('A\\中文.xlsx'), 'a/中文.xlsx');
});

function handlers(environment, shell = { openPath: async () => '' }, childProcess) {
    const registered = {};
    const app = { requestSingleInstanceLock: () => false, quit() {}, getPath: () => path.join(__dirname, 'tmp') };
    fs.mkdirSync(app.getPath(), { recursive: true });
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8'), {
        require: id => id === 'electron' ? { app, ipcMain: { handle: (name, fn) => registered[name] = fn }, shell } :
            id === './environment' ? environment : id === 'child_process' && childProcess ? childProcess : require(id.startsWith('./') ? path.join(__dirname, '../src', id) : id),
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

test('提交扫描失败保留分类与目录，不返回之前的部分结果；不存在目录不能静默跳过', async () => {
    let calls = 0;
    const h = handlers({svnStatus:async () => ++calls === 1 ? {success:true,stdout:'M       test.xml\n'} : {success:false,code:'SVN_STATUS_TIMEOUT',error:'超时'}});
    const result = await h['get-all-svn-changes']({},[{id:'excel',path:__dirname},{id:'xml',path:__dirname}]);
    assert.equal(result.categoryId,'xml'); assert.equal(result.targetDir,__dirname);
    assert.equal(result.code,'SVN_STATUS_TIMEOUT'); assert.equal(result.data,undefined);
    const missing = await h['get-all-svn-changes']({},[{id:'xml',path:path.join(__dirname,'missing-scan-directory')}]);
    assert.equal(missing.code,'SVN_DIRECTORY_MISSING');
});

test('真实 CMD 调用：全量 -1 在 %7 / %~7 脚本均走全量，带空格的文件列表保持单个参数', { skip: process.platform !== 'win32' }, async () => {
    const fixture = path.join(__dirname, 'tmp', 'full-branch-fixture');
    fs.mkdirSync(fixture, { recursive: true });
    fs.writeFileSync(path.join(fixture, 'config.xml'), '<config/>');
    // 仅输出分支，不调用业务导表、SVN 或删除命令。
    for (const receiver of ['%7', '%~7']) {
        fs.writeFileSync(path.join(fixture, 'branch.bat'), [
            '@echo off', 'set selectTarget=' + receiver,
            'if not "%~7"=="-1" goto incremental',
            'if "%selectTarget%"=="-1" (echo BRANCH_FULL) else (echo BRANCH_INCREMENTAL)',
            'goto target', ':incremental', 'echo BRANCH_INCREMENTAL', ':target',
            'echo TARGET=[%~7]', 'echo ARG8=[%8]', 'exit /b 0', ''
        ].join('\r\n'));
        for (const selectTarget of ['-1', 'table one.xlsx#table two.xlsx']) {
            const logs = [];
            const h = handlers({ findSvn: async () => ({ success: true, path: 'svn.exe' }) });
            const result = await h['run-export-bat']({ sender: { send: (_, log) => logs.push(log.msg.trim()) } }, {
                commitSvn:'0', toPath:fixture, luaPath:fixture, xmlPath:fixture,
                toolRootPath:fixture, targetBatName:'branch.bat', configXmlPath:path.join(fixture, 'config.xml'),
                designRootPath:fixture, selectTarget
            });
            assert.equal(result.success, true);
            assert.ok(logs.includes(selectTarget === '-1' ? 'BRANCH_FULL' : 'BRANCH_INCREMENTAL'), receiver + ': ' + logs.join('\n'));
            assert.ok(logs.includes('TARGET=[' + selectTarget + ']'));
            assert.ok(logs.includes('ARG8=[]'));
        }
    }
});

const { createDiagnostics, createLogReader } = require('../src/export-diagnostics');
const excelRoot = path.join(__dirname, 'tmp', '数据填表');
const workbook = '魔战九州配置表.xlsx';
const entries = [
    { input: workbook, sheet: 'robberyDate', name: 'robberyDate', output: 'xml/config_robberyDate.xml' },
    { input: workbook, sheet: '奖励', name: 'reward' },
    { input: '下一张表.xlsx', sheet: 'next', name: 'next' }
];
const dataError = '******error keyStr=day,typeStr=int,the value=是 isError';
test('空值含无分隔符、空格和制表符都能定位，0/false/None 保留原值，缺失 value 不误判为空', () => {
    for (const value of ['', ' ', '\t', '0 ', 'false ', 'None ']) {
        const tracker = createDiagnostics({ entries, excelRoot });
        tracker.consume('start process excelFile=' + path.join(excelRoot, workbook)); tracker.consume('robberyDate');
        tracker.consume('******error keyStr=day,typeStr=int,the value=' + value + 'isError', true);
        const d = tracker.snapshot();
        assert.equal(d.kind, 'field-type'); assert.equal(d.actual, value.trim());
        assert.equal(d.field, 'day'); assert.equal(d.sheet, 'robberyDate'); assert.equal(d.workbook, workbook);
        assert.equal(d.expectedLabel, '整数');
        if (!value.trim()) { assert.match(d.summary, /当前值为空/); assert.match(d.suggestion, /未填写或仅含空白/); }
        else assert.ok(d.summary.includes('「' + value.trim() + '」'));
    }
    const tracker = createDiagnostics(); tracker.consume('******error keyStr=day,typeStr=int', true);
    assert.equal(tracker.snapshot().actual, undefined);
});
function feedExample(tracker) {
    tracker.consume('start process excelFile=' + path.join(excelRoot, workbook));
    tracker.consume('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$');
    tracker.consume('robberyDate');
    tracker.consume('D:/project/配置表生成/xml/config_robberyDate.xml');
    tracker.consume('---------------titleList len=15');
    tracker.consume(dataError, true);
}
test('截图中的整数错误关联 Excel、页签、字段和值，保留原文，不编造行号', () => {
    const tracker = createDiagnostics({ entries, excelRoot });
    feedExample(tracker);
    const d = tracker.snapshot();
    assert.equal(d.workbook, workbook);
    assert.equal(d.input, workbook);
    assert.equal(d.sheet, 'robberyDate');
    assert.equal(d.field, 'day'); assert.equal(d.expected, 'int'); assert.equal(d.actual, '是');
    assert.match(d.summary, /需要整数/); assert.equal(d.reportedRow, undefined);
    assert.equal(d.raw, dataError);
    tracker.consume('start process excelFile=' + path.join(excelRoot, '下一张表.xlsx'));
    tracker.consume('next'); tracker.consume('******error keyStr=id,typeStr=int,the value=X isError', true);
    assert.deepEqual(tracker.snapshot(), d, '后续输出不能覆盖最初错误的位置');
});
test('换工作簿、换页签和重名别名时不沿用旧位置；输出文件可消除歧义', () => {
    const tracker = createDiagnostics({ entries, excelRoot });
    tracker.consume('start process excelFile=' + path.join(excelRoot, workbook)); tracker.consume('robberyDate');
    tracker.consume('start process excelFile=' + path.join(excelRoot, '下一张表.xlsx'));
    tracker.consume(dataError, true);
    assert.equal(tracker.snapshot().sheet, undefined);
    assert.equal(tracker.snapshot().workbook, '下一张表.xlsx');
    const ambiguous = createDiagnostics({ excelRoot, entries: [
        { input: workbook, name: 'same', sheet: 'one', output: 'xml/one.xml' },
        { input: workbook, name: 'same', sheet: 'two', output: 'xml/two.xml' }
    ] });
    ambiguous.consume('start process excelFile=' + path.join(excelRoot, workbook));
    ambiguous.consume('one'); ambiguous.consume('same'); ambiguous.consume(dataError, true);
    assert.equal(ambiguous.snapshot().sheet, undefined);
    const noContext = createDiagnostics(); noContext.consume(dataError, true);
    assert.equal(noContext.snapshot().workbook, '');
    assert.equal(noContext.snapshot().sheet, undefined);
});
test('Python 异常提取最终原因；程序代码行号不作为 Excel 行号', () => {
    const tracker = createDiagnostics({ entries, excelRoot });
    tracker.consume('start process excelFile=' + path.join(excelRoot, workbook)); tracker.consume('robberyDate');
    tracker.consume('Traceback (most recent call last):', true);
    tracker.consume('  File "export.py", line 181, in process');
    tracker.consume("ValueError: invalid literal for int() with base 10: '是'", true);
    const d = tracker.snapshot();
    assert.equal(d.kind, 'script'); assert.match(d.summary, /ValueError.*是/);
    assert.equal(d.reportedRow, undefined); assert.ok(d.context.some(x => x.includes('181')));
});
test('分包传输不截断 UTF-8 / GBK 中文、字段或错误值，尾行关闭时输出', () => {
    const iconv = require('iconv-lite');
    for (const encoding of ['utf8', 'gbk']) {
        const lines = [];
        const reader = createLogReader(buf => iconv.decode(buf, encoding), line => lines.push(line));
        const bytes = iconv.encode(dataError + '\r\n尾行', encoding);
        for (let i = 0; i < bytes.length; i++) reader.push(bytes.subarray(i, i + 1));
        assert.deepEqual(lines, [dataError + '\r\n']);
        reader.flush(); assert.deepEqual(lines, [dataError + '\r\n', '尾行']);
    }
});
test('导表 IPC 将真实日志解析结果传到前端，终止错误进程且不输出重复正则噪声', async () => {
    const { EventEmitter } = require('events');
    const fake = new EventEmitter();
    fake.pid = 123456; fake.stdout = new EventEmitter(); fake.stderr = new EventEmitter();
    fake.stdin = Object.assign(new EventEmitter(), { write(_data, callback) { callback(); }, destroy() {}, end() {} });
    const fixture = path.join(__dirname, 'tmp', 'diagnostics-fixture');
    fs.mkdirSync(fixture, { recursive: true });
    fs.writeFileSync(path.join(fixture, 'noop.bat'), '@echo off');
    fs.writeFileSync(path.join(fixture, 'config.xml'), '<config excelPath="../数据填表"><data input="' + workbook + '" name="robberyDate" sheet="robberyDate"/></config>');
    const commands = [], logs = [];
    const h = handlers({ findSvn: async () => ({ success: true, path: 'svn.exe' }) }, undefined, {
        exec: cmd => commands.push(cmd),
        spawn: () => {
            setTimeout(() => {
                const content = 'start process excelFile=' + path.join(excelRoot, workbook) + '\n$$$$$$$$$$\nrobberyDate\n' + dataError + '\n';
                const bytes = Buffer.from(content);
                for (let i = 0; i < bytes.length; i += 3) fake.stdout.emit('data', bytes.subarray(i, i + 3));
                fake.emit('close', 0);
            }, 5);
            return fake;
        }
    });
    const res = await h['run-export-bat']({ sender: { send: (_, log) => logs.push(log) } }, {
        toolRootPath: fixture, targetBatName: 'noop.bat', configXmlPath: path.join(fixture, 'config.xml'), designRootPath: fixture
    });
    assert.equal(res.success, false); assert.equal(res.diagnosis.sheet, 'robberyDate');
    assert.equal(res.diagnosis.actual, '是'); assert.deepEqual(commands, ['taskkill /F /T /PID 123456']);
    assert.equal(logs.filter(log => log.type === 'fatal_error').length, 1);
    assert.ok(logs.every(log => !log.msg.includes('匹配规则')));
});

test('图 1 重复索引错误解析 id=4；错误行自带表名和页签优先于旧上下文', () => {
    for (const withContext of [true, false]) {
        const tracker = createDiagnostics({ entries, excelRoot });
        if (withContext) {
            tracker.consume('start process excelFile=' + path.join(excelRoot, '下一张表.xlsx'));
            tracker.consume('next');
        }
        const line = '****error 索引值不唯一 id=4, ,sheetName=robberyDate,excelName=' + path.join(excelRoot, workbook);
        tracker.consume(line, true);
        const d = tracker.snapshot();
        assert.equal(d.kind, 'duplicate-key'); assert.equal(d.field, 'id'); assert.equal(d.actual, '4');
        assert.equal(d.sheet, 'robberyDate'); assert.equal(d.workbook, workbook); assert.equal(d.input, workbook);
        assert.match(d.summary, /「id」.*「4」重复/); assert.equal(d.reportedRow, undefined);
        tracker.consume('连续按两次任意键，会忽略该条记录的错误');
        assert.deepEqual(tracker.snapshot(), d);
    }
});

test('真实 Writable 异步 EPIPE 的 callback 和 error 事件均被接住，仅报告一次并停止定时写入', async () => {
    const { EventEmitter } = require('events');
    const { Writable } = require('stream');
    const { startPauseInput } = require('../src/process-input');
    for (const exitBeforeError of [false, true]) {
        const child = new EventEmitter(); let writes = 0, cancels = 0, tick, finishWrite;
        child.stdin = new Writable({ write(_chunk, _encoding, callback) { writes++; finishWrite = callback; } });
        const errors = [];
        startPauseInput(child, { onError: error => errors.push(error.code), schedule: fn => { tick = fn; return 1; }, cancel: () => cancels++ });
        tick(); tick(); assert.equal(writes, 1, 'waiting on write callback must not queue input');
        if (exitBeforeError) child.emit('exit', 0);
        finishWrite(Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));
        await new Promise(resolve => setImmediate(resolve));
        tick(); child.emit('close', 0);
        assert.equal(writes, 1); assert.equal(cancels, 1); assert.deepEqual(errors, ['EPIPE']);
    }
});

test('退出、输入关闭、写入同步异常都会停止喂输入，关闭之后迟到的 error 不会导致崩溃', () => {
    const { EventEmitter } = require('events');
    const { startPauseInput } = require('../src/process-input');
    for (const reason of ['exit', 'close', 'error', 'sync-throw', 'finish']) {
        const child = new EventEmitter(); let writes = 0, tick; const errors = [];
        child.stdin = Object.assign(new EventEmitter(), { write(_data, callback) {
            writes++; if (reason === 'sync-throw') throw Object.assign(new Error('closed'), { code: 'ERR_STREAM_DESTROYED' });
            callback();
        }, destroy() {} });
        startPauseInput(child, { onError: error => errors.push(error.code), schedule: fn => { tick = fn; return 1; }, cancel() {} });
        if (reason === 'exit' || reason === 'error') child.emit(reason, reason === 'error' ? new Error('spawn failed') : 0);
        else if (reason !== 'sync-throw') child.stdin.emit(reason);
        tick(); assert.equal(writes, 1);
        child.emit('close', 0);
        assert.doesNotThrow(() => child.stdin.emit('error', Object.assign(new Error('late EPIPE'), { code: 'EPIPE' })));
        assert.equal(errors.length, 1);
    }
});

test('IPC 容错：正常退出的 EPIPE 不误报失败，异常退出给运行弹窗信息，原始表错误优先保留', async () => {
    const { EventEmitter } = require('events');
    const fixture = path.join(__dirname, 'tmp', 'pipe-fixture'); fs.mkdirSync(fixture, { recursive: true });
    fs.writeFileSync(path.join(fixture, 'noop.bat'), '@echo off');
    fs.writeFileSync(path.join(fixture, 'config.xml'), '<config excelPath="../数据填表"><data input="' + workbook + '" sheet="robberyDate"/></config>');
    for (const scenario of ['success', 'abnormal', 'duplicate']) {
        const child = new EventEmitter(); child.pid = 2468;
        child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
        child.stdin = Object.assign(new EventEmitter(), { write(_data, callback) { callback(); }, destroy() {} });
        const h = handlers({ findSvn: async () => ({ success: true, path: 'svn.exe' }) }, undefined, {
            exec() {}, spawn() {
                setTimeout(() => {
                    if (scenario === 'duplicate') child.stdout.emit('data', Buffer.from('****error 索引值不唯一 id=4, ,sheetName=robberyDate,excelName=' + path.join(excelRoot, workbook) + '\n'));
                    child.stdin.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));
                    child.emit('exit', scenario === 'success' ? 0 : 1);
                    child.emit('close', scenario === 'success' ? 0 : 1);
                }, 5);
                return child;
            }
        });
        const res = await h['run-export-bat']({ sender: { send() {} } }, {
            toolRootPath: fixture, targetBatName: 'noop.bat', configXmlPath: path.join(fixture, 'config.xml'), designRootPath: fixture
        });
        if (scenario === 'success') { assert.equal(res.success, true); assert.equal(res.runtimeError, undefined); }
        if (scenario === 'abnormal') { assert.equal(res.success, false); assert.equal(res.runtimeError, true); assert.match(res.technical, /EPIPE/); }
        if (scenario === 'duplicate') { assert.equal(res.success, false); assert.equal(res.diagnosis.actual, '4'); assert.equal(res.runtimeError, undefined); }
    }
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
            return require(id.startsWith('./') ? path.join(__dirname,'../src',id) : id);
        } });
        const res = await module.exports.findSvn();
        assert.equal(res.success, installed);
        if (!installed) assert.equal(res.code, 'SVN_MISSING');
    }
});
