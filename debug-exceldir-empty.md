# Debug Session: exceldir-empty
- **Status**: [OPEN]
- **Issue**: 用户真实环境中，`xmlPath` 已恢复正常，但 `excelDir` 在业务 bat 运行后仍为空，日志同时出现 `'1Dir' 不是内部或外部命令` 与 `'xce1Outdir' 不是内部或外部命令`，说明 patched bat 注入或换行可能污染了后续变量行。
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-exceldir-empty.ndjson`

## Reproduction Steps
1. 在工具中执行导表，触发 [src/main.js](file:///d:/traeWork/ExcelExport/src/main.js) 生成临时 patched bat。
2. 观察工具日志中的 `[RUNNER_V6_DIAG_1ST]`、业务 echo、`excelDir=...`、`xmlPath=...` 以及 `1Dir` / `xce1Outdir` 报错。
3. 对比生成的临时 bat 内容与运行时日志。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | `firstDiagnose` 注入块前后换行不完整，导致下一行 `set excelDir` / `set excelOutdir` 被拼接或吞首字母，实际执行成 `1Dir` / `xce1Outdir` | High | Low | Pending |
| B | `OLD_SET_EXCELDIR` 的替换结果写进了错误位置，或被后续业务代码再次覆盖为空 | High | Low | Pending |
| C | 生成 patched bat 时 GBK 编码下某行包含中文路径，导致注入块后的首字符被错误吞掉，不是业务逻辑问题而是字节级断行问题 | High | Medium | Pending |
| D | 实际运行的并不是最新的 patched bat，日志里修复项与落盘文件内容不一致 | Medium | Low | Pending |
| E | `excelDir` 依赖的 `_RUNNER_ARG6` 在写盘正确、但运行时被污染或未按预期展开 | Medium | Medium | Pending |

## Log Evidence
- Debug server started and wrote [`.dbg/exceldir-empty.env`](file:///d:/traeWork/ExcelExport/.dbg/exceldir-empty.env).
- User-provided screenshot of [file:///D:/gctx/project/tools/batch/_tmp_export_target_patched.bat](file:///D:/gctx/project/tools/batch/_tmp_export_target_patched.bat) confirms:
  - `RUNNER_V6_DIAG_1ST` was still injected directly before `set "xmlPathYunWei=..."` / `set "excelDir=..."` / `set excelOutdir=...`
  - generated line still contained `%_RUNNER_ARG5%4yunwei`
- User-provided runtime log confirms suspicious lines appear immediately after `RUNNER_V6_DIAG_1ST`:
  - `'1Dir' 不是内部或外部命令`
  - `'xce1Outdir' 不是内部或外部命令`

## Verification Table
| ID | Hypothesis | Status | Evidence Summary |
|----|------------|--------|------------------|
| A | `firstDiagnose` 注入块污染了后续 `set excelDir` / `set excelOutdir` | ✅ Confirmed | 错误正好出现在 `RUNNER_V6_DIAG_1ST` 后面；patched bat 截图也显示注入块紧邻这几行 |
| B | `OLD_SET_EXCELDIR` 写入位置错误或被后续覆盖为空 | ⏳ Inconclusive | patched bat 里能看到 `set "excelDir=..."`，但运行时该行被污染，先移除 1st 注入再验证 |
| C | GBK/断行污染导致首字母被吞 | ✅ Confirmed | 运行时报出的就是截断后的 `1Dir` / `xce1Outdir` |
| D | 实际运行的不是最新 patched bat | ❌ Rejected | 用户截图直接给出了运行时生成的 `_tmp_export_target_patched.bat` |
| E | `_RUNNER_ARG6` 展开异常 | ❌ Rejected | 日志里 `RUNNER_ARG_orig_design=[D:\gctx\project\e1_dev\design]` 是正确的 |

## Verification Conclusion
- Minimal fix applied in [src/main.js](file:///d:/traeWork/ExcelExport/src/main.js):
  - remove `RUNNER_V6_DIAG_1ST` injection from patched bat generation
  - normalize `xml4yunwei` to `xmlyunwei`
  - rewrite `excelOutdir` to use `%_RUNNER_ARG6%`
