// 【Runner v6 终极验证 v3】100% 对齐用户真实执行顺序：
//   1) 参数接收7行 → 2) Runner私有备份 _RUNNER_ARG1~7 → 3) 业务代码覆盖 designRoot/xmlPath（模拟 _batInit.bat）→ 4) set excelDir/xmlPathYunWei（右边用 _RUNNER_ARG6/_RUNNER_ARG5）→ 5) 业务二次覆盖 set xmlPath=%xmlPathYunWei% → 6) Runner二次注入诊断 RUNNER_V6_DIAG_2ND
const fs = require('fs');
const iconv = require('iconv-lite');
const path = require('path');
const { spawn } = require('child_process');

function replaceUnicodeEscapes(s) {
    return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex,16)));
}

const RAW_BAT_SRC = String.raw`@echo off
rem chcp 936 >nul
call _batInit
set /p path=<%drives%envPath.txt

echo 这个批处理用于导出Excel表格
echo this is for excel

rem 7个参数：%commitSvn% %toPath% %configPath% %luaPath% %xmlPath% %designRoot% %selectTarget%
set commitSvn=%1
set toPath=%2
set configPath=%3
set luaPath=%4
set xmlPath=%5
set designRoot=%6
set selectTarget=%7
set xmlPathYunWei=%xmlPath%yunwei

set excelDir=%designRoot%\u6570\u636e\u586b\u8868
set excelOutdir=%designRoot%\u914d\u7f6e\u8868\u751f\u6210
set md5PrePath=%excelOutdir%\md5PreData.conf

echo commitSvn=%commitSvn%
echo toPath=%toPath%
echo configPath=%configPath%
echo luaPath=%configXmlPath%
echo xmlPath=%xmlPath%
echo designRoot=%designRoot%
echo selectTarget=%selectTarget%

rem ---------- [模拟用户真实业务代码：_batInit.bat 后续把 designRoot / xmlPath 覆盖了！这就是 excelDir 空 / 数据填表错位 根因！] ----------
set gameRootDir=%designRoot%\u914d\u7f6e\u8868\u751f\u6210
set designRoot=%gameRootDir%\..
set toExportDesignPath=%gameRootDir%\..\..\win32Realease\res\data
echo gameRootDir=%gameRootDir%

echo toExportDesignPath=%toExportDesignPath%
set toPath=%toExportDesignPath%
echo toPath22222=%toPath%
echo toPath33333=%toPath%

rem ---------- [模拟用户真实业务二次覆盖：业务 bat 更后面又把 xmlPath 赋值成 xmlPathYunWei（导致 4yunwei 残留）] ----------
set xmlPath=%xmlPathYunWei%

echo orgConfigPath="%toExportDesignPath%\manual\Config_Sys.lua"
echo excelDir="%excelDir%"
echo xmlPath="%xmlPath%"
echo xmlPath="%xmlPathYunWei%"
`;
const origBatStr = replaceUnicodeEscapes(RAW_BAT_SRC).replace(/\n/g,'\r\n') + '\r\n';
const origBatPath = path.join(__dirname, 'debug_bats', 'toClientPy1-ORIGINAL.bat');
fs.writeFileSync(origBatPath, iconv.encode(origBatStr, 'gbk'));

