const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
app.disableHardwareAcceleration();
app.setPath('userData', path.join(__dirname, 'tmp', 'faq-profile'));
const sourceArg = process.argv.find(arg => arg.startsWith('--faq-source='));
const sourceDir = sourceArg ? path.resolve(sourceArg.slice('--faq-source='.length)) : path.join(__dirname, '../src');
app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, width: 1400, height: 800, webPreferences: {
        offscreen: true, contextIsolation: true, sandbox: false, preload: path.join(__dirname, 'ui-preload.cjs')
    } });
    const errors = [];
    win.webContents.on('console-message', (_, level, message) => { if (level === 3) errors.push(message); });
    const evaluate = code => win.webContents.executeJavaScript(code);
    const reload = () => new Promise(resolve => { win.webContents.once('did-finish-load', resolve); win.reload(); });
    async function faqFrame(expectedHash) {
        for (let i = 0; i < 50; i++) {
            const frame = win.webContents.mainFrame.frames.find(f => f.url.includes('faq.html'));
            if (frame && await frame.executeJavaScript("document.readyState === 'complete'")) {
                if (expectedHash === undefined || await frame.executeJavaScript("'#' + document.body.dataset.topic") === expectedHash) return frame;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw Error('FAQ iframe did not load: ' + JSON.stringify({ expectedHash, frames: win.webContents.mainFrame.frames.map(f => f.url), state: await evaluate("({src:document.getElementById('faqFrame').src,open:document.getElementById('faqDialog').open})") }));
    }
    try {
        await win.loadFile(path.join(sourceDir, 'index.html'));
        await evaluate('localStorage.clear()');
        await reload();
        assert.equal(await evaluate("document.getElementById('faqDialog').open"), true, 'first launch opens guide');
        assert.equal(await evaluate("document.getElementById('faqShowOnStartup').checked"), false);
        let frame = await faqFrame();
        await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        fs.writeFileSync(path.join(__dirname, 'tmp', 'faq-desktop.png'), (await win.webContents.capturePage()).toPNG());
        assert.equal(await frame.executeJavaScript("document.getElementById('openSettings').hidden"), false);
        await frame.executeJavaScript("document.querySelector('nav a[href=\"#export\"]').click()");
        assert.equal(await frame.executeJavaScript('document.body.dataset.topic'), 'export', 'sidebar navigation works inside sandbox');
        await evaluate("window.postMessage({type:'faq-action',action:'close'}, '*')");
        assert.equal(await evaluate("document.getElementById('faqDialog').open"), true, 'ignore messages from other windows');
        await frame.executeJavaScript("document.getElementById('openSettings').click()");
        assert.equal(await evaluate("document.getElementById('faqDialog').open"), false, 'embedded settings action closes guide');
        assert.equal(await evaluate("document.getElementById('versionModal').style.display"), 'flex');
        await reload();
        assert.equal(await evaluate("document.getElementById('faqDialog').open"), false, 'second launch stays closed');
        await evaluate("document.getElementById('btnHelp').click(); document.getElementById('faqShowOnStartup').checked = true; document.getElementById('faqShowOnStartup').dispatchEvent(new Event('change')); document.getElementById('btnFinishFaq').click()");
        await reload();
        assert.equal(await evaluate("document.getElementById('faqDialog').open"), true, 'startup preference persists');
        await evaluate("document.getElementById('faqShowOnStartup').checked = false; document.getElementById('faqShowOnStartup').dispatchEvent(new Event('change')); document.getElementById('btnFinishFaq').click(); document.querySelector('[data-help-topic=svn]').click()");
        frame = await faqFrame('#svn');
        assert.equal(await frame.executeJavaScript('document.body.dataset.topic'), 'svn');
        assert.equal(await frame.executeJavaScript("document.querySelector('#svn details').open"), true);
        await frame.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))");
        assert.equal(await evaluate("document.getElementById('faqDialog').open"), false, 'Escape inside iframe returns to tool');
        await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', {key:'F1'}))");
        assert.equal(await evaluate("document.getElementById('faqDialog').open"), true, 'F1 reopens guide');
        await evaluate("document.getElementById('btnFinishFaq').click(); document.querySelector('[data-help-topic=errors]').click()");
        frame = await faqFrame('#errors');
        assert.equal(await frame.executeJavaScript('document.body.dataset.topic'), 'errors');
        // The same HTML must work without any Electron bridge, including narrow screens.
        await win.loadFile(path.join(sourceDir, 'faq.html'));
        assert.equal(await evaluate("document.getElementById('openSettings').hidden"), true, 'standalone hides app-only action');
        const searchResult = await evaluate(`(() => {
            const search = document.getElementById('faqSearch'); search.value = '不导表'; search.dispatchEvent(new Event('input'));
            return [...document.querySelectorAll('.faq-item:not([hidden])')].map(item => ({open:item.open, text:item.textContent}));
        })()`);
        assert.ok(searchResult.length >= 2);
        assert.ok(searchResult.every(item => item.open && item.text.includes('不导表')));
        await evaluate("document.getElementById('faqSearch').value = 'zzzzNoSuchQuestion'; document.getElementById('faqSearch').dispatchEvent(new Event('input'))");
        assert.equal(await evaluate("document.getElementById('noResults').hidden"), false);
        await evaluate("document.getElementById('clearSearch').click()");
        assert.equal(await evaluate("document.getElementById('getting-started').hidden"), false);
        win.setSize(390, 844);
        await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false, 'narrow screen has no horizontal overflow');
        fs.writeFileSync(path.join(__dirname, 'tmp', 'faq-mobile.png'), (await win.webContents.capturePage()).toPNG());
        assert.deepEqual(errors, []);
        console.log('FAQ passed: first launch, saved preference, reopen/F1/Escape, settings, contextual links, standalone search and narrow screen.');
        app.exit(0);
    } catch (error) { console.error(error); console.error(errors); app.exit(1); }
});
