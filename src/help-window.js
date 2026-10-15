const path = require('path');
const topics = new Set(['getting-started', 'paths', 'svn', 'export', 'sheets', 'errors', 'submit']);
function createHelpWindowController(BrowserWindow, sourceDir) {
    let window = null;
    return {
        async open(topic) {
            const targetTopic = topics.has(topic) ? topic : 'getting-started';
            if (!window || window.isDestroyed()) {
                window = new BrowserWindow({
                    width: 900, height: 780, minWidth: 480, minHeight: 400,
                    title: '使用指南 · 可拖动到旁边对照操作', show: false, resizable: true,
                    autoHideMenuBar: true,
                    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
                });
                const created = window;
                created.on('closed', () => { if (window === created) window = null; });
                created.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
            }
            const target = window;
            try {
                await target.loadFile(path.join(sourceDir, 'faq.html'), { hash: targetTopic });
                if (target.isDestroyed()) return { success: false, error: '帮助窗口已关闭，请重新打开。' };
                if (target.isMinimized()) target.restore();
                target.show(); target.focus();
                return { success: true };
            } catch (error) {
                if (!target.isDestroyed()) target.destroy();
                return { success: false, error: '帮助窗口打开失败：' + error.message };
            }
        },
        close() { if (window && !window.isDestroyed()) window.close(); }
    };
}
module.exports = { createHelpWindowController };
