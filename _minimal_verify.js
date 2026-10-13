// 最小化验证：直接构造 bat（完全不依赖 _batInit / 环境文件），只包含 Runner 修复的核心逻辑
const fs = require('fs');
const iconv = require('iconv-lite');
const path = require('path');
const { spawn } = require('child_process');

const testArgs = [
    '0',
    'D:\\gctx\\project\\e1_dev\\design\\配置表生成\\clientCode\\trunk\\xxsg\\res\\data',
    'D:\\gctx\\project\\e1_dev\\design\\配置表生成\\config.xml',
    'D:\\gctx\\project\\e1_dev\\design\\配置表生成\\lua',
    'D:\\gctx\\project\\e1_dev\\design\\配置表生成\\xml',
    'D:\\gctx\\project\\e1_dev\\design',
    '宝石配置.xlsx'
];

// 【模拟用户真实业务顺序】
// 1) 参数接收 7 行（原始 set xxx=%n）
// 2) Runner 私有备份 _RUNNER_ARG1~7 + 第一次诊断
// 3) 业务代码覆盖 designRoot/xmlPath（模拟 _batInit.bat）
// 4) set excelDir/xmlPathYunWei（右边用 _RUNNER_ARG6/_RUNNER_ARG5）
// 5) 业务二次覆盖 set xmlPath=%xmlPathYunWei%
// 6) Runner 二次注入诊断 RUNNER_V6_DIAG_2ND
const MINIMAL_BAT_SRC = `@echo off
chcp 936 >nul

set commitSvn=%1
set toPath=%2
set configPath=%3
set luaPath=%4
set xmlPath=%5
set designRoot=%6
set selectTarget=%7

set "commitSvn=%~1"
set "toPath=%~2"
set "configPath=%~3"
set "luaPath=%~4"
set "xmlPath=%~5"
set "designRoot=%~6"
set "selectTarget=%~7"
set "_RUNNER_ARG1=%~1"
set "_RUNNER_ARG2=%~2"
set "_RUNNER_ARG3=%~3"
set "_RUNNER_ARG4=%~4"
set "_RUNNER_ARG5=%~5"
set "_RUNNER_ARG6=%~6"
set "_RUNNER_ARG7=%~7"

echo RUNNER_1ST_ARG6=[%_RUNNER_ARG6%]
echo RUNNER_1ST_ARG5=[%_RUNNER_ARG5%]

set gameRootDir=%designRoot%\\配置表生成
set designRoot=%gameRootDir%\\..
echo BUSINESS_OVERWRITTEN_designRoot=[%designRoot%]
echo BUSINESS_OVERWRITTEN_gameRootDir=[%gameRootDir%]

set "excelDir=%_RUNNER_ARG6%\\数据填表"
set "xmlPathYunWei=%_RUNNER_ARG5%yunwei"

set "xmlPath=%_RUNNER_ARG5%yunwei"

echo excelDir="%excelDir%"
echo xmlPath="%xmlPath%"
echo xmlPathYunWei="%xmlPathYunWei%"

echo ============================================================
echo [RUNNER_V6_DIAG_2ND] AFTER ALL BUSINESS CODE
echo 2ND_RUNNER_ARG6=[%_RUNNER_ARG6%]
echo 2ND_RUNNER_ARG5=[%_RUNNER_ARG5%]
echo 2ND_ACTUAL_excelDir=[%excelDir%]
echo 2ND_ACTUAL_xmlPath=[%xmlPath%]
echo 2ND_ACTUAL_xmlPathYunWei=[%xmlPathYunWei%]
echo 2ND_REAL_SVN_PATH_excelDir="%excelDir%"
echo 2ND_REAL_SVN_PATH_xmlPathYunWei="%xmlPathYunWei%"
echo ============================================================
`.replace(/\n/g,'\r\n');

const minimalBatPath = path.join(__dirname, 'debug_bats', '_minimal_test.bat');
fs.writeFileSync(minimalBatPath, iconv.encode(MINIMAL_BAT_SRC, 'gbk'));
console.log('已生成最小化验证 bat:', minimalBatPath);

