const fs = require('fs');
const path = 'd:/traeWork/ExcelExport/src/main.js';
let content = fs.readFileSync(path, 'utf8');

const startStr = '// --- Step 1.5: 【Runner v6 精准替换';
const endStr = '// --- Step 2: 构造 Runner 正文';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const replacement = "// --- Step 1.5: 【Runner v7 终极方案 · 0 内存替换】\n" +
        "        // 放弃所有正则替换，直接原样使用目标 bat，通过修复调用时传参不加引号解决根因。\n" +
        "        let effectiveTargetBatPath = targetBatPath;\n\n        ";
    content = content.slice(0, startIndex) + replacement + content.slice(endIndex);
    fs.writeFileSync(path, content);
    console.log('REPLACED PATCHING BLOCK');
} else {
    console.log('NOT FOUND');
}
