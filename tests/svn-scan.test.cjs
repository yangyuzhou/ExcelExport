const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {runFile,describeSvnFailure} = require('../src/environment');

test('真实子进程超时返回可读原因，输出溢出与超时分开处理', async () => {
    const timeout = await runFile(process.execPath,['-e','setTimeout(()=>{},5000)'],{timeout:150});
    assert.equal(timeout.timedOut,true);
    assert.equal(describeSvnFailure(timeout,'D:/xml').code,'SVN_STATUS_TIMEOUT');
    const overflow = await runFile(process.execPath,['-e','process.stdout.write("x".repeat(100000))'],{maxBuffer:1024});
    assert.equal(overflow.timedOut,false);
    assert.equal(describeSvnFailure(overflow,'D:/xml').code,'SVN_STATUS_OUTPUT_LIMIT');
    const failure = describeSvnFailure({error:{code:1},stderr:'svn: E155021: incompatible',durationMs:20},'D:/xml');
    assert.match(failure.error,/不兼容/); assert.match(failure.details,/E155021/);
});

test('SVN 扫描使用独立长超时及大缓冲，保留私有配置；退出 0 的非工作副本警告也报告失败', async () => {
    const module = {exports:{}}; let statusOptions; let statusArgs;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/environment.js'),'utf8'),{module,Buffer,process:{env:{}},require:id => {
        if(id==='child_process') return {execFile(file,args,options,callback) {
            if(args.includes('status')) {statusOptions=options;statusArgs=args;callback(null,Buffer.alloc(0),Buffer.from('svn: warning: W155007: not a working copy'));}
            else callback(new Error('missing'),Buffer.alloc(0),Buffer.alloc(0));
        }};
        return require(id);
    }});
    module.exports.setPrivateSvnResolver(async()=>({success:true,path:'private/svn.exe',configDir:'private/config'}));
    const result = await module.exports.svnStatus('D:/xml');
    assert.equal(statusOptions.timeout,180000); assert.equal(statusOptions.maxBuffer,32*1024*1024);
    assert.equal(statusArgs[0],'--config-dir'); assert.equal(statusArgs[1],'private/config');
    assert.equal(result.success,false); assert.match(result.error,/不是 SVN 工作副本/);
});