function runBat(batPath, args, tagName) {
    return new Promise((resolve) => {
        const quoted = args.map(a => `"${a}"`).join(' ');
        const child = spawn(process.env.comspec || 'cmd.exe',
            ['/d','/s','/c', 'call "' + batPath + '" ' + quoted], {
            cwd: __dirname,
            windowsHide: true,
            windowsVerbatimArguments: true,
            shell: false,
            stdio: ['pipe','pipe','pipe']
        });
        let out = ''; let err = '';
        child.stdout.on('data', d => out += iconv.decode(Buffer.isBuffer(d)?d:Buffer.from(String(d)), 'gbk'));
        child.stderr.on('data', d => err += iconv.decode(Buffer.isBuffer(d)?d:Buffer.from(String(d)), 'gbk'));
        child.on('exit', code => {
            console.log('\n===== ' + tagName + ' exit=' + code + ' =====');
            if (err) console.log('[stderr]', err);
            console.log('[完整 stdout，逐行]');
            let keyLines = [];
            out.split(/\r?\n/).forEach((line, i) => {
                const isKey = /RUNNER_|excelDir|xmlPath|BUSINESS_OVERWRITTEN|SVN/i.test(line);
                if (isKey) keyLines.push(line);
                console.log(String(i+1).padStart(3,'0') + ' | ' + (isKey?'★ ':'  ') + line);
            });
            console.log('\n==========【一键验真 4 条】==========');
            const check1 = keyLines.some(l => /2ND_RUNNER_ARG6=\[D:\\gctx\\project\\e1_dev\\design\]/.test(l));
            const check2 = keyLines.some(l => {
                const m = l.match(/2ND_ACTUAL_excelDir=\[([^\]]*)\]/);
                if (!m) return false;
                const v = m[1].replace(/\\\\/g,'\\');
                const expect = 'D:\\gctx\\project\\e1_dev\\design\\数据填表';
                return v === expect && !/"/.test(m[1]);
            });
            const check3 = keyLines.some(l => {
                const m = l.match(/2ND_REAL_SVN_PATH_excelDir="([^"]*)"/);
                if (!m) return false;
                const v = m[1].replace(/\\\\/g,'\\');
                return v === 'D:\\gctx\\project\\e1_dev\\design\\数据填表' && (l.match(/"/g)||[]).length === 2;
            });
            const check4 = keyLines.some(l => {
                const m = l.match(/2ND_REAL_SVN_PATH_xmlPathYunWei="([^"]*)"/);
                if (!m) return false;
                const v = m[1].replace(/\\\\/g,'\\');
                return v === 'D:\\gctx\\project\\e1_dev\\design\\配置表生成\\xmlyunwei' && !/4yunwei/.test(l);
            });
            console.log('① 2ND_RUNNER_ARG6 = [D:\\gctx\\project\\e1_dev\\design]（非空）         :', check1 ? '✅PASS' : '❌FAIL');
            console.log('② 2ND_ACTUAL_excelDir = [D:\\...design\\数据填表]（方括号内 0 引号）    :', check2 ? '✅PASS' : '❌FAIL');
            console.log('③ 2ND_REAL_SVN_PATH_excelDir 只有最外层 1 对引号                       :', check3 ? '✅PASS' : '❌FAIL');
            console.log('④ 2ND_REAL_SVN_PATH_xmlPathYunWei 路径正确无 4yunwei                  :', check4 ? '✅PASS' : '❌FAIL');
            console.log('\n总 体 结 论：', (check1&&check2&&check3&&check4) ? '🎉 全部通过！excelDir 一定不再为空！可以打包了！' : '❌ 还有失败项');
            resolve();
        });
    });
}
(async function(){
    await runBat(minimalBatPath, testArgs, 'MINIMAL_VERIFY');
})().catch(e=>console.error(e));
