$json = Get-Content "$env:TEMP\keiyoushi.json" -Raw | ConvertFrom-Json
foreach ($ext in $json) {
    foreach ($src in $ext.sources) {
        Write-Output "$($src.id)|$($src.name)|$($src.lang)"
    }
}