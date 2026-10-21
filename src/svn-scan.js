const { spawn } = require('child_process');
const iconv = require('iconv-lite');

// A local working-copy scan must not be killed by execFile's timeout/maxBuffer.
// Consume output as it arrives and retain only the statuses used by the tool.
function runSvnScan(file, args, { signal } = {}) {
    const started = Date.now();
    return new Promise(resolve => {
        if (signal?.aborted) return resolve({ cancelled:true, stdout:'', stderr:'' });
        let child;
        try { child = spawn(file, args, { windowsHide:true, stdio:['ignore','pipe','pipe'] }); }
        catch (error) { return resolve({error,stdout:'',stderr:'',durationMs:Date.now()-started}); }
        const decoder = iconv.getDecoder('gbk');
        const stderrDecoder = iconv.getDecoder('gbk');
        const lines = [];
        let pending = '', stderr = '', processError;
        function consume(text, flush = false) {
            pending += text;
            let end;
            while ((end = pending.indexOf('\n')) !== -1) {
                const line = pending.slice(0,end).replace(/\r$/, '');
                pending = pending.slice(end+1);
                if (/^[MCA]\s/.test(line)) lines.push(line);
            }
            if (flush && /^[MCA]\s/.test(pending)) lines.push(pending.replace(/\r$/, ''));
        }
        const cancel = () => child.kill();
        signal?.addEventListener('abort',cancel,{once:true});
        if (signal?.aborted) cancel();
        child.stdout.on('data', data => consume(decoder.write(data)));
        child.stderr.on('data', data => { stderr = (stderr + stderrDecoder.write(data)).slice(-65536); });
        for (const stream of [child.stdout,child.stderr]) stream.on('error', error => { processError = error; child.kill(); });
        child.on('error', error => { processError = error; });
        child.on('close', (code, exitSignal) => {
            signal?.removeEventListener('abort',cancel);
            consume(decoder.end(),true);
            stderr = (stderr + stderrDecoder.end()).slice(-65536);
            const error = processError || (code !== 0 ? Object.assign(new Error(`SVN 退出码：${code}；信号：${exitSignal || '无'}`), {code,signal:exitSignal}) : null);
            resolve({error, cancelled:Boolean(signal?.aborted), stdout:signal?.aborted ? '' : lines.join('\n'), stderr, durationMs:Date.now()-started});
        });
    });
}

function createScanSessions() {
    const sessions = new Map();
    return {
        begin(sender, requestId) {
            const key = sender?.id ?? 0;
            sessions.get(key)?.controller.abort();
            const controller = new AbortController();
            const destroyed = () => controller.abort();
            sender?.once?.('destroyed',destroyed);
            const session = {controller,requestId,finish() {
                sender?.removeListener?.('destroyed',destroyed);
                if (sessions.get(key) === session) sessions.delete(key);
            }};
            sessions.set(key,session);
            return session;
        },
        cancel(sender, requestId) {
            const session = sessions.get(sender?.id ?? 0);
            if (session?.requestId === requestId) session.controller.abort();
        }
    };
}
module.exports = {runSvnScan,createScanSessions};
