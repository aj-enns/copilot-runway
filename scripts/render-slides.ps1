param(
    [string]$Presentation = (Join-Path $PSScriptRoot '..\artifacts\slides\copilot-runway.pptx'),
    [string]$Output = (Join-Path $PSScriptRoot '..\qa-results\slides')
)

$ErrorActionPreference = 'Stop'
$inputPath = (Resolve-Path -LiteralPath $Presentation).Path
$outputPath = [System.IO.Path]::GetFullPath($Output)
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
$previousProcesses = @(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue)
$application = $null
$deck = $null
try {
    $application = New-Object -ComObject PowerPoint.Application
    $deck = $application.Presentations.Open($inputPath, $true, $false, $false)
    for ($index = 1; $index -le $deck.Slides.Count; $index++) {
        $image = Join-Path $outputPath ('slide-{0:D2}.png' -f $index)
        $deck.Slides.Item($index).Export($image, 'PNG', 1600, 900)
    }
    Write-Output ('Rendered {0} slides to {1}' -f $deck.Slides.Count, $outputPath)
}
finally {
    if ($null -ne $deck) {
        $deck.Close()
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($deck)
    }
    if ($null -ne $application) {
        if ($previousProcesses.Count -eq 0 -and $application.Presentations.Count -eq 0) { $application.Quit() }
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($application)
    }
}
