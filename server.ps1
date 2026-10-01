# Servidor Web local ligero en PowerShell para Three.js
$port = 8080
$path = Split-Path -Parent $MyInvocation.MyCommand.Path

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  [OK] Servidor Three.js iniciado para Spotify DJ Livi    " -ForegroundColor Cyan
    Write-Host "  URL: http://localhost:$port/                            " -ForegroundColor Yellow
    Write-Host "  Presiona Ctrl+C para detener el servidor                " -ForegroundColor Gray
    Write-Host "==========================================================" -ForegroundColor Green

    # Intentar abrir el navegador por defecto
    Start-Process "http://localhost:$port/"

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $reqPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($reqPath)) {
            $reqPath = "index.html"
        }

        $filePath = Join-Path $path $reqPath

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = "text/plain"
            switch ($ext) {
                ".html" { $mime = "text/html; charset=utf-8" }
                ".css"  { $mime = "text/css; charset=utf-8" }
                ".js"   { $mime = "application/javascript; charset=utf-8" }
                ".json" { $mime = "application/json; charset=utf-8" }
                ".png"  { $mime = "image/png" }
                ".jpg"  { $mime = "image/jpeg" }
                ".glb"  { $mime = "model/gltf-binary" }
                ".gltf" { $mime = "model/gltf+json" }
                ".svg"  { $mime = "image/svg+xml" }
                ".ino"  { $mime = "text/plain; charset=utf-8" }
            }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $reqPath")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
