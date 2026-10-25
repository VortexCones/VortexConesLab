@echo off
rem Opens the lab Codex like a double-click: Explorer starts run-codex.cmd, so the new window is not tied to this terminal.
rem Optional arguments are passed on to codex, for example:  open-codex.cmd --no-daemon
>"%~dp0args.txt" echo(%*
explorer.exe "%~dp0run-codex.cmd"
echo Opening Codex in its own window...