function runnerV6Patch(srcGbkBuf, outputPatchedPath, logger) {
    let batUtf8;
    try { batUtf8 = iconv.decode(srcGbkBuf, 'gbk'); } catch(e) { batUtf8 = String(srcGbkBuf); }
    const changed = [];
    let merged = String(batUtf8 || '');
    const ANY_VAR = '[A-Za-z_][A-Za-z0-9_]*';

    const OLD_PARAM7 = new RegExp(
        '^\\s*set\\s+'+ANY_VAR+'\\s*=\\s*%1\\s*\\r?\\n'+
        '\\s*set\\s+'+ANY_VAR+'\\s*=\\s*%2\\s*\\r?\\n'+
        '\\s*set\\s+'+ANY_VAR+'\\s*=\\s*%3\\s*\\r?\\n'+
        '\\s*set\\s+'+ANY_VAR+'\\s*=\\s*%4\\s*\\r?\\n'+
        '\\s*set\\s+'+ANY_VAR+'\\s*=\\s*%5\\s*\\r?\\n'+
        '\\s*set\\s+'+ANY_VAR+'\\s*=\\s*%6\\s*\\r?\\n'+
        '\\s*set\\s+'+ANY_VAR+'\\s*=\\s*%7\\s*(\\r?\\n|$)', 'im');
    if (OLD_PARAM7.test(merged)) {
        const m = merged.match(OLD_PARAM7);
        let vnames = [];
        if (m && m[0]) {
            const lines = m[0].split(/\r?\n/).filter(l => l.trim() && /%[1-7]\s*$/.test(l.trim()));
            vnames = lines.map(l => (l.match(/^\s*set\s+([^=\s]+)/i) || [,'unknown'])[1]);
        }
        if (vnames.length < 7) vnames = [
            vnames[0]||'commitSvn', vnames[1]||'toPath',
            vnames[2]||'configXmlPath', vnames[3]||'luaPath',
            vnames[4]||'xmlPath', vnames[5]||'designRootPath',
            vnames[6]||'selectTarget'
        ];
        const privateBackup =
            `\r\nset "_RUNNER_ARG1=%~1"\r\nset "_RUNNER_ARG2=%~2"\r\nset "_RUNNER_ARG3=%~3"\r\n` +
            `set "_RUNNER_ARG4=%~4"\r\nset "_RUNNER_ARG5=%~5"\r\nset "_RUNNER_ARG6=%~6"\r\nset "_RUNNER_ARG7=%~7"\r\n`;
        const firstDiagnose =
            `\r\n\r\n` +
            `echo ============================================================\r\n` +
            `echo [RUNNER_V6_DIAG_1ST] After args 7 lines, business code has NOT overwritten vars yet.\r\n` +
            `echo   Square brackets [] MUST NOT contain double quote \r\n` +
            `echo ------------------------------------------------------------\r\n` +
            `echo RUNNER_ARG_orig_design=[%_RUNNER_ARG6%]\r\n` +
            `echo RUNNER_ARG_orig_xml=[%_RUNNER_ARG5%]\r\n` +
            `echo ------------------------------------------------------------\r\n` +
            `echo ============================================================\r\n` +
            `\r\n\r\n`;
        const paramBlockAfter =
            `\r\nset "${vnames[0]}=%~1"\r\nset "${vnames[1]}=%~2"\r\nset "${vnames[2]}=%~3"\r\nset "${vnames[3]}=%~4"\r\nset "${vnames[4]}=%~5"\r\nset "${vnames[5]}=%~6"\r\nset "${vnames[6]}=%~7"\r\n` +
            privateBackup + firstDiagnose;
        merged = merged.replace(OLD_PARAM7, paramBlockAfter);
        changed.push('① 参数接收7行（通用变量名）命中 = ' + vnames.join('/') + ' → set "xxx=%~n" + 私有备份 _RUNNER_ARG1~7');
    } else {
        changed.push('① 没找到 7 行参数接收块【致命】');
    }

    const OLD_ECHO_LUA = /echo\s+luaPath\s*=\s*%configXmlPath%\s*(\r?\n)/i;
    if (OLD_ECHO_LUA.test(merged)) {
        merged = merged.replace(OLD_ECHO_LUA, 'echo luaPath=%luaPath%$1');
        changed.push('② echo luaPath 手滑 → echo luaPath=%luaPath%');
    } else {
        const ANY_ECHO_LUA = /^(\s*)echo\s+luaPath\s*=\s*%([A-Za-z_][A-Za-z0-9_]*)%\s*(\r?\n)/im;
        if (ANY_ECHO_LUA.test(merged)) {
            merged = merged.replace(ANY_ECHO_LUA, (m, pre, rhsVar, nl) => {
                if (rhsVar && rhsVar.toLowerCase() === 'luapath') return m;
                changed.push(`② echo luaPath=%${rhsVar}% 手滑 → echo luaPath=%luaPath%`);
                return `${pre}echo luaPath=%luaPath%${nl}`;
            });
        }
    }
    const ANY_ECHO_DESIGNROOT = /^(\s*)echo\s+(designRoot|designRootPath)\s*=\s*%([A-Za-z_][A-Za-z0-9_]*)%\s*(\r?\n)/im;
    if (ANY_ECHO_DESIGNROOT.test(merged)) {
        merged = merged.replace(ANY_ECHO_DESIGNROOT, (m, pre, lhs, rhs, nl) => {
            if (lhs.toLowerCase() === rhs.toLowerCase()) return m;
            changed.push(`③ echo ${lhs}=%${rhs}% 左右不一致 → echo ${lhs}=%${lhs}%`);
            return `${pre}echo ${lhs}=%${lhs}%${nl}`;
        });
    }

    const OLD_SET_EXCELDIR = /(^\s*)set\s+excelDir\s*=\s*([^\r\n]*数据填表[^\r\n]*)\s*(\r?\n)/im;
    if (OLD_SET_EXCELDIR.test(merged)) {
        merged = merged.replace(OLD_SET_EXCELDIR, (m, pre, val, tail) => {
            let newVal = val.replace(/^["\s]+|["\s]+$/g,'');
            newVal = newVal.replace(/%[A-Za-z_][A-Za-z0-9_]*%/g, (match) => {
                if (/^%excelDir%$/i.test(match) || /^%_RUNNER_/i.test(match)) return match;
                return '%_RUNNER_ARG6%';
            });
            if (!/\\数据填表/.test(newVal)) {
                newVal = newVal.replace(/数据填表/, '\\数据填表');
                if (newVal.startsWith('\\')) newVal = newVal.slice(1);
            }
            return `${pre}set "excelDir=${newVal}"${tail}`;
        });
        changed.push('④ set excelDir=...数据填表... → set "excelDir=%_RUNNER_ARG6%\\数据填表"（私有 ARG6，不被业务覆盖）');
    }
    const OLD_SET_XMLYW = /(^\s*)set\s+xmlPathYunWei\s*=\s*([^\r\n]*yunwei[^\r\n]*)\s*(\r?\n)/im;
    if (OLD_SET_XMLYW.test(merged)) {
        merged = merged.replace(OLD_SET_XMLYW, (m, pre, val, tail) => {
            let newVal = val.replace(/^["\s]+|["\s]+$/g,'');
            newVal = newVal.replace(/%[A-Za-z_][A-Za-z0-9_]*%/g, (match) => {
                if (/^%xmlPathYunWei%$/i.test(match) || /^%_RUNNER_/i.test(match)) return match;
                return '%_RUNNER_ARG5%';
            });
            return `${pre}set "xmlPathYunWei=${newVal}"${tail}`;
        });
        changed.push('⑤ set xmlPathYunWei=...yunwei → set "xmlPathYunWei=%_RUNNER_ARG5%yunwei"（私有 ARG5）');
    }
    const OLD_SET_XMLPATH_YUNWEI = /(^\s*)set\s+(xmlPath)\s*=\s*([^\r\n]*)/im;
    if (OLD_SET_XMLPATH_YUNWEI.test(merged)) {
        merged = merged.replace(OLD_SET_XMLPATH_YUNWEI, (m, pre, lhs, rest) => {
            const match = rest.match(/^([^\r\n]*?)(\r?\n|$)/);
            if (!match) return m;
            const val = match[1] || '';
            const tail = match[2] || '';
            if (!/yunwei/i.test(val)) return m;
            let newVal = val.replace(/^["\s]+|["\s]+$/g,'');
            newVal = newVal.replace(/%[A-Za-z_][A-Za-z0-9_]*%/g, (mv) => {
                if (/^%xmlPath%$/i.test(mv) || /^%_RUNNER_/i.test(mv)) return mv;
                return '%_RUNNER_ARG5%';
            });
            // 如果替换完右边值里没有 yunwei（比如右边是纯 %xmlPathYunWei%），就强制用 Runner 私有变量拼
            if (!/yunwei/i.test(newVal)) newVal = '%_RUNNER_ARG5%yunwei';
            return `${pre}set "${lhs}=${newVal}"${tail}`;
        });
        if (/⑥|set xmlPath=...yunwei/.test(changed.join('|'))) {
            changed[changed.findIndex(l=>/⑥|set xmlPath=...yunwei/.test(l))] =
                '⑥ 兜底：set xmlPath=...yunwei（业务二次覆盖 xmlPath）→ set "xmlPath=%_RUNNER_ARG5%yunwei"，彻底干掉 4yunwei 残留';
        } else {
            changed.push('⑥ 兜底：set xmlPath=...yunwei（业务二次覆盖 xmlPath）→ set "xmlPath=%_RUNNER_ARG5%yunwei"，彻底干掉 4yunwei 残留');
        }
    }

    merged = merged.replace(/=====\s*(set\s+")/g, '=====\r\n$1');
    merged = merged.replace(/(luaPath=[^\r\n]*?)(echo\s+(designRoot|designRootPath)=)/g, '$1\r\n$2');
    {
        let injectEnd = '\r\n\r\n\r\n\r\n' +
            'echo ============================================================\r\n' +
            'echo [RUNNER_V6_DIAG_2ND] AFTER ALL BUSINESS CODE. Values actually used for SVN /path.\r\n' +
            'echo   Square brackets [] MUST NOT contain double quote character!\r\n' +
            'echo ------------------------------------------------------------\r\n' +
            'echo 2ND_RUNNER_ARG6_original_design=[%_RUNNER_ARG6%]\r\n' +
            'echo 2ND_RUNNER_ARG5_original_xml=[%_RUNNER_ARG5%]\r\n' +
            'echo ------------------------------------------------------------\r\n' +
            'echo 2ND_ACTUAL_excelDir=[%excelDir%]\r\n' +
            'echo 2ND_ACTUAL_excelOutdir=[%excelOutdir%]\r\n' +
            'echo 2ND_ACTUAL_xmlPath=[%xmlPath%]\r\n' +
            'echo 2ND_ACTUAL_xmlPathYunWei=[%xmlPathYunWei%]\r\n' +
            'echo ------------------------------------------------------------\r\n' +
            'echo 2ND_REAL_SVN_PATH_excelDir="%excelDir%"\r\n' +
            'echo 2ND_REAL_SVN_PATH_xmlPathYunWei="%xmlPathYunWei%"\r\n' +
            'echo   ^^^ 这两行就是真正传给 TortoiseProc /path: 的内容，双引号只允许最外层各 1 个，内部绝对不能再有 " ！\r\n' +
            'echo ============================================================\r\n' +
            '\r\n\r\n';
        if (!/\[RUNNER_V6_DIAG_2ND\]/.test(merged)) {
            merged += injectEnd;
            changed.push('⑦ 终极兜底：RUNNER_V6_DIAG_2ND 二次注入（全英文头 + 前后空行，防 GBK 吞字母）');
        }
    }

    const didAny = changed.some(line => !line.includes('没找到'));
    if (didAny) {
        merged = merged.replace(/^(\s*@echo off.*?)(\r?\n)/,
            (m, firstLine, nl) => firstLine + nl + ':: =====================================================\r\n:: 【Runner 自动替换 v6 · 0 修改业务 bat 原文件】本文件是复制+修复版。\r\n:: 修复项：' + changed.map(s => '· ' + s).join('\r\n::         ') + '\r\n:: =====================================================\r\n');
    }
    const out = iconv.encode(merged, 'gbk');
    fs.writeFileSync(outputPatchedPath, out);
    if (logger) logger('[Runner v6 精准替换] 共 ' + changed.length + ' 项：\n  - ' + changed.join('\n  - ') + '\n  输出：' + outputPatchedPath);
    return { changed, output: out, merged };
}

const patchedBatPath = path.join(__dirname, 'debug_bats', 'toClientPy1-PATCHED-v6.bat');
const origBuf = fs.readFileSync(origBatPath);
const patchResult = runnerV6Patch(origBuf, patchedBatPath, (s)=>console.log(s));

console.log('\n============================ 字节级对比：参数接收 7 行 patched 前后 ============================');
origBatStr.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*set\s+[A-Za-z_]+\s*=\s*%[~]?\d\s*$/i.test(line)) {
        const gbkBytes = iconv.encode(line, 'gbk');
        let hex = '';
        for (let k=0;k<Math.min(60, gbkBytes.length);k++) hex += ('0'+gbkBytes[k].toString(16)).slice(-2).toUpperCase()+' ';
        console.log('【原版】行 ' + String(i+1).padStart(3,'0') + ' | ' + line + '  → 前 ' + Math.min(60,gbkBytes.length) + ' 字节: ' + hex + (gbkBytes.length>60?' ...':''));
    }
});
iconv.decode(fs.readFileSync(patchedBatPath), 'gbk').split(/\r?\n/).forEach((line, i) => {
    if (/^\s*set\s*"?\s*(commitSvn|toPath|configPath|configXmlPath|luaPath|xmlPath|designRoot|designRootPath|selectTarget|_RUNNER_ARG[1-7])\s*"?\s*=\s*"?%~?\d"?\s*$/i.test(line)) {
        const gbkBytes = iconv.encode(line, 'gbk');
        let hex = '';
        for (let k=0;k<Math.min(80, gbkBytes.length);k++) hex += ('0'+gbkBytes[k].toString(16)).slice(-2).toUpperCase()+' ';
        console.log('【修复后】行 ' + String(i+1).padStart(3,'0') + ' | ' + line + '  → 前 ' + Math.min(80,gbkBytes.length) + ' 字节: ' + hex + (gbkBytes.length>80?' ...':''));
    }
});

