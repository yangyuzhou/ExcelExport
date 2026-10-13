const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const xml2js = require('xml2js');
const { pinyin } = require('pinyin-pro');
const iconv = require('iconv-lite');
const { findSvn, svnStatus, runFile } = require('./environment');
ipcMain.handle('check-environment', () => findSvn());

let mainWindow;
const DEBUG_SESSION_ENV_PATH = path.join(__dirname, '..', '.dbg', 'exceldir-empty.env');

function reportExceldirDebug(hypothesisId, location, msg, data) {
    try {
        if (typeof fetch !== 'function') return;
        let serverUrl = 'http://127.0.0.1:7777/event';
        let sessionId = 'exceldir-empty';
        try {
            if (fs.existsSync(DEBUG_SESSION_ENV_PATH)) {
                const envText = fs.readFileSync(DEBUG_SESSION_ENV_PATH, 'utf8');
                const urlMatch = envText.match(/^DEBUG_SERVER_URL=(.+)$/m);
                const sessionMatch = envText.match(/^DEBUG_SESSION_ID=(.+)$/m);
                if (urlMatch && urlMatch[1]) serverUrl = urlMatch[1].trim();
                if (sessionMatch && sessionMatch[1]) sessionId = sessionMatch[1].trim();
            }
        } catch (_) {}
        fetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                runId: 'pre-fix',
                hypothesisId,
                location,
                msg,
                data: data || {},
                ts: Date.now()
            })
        }).catch(() => {});
    } catch (_) {}
}

function collectExceldirDebugLines(text) {
    try {
        return String(text || '')
            .split(/\r?\n/)
            .map((line, idx) => ({ lineNo: idx + 1, line }))
            .filter(({ line }) => /\[RUNNER_V6_DIAG_1ST\]|RUNNER_ARG_orig_|set\s+"?excelDir|set\s+excelOutdir|set\s+"?xmlPathYunWei|1Dir|xce1Outdir|excelDir=|xmlPath=|xmlPathYunWei=/i.test(line))
            .slice(0, 80);
    } catch (_) {
        return [];
    }
}

// 尝试获取单实例锁
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    // 如果没有获取到锁，说明已经有实例在运行，直接退出当前实例
    app.quit();
} else {
    app.on('second-instance', () => {});

    function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 800,
        resizable: false, // 禁止拖拽边缘改变窗口大小
        icon: path.join(__dirname, '..', 'build', 'icon.ico'), // 引入图标
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // 隐藏默认菜单栏
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    
    // 打开开发者工具排查问题
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
} // 结束单实例锁的 else 分支

// ================= IPC 通信处理 =================

// ============== 对话框 (原生文件选择) ==============
ipcMain.handle('dialog:openFile', async (event, options) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(options);
    if (!canceled) return filePaths[0];
    return null;
});

ipcMain.handle('dialog:openDirectory', async (event, defaultPath) => {
    const options = { properties: ['openDirectory'] };
    if (defaultPath && fs.existsSync(defaultPath)) {
        options.defaultPath = defaultPath;
    }
    const { canceled, filePaths } = await dialog.showOpenDialog(options);
    if (!canceled) return filePaths[0];
    return null;
});

// 提供路径处理给前端
ipcMain.handle('path:join', (event, ...args) => path.join(...args));
ipcMain.handle('path:dirname', (event, p) => path.dirname(p));

