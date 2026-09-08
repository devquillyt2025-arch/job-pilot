# Registers a daily Windows Task Scheduler entry that runs "npm run run"
# (search + score, then apply only to whatever is already marked "approved"
# in the dashboard). A fixed cron-style minute is a detectable automation
# fingerprint, so this jitters the actual trigger time by up to +/-15 minutes
# around whatever -Time you pass, every time you register it.
#
# Usage:
#   .\scripts\register-scheduled-task.ps1                # ~09:00, jittered
#   .\scripts\register-scheduled-task.ps1 -Time "18:30"   # ~18:30, jittered

param(
  [string]$Time = "09:00",
  [string]$TaskName = "AutoJob-NaukriRun"
)

$ProjectDir = Split-Path -Parent $PSScriptRoot

$NpmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $NpmCmd) { $NpmCmd = Get-Command npm -ErrorAction SilentlyContinue }
if (-not $NpmCmd) {
  throw "Could not find npm on PATH. Install Node.js, or run this from a shell where 'npm' works."
}

$baseTime = [DateTime]::ParseExact($Time, "HH:mm", $null)
$jitterMinutes = Get-Random -Minimum -15 -Maximum 16
$jitteredTime = $baseTime.AddMinutes($jitterMinutes)

$Action = New-ScheduledTaskAction -Execute $NpmCmd.Source -Argument "run run" -WorkingDirectory $ProjectDir
$Trigger = New-ScheduledTaskTrigger -Daily -At $jitteredTime
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 45)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings `
  -Description "Auto-Job: searches Naukri, scores matches, and applies to jobs already approved in the dashboard." -Force

Write-Host "Scheduled task '$TaskName' registered - runs daily around $($jitteredTime.ToString('HH:mm')) (jittered from $Time)."
Write-Host "Re-run this script to re-roll the jitter for a new random time each time you register it."
Write-Host "Review and approve matches in the dashboard (npm run dev, in dashboard/) - only approved jobs ever get applied to."
