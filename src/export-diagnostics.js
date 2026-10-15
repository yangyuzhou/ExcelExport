// Keep the first failure attached to its workbook and sheet, even if more output arrives.
const path = require('path');
const normalize = value => String(value || '').replace(/\\/g, '/').toLowerCase();
const clean = value => String(value || '').trim().replace(/^["']|["']$/g, '');

function createDiagnostics({ entries = [], excelRoot = '' } = {}) {
    const configured = entries.map(item => ({ ...item, fullPath: path.resolve(excelRoot, item.input || '') }));
    let context = {}, failure = null, recent = [], awaitingSheet = false;
    const same = (a, b) => normalize(a) === normalize(b);
    const candidates = () => configured.filter(item => context.excelPath && same(item.fullPath, context.excelPath));
    function selectSheet(matches) {
        const sheets = [...new Set(matches.map(item => item.sheet).filter(Boolean))];
        if (sheets.length === 1) { context.sheet = sheets[0]; context.input = matches[0].input; }
        else delete context.sheet; // Ambiguous aliases must never reuse a previous sheet.
    }
    function consume(raw, isFatal = false) {
        const line = String(raw).trim();
        if (!line) return;
        recent.push(line);
        if (recent.length > 18) recent.shift();
        if (!failure) {
            const file = line.match(/start\s+process\s+excelFile\s*=\s*(.+?\.xlsx?)["']?\s*$/i);
            if (file) {
                context = { excelPath: path.resolve(excelRoot, clean(file[1])) };
                const matches = candidates();
                if (matches.length) context.input = matches[0].input;
                awaitingSheet = false;
            } else if (/^\${5,}$/.test(line)) {
                delete context.sheet;
                awaitingSheet = true;
            } else {
                const explicit = line.match(/^(?:sheet(?:Name)?|页签)\s*[:=]\s*(.+)$/i);
                const matches = candidates().filter(item => line === item.sheet || line === item.name);
                if (explicit) context.sheet = clean(explicit[1]);
                else if (matches.length) selectSheet(matches);
                else if (awaitingSheet && !/[\\/:=]/.test(line) && !isFatal) context.sheet = line;
                else {
                    const outputs = candidates().filter(item => [item.outlua, item.output].some(output =>
                        output && output !== '--' && normalize(line).endsWith('/' + normalize(output))));
                    if (outputs.length) selectSheet(outputs);
                }
                awaitingSheet = false;
            }
        }
        const typed = line.match(/keyStr\s*=\s*(.*?)\s*,\s*typeStr\s*=\s*(.*?)\s*,\s*the value\s*=\s*(.*?)\s+isError\b/i);
        const duplicate = /索引值不唯一/.test(line);
        const rowError = /the data is\s+err+r/i.test(line);
        const exception = line.match(/^([\w.]+(?:Error|Exception))\s*:\s*(.*)$/);
        const hadFailure = Boolean(failure);
        if (!failure && (isFatal || typed || duplicate || rowError || exception)) {
            // The error itself is more authoritative than preceding progress output.
            if (duplicate) {
                const file = line.match(/excelName\s*=\s*(.+)$/i);
                const sheet = line.match(/sheetName\s*=\s*(.*?)(?=\s*[,，]\s*excelName\s*=|$)/i);
                if (file) {
                    context = { excelPath: path.resolve(excelRoot, clean(file[1])) };
                    const matches = candidates();
                    if (matches.length) context.input = matches[0].input;
                }
                if (sheet) context.sheet = clean(sheet[1]);
            }
            failure = { ...context, workbook: context.excelPath ? path.basename(context.excelPath) : '',
                raw: line, context: recent.slice(), kind: 'unknown', summary: line,
                suggestion: '请查看下方相关日志；无法判断时，复制错误信息交给工具维护人员。' };
        }
        if (!failure) return;
        if (hadFailure && !(/^Traceback\s*\(/i.test(failure.raw) && exception)) return;
        // Only enrich the original failure, never replace it with another table's error.
        if (failure.kind !== 'unknown') return;
        if (duplicate) {
            const key = line.match(/索引值不唯一\s*[-:：]?\s*([^\s=,，]+)\s*=\s*([^,，]*)/);
            const field = key?.[1] || '', actual = key ? clean(key[2]) : undefined;
            Object.assign(failure, { kind: 'duplicate-key', field, actual,
                summary: field ? `「${field}」的值「${actual}」重复，索引值必须唯一。` : '索引值重复，索引值必须唯一。',
                suggestion: field ? `打开出错页签，在「${field}」列查找「${actual}」，核对所有重复记录，按配置规则修正后保存并重新导表。不要直接跳过错误记录。` : '打开出错页签检查重复索引；需要协助时复制错误信息给维护人员。' });
        } else if (typed) {
            const [, field, expected, actual] = typed;
            const types = { int: '整数', float: '数字', double: '数字', string: '文本', str: '文本', bool: '布尔值' };
            const label = types[expected.toLowerCase()] || expected;
            Object.assign(failure, { kind: 'field-type', field, expected, actual, raw: line,
                summary: `「${field}」需要${label}，当前填写的是「${actual || '空值'}」。`,
                suggestion: `打开下方表格，找到「${field}」列，按该字段规则修正「${actual || '空值'}」，保存后重新增量导表。` });
        } else if (rowError) {
            Object.assign(failure, { kind: 'row-data', raw: line, summary: '表中有不符合规则的数据。',
                field: line.match(/(?:--name|keyStr)\s*=\s*([^,\s]+)/i)?.[1] || '',
                reportedRow: line.match(/\brow\s*=\s*(\d+)/i)?.[1] || '',
                suggestion: '根据字段和脚本报告的行号检查数据；脚本行号可能从 0 开始或不含表头，请同时核对内容。' });
        } else if (exception) {
            Object.assign(failure, { kind: 'script', raw: line, summary: `导表脚本异常：${exception[1]} — ${exception[2]}`,
                suggestion: /(?:PermissionError|WindowsError).*?(?:13|32|denied|拒绝|占用)/i.test(line)
                    ? '检查文件是否正被 Excel 或其他程序占用、目录是否允许写入，处理后重试。'
                    : '复制错误信息交给工具维护人员，并说明本次修改了哪些表。不要根据程序代码行号修改 Excel。' });
        }
        failure.context = recent.slice();
        if (failure.kind === 'unknown' && !/^Traceback\s*\(/i.test(line)) {
            failure.field = line.match(/(?:keyStr|--name)\s*=\s*([^,\s]+)/i)?.[1] || '';
            failure.reportedRow = line.match(/\brow\s*=\s*(\d+)/i)?.[1] || '';
            failure.summary = /重复|不唯一|duplicate/i.test(line) ? '表中存在重复的索引或键值，请检查重复项。' : '导表脚本报告数据错误，请检查相关原始日志。';
        }
    }
    return { consume, snapshot: () => failure ? { ...failure, context: failure.context.slice() } : null };
}

// A time gap is not a line boundary: preserve split Chinese bytes and error fields.
function createLogReader(decode, onLine) {
    let buffer = Buffer.alloc(0);
    return {
        push(data) {
            buffer = Buffer.concat([buffer, data]);
            let end;
            while ((end = buffer.indexOf(10)) >= 0) {
                const line = buffer.subarray(0, end + 1);
                buffer = buffer.subarray(end + 1);
                onLine(decode(line));
            }
            // pause has no newline; it is a known complete prompt, safe to flush.
            if (buffer.length && /请按任意键继续[^\r\n]*$/.test(decode(buffer))) this.flush();
        },
        flush() { if (buffer.length) { const tail = buffer; buffer = Buffer.alloc(0); onLine(decode(tail)); } }
    };
}
module.exports = { createDiagnostics, createLogReader };
