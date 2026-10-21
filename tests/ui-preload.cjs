const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
let svnInstalled = false;
let nextExportResult = null;
let helpTopic = null;
const exportCalls = [];
contextBridge.exposeInMainWorld('electronAPI', {
    openHelpWindow: async topic => { helpTopic = topic; return { success: true }; },
    getTestHelpTopic: () => helpTopic,
    pathJoin: async (...args) => path.join(...args),
    checkShortcutExists: async () => ({ exists: true }),
    setTestEnvironment: value => { svnInstalled = value; },
    setTestExportResult: value => { nextExportResult = value; },
    getTestExportCalls: () => exportCalls,
    checkEnvironment: async () => svnInstalled ? { success: true } : ({ success: false, code: 'SVN_MISSING', error: '未检测到 SVN 命令行工具（svn.exe）。' }),
    parseConfig: async () => ({ success: true, data: [
        { id: 1, zh: '道具配置', en: 'item', input: '道具配置.xlsx', sheet: '道具表', zhInitial: 'D', outlua: '', output: '' },
        { id: 2, zh: '道具配置', en: 'reward', input: '道具配置.xlsx', sheet: '奖励表', zhInitial: 'D', outlua: '', output: '' },
        { id: 3, zh: '任务配置', en: 'quest', input: '任务配置.xlsx', sheet: 'quest', zhInitial: 'R', outlua: '', output: '' }
    ] }),
    checkSvnStatus: async () => ({ success: true, data: ['道具配置.xlsx'] }),
    onBatLog: callback => ipcRenderer.on('test-log', (_, data) => callback(data)),
    runExportBat: async args => { exportCalls.push(args); return nextExportResult || ({ success: false, fatal: true, code: -999, diagnosis: {
        workbook: '任务配置.xlsx', sheet: 'quest', input: '任务配置.xlsx', excelPath: 'D:/测试/数据填表/任务配置.xlsx',
        field: 'day', expected: 'int', actual: '<123>', summary: '「day」需要整数，当前填写的是「<123>」。',
        suggestion: '打开出错页签，找到 day 列，修正数据后保存并重新导表。',
        context: ['start process excelFile=D:/测试/数据填表/任务配置.xlsx', 'quest', '******error keyStr=day,typeStr=int,the value=<123> isError']
    } }); },
    openExcel: async (file, sheet) => ({ success: true, sheetActivated: true }),
    tortoiseProc: async () => ({ success: true })
});
