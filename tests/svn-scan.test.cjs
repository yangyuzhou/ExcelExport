const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {runFile,describeSvnFailure} = require('../src/environment');
const {runSvnScan,createScanSessions} = require('../src/svn-scan');
const {pathToFileURL} = require('url');

test('复现旧执行器的超时和输出溢出；真实 SVN 不兼容仍保留原因', async () => {
    const timeout = await runFile(process.execPath,['-e','setTimeout(()=>{},5000)'],{timeout:150});
    assert.equal(timeout.timedOut,true);
    assert.equal(timeout.error.killed,true);
    const overflow = await runFile(process.execPath,['-e','process.stdout.write("x".repeat(100000))'],{maxBuffer:1024});
    assert.equal(overflow.timedOut,false);
    assert.equal(overflow.error.code,'ERR_CHILD_PROCESS_STDIO_MAXBUFFER');
    const failure = describeSvnFailure({error:{code:1},stderr:'svn: E155021: incompatible',durationMs:20},'D:/xml');
    assert.match(failure.error,/不兼容/); assert.match(failure.details,/E155021/);
});

test('扫描使用流式执行器，保留私有配置；退出 0 的非工作副本警告也报告失败', async () => {
    const module = {exports:{}}; let statusOptions; let statusArgs;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/environment.js'),'utf8'),{module,Buffer,process:{env:{}},require:id => {
        if(id==='./svn-scan') return {runSvnScan:async (file,args,options) => {statusOptions=options;statusArgs=args;return {error:null,stdout:'',stderr:'svn: warning: W155007: not a working copy'};}};
        if(id==='child_process') return {execFile(file,args,options,callback) {
            callback(new Error('missing'),Buffer.alloc(0),Buffer.alloc(0));
        }};
        return require(id);
    }});
    module.exports.setPrivateSvnResolver(async()=>({success:true,path:'private/svn.exe',configDir:'private/config'}));
    const result = await module.exports.svnStatus('D:/xml');
    assert.equal(statusOptions.timeout,undefined); assert.equal(statusOptions.maxBuffer,undefined);
    assert.equal(statusArgs[0],'--config-dir'); assert.equal(statusArgs[1],'private/config');
    assert.equal(result.success,false); assert.match(result.error,/不是 SVN 工作副本/);
});

test('扫描超过旧版 15 秒仍完整成功，不主动杀掉正常进程', async () => {
    const result = await runSvnScan(process.execPath,['-e', 'setTimeout(()=>process.stdout.write("M       slow.xml\\n"),16000)']);
    assert.equal(result.error,null); assert.equal(result.stdout,'M       slow.xml');
    assert.ok(result.durationMs >= 15000);
});

test('流式扫描超过 32 MB 的输出完整成功，不丢末尾记录；支持取消并回收进程', async () => {
    const script = 'let n=0;function write(){while(n<40000){const line="M       "+n+++"_"+"x".repeat(900)+".xml\\n";if(!process.stdout.write(line)){process.stdout.once("drain",write);return;}}}write();';
    const result = await runSvnScan(process.execPath,['-e',script]);
    assert.equal(result.error,null); assert.ok(result.stdout.length > 32*1024*1024);
    assert.equal(result.stdout.split('\n').length,40000); assert.match(result.stdout,/39999_x+\.xml$/);
    const controller = new AbortController();
    const pending = runSvnScan(process.execPath,['-e','setInterval(()=>{},1000)'],{signal:controller.signal});
    setTimeout(()=>controller.abort(),100);
    const cancelled = await pending;
    assert.equal(cancelled.cancelled,true); assert.equal(cancelled.stdout,'');
    assert.equal((await runSvnScan('missing-svn-executable.exe',[])).error.code,'ENOENT');
});

test('重开扫描终止旧任务；迟到的旧取消请求不会杀掉新任务', () => {
    const sessions = createScanSessions();
    const old = sessions.begin({id:1},1), current = sessions.begin({id:1},2);
    assert.equal(old.controller.signal.aborted,true);
    old.finish(); sessions.cancel({id:1},1);
    assert.equal(current.controller.signal.aborted,false);
    sessions.cancel({id:1},2); assert.equal(current.controller.signal.aborted,true);
    current.finish();
});

const svn = path.join(__dirname,'../build/svn-runtime/svn.exe');
const svnadmin = path.join(process.env.ProgramFiles || '', 'TortoiseSVN/bin/svnadmin.exe');
test('真实内置 SVN 扫描 6000 个中文 XML 变更：旧执行器输出溢出，新执行器全部读取成功', {skip:process.platform!=='win32'||!fs.existsSync(svn)||!fs.existsSync(svnadmin)}, async () => {
    fs.mkdirSync(path.join(__dirname,'tmp'),{recursive:true});
    const root = fs.mkdtempSync(path.join(__dirname,'tmp','scan-'));
    const repository=path.join(root,'repo'),working=path.join(root,'wc');
    const config=path.join(root,'config'); fs.mkdirSync(config);
    const args=['--config-dir',config];
    async function command(file, argv) {
        const result = await runFile(file,argv,{timeout:120000,maxBuffer:16*1024*1024});
        assert.equal(result.error,null,result.stderr || result.error?.message);
    }
    await command(svnadmin,['create',repository]);
    await command(svn,[...args,'checkout',pathToFileURL(repository).href,working]);
    const seed = '已有配置.xml';
    fs.writeFileSync(path.join(working,seed),'before');
    await command(svn,[...args,'add',path.join(working,seed),'--quiet']);
    await command(svn,[...args,'commit',working,'-m','local scan fixture','--quiet']);
    const names = Array.from({length:5999},(_,i)=>`${String(i).padStart(5,'0')}_${'config_'.repeat(16)}中文配置.xml`);
    for (const name of names) fs.writeFileSync(path.join(working,name),'new XML');
    await command(svn,[...args,'add',working,'--force','--quiet']);
    fs.writeFileSync(path.join(working,seed),'after: changed XML');
    names.push(seed);
    const old = await runFile(svn,[...args,'status',working]);
    assert.equal(old.error?.code,'ERR_CHILD_PROCESS_STDIO_MAXBUFFER');
    const actual = await runSvnScan(svn,[...args,'status',working]);
    assert.equal(actual.error,null,actual.stderr);
    const paths = actual.stdout.split('\n').map(line=>line.slice(8));
    assert.equal(paths.length,names.length);
    assert.deepEqual(new Set(paths),new Set(names.map(name=>path.join(working,name))));
    const handlers = {};
    const source = path.join(__dirname,'../src');
    vm.runInNewContext(fs.readFileSync(path.join(source,'main.js'),'utf8'),{
        require:id => id==='electron' ? {app:{requestSingleInstanceLock:()=>false,quit(){},getPath:()=>root},ipcMain:{handle:(name,fn)=>handlers[name]=fn}} : require(id.startsWith('./')?path.join(source,id):id),
        __dirname:source,process,Buffer,setTimeout,clearTimeout,setInterval,clearInterval
    });
    const enabled = await handlers['enable-private-svn']({sender:{send(){}}});
    assert.equal(enabled.success,true,enabled.error);
    const listed = await handlers['get-all-svn-changes']({},[{id:'xml',path:working}],1);
    assert.equal(listed.success,true,listed.error);
    assert.equal(listed.data.length,names.length);
    assert.deepEqual(new Set(listed.data.map(item=>item.name)),new Set(names));
    console.log(`真实 SVN：${paths.length} 个变更完整返回，${actual.durationMs} ms；旧执行器 ${old.error.code}`);
});
