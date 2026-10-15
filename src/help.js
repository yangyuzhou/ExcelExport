// 同一份离线 HTML 同时用于工具内引导和浏览器独立阅读。
(() => {
    const topics = new Set(['getting-started', 'paths', 'svn', 'export', 'sheets', 'errors', 'submit']);
    const seenKey = 'faqSeen';
    const startupKey = 'faqShowOnStartup';
    function getPreference(key) { try { return localStorage.getItem(key); } catch { return null; } }
    function setPreference(key, value) { try { localStorage.setItem(key, value); } catch { /* 无法保存时仍可正常阅读 */ } }
    window.addEventListener('DOMContentLoaded', () => {
        const dialog = document.getElementById('faqDialog');
        const frame = document.getElementById('faqFrame');
        const startup = document.getElementById('faqShowOnStartup');
        let previousFocus;
        let targetTopic = 'getting-started';
        const navigate = () => frame.contentWindow.postMessage({ type: 'faq-navigate', topic: targetTopic }, '*');
        frame.addEventListener('load', navigate);
        const open = (topic = 'getting-started') => {
            if (!dialog.open) previousFocus = document.activeElement;
            targetTopic = topics.has(topic) ? topic : 'getting-started';
            if (!frame.hasAttribute('src')) frame.src = 'faq.html';
            else navigate();
            startup.checked = getPreference(startupKey) === '1';
            if (!dialog.open) dialog.showModal();
        };
        const close = () => { setPreference(seenKey, '1'); dialog.close(); };
        dialog.addEventListener('cancel', () => setPreference(seenKey, '1'));
        dialog.addEventListener('close', () => {
            setPreference(seenKey, '1');
            if (previousFocus && previousFocus.isConnected) previousFocus.focus();
        });
        startup.addEventListener('change', () => setPreference(startupKey, startup.checked ? '1' : '0'));
        document.getElementById('btnCloseFaq').onclick = close;
        document.getElementById('btnFinishFaq').onclick = close;
        document.querySelectorAll('[data-help-topic]').forEach(button => { button.onclick = () => open(button.dataset.helpTopic); });
        document.addEventListener('keydown', event => { if (event.key === 'F1') { event.preventDefault(); open(); } });
        window.addEventListener('message', event => {
            // 仅接收当前帮助 iframe 的固定操作，不接受任意页面或路径。
            if (!dialog.open || event.source !== frame.contentWindow || event.data?.type !== 'faq-action') return;
            if (event.data.action === 'close') close();
            if (event.data.action === 'settings') { close(); document.getElementById('btnSettings').click(); }
        });
        if (getPreference(seenKey) !== '1' || getPreference(startupKey) === '1') open();
    });
})();
