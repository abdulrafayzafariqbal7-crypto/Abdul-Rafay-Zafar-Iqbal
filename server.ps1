param(
    [int]$Port = 8080,
    [string]$RootDir = "$PSScriptRoot\public"
)

Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Linq;
using System.Threading;
using System.Collections.Generic;

public class SimpleHttpServer {
    private readonly HttpListener _listener = new HttpListener();
    private readonly string _rootDir;
    private readonly int _port;
    private bool _running = false;

    public SimpleHttpServer(string rootDir, int port) {
        _rootDir = Path.GetFullPath(rootDir);
        _port = port;
        _listener.Prefixes.Add(string.Format("http://localhost:{0}/", port));
        _listener.Prefixes.Add(string.Format("http://127.0.0.1:{0}/", port));
    }

    public void Start() {
        _listener.Start();
        _running = true;
        Console.WriteLine("Server running on http://localhost:" + _port + "/");
        _listener.BeginGetContext(OnContextReceived, null);
    }

    private void OnContextReceived(IAsyncResult ar) {
        if (!_running) return;

        try {
            HttpListenerContext context = _listener.EndGetContext(ar);
            _listener.BeginGetContext(OnContextReceived, null);
            ThreadPool.QueueUserWorkItem((state) => ProcessRequest(context));
        } catch (Exception) {
            if (_running) {
                try { _listener.BeginGetContext(OnContextReceived, null); } catch {}
            }
        }
    }

    private void ProcessRequest(HttpListenerContext context) {
        HttpListenerRequest req = context.Request;
        HttpListenerResponse res = context.Response;

        res.Headers["Access-Control-Allow-Origin"] = "*";
        res.Headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";

        if (req.HttpMethod == "OPTIONS") {
            res.StatusCode = 200;
            res.Close();
            return;
        }

        try {
            string urlPath = req.Url.AbsolutePath;

            if (urlPath.Equals("/api/frames", StringComparison.OrdinalIgnoreCase)) {
                HandleFramesApi(res);
                return;
            }

            if (urlPath == "/" || string.IsNullOrEmpty(urlPath)) {
                urlPath = "/index.html";
            }

            string relativePath = urlPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            string fullPath = Path.Combine(_rootDir, relativePath);

            if (!File.Exists(fullPath)) {
                res.StatusCode = 404;
                byte[] notFound = Encoding.UTF8.GetBytes("404 Not Found: " + urlPath);
                res.ContentType = "text/plain";
                res.ContentLength64 = notFound.Length;
                res.OutputStream.Write(notFound, 0, notFound.Length);
                res.Close();
                return;
            }

            string ext = Path.GetExtension(fullPath).ToLowerInvariant();
            string mime = "application/octet-stream";
            bool isCacheable = false;

            switch (ext) {
                case ".html": mime = "text/html; charset=utf-8"; break;
                case ".css":  mime = "text/css; charset=utf-8"; break;
                case ".js":   mime = "application/javascript; charset=utf-8"; break;
                case ".json": mime = "application/json; charset=utf-8"; break;
                case ".jpg":
                case ".jpeg": mime = "image/jpeg"; isCacheable = true; break;
                case ".png":  mime = "image/png"; isCacheable = true; break;
                case ".webp": mime = "image/webp"; isCacheable = true; break;
                case ".svg":  mime = "image/svg+xml"; break;
                case ".ico":  mime = "image/x-icon"; break;
            }

            res.ContentType = mime;
            if (isCacheable) {
                res.Headers["Cache-Control"] = "public, max-age=86400";
            } else {
                res.Headers["Cache-Control"] = "no-cache";
            }

            using (FileStream fs = File.OpenRead(fullPath)) {
                res.ContentLength64 = fs.Length;
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = fs.Read(buffer, 0, buffer.Length)) > 0) {
                    res.OutputStream.Write(buffer, 0, read);
                }
            }
            res.Close();
        } catch (Exception) {
            try {
                res.StatusCode = 500;
                res.Close();
            } catch {}
        }
    }

    private void HandleFramesApi(HttpListenerResponse res) {
        string framesDir = Path.Combine(_rootDir, "frames");
        if (!Directory.Exists(framesDir)) {
            framesDir = _rootDir;
        }

        string[] validExtensions = new string[] { ".jpg", ".jpeg", ".png", ".webp" };
        var files = Directory.GetFiles(framesDir)
            .Where(f => validExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()))
            .Select(Path.GetFileName)
            .OrderBy(f => {
                var match = Regex.Match(f, @"\d+");
                return match.Success ? long.Parse(match.Value) : 0L;
            })
            .ThenBy(f => f)
            .ToList();

        StringBuilder sb = new StringBuilder();
        sb.Append("{");
        sb.Append("\"totalFrames\":").Append(files.Count).Append(",");
        sb.Append("\"frameDirectory\":\"frames\",");
        sb.Append("\"frames\":[");
        for (int i = 0; i < files.Count; i++) {
            sb.Append("\"").Append(files[i]).Append("\"");
            if (i < files.Count - 1) sb.Append(",");
        }
        sb.Append("]}");

        byte[] data = Encoding.UTF8.GetBytes(sb.ToString());
        res.ContentType = "application/json; charset=utf-8";
        res.Headers["Cache-Control"] = "no-cache";
        res.ContentLength64 = data.Length;
        res.OutputStream.Write(data, 0, data.Length);
        res.Close();
    }

    public void Stop() {
        _running = false;
        try { _listener.Stop(); } catch {}
    }
}
"@

$server = [SimpleHttpServer]::new($RootDir, $Port)
$server.Start()

Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Cyan

try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    $server.Stop()
    Write-Host "Server stopped." -ForegroundColor Yellow
}
