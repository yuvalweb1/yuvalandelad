@echo off
cd /d "c:\workspace\whatsappRecap"

rem --- Make sure Gradle can find a JDK (Android Studio's bundled one) ---
if not defined JAVA_HOME set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
if not exist "%JAVA_HOME%\bin\java.exe" (
  echo ERROR: No JDK found at "%JAVA_HOME%".
  echo Set JAVA_HOME to your JDK install and try again.
  exit /b 1
)

rem --- Bump versionCode ---
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bump-version-code.ps1"
if errorlevel 1 (
  echo Version bump failed, aborting.
  exit /b 1
)

rem --- Sync web assets into the Android project ---
call npx cap sync
if errorlevel 1 (
  echo cap sync failed, aborting.
  exit /b 1
)

rem --- Build the release App Bundle ---
cd android
call gradlew bundleRelease
if errorlevel 1 (
  echo.
  echo BUILD FAILED - no AAB was produced. See the gradle errors above.
  exit /b 1
)

echo.
echo BUILD OK. AAB output:
echo %CD%\app\build\outputs\bundle\release\app-release.aab
