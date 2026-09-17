param(
  [string]$Target = "."
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Copy-Item -Force (Join-Path $ScriptDir "overlay\.firebaserc") (Join-Path $Target ".firebaserc")
Copy-Item -Force (Join-Path $ScriptDir "overlay\firebase.json") (Join-Path $Target "firebase.json")
Copy-Item -Force (Join-Path $ScriptDir "overlay\firestore.rules") (Join-Path $Target "firestore.rules")
New-Item -ItemType Directory -Force (Join-Path $Target "src\firebase") | Out-Null
Copy-Item -Force (Join-Path $ScriptDir "overlay\src\firebase\firebase.js") (Join-Path $Target "src\firebase\firebase.js")

Write-Host "적용 완료: $Target"
Write-Host "다음: Firebase Console에서 Anonymous Auth 활성화 후 firebase deploy --only firestore:rules"
