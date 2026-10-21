const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
app.disableHardwareAcceleration();
app.setPath('userData', path.join(__dirname, 'tmp', 'ui-profile'));
const sourceArg = process.argv.find(arg => arg.startsWith('--ui-source='));
const sourceDir = sourceArg ? path.resolve(sourceArg.slice('--ui-source='.length)) : path.join(__dirname, '../src');
app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, width: 1400, height: 800, webPreferences: { offscreen: true, preload: path.join(__dirname, 'ui-preload.cjs'), contextIsolation: true, sandbox: false } });
    const errors = [];
    win.webContents.on('console-message', (_, level, message) => { if (level === 3) errors.push(message); });
    try {
        await win.loadFile(path.join(sourceDir, 'index.html'));
        await win.webContents.executeJavaScript(`localStorage.clear(); localStorage.setItem('versions', JSON.stringify([{id:'test', name:'测试版本', designRootPath:'D:/测试/配置表生成', toolRootPath:'D:/工具'}]));`);
        await win.reload();
        await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
        await win.webContents.executeJavaScript(`(async () => {
            document.getElementById('faqDialog').close();
            for(let i=0;i<100;i++) {
                if ((await window.electronAPI.getTestInstallCalls()) === 1 && !environmentTask) break;
                await new Promise(resolve => setTimeout(resolve,20));
            }
            if ((await window.electronAPI.getTestInstallCalls()) !== 1 || !svnInstalled) throw Error('startup did not auto prepare');
            if (document.getElementById('svnSetupDialog') || document.getElementById('btnInstallSvn')) throw Error('manual setup UI remains');
            if (document.getElementById('environmentBanner').dataset.state !== 'ready') throw Error('ready notice missing');
            if (!document.getElementById('environmentActions').hidden) throw Error('success asks for action');
        })()`);
        fs.writeFileSync(path.join(__dirname, 'tmp', 'svn-setup.png'), (await win.webContents.capturePage()).toPNG());
        await win.webContents.executeJavaScript(`(async () => {
            await new Promise(resolve => setTimeout(resolve,4100));
            if (!document.getElementById('environmentBanner').hidden) throw Error('ready notice does not fade');
            const existingCalls = await window.electronAPI.getTestInstallCalls();
            await checkEnvironment();
            if ((await window.electronAPI.getTestInstallCalls()) !== existingCalls) throw Error('working SVN prepared again');
            await window.electronAPI.setTestEnvironment(false);
            svnAutoAttempted = false;
            await window.electronAPI.setTestInstallResult({success:false,error:'组件校验失败，请使用完整绿色版。'});
            await Promise.all([checkEnvironment(), checkEnvironment()]);
            if ((await window.electronAPI.getTestInstallCalls()) !== existingCalls+1) throw Error('duplicate auto prepare');
            if (!document.getElementById('environmentStatus').textContent.includes('校验失败')) throw Error('setup failure hidden');
            if (document.getElementById('environmentActions').hidden || document.getElementById('btnRecheckEnvironment').disabled) throw Error('retry unavailable');
            await checkEnvironment();
            if ((await window.electronAPI.getTestInstallCalls()) !== existingCalls+1) throw Error('auto retry loop');
            if (!document.getElementById('environmentStatus').textContent.includes('校验失败')) throw Error('specific failure overwritten');
            const exportCount = (await window.electronAPI.getTestExportCalls()).length;
            await runExport('-1');
            if ((await window.electronAPI.getTestExportCalls()).length !== exportCount) throw Error('export started without SVN');
            await window.electronAPI.setTestInstallResult({success:true,source:'private'});
            const before = await window.electronAPI.getTestInstallCalls();
            const pending = document.getElementById('btnRecheckEnvironment').onclick();
            if (!document.getElementById('btnRecheckEnvironment').disabled || !document.getElementById('btnExportAll').disabled) throw Error('setup not locked');
            await checkEnvironment();
            await pending;
            if ((await window.electronAPI.getTestInstallCalls()) !== before+1) throw Error('duplicate setup');
            if (!svnInstalled || document.getElementById('environmentBanner').dataset.state !== 'ready') throw Error('auto recheck failed');
            if (document.getElementById('btnRecheckEnvironment').disabled || document.getElementById('btnExportAll').disabled) throw Error('setup remains locked');
        })()`);
        const result = await win.webContents.executeJavaScript(`(async () => {
            await window.electronAPI.setTestEnvironment(true); await checkEnvironment();
            if (!document.getElementById('environmentBanner').hidden) throw Error('SVN recovery');
            userConfig = await getFullUserConfig(currentVersion);
            await loadConfigAndStatus();
            const first = appData[0];
            toggleForceIncrement('sheet', [first], first.zh);
            if (!appData.slice(0,2).every(i => i.exportMode === 'include')) throw Error('include sync');
            toggleForceIncrement('sheet', [first], first.zh);
            await refreshSvnStatus();
            if (!appData.slice(0,2).every(i => i.exportMode === 'exclude' && !i.modified)) throw Error('exclude refresh');
            await loadConfigAndStatus();
            if (appData[0].exportMode !== 'exclude') throw Error('persist');
            if (!exportTargets(appData, true).includes(first.input)) throw Error('full excludes marked file');
            currentDisplayMode = 'sheet'; renderGrid();
            if (document.querySelector('.table-block:not(.export-excluded) .mode-label')) throw Error('auto label still visible');
            if (getComputedStyle(document.querySelector('.export-excluded')).backgroundColor !== 'rgb(201, 54, 54)') throw Error('not a solid red block');
            await openExcelGroup(first.input, null, first.sheet);
            const logRect = () => JSON.stringify(document.getElementById('logArea').getBoundingClientRect().toJSON());
            const before = logRect();
            await runExport('任务配置.xlsx');
            if (!lastErrorRecord?.isConnected) throw Error('missing result');
            if (isExportRunning) throw Error('locked after failure');
            if (lastErrorRecord.querySelector('[data-role=exportResultSummary]').textContent.indexOf('<123>') < 0) throw Error('escaped error lost');
            if (logRect() !== before) throw Error('failure resized log area');
            const firstRecord = lastErrorRecord;
            firstRecord.querySelector('summary').click();
            if (firstRecord.open || logRect() !== before) throw Error('collapse changes layout');
            firstRecord.querySelector('summary').click();
            if (!firstRecord.open) throw Error('cannot expand error');
            if (document.getElementById('btnShowExportError')) throw Error('sticky error button remains');
            if ([...firstRecord.querySelectorAll('dt')].some(x => /位置|行号/.test(x.textContent))) throw Error('row placeholder remains');
            for (let i = 0; i < 80; i++) addLog('后续运行日志 ' + i);
            if (firstRecord.getBoundingClientRect().bottom >= document.getElementById('logArea').getBoundingClientRect().top) throw Error('error does not scroll with logs');
            firstRecord.scrollIntoView({block:'start'});
            if (!lastErrorRecord.querySelector('[data-role=exportErrorLocation]').textContent.includes('quest')) throw Error('missing precise sheet');
            return { cards: document.querySelectorAll('.table-block').length, resultPanels: document.querySelectorAll('.export-result').length, overflow: document.body.scrollWidth > innerWidth };
        })()`);
        assert.equal(result.cards, 3);
        assert.equal(result.resultPanels, 1);
        assert.equal(result.overflow, false);
        await win.webContents.executeJavaScript(`(async () => {
            await window.electronAPI.setTestScanResult({success:false,categoryId:'xml',targetDir:'D:/项目/配置表生成/xml',error:'扫描超过 180 秒，已停止等待。',suggestion:'等待其他 SVN 操作结束后重试。',details:'<原始错误>'});
            const pending = showSubmitModal();
            if (document.getElementById('btnConfirmSubmit').getAttribute('aria-disabled') !== 'true') throw Error('scan allows early submit');
            await pending;
            const list = document.getElementById('submitFileList');
            if (!list.textContent.includes('XML 配置') || !list.textContent.includes('D:/项目/配置表生成/xml') || !list.textContent.includes('180 秒')) throw Error('scan context missing');
            if (list.querySelector('details').open) throw Error('technical details expanded');
            document.getElementById('svnSearchInput').dispatchEvent(new Event('input'));
            document.getElementById('btnSvnSelectAll').click();
            if (!document.getElementById('btnRetrySvnScan')) throw Error('filter erased scan failure');
        })()`);
        await new Promise(resolve => setTimeout(resolve,200));
        fs.writeFileSync(path.join(__dirname,'tmp','svn-scan-error.png'),(await win.webContents.capturePage()).toPNG());
        await win.webContents.executeJavaScript(`(async () => {
            await window.electronAPI.setTestScanResult({success:true,data:[]});
            await document.getElementById('btnRetrySvnScan').onclick();
            if (!document.getElementById('submitFileList').textContent.includes('没有检测到') || svnScanState !== 'ready') throw Error('retry failed');
            await window.electronAPI.setTestScanResult({throw:true});
            await showSubmitModal();
            if (!document.getElementById('submitFileList').textContent.includes('模拟 IPC 错误') || svnScanState !== 'error') throw Error('IPC failure uncaught');
            await window.electronAPI.setTestScanResult({success:false,error:'过期错误'});
            const oldScan = showSubmitModal();
            await window.electronAPI.setTestScanResult({success:true,data:[]});
            await Promise.all([oldScan,showSubmitModal()]);
            if (svnScanState !== 'ready') throw Error('stale scan overwrote current');
        })()`);
        assert.deepEqual(errors, []);
        await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        fs.writeFileSync(path.join(__dirname, 'tmp', 'ui-result.png'), (await win.webContents.capturePage()).toPNG());
        const { createDiagnostics } = require('../src/export-diagnostics');
        const blankTracker = createDiagnostics();
        blankTracker.consume('start process excelFile=D:\\测试\\数据填表\\魔战九州配置表.xlsx');
        blankTracker.consume('sheetName=robberyDate');
        blankTracker.consume('******error keyStr=day,typeStr=int,the value=isError', true);
        await win.webContents.executeJavaScript(`(() => {
            showExportFailure(${JSON.stringify({ success: false, fatal: true, diagnosis: blankTracker.snapshot() })}, 1);
            const location = lastErrorRecord.querySelector('[data-role=exportErrorLocation]').textContent;
            if (!location.includes('当前值（空值）') || !location.includes('int（整数）')) throw Error('empty value display failed');
            if (!lastErrorRecord.querySelector('[data-role=exportResultSummary]').textContent.includes('当前值为空')) throw Error('empty value summary missing');
            showExportFailure({success:false,diagnosis:{field:'day'}},1);
            if (!lastErrorRecord.querySelector('[data-role=exportErrorLocation]').textContent.includes('当前值日志未提供')) throw Error('missing value treated as blank');
            showExportFailure({success:false,diagnosis:{field:'day',actual:0}},1);
            if (!lastErrorRecord.querySelector('[data-role=exportErrorLocation]').textContent.includes('当前值0')) throw Error('zero treated as blank');
        })()`);
        const tracker = createDiagnostics();
        tracker.consume('****error 索引值不唯一 id=4, ,sheetName=robberyDate,excelName=D:\\测试\\数据填表\\魔战九州配置表.xlsx', true);
        await win.webContents.executeJavaScript(`(async () => {
            await window.electronAPI.setTestExportResult(${JSON.stringify({ success: false, fatal: true, diagnosis: tracker.snapshot() })});
            lastExportClickAt = 0; await runExport('任务配置.xlsx');
            const location = lastErrorRecord.querySelector('[data-role=exportErrorLocation]').textContent;
            if (!location.includes('robberyDate') || !location.includes('重复值4') || !location.includes('字段id')) throw Error('duplicate location missing');
            const original = document.querySelector('#logArea > .export-result');
            if (!original.textContent.includes('quest') || original.textContent.includes('robberyDate')) throw Error('older error overwritten');
            Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{writeText:async text => { window.copiedError = text; }} });
            original.querySelector('[data-role=btnCopyExportError]').click();
            await Promise.resolve();
            if (!window.copiedError.includes('quest') || window.copiedError.includes('robberyDate')) throw Error('older copy uses latest error');
            if (document.getElementById('runtimeErrorDialog').open) throw Error('data error should use the overlay');
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        })()`);
        fs.writeFileSync(path.join(__dirname, 'tmp', 'duplicate-error.png'), (await win.webContents.capturePage()).toPNG());
        await win.webContents.executeJavaScript(`(async () => {
            await window.electronAPI.setTestExportResult({ success:false, runtimeError:true, code:'EXPORT_INPUT_CLOSED',
                error:'导表进程异常结束，输入连接已断开。工具已停止发送输入，可以继续使用。', technical:'EPIPE: write EPIPE' });
            lastExportClickAt = 0; await runExport('任务配置.xlsx');
            if (!document.getElementById('runtimeErrorDialog').open || isExportRunning) throw Error('runtime recovery failed');
            if (!document.getElementById('runtimeErrorTechnical').textContent.includes('EPIPE')) throw Error('technical error lost');
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        })()`);
        fs.writeFileSync(path.join(__dirname, 'tmp', 'runtime-error.png'), (await win.webContents.capturePage()).toPNG());
        await win.webContents.executeJavaScript(`(async () => {
            document.getElementById('btnRuntimeErrorLogs').click();
            if (document.getElementById('runtimeErrorDialog').open || !lastErrorRecord.querySelector('details').open) throw Error('cannot close and view logs');
            await window.electronAPI.setTestExportResult({success:true,code:0});
            lastExportClickAt = 0; await runExport('任务配置.xlsx');
            if (isExportRunning || lastErrorRecord.open || document.getElementById('runtimeErrorDialog').open) throw Error('cannot run again after pipe failure');
        })()`);
        await win.webContents.executeJavaScript(`(async () => {
            const logs = document.getElementById('logArea');
            const count = logs.children.length;
            document.getElementById('btnClearLogs').click();
            if (!document.getElementById('clearLogsDialog').open || logs.children.length !== count) throw Error('clear before confirmation');
            document.getElementById('btnCancelClearLogs').click();
            if (logs.children.length !== count) throw Error('cancel cleared logs');
            isExportRunning = true;
            document.getElementById('btnClearLogs').click();
            document.getElementById('btnConfirmClearLogs').click();
            if (logs.children.length || exportLogLines.length || lastErrorRecord !== null || !isExportRunning) throw Error('clear semantics failed');
            isExportRunning = false;
            addLog('清空后继续输出');
            if (!logs.textContent.includes('清空后继续输出')) throw Error('new logs missing');
        })()`);
        await win.webContents.executeJavaScript(`(async () => {
            const originalConfirm = window.confirm;
            const originalData = appData;
            const button = document.getElementById('btnExportAll');
            const calls = () => window.electronAPI.getTestExportCalls();
            const click = async () => {
                lastExportClickAt = 0;
                button.click();
                for (let i = 0; i < 50 && isExportRunning; i++) await new Promise(resolve => setTimeout(resolve, 10));
                if (isExportRunning) throw Error('full export did not finish');
            };
            try {
                appData = [
                    {input:'modified.xlsx', exportMode:'auto', svnModified:true},
                    {input:'unmodified.xlsx', exportMode:'auto', svnModified:false},
                    {input:'excluded.xlsx', exportMode:'exclude', svnModified:true}
                ];
                window.confirm = () => false;
                const before = (await calls()).length;
                await click();
                if ((await calls()).length !== before) throw Error('cancel started export');
                window.confirm = text => {
                    if (!text.includes('包括标记为「不导表」')) throw Error('missing full scope confirmation');
                    return true;
                };
                await click();
                if ((await calls()).at(-1).selectTarget !== '-1') throw Error('exclusion changed full into incremental');
                if (!document.getElementById('logArea').textContent.includes('触发导表 [全量]')) throw Error('full mislabeled as incremental');
                if (appData[2].exportMode !== 'exclude') throw Error('full cleared exclusion preference');
                if (exportTargets(appData).includes('excluded.xlsx')) throw Error('incremental exclusion changed');
                appData.forEach(item => item.exportMode = 'auto');
                await click();
                if ((await calls()).at(-1).selectTarget !== '-1') throw Error('full did not send -1');
                appData.forEach(item => item.exportMode = 'exclude');
                const count = (await calls()).length;
                await click();
                if ((await calls()).length !== count + 1 || (await calls()).at(-1).selectTarget !== '-1') throw Error('all excluded blocked full export');
                appData = [];
                await click();
                if ((await calls()).length !== count + 1) throw Error('empty config started export');
                appData = originalData;
                appData.forEach(item => item.exportMode = item.input === '道具配置.xlsx' ? 'exclude' : 'include');
                lastExportClickAt = 0;
                await document.getElementById('btnExportOneKey').onclick();
                if ((await calls()).at(-1).selectTarget !== '任务配置.xlsx') throw Error('incremental button ignores exclusion');
            } finally { window.confirm = originalConfirm; appData = originalData; }
        })()`);
        assert.deepEqual(errors, []);
        console.log('UI smoke passed:', JSON.stringify(result));
        app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
});
