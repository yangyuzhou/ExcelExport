const fs = require('fs');
const iconv = require('iconv-lite');
const path = require('path');
const { spawn } = require('child_process');
const patchedBatPath = path.join(__dirname, 'debug_bats', 'toClientPy1-PATCHED-v6.bat');
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
            console.log('\n==== ' + tagName + ' exit=' + code + ' ====\n');
            let keyLines = [];
            out.split(/\r?\n/).forEach((line, idx) => {
                if (!line.trim()) return;
                const isKey = /RUNNER_|_RUNNER_ARG|2ND_|excelDir=|xmlPath=|SVN|designRoot=/i.test(line);
                if (isKey) keyLines.push({idx, line});
                console.log((isKey?'★ ':'  ') + String(idx+1).padStart(3,'0') + ' | ' + line);
            });
            console.log('\n==========【一键验真 4 条】==========');
            const kl = keyLines.map(k=>k.line);
            const check1 = kl.some(l=>/2ND_RUNNER_ARG6_original_design=\[D:\\gctx\\project\\e1_dev\\design\]/.test(l));
            const check2 = kl.some(l=>{
                const m = l.match(/2ND_ACTUAL_excelDir=\[([^\]]*)\]/);
                if (!m) return false;
                const v = m[1];
                return v === 'D:\\gctx\\project\\e1_dev\\design\\数据填表' && !/"/.test(v);
            });
            const check3 = kl.some(l=>{
                const m = l.match(/2ND_REAL_SVN_PATH_excelDir="([^"]*)"/);
                if (!m) return false;
                const inner = m[1];
                return inner === 'D:\\gctx\\project\\e1_dev\\design\\数据填表';
            });
            const check4 = kl.some(l=>{
                const m = l.match(/2ND_REAL_SVN_PATH_xmlPathYunWei="([^"]*)"/);
                if (!m) return false;
                const inner = m[1];
                return inner === 'D:\\gctx\\project\\e1_dev\\design\\配置表生成\\xmlyunwei';
            });
            console.log('✅① 2ND_RUNNER_ARG6 = [D:\\gctx\\project\\e1_dev\\design] 非空:', check1 ? 'PASS' : 'FAIL');
            console.log('✅② 2ND_ACTUAL_excelDir 方括号内无引号 + 路径正确:', check2 ? 'PASS' : 'FAIL');
            console.log('✅③ 2ND_REAL_SVN_PATH_excelDir 只有外层引号（内部 0 个）:', check3 ? 'PASS' : 'FAIL');
            console.log('✅④ 2ND_REAL_SVN_PATH_xmlPathYunWei 无 4yunwei、路径正确:', check4 ? 'PASS' : 'FAIL');
            console.log('\n========== 总体结论 ==========');
            console.log((check1&&check2&&check3&&check4) ? '🎉 全部通过！Runner v6 修复成功，excelDir 绝对不再空！' : '❌ 有失败项，请把上面 ★ 标记的关键行贴出来');
            resolve({code, out});
        });
    });
}
(async function main(){
    // 临时去掉 call _batInit / set /p path= 这两行环境依赖（验证环境没有 _batInit.bat）
    let buf = fs.readFileSync(patchedBatPath);
    let content = iconv.decode(buf, 'gbk');
    content = content.replace(/^\s*call\s+_batInit\s*\r?\n/gm, ':: [VERIFY ENV SKIP] call _batInit 环境依赖跳过\r\n');
    content = content.replace(/^\s*set\s*\/p\s+path\s*=\s*<[^%]*%drives%[^%]*\.txt\s*\r?\n/gm, ':: [VERIFY ENV SKIP] set /p path= 环境依赖跳过\r\n');
    const tmpPath = path.join(__dirname, 'debug_bats', '_tmp_patched_for_verify.bat');
    fs.writeFileSync(tmpPath, iconv.encode(content, 'gbk'));
    await runBat(tmpPath, testArgs, 'PATCHED-v6 RUN ONLY (no _batInit)');
})().catch(e=>console.error(e));
