const {app} = require('electron');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
app.whenReady().then(async () => {
    try {
        const resources = path.resolve(process.argv.find(a => a.startsWith('--resources=')).slice('--resources='.length));
        const source = path.join(resources,'app.asar','src');
        const state = fs.mkdtempSync(path.join(__dirname,'tmp','packaged-svn-'));
        const handlers={}, progress=[];
        let resolver;
        const environment = require(path.join(source,'environment.js'));
        vm.runInNewContext(fs.readFileSync(path.join(source,'main.js'),'utf8'), {
            require:id => id === 'electron' ? {app:{isPackaged:true,getPath:()=>state,requestSingleInstanceLock:()=>false,quit(){}},ipcMain:{handle:(name,fn)=>handlers[name]=fn}} :
                id === './environment' ? {...environment,findSvn:async () => (await resolver?.()) || {success:false},setPrivateSvnResolver:fn => resolver=fn} : require(id.startsWith('./') ? path.join(source,id) : id),
            __dirname:source,process:{...process,resourcesPath:resources},Buffer,setTimeout,clearTimeout,setInterval,clearInterval
        });
        const result = await handlers['enable-private-svn']({sender:{send:(_channel,data)=>progress.push(data)}});
        assert.equal(result.success,true,result.error); assert.equal(result.source,'private'); assert.equal(result.version,'1.14.5');
        assert.ok(result.path.startsWith(state)); assert.ok(progress.length >= 2);
        assert.equal((await handlers['check-environment']()).path,result.path);
        assert.equal((await handlers['enable-private-svn']({sender:{send(){}}})).alreadyInstalled,true);
        console.log('Packaged SVN IPC passed: offline private enable, automatic detection, repeat reuse.');
        app.exit(0);
    } catch(error) {console.error(error);app.exit(1);}
});
