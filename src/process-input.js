// A Writable can emit an asynchronous error even when write() has a callback.
// Keep the error listener until the stream is collected, including after child exit.
function startPauseInput(child, { onError, isStopping = () => false, schedule = setInterval, cancel = clearInterval, now = Date.now } = {}) {
    const input = child.stdin;
    let stopped = false, pending = false, reported = false, timer = null;
    const started = now();
    function stop() {
        stopped = true;
        if (timer !== null) { cancel(timer); timer = null; }
    }
    function failed(error) {
        stop();
        if (!reported) { reported = true; if (onError) onError(error); }
    }
    function write(text) {
        if (stopped) return;
        if (isStopping() || child.exitCode != null || child.signalCode != null || child.killed ||
            !input || input.destroyed || input.writableEnded || input.writableFinished || input.writable === false) {
            stop(); return;
        }
        if (pending) return; // Do not queue unlimited input when the child is not reading.
        pending = true;
        try {
            input.write(Buffer.from(text), error => { pending = false; if (error) failed(error); });
        } catch (error) { pending = false; failed(error); }
    }
    if (!input) return { stop };
    input.on('error', failed);
    input.on('close', stop);
    input.on('finish', stop);
    child.once('exit', stop); // 'close' may arrive considerably later than 'exit'.
    child.once('error', stop);
    child.once('close', () => { stop(); input.destroy(); });
    timer = schedule(() => {
        if (now() - started > 15 * 60 * 1000) { stop(); return; }
        write('\r\n');
    }, 800);
    write('\r\n\r\ny\r\n');
    return { stop };
}
module.exports = { startPauseInput };
