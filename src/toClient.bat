@echo off
:: 【设置编码】强制将当前 CMD 窗口的编码设为 UTF-8，防止 Electron 接收输出时产生中文乱码
chcp 65001 >nul

:: 【环境初始化】调用 _batInit.bat 脚本，它会根据当前路径计算出项目的各个节点目录（虽然在 Electron 中这些路径已明确指定）
call _batInit

:: 【读取环境变量】从当前驱动器下的 envPath.txt 读取路径环境变量
set /p path=<%drives%envPath.txt

echo 这个批处理用于导出Excel表格
rem 5个参数：%commitSvn% %toPath% %configXmlPath% %luaPath% %xmlPath% %selectTarget%

:: 【接收参数】使用 %~1 到 %~7 接收外部（Electron）传来的 7 个参数。使用 `~` 可以剥离参数两边的双引号，防止后续拼接路径时出现语法错误
set commitSvn=%~1
set toPath=%~2
set configXmlPath=%~3
set luaPath=%~4
set xmlPath=%~5
set designRootPath=%~6
set selectTarget=%~7

echo ==================增量参数调试信息==========
echo [debnug]传入的参数总数分析
echo Arg1 (commitSvn):%commitSvn%
echo Arg2 (toPath):%toPath%
echo Arg3 (configXmlPath):%configXmlPath%
echo Arg4 (luaPath):%luaPath%
echo Arg5 (xmlPath):%xmlPath%
echo Arg6 (designRootPath):%designRootPath%
echo Arg7 (selectTarget): %selectTarget%
echo ==========================================

:: 【构建路径变量】根据传入的根目录构建 Excel 表格所在目录以及各类缓存、配置文件路径
set excelDir=%designRootPath%\数据填表
set md5PrePath=%designRootPath%\配置表生成\md5PreData.conf
set md5PrePathUpdate=%designRootPath%\配置表生成\md5PreData.conf_update
set updateMd5Files=%designRootPath%\配置表生成\updateMd5Files.conf
set errorExcelPath=excelOutError.txt
:: opType 标志位：0 表示默认的自动推导增量模式，1 表示强制指定文件的模式
set opType=0
:: 系统配置 Lua 文件的目标路径和临时备份路径
set orgConfigPath=%toPath%\manual\Config_Sys.lua
set tmpConfigPath=%drives%Config_Sys.lua

:: 【清理临时文件】每次运行前，先静默删除历史报错日志和临时的 MD5 缓存文件
del /q %errorExcelPath% >nul 2>nul
del /q %md5PrePathUpdate% >nul 2>nul
del /q %updateMd5Files% >nul 2>nul

rem if exist %md5PrePath% (
rem     TortoiseProc.exe /command:update /path:"%md5PrePath%" /closeonend:2
rem )

:: 【预处理脚本】执行 python 脚本进行通用的预处理或配置检查（9011是预设的命令码）
call python utilsCommon.py 9011 %configXmlPath%

:: 【安全校验】如果产物输出路径为空，说明参数传递严重缺失，弹窗警告并终止执行
if "%toPath%"=="" (
    echo 不可单独执行该批处理！请与技术联系！！
    pause >nul 2>nul
    echo 不可单独执行该批处理！请与技术联系！！
    pause >nul 2>nul
    echo 不可单独执行该批处理！请与技术联系！！
    pause >nul 2>nul
    goto :eof
)

:: 开启延迟环境变量扩展，以便在 for 循环等代码块中能够实时读取变量（!变量名!）
@setlocal EnableDelayedExpansion

:: 【SVN 同步 Config_Sys.lua】如果目标文件不存在，则先从 SVN 拉取
if not exist %orgConfigPath% (
TortoiseProc.exe /command:update /path:"%orgConfigPath%" /closeonend:1
)

