# Closes the Codex console window that open-codex.cmd opened, with the same close message the window's X button sends (WM_CLOSE). Nothing else is touched.
$c = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cmd.exe' -and $_.CommandLine -like '*run-codex.cmd*' } | Select-Object -First 1
if (-not $c) { 'No Codex window from this lab is open.'; exit 0 }
$p = Get-Process -Id $c.ProcessId -ErrorAction SilentlyContinue
$sent = $false
if ($p) { $sent = $p.CloseMainWindow() }
Start-Sleep -Seconds 2
if ($sent) { 'Closed the Codex window (the same close message as the X button).' } else { 'The close message could not be sent.' }
