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
        const result = await win.webContents.executeJavaScript(`(async () => {
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
            await openExcelGroup(first.input, null, first.sheet);
            await runExport('任务配置.xlsx');
            if (document.getElementById('exportResult').hidden) throw Error('missing result');
            if (isExportRunning) throw Error('locked after failure');
            if (document.getElementById('exportResultSummary').textContent.indexOf('<123>') < 0) throw Error('escaped error lost');
            return { cards: document.querySelectorAll('.table-block').length, resultPanels: document.querySelectorAll('.export-result').length, overflow: document.body.scrollWidth > innerWidth };
        })()`);
        assert.equal(result.cards, 3);
        assert.equal(result.resultPanels, 1);
        assert.equal(result.overflow, false);
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(__dirname, 'tmp', 'ui-result.png'), (await win.webContents.capturePage()).toPNG());
        console.log('UI smoke passed:', JSON.stringify(result));
        app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
});
