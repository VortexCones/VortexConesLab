# Ends every process that was started from the lab folder (default C:\vxlab, or the folder in the VXLAB variable) and nothing else:
# Codex programs whose file is inside the lab folder, and the console that runs run-codex.cmd. It prints what it ended.
$Lab = if ($env:VXLAB) { $env:VXLAB } else { 'C:\vxlab' }
$found = @(Get-CimInstance Win32_Process | Where-Object {
    $_.ProcessId -ne $PID -and (
      ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($Lab, 'OrdinalIgnoreCase')) -or
      ($_.Name -eq 'cmd.exe' -and $_.CommandLine -like '*run-codex.cmd*') -or
      ($_.Name -eq 'node.exe' -and $_.CommandLine -like "*$Lab*") ) })
if (-not $found.Count) { 'Nothing from the lab is running.'; exit 0 }
foreach ($p in $found) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue; ('Ended {0} (pid {1})' -f $p.Name, $p.ProcessId) }