// 1. 读取并解析 config.xml
ipcMain.handle('parse-config', async (event, configPath) => {
    try {
        if (!configPath || !fs.existsSync(configPath)) {
            return { success: false, error: '找不到 config.xml 文件，请在设置中检查路径: ' + configPath };
        }
        
        const xmlContent = fs.readFileSync(configPath, 'utf-8');
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(xmlContent);

        let datas = result.config.data;
        if (!Array.isArray(datas)) {
            datas = [datas];
        }

        const mockData = datas.map((item, index) => {
            // 提取纯文件名，去除路径前缀 (如 ziliaopian\资料片特权卡.xlsx -> 资料片特权卡)
            const rawFileName = item.$.input.split(/[\/\\]/).pop();
            const zhName = rawFileName.replace('.xlsx', '');
            
            const enName = item.$.name;
            const remark = `sheet: ${item.$.sheet}`;
            
            // 获取中文拼音首字母大写
            let zhInitial = pinyin(zhName.substring(0, 1), { pattern: 'first', toneType: 'none' }).toUpperCase();
            
            // 如果提取出来的首字母不是 A-Z，则统一归类为 '#'
            if (!/^[A-Z]$/.test(zhInitial)) {
                zhInitial = '#';
            }
            
            return {
                id: index + 1,
                zh: zhName,
                en: enName,
                remark: remark,
                modified: false, // 默认未修改，后续通过 SVN 更新
                zhInitial: zhInitial,
                input: item.$.input,
                outlua: item.$.outlua,
                output: item.$.output,
                sheet: item.$.sheet || '',
                sheetdesc: item.$.sheetdesc || ''
            };
        });

        return { success: true, data: mockData };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// 2. 执行 SVN 状态检查 (检查哪些表被修改了)
ipcMain.handle('check-svn-status', async (event, excelDir) => {
    const targetDir = path.resolve(excelDir || '..\\数据填表\\');
    if (!fs.existsSync(targetDir)) return { success: false, error: 'Excel目录不存在: ' + targetDir };
    const result = await svnStatus(targetDir);
    if (!result.success) return result;
    const files = result.stdout.split(/\r?\n/).flatMap(line => {
        const match = line.match(/^([MCA])\s+(.*?\.xlsx)$/i);
        return match ? [path.relative(targetDir, path.resolve(match[2].trim())).replace(/\\/g, '/').toLowerCase()] : [];
    });
    return { success: true, data: files };
});

// 3. 打开 Excel 文件
ipcMain.handle('open-excel', async (event, excelPath, sheetName) => {
    try {
        const fullPath = path.resolve(excelPath);
        
        if (!fs.existsSync(fullPath)) return { success: false, error: '文件不存在：' + fullPath };
        if (sheetName && process.platform === 'win32') {
            // Windows Script Host 无法直接读取绿色版 app.asar 内的脚本。
            const scriptDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'excel-sheet-'));
            const scriptPath = path.join(scriptDir, 'open-sheet.vbs');
            let result;
            try {
                fs.writeFileSync(scriptPath, fs.readFileSync(path.join(__dirname, 'open-sheet.vbs')));
                result = await runFile('cscript.exe', ['//nologo', scriptPath, fullPath, sheetName], { timeout: 60000 });
            } finally {
                fs.rmSync(scriptDir, { recursive: true, force: true });
            }
            if (!result.error && result.stdout.includes('SHEET_ACTIVATED')) return { success: true, sheetActivated: true };
            const reasons = {
                SHEET_NOT_FOUND: '工作簿中找不到 Sheet「' + sheetName + '」，请核对 config.xml 的 sheet 配置。',
                SHEET_HIDDEN: 'Sheet「' + sheetName + '」已隐藏，请在表格软件中取消隐藏后重试。',
                WORKBOOK_OPEN_FAILED: '无法通过表格软件打开工作簿，请检查文件是否损坏、被占用或有待处理的弹窗。',
                SHEET_ACTIVATE_FAILED: '未能切换至 Sheet「' + sheetName + '」，请关闭表格软件中的弹窗后重试。'
            };
            const key = Object.keys(reasons).find(k => result.stdout.includes(k));
            if (key) return { success: false, error: reasons[key] };
            const fallbackError = await shell.openPath(fullPath);
            if (fallbackError) return { success: false, error: fallbackError };
            return { success: true, sheetActivated: false, warning: '已打开工作簿，但无法自动定位 Sheet「' + sheetName + '」。需要支持自动化的 Microsoft Excel 或 WPS；请先手动选择该 Sheet。' };
        } else {
            // 没有指定 sheetName 或非 Windows 系统，直接使用原生打开
            const result = await shell.openPath(fullPath);
            if (result) {
                return { success: false, error: result };
            }
            return { success: true };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 4. 定位目录 (在资源管理器中选中文件)
ipcMain.handle('open-explorer', (event, targetPath) => {
    try {
        shell.showItemInFolder(path.resolve(targetPath));
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 5. 调用 TortoiseProc.exe (SVN UI 工具)
ipcMain.handle('tortoise-proc', (event, command, targetPath, logmsg) => {
    return new Promise((resolve) => {
        // command 可以是 diff, log, commit, update, revert 等
        // ========== 0. 输入校验：空/空白 path 直接返回错误，绝不能拉起 TortoiseProc（它会弹 Modal 报错）
        if (targetPath === null || targetPath === undefined) {
            resolve({ success: false, error: '传入的 SVN 路径为 null/undefined（请检查配置里的各个路径是否都填了）' });
            return;
        }
        const resolvedPath = typeof targetPath === 'string' ? path.resolve(targetPath.trim()) : '';
        if (!resolvedPath) {
            resolve({ success: false, error: '传入的 SVN 路径是空字符串（请先在「路径设置」里配置好各个目录）' });
            return;
        }

        // ========== 1. 构造参数数组（不再用 exec 拼接字符串 + cmd.exe 解析，避免引号/反斜杠把 TortoiseProc 的 /path: 吃掉）
        //    TortoiseProc.exe 的命令行是这样接受的：
        //      TortoiseProc.exe /command:update /path:"D:\long path with spaces\xxx" /closeonend:2
        //    我们用 spawn(字符串数组参数) + windowsVerbatimArguments:true → Node 不碰任何转义，原样给 CreateProcess
        const args = [];
        args.push(`/command:${command}`);

        // TortoiseProc 特殊规定：如果 path 里包含 "*" 分隔多个路径，就不加引号；单个路径才加引号。
        // 而且 path 里如果最后有 " \ " 结尾，TortoiseProc 会认为你转义了引号，把 /path 参数整体当空，
        // 所以这里先把所有末尾的 \ 去掉一个（只要最后一个字符是 \ 就去掉，直到最后不是 \）。
        let pathValue = resolvedPath;
        while (pathValue.length > 1 && pathValue.endsWith('\\')) {
            pathValue = pathValue.slice(0, -1);
        }
        // 多个路径用 * 分隔时不要加引号（TortoiseProc 自己会切分），单个路径用双引号包（兼容空格）
        if (pathValue.includes('*')) {
            args.push(`/path:${pathValue}`);
        } else {
            args.push(`/path:"${pathValue}"`);
        }

        // 默认加一个 closeonend=2（无论成功失败，只要用户没手动取消的话都自动关）
        // 你如果想保留原来默认不自动关的行为，改成 0 即可
        args.push('/closeonend:2');

        // 如果传了提交日志，写到临时文件里再挂 /logmsgfile
        if (logmsg && typeof logmsg === 'string' && logmsg.trim().length > 0) {
            const tmpPath = path.join(app.getPath('temp'), `svn_msg_${Date.now()}.txt`);
            try {
                fs.writeFileSync(tmpPath, logmsg, 'utf-8');
                // 单个临时文件路径，用双引号包
                args.push(`/logmsgfile:"${tmpPath}"`);
            } catch (e) {
                resolve({ success: false, error: '写入 SVN 提交日志临时文件失败: ' + e.message });
                return;
            }
        }

        // ========== 2. 用 spawn 直接 CreateProcess TortoiseProc.exe（不再经过 cmd.exe /c 解析中转，引号不会被吃）
        try {
            const proc = spawn('TortoiseProc.exe', args, {
                shell: false,
                windowsVerbatimArguments: true,
                detached: false,
                windowsHide: false
            });
            let errorMsg = null;
            proc.on('error', (err) => {
                errorMsg = err && err.message ? err.message : 'TortoiseProc.exe 启动失败（可能未安装 TortoiseSVN）';
            });
            proc.on('close', (code) => {
                if (errorMsg) {
                    resolve({ success: false, error: errorMsg });
                } else {
                    // TortoiseProc 总是返回 0，用户取消/确认都不影响外层
                    resolve({ success: true, exitCode: code });
                }
            });
        } catch (err) {
            resolve({ success: false, error: err && err.message ? err.message : 'tortoise-proc spawn 异常' });
        }
    });
});

// 简单的 UTF-8 校验启发式函数
function decodeMixedBuffer(buffer) {
    let isUtf8 = true;
    let hasNonAscii = false;
    let i = 0;
    while (i < buffer.length) {
        if ((buffer[i] & 0x80) === 0x00) {
            i++;
        } else if ((buffer[i] & 0xE0) === 0xC0) {
            if (i + 1 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80) { isUtf8 = false; break; }
            hasNonAscii = true;
            i += 2;
        } else if ((buffer[i] & 0xF0) === 0xE0) {
            if (i + 2 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80 || (buffer[i + 2] & 0xC0) !== 0x80) { isUtf8 = false; break; }
            hasNonAscii = true;
            i += 3;
        } else if ((buffer[i] & 0xF8) === 0xF0) {
            if (i + 3 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80 || (buffer[i + 2] & 0xC0) !== 0x80 || (buffer[i + 3] & 0xC0) !== 0x80) { isUtf8 = false; break; }
            hasNonAscii = true;
            i += 4;
        } else {
            isUtf8 = false;
            break;
        }
    }
    
    if (isUtf8 && hasNonAscii) {
        return buffer.toString('utf-8');
    } else {
        return iconv.decode(buffer, 'gbk');
    }
}

// 6. 执行导表 Bat (全量或增量)
ipcMain.handle('run-export-bat', async (event, argsObj) => {
    const environment = await findSvn();
    if (!environment.success) return environment;
    if (!argsObj.toolRootPath || !argsObj.designRootPath || !argsObj.configXmlPath) return { success: false, error: '请先在路径设置中配置数据表和工具目录。' };
    const scriptPath = path.join(argsObj.toolRootPath, argsObj.targetBatName || 'toClientPy1.bat');
    if (!fs.existsSync(scriptPath)) return { success: false, error: '找不到导表脚本：' + scriptPath };
    if (!fs.existsSync(argsObj.configXmlPath)) return { success: false, error: '找不到配置文件：' + argsObj.configXmlPath };
    return new Promise((resolve) => {
        const { commitSvn, toPath, toolRootPath, targetBatName, luaPath, xmlPath, designRootPath, selectTarget, configXmlPath, toExportDesignPath } = argsObj;

        // ========== FATAL 报错关键字（命中立刻终止整棵进程树）
        // 从用户实际截图里提取到的常见模式：
        //   1) ***error / *****error / ******error   (索引值不唯一 / keyStr...isError 这类)
        //   2) ****表数据错误,请联系策化修改
        //   3) the data is Errrror  (row=X --name=id 这类)
        //   4) Traceback / WindowsError / SyntaxError / NameError / TypeError / ImportError / ValueError / AttributeError  (Python 崩溃)
        //   5) 错误 / Error: / Fatal
        const FATAL_PATTERNS = [
            /\*{2,}error/i,                  // ***error / *****error / ******error（不管几个星）
            /表数据错误/,                     // ****表数据错误,请联系策化修改
            /the data is\s+err+r/i,          // the data is Errrror (多写了 r)
            /Traceback\s*\(/i,               // Python Traceback (most recent call last):
            /WindowsError/i,
            /SyntaxError/i,
            /NameError/i,
            /TypeError/i,
            /ImportError/i,
            /ValueError/i,
            /AttributeError/i,
            /UnboundLocalError/i,
            /\bError\s*:/,                   // xxxError:  xxxxx 或  [Error 32] 这种
            /Fatal(?!_)/i                    // Fatal 类报错，但跳过我们自己的 fatal 变量命名
        ];

        function classifyLogLine(msg) {
            // 先判断是不是白名单「请按任意键继续」（不要被 /Error/ 正则误杀，虽然它不含 Error，但保险起见放一下）
            if (/请按任意键继续|连续按两次任意键|pause/i.test(msg)) {
                return null;
            }
            for (const re of FATAL_PATTERNS) {
                if (re.test(msg)) { return re.source; }
            }
            return null;
        }

        let fatalKilled = false;
        let fatalMatchedPattern = null;
        let fatalMatchedLine = '';

        function handleFatalIfAny(decodedLine) {
            if (fatalKilled) return;
            const p = classifyLogLine(decodedLine);
            if (!p) return;
            fatalKilled = true;
            fatalMatchedPattern = p;
            fatalMatchedLine = decodedLine.replace(/\s+$/, '');
            try {
                // Windows 上用 taskkill /F /T 直接杀掉整棵进程树（包括 cmd / python / 所有 pause 子进程）
                exec(`taskkill /F /T /PID ${batProcess && batProcess.pid || 0}`, () => {});
            } catch (e) { /* ignore */ }
            // 立刻把错误原因用 fatal_error 类型打给前端
            event.sender.send('bat-log', {
                type: 'fatal_error',
                msg: `\n[系统] 检测到致命错误，已立即终止导表！匹配规则: /${p}/\n[系统] 命中的错误行: ${fatalMatchedLine}\n`
            });
        }
        
        // 组装参数对应 toClient.bat %1 到 %7（保持原生 7 参数接口，不修改 toClientPy.bat）
        //   【2026-08-17 FIX 1: ARG6 传参层级修正】
        //   - UI 里用户选择的 designRootPath  = 「配置表生成」目录本身，例如：
        //     D:\gctx\project\e1_dev\design\配置表生成
        //   - 但 toClientPy.bat 第 6 个参数预期接收的是「配置表生成目录的 父目录」，因为
        //     bat 内部会写 set excelDir=%designRootPath%\数据填表，直接拼出「父目录\数据填表」。
        //   - 所以在这里先 path.dirname 取父目录，再入 argsList[5]（ARG6）。
        //   ARG1 = commitSvn
        //   ARG2 = toPath (客户端 data 目录)
        //   ARG3 = configXmlPath
        //   ARG4 = luaPath
        //   ARG5 = xmlPath
        //   ARG6 = path.dirname(配置表生成目录)  ← 父目录层级！
        //   ARG7 = selectTarget (可能为空，可能是单表名)
        function stripOuterQuotes(v) {
            const s = String(v == null ? '' : v);
            if (s.length >= 2 && s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') {
                return s.slice(1, -1);
            }
            return s;
        }
        // 先剥外层引号，保证传给 Runner 的都是纯值
        const rawCommitSvn   = stripOuterQuotes(commitSvn);
        const rawToPath      = stripOuterQuotes(toPath);
        const rawConfigXml   = stripOuterQuotes(configXmlPath);
        const rawLuaPath     = stripOuterQuotes(luaPath);
        const rawXmlPath     = stripOuterQuotes(xmlPath);
        // ARG6 特殊处理：UI 里 designRootPath 是「配置表生成」目录 → 父目录
        const rawDesignRoot  = (() => {
            try {
                const d = stripOuterQuotes(designRootPath);
                return d ? path.dirname(d) : '';
            } catch (e) { return stripOuterQuotes(designRootPath); }
        })();
        const rawSelectTarget= stripOuterQuotes(selectTarget || '');

        const argsList = [
            rawCommitSvn,
            rawToPath,
            rawConfigXml,
            rawLuaPath,
            rawXmlPath,
            rawDesignRoot
        ];
        if (rawSelectTarget) {
            argsList.push(rawSelectTarget);
        } else {
            argsList.push('');
        }

        // 使用绝对路径调用，防止 CMD 根据系统 PATH 瞎找文件
        const targetBatPath = path.join(toolRootPath, targetBatName || 'toClientPy1.bat');

        // =====================================================
        // Runner v8 · 原汁原味手动执行（2026-08-19 · V6.5）
        //
        // 为什么之前有 Runner.bat + 7 个 _aN.txt？→ 过度设计，历史包袱。
        // 根因只有一个：Node 侧对前 6 个路径参数错误地加了双引号，导致 CMD 引号嵌套错位。
        // 解法：完全模拟用户在 CMD 里手动 call 的写法，直接构造命令行，0 中间文件。
        //
        // 参数引号规则（严格对齐手动执行）：
        //   - 目标 bat 路径：加双引号（路径可能含空格）
        //   - %1~%6（路径参数）：不加双引号，原样传
        //   - %7（文件名，可能含空格）：加双引号
        // =====================================================

        const maxArgs = Math.max(7, argsList.length);

        function escapeCmdLineArg(v) {
            let s = String(v == null ? '' : v);
            s = s.replace(/\^/g, '^^');
            s = s.replace(/%/g, '^%');
            s = s.replace(/&/g, '^&');
            s = s.replace(/\|/g, '^|');
            s = s.replace(/>/g, '^>');
            s = s.replace(/</g, '^<');
            return s;
        }

        let callArgsStr = '';
        for (let i = 1; i <= maxArgs; i++) {
            const raw = argsList[i - 1] == null ? '' : String(argsList[i - 1]);
            const escaped = escapeCmdLineArg(raw);
            if (i === 7) {
                callArgsStr += ' "' + escaped + '"';
            } else {
                callArgsStr += ' ' + escaped;
            }
        }

        const targetBatEscaped = escapeCmdLineArg(targetBatPath);
        const callStr = 'call "' + targetBatEscaped + '"' + callArgsStr;

        const cmdLine = '/d /s /c "' + callStr + '"';

        const fullCmdForCopy = (process.env.comspec || 'cmd.exe') + ' ' + cmdLine;

        event.sender.send('bat-log', {
            type: 'debug',
            msg: `[V6.5 · spawn 调试 · Runner v8 终极简化版] 0 Runner 0 中间文件，完全等价于手动在 CMD 里敲：\n` +
                 `  原版业务 bat 路径     = [${targetBatPath}]（文件本身 0 修改，0 正则替换）\n` +
                 `  【ARG6 修正说明】: UI designRootPath=${JSON.stringify(designRootPath)} → 父目录 ARG6=${JSON.stringify(rawDesignRoot)}\n` +
                 `  【参数引号规则】: 目标bat路径加引号；%1~%6 路径参数不加引号；%7 文件名加引号（与手动执行完全一致）\n` +
                 argsList.map((v, i) => `    ARG${i + 1} = ${JSON.stringify(v)}${i + 1 === 7 ? '  ← 第7个，会加双引号' : ''}`).join('\n') +
                 `\n  【可直接复制到 CMD 执行的完整命令行】：\n${fullCmdForCopy}\n` +
                 `\n  【V6.5 验收要点】excelDir 绝对不再为空，路径里不会再有多余嵌套引号。`,
            _debug: null
        });

        // spawn 的直接命令是 cmd.exe，windowsVerbatimArguments: true 让 Node 不要转义引号
        const batProcess = spawn(process.env.comspec || 'cmd.exe', [cmdLine], {
            cwd: toolRootPath || __dirname,
            env: {
                ...process.env,
                PATH: (path.isAbsolute(environment.path) ? path.dirname(environment.path) + path.delimiter : '') + (process.env.PATH || ''),
                synToLuaServer: "1",
                toExportDesignPath: toExportDesignPath || "",
                PYTHONUNBUFFERED: "1",
                PYTHONIOENCODING: "utf-8",
                PYTHONLEGACYWINDOWSSTDIO: "1",
                PYTHONIOENCODING_PERSIST: "1"
            },
            shell: false,
            windowsHide: true,
            windowsVerbatimArguments: true,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // 立刻向子进程的 stdin 喂「两个回车 + 持续兜底每隔 800ms 再喂一次」
        // 目的：只要任何一层 pause 阻塞（cmd pause / python os.system("pause")），都能立刻读到回车，
        //       保证不卡。持续兜底 15 分钟，避免 python 脚本里有多个 pause 循环。
        (function feedPauseForever() {
            const MAX_FEED_SECONDS = 15 * 60; // 15 分钟兜底就够了（导表不可能跑 15 分钟以上）
            const startedAt = Date.now();
            const FEED_INTERVAL_MS = 800;
            try {
                const line1 = Buffer.from('\r\n\r\n'); // 一次喂两个回车（对应「连续按两次任意键」语义）
                const line2 = Buffer.from('y\r\n');    // 有的 bat 里可能有 choice /t 或 set /p 要 y/n，顺便兼容
                batProcess.stdin.write(line1, () => {});
                batProcess.stdin.write(line2, () => {});
            } catch (e) { /* ignore */ }
            const timer = setInterval(() => {
                const elapsed = (Date.now() - startedAt) / 1000;
                if (elapsed > MAX_FEED_SECONDS) {
                    clearInterval(timer);
                    try { batProcess.stdin.end(); } catch (e) { /* ignore */ }
                    return;
                }
                try {
                    batProcess.stdin.write(Buffer.from('\r\n'), () => {});
                } catch (e) {
                    clearInterval(timer);
                }
            }, FEED_INTERVAL_MS);
            batProcess.on('close', () => {
                clearInterval(timer);
                try { batProcess.stdin.destroy(); } catch (e) { /* ignore */ }
            });
        })();

        // 监听输出流，发送给前端
        // 关键修复 3：分行逻辑改为「有 \n 就切，没 \n 就按时间窗口 flush」，
        //            避免 pause 提示 "请按任意键继续..." 这种没换行符的提示永远被吞
        let stdoutBuffer = Buffer.alloc(0);
        let stdoutFlushTimer = null;
        let stdoutBytesReceived = 0;      // 调试用：累计字节
        let stdoutChunkCount = 0;        // 调试用：累计 data 事件次数
        function flushStdoutBuffer(force) {
            if (stdoutBuffer.length === 0) return;
            if (!force) {
                // 非 force 模式下，如果 buffer 里还没换行，先等 120ms 看后面会不会拼上后续内容
                if (stdoutBuffer.indexOf(10) === -1) {
                    if (stdoutFlushTimer) clearTimeout(stdoutFlushTimer);
                    stdoutFlushTimer = setTimeout(() => flushStdoutBuffer(true), 120);
                    return;
                }
            }
            if (stdoutFlushTimer) { clearTimeout(stdoutFlushTimer); stdoutFlushTimer = null; }
            while (true) {
                const newlineIdx = stdoutBuffer.indexOf(10);
                if (newlineIdx === -1) {
                    if (stdoutBuffer.length > 0 && force) {
                        // force 时把没换行的尾巴也当作一行推出去（比如 pause 提示、进度条）
                        const decoded = decodeMixedBuffer(stdoutBuffer);
                        const fatalPattern = fatalKilled ? null : classifyLogLine(decoded);
                        const logType = fatalPattern ? 'fatal_error' : 'info';
                        event.sender.send('bat-log', { type: logType, msg: decoded, _debug: { stdoutBytesReceived, stdoutChunkCount } });
                        if (fatalPattern) handleFatalIfAny(decoded);
                        stdoutBuffer = Buffer.alloc(0);
                    }
                    break;
                }
                const lineBuf = stdoutBuffer.slice(0, newlineIdx + 1);
                stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1);
                const decoded = decodeMixedBuffer(lineBuf);
                const fatalPattern = fatalKilled ? null : classifyLogLine(decoded);
                const logType = fatalPattern ? 'fatal_error' : 'info';
                event.sender.send('bat-log', { type: logType, msg: decoded, _debug: { stdoutBytesReceived, stdoutChunkCount } });
                // #region debug-point C:stdout-suspicious-lines
                if (/\[RUNNER_V6_DIAG_1ST\]|RUNNER_ARG_orig_|1Dir|xce1Outdir|excelDir=|xmlPath=|xmlPathYunWei=/i.test(decoded)) {
                    reportExceldirDebug(
                        'C',
                        'src/main.js:stdout-line',
                        '[DEBUG] suspicious stdout line',
                        {
                            line: decoded,
                            stdoutBytesReceived,
                            stdoutChunkCount
                        }
                    );
                }
                // #endregion
                if (fatalPattern) handleFatalIfAny(decoded);
            }
        }

        batProcess.stdout.on('data', (data) => {
            stdoutChunkCount += 1;
            stdoutBytesReceived += data.length;
            stdoutBuffer = Buffer.concat([stdoutBuffer, data]);
            flushStdoutBuffer(false);
        });

        let stderrBuffer = Buffer.alloc(0);
        let stderrFlushTimer = null;
        let stderrBytesReceived = 0;
        let stderrChunkCount = 0;
        function flushStderrBuffer(force) {
            if (stderrBuffer.length === 0) return;
            if (!force) {
                if (stderrBuffer.indexOf(10) === -1) {
                    if (stderrFlushTimer) clearTimeout(stderrFlushTimer);
                    stderrFlushTimer = setTimeout(() => flushStderrBuffer(true), 120);
                    return;
                }
            }
            if (stderrFlushTimer) { clearTimeout(stderrFlushTimer); stderrFlushTimer = null; }
            while (true) {
                const newlineIdx = stderrBuffer.indexOf(10);
                if (newlineIdx === -1) {
                    if (stderrBuffer.length > 0 && force) {
                        const decoded = decodeMixedBuffer(stderrBuffer);
                        const fatalPattern = fatalKilled ? null : classifyLogLine(decoded);
                        // stderr 的默认类型是 error（Python Traceback 全在这里）
                        const logType = fatalPattern ? 'fatal_error' : 'error';
                        event.sender.send('bat-log', { type: logType, msg: decoded, _debug: { stderrBytesReceived, stderrChunkCount } });
                        if (fatalPattern) handleFatalIfAny(decoded);
                        stderrBuffer = Buffer.alloc(0);
                    }
                    break;
                }
                const lineBuf = stderrBuffer.slice(0, newlineIdx + 1);
                stderrBuffer = stderrBuffer.slice(newlineIdx + 1);
                const decoded = decodeMixedBuffer(lineBuf);
                const fatalPattern = fatalKilled ? null : classifyLogLine(decoded);
                const logType = fatalPattern ? 'fatal_error' : 'error';
                event.sender.send('bat-log', { type: logType, msg: decoded, _debug: { stderrBytesReceived, stderrChunkCount } });
                // #region debug-point D:stderr-suspicious-lines
                if (/\[RUNNER_V6_DIAG_1ST\]|RUNNER_ARG_orig_|1Dir|xce1Outdir|excelDir=|xmlPath=|xmlPathYunWei=/i.test(decoded)) {
                    reportExceldirDebug(
                        'D',
                        'src/main.js:stderr-line',
                        '[DEBUG] suspicious stderr line',
                        {
                            line: decoded,
                            stderrBytesReceived,
                            stderrChunkCount
                        }
                    );
                }
                // #endregion
                if (fatalPattern) handleFatalIfAny(decoded);
            }
        }

        batProcess.stderr.on('data', (data) => {
            stderrChunkCount += 1;
            stderrBytesReceived += data.length;
            stderrBuffer = Buffer.concat([stderrBuffer, data]);
            flushStderrBuffer(false);
        });

        // 极端场景兜底：bat 执行超过 2 小时自动 kill，防止真有什么逻辑卡到天荒地老
        let timeoutKilled = false;
        const MAX_RUN_SECONDS = 2 * 60 * 60; // 2 小时
        const watchdogTimer = setTimeout(() => {
            if (fatalKilled) return;   // fatal 已经 kill 过一次了就别再碰
            timeoutKilled = true;
            try {
                exec(`taskkill /F /T /PID ${batProcess.pid}`, () => {});
            } catch (e) { /* ignore */ }
        }, MAX_RUN_SECONDS * 1000);

        batProcess.on('error', error => {
            clearTimeout(watchdogTimer);
            resolve({ success: false, error: '无法启动导表脚本：' + error.message });
        });

        batProcess.on('close', (code) => {
            clearTimeout(watchdogTimer);
            if (stdoutFlushTimer) clearTimeout(stdoutFlushTimer);
            if (stderrFlushTimer) clearTimeout(stderrFlushTimer);
            // 处理残留在 buffer 里的数据（强制 flush，包括没换行的尾巴）
            flushStdoutBuffer(true);
            flushStderrBuffer(true);

            // 最后再发一条『管道接收汇总』调试日志 —— 让前端看到我们到底有没有读到字节，方便排错
            if (!fatalKilled) {
                event.sender.send('bat-log', {
                    type: 'debug',
                    msg: `[管道汇总] stdout: ${stdoutBytesReceived} B / ${stdoutChunkCount} 次 ; stderr: ${stderrBytesReceived} B / ${stderrChunkCount} 次 ; exit=${code}`,
                    _debug: { stdoutBytesReceived, stdoutChunkCount, stderrBytesReceived, stderrChunkCount }
                });
            }

            if (fatalKilled) {
                resolve({
                    success: false,
                    code: -999,
                    fatal: true,
                    fatalPattern: fatalMatchedPattern,
                    fatalLine: fatalMatchedLine
                });
                return;
            }
            if (timeoutKilled) {
                event.sender.send('bat-log', { type: 'error', msg: `[系统] 导表脚本执行超时（> ${MAX_RUN_SECONDS/3600} 小时），已强制终止。\n` });
                resolve({ success: false, code: -998, timeout: true });
            } else {
                resolve({ success: code === 0, code });
            }
        });
    });
});

// 7. 获取多个目录下的所有 SVN 变更
ipcMain.handle('get-all-svn-changes', async (event, dirs) => {
    const results = [];
    for (const dirObj of dirs) {
        if (!dirObj.path) continue;
        const targetDir = path.resolve(dirObj.path);
        if (!fs.existsSync(targetDir)) continue;

        const scan = await svnStatus(targetDir);
        if (!scan.success) return scan;
        const stdout = scan.stdout;
                const lines = stdout.split('\n');
                lines.forEach(line => {
                    const match = line.match(/^([MCA])\s+(.*)\r?$/i);
                    if (match) {
                        let filePath = match[2].trim();
                        if (filePath) {
                             const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(targetDir, filePath);
                             // 忽略目录
                             try {
                                 const stat = fs.statSync(absolutePath);
                                 if (stat.isDirectory()) return; 
                             } catch (e) {
                                 // 文件可能被删除，保留它
                             }
                             results.push({
                                 status: match[1],
                                 path: absolutePath,
                                 name: filePath.split(/[\/\\]/).pop(),
                                 dir: targetDir,
                                 categoryId: dirObj.id
                             });
                        }
                    }
                });
    }
    return { success: true, data: results };
});

// 8. 创建桌面快捷方式
ipcMain.handle('create-shortcut', async () => {
    try {
        const desktopPath = app.getPath('desktop');
        const shortcutPath = path.join(desktopPath, '一站式导表工具.lnk');
        
        // 核心修复：如果是 electron-builder 打包的 Portable (绿色版)
        // 它的真实外壳路径保存在 process.env.PORTABLE_EXECUTABLE_FILE 中
        // process.execPath 指向的是解压后的 Temp 临时目录
        const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
        const isPackaged = app.isPackaged;
        
        let target = exePath;
        let args = '';
        let cwd = path.dirname(exePath);
        let iconPath = exePath;

        // 如果是在开发环境（未打包），process.execPath 是 node_modules 里的 electron.exe
        // 直接运行它会打开 Electron 默认的欢迎页。我们需要让它附带当前项目的路径作为参数
        if (!isPackaged) {
            target = exePath;
            // 指向项目根目录（即 src 的上一级）
            const projectRoot = path.resolve(__dirname, '..');
            // 注意：args 不能带多余的双引号，否则 Windows 快捷方式解析会出错导致找不到文件
            args = projectRoot;
            cwd = projectRoot;
            iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
        }

        // 使用 shell.writeShortcutLink 创建快捷方式
        // 注意：Windows 的 shell.writeShortcutLink 对于 target 必须是绝对路径且不带引号
        // 而 args 是单独传递的参数。
        const success = shell.writeShortcutLink(shortcutPath, 'create', {
            target: target,
            args: args,
            cwd: cwd,
            description: '一站式导表工具 - 游戏配置导出辅助工具',
            appUserModelId: 'com.game.excelexport',
            icon: iconPath,
            iconIndex: 0
        });

        if (success) {
            return { success: true };
        } else {
            return { success: false, error: '系统拒绝了快捷方式创建请求' };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// 9. 检查桌面快捷方式是否存在
ipcMain.handle('check-shortcut-exists', async () => {
    try {
        const desktopPath = app.getPath('desktop');
        const shortcutPath = path.join(desktopPath, '一站式导表工具.lnk');
        return { exists: fs.existsSync(shortcutPath) };
    } catch (err) {
        return { exists: false };
    }
});
