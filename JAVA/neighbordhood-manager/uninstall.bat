@echo off
setlocal

set "APP_NAME=PetitsSecretsVoisins"
set "INSTALL_DIR=%LOCALAPPDATA%\%APP_NAME%"
set "DESKTOP=%USERPROFILE%\Desktop"

echo ============================================
echo  Desinstallation de Petits Secrets Entre Voisins
echo ============================================
echo.

set /p "CONFIRM=Voulez-vous vraiment desinstaller l'application ? (O/N) : "
if /i not "%CONFIRM%"=="O" (
    echo Desinstallation annulee.
    pause
    exit /b 0
)

:: Suppression du raccourci Bureau
if exist "%DESKTOP%\Petits Secrets Voisins.lnk" (
    del /F "%DESKTOP%\Petits Secrets Voisins.lnk"
    echo Raccourci Bureau supprime.
)

:: Suppression de la cle de registre (Programmes et fonctionnalites)
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\%APP_NAME%" /f >nul 2>&1
echo Entree registre supprimee.

:: Suppression du dossier d'installation
if exist "%INSTALL_DIR%" (
    rmdir /S /Q "%INSTALL_DIR%"
    echo Dossier d'installation supprime : %INSTALL_DIR%
) else (
    echo L'application ne semble pas etre installee.
)

echo.
echo ============================================
echo  Desinstallation terminee.
echo ============================================
pause
