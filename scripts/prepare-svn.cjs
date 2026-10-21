// Build-time only. End users receive an isolated CLI runtime, not an installer.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { download } = require('./download-file.cjs');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function prepare() {
    const root = path.join(__dirname, '..');
    const inputs = path.join(root, 'build', 'svn');
    fs.mkdirSync(inputs, {recursive:true});
    const name = 'TortoiseSVN-1.14.9.29743-x64-svn-1.14.5.msi';
    const target = path.join(inputs, name);
    if (!fs.existsSync(target)) await download('https://downloads.sourceforge.net/project/tortoisesvn/1.14.9/Application/' + name, target, () => {});
    if (hash(target) !== '244f3d754212ff65d057a1a02f99dd59f8b4c7ea4e4dd33eae8fb9b52895eec2') throw Error('Official MSI SHA256 mismatch');
    const image = path.join(root, 'tests', 'tmp', 'svn-image-x64');
    execFileSync('powershell.exe', ['-NoProfile','-File',path.join(__dirname,'extract-svn.ps1'),'-Installer',target,'-Destination',image], {windowsHide:true, stdio:'inherit'});
    const extracted = path.join(image, 'Program Files', 'TortoiseSVN');
    const output = path.join(root, 'build', 'svn-runtime');
    fs.mkdirSync(output, {recursive:true});
    const manifest = { version:'1.14.5', architecture:'x64', files:{} };
    function copy(directory, name) {
        const file = path.join(output, name);
        fs.copyFileSync(path.join(directory, name), file);
        manifest.files[name] = hash(file);
    }
    const bin = path.join(extracted, 'bin');
    for (const name of fs.readdirSync(bin).sort()) if (/^(svn\.exe|libsvn_tsvn\.dll|libapr_tsvn\.dll|libaprutil_tsvn\.dll|intl3_tsvn\.dll|libsasl\.dll|sasl.*\.dll)$/i.test(name)) copy(bin, name);
    const crt = path.join(extracted, 'System64');
    for (const name of fs.readdirSync(crt).sort()) if (/\.dll$/i.test(name)) copy(crt, name);
    for (const name of fs.readdirSync(extracted).sort()) if (/license\.txt$/i.test(name)) copy(extracted, name);
    copy(inputs, 'NOTICE.txt');
    fs.writeFileSync(path.join(root,'src','svn-runtime-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log('Prepared private offline SVN runtime:', Object.keys(manifest.files).length, 'files');
}
prepare().catch(error => { console.error(error); process.exitCode = 1; });
