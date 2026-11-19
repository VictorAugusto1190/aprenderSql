$ErrorActionPreference = "Stop"

$credentialsPath = Join-Path $PSScriptRoot "data\admin-credentials.json"
$oldUsername = $env:ADMIN_INITIAL_USERNAME
$oldPassword = $env:ADMIN_INITIAL_PASSWORD
$oldPort = $env:PORT
$secretPointer = [IntPtr]::Zero

try {
  if (-not (Test-Path $credentialsPath)) {
    $username = Read-Host "Usuário ADM [edcarlos]"
    if ([string]::IsNullOrWhiteSpace($username)) {
      $username = "edcarlos"
    }

    $securePassword = Read-Host "Senha ADM inicial" -AsSecureString
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $env:ADMIN_INITIAL_USERNAME = $username
    $env:ADMIN_INITIAL_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  }

  $apiPort = 0
  for ($candidate = 4173; $candidate -le 4192; $candidate++) {
    $listener = $null
    try {
      $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidate)
      $listener.Start()
      $apiPort = $candidate
      break
    } catch [System.Net.Sockets.SocketException] {
    } finally {
      if ($null -ne $listener) {
        $listener.Stop()
      }
    }
  }
  if ($apiPort -eq 0) {
    throw "Não foi possível encontrar uma porta livre entre 4173 e 4192 para o servidor ADM."
  }
  $env:PORT = [string]$apiPort

  Set-Location $PSScriptRoot
  node (Join-Path $PSScriptRoot "server.js")
  if ($LASTEXITCODE -ne 0) {
    throw "O servidor terminou com erro."
  }
}
finally {
  if ($secretPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
  }

  if ($null -eq $oldUsername) {
    Remove-Item Env:ADMIN_INITIAL_USERNAME -ErrorAction SilentlyContinue
  } else {
    $env:ADMIN_INITIAL_USERNAME = $oldUsername
  }

  if ($null -eq $oldPassword) {
    Remove-Item Env:ADMIN_INITIAL_PASSWORD -ErrorAction SilentlyContinue
  } else {
    $env:ADMIN_INITIAL_PASSWORD = $oldPassword
  }

  if ($null -eq $oldPort) {
    Remove-Item Env:PORT -ErrorAction SilentlyContinue
  } else {
    $env:PORT = $oldPort
  }
}
