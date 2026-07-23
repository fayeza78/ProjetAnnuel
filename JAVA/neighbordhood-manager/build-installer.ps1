$ErrorActionPreference = "Stop"
$base = "C:\Users\utilisateur\ProjetAnnuel\JAVA\neighbordhood-manager"
$jpackage = "C:\Users\utilisateur\.jdks\openjdk-25\bin\jpackage.exe"

Write-Host "=== Etape 1 : Repackaging JAR ===" -ForegroundColor Cyan
$env:MAVEN_OPTS = "-Djavax.net.ssl.trustStoreType=WINDOWS-ROOT"
$env:JAVA_HOME = "C:\Program Files\JetBrains\IntelliJ IDEA Community Edition 2025.2.3\jbr"
& "C:\Program Files\JetBrains\IntelliJ IDEA Community Edition 2025.2.3\plugins\maven\lib\maven3\bin\mvn.cmd" -f "$base\pom.xml" package -DskipTests
if ($LASTEXITCODE -ne 0) { Write-Host "ERREUR : mvn package a echoue" -ForegroundColor Red; exit 1 }

Write-Host "=== Etape 2 : Creation de l app autonome ===" -ForegroundColor Cyan
Remove-Item -Recurse -Force "$base\installer" -ErrorAction SilentlyContinue
& $jpackage --type app-image --name "PetitsSecretsVoisins" --app-version "1.0" --input "$base\target" --main-jar "neighbordhood-manager-1.jar" --dest "$base\installer" --vendor "Neighborhood Manager"
if ($LASTEXITCODE -ne 0) { Write-Host "ERREUR : jpackage a echoue" -ForegroundColor Red; exit 1 }

Write-Host "=== Etape 3 : Creation du ZIP ===" -ForegroundColor Cyan
$zip = "$env:USERPROFILE\Desktop\PetitsSecretsVoisins-v1.0.zip"
Remove-Item $zip -ErrorAction SilentlyContinue
Compress-Archive -Path "$base\installer\PetitsSecretsVoisins" -DestinationPath $zip
Write-Host "ZIP cree sur le Bureau : $zip" -ForegroundColor Green
Write-Host "Termine ! Distribue le ZIP - aucune installation Java requise." -ForegroundColor Green
