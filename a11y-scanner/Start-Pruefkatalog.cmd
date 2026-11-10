@echo off
setlocal
call "%~dp0Start-Desktop.cmd" %*
exit /b %errorlevel%
