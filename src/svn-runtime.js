const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function verifyFiles(directory, manifest) {
    if (!manifest.files?.['svn.exe']) throw new Error('SVN 组件清单缺少 svn.exe。');
    for (const [name, expected] of Object.entries(manifest.files)) {
        if (path.basename(name) !== name || name === '..' || !/^[a-f0-9]{64}$/i.test(expected)) throw new Error('SVN 组件清单无效。');
        const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex');
        if (actual !== expected.toLowerCase()) throw new Error('SVN 组件校验失败：' + name + '。请使用完整绿色版重试。');
    }
}
function createSvnRuntime({ sourceDir, stateDir, manifest, runFile, findSvn }) {
    const id = 'svn-' + manifest.version + '-' + crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex').slice(0, 12);
    const marker = path.join(stateDir, 'active.json');
    const configDir = path.join(stateDir, 'config');
    let running = false, verified = false;
    async function detectPrivate() {
        try {
            const active = JSON.parse(fs.readFileSync(marker, 'utf8'));
            if (active.id !== id || !active.directory?.startsWith(id + '-') || path.basename(active.directory) !== active.directory) return null;
            const destination = path.join(stateDir, active.directory);
            if (!verified) { verifyFiles(destination, manifest); verified = true; }
            const executable = path.join(destination, 'svn.exe');
            const result = await runFile(executable, ['--config-dir', configDir, '--version', '--quiet']);
            if (result.error) { verified = false; return null; }
            return { success:true, source:'private', path:executable, configDir, version:result.stdout.trim() };
        } catch { verified = false; return null; }
    }
    return {
        get busy() { return running; }, detectPrivate,
        async enable(notify = () => {}) {
            if (running) return { success:false, code:'SVN_SETUP_BUSY', error:'正在启用 SVN 组件，请稍候。' };
            running = true;
            let staging;
            const progress = message => { try { notify({message}); } catch {} };
            try {
                const current = await findSvn();
                if (current.success) return {...current, alreadyInstalled:true};
                progress('正在校验内置 SVN 组件，无需联网或管理员权限…');
                verifyFiles(sourceDir, manifest);
                fs.mkdirSync(stateDir, {recursive:true});
                fs.mkdirSync(configDir, {recursive:true});
                staging = fs.mkdtempSync(path.join(stateDir, 'pending-'));
                for (const name of Object.keys(manifest.files)) fs.copyFileSync(path.join(sourceDir, name), path.join(staging, name));
                verifyFiles(staging, manifest);
                progress('正在检测工具专用 SVN 组件…');
                const probe = await runFile(path.join(staging, 'svn.exe'), ['--config-dir', configDir, '--version', '--quiet']);
                if (probe.error) throw new Error('内置 SVN 组件无法运行，请将此提示交给维护人员：' + (probe.stderr.trim() || probe.error.message));
                const directory = id + '-' + crypto.randomBytes(6).toString('hex');
                const destination = path.join(stateDir, directory);
                fs.renameSync(staging, destination); staging = null;
                const markerTemp = marker + '.tmp';
                fs.writeFileSync(markerTemp, JSON.stringify({id, directory}), 'utf8');
                fs.renameSync(markerTemp, marker);
                verified = true;
                const detected = await detectPrivate();
                if (!detected) throw new Error('组件启用后检测失败，请重试。');
                progress('工具专用 SVN 已就绪，系统 SVN 未作更改。');
                return detected;
            } catch (error) {
                return { success:false, code:'SVN_SETUP_FAILED', error:'无法启用内置 SVN 组件：' + error.message };
            } finally {
                running = false;
                if (staging) {
                    for (const name of Object.keys(manifest.files)) try { fs.unlinkSync(path.join(staging, name)); } catch {}
                    try { fs.rmdirSync(staging); } catch {}
                }
            }
        }
    };
}
module.exports = { createSvnRuntime, verifyFiles };
