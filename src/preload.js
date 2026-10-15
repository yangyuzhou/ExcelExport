const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openHelpWindow: topic => ipcRenderer.invoke('open-help-window', topic),
    checkEnvironment: () => ipcRenderer.invoke('check-environment'),
    parseConfig: (path) => ipcRenderer.invoke('parse-config', path),
    checkSvnStatus: (path) => ipcRenderer.invoke('check-svn-status', path),
    runExportBat: (args) => ipcRenderer.invoke('run-export-bat', args),
    tortoiseProc: (command, path, logmsg) => ipcRenderer.invoke('tortoise-proc', command, path, logmsg),
    openExcel: (path, sheetName) => ipcRenderer.invoke('open-excel', path, sheetName),
    openExplorer: (path) => ipcRenderer.invoke('open-explorer', path),
    onBatLog: (callback) => ipcRenderer.on('bat-log', (event, data) => callback(data)),
    selectFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
    selectDirectory: (defaultPath) => ipcRenderer.invoke('dialog:openDirectory', defaultPath),
    pathJoin: (...args) => ipcRenderer.invoke('path:join', ...args),
    pathDirname: (p) => ipcRenderer.invoke('path:dirname', p),
    getAllSvnChanges: (dirs) => ipcRenderer.invoke('get-all-svn-changes', dirs),
    createShortcut: () => ipcRenderer.invoke('create-shortcut'),
    checkShortcutExists: () => ipcRenderer.invoke('check-shortcut-exists')
});
