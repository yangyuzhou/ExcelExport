const { app, BrowserWindow } = require('electron');
const path = require('path');
const assert = require('node:assert/strict');
const { createHelpWindowController } = require('../src/help-window');
app.disableHardwareAcceleration();
app.setPath('userData', path.join(__dirname, 'tmp', 'help-window-profile'));
app.whenReady().then(async () => {
    // Exercise real native windows without displaying test windows on the user's desktop.
    const windows = [];
    class HiddenWindow extends BrowserWindow {
        constructor(options) { super(options); windows.push(this); }
        show() {}
        focus() {}
    }
    const sourceArg = process.argv.find(arg => arg.startsWith('--faq-source='));
    const source = sourceArg ? path.resolve(sourceArg.slice('--faq-source='.length)) : path.join(__dirname, '../src');
    const controller = createHelpWindowController(HiddenWindow, source);
    try {
        const main = new BrowserWindow({ show: false });
        assert.equal((await controller.open('svn')).success, true);
        const guide = windows[0];
        assert.equal(guide.getParentWindow(), null);
        assert.equal(guide.isModal(), false);
        assert.equal(guide.isResizable(), true);
        assert.equal(guide.isMovable(), true);
        guide.setSize(700, 600); assert.deepEqual(guide.getSize(), [700, 600]);
        assert.equal(await guide.webContents.executeJavaScript('document.body.dataset.topic'), 'svn');
        assert.equal(await guide.webContents.executeJavaScript('typeof window.electronAPI'), 'undefined');
        assert.equal(await guide.webContents.executeJavaScript("getComputedStyle(document.querySelector('.svn-component')).color"), 'rgb(198, 40, 40)');
        assert.equal(main.isEnabled(), true);
        await controller.open('errors'); assert.equal(windows.length, 1);
        assert.equal(await guide.webContents.executeJavaScript('document.body.dataset.topic'), 'errors');
        await controller.open('../../secret');
        assert.equal(await guide.webContents.executeJavaScript('document.body.dataset.topic'), 'getting-started');
        controller.close();
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.equal(main.isDestroyed(), false);
        await controller.open('export'); assert.equal(windows.length, 2);
        controller.close(); main.destroy();
        console.log('Independent help passed: real movable/resizable non-modal window, topic navigation, reuse, reopen, red text, main window unaffected.');
        app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
});
