const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
contextBridge.exposeInMainWorld('electronAPI', {
    pathJoin: async (...args) => path.join(...args),
    checkShortcutExists: async () => ({ exists: true }),
    checkEnvironment: async () => ({ success: false, code: 'SVN_MISSING', error: '未检测到 SVN 命令行工具（svn.exe）。' }),
    parseConfig: async () => ({ success: true, data: [
        { id: 1, zh: '道具配置', en: 'item', input: '道具配置.xlsx', sheet: '道具表', zhInitial: 'D', outlua: '', output: '' },
        { id: 2, zh: '道具配置', en: 'reward', input: '道具配置.xlsx', sheet: '奖励表', zhInitial: 'D', outlua: '', output: '' },
        { id: 3, zh: '任务配置', en: 'quest', input: '任务配置.xlsx', sheet: 'quest', zhInitial: 'R', outlua: '', output: '' }
    ] }),
    checkSvnStatus: async () => ({ success: true, data: ['道具配置.xlsx'] }),
    onBatLog: callback => ipcRenderer.on('test-log', (_, data) => callback(data)),
    runExportBat: async args => ({ success: false, fatal: true, fatalLine: '道具配置.xlsx / 道具表：第 18 行，id 重复 <123>', code: -999 }),
    openExcel: async (file, sheet) => ({ success: true, sheetActivated: true }),
    tortoiseProc: async () => ({ success: true })
});
