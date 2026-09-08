param(
  [string]$TaskName = "AutoJob-NaukriRun"
)

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Scheduled task '$TaskName' removed."