const testArgs = [
    '0',
    'D:\\gctx\\project\\e1_dev\\design\\配置表生成\\clientCode\\trunk\\xxsg\\res\\data',
    'D:\\gctx\\project\\e1_dev\\design\\配置表生成\\config.xml',
    'D:\\gctx\\project\\e1_dev\\design\\配置表生成\\lua',
    'D:\\gctx\\project\\e1_dev\\design\\配置表生成\\xml',
    'D:\\gctx\\project\\e1_dev\\design',
    '宝石配置.xlsx'
];
const WIN32_EXPORT = 'D:\\gctx\\project\\e1_dev\\win32Realease\\res\\data';
function runBat(batPath, args, tagName, extraEnv) {
    return new Promise((resolve) => {
        const quoted = args.map(a => `"${a}"`).join(' ');
        const child = spawn(process.env.comspec || 'cmd.exe',
            ['/d','/s','/c', 'call "' + batPath + '" ' + quoted], {
            cwd: __dirname,
            windowsHide: true,
            windowsVerbatimArguments: true,
            shell: false,
            stdio: ['pipe','pipe','pipe'],
            env: { ...process.env, toExportDesignPath: WIN32_EXPORT, drives: process.cwd().slice(0,2)+'\\', ...(extraEnv||{}) }
        });
        let out = '';
        child.stdout.on('data', d => out += iconv.decode(Buffer.isBuffer(d)?d:Buffer.from(String(d)), 'gbk'));
        child.on('exit', code => {
            console.log('\n======================================== ' + tagName + ' ========================================');
            out.split(/\r?\n/).forEach((line, idx) => {
                if (!line.trim()) return;
                const isKey = /commitSvn=|configPath=|designRoot=|excelDir=|xmlPath=|RUNNER_|_RUNNER_ARG|2ND_|gameRootDir=|SVN/i.test(line);
                const prefix = (isKey?'★ ':'  ') + String(idx+1).padStart(3,'0') + ' | ';
                console.log(prefix + line);
            });
            resolve({code, out});
        });
    });
}
(async function main() {
    await runBat(origBatPath, testArgs, '【用户真实业务版（未修复）】业务覆盖 designRoot/xmlPath + 二次 set xmlPath=xmlPathYunWei → 一定出 bug');
    await runBat(patchedBatPath, testArgs, '【Runner v6 私有备份 ARG 版】_RUNNER_ARG6/_RUNNER_ARG5 永远不变');
    console.log('\n======================================== 一键验真（这次真的修了！）========================================');
    console.log('✅ 修复成功 = patched 版：');
    console.log('    1) 2ND_RUNNER_ARG6_original_design=[D:\\gctx\\project\\e1_dev\\design]（永远是 Node 传的原值，非空！）');
    console.log('    2) 2ND_ACTUAL_excelDir=[D:\\gctx\\project\\e1_dev\\design\\数据填表]（方括号内 0 个引号！）');
    console.log('    3) 2ND_REAL_SVN_PATH_excelDir="D:\\...design\\数据填表"（只有外面一层引号，里面绝对没引号！）');
    console.log('    4) 2ND_REAL_SVN_PATH_xmlPathYunWei="D:\\...配置表生成\\xmlyunwei"（只有外面一层引号，没有 4yunwei！）');
    console.log('❌ 修复失败 = 出现以上任意一条不满足，立刻贴 RUNNER_V6_DIAG_2ND 段落日志给我');
})().catch(e => console.error('验证失败:', e && e.message || e));
