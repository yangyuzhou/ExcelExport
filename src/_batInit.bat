:: 关闭批处理命令执行时的回显，让控制台输出更干净
@echo off

:: 【1. 获取当前工作目录】
::生成Lua资源目录 (原有的注释)
:: 将当前脚本执行的绝对路径（Current Directory）赋值给变量 pwdStr
set pwdStr=%cd%

:: 【2. 解析路径，获取相关层级名称】
:: 设置要提取的路径层级变量为第 4 级
set nth=4
:: 以反斜杠 "\" 为分隔符对 pwdStr 进行切割，提取第 4 段的名字，赋值给 currentCdnName
for /F "tokens=%nth% delims=\" %%a in ("%pwdStr%") do set currentCdnName=%%a

:: 设置要提取的路径层级变量为第 3 级
set nth=3
:: 以反斜杠 "\" 为分隔符对 pwdStr 进行切割，提取第 3 段的名字，赋值给 projectBaseName (项目基础名)
for /F "tokens=%nth% delims=\" %%a in ("%pwdStr%") do set projectBaseName=%%a

:: 设置要提取的路径层级变量为第 1 级
set nth=1
:: 以底线 "_" 为分隔符对刚提取的 projectBaseName 进行切割，提取第 1 段，赋值给 projectPre (项目前缀)
for /F "tokens=%nth% delims=_" %%a in ("%projectBaseName%") do set projectPre=%%a

:: 打印提取出来的三个关键名字，用于调试确认
call echo projectPre=%projectPre%
call echo currentCdnName=%currentCdnName%
call echo projectBaseName=%projectBaseName%

:: 【3. 计算游戏客户端的根目录】
:: 依靠刚才提取的项目前缀和CDN名字，向上退 4 级 (..\..\..\..)，拼接出游戏客户端的根目录路径
set gameRootDir=%pwdStr%\..\..\..\..\%projectPre%_client\%currentCdnName%

:: 检查拼接出来的游戏客户端根目录是否存在
if exist %gameRootDir% (
    :: 如果存在，通过 cd /d 跳转到该目录（/d 参数支持跨盘符跳转）
    call cd /d %gameRootDir%
    :: 将 gameRootDir 重新赋值为跳转后的当前路径（目的是为了消除路径中的 ..\，获取干净的绝对路径）
    set gameRootDir=%cd%
)

:: 刚才可能跳转了目录，现在强制切回到脚本最开始所在的目录，保证后续逻辑不受影响
call cd /d %pwdStr%

:: 打印最终计算出来的游戏根目录绝对路径
call echo gameRootDir=%gameRootDir%

:: 【4. 设置各类资源的生成与配置文件路径】
:: 设置 Lua 资源存放的绝对路径
set luaPath=%pwdStr%\lua

::生成xml资源目录 (原有的注释)
:: 设置 XML 资源存放的绝对路径
set xmlPath=%pwdStr%\xml

::配置文件目录 (原有的注释)
:: 设置配置文件的绝对路径
set configPath=%pwdStr%\config.xml

:: 【5. 计算数据导出路径】
::导出保存目录 (原有的注释)
:: 拼接出最终导出数据要拷贝到客户端的具体目录（基于前面算好的 gameRootDir）
set toPath=%gameRootDir%\clientCode\trunk\xxsg\res\data
:: 打印该目标路径
call echo toPath=%toPath%

:: 拼接出用于 win32 释放版本的资源导出目录 (退两级目录)
set toExportDesignPath=%pwdStr%\..\..\win32Realease\res\data
:: 打印该 win32 导出路径
call echo toExportDesignPath=%toExportDesignPath%

:: 下面这段被 rem 注释掉了：原本的作用和计算 gameRootDir 时一样，是为了把包含 ..\ 的相对路径转换为绝对路径
rem if exist %toExportDesignPath% (
rem call cd /d %toExportDesignPath%
rem set toExportDesignPath=%cd%
rem )

:: 再次确保当前处于原始脚本目录（防止上面的注释代码某天被打开后，没有切回来）
call cd /d %pwdStr%
:: 再次打印 win32 导出路径
call echo toExportDesignPath=%toExportDesignPath%

:: 【6. 设置设计根目录】
:: 将当前脚本所在目录的上一级目录，设置为 designRoot 变量
set designRoot=%cd%\..