@echo off
cd /d "c:\workspace\whatsappRecap"
call npx cap sync
cd android
call gradlew bundleRelease
echo.
echo AAB output:
echo %CD%\app\build\outputs\bundle\release\app-release.aab