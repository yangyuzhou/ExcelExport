const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
app.disableHardwareAcceleration();
app.setPath('userData', path.join(__dirname, 'tmp', 'ui-profile'));
app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, width: 1400, height: 800, webPreferences: { offscreen: true, preload: path.join(__dirname, 'ui-preload.cjs'), contextIsolation: true, sandbox: false } });
    const errors = [];
    win.webContents.on('console-message', (_, level, message) => { if (level === 3) errors.push(message); });
    try {
        await win.loadFile(path.join(__dirname, '../src/index.html'));
        await win.webContents.executeJavaScript(`localStorage.clear(); localStorage.setItem('versions', JSON.stringify([{id:'test', name:'测试版本', designRootPath:'D:/测试/配置表生成', toolRootPath:'D:/工具'}]));`);
        await win.reload();
        await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
        await win.webContents.executeJavaScript(`(async () => {
            document.getElementById('faqDialog').close();
            await new Promise(resolve => setTimeout(resolve, 100));
            if (!document.getElementById('svnSetupDialog').open) throw Error('missing SVN startup dialog');
            if (document.getElementById('environmentBanner').hidden) throw Error('missing SVN banner');
        })()`);
        fs.writeFileSync(path.join(__dirname, 'tmp', 'svn-setup.png'), (await win.webContents.capturePage()).toPNG());
        const result = await win.webContents.executeJavaScript(`(async () => {
            await window.electronAPI.setTestEnvironment(true); await checkEnvironment();
            if (document.getElementById('svnSetupDialog').open || !document.getElementById('environmentBanner').hidden) throw Error('SVN recovery');
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
            if (exportTargets(appData, true).includes(first.input)) throw Error('full exclusion');
            currentDisplayMode = 'sheet'; renderGrid();
            if (document.querySelector('.table-block:not(.export-excluded) .mode-label')) throw Error('auto label still visible');
            if (getComputedStyle(document.querySelector('.export-excluded')).backgroundColor !== 'rgb(201, 54, 54)') throw Error('not a solid red block');
            await openExcelGroup(first.input, null, first.sheet);
            const logRect = () => JSON.stringify(document.getElementById('logArea').getBoundingClientRect().toJSON());
            const before = logRect();
            await runExport('任务配置.xlsx');
            if (document.getElementById('exportResult').hidden) throw Error('missing result');
            if (isExportRunning) throw Error('locked after failure');
            if (document.getElementById('exportResultSummary').textContent.indexOf('<123>') < 0) throw Error('escaped error lost');
            if (logRect() !== before) throw Error('failure resized log area');
            document.getElementById('btnCloseExportError').click();
            if (!document.getElementById('exportResult').hidden || logRect() !== before) throw Error('close changes layout');
            document.getElementById('btnShowExportError').click();
            if (document.getElementById('exportResult').hidden) throw Error('cannot reopen error');
            if (!document.getElementById('exportErrorLocation').textContent.includes('quest')) throw Error('missing precise sheet');
            return { cards: document.querySelectorAll('.table-block').length, resultPanels: document.querySelectorAll('.export-result').length, overflow: document.body.scrollWidth > innerWidth };
        })()`);
        assert.equal(result.cards, 3);
        assert.equal(result.resultPanels, 1);
        assert.equal(result.overflow, false);
        assert.deepEqual(errors, []);
        await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        fs.writeFileSync(path.join(__dirname, 'tmp', 'ui-result.png'), (await win.webContents.capturePage()).toPNG());
        const { createDiagnostics } = require('../src/export-diagnostics');
        const tracker = createDiagnostics();
        tracker.consume('****error 索引值不唯一 id=4, ,sheetName=robberyDate,excelName=D:\\测试\\数据填表\\魔战九州配置表.xlsx', true);
        await win.webContents.executeJavaScript(`(async () => {
            await window.electronAPI.setTestExportResult(${JSON.stringify({ success: false, fatal: true, diagnosis: tracker.snapshot() })});
            lastExportClickAt = 0; await runExport('任务配置.xlsx');
            const location = document.getElementById('exportErrorLocation').textContent;
            if (!location.includes('robberyDate') || !location.includes('重复值4') || !location.includes('字段id')) throw Error('duplicate location missing');
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
            if (document.getElementById('runtimeErrorDialog').open || !document.querySelector('#exportResult details').open) throw Error('cannot close and view logs');
            await window.electronAPI.setTestExportResult({success:true,code:0});
            lastExportClickAt = 0; await runExport('任务配置.xlsx');
            if (isExportRunning || !document.getElementById('exportResult').hidden || document.getElementById('runtimeErrorDialog').open) throw Error('cannot run again after pipe failure');
        })()`);
        assert.deepEqual(errors, []);
        console.log('UI smoke passed:', JSON.stringify(result));
        app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
});
