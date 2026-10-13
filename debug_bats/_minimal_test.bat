@echo off
chcp 936 >nul

set commitSvn=%1
set toPath=%2
set configPath=%3
set luaPath=%4
set xmlPath=%5
set designRoot=%6
set selectTarget=%7

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

echo RUNNER_1ST_ARG6=[%_RUNNER_ARG6%]
echo RUNNER_1ST_ARG5=[%_RUNNER_ARG5%]

set gameRootDir=%designRoot%\配置表生成
set designRoot=%gameRootDir%\..
echo BUSINESS_OVERWRITTEN_designRoot=[%designRoot%]
echo BUSINESS_OVERWRITTEN_gameRootDir=[%gameRootDir%]

set "excelDir=%_RUNNER_ARG6%\数据填表"
set "xmlPathYunWei=%_RUNNER_ARG5%yunwei"

set "xmlPath=%_RUNNER_ARG5%yunwei"

echo excelDir="%excelDir%"
echo xmlPath="%xmlPath%"
echo xmlPathYunWei="%xmlPathYunWei%"

echo ============================================================
echo [RUNNER_V6_DIAG_2ND] AFTER ALL BUSINESS CODE
echo 2ND_RUNNER_ARG6=[%_RUNNER_ARG6%]
echo 2ND_RUNNER_ARG5=[%_RUNNER_ARG5%]
echo 2ND_ACTUAL_excelDir=[%excelDir%]
echo 2ND_ACTUAL_xmlPath=[%xmlPath%]
echo 2ND_ACTUAL_xmlPathYunWei=[%xmlPathYunWei%]
echo 2ND_REAL_SVN_PATH_excelDir="%excelDir%"
echo 2ND_REAL_SVN_PATH_xmlPathYunWei="%xmlPathYunWei%"
echo ============================================================
