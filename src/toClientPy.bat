@echo off
:: 【回滚】移除引发控制台乱码的 UTF-8 强转命令
:: chcp 65001 >nul
:: set PYTHONIOENCODING=utf-8

:: 【Python 2 中文打印乱码终极解决方案】
:: 将控制台强行设置为 GBK (936)，确保与底层 Python 2 的默认输出一致
chcp 936 >nul
set PYTHONIOENCODING=gbk

call _batInit
set /p path=<%drives%envPath.txt

echo 这个批处理用于导出Excel表格
rem 7个参数：%commitSvn% %toPath% %configXmlPath% %luaPath% %xmlPath% %designRootPath% %selectTarget%
:: 【参数接收】使用 %~ 剥离双引号，防止绝对路径带来的语法错误
:: 【参数接收】优先从命令行%1~%7接收（手动CMD调用），没有就从【父CMD/Runner预先set好的环境变量】里继承（工具调用专用，绕开CMD call传参引号魔法）
:: 为什么要 fallback 环境变量：工具端 Runner call 传参时，CMD 在解析带中文/反斜杠的路径参数时，会把每个值外面偷偷再包一层双引号，
::                              bat 内再用 %~1 剥一层就剩一对假引号，最后 echo excelDir="%excelDir%" 又包一层 → 视觉上变成两层引号，
::                              还会把「配置表生成」后面的 \ 咬掉变成假引号，SVN 的 /path: 值就空了。
:: 所以工具侧改成：先 set 好 commitSvn/toPath/configXmlPath/luaPath/xmlPath/designRootPath/selectTarget 这 7 个环境变量，
::                 再 call toClientPy1.bat 不带任何参数 → 下面的 if not defined 就会把这 7 个变量保留原值，不会有多余引号。
rem 7个参数：%commitSvn% %toPath% %configXmlPath% %luaPath% %xmlPath% %designRootPath% %selectTarget%
:: 【参数接收】使用 %~ 剥离双引号，防止绝对路径带来的语法错误
set commitSvn=%~1
set toPath=%~2
set configXmlPath=%~3
set luaPath=%~4
set xmlPath=%~5
set designRootPath=%~6
set selectTarget=%~7
set xmlPathYunWei=%xmlPath%yunwei

:: 构建缓存和数据路径
set excelDir=%designRootPath%\数据填表
set excelOutdir=%designRootPath%\配置表生成
set md5PrePath=%excelOutdir%\md5PreData.conf
set md5PrePathUpdate=%excelOutdir%\md5PreData.conf_update
set updateMd5Files=%excelOutdir%\updateMd5Files.conf

:: 如果目标路径为空，尝试从 _batInit 计算出的 toExportDesignPath 中获取
if not exist "%toPath%" (
set toPath=%toExportDesignPath%
)

set orgConfigPath=%toPath%\manual\Config_Sys.lua
set tmpConfigPath=%drives%Config_Sys.lua

:: 清理临时缓存
del /q "%md5PrePathUpdate%" >nul 2>nul
del /q "%updateMd5Files%" >nul 2>nul

:: 确保运维 XML 目录存在
if not exist "%xmlPathYunWei%" md "%xmlPathYunWei%"

:: 路径为空防御机制
if "%toPath%"=="" (
    echo 不可单独执行该批处理！请与技术联系！！
    pause >nul 2>nul
    echo 不可单独执行该批处理！请与技术联系！！
    pause >nul 2>nul
    echo 不可单独执行该批处理！请与技术联系！！
    pause >nul 2>nul
    goto :eof
)

@setlocal EnableDelayedExpansion

:: 同步 SVN 中的 Config_Sys.lua
if not exist "%orgConfigPath%" (
TortoiseProc.exe /command:update /path:"%orgConfigPath%" /closeonend:1
)

rem 备份本地Config_Sys.lua
call echo F | xcopy "%orgConfigPath%" "%tmpConfigPath%" /y
rem 回滚本地Config_Sys.lua文件
call del /s /q "%orgConfigPath%" >nul 2>nul
TortoiseProc.exe /command:update /path:"%orgConfigPath%" /closeonend:2

:: 同步 SVN 目录
TortoiseProc.exe /command:update /path:"%excelDir%" /closeonend:2
TortoiseProc.exe /command:update /path:"%xmlPath%" /closeonend:2
TortoiseProc.exe /command:update /path:"%xmlPathYunWei%" /closeonend:2

:: Win32 客户端资源目录
set toWin32ResData=%designBase%\%currentCdnName%\win32Realease\res\data
call echo toWin32ResData=%toWin32ResData%

