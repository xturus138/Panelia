$sources = Get-Content 'C:\Users\radit\.claude\projects\C--Users-radit-Project-VisualStudioProject-Personal-Panelia\9739667f-32fb-40b6-85bf-a990f97507eb\tool-results\bfakdje2c.txt'
$enSources = $sources | Where-Object { $_.EndsWith('|en') }
$enSources | Select-Object -First 30