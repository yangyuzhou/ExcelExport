let appData = [];
let svnReady = false;
let svnInstalled = false;
let exportLogLines = [];
const { fileKey, nextMode, shouldExport, targets: exportTargets } = window.ExportState;
function storedModes() {
    try { return JSON.parse(localStorage.getItem('exportModes:' + currentVersion.id) || '{}'); } catch { return {}; }
}
function applyMode(item, mode) {
    item.exportMode = mode || 'auto';
    item.forceModified = item.exportMode === 'include';
    item.modified = shouldExport(item);
}
function setFileMode(item, mode) {
    const modes = storedModes();
    if (mode === 'auto') delete modes[fileKey(item.input)];
    else modes[fileKey(item.input)] = mode;
    localStorage.setItem('exportModes:' + currentVersion.id, JSON.stringify(modes));
    appData.filter(i => fileKey(i.input) === fileKey(item.input)).forEach(i => applyMode(i, mode));
    updateAlphaFilterState();
    renderGrid();
}
function modeLabel(mode) { return ({ auto: '自动判断', include: '强制增量', exclude: '不导表' })[mode || 'auto']; }
function modeBadge(item) {
    if (!item.exportMode || item.exportMode === 'auto') return '';
    const excluded = item.exportMode === 'exclude';
    return '<span class="export-mode-badge ' + (excluded ? 'is-excluded' : 'mode-label') + '"' +
        (excluded ? ' title="全量和增量导表均跳过此 Excel；点击左侧红色方框恢复自动判断"' : '') + '>' + modeLabel(item.exportMode) + '</span>';
}
function modeCheckbox(item) {
    const mode = item.exportMode || 'auto';
    return '<button type="button" class="checkbox ' + (mode === 'include' ? 'checked' : mode === 'exclude' ? 'excluded' : '') + '" data-role="force-checkbox" aria-label="' + modeLabel(mode) + '，点击切换为' + modeLabel(nextMode(mode)) + '" title="当前：' + modeLabel(mode) + '；点击：' + modeLabel(nextMode(mode)) + '"></button>';
}
async function checkEnvironment() {
    let result;
    try { result = await window.electronAPI.checkEnvironment(); }
    catch (error) { result = { success: false, error: 'SVN 检测失败：' + error.message }; }
    svnReady = result.success;
    svnInstalled = result.success;
    document.getElementById('environmentBanner').hidden = result.success;
    document.getElementById('environmentStatus').textContent = result.success ? '' : result.error;
    document.getElementById('svnSetupStatus').textContent = result.success ? 'SVN 已就绪，可以导表。' : result.error;
    if (result.success) document.getElementById('svnSetupDialog').close();
    else if (!svnNoticeShown) {
        svnNoticeShown = true;
        // Let the first-use guide finish; do not stack two modal dialogs.
        const guide = document.getElementById('faqDialog');
        if (guide.open) guide.addEventListener('close', () => { if (!svnInstalled) openSvnSetup(); }, { once: true });
        else openSvnSetup();
    }
    return result;
}
let svnNoticeShown = false;
function openSvnSetup() {
    const dialog = document.getElementById('svnSetupDialog');
    if (!dialog.open) dialog.showModal();
}
let lastExportFailure = null;
function showExportFailure(result, seconds) {
    lastExportFailure = result;
    const panel = document.getElementById('exportResult');
    panel.hidden = false;
    document.getElementById('btnShowExportError').hidden = false;
    const d = result.diagnosis || {};
    document.getElementById('exportResultTitle').textContent = result.fatal ? '导表已停止' : '导表未完成';
    document.getElementById('exportResultSummary').textContent = d.summary || result.error || result.fatalLine || (result.timeout ? '执行超时，请检查导表脚本是否等待输入。' : '脚本异常退出（代码 ' + result.code + '），请复制日志交给工具维护人员。');
    const rows = [
        ['Excel', d.workbook || '日志未提供'], ['页签', d.sheet || '未能识别，请查看相关日志'],
        ['字段', d.field || '日志未提供'],
        ['位置', d.reportedRow ? '脚本行号 ' + d.reportedRow + '（请核对表头偏移）' : '未提供 Excel 行号，请按字段和值查找']
    ];
    if (d.expected) rows.push(['要求类型', d.expected]);
    if (d.actual !== undefined) rows.push([d.kind === 'duplicate-key' ? '重复值' : '当前值', d.actual || '空值']);
    document.getElementById('exportErrorLocation').innerHTML = rows.map(([label, value]) => '<dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value) + '</dd>').join('');
    document.getElementById('exportErrorLocation').hidden = !result.diagnosis;
    document.getElementById('exportErrorPath').textContent = d.excelPath || '';
    document.getElementById('exportErrorAdvice').textContent = d.suggestion || '修正提示的问题后重试；需要协助时，点击“复制错误信息”发给工具维护人员。';
    document.getElementById('btnOpenErrorExcel').hidden = !d.input;
    document.getElementById('btnOpenErrorExcel').textContent = d.sheet ? '打开出错页签' : '打开出错 Excel';
    document.getElementById('exportResultMeta').textContent = '耗时 ' + seconds + ' 秒 · 修正问题后可重新导表';
    document.getElementById('exportResultDetails').textContent = d.context?.join('\n') || result.fatalLine || [result.error, result.technical].filter(Boolean).join('\n') || exportLogLines.slice(-18).join('\n') || '没有收到脚本日志。';
    panel.scrollTop = 0;
    if (result.runtimeError) {
        document.getElementById('runtimeErrorMessage').textContent = result.error;
        document.getElementById('runtimeErrorTechnical').textContent = result.technical || '';
        const dialog = document.getElementById('runtimeErrorDialog');
        if (!dialog.open) dialog.showModal();
    }
}

let currentContextItem = null; // 右键选中的配置项
let currentSvnContextPath = null; // SVN 列表右键选中的文件路径

// ============== 公共工具：escapeHtml（防止日志里的 < > & 被浏览器当成 HTML tag 吃掉）==============
function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============== 导表互斥 & 防连点 ==============
let isExportRunning = false;        // 全量/增量 共用一把互斥锁
let lastExportClickAt = 0;          // 快速点击节流阈值（毫秒）
const EXPORT_CLICK_COOLDOWN = 800;    // 800ms 内的重复点击直接忽略

// 两个导表按钮在「导表中」的视觉反馈
function setExportButtonsBusy(busy) {
    const allBtn = document.getElementById('btnExportAll');
    const oneBtn = document.getElementById('btnExportOneKey');
    const btns = [];
    if (allBtn) btns.push(allBtn);
    if (oneBtn) btns.push(oneBtn);
    btns.forEach(btn => {
        btn.disabled = busy;
        btn.style.opacity = busy ? '0.55' : '1';
        btn.style.cursor = busy ? 'not-allowed' : 'pointer';
        btn.style.pointerEvents = busy ? 'none' : 'auto';
    });
}

window.showSvnContextMenu = function(e, path) {
    currentSvnContextPath = path;
    const menu = document.getElementById('svnContextMenu');
    menu.style.display = 'flex';
    let x = e.clientX;
    let y = e.clientY;
    if(x + 200 > window.innerWidth) x = window.innerWidth - 200;
    if(y + 200 > window.innerHeight) y = window.innerHeight - 200;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
};

// 默认版本配置
let versions = JSON.parse(localStorage.getItem('versions') || '[]');
if (versions.length === 0) {
    versions = [{
        id: 'default',
        name: '主版本 (Trunk)',
        designRootPath: localStorage.getItem('designRootPath') && localStorage.getItem('designRootPath') !== 'undefined' ? localStorage.getItem('designRootPath') : '',
        toolRootPath: localStorage.getItem('toolRootPath') && localStorage.getItem('toolRootPath') !== 'undefined' ? localStorage.getItem('toolRootPath') : '',
        targetBatName: 'toClientPy1.bat'
    }];
    localStorage.setItem('versions', JSON.stringify(versions));
} else {
    // 兼容老版本数据缓存：将旧的字段名迁移到新字段名
    let needSave = false;
    versions.forEach(v => {
        if (v.designRoot && !v.designRootPath) {
            v.designRootPath = v.designRoot;
            delete v.designRoot;
            needSave = true;
        }
        if (v.toolRoot && !v.toolRootPath) {
            v.toolRootPath = v.toolRoot;
            delete v.toolRoot;
            needSave = true;
        }
        // 处理 undefined 字符串的情况
        if (v.designRootPath === 'undefined') {
            v.designRootPath = '';
            needSave = true;
        }
        if (v.toolRootPath === 'undefined') {
            v.toolRootPath = '';
            needSave = true;
        }
        if (!v.targetBatName || v.targetBatName === 'toClient.bat' || v.targetBatName === 'toClientPy.bat') {
            v.targetBatName = 'toClientPy1.bat';
            needSave = true;
        }
    });
    if (needSave) {
        localStorage.setItem('versions', JSON.stringify(versions));
    }
}

let currentVersionId = localStorage.getItem('currentVersionId') || versions[0].id;
let currentVersion = versions.find(v => v.id === currentVersionId) || versions[0];
let editingVersionId = currentVersion.id;

// 当前视图模式: 'excel' | 'sheet'
let currentDisplayMode = 'excel';

// 动态推导路径
async function getDerivedPaths(designRootPath, toolRootPath) {
    if (!designRootPath) return {};
    try {
        // 根据截图，以玩家选择的"配置表生成"目录作为基准推导
        const pwdStr = designRootPath;
        const configXmlPath = await window.electronAPI.pathJoin(pwdStr, 'config.xml');
        const toPath = await window.electronAPI.pathJoin(pwdStr, 'clientCode', 'trunk', 'xxsg', 'res', 'data');
        const luaPath = await window.electronAPI.pathJoin(pwdStr, 'lua');
        const xmlPath = await window.electronAPI.pathJoin(pwdStr, 'xml');
        const toExportDesignPath = await window.electronAPI.pathJoin(pwdStr, '..', '..', 'win32Realease', 'res', 'data');
        return { configXmlPath, toPath, luaPath, xmlPath, toExportDesignPath };
    } catch (e) {
        return {};
    }
}

// 基于当前版本获取完整的 config 对象
async function getFullUserConfig(version) {
    const derived = await getDerivedPaths(version.designRootPath, version.toolRootPath);
    return {
        name: version.name,
        designRootPath: version.designRootPath,
        toolRootPath: version.toolRootPath,
        targetBatName: version.targetBatName || 'toClientPy1.bat',
        configXmlPath: derived.configXmlPath || '',
        toPath: derived.toPath || '',
        luaPath: derived.luaPath || '',
        xmlPath: derived.xmlPath || '',
        toExportDesignPath: derived.toExportDesignPath || ''
    };
}

let userConfig = {};

async function checkShortcutVisibility() {
    const res = await window.electronAPI.checkShortcutExists();
    const btn = document.getElementById('btnCreateShortcut');
    if (res.exists) {
        btn.style.display = 'none';
    } else {
        btn.style.display = 'block';
    }
}

// 页面加载完毕后初始化
window.addEventListener('DOMContentLoaded', async () => {
    // 检查快捷方式状态
    checkShortcutVisibility();
    
    // 1. 清空默认的假数据日志，并写入真实的启动欢迎语
    const logArea = document.getElementById('logArea');
    if (logArea) logArea.innerHTML = '';
    
    addLog('========== 欢迎使用一站式导表工具 ==========');
    
    // 加载当前版本配置
    userConfig = await getFullUserConfig(currentVersion);
    document.getElementById('btnSwitchVersion').innerText = `版本：${userConfig.name || '未命名'}`;
    document.title = `一站式导表工具 - [${userConfig.name || '未命名'}]`;
    
    initAlphaFilter();
    bindEvents();
    
    // 开始解析配置并获取状态
    try {
        await checkEnvironment();
        await loadConfigAndStatus();
    } catch(err) {
        addLog(`<span style="color:red">初始化过程发生严重错误: ${err.message || err}</span>`);
    }
});

async function loadConfigAndStatus() {
    if (!userConfig.configXmlPath) {
        addLog('<span style="color:orange; font-weight:bold;">尚未配置 config.xml，请点击右上角【路径设置】进行配置。</span>');
        return;
    }
    addLog(`[当前配置] config.xml: ${userConfig.configXmlPath}`);
    addLog(`[当前配置] 数据表目录: ${userConfig.designRootPath}`);
    addLog('-------------------------------------------');
    
    addLog('开始解析 config.xml...');
    const result = await window.electronAPI.parseConfig(userConfig.configXmlPath);
    
    if (!result.success) {
        addLog(`<span style="color:red">解析配置失败: ${result.error}</span>`);
        return;
    }
    
    const modes = storedModes();
    appData = result.data;
    appData.forEach(item => applyMode(item, modes[fileKey(item.input)]));
    addLog(`成功加载 ${appData.length} 条配置。`);
    
    // 更新字母栏的置灰状态 (移到了 refreshSvnStatus 中)
    
    // 检查 SVN 状态并刷新 UI
    await refreshSvnStatus();
}

async function refreshSvnStatus(silent = false) {
    if (!userConfig.designRootPath || appData.length === 0) { svnReady = false; return; }
    
    if (!silent) addLog('正在检测 SVN 文件修改状态...');
    const svnResult = await window.electronAPI.checkSvnStatus(userConfig.designRootPath + '\\..\\数据填表');
    
    svnReady = svnResult.success;
    if (svnResult.code === 'SVN_MISSING') await checkEnvironment();
    if (svnResult.success) {
        const modifiedFiles = svnResult.data;
        if (!silent) {
            if (modifiedFiles.length > 0) {
                addLog(`检测到 ${modifiedFiles.length} 个文件被修改。`);
            } else {
                addLog('当前工作区没有未提交的修改。');
            }
        }
        
        // 更新数据的 modified 状态
        appData.forEach(item => {
            item.svnModified = modifiedFiles.includes(fileKey(item.input));
            applyMode(item, item.exportMode);
        });
    } else {
        if (!silent) addLog(`<span style="color:orange">SVN检测警告: ${escapeHtml(svnResult.error)}</span>`);
    }
    
    // 状态更新后，刷新字母栏置灰状态和网格
    updateAlphaFilterState();
    renderGrid();
}

function initAlphaFilter() {
    const alphaFilter = document.getElementById('alphaFilter');
    alphaFilter.innerHTML = '';
    
    const clickHandler = function() {
        if (this.classList.contains('disabled')) return;
        document.querySelectorAll('.alpha-char').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        renderGrid();
    };
    
    // 生成 A-Z
    for(let i = 65; i <= 90; i++) {
        let char = String.fromCharCode(i);
        let span = document.createElement('span');
        span.className = 'alpha-char letter-btn';
        span.innerText = char;
        span.dataset.char = char;
        span.onclick = clickHandler;
        alphaFilter.appendChild(span);
    }
    
    // 追加 '#' 分组
    let hashSpan = document.createElement('span');
    hashSpan.className = 'alpha-char letter-btn';
    hashSpan.innerText = '#';
    hashSpan.dataset.char = '#';
    hashSpan.onclick = clickHandler;
    alphaFilter.appendChild(hashSpan);

    // 绑定静态的特殊按钮 (全、增)
    document.querySelectorAll('.special-btn').forEach(btn => {
        btn.onclick = clickHandler;
    });

    // 绑定模式切换按钮
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentDisplayMode = this.dataset.mode;
            renderGrid();
        });
    });
}

