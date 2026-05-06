@echo off
REM One-command setup wrapper for Windows.
REM Forwards all args to scripts\setup.mjs.

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo X Node.js is not installed.
  echo   Install Node 20+ from https://nodejs.org/ and re-run setup.cmd
  exit /b 1
)

node "%~dp0scripts\setup.mjs" %*
exit /b %ERRORLEVEL%
