@echo off
setlocal EnableDelayedExpansion

set "APP_NAME=PetitsSecretsVoisins"
set "INSTALL_DIR=%LOCALAPPDATA%\%APP_NAME%"
set "JAR_FILE=neighbordhood-manager-1.jar"
set "DESKTOP=%USERPROFILE%\Desktop"

echo ============================================
echo  Installation de Petits Secrets Entre Voisins
echo ============================================
echo.

:: Recherche de Java (PATH, JAVA_HOME, ou emplacements connus)
set "JAVA_EXE=java"
java -version >nul 2>&1
if errorlevel 1 (
    if exist "%JAVA_HOME%\bin\java.exe" (
        set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
    ) else if exist "%USERPROFILE%\.jdks\openjdk-25\bin\java.exe" (
        set "JAVA_EXE=%USERPROFILE%\.jdks\openjdk-25\bin\java.exe"
    ) else (
        echo ERREUR : Java n'est pas installe ou introuvable dans le PATH.
        echo Telechargez Java 21 sur : https://adoptium.net/
        pause
        exit /b 1
    )
)

for /f "tokens=3" %%g in ('"%JAVA_EXE%" -version 2^>^&1 ^| findstr /i "version"') do (
    set "JAVA_VERSION=%%g"
)
echo Java detecte : !JAVA_VERSION!

:: Verification du JAR
if not exist "%~dp0target\%JAR_FILE%" (
    echo ERREUR : Le fichier JAR introuvable : target\%JAR_FILE%
    echo Lancez d'abord : mvn package
    pause
    exit /b 1
)

:: Creation du repertoire d'installation
echo Installation dans : %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Copie du JAR
echo Copie du fichier JAR...
copy /Y "%~dp0target\%JAR_FILE%" "%INSTALL_DIR%\%JAR_FILE%" >nul

:: Creation du script de lancement (sans fenetre console)
echo Création du lanceur...
(
    echo @echo off
    echo cd /d "%INSTALL_DIR%"
    echo start "" "!JAVA_EXE:java.exe=javaw.exe!" -jar "%INSTALL_DIR%\%JAR_FILE%"
) > "%INSTALL_DIR%\launch.bat"

:: Creation du raccourci Bureau
echo Creation du raccourci Bureau...
powershell -NoProfile -Command ^
    "$ws = New-Object -ComObject WScript.Shell;" ^
    "$s = $ws.CreateShortcut('%DESKTOP%\Petits Secrets Voisins.lnk');" ^
    "$s.TargetPath = '%INSTALL_DIR%\launch.bat';" ^
    "$s.WorkingDirectory = '%INSTALL_DIR%';" ^
    "$s.WindowStyle = 7;" ^
    "$s.Description = 'Petits secrets Entre Voisins';" ^
    "$s.Save()"

:: Enregistrement dans le registre pour Ajout/Suppression de programmes
echo Enregistrement dans Programmes et fonctionnalites...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\%APP_NAME%" /v "DisplayName" /d "Petits Secrets Entre Voisins" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\%APP_NAME%" /v "UninstallString" /d "\"%INSTALL_DIR%\uninstall.bat\"" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\%APP_NAME%" /v "DisplayVersion" /d "1.0" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\%APP_NAME%" /v "Publisher" /d "Neighborhood Manager" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\%APP_NAME%" /v "NoModify" /t REG_DWORD /d 1 /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\%APP_NAME%" /v "NoRepair" /t REG_DWORD /d 1 /f >nul

:: Copie du desinstallateur
copy /Y "%~dp0uninstall.bat" "%INSTALL_DIR%\uninstall.bat" >nul

echo.
echo ============================================
echo  Installation terminee avec succes !
echo  - Dossier : %INSTALL_DIR%
echo  - Raccourci cree sur le Bureau
echo  - Visible dans : Parametres ^> Applications
echo ============================================
pause
