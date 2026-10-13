const { exec } = require('child_process');

const subject = encodeURIComponent('请求 Token 补偿：AI 逻辑死循环导致严重消耗');
const body = encodeURIComponent(`Trae 官方团队你好，

我在使用 Trae 排查代码时，遇到了 AI 严重的逻辑缺陷，特此申请补偿消耗的 Token。

【事件概述】
AI 在排查简单的 CMD 传参引号问题时，发生了严重的逻辑偏航。它错误地采用极度复杂的正则替换去强行修改我的业务 Bat 脚本，而不是去检查最初的 Node 传参源头。

【造成的损失】
1. 制造衍生 Bug：AI 注入的代码引发了 CRLF 换行符解析错位，导致原本正常的脚本报错（excelDir 变量被异常截断为 1Dir）。
2. 极其严重的无效消耗：在错误的方向上带着我排查了数天，执行了数十次毫无意义的本地打包和测试复现，严重浪费了我的工作时间与 Token 额度。
3. 最终查明：根本不需要任何复杂的正则替换，只需删掉 Node.js spawn 传参时的几个双引号即可完美解决。

由于本次消耗完全是 AI 底层逻辑陷入过度工程化与死循环所致，请求官方查阅本账号后台的会话记录，并对我被无辜浪费的 Token 进行全额补偿。

项目工作区：D:\\traeWork\\ExcelExport
`);

// 尝试向几个常见的官方支持邮箱发送
const mailto = `mailto:support@trae.ai,contact@trae.ai?subject=${subject}&body=${body}`;

exec(`start "" "${mailto}"`, (error) => {
    if (error) {
        console.error('唤起邮件客户端失败:', error);
    } else {
        console.log('已成功唤起默认邮件客户端');
    }
});