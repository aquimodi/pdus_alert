# =============================================================================
# monitor-nginx.ps1 - Monitor y auto-reinicio de Nginx para Windows
# =============================================================================
#
# Este script comprueba si el proceso nginx.exe esta activo y lo reinicia
# si detecta que se ha detenido. Registra todos los eventos en un fichero
# de log independiente para tener trazabilidad completa fuera de Nginx.
#
# USO MANUAL (PowerShell):
#   .\monitor-nginx.ps1
#
# INSTALACION COMO TAREA PROGRAMADA (requiere Administrador):
#   .\monitor-nginx.ps1 -Install
#
# DESINSTALACION DE LA TAREA PROGRAMADA:
#   .\monitor-nginx.ps1 -Uninstall
#
# =============================================================================

param(
    [switch]$Install,
    [switch]$Uninstall
)

$NginxPath = "D:\nginx"
$NginxExe = "$NginxPath\nginx.exe"
$LogFile = "$NginxPath\logs\nginx-monitor.log"
$LifecycleLog = "$NginxPath\logs\nginx-lifecycle.log"
$TaskName = "NginxMonitor"
$CheckIntervalSeconds = 60
$MaxLogSizeMB = 50

function Write-Log {
    param([string]$Message, [string]$Level = "INFO", [string]$Event = "GENERAL")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $entry = "[$timestamp] [$Level] [$Event] $Message"
    Add-Content -Path $LogFile -Value $entry -ErrorAction SilentlyContinue
    Add-Content -Path $LifecycleLog -Value $entry -ErrorAction SilentlyContinue
    Write-Host $entry
}

function Write-SystemInfo {
    $cpu = (Get-WmiObject -Class Win32_Processor -ErrorAction SilentlyContinue | Measure-Object -Property LoadPercentage -Average).Average
    $mem = Get-WmiObject -Class Win32_OperatingSystem -ErrorAction SilentlyContinue
    $freeMemMB = [math]::Round($mem.FreePhysicalMemory / 1024, 0)
    $totalMemMB = [math]::Round($mem.TotalVisibleMemorySize / 1024, 0)
    $usedMemPct = [math]::Round((($totalMemMB - $freeMemMB) / $totalMemMB) * 100, 1)
    Write-Log "System: CPU=${cpu}% Memory=${usedMemPct}% (${freeMemMB}MB free / ${totalMemMB}MB total)" "INFO" "SYSTEM_INFO"
}

function Rotate-Log {
    if (Test-Path $LogFile) {
        $size = (Get-Item $LogFile).Length / 1MB
        if ($size -gt $MaxLogSizeMB) {
            $archiveName = $LogFile -replace '\.log$', "-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
            Move-Item -Path $LogFile -Destination $archiveName -Force
            Write-Log "Log rotado. Anterior: $archiveName"
        }
    }
}

function Test-NginxConfig {
    try {
        $result = & $NginxExe -t -p $NginxPath 2>&1
        $output = $result -join "`n"
        if ($output -match "syntax is ok" -and $output -match "test is successful") {
            return $true
        }
        Write-Log "Configuracion de Nginx invalida: $output" "ERROR"
        return $false
    } catch {
        Write-Log "Error al verificar configuracion: $_" "ERROR"
        return $false
    }
}

function Get-NginxProcesses {
    return Get-Process -Name "nginx" -ErrorAction SilentlyContinue
}

function Get-NginxPortListening {
    try {
        $listening = netstat -an | Select-String ":80\s+.*LISTENING"
        return ($null -ne $listening -and $listening.Count -gt 0)
    } catch {
        return $false
    }
}

function Start-NginxSafe {
    Write-Log "Attempting to start Nginx..." "INFO" "NGINX_START_ATTEMPT"
    Write-SystemInfo

    if (-not (Test-Path $NginxExe)) {
        Write-Log "nginx.exe no encontrado en: $NginxExe" "CRITICAL" "NGINX_NOT_FOUND"
        return $false
    }

    $tempDirs = @(
        "$NginxPath\temp\client_body_temp",
        "$NginxPath\temp\proxy_temp",
        "$NginxPath\temp\fastcgi_temp",
        "$NginxPath\temp\uwsgi_temp",
        "$NginxPath\temp\scgi_temp",
        "$NginxPath\logs"
    )
    foreach ($dir in $tempDirs) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Log "Directorio creado: $dir" "INFO" "DIR_CREATED"
        }
    }

    if (-not (Test-NginxConfig)) {
        Write-Log "No se inicia Nginx: configuracion invalida" "ERROR" "NGINX_CONFIG_INVALID"
        return $false
    }

    try {
        $startTime = Get-Date
        Start-Process -FilePath $NginxExe -WorkingDirectory $NginxPath -WindowStyle Hidden
        Start-Sleep -Seconds 2

        $procs = Get-NginxProcesses
        if ($procs) {
            $pids = ($procs | ForEach-Object { $_.Id }) -join ', '
            $elapsed = ((Get-Date) - $startTime).TotalMilliseconds
            Write-Log "Nginx iniciado correctamente. PIDs: $pids (startup: ${elapsed}ms)" "INFO" "NGINX_STARTED"

            $portListening = Get-NginxPortListening
            if ($portListening) {
                Write-Log "Nginx escuchando en puerto 80 confirmado" "INFO" "NGINX_PORT_OK"
            } else {
                Write-Log "Nginx arrancado pero NO escucha en puerto 80 aun" "WARN" "NGINX_PORT_PENDING"
            }
            return $true
        } else {
            Write-Log "Nginx no se inicio correctamente (sin proceso activo tras arranque)" "ERROR" "NGINX_START_FAILED"
            return $false
        }
    } catch {
        Write-Log "Excepcion al iniciar Nginx: $_" "ERROR" "NGINX_START_EXCEPTION"
        return $false
    }
}

