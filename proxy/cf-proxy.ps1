# ============================================================
#  THE COLD FRONT  -  local feed proxy (zero dependencies)
#
#  Why this exists:
#    ESPN (Akamai edge) 403s browser-fingerprinted traffic on some
#    networks  -  residential lines and VPNs included  -  while still
#    letting tool-style clients (curl, okhttp) through. This tiny
#    listener fetches the feeds with a curl-style User-Agent and
#    hands them to the site with CORS headers. The site tries this
#    proxy first; if it isn't running the attempt fails in
#    milliseconds and the chain moves on. Loopback-only: nothing
#    outside this machine can reach it.
#
#  Run:    double-click Start-Local-Proxy.bat  (or: .\cf-proxy.ps1)
#  Stop:   Task Manager -> end the powershell.exe whose command line
#          contains "cf-proxy.ps1", or just close its window.
#  Log:    cf-proxy.log next to this file.
# ============================================================
$ErrorActionPreference = 'Stop'
$Port = 8799
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $here) { $here = (Get-Location).Path }
$logFile = Join-Path $here 'cf-proxy.log'

# Already running? (something listening on the port)
try {
  $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($conns) { Write-Host "THE COLD FRONT proxy: port $Port already in use  -  an instance appears to be running. Nothing to do."; exit 0 }
} catch { }

$src = @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

public static class CFProxy
{
    private static HttpClient _client;
    private static string _logFile;
    private static readonly HashSet<string> AllowHosts = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "site.api.espn.com",
        "site.web.api.espn.com",
        "sports.core.api.espn.com",
        "www.espn.com",
        "www.thesportsdb.com",
        "gamma-api.polymarket.com",
        "clob.polymarket.com",
        "api.open-meteo.com",
        "api.the-odds-api.com"
    };

    public static void Start(int port, string logFile)
    {
        _logFile = logFile;
        HttpListener listener = new HttpListener();
        listener.Prefixes.Add("http://127.0.0.1:" + port + "/");
        listener.Start();
        _client = new HttpClient();
        _client.Timeout = TimeSpan.FromSeconds(25);
        // Non-browser user agent: some networks (residential/VPN) make ESPN 403
        // browser-fingerprinted requests while letting tool-style clients through.
        _client.DefaultRequestHeaders.UserAgent.ParseAdd("curl/8.13.0");
        Log("proxy started on port " + port + " (pid " + System.Diagnostics.Process.GetCurrentProcess().Id + ")");
        while (listener.IsListening)
        {
            HttpListenerContext ctx;
            try { ctx = listener.GetContext(); }
            catch { break; }
            Task.Run(delegate { Handle(ctx); });
        }
    }

    private static void Handle(HttpListenerContext ctx)
    {
        try
        {
            if (ctx.Request.HttpMethod == "OPTIONS") { Send(ctx, 204, null, "text/plain"); return; }
            string path = ctx.Request.Url.AbsolutePath;
            if (path == "/healthz") { Send(ctx, 200, "{\"ok\":true}", "application/json"); return; }
            if (path != "/fetch") { Send(ctx, 404, "{\"error\":\"not found\"}", "application/json"); return; }
            string target = GetQueryValue(ctx.Request.Url.Query, "url");
            Uri tu = null;
            bool ok = Uri.TryCreate(target, UriKind.Absolute, out tu);
            if (!ok || tu.Scheme != Uri.UriSchemeHttps || !AllowHosts.Contains(tu.Host))
            {
                Send(ctx, 403, "{\"error\":\"host not allowed\"}", "application/json");
                return;
            }
            try
            {
                HttpResponseMessage resp = _client.GetAsync(tu.ToString()).Result;
                string body = resp.Content.ReadAsStringAsync().Result;
                string ctype = "application/json";
                if (resp.Content.Headers.ContentType != null) { ctype = resp.Content.Headers.ContentType.ToString(); }
                Log("GET " + target + " -> " + (int)resp.StatusCode + " (" + body.Length + " bytes)");
                Send(ctx, (int)resp.StatusCode, body, ctype);
            }
            catch (Exception e)
            {
                Log("GET " + target + " -> ERR " + e.Message);
                Send(ctx, 502, "{\"error\":\"upstream failed\"}", "application/json");
            }
        }
        catch (Exception e)
        {
            Log("handler error: " + e.Message);
            try { Send(ctx, 500, "{\"error\":\"internal\"}", "application/json"); } catch { }
        }
    }

    private static void Send(HttpListenerContext ctx, int status, string text, string ctype)
    {
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = ctype;
        ctx.Response.AddHeader("Access-Control-Allow-Origin", "*");
        ctx.Response.AddHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        if (text != null)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(text);
            ctx.Response.ContentLength64 = bytes.Length;
            ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
        }
        ctx.Response.Close();
    }

    private static string GetQueryValue(string query, string key)
    {
        if (query == null) { return ""; }
        query = query.TrimStart('?');
        string[] segs = query.Split('&');
        foreach (string seg in segs)
        {
            string prefix = key + "=";
            if (seg.StartsWith(prefix)) { return Uri.UnescapeDataString(seg.Substring(prefix.Length)); }
        }
        return "";
    }

    private static void Log(string msg)
    {
        try { File.AppendAllText(_logFile, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + msg + "\n"); }
        catch { }
    }
}
'@

try {
  Add-Type -TypeDefinition $src -ReferencedAssemblies System.Net.Http
} catch {
  Write-Host "Failed to load proxy core: $($_.Exception.Message)"
  exit 1
}

Write-Host "THE COLD FRONT local feed proxy starting on http://127.0.0.1:$Port/ ..."
[CFProxy]::Start($Port, $logFile)
