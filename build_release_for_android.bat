@echo off
cd /d "c:\workspace\whatsappRecap"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bump-version-code.ps1"
if errorlevel 1 (
  echo Version bump failed, aborting.
  exit /b 1
)
call npx cap sync
cd android
call gradlew bundleRelease
echo.
echo AAB output:
echo %CD%\app\build\outputs\bundle\release\app-release.aab