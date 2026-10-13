# 一站式导表工具

本仓库保存 Electron 导表工具、Unity 开发版、配置示例、批处理脚本、需求文档和测试。

## 目录

- `src/`：Electron 主进程、界面、SVN 检测、Sheet 定位与导表逻辑。
- `一站式导表工具-开发版/`：Unity 工程源码、资源、依赖及项目设置。
- `config.xml`：导表配置示例。
- `debug_bats/`：原始批处理及历史排查样例。
- `tests/`：逻辑回归和 Electron 界面检查。

依赖目录、临时日志、登录凭据和生成目录不进入 Git。依赖可通过锁文件还原；绿色版 exe 保存在仓库 Releases 中。

## 本地运行与构建

在 Windows 上安装 Node.js 后执行：

```powershell
npm ci
npm start
npm test
npm run test:ui
npm run build -- --config.directories.output=release_1.0.2
```

构建需要能下载 Electron 和 electron-builder 的 Windows 打包组件。实际导表还需要配置项目工具目录、业务脚本和 SVN 命令行工具。自动定位 Sheet 需要支持自动化的 Excel 或 WPS。

## 已保存的还原点

- `backup-before-exclusion-ui-20261013`：1.0.1，强化“不导表”视觉表现之前的完整源码快照。
- `v1.0.2`：粗红边、浅红底、禁止符号、“不导表”标签和排除数量提示。

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