function Stop-NginxSafe {
    $preBefore = Get-NginxProcesses
    $pidsBefore = if ($preBefore) { ($preBefore | ForEach-Object { $_.Id }) -join ', ' } else { "none" }
    Write-Log "Sending QUIT signal to Nginx. Active PIDs before: $pidsBefore" "INFO" "NGINX_QUIT_SIGNAL"

    try {
        $quitOutput = & $NginxExe -s quit -p $NginxPath 2>&1
        if ($quitOutput) {
            Write-Log "nginx -s quit output: $quitOutput" "DEBUG" "NGINX_QUIT_OUTPUT"
        }
        Write-Log "Waiting 3s for graceful shutdown..." "INFO" "NGINX_QUIT_WAIT"
        Start-Sleep -Seconds 3
        $remaining = Get-NginxProcesses
        if ($remaining) {
            $remainPids = ($remaining | ForEach-Object { $_.Id }) -join ', '
            Write-Log "Forzando cierre de $(($remaining).Count) procesos Nginx restantes. PIDs: $remainPids" "WARN" "NGINX_FORCE_KILL"
            $remaining | Stop-Process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
            $stillRunning = Get-NginxProcesses
            if ($stillRunning) {
                Write-Log "Nginx still running after force kill! PIDs: $(($stillRunning | ForEach-Object { $_.Id }) -join ', ')" "ERROR" "NGINX_KILL_FAILED"
            } else {
                Write-Log "Nginx processes terminated after force kill" "INFO" "NGINX_FORCE_KILLED"
            }
        } else {
            Write-Log "Nginx stopped gracefully (no remaining processes)" "INFO" "NGINX_STOPPED_GRACEFUL"
        }
    } catch {
        Write-Log "Error al detener Nginx: $_" "WARN" "NGINX_STOP_ERROR"
        Get-NginxProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    }
}

function Install-ScheduledTask {
    $scriptPath = $PSCommandPath
    if (-not $scriptPath) {
        Write-Host "ERROR: No se puede determinar la ruta del script." -ForegroundColor Red
        exit 1
    }

    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Host "La tarea '$TaskName' ya existe. Eliminando para reinstalar..."
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }

    $action = New-ScheduledTaskAction `
        -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

    $trigger = New-ScheduledTaskTrigger -AtStartup
    $repetition = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1)

    $principal = New-ScheduledTaskPrincipal `
        -UserId "SYSTEM" `
        -LogonType ServiceAccount `
        -RunLevel Highest

    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger, $repetition `
        -Principal $principal `
        -Settings $settings `
        -Description "Monitorea Nginx y lo reinicia automaticamente si se detiene" | Out-Null

    Write-Host "Tarea programada '$TaskName' instalada correctamente." -ForegroundColor Green
    Write-Host "  - Se ejecuta al inicio del sistema y cada 1 minuto"
    Write-Host "  - Se ejecuta como SYSTEM con maximos privilegios"
    Write-Host "  - Log en: $LogFile"
    exit 0
}

function Uninstall-ScheduledTask {
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Tarea programada '$TaskName' eliminada correctamente." -ForegroundColor Green
    } else {
        Write-Host "La tarea '$TaskName' no existe." -ForegroundColor Yellow
    }
    exit 0
}

if ($Install) {
    Install-ScheduledTask
}

if ($Uninstall) {
    Uninstall-ScheduledTask
}

Rotate-Log

Write-Log "Monitor check started" "INFO" "MONITOR_CHECK"

$procs = Get-NginxProcesses

if ($procs -and $procs.Count -gt 0) {
    $pids = ($procs | ForEach-Object { $_.Id }) -join ', '
    $portListening = Get-NginxPortListening
    if ($portListening) {
        Write-Log "Nginx healthy: $($procs.Count) processes (PIDs: $pids), port 80 listening" "INFO" "HEALTH_OK"
        exit 0
    }

    Write-Log "Nginx tiene procesos activos (PIDs: $pids) pero NO escucha en puerto 80. Reiniciando..." "WARN" "NGINX_PORT_DOWN"
    Write-SystemInfo
    Stop-NginxSafe
    Start-Sleep -Seconds 2
    Start-NginxSafe
} else {
    Write-Log "Nginx NO esta activo. Ningun proceso encontrado. Iniciando..." "WARN" "NGINX_DOWN"
    Write-SystemInfo
    Start-NginxSafe
}