:: 如果启用了同步到 Win32 资源，先更新 SVN
if "%sureSynStr%" == "1" (
TortoiseProc.exe /command:update /path:"%toWin32ResData%" /closeonend:2
)

:: =========================================================
:: 【核心导表引擎】
:: 这里调用 python excelToData.py，并根据是否全量传递参数
:: =========================================================
echo [DEBUG] 准备执行 Python 引擎...
echo [DEBUG] selectTarget=[%selectTarget%]
echo [DEBUG] configXmlPath=[%configXmlPath%]

if "%selectTarget%"=="-1" goto RUN_FULL
if "%selectTarget%"=="" goto RUN_EMPTY
goto RUN_INCREMENTAL

:RUN_FULL
echo [DEBUG] 进入分支：全量导出 (-1)
call python excelToData.py "%configXmlPath%"
goto RUN_DONE

:RUN_EMPTY
echo [WARN] selectTarget 参数为空，执行默认全量导出！
call python excelToData.py "%configXmlPath%"
goto RUN_DONE

:RUN_INCREMENTAL
echo [DEBUG] 进入分支：增量导出
call python excelToData.py "%configXmlPath%" "%selectTarget%"
goto RUN_DONE

:RUN_DONE
:: 【新增】错误捕获与防闪退机制

call echo finish process

:Skip

:: 清理临时缓存
del /q "%md5PrePathUpdate%" >nul 2>nul
del /q "%updateMd5Files%" >nul 2>nul

md "%toPath%"
call echo toPath=%toPath%

:: 清理 Lua 文件的 BOM 头
call python clearBom.py "%luaPath%"
call echo clearmom=%luaPath%

:: 生成全局引用文件
call python createRequireAll.py "%luaPath%"

:: 拷贝到目标客户端路径
xcopy "%luaPath%\*.*" "%toPath%\" /y
rd .\lua /s /q >nul 2>nul
rd .\xml /s /q >nul 2>nul

rem -----------------start
:: 【Luajit 编译与服务端同步逻辑】
if "%synToLuaServer%" == "1" (
    SETLOCAL ENABLEDELAYEDEXPANSION
    set src_noPrintDir=c:\src_noPrint
    set resLua_synDir=c:\resLua_synDir
    
    if exist !src_noPrintDir! (
        rd !src_noPrintDir! /s /q
    )
    call echo src_noPrintDir=!src_noPrintDir!
    md !src_noPrintDir!
    
    if exist !resLua_synDir! (
        rd !resLua_synDir! /s /q
    )
    call echo resLua_synDir=!resLua_synDir!
    md !resLua_synDir!
    
    md !resLua_synDir!\data
    xcopy "%toPath%\*.*" "!resLua_synDir!\data" /s /y >nul
    
    :: 调用 Python 脚本将 Lua 编译为 Luajit 字节码
    call python preCompileLuajit.py 1 !src_noPrintDir! !resLua_synDir!
    if exist compileLuaError.txt (
        call echo call python preCompileLuajit.py 1 !src_noPrintDir! !resLua_synDir! Error
        call echo please see detail in %cd%\compileLuaError.txt
        call pause
    )
    
    :: 同步到服务端 LuaServer_jit 目录
    set pathLuaServerJit=%toPath%\..\..\..\LuaServer_jit
    call del "!pathLuaServerJit!\data\*.lua" /q /s >nul
    call python copyLuaWithType.py 2 !src_noPrintDir! !pathLuaServerJit! !resLua_synDir!\data !pathLuaServerJit!\data
)
rem -------------- end

:: 【SVN 自动提交流程】
if "%commitSvn%"=="1" (
    TortoiseProc.exe /command:add /path:"%toPath%" /closeonend:1
    TortoiseProc.exe /command:commit /path:"%toPath%" /closeonend:1
    TortoiseProc.exe /command:add /path:"%luaPath%*%xmlPath%*%configXmlPath%*%xmlPathYunWei%" /closeonend:1
    TortoiseProc.exe /command:commit /path:"%luaPath%*%xmlPath%*%configXmlPath%*%xmlPathYunWei%" /closeonend:1
    
    :: 还原备份的 Config_Sys.lua
    call echo F | xcopy "%tmpConfigPath%" "%orgConfigPath%" /y
    call del /q "%tmpConfigPath%" >nul 2>nul
)

:: 【Win32 同步与提交流程】
if "%sureSynStr%" == "1" (
    xcopy "%toPath%\*.*" "%toWin32ResData%\" /y
    call TortoiseProc.exe /command:commit /path:"%toWin32ResData%" /closeonend:1
)
