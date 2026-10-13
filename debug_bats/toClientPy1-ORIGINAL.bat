@echo off
rem chcp 936 >nul
call _batInit
set /p path=<%drives%envPath.txt

echo 这个批处理用于导出Excel表格
echo this is for excel

rem 7个参数：%commitSvn% %toPath% %configPath% %luaPath% %xmlPath% %designRoot% %selectTarget%
set commitSvn=%1
set toPath=%2
set configPath=%3
set luaPath=%4
set xmlPath=%5
set designRoot=%6
set selectTarget=%7
set xmlPathYunWei=%xmlPath%yunwei

set excelDir=%designRoot%数据填表
set excelOutdir=%designRoot%配置表生成
set md5PrePath=%excelOutdir%\md5PreData.conf

echo commitSvn=%commitSvn%
echo toPath=%toPath%
echo configPath=%configPath%
echo luaPath=%configXmlPath%
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
set xmlPath=%xmlPathYunWei%

echo orgConfigPath="%toExportDesignPath%\manual\Config_Sys.lua"
echo excelDir="%excelDir%"
echo xmlPath="%xmlPath%"
echo xmlPath="%xmlPathYunWei%"

