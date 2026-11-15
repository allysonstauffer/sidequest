param(
  [ValidateSet("local", "network")]
  [string]$Mode
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

if (-not $Mode) {
  Write-Host "how do you want to run sidequest:"
  Write-Host "  1) local"
  Write-Host "  2) network"
  $choice = Read-Host "enter 1 or 2"

  switch ($choice) {
    "1" { $Mode = "local" }
    "2" { $Mode = "network" }
    default { throw "invalid choice. enter 1 or 2." }
  }
}

$hostAddress = if ($Mode -eq "network") { "0.0.0.0" } else { "127.0.0.1" }
$backendProcess = $null
$frontendProcess = $null
$exitCode = 0

try {
  Set-Location $repoRoot

  $venvPython = Join-Path $repoRoot ".venv/Scripts/python.exe"
  if (-not (Test-Path $venvPython)) {
    $pythonLauncher = Get-Command py -ErrorAction SilentlyContinue
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonLauncher) {
      Write-Host "venv not found, creating"
      & $pythonLauncher.Source -3 -m venv (Join-Path $repoRoot ".venv")
    }
    elseif ($pythonCommand) {
      Write-Host "venv not found, creating"
      & $pythonCommand.Source -m venv (Join-Path $repoRoot ".venv")
    }
    else {
      throw "need python3 to run backend"
    }

    if ($LASTEXITCODE -ne 0) {
      throw "could not create venv"
    }
  }

  if (-not (Test-Path $venvPython)) {
    throw "could not find python in venv"
  }

  & $venvPython -c "import fastapi, supabase, PIL, dotenv" 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "installing reqs"
    & $venvPython -m pip install -r (Join-Path $repoRoot "packages/sidequest-backend/requirements.txt")
    if ($LASTEXITCODE -ne 0) {
      throw "could not install reqs"
    }
  }

  $env:PATH = "$(Split-Path -Parent $venvPython);$env:PATH"
  $backendCommand = "npm run dev -- --host $hostAddress"
  $frontendCommand = "npm run dev --workspace=sidequest-frontend -- --host $hostAddress --port 5173 --strictPort"
  $backendProcess = Start-Process `
    -FilePath $env:ComSpec `
    -ArgumentList "/c `"$backendCommand`"" `
    -NoNewWindow `
    -PassThru
  $frontendProcess = Start-Process `
    -FilePath $env:ComSpec `
    -ArgumentList "/c `"$frontendCommand`"" `
    -NoNewWindow `
    -PassThru

  Write-Host ""
  Write-Host "backend:  http://${hostAddress}:8000"
  Write-Host "frontend: http://${hostAddress}:5173"
  if ($Mode -eq "network") {
    Write-Host "to connect others, replace 0.0.0.0 with this computer's ip."
    Write-Host "ctrl c to stop"
    Write-Host ""
  }
  else {
    Write-Host "ctrl c to stop."
    Write-Host ""
  }

  while (-not $backendProcess.HasExited -and -not $frontendProcess.HasExited) {
    Start-Sleep -Seconds 1
    $backendProcess.Refresh()
    $frontendProcess.Refresh()
  }

  if ($backendProcess.HasExited) {
    $exitCode = $backendProcess.ExitCode
    [Console]::Error.WriteLine("backend stopped (exit $exitCode)")
  }
  if ($frontendProcess.HasExited) {
    if ($exitCode -eq 0) {
      $exitCode = $frontendProcess.ExitCode
    }
    [Console]::Error.WriteLine("frontend stopped (exit $($frontendProcess.ExitCode))")
  }
}
finally {
  foreach ($process in @($backendProcess, $frontendProcess)) {
    if ($null -ne $process -and -not $process.HasExited) {
      & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null
    }
  }
}

exit $exitCode
