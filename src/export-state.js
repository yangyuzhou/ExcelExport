(function(root) {
    const fileKey = input => String(input).replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
    const nextMode = mode => ({ auto: 'include', include: 'exclude', exclude: 'auto' }[mode || 'auto']);
    const shouldExport = item => item.exportMode !== 'exclude' && (item.exportMode === 'include' || !!item.svnModified);
    function targets(items, all = false) {
        const files = new Map();
        items.forEach(item => {
            const key = fileKey(item.input);
            const existing = files.get(key);
            files.set(key, { input: item.input, excluded: item.exportMode === 'exclude' || !!existing?.excluded,
                included: all || shouldExport(item) || !!existing?.included });
        });
        return [...files.values()].filter(f => all || (!f.excluded && f.included)).map(f => f.input);
    }
    const api = { fileKey, nextMode, shouldExport, targets };
    if (typeof module !== 'undefined') module.exports = api;
    else root.ExportState = api;
})(typeof window !== 'undefined' ? window : globalThis);
