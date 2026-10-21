param([Parameter(Mandatory=$true)][string]$Installer, [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$inputFile = (Resolve-Path -LiteralPath $Installer).Path
$outputDir = [IO.Path]::GetFullPath($Destination)
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
# Administrative image extraction only, never /i (system installation).
$argsList = @('/a', ('"' + $inputFile + '"'), '/qn', '/norestart', ('TARGETDIR="' + $outputDir + '"'), '/L*v', ('"' + $outputDir + '\extract.log"'))
$task = Start-Process -FilePath "$env:SystemRoot\System32\msiexec.exe" -ArgumentList $argsList -WindowStyle Hidden -PassThru -Wait
if ($task.ExitCode -ne 0) { throw "MSI extraction failed: $($task.ExitCode)" }
