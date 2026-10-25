@echo off
rem Runs the lab copy of Codex CLI in this console window. Started by open-codex.cmd (through Explorer).
rem The lab folder defaults to C:\vxlab: npm164 holds the npm install of Codex CLI 0.164.0, home is its own Codex home folder.
title vxlab-codex
if "%VXLAB%"=="" set VXLAB=C:\vxlab
set /p CODEX_ARGS=<"%~dp0args.txt"
set CODEX_HOME=%VXLAB%\home
cd /d %VXLAB%
"%VXLAB%\npm164\node_modules\.bin\codex.cmd" %CODEX_ARGS%
echo.
echo [Codex exited with code %errorlevel%]
pause