rem 备份本地Config_Sys.lua
:: 强行覆盖拷贝原文件到临时驱动器作为备份
call echo F | xcopy %orgConfigPath% %tmpConfigPath% /y
rem 回滚本地Config_Sys.lua文件
:: 删除原文件，然后重新从 SVN 拉取最新版本，保证后续合并的基础是最新的
call del /s /q %orgConfigPath% >nul 2>nul
TortoiseProc.exe /command:update /path:"%orgConfigPath%" /closeonend:2

rem echo 是否要运行导表工具，还是直接拷贝此目录[%luaPath%]下现存的文件到[%toPath%] ? \n(Y: 运行导表工具生成新lua并拷贝(5秒后自动选择此项)     N: 不导表直接拷贝现存lua)?
rem choice /c:yn /t:5 /d:y
rem call echo !errorlevel!
rem if !errorlevel!==2 goto Skip

:: 【SVN 同步数据目录】将源 Excel 目录、目标 Lua 和 XML 目录更新到最新版本
TortoiseProc.exe /command:update /path:"%excelDir%" /closeonend:2
TortoiseProc.exe /command:update /path:"%luaPath%" /closeonend:2
TortoiseProc.exe /command:update /path:"%xmlPath%" /closeonend:2

:: 【目标解析与判定】判断是全量、还是由程序算差异增量、还是由外部（Electron）强制指定的增量
if "%selectTarget%"=="" (
    :: 如果外部没有传入指定文件，则调用 python 脚本对比 MD5 算出修改了哪些文件，写入 updateMd5Files
    call python excelSelect.py %opType% %excelDir% %md5PrePath% %updateMd5Files% %configXmlPath%
    if exist %updateMd5Files% (
        :: 读取被修改的文件列表，将结果赋给 selectTarget
        for /f "delims=: tokens=1-2" %%i in (%updateMd5Files%) do (
            set selectTarget=%%i
        )
    ) else (
        :: 如果没有找到修改的文件，将 target 设为 -1，触发全量导表防御机制
        set selectTarget=-1
    )
) else (
    :: 如果外部（Electron）传入了被勾选修改的文件（用逗号或#拼接），则进入强制模式
    set opType=1
    rem call echo python excelSelect.py 9001 %excelDir% %selectTarget% %errorExcelPath%
    :: 调用 python 脚本对指定文件进行校验，如果报错会输出到 errorExcelPath
    call python excelSelect.py 9001 %excelDir% %selectTarget% %errorExcelPath%
    if exist %errorExcelPath% (
        :: 如果发现指定的文件有误（比如不存在），报错并恢复之前备份的 Config_Sys.lua，终止流程
        call echo 指定的文件不存在:[%selectTarget%]
        call echo F | xcopy %tmpConfigPath% %orgConfigPath% /y
        del %tmpConfigPath% /q >nul 2>nul
        call pause
        goto :eof
    )
)

:: 【空目标拦截】如果走到这里 selectTarget 还是空，说明没有需要导出的东西，跳过导表直接进入扫尾阶段
if "%selectTarget%"=="" (
    call echo 没有文件需要重新生成
    goto Skip
    goto :eof
)

call echo %selectTarget%
:: 【全量前置清理】如果是全量导表（-1），则先暴力清空旧的 Lua 产物目录
if "%selectTarget%" EQU "-1" del %luaPath%\*.* /q

call echo 配置生成工具.exe %selectTarget%,%configXmlPath%

:: 【执行核心导表（全量）】调用真实的导出引擎
if "%selectTarget%" EQU "-1" (
    call 配置生成工具.exe %selectTarget%,%configXmlPath%
)

:: 初始化待修复的 Lua 文件变量
set fixLuaFiles="-1"

