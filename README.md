# 一站式导表工具

本仓库保存 Electron 导表工具、Unity 开发版、配置示例、批处理脚本、需求文档和测试。

## 目录

- `src/`：Electron 主进程、界面、SVN 检测、Sheet 定位与导表逻辑。
- `一站式导表工具-开发版/`：Unity 工程源码、资源、依赖及项目设置。
- `config.xml`：导表配置示例。
- `debug_bats/`：原始批处理及历史排查样例。
- `tests/`：逻辑回归和 Electron 界面检查。
- `src/faq.html`：可独立打开的离线指南，工具首次启动自动展示；主界面「使用指南 / FAQ」或 F1 可再次打开。

依赖目录、临时日志、登录凭据和生成目录不进入 Git。依赖可通过锁文件还原；绿色版 exe 保存在仓库 Releases 中。

## 本地运行与构建

在 Windows 上安装 Node.js 后执行：

```powershell
npm ci
npm start
npm test
npm run test:ui
npm run test:faq
npm run build -- --config.directories.output=release_1.0.6
```

构建需要能下载 Electron 和 electron-builder 的 Windows 打包组件。实际导表还需要配置项目工具目录、业务脚本和 SVN 命令行工具。自动定位 Sheet 需要支持自动化的 Excel 或 WPS。

## 1.0.6 修复

- 空值显示为“（空值）”，区分日志未提供；兼容没有分隔空格的空值报错，保留 0 等实际值。
- 类型错误显示中文类型说明，并提供检查空白单元格的修改建议。

## 1.0.5 修复

- 重复索引报错直接提取 Excel、页签、字段和重复值；优先使用错误行自带的位置。
- 处理子进程输入流的异步错误；进程退出、管道关闭后停止写入，避免偶发 EPIPE 主进程异常。
- 正常结束不误报；异常退出且没有更具体表错误时显示中文容错弹窗，支持复制信息和查看日志。

## 已保存的还原点

- `backup-before-exclusion-ui-20261013`：1.0.1，强化“不导表”视觉表现之前的完整源码快照。
- `v1.0.2`：粗红边、浅红底、禁止符号、“不导表”标签和排除数量提示。
- `v1.0.3`：离线 FAQ、首次启动引导、F1 快捷键及 SVN / 报错帮助入口。
- 1.0.4：红色不导表卡片、可关闭错误浮层、Excel / 页签 / 字段错误定位、SVN 启动安装指引和用户操作手册。

需要查看旧版时，在独立目录克隆，避免覆盖正在修改的文件：

```powershell
git clone --branch backup-before-exclusion-ui-20261013 https://github.com/yangyuzhou/ExcelExport.git ExcelExport-before-ui
```

日常修改请先提交，再推送：

```powershell
git status
git add <需要保存的文件>
git commit -m "说明本次修改"
git push
```

本仓库不会自动上传后续修改。新版本的可执行文件需另行上传到 Releases。
