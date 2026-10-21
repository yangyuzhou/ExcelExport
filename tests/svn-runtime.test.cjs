const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { pathToFileURL } = require('url');
const { createSvnRuntime } = require('../src/svn-runtime');
const { runFile } = require('../src/environment');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture() {
    fs.mkdirSync(path.join(__dirname,'tmp'), {recursive:true});
    const root = fs.mkdtempSync(path.join(__dirname,'tmp','private-svn-test-'));
    const sourceDir = path.join(root,'bundle'); fs.mkdirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir,'svn.exe'),'fixture only');
    const options = { sourceDir, stateDir:path.join(root,'user-only'), manifest:{version:'1.14.5', files:{'svn.exe':hash(path.join(sourceDir,'svn.exe'))}},
        findSvn:async () => ({success:false}), runFile:async () => ({error:null,stdout:'1.14.5',stderr:''}) };
    return {root,options};
}
test('已有可用 SVN 时不复制组件、不覆盖现有版本', async () => {
    const {options} = fixture();
    const runtime = createSvnRuntime({...options, findSvn:async () => ({success:true,source:'system',version:'1.10.8',path:'C:/existing/svn.exe'})});
    const result = await runtime.enable();
    assert.equal(result.version,'1.10.8'); assert.equal(result.alreadyInstalled,true);
    assert.equal(fs.existsSync(options.stateDir),false);
});
test('离线组件仅写专用目录，重复启用互斥，重启后可恢复，损坏时可重试', async () => {
    const {options} = fixture();
    let release;
    const runtime = createSvnRuntime({...options, findSvn:() => new Promise(resolve => release = resolve)});
    const pending = runtime.enable();
    assert.equal((await runtime.enable()).code,'SVN_SETUP_BUSY');
    release({success:false});
    const result = await pending;
    assert.equal(result.success,true); assert.equal(result.source,'private'); assert.ok(result.path.startsWith(options.stateDir + path.sep));
    assert.equal(runtime.busy,false);
    assert.equal((await createSvnRuntime(options).detectPrivate()).path,result.path);
    fs.writeFileSync(result.path,'corrupt');
    const reloaded = createSvnRuntime(options);
    assert.equal(await reloaded.detectPrivate(),null);
    const repaired = await reloaded.enable();
    assert.equal(repaired.success,true); assert.notEqual(repaired.path,result.path);
});
test('坏包和无法运行均不会保存成功标记，失败后解除锁', async () => {
    for (const scenario of ['hash','run','missing']) {
        const {options} = fixture();
        if (scenario === 'hash') fs.writeFileSync(path.join(options.sourceDir,'svn.exe'),'tampered');
        if (scenario === 'missing') fs.unlinkSync(path.join(options.sourceDir,'svn.exe'));
        if (scenario === 'run') options.runFile = async () => ({error:new Error('blocked'),stdout:'',stderr:''});
        const runtime = createSvnRuntime(options);
        assert.equal((await runtime.enable()).success,false);
        assert.equal(fs.existsSync(path.join(options.stateDir,'active.json')),false);
        assert.equal(runtime.busy,false);
    }
});
test('检测优先系统 SVN，自定义目录可用时不切换到内置组件', async () => {
    const source = fs.readFileSync(path.join(__dirname,'../src/environment.js'),'utf8');
    for (const custom of [true,false]) {
        const module = {exports:{}}; let privateCalls=0;
        vm.runInNewContext(source,{module,Buffer,process:{env:{}},require:id => {
            if (id==='child_process') return {execFile(file,args,options,callback) {
                if (file === 'reg.exe' && custom) return callback(null,Buffer.from('Directory    REG_SZ    D:\\CustomSVN\r\n'),Buffer.alloc(0));
                const good = custom && file.includes('CustomSVN');
                callback(good ? null : new Error('missing'),Buffer.from('1.10.8'),Buffer.alloc(0));
            }};
            if(id==='fs') return {existsSync:() => custom};
            return require(id.startsWith('./') ? path.join(__dirname,'../src',id) : id);
        }});
        module.exports.setPrivateSvnResolver(async () => { privateCalls++; return {success:true,path:'private/svn.exe',source:'private'}; });
        const result = await module.exports.findSvn();
        assert.equal(result.source,custom?'system':'private'); assert.equal(privateCalls,custom?0:1);
    }
});
const bundle = path.join(__dirname,'../build/svn-runtime');
test('真实内置 SVN 离线启用及 status；系统 SVN 文件与当前 PATH 保持不变', {skip:process.platform!=='win32'||!fs.existsSync(bundle)}, async () => {
    const {root,options} = fixture();
    const originalPath = process.env.PATH;
    const originalSvn = path.join(process.env.ProgramFiles,'TortoiseSVN','bin','svn.exe');
    const before = fs.existsSync(originalSvn) ? hash(originalSvn) : null;
    const isolatedRun = (file,args) => runFile(file,args,{env:{...process.env,PATH:path.join(process.env.SystemRoot,'System32')}});
    const runtime = createSvnRuntime({...options, sourceDir:bundle, manifest:require('../src/svn-runtime-manifest.json'),runFile:isolatedRun});
    const result = await runtime.enable();
    assert.equal(result.success,true,result.error); assert.equal(result.version,'1.14.5');
    const args = ['--config-dir', result.configDir];
    const status = await isolatedRun(result.path,[...args,'status',root]);
    assert.match(status.stderr,/W155007|not a working copy|不是工作副本/);
    const admin = path.join(process.env.ProgramFiles,'TortoiseSVN','bin','svnadmin.exe');
    if(fs.existsSync(admin)) {
        const repository=path.join(root,'repo'), working=path.join(root,'wc');
        assert.equal((await runFile(admin,['create',repository])).error,null);
        assert.equal((await isolatedRun(result.path,[...args,'checkout',pathToFileURL(repository).href,working])).error,null);
        fs.writeFileSync(path.join(working,'test.txt'),'offline fixture');
        const changed=await isolatedRun(result.path,[...args,'status',working]);
        assert.equal(changed.error,null); assert.match(changed.stdout,/\?.*test.txt/);
    }
    assert.equal(process.env.PATH,originalPath);
    if(before) assert.equal(hash(originalSvn),before);
});
