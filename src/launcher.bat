@echo off

set pwdStr=%cd%

call _batInit.bat
call cd /d %cd%\..\..\..\tools\batch

set synToLuaServer=1

::传入项目名和批处理当前目录，注意这里补上了 %7 (即 %inputName%) 以支持增量传参
call toClientPy.bat 1 %toPath% %configPath% %luaPath% %xmlPath% %designRoot% %7


call cd /d %pwdStr%

call pause;