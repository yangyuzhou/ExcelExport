// Build-time download only. This file is not shipped in the application.
const fs = require('fs');
const https = require('https');
function download(url, destination, onProgress) {
    return new Promise((resolve, reject) => {
        let request, output, done = false;
        const timer = setTimeout(() => finish(new Error('下载超时，请检查网络后重试。')), 5 * 60 * 1000);
        function finish(error) {
            if (done) return;
            done = true; clearTimeout(timer);
            if (error) { request?.destroy(); output?.destroy(); reject(error); } else resolve();
        }
        function get(current, redirects = 0) {
            if (done) return;
            if (!current.startsWith('https:') || redirects > 6) return finish(new Error('安装包下载地址异常，已停止下载。'));
            request = https.get(current, { headers: { 'User-Agent':'ExcelExport-SVN-Setup' } }, response => {
                if (done) { response.destroy(); return; }
                if ([301,302,303,307,308].includes(response.statusCode) && response.headers.location) {
                    response.resume();
                    try { get(new URL(response.headers.location, current).href, redirects + 1); } catch (error) { finish(error); }
                    return;
                }
                if (response.statusCode !== 200) { response.resume(); return finish(new Error('无法下载安装包（HTTP ' + response.statusCode + '），请检查网络后重试。')); }
                const limit = 80 * 1024 * 1024;
                const total = Number(response.headers['content-length']) || 0;
                if (total > limit) { response.destroy(); return finish(new Error('安装包大小异常，已停止下载。')); }
                output = fs.createWriteStream(destination, { flags:'wx' });
                let bytes = 0, lastPercent = -1;
                response.on('data', chunk => {
                    bytes += chunk.length;
                    if (bytes > limit) { response.destroy(); return finish(new Error('安装包大小异常，已停止下载。')); }
                    const percent = total ? Math.floor(bytes * 100 / total) : -1;
                    if (percent !== lastPercent) { lastPercent = percent; onProgress(percent); }
                });
                response.on('error', finish);
                response.on('aborted', () => finish(new Error('下载中断，请重试。')));
                output.on('error', finish);
                output.on('finish', () => output.close(() => finish()));
                response.pipe(output);
            });
            request.setTimeout(30000, () => finish(new Error('下载连接超时，请检查网络后重试。')));
            request.on('error', finish);
        }
        get(url);
    });
}

module.exports = { download };
