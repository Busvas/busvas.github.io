$data = Get-Content -Raw 'data.json' | ConvertFrom-Json
$provObj = [ordered]@{}
foreach ($prov in $data.provincias) {
  $provId = $prov.id
  $termMap = [ordered]@{}
  if ($prov.terminales) {
    foreach ($term in $prov.terminales) {
      $termMap[$term.id] = @()
    }
  }
  $provObj[$provId] = [ordered]@{ ads = @(); terminales = $termMap }
}
# Write as pretty JSON to placements.json
$provObj | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 'placements.json'
Write-Output 'placements.json generated.'