// 根据当前加载的数据，更新字母表的可点击状态
function updateAlphaFilterState() {
    const existingInitials = new Set(appData.map(item => item.zhInitial));
    const hasModified = appData.some(item => item.modified);
    
    document.querySelectorAll('.alpha-char').forEach(span => {
        const char = span.dataset.char;
        if (char === 'ALL') return; // '全'按钮始终可用
        
        if (char === 'MODIFIED') {
            if (hasModified) span.classList.remove('disabled');
            else span.classList.add('disabled');
            return;
        }
        
        if (existingInitials.has(char)) {
            span.classList.remove('disabled');
        } else {
            span.classList.add('disabled');
        }
    });
}

function renderGrid() {
    const excludedCount = new Set(appData.filter(i => i.exportMode === 'exclude').map(i => fileKey(i.input))).size;
    const exclusionSummary = document.getElementById('exclusionSummary');
    exclusionSummary.hidden = excludedCount === 0;
    exclusionSummary.textContent = `不导表：已排除 ${excludedCount} 个 Excel 文件 · 全量和增量均跳过 · 点击红色方框可恢复`;
    const activeChar = document.querySelector('.alpha-char.active').dataset.char;
    // 将搜索字符串转小写并去除所有空格，方便进行无缝拼音和中文匹配
    const searchStr = document.getElementById('searchInput').value.toLowerCase().replace(/\s+/g, '');
    const container = document.getElementById('tableGridContainer');
    container.innerHTML = '';

    // 更新搜索框样式反馈
    const searchBox = document.querySelector('.search-box');
    if (searchStr) {
        searchBox.classList.add('active-search');
    } else {
        searchBox.classList.remove('active-search');
    }

    const grouped = {};
    appData.forEach(item => {
        if (activeChar === 'MODIFIED' && !item.modified) return; // '增'过滤器：跳过未修改的
        if (activeChar !== 'ALL' && activeChar !== 'MODIFIED' && item.zhInitial !== activeChar) return;
        
        if (searchStr) {
            const matchZh = item.zh.toLowerCase().includes(searchStr);
            const matchEn = item.en.toLowerCase().includes(searchStr);
            const matchPyFull = item.zhPinyinFull && item.zhPinyinFull.includes(searchStr);
            const matchPyFirst = item.zhPinyinFirst && item.zhPinyinFirst.includes(searchStr);
            const matchSheet = item.sheet && item.sheet.toLowerCase().includes(searchStr);
            const matchDesc = item.sheetdesc && item.sheetdesc.toLowerCase().includes(searchStr);
            
            // 如果所有条件都不满足，则过滤掉
            if (!matchZh && !matchEn && !matchPyFull && !matchPyFirst && !matchSheet && !matchDesc) return;
        }
        
        if (!grouped[item.zhInitial]) grouped[item.zhInitial] = {};
        if (!grouped[item.zhInitial][fileKey(item.input)]) grouped[item.zhInitial][fileKey(item.input)] = [];
        grouped[item.zhInitial][fileKey(item.input)].push(item);
    });

    Object.keys(grouped).sort().forEach(letter => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'letter-group';
        
        const title = document.createElement('div');
        title.className = 'letter-title';
        title.innerText = letter;
        groupDiv.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'table-grid';

        if (currentDisplayMode === 'excel') {
            // Excel 模式：按 Excel 去重显示
            Object.keys(grouped[letter]).forEach(inputKey => {
                const subItems = appData.filter(i => fileKey(i.input) === inputKey);
                const zhName = subItems[0].zh;
                const anyModified = subItems.some(i => i.modified);
                const anyForceModified = subItems.some(i => i.forceModified);
                
                const block = document.createElement('div');
                block.className = `table-block ${anyModified ? 'modified' : ''} ${anyForceModified ? 'force-modified' : ''} ${subItems[0].exportMode === 'exclude' ? 'export-excluded' : ''}`;
                
                block.innerHTML = `
                    ${modeCheckbox(subItems[0])}
                    <div class="block-info" style="flex-direction:column; align-items:stretch; justify-content:center;">
                        <div class="block-zh" title="${zhName}" style="font-size:18px; color:#000;">${escapeHtml(zhName)}</div>${modeBadge(subItems[0])}
                    </div>
                    <div class="btn-open" data-target="${subItems[0].input}">打开</div>
                `;
                
                const forceCheckbox = block.querySelector('[data-role="force-checkbox"]');
                forceCheckbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleForceIncrement('excelGroup', subItems, zhName);
                });
                
                // 绑定打开按钮事件
                const openBtn = block.querySelector('.btn-open');
                openBtn.addEventListener('click', (e) => {
                    openExcelGroup(openBtn.dataset.target, e);
                });
                
                block.oncontextmenu = function(e) {
                    e.preventDefault();
                    currentContextItem = subItems[0];
                    showGlobalContextMenu(e);
                };

                grid.appendChild(block);
            });
        } else {
            // Sheet 模式：每个 Sheet 独立显示
            const allItemsInLetter = [];
            Object.values(grouped[letter]).forEach(subItems => allItemsInLetter.push(...subItems));
            
            allItemsInLetter.forEach(item => {
                const sheetName = item.sheet || '未命名Sheet';
                const sheetDesc = item.sheetdesc || '';
                
                const block = document.createElement('div');
                block.className = `table-block ${item.modified ? 'modified' : ''} ${item.forceModified ? 'force-modified' : ''} ${item.exportMode === 'exclude' ? 'export-excluded' : ''}`;
                
                // 如果有中文注释，主标题显示中文(英文sheet名)；如果没有则只显示英文sheet名
                const mainTitle = sheetDesc ? `${sheetDesc} (${sheetName})` : sheetName;
                
                block.innerHTML = `
                    ${modeCheckbox(item)}
                    <div class="block-info" style="flex-direction:column; align-items:stretch; justify-content:center;">
                        <div class="block-zh" title="${mainTitle}" style="font-size:15px; color:#000; line-height:1.2;">
                            ${sheetDesc ? `<span>${sheetDesc}</span><br><span style="font-size:12px; color:#666; font-weight:normal;">(${sheetName})</span>` : sheetName}
                        </div>
                        <div class="block-remark" title="${item.zh}" style="margin-top:2px;">所属: ${escapeHtml(item.zh)}</div>
                        ${modeBadge(item)}
                    </div>
                    <div class="btn-open" data-target="${item.input}">打开</div>
                `;
                
                const forceCheckbox = block.querySelector('[data-role="force-checkbox"]');
                forceCheckbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleForceIncrement('sheet', [item], mainTitle);
                });
                
                // 绑定打开按钮事件
                const openBtn = block.querySelector('.btn-open');
                openBtn.addEventListener('click', (e) => {
                    openExcelGroup(openBtn.dataset.target, e, item.sheet);
                });
                
                block.oncontextmenu = function(e) {
                    e.preventDefault();
                    currentContextItem = item;
                    showGlobalContextMenu(e);
                };

                grid.appendChild(block);
            });
        }

        groupDiv.appendChild(grid);
        container.appendChild(groupDiv);
    });

    // 处理无数据的空状态展示
    if (Object.keys(grouped).length === 0) {
        let emptyHtml = '';
        if (searchStr) {
            emptyHtml = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding-top: 100px; color: #666;">
                    <div style="font-size: 60px; margin-bottom: 20px;">🔍</div>
                    <div style="font-size: 20px; font-weight: bold; margin-bottom: 10px; color: #d35400;">当前处于搜索过滤状态</div>
                    <div style="font-size: 16px; margin-bottom: 25px;">没有找到与 "<span style="color:#e74c3c; font-weight:bold;">${document.getElementById('searchInput').value}</span>" 匹配的 ${activeChar === 'MODIFIED' ? '已修改' : ''}表格</div>
                    <div class="control-btn" id="btnEmptyClearSearch" style="background: #3498db; color: white; border: none; padding: 10px 30px; border-radius: 20px;">清除搜索</div>
                </div>
            `;
        } else if (activeChar === 'MODIFIED') {
            emptyHtml = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding-top: 100px; color: #666;">
                    <div style="font-size: 60px; margin-bottom: 20px;">✅</div>
                    <div style="font-size: 20px; font-weight: bold;">当前没有已修改的表格</div>
                    <div style="font-size: 16px; margin-top: 10px; color: #999;">所有配置表均已同步至最新状态</div>
                </div>
            `;
        } else {
            emptyHtml = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding-top: 100px; color: #666;">
                    <div style="font-size: 20px;">暂无数据</div>
                </div>
            `;
        }
        container.innerHTML = emptyHtml;

        const btnClear = document.getElementById('btnEmptyClearSearch');
        if (btnClear) {
            btnClear.onclick = () => {
                document.getElementById('searchInput').value = '';
                renderGrid();
            };
        }
    }
}

function showGlobalContextMenu(e) {
    const menu = document.getElementById('contextMenu');
    
    // 动态控制 强制增量 和 取消强制增量 的显示
    const forceModifyBtn = document.getElementById('menuForceModify');
    const cancelForceModifyBtn = document.getElementById('menuCancelForceModify');
    if (currentContextItem && currentContextItem.exportMode !== 'auto') {
        forceModifyBtn.style.display = 'none';
        cancelForceModifyBtn.style.display = 'block';
    } else {
        forceModifyBtn.style.display = 'block';
        cancelForceModifyBtn.style.display = 'none';
    }
    
    menu.style.display = 'flex';
    let x = e.clientX;
    let y = e.clientY;
    if(x + 200 > window.innerWidth) x = window.innerWidth - 200;
    if(y + 250 > window.innerHeight) y = window.innerHeight - 250;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

// 绑定全局事件
function bindEvents() {
    // 隐藏右键菜单
    document.onclick = () => { 
        document.getElementById('contextMenu').style.display = 'none'; 
        const svnMenu = document.getElementById('svnContextMenu');
        if (svnMenu) svnMenu.style.display = 'none';
    };

    // 搜索
    document.getElementById('searchInput').oninput = () => renderGrid();
    document.getElementById('searchClear').onclick = () => { 
        document.getElementById('searchInput').value = ''; 
        renderGrid(); 
    };

    // 顶部小按钮
    document.getElementById('btnUpdateSvn').onclick = async () => {
        if (!userConfig.designRootPath) {
            showToast('请先配置数据表根目录！');
            return;
        }
        // 更新到数据表根目录往上两级
        const targetDir = await window.electronAPI.pathJoin(userConfig.designRootPath, '..', '..');
        showToast('正在执行 SVN Update...');
        addLog('>>> 开始更新 SVN: ' + targetDir);
        await window.electronAPI.tortoiseProc('update', targetDir);
    };

    const btnRefreshStatus = document.getElementById('btnRefreshStatus');
    if (btnRefreshStatus) {
        btnRefreshStatus.onclick = () => {
            refreshSvnStatus(false);
        };
    }

    // 窗口聚焦时自动刷新
    window.addEventListener('focus', () => {
        if (appData.length > 0 && userConfig.designRootPath) {
            refreshSvnStatus(true); 
        }
    });

    // 底部大按钮
    const btnExportAll = document.getElementById('btnExportAll');
    if (btnExportAll) {
        btnExportAll.onclick = () => {
            // 点击级拦截：如果正在执行或在冷却期，直接返回（避免 confirm 阻塞时的边界场景）
            if (isExportRunning) {
                showToast('当前已有导表任务在执行，请稍候…');
                return;
            }
            if (window.confirm("将导出所有未标记为「不导表」的表格，可能需要较长时间，确认要继续吗？")) {
                const excluded = appData.some(i => i.exportMode === 'exclude');
                const targets = exportTargets(appData, true);
                if (!targets.length) return showToast('没有可导出的表格，请检查不导表标记和配置。');
                runExport(excluded ? targets.join('#') : '-1');
            }
        };
    }
    document.getElementById('btnExportOneKey').onclick = async () => {
        // 点击级拦截
        if (isExportRunning) {
            showToast('当前已有导表任务在执行，请稍候…');
            return;
        }
        await refreshSvnStatus(true);
        if (!svnReady) { await checkEnvironment(); await refreshSvnStatus(); showToast('SVN 状态检测失败，请先修复环境或工作副本。'); return; }
        const uniqueFiles = exportTargets(appData);
        
        if (uniqueFiles.length === 0) {
            showToast('当前没有检测到修改或被强制标记的文件，无需增量导出');
            addLog('<span style="color:orange">未检测到被修改的文件，跳过增量导表。</span>');
            return;
        }
        
        const targetStr = uniqueFiles.join('#');
        
        // 检查是否有被强制标记的文件，如果有，就在日志里提示一下
        const forceModifiedFiles = appData.filter(i => i.forceModified).map(i => i.zh);
        if (forceModifiedFiles.length > 0) {
            const uniqueForceFiles = [...new Set(forceModifiedFiles)];
            addLog(`<span style="color:#f39c12">注意: 包含了 ${uniqueForceFiles.length} 个被强制加入导表的配置。</span>`);
        }
        
        runExport(targetStr);
    };
    
    // 清空强制队列按钮 (已废弃，移至右键菜单)
    const btnClearForceModify = document.getElementById('btnClearForceModify');
    if (btnClearForceModify) {
        btnClearForceModify.onclick = () => {
            let count = 0;
            appData.forEach(item => {
                if (item.forceModified) {
                    setFileMode(item, 'auto');
                    count++;
                }
            });
            if (count > 0) {
                showToast(`已清空 ${count} 个被强制标记的文件`);
                btnClearForceModify.style.display = 'none';
                refreshSvnStatus(true); // 重新根据SVN状态刷新
            }
        };
    }

    // 右键菜单项点击
    document.querySelectorAll('#contextMenu .menu-item').forEach(item => {
        item.addEventListener('click', () => {
            if (item.classList.contains('has-submenu')) return; // 防止点击含有子菜单的父级触发
            triggerMenu(item.dataset.action);
        });
    });

    // SVN 提交列表右键菜单项点击
    document.querySelectorAll('#svnContextMenu .menu-item').forEach(item => {
        item.addEventListener('click', async () => {
            const action = item.dataset.action;
            if (action === 'svn_revert_selected') {
                const checkedItems = svnModalData.filter(i => i.checked);
                if (checkedItems.length === 0) {
                    showToast('没有选中的文件可还原');
                    return;
                }
                const pathsStr = checkedItems.map(i => i.path).join('*');
                await window.electronAPI.tortoiseProc('revert', pathsStr);
                setTimeout(() => showSubmitModal(), 500);
                return;
            }

            if (!currentSvnContextPath) return;
            if (action === 'svn_revert') {
                await window.electronAPI.tortoiseProc('revert', currentSvnContextPath);
                // 给SVN一点时间去还原
                setTimeout(() => showSubmitModal(), 500); 
            } else if (action === 'svn_log') {
                await window.electronAPI.tortoiseProc('log', currentSvnContextPath);
            } else if (action === 'svn_open_dir') {
                const dirPath = await window.electronAPI.pathDirname(currentSvnContextPath);
                await window.electronAPI.openExplorer(currentSvnContextPath);
            }
        });
    });

    // 提交流程
    document.getElementById('btnSubmit').onclick = showSubmitModal;
    document.getElementById('btnCancelSubmit').onclick = () => { document.getElementById('submitModal').style.display = 'none'; };
    document.getElementById('btnConfirmSubmit').onclick = doSvnCommit;

    // 创建快捷方式
    document.getElementById('btnCreateShortcut').onclick = async () => {
        const res = await window.electronAPI.createShortcut();
        if (res.success) {
            addLog('✅ 桌面快捷方式创建成功！你现在可以去桌面右键该快捷方式，选择【固定到任务栏】。');
            showToast('✅ 快捷方式创建成功！');
            checkShortcutVisibility();
        } else {
            showToast('❌ 快捷方式创建失败：' + res.error);
        }
    };

    // 配置/版本弹窗按钮
    document.getElementById('btnSettings').onclick = document.getElementById('btnSwitchVersion').onclick = () => { 
        // 每次打开弹窗前，重新从本地存储读取以丢弃未保存的修改
        versions = JSON.parse(localStorage.getItem('versions') || '[]');
        editingVersionId = currentVersionId;
        renderVersionList();
        loadVersionToForm(editingVersionId);
        document.getElementById('versionModal').style.display = 'flex'; 
    };
    const btnCancel = document.getElementById('btnCancelVersion');
    if (btnCancel) {
        btnCancel.onclick = () => { document.getElementById('versionModal').style.display = 'none'; };
    }
    
    // 如果存在新的右上角关闭按钮，也绑定事件
    const btnCancelTop = document.getElementById('btnCancelVersionTop');
    if (btnCancelTop) {
        btnCancelTop.onclick = () => { document.getElementById('versionModal').style.display = 'none'; };
    }

    document.getElementById('btnSaveSettings').onclick = () => {
    if (!window.confirm('确认要保存对当前配置的修改吗？')) return;
    // 保存当前正在编辑的表单到当前选中的版本对象中
    saveFormToVersion(editingVersionId);
    
    // 校验必填项
    const editingV = versions.find(x => x.id === editingVersionId);
    if (!editingV.name || !editingV.designRootPath || !editingV.toolRootPath || !editingV.targetBatName) {
        showToast('请将带有红色星号的必填项填写完整！');
        return;
    }
    
    localStorage.setItem('versions', JSON.stringify(versions));
    renderVersionList(); // 刷新左侧列表的名字
    showToast('配置保存成功！');
    addLog(`>>> 已保存版本修改：${editingV.name}`);
};

document.getElementById('btnApplyVersion').onclick = async () => {
    const targetV = versions.find(x => x.id === editingVersionId);
    if (!targetV || !targetV.name || !targetV.designRootPath || !targetV.toolRootPath || !targetV.targetBatName) {
        showToast('目标版本配置不完整，请先保存配置！');
        return;
    }

    currentVersionId = targetV.id;
    currentVersion = targetV;
    
    localStorage.setItem('currentVersionId', currentVersionId);
    
    document.getElementById('versionModal').style.display = 'none';
    addLog(`>>> 已切换至版本：${currentVersion.name}`);
    showToast(`已切换至：${currentVersion.name}`);
    
    // 更新全局 userConfig 并重新加载
    userConfig = await getFullUserConfig(currentVersion);
    document.getElementById('btnSwitchVersion').innerText = `版本：${userConfig.name || '未命名'}`;
    document.title = `一站式导表工具 - [${userConfig.name || '未命名'}]`;
    
    // 清理旧状态并重新加载
    appData = [];
    document.getElementById('tableGridContainer').innerHTML = '';
    loadConfigAndStatus();
};
    
    // 版本弹窗中的按钮
    document.getElementById('btnAddVersion').onclick = () => {
        const newId = 'v_' + Date.now();
        versions.push({ id: newId, name: '新版本', designRootPath: '', toolRootPath: '', targetBatName: 'toClientPy1.bat' });
        editingVersionId = newId;
        renderVersionList();
        loadVersionToForm(editingVersionId);
        showToast('已创建新版本，请填写并保存配置');
    };
    document.getElementById('btnDeleteVersion').onclick = () => {
        if (versions.length <= 1) {
            showToast('至少需要保留一个版本！');
            return;
        }
        if (!window.confirm('警告：确定要删除当前选中的版本吗？此操作不可恢复！')) return;
        
        versions = versions.filter(v => v.id !== editingVersionId);
        editingVersionId = versions[0].id;
        renderVersionList();
        loadVersionToForm(editingVersionId);
    };

    // 输入框修改时更新只读推导路径
    const updateDerived = async () => {
        const dRoot = document.getElementById('inputDesignRootPath').value;
        const tRoot = document.getElementById('inputToolRootPath').value;
        const derived = await getDerivedPaths(dRoot, tRoot);
        document.getElementById('lblConfigXml').innerText = derived.configXmlPath || '-';
        document.getElementById('lblToPath').innerText = derived.toPath || '-';
        document.getElementById('lblLuaPath').innerText = derived.luaPath || '-';
        document.getElementById('lblXmlPath').innerText = derived.xmlPath || '-';
    };
    document.getElementById('inputDesignRootPath').addEventListener('input', updateDerived);
    document.getElementById('inputToolRootPath').addEventListener('input', updateDerived);
    
    // 版本名称输入实时更新列表
    document.getElementById('inputVersionName').addEventListener('input', (e) => {
        const v = versions.find(x => x.id === editingVersionId);
        if (v) {
            v.name = e.target.value;
            renderVersionList();
        }
    });

    // 原生路径选择绑定
    document.getElementById('btnBrowseDesignRootPath').onclick = async () => {
        const currentPath = document.getElementById('inputDesignRootPath').value;
        const res = await window.electronAPI.selectDirectory(currentPath);
        if(res) { document.getElementById('inputDesignRootPath').value = res; updateDerived(); }
    };
    document.getElementById('btnBrowseToolRootPath').onclick = async () => {
        const currentPath = document.getElementById('inputToolRootPath').value;
        const res = await window.electronAPI.selectDirectory(currentPath);
        if(res) { document.getElementById('inputToolRootPath').value = res; updateDerived(); }
    };

    document.getElementById('btnRecheckEnvironment').onclick = async () => {
        if ((await checkEnvironment()).success) { showToast('SVN 命令行工具已就绪'); await refreshSvnStatus(); }
    };
    document.getElementById('btnSvnSetup').onclick = openSvnSetup;
    document.getElementById('btnCloseSvnSetup').onclick = () => document.getElementById('svnSetupDialog').close();
    document.getElementById('btnRecheckSvnSetup').onclick = document.getElementById('btnRecheckEnvironment').onclick;
    document.getElementById('btnCloseExportError').onclick = () => { document.getElementById('exportResult').hidden = true; document.getElementById('btnShowExportError').focus(); };
    document.getElementById('btnCloseRuntimeError').onclick = () => document.getElementById('runtimeErrorDialog').close();
    document.getElementById('btnRuntimeErrorLogs').onclick = () => {
        document.getElementById('runtimeErrorDialog').close();
        document.getElementById('exportResult').hidden = false;
        document.querySelector('#exportResult details').open = true;
    };
    document.getElementById('btnCopyRuntimeError').onclick = () => document.getElementById('btnCopyExportError').click();
    document.getElementById('btnShowExportError').onclick = () => { document.getElementById('exportResult').hidden = false; };
    document.getElementById('btnOpenErrorExcel').onclick = async () => {
        const d = lastExportFailure?.diagnosis;
        if (!d?.input) return;
        const res = await window.electronAPI.openExcel(d.excelPath, d.sheet);
        if (!res.success || res.warning) showToast(res.error || res.warning);
        else showToast(d.sheet ? '已定位页签：' + d.sheet : '已打开 Excel');
    };
    document.getElementById('btnCopyExportError').onclick = async () => {
        try { await navigator.clipboard.writeText('版本：' + currentVersion.name + '\n' +
            document.getElementById('exportResultSummary').textContent + '\n' +
            [...document.querySelectorAll('#exportErrorLocation dt')].map(dt => dt.textContent + '：' + dt.nextElementSibling.textContent).join('\n') + '\n' +
            document.getElementById('exportErrorPath').textContent + '\n相关日志：\n' +
            document.getElementById('exportResultDetails').textContent + '\n运行日志（最多最近 2000 条）：\n' + exportLogLines.join('\n')); showToast('错误信息已复制'); }
        catch { showToast('复制失败，请展开详细日志手动复制。'); }
    };
    window.electronAPI.onBatLog(data => {
        const raw = String(data.msg || '');
        exportLogLines.push(raw);
        if (exportLogLines.length > 2000) exportLogLines.shift();
        if (data.type === 'debug') {
            return; // Retained in copied diagnostics; keep internal runner details out of the live log.
        } else {
            addLog('<span class="' + (['error', 'fatal_error'].includes(data.type) ? 'log-error' : 'log-sys') + '">' + escapeHtml(raw) + '</span>');
        }
    });
}

// ============== 核心功能实现 ==============

window.openExcelGroup = async function(fileName, e, sheetName) {
    if (e) e.stopPropagation();
    const fullPath = userConfig.designRootPath + '\\..\\数据填表\\' + fileName;
    showToast(`正在拉起 Excel...`);
    addLog(`执行: 打开文件 ${fullPath}${sheetName ? ' [Sheet: ' + sheetName + ']' : ''}`);
    const res = await window.electronAPI.openExcel(fullPath, sheetName);
    if (!res.success || res.warning) {
        const message = res.error || res.warning;
        showToast(message);
        addLog('<span class="log-error">' + escapeHtml(message) + '</span>');
    } else if (sheetName) showToast('已定位 Sheet：' + sheetName);
};

// 切换强制增量状态（Excel 卡片左侧勾选框共用逻辑）
// mode: 'excelGroup' | 'sheet'
// items: 同一 Excel 文件下的所有 sheet 条目（一个或多个）
// displayName: 用于 toast 显示的名称
window.toggleForceIncrement = function(displayMode, items, displayName) {
    if (!items || items.length === 0) return;

    const mode = nextMode(items[0].exportMode);
    setFileMode(items[0], mode);
    showToast(displayName + '：' + modeLabel(mode) + '（整个 Excel 文件）');
};

window.triggerMenu = async function(action) {
    if (!currentContextItem) return;
    
    const excelFullPath = userConfig.designRootPath + '\\..\\数据填表\\' + currentContextItem.input;
    const luaFullPath = userConfig.luaPath + '\\' + currentContextItem.outlua.replace('lua\\', '');
    const xmlFullPath = userConfig.xmlPath + '\\' + currentContextItem.output.replace('xml\\', '');

    if (action === 'svn_log') {
        showToast('正在打开 SVN 日志...');
        await window.electronAPI.tortoiseProc('log', excelFullPath);
    } else if (action === 'svn_revert') {
        showToast('正在还原文件...');
        await window.electronAPI.tortoiseProc('revert', excelFullPath);
        setTimeout(() => refreshSvnStatus(false), 500); // 刷新状态
    } else if (['force_modify', 'exclude_export', 'cancel_force_modify'].includes(action)) {
        const mode = action === 'force_modify' ? 'include' : action === 'exclude_export' ? 'exclude' : 'auto';
        setFileMode(currentContextItem, mode);
        showToast(currentContextItem.zh + '：' + modeLabel(mode));
    } else if (action === 'open_excel') {
        await openExcelGroup(currentContextItem.input, null, currentDisplayMode === 'sheet' ? currentContextItem.sheet : undefined);
    } else if (action === 'dir_excel') {
        await window.electronAPI.openExplorer(excelFullPath);
    } else if (action === 'dir_lua') {
        await window.electronAPI.openExplorer(luaFullPath);
    } else if (action === 'dir_xml') {
        await window.electronAPI.openExplorer(xmlFullPath);
    }
}

async function runExport(selectTarget) {
    // ===== 1. 快速连点节流（防止 800ms 内连点多次）
    const now = Date.now();
    if (now - lastExportClickAt < EXPORT_CLICK_COOLDOWN) {
        showToast('点击太快了，请稍候再试');
        return;
    }
    lastExportClickAt = now;

    // ===== 2. 互斥锁：全量 / 增量 同时只能有一个在执行
    if (isExportRunning) {
        showToast('当前已有导表任务在执行，请稍候…');
        addLog('<span style="color:#e67e22">拦截：上一次导表任务还未结束，忽略本次点击。</span>');
        return;
    }
    document.getElementById('exportResult').hidden = true;
    document.getElementById('btnShowExportError').hidden = true;
    document.querySelector('#exportResult details').open = false;
    exportLogLines = [];
    isExportRunning = true;
    setExportButtonsBusy(true);

    const isAll = selectTarget === '-1';
    addLog(`>>> 触发导表 [${isAll ? '全量' : '一键增量'}]`);
    if (!isAll && selectTarget) {
        addLog(`>>> 增量目标: ${selectTarget}`);
    }
    showToast('正在执行导表脚本...');
    
    const startTime = Date.now();
    
    const args = {
        commitSvn: '0',
        toPath: userConfig.toPath,
        toolRootPath: userConfig.toolRootPath,
        targetBatName: userConfig.targetBatName,
        configXmlPath: userConfig.configXmlPath,
        luaPath: userConfig.luaPath,
        xmlPath: userConfig.xmlPath,
        designRootPath: userConfig.designRootPath,
        toExportDesignPath: userConfig.toExportDesignPath,
        selectTarget: selectTarget
    };

    let res = { success: false, code: -1 };
    try {
        res = await window.electronAPI.runExportBat(args);
    } catch (err) {
        addLog(`<span class="log-error">导表调用异常: ${escapeHtml(err && err.message ? err.message : err)}</span>`);
        res = { success: false, error: err.message || String(err) };
    } finally {
        const endTime = Date.now();
        const costSeconds = Math.max(0, Math.round((endTime - startTime) / 1000));

        if (res.success) {
            addLog(`<<< 导表完成。耗时: ${costSeconds} 秒`);
            showToast('导表成功！');
            
            // 保留用户选择，刷新仅更新 SVN 的真实状态。
            refreshSvnStatus(true).catch(() => {});
        } else {
            showExportFailure(res, costSeconds);
            if (res.code === 'SVN_MISSING') checkEnvironment().catch(() => {});
            showToast('导表未完成，请查看错误摘要。');
        }

        // ===== 3. 无论成功失败，都释放互斥锁、恢复按钮
        isExportRunning = false;
        setExportButtonsBusy(false);
    }
}

let svnModalData = []; // 存储 SVN 弹窗数据

const svnDirConfigs = [
    { id: 'excel', label: '📊 Excel 表格', color: '#FF9800', getPath: () => userConfig.designRootPath ? userConfig.designRootPath + '\\..\\数据填表' : '' },
    { id: 'lua', label: '📜 Lua 脚本', color: '#2196F3', getPath: () => userConfig.luaPath },
    { id: 'xml', label: '📄 XML 配置', color: '#4CAF50', getPath: () => userConfig.xmlPath },
    { id: 'client', label: '🎮 客户端 Data', color: '#9C27B0', getPath: () => userConfig.toPath },
    { id: 'win32', label: '🖥️ Win32 Data', color: '#00BCD4', getPath: () => userConfig.toExportDesignPath }
];

window.showSubmitModal = async function() {
    document.getElementById('submitModal').style.display = 'flex';
    const list = document.getElementById('submitFileList');
    list.innerHTML = '<div style="padding: 20px; color:#666;">正在扫描所有目录的 SVN 变更...</div>';
    
    // 初始化状态
    document.getElementById('svnSearchInput').value = '';
    document.getElementById('svnStatusFilter').value = 'ALL';
    svnModalData = [];
    updateSvnSummaryText();
    
    const dirsToCheck = svnDirConfigs.map(c => ({ id: c.id, path: c.getPath() }));
    const res = await window.electronAPI.getAllSvnChanges(dirsToCheck);
    
    if (!res.success) {
        list.innerHTML = '<div class="log-error" style="padding:20px">扫描失败：' + escapeHtml(res.error) + '</div>';
        return;
    }
    if (!res.data || res.data.length === 0) {
        list.innerHTML = '<div style="padding: 20px; color:#666;">当前没有检测到任何被修改的文件。</div>';
        return;
    }

    // 建立文件名到 Excel 路径的映射
    const fileToExcelMap = {};
    appData.forEach(item => {
        const excelInput = item.input; // 包含了相对路径，如 ziliaopian\资料片绘卷.xlsx
        if (item.outlua && item.outlua !== '--') {
            fileToExcelMap[item.outlua.split(/[\/\\]/).pop().toLowerCase()] = excelInput;
        }
        if (item.output && item.output !== '--') {
            fileToExcelMap[item.output.split(/[\/\\]/).pop().toLowerCase()] = excelInput;
        }
    });

    const uniqueFiles = [];
    const seen = new Set();
    const excelDirPath = svnDirConfigs.find(c => c.id === 'excel').getPath();

    res.data.forEach(item => {
        if(!seen.has(item.path)) {
            seen.add(item.path);
            const categoryId = item.categoryId || 'unknown';

            // 计算分组归属
            let groupId = null;
            let groupType = 'other';
            
            if (categoryId === 'excel') {
                // 将 Excel 表自身作为组 ID (包含相对路径)
                groupId = item.name; // 暂存，如果有相对路径我们需要用相对路径，但为了统一，先用 input 名对比
                
                // 优先从相对路径推导（解决子目录问题，例如 ziliaopian\xxx.xlsx）
                if (excelDirPath && item.path.toLowerCase().startsWith(excelDirPath.toLowerCase())) {
                    // 截取掉基础路径，剩下的就是包含子目录的相对路径
                    const relativePath = item.path.substring(excelDirPath.length + 1);
                    groupId = relativePath;
                } else {
                    // 尝试从 appData 中找到它真正的 input 名称（包含相对路径，如 a\b.xlsx）
                    const matchedExcel = appData.find(cfg => cfg.input.split(/[\/\\]/).pop().toLowerCase() === item.name.toLowerCase());
                    if (matchedExcel) {
                        groupId = matchedExcel.input;
                    }
                }
                groupType = 'excelTree';
            } else {
                let nameLower = item.name.toLowerCase();
                
                // 兼容由于过大被分割的产物文件 (如 _next1, _next2 等后缀)，将其剥离以便正确匹配到原 Excel
                nameLower = nameLower.replace(/_next\d+(\.[^.]+)$/i, '$1');

                if (fileToExcelMap[nameLower]) {
                    groupId = fileToExcelMap[nameLower];
                    groupType = 'excelTree';
                } else {
                    groupId = categoryId;
                    groupType = 'other';
                }
            }
            item.groupId = groupId;
            item.groupType = groupType;
            item.checked = true; // 默认全选
            uniqueFiles.push(item);
        }
    });

    svnModalData = uniqueFiles;
    renderSvnModalList();
}

function renderSvnModalList() {
    const list = document.getElementById('submitFileList');
    list.innerHTML = '';
    
    const searchText = document.getElementById('svnSearchInput').value.toLowerCase();
    const statusFilter = document.getElementById('svnStatusFilter').value;
    
    const filteredData = svnModalData.filter(item => {
        const matchSearch = item.name.toLowerCase().includes(searchText) || item.path.toLowerCase().includes(searchText);
        const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
        return matchSearch && matchStatus;
    });

    if (filteredData.length === 0) {
        list.innerHTML = '<div style="padding: 20px; color:#666;">没有匹配的文件。</div>';
        updateSvnSummaryText();
        return;
    }

    // 分组
    const groups = {};
    filteredData.forEach(item => {
        const gid = item.groupId;
        if (!groups[gid]) {
            if (item.groupType === 'excelTree') {
                groups[gid] = {
                    id: gid,
                    type: 'excelTree',
                    // 如果 gid 包含路径（例如 ziliaopian\资料片绘卷.xlsx），保留完整显示以便区分
                    label: '📊 ' + gid,
                    color: '#FF9800',
                    items: []
                };
            } else {
                const cfg = svnDirConfigs.find(c => c.id === gid) || { id: 'unknown', label: '❓ 其他文件', color: '#95a5a6' };
                groups[gid] = {
                    id: gid,
                    type: 'other',
                    label: cfg.label + ' (未关联Excel)',
                    color: cfg.color,
                    items: []
                };
            }
        }
        groups[gid].items.push(item);
    });

    Object.values(groups).forEach(group => {
        if (group.items.length === 0) return;
        
        const isAllChecked = group.items.every(i => i.checked);
        const groupEl = document.createElement('div');
        groupEl.className = 'svn-group';
        
        // 组标题
        const header = document.createElement('div');
        header.className = 'svn-group-header';
        header.innerHTML = `
            <div class="checkbox group-checkbox ${isAllChecked ? 'checked' : ''}" onclick="event.stopPropagation(); toggleGroupCheck('${group.id.replace(/\\/g, '\\\\')}')"></div>
            <div class="svn-group-title" onclick="toggleGroupCollapse(this)">
                <span class="tag-badge" style="background-color: ${group.color};">${group.label}</span>
                <span class="svn-group-count">(${group.items.length} 个文件)</span>
            </div>
            <div class="svn-group-toggle" onclick="toggleGroupCollapse(this)">▼</div>
        `;
        groupEl.appendChild(header);
        
        // 组内容
        const content = document.createElement('div');
        content.className = 'svn-group-content';
        
        group.items.sort((a, b) => {
            if (a.categoryId === 'excel' && b.categoryId !== 'excel') return -1;
            if (a.categoryId !== 'excel' && b.categoryId === 'excel') return 1;
            return a.name.localeCompare(b.name);
        }).forEach(item => {
            let statusBadge = '';
            if (item.status === 'M') statusBadge = '<span class="status-badge status-M" title="修改 (Modified)">M</span>';
            else if (item.status === 'A') statusBadge = '<span class="status-badge status-A" title="新增 (Added)">A</span>';
            else if (item.status === 'D') statusBadge = '<span class="status-badge status-D" title="删除 (Deleted)">D</span>';
            else statusBadge = `<span class="status-badge status-Q" title="未受控">${item.status}</span>`;
            
            let typeLabel = '';
            if (group.type === 'excelTree') {
                const cfg = svnDirConfigs.find(c => c.id === item.categoryId);
                if (cfg) {
                    typeLabel = `<span style="font-size:12px; color:${cfg.color}; border:1px solid ${cfg.color}; padding:0 4px; border-radius:3px; margin-right:6px;">${cfg.id.toUpperCase()}</span>`;
                }
            }

            const itemEl = document.createElement('div');
            itemEl.className = 'file-item';
            itemEl.dataset.path = item.path;
            itemEl.title = item.path; // 移除了双击提示
            itemEl.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showSvnContextMenu(e, item.path);
            };
            
            itemEl.innerHTML = `
                <div class="checkbox ${item.checked ? 'checked' : ''}" onclick="event.stopPropagation(); toggleItemCheck('${item.path.replace(/\\/g, '\\\\')}')"></div>
                ${statusBadge}
                <div class="file-name" style="margin-left: 10px;">
                    ${typeLabel}${item.name}
                    <span class="file-path-sub">${item.path}</span>
                </div>
                <div class="compare-btn" onclick="event.stopPropagation(); compareFile('${item.path.replace(/\\/g, '\\\\')}')">对比</div>
            `;
            content.appendChild(itemEl);
        });
        
        groupEl.appendChild(content);
        list.appendChild(groupEl);
    });
    
    updateSvnSummaryText();
}

window.toggleGroupCollapse = function(el) {
    const group = el.closest('.svn-group');
    group.classList.toggle('collapsed');
}

window.toggleGroupCheck = function(groupId) {
    const groupItems = svnModalData.filter(i => i.groupId === groupId);
    const isAllChecked = groupItems.every(i => i.checked);
    groupItems.forEach(i => i.checked = !isAllChecked);
    renderSvnModalList();
}

window.toggleItemCheck = function(path) {
    const item = svnModalData.find(i => i.path === path);
    if (item) {
        item.checked = !item.checked;
        renderSvnModalList();
    }
}

function updateSvnSummaryText() {
    const checkedItems = svnModalData.filter(i => i.checked);
    const textEl = document.getElementById('svnSummaryText');
    if (checkedItems.length > 0) {
        const dirSet = new Set(checkedItems.map(i => i.categoryId));
        textEl.innerText = `📦 本次将提交 ${dirSet.size} 个分类下的 ${checkedItems.length} 个文件`;
        textEl.style.color = '#27ae60';
    } else {
        textEl.innerText = '⚠️ 未勾选任何要提交的文件';
        textEl.style.color = '#e74c3c';
    }
}

// 绑定搜索与过滤事件
document.getElementById('svnSearchInput').addEventListener('input', renderSvnModalList);
document.getElementById('svnStatusFilter').addEventListener('change', renderSvnModalList);

document.getElementById('btnSvnExpandAll').addEventListener('click', () => {
    document.querySelectorAll('.svn-group').forEach(g => g.classList.remove('collapsed'));
});
document.getElementById('btnSvnCollapseAll').addEventListener('click', () => {
    document.querySelectorAll('.svn-group').forEach(g => g.classList.add('collapsed'));
});

document.getElementById('btnSvnSelectAll').addEventListener('click', () => {
    const searchText = document.getElementById('svnSearchInput').value.toLowerCase();
    const statusFilter = document.getElementById('svnStatusFilter').value;
    svnModalData.forEach(item => {
        const matchSearch = item.name.toLowerCase().includes(searchText) || item.path.toLowerCase().includes(searchText);
        const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
        if (matchSearch && matchStatus) item.checked = true;
    });
    renderSvnModalList();
});

document.getElementById('btnSvnDeselectAll').addEventListener('click', () => {
    const searchText = document.getElementById('svnSearchInput').value.toLowerCase();
    const statusFilter = document.getElementById('svnStatusFilter').value;
    svnModalData.forEach(item => {
        const matchSearch = item.name.toLowerCase().includes(searchText) || item.path.toLowerCase().includes(searchText);
        const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
        if (matchSearch && matchStatus) item.checked = false;
    });
    renderSvnModalList();
});

window.compareFile = async function(filePath) {
    showToast('正在拉起 TortoiseProc 对比...');
    await window.electronAPI.tortoiseProc('diff', filePath);
}

async function doSvnCommit() {
    const remark = document.getElementById('submitRemark').value;
    if(!remark.trim()) {
        showToast('错误：必须填写 SVN 提交日志说明！');
        return;
    }
    
    const checkedItems = svnModalData.filter(i => i.checked);
    if (checkedItems.length === 0) {
        showToast('请至少勾选一个文件进行提交！');
        return;
    }

    document.getElementById('submitModal').style.display = 'none';
    
    // 如果填写了日志，则传递给 main.js 的 tortoiseProc 写入临时文件并自动附带
    let logMsg = remark.trim() || '';
    
    addLog(`>>> 开始执行 SVN 提交，备注: [${logMsg || '无'}]`);
    
    const pathsStr = checkedItems.map(i => i.path).join('*');
    await window.electronAPI.tortoiseProc('commit', pathsStr, logMsg);
    
    showToast('已唤起提交流程');
    document.getElementById('submitRemark').value = '';
}

function renderVersionList() {
    const container = document.getElementById('versionListContainer');
    container.innerHTML = '';
    versions.forEach(v => {
        const div = document.createElement('div');
        div.className = `version-item ${v.id === editingVersionId ? 'active' : ''}`;
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = v.name || '未命名';
        div.appendChild(nameSpan);

        if (v.id === currentVersionId) {
            const curTag = document.createElement('span');
            curTag.innerText = '当前';
            curTag.style.cssText = 'font-size: 12px; background: #27ae60; color: white; padding: 2px 6px; border-radius: 4px;';
            div.appendChild(curTag);
        }

        div.onclick = () => {
            // 保存当前正在编辑的内容
            saveFormToVersion(editingVersionId);
            editingVersionId = v.id;
            renderVersionList();
            loadVersionToForm(editingVersionId);
        };
        container.appendChild(div);
    });
}

function saveFormToVersion(id) {
    const v = versions.find(x => x.id === id);
    if (v) {
        v.name = document.getElementById('inputVersionName').value;
        v.designRootPath = document.getElementById('inputDesignRootPath').value;
        v.toolRootPath = document.getElementById('inputToolRootPath').value;
        v.targetBatName = document.getElementById('inputTargetBatName').value;
    }
}

async function loadVersionToForm(id) {
    const v = versions.find(x => x.id === id);
    if (!v) return;
    document.getElementById('inputVersionName').value = v.name;
    document.getElementById('inputDesignRootPath').value = v.designRootPath;
    document.getElementById('inputToolRootPath').value = v.toolRootPath || '';
    document.getElementById('inputTargetBatName').value = v.targetBatName || 'toClientPy1.bat';
    
    // 触发只读路径更新
    const derived = await getDerivedPaths(v.designRootPath, v.toolRootPath);
    document.getElementById('lblConfigXml').innerText = derived.configXmlPath || '-';
    document.getElementById('lblToPath').innerText = derived.toPath || '-';
    document.getElementById('lblLuaPath').innerText = derived.luaPath || '-';
    document.getElementById('lblXmlPath').innerText = derived.xmlPath || '-';
}

// ============== 工具类 ==============
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.opacity = 1;
    setTimeout(() => { toast.style.opacity = 0; }, 2000);
}

function addLog(msg) {
    const logArea = document.getElementById('logArea');
    
    // 生成当前时间 HH:mm:ss
    const now = new Date();
    const timeStr = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
    
    // 增加时间前缀
    logArea.insertAdjacentHTML('beforeend', `<div style="margin-bottom: 4px;"><span style="color:#888; margin-right:8px;">${timeStr}</span><span class="log-sys">${msg}</span></div>`);
    while (logArea.children.length > 2000) logArea.firstElementChild.remove();
    
    // 自动滚动到最底部
    logArea.scrollTop = logArea.scrollHeight;
}
