# Read-only: lists the Codex processes that were started from the lab folder (default C:\vxlab, or the folder in the VXLAB variable), as a small table:
# PID, role, parent, age in seconds. It starts, stops and changes nothing, and it never reads any file in a Codex home folder.
#   .\observe.ps1                 print the table once
#   .\observe.ps1 -Watch -Seconds 20   redraw it every second for 20 seconds
#   .\observe.ps1 -Json           print the rows as JSON, for other scripts
param([switch]$Watch, [int]$Seconds = 20, [switch]$Json)

$Lab = if ($env:VXLAB) { $env:VXLAB } else { 'C:\vxlab' }
$Width = 53   # the table is padded to fit a 55-column terminal

function Get-Rows {
  $all = Get-CimInstance Win32_Process
  $byId = @{}; foreach ($p in $all) { $byId[[int]$p.ProcessId] = $p }
  $now = Get-Date
  $mine = @($all | Where-Object { $_.Name -eq 'codex.exe' -and $_.ExecutablePath -and $_.ExecutablePath.StartsWith($Lab, 'OrdinalIgnoreCase') } | Sort-Object CreationDate)
  $roleOf = @{}
  foreach ($p in $mine) { $roleOf[[int]$p.ProcessId] = $(if ($p.CommandLine -match 'managed-daemon') { 'server' } elseif ($p.CommandLine -match 'pid-update-loop') { 'update checker' } else { 'interface' }) }
  foreach ($p in $mine) {
    $parent = $byId[[int]$p.ParentProcessId]
    $parentLabel = if ($roleOf.ContainsKey([int]$p.ParentProcessId)) { $roleOf[[int]$p.ParentProcessId] } elseif ($parent) { $parent.Name -replace '\.exe$', '' } else { 'gone' }
    [pscustomobject]@{ pid = [int]$p.ProcessId; role = $roleOf[[int]$p.ProcessId]; parent = $parentLabel; ageSeconds = [int]($now - $p.CreationDate).TotalSeconds }
  }
}

function Format-Table53($rows, $stamp, $pad) {
  $lines = @("Codex processes from this lab  $stamp".PadRight($Width), 'PID    ROLE            PARENT       AGE'.PadRight($Width))
  if (-not $rows) { $lines += '(none)'.PadRight($Width) }
  foreach ($r in @($rows)) { if ($r) { $lines += ('{0,-6} {1,-15} {2,-12} {3,4}s' -f $r.pid, $r.role, $r.parent, $r.ageSeconds).PadRight($Width) } }
  while ($pad -and $lines.Count -lt 7) { $lines += ''.PadRight($Width) }   # watch mode only: blank lines clear rows that have disappeared
  $lines
}

if ($Json) { @(Get-Rows) | ConvertTo-Json -Compress; exit 0 }
if (-not $Watch) { Format-Table53 @(Get-Rows) '' $false | ForEach-Object { $_.TrimEnd() }; exit 0 }
$canRedraw = $true
try { $top = [Console]::CursorTop } catch { $canRedraw = $false }   # redraw in place only when attached to a real console window; otherwise print one table per second
$start = Get-Date
while (((Get-Date) - $start).TotalSeconds -lt $Seconds) {
  $t = [int]((Get-Date) - $start).TotalSeconds
  if ($canRedraw) { try { [Console]::SetCursorPosition(0, $top) } catch { $canRedraw = $false } }
  Format-Table53 @(Get-Rows) ("t={0}s" -f $t) $true | ForEach-Object { [Console]::WriteLine($_) }
  Start-Sleep -Seconds 1
}
