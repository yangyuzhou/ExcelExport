@echo off
:: =====================================================
:: 【Runner 自动替换 v6 · 0 修改业务 bat 原文件】本文件是复制+修复版。
:: 修复项：· ① 参数接收7行（通用变量名）命中 = commitSvn/toPath/configPath/luaPath/xmlPath/designRoot/selectTarget → set "xxx=%~n" + 私有备份 _RUNNER_ARG1~7
::         · ② echo luaPath 手滑 → echo luaPath=%luaPath%
::         · ④ set excelDir=...数据填表... → set "excelDir=%_RUNNER_ARG6%\数据填表"（私有 ARG6，不被业务覆盖）
::         · ⑤ set xmlPathYunWei=...yunwei → set "xmlPathYunWei=%_RUNNER_ARG5%yunwei"（私有 ARG5）
::         · ⑥ 兜底：set xmlPath=...yunwei（业务二次覆盖 xmlPath）→ set "xmlPath=%_RUNNER_ARG5%yunwei"，彻底干掉 4yunwei 残留
::         · ⑦ 终极兜底：RUNNER_V6_DIAG_2ND 二次注入（全英文头 + 前后空行，防 GBK 吞字母）
:: =====================================================
rem chcp 936 >nul
call _batInit
set /p path=<%drives%envPath.txt

echo 这个批处理用于导出Excel表格
echo this is for excel

rem 7个参数：%commitSvn% %toPath% %configPath% %luaPath% %xmlPath% %designRoot% %selectTarget%
set "commitSvn=%~1"
set "toPath=%~2"
set "configPath=%~3"
set "luaPath=%~4"
set "xmlPath=%~5"
set "designRoot=%~6"
set "selectTarget=%~7"

set "_RUNNER_ARG1=%~1"
set "_RUNNER_ARG2=%~2"
set "_RUNNER_ARG3=%~3"
set "_RUNNER_ARG4=%~4"
set "_RUNNER_ARG5=%~5"
set "_RUNNER_ARG6=%~6"
set "_RUNNER_ARG7=%~7"


echo ============================================================
echo [RUNNER_V6_DIAG_1ST] After args 7 lines, business code has NOT overwritten vars yet.
echo   Square brackets [] MUST NOT contain double quote 
echo ------------------------------------------------------------
echo RUNNER_ARG_orig_design=[%_RUNNER_ARG6%]
echo RUNNER_ARG_orig_xml=[%_RUNNER_ARG5%]
echo ------------------------------------------------------------
echo ============================================================
set "xmlPathYunWei=%_RUNNER_ARG5%yunwei"
set "excelDir=%_RUNNER_ARG6%\数据填表"
set excelOutdir=%designRoot%配置表生成
set md5PrePath=%excelOutdir%\md5PreData.conf

echo commitSvn=%commitSvn%
echo toPath=%toPath%
echo configPath=%configPath%
echo luaPath=%luaPath%
echo xmlPath=%xmlPath%
echo designRoot=%designRoot%
echo selectTarget=%selectTarget%

rem ---------- [模拟用户真实业务代码：_batInit.bat 后续把 designRoot / xmlPath 覆盖了！这就是 excelDir 空 / 数据填表错位 根因！] ----------
set gameRootDir=%designRoot%配置表生成
set designRoot=%gameRootDir%\..
set toExportDesignPath=%gameRootDir%\..\..\win32Realease\res\data
echo gameRootDir=%gameRootDir%

echo toExportDesignPath=%toExportDesignPath%
set toPath=%toExportDesignPath%
echo toPath22222=%toPath%
echo toPath33333=%toPath%

rem ---------- [模拟用户真实业务二次覆盖：业务 bat 更后面又把 xmlPath 赋值成 xmlPathYunWei（导致 4yunwei 残留）] ----------
set "xmlPath=%_RUNNER_ARG5%yunwei"

echo orgConfigPath="%toExportDesignPath%\manual\Config_Sys.lua"
echo excelDir="%excelDir%"
echo xmlPath="%xmlPath%"
echo xmlPath="%xmlPathYunWei%"





echo ============================================================
echo [RUNNER_V6_DIAG_2ND] AFTER ALL BUSINESS CODE. Values actually used for SVN /path.
echo   Square brackets [] MUST NOT contain double quote character!
echo ------------------------------------------------------------
echo 2ND_RUNNER_ARG6_original_design=[%_RUNNER_ARG6%]
echo 2ND_RUNNER_ARG5_original_xml=[%_RUNNER_ARG5%]
echo ------------------------------------------------------------
echo 2ND_ACTUAL_excelDir=[%excelDir%]
echo 2ND_ACTUAL_excelOutdir=[%excelOutdir%]
echo 2ND_ACTUAL_xmlPath=[%xmlPath%]
echo 2ND_ACTUAL_xmlPathYunWei=[%xmlPathYunWei%]
echo ------------------------------------------------------------
echo 2ND_REAL_SVN_PATH_excelDir="%excelDir%"
echo 2ND_REAL_SVN_PATH_xmlPathYunWei="%xmlPathYunWei%"
echo   ^^^ 这两行就是真正传给 TortoiseProc /path: 的内容，双引号只允许最外层各 1 个，内部绝对不能再有 " ！
echo ============================================================