:: 【执行核心导表（增量）】调用真实的导出引擎处理指定的文件
if "%selectTarget%" NEQ "-1" (
    call 配置生成工具.exe %selectTarget%,%configXmlPath%

    rem 通过excel名称获取对应的所有lua文件，从而对指定的lua文件进行优化
    :: 调用 python 脚本分析这次增量导表到底影响了哪些最终的 Lua 文件
    del /s /q getLuasByExcelNameLog.log >nul 2>nul
    call python getLuasByExcelName.py %configXmlPath% %selectTarget% > getLuasByExcelNameLog.log
    for /f "delims=: tokens=1-2" %%i in (getLuasByExcelNameLog.log) do (
        set fixLuaFiles=%%i
    )
    del /s /q getLuasByExcelNameLog.log >nul 2>nul
)

rem 此处只修改通过toClient_byName调用，只修改指定文件的MD5值
:: 【更新缓存】在指定文件增量模式下，导表成功后需要更新这部分文件的 MD5 缓存记录
if "%opType%" NEQ "0" (
call python excelSelect.py %opType% %excelDir% %md5PrePath% %updateMd5Files% %selectTarget% %configXmlPath%
)

call echo errorExcelPath=%errorExcelPath%
:: 【错误检测与缓存回滚】
if not exist %errorExcelPath% (
    :: 如果导表过程没有报错，将本次更新的 MD5 缓存（.conf_update）正式覆盖到主缓存中
    if exist %md5PrePathUpdate% (
        call copy %md5PrePathUpdate% %md5PrePath%
    )
) else (
    :: 如果导表过程中产生了错误日志，说明失败了。恢复之前备份的 Config_Sys.lua，中止流程
    call echo error =%errorExcelPath%
    call echo F | xcopy %tmpConfigPath% %orgConfigPath% /y
    del %tmpConfigPath% /q >nul 2>nul
    call pause
    goto :eof
)

:Skip

:: 【清理临时缓存】导表完成或跳过后，清理过程中的 MD5 对比临时文件
del /q %md5PrePathUpdate% >nul 2>nul
del /q %updateMd5Files% >nul 2>nul

:: 确保目标输出路径存在
md %toPath%
call echo toPath=%toPath%
:: 【清除 BOM 头】调用 python 脚本清除生成的 Lua 文件的 BOM 头，防止客户端解析报错
call python clearBom.py %luaPath%
call echo clearbom=%luaPath%

rem @chcp 65001 >nul
rem call lua DataTableOptimizer.lua %luaPath% %luaPath% !fixLuaFiles!

:: 【全局配置生成】如果是全量导表，需要清理全局配置文件 RequireAllConfig.lua 的 BOM
if "%selectTarget%" EQU "-1" (
rem 全部生成进，重新生成RequireAllConfig.lua配置文件，否则为空文件
call python clearBom.py .\lua
rem echo f | xcopy .\lua\RequireAllConfig.lua %luaPath%\RequireAllConfig.lua /y
rem del %toPath%\*.* /q
)

:: 【重建全局索引】根据生成的 Lua 文件，重建全局的 RequireAllConfig.lua 索引脚本
call python createRequireAll.py %luaPath%

:: 【资源拷贝】将生成的 Lua 文件全盘拷贝到目标游戏工程目录
xcopy %luaPath%\*.* %toPath%\ /y
:: 清理本地生成的临时产物目录
rd .\lua /s /q >nul 2>nul
rd .\xml /s /q >nul 2>nul

:: 【SVN 自动提交】如果开启了提交流程（参数1 为 1）
if "%commitSvn%"=="1" (
:: 将产生变动的目录全部 add 到 SVN
TortoiseProc.exe /command:add /path:"%toPath%*%luaPath%*%xmlPath%*%configXmlPath%" /closeonend:1
:: 弹窗执行 commit
TortoiseProc.exe /command:commit /path:"%toPath%*%luaPath%*%xmlPath%*%configXmlPath%" /closeonend:1
:: 提交完成后，把本地修改过或还原过的 Config_Sys.lua 用最开始的备份恢复回去，保持本地环境纯净
call echo F | xcopy %tmpConfigPath% %orgConfigPath% /y
call del /q !tmpConfigPath! >nul 2>nul
)