using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.Networking;

public static class UploadServer
{
    // 如果你们是内网自签证书（curl --insecure），Unity 也需要允许不验证证书
    private class InsecureCertHandler : CertificateHandler
    {
        protected override bool ValidateCertificate(byte[] certificateData) => true;
    }

    /// <summary>
    /// 复刻 elFinder connector 的 cmd=upload（支持多个CSV）
    /// </summary>
    public static IEnumerator UploadCsvs(
        string url,                 // http://ip:port/koko/elfinder/connector/_/
        string cookie,              // 从浏览器复制的整串 Cookie（-b 那段）
        string targetHash,          // 你的 target: f4810b..._L1NlcnZlckNvbmZpZw
        string sid,
        string referer,             // 可选：你抓包里的 referer（带 token&asset 那个页面URL）
        IReadOnlyList<string> csvPaths,
        Action<string> onOk = null,
        Action<string> onErr = null)
    {
        if (csvPaths == null || csvPaths.Count == 0)
        {
            onErr?.Invoke("csvPaths 为空");
            yield break;
        }

        // 你抓包里 reqid 像是前端生成的随机串；这里随便生成一个即可（保持格式像一点）
        string reqid = Guid.NewGuid().ToString("N").Substring(0, 14);

        var form = new List<IMultipartFormSection>();

        // 固定字段
        form.Add(new MultipartFormDataSection("reqid", reqid));
        form.Add(new MultipartFormDataSection("cmd", "upload"));
        form.Add(new MultipartFormDataSection("target", targetHash));
        form.Add(new MultipartFormDataSection("sid", sid));
        form.Add(new MultipartFormDataSection("dropWith", "0"));

        // 多文件：upload[]、mtime[]、upload_path[] 都做成数组形式（每个文件一组）
        foreach (var path in csvPaths)
        {
            if (!File.Exists(path))
            {
                onErr?.Invoke($"文件不存在：{path}");
                yield break;
            }

            byte[] bytes = File.ReadAllBytes(path);
            string filename = Path.GetFileName(path);

            // upload[]
            form.Add(new MultipartFormFileSection("upload[]", bytes, filename, "text/csv"));

            // mtime[]：用文件最后写入时间（Unix 秒）
            long unixMtime = new DateTimeOffset(File.GetLastWriteTimeUtc(path)).ToUnixTimeSeconds();
            form.Add(new MultipartFormDataSection("mtime[]", unixMtime.ToString()));

            // upload_path[]：你抓包里等于 target
            form.Add(new MultipartFormDataSection("upload_path[]", targetHash));
        }

        using var req = UnityWebRequest.Post(url, form);

        // 关键：Cookie
        req.SetRequestHeader("Cookie", cookie);

        // 更像浏览器的 AJAX
        req.SetRequestHeader("X-Requested-With", "XMLHttpRequest");
        req.SetRequestHeader("Accept", "application/json, text/javascript, */*; q=0.01");

        // 有些系统会绑定 UA（Unity 默认 UA 不一样可能直接当未登录）
        req.SetRequestHeader("User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36");

        // 你抓包里有这个头；sid 也用同一个值会更像浏览器
        req.SetRequestHeader("JMS-KoKo-Request-ID", sid);

        // 从 cookie 里解析 jms_csrftoken => 带上 X-CSRFToken（建议加）
        string csrf = TryGetCookieValue(cookie, "jms_csrftoken");
        if (!string.IsNullOrEmpty(csrf))
        {
            req.SetRequestHeader("X-CSRFToken", csrf);
        }

        // Referer 别设了（Unity 会警告且可能无效）
        // if (!string.IsNullOrEmpty(referer)) req.SetRequestHeader("Referer", referer);

        // 重要：别让 302 悄悄跳登录页（便于你定位）
        // 0 表示不自动跟随；如果你 Unity 版本不支持该属性，就删掉这行
        req.redirectLimit = 1;


        // 等价 curl --insecure
        req.certificateHandler = new InsecureCertHandler();

        yield return req.SendWebRequest();

        if (req.result != UnityWebRequest.Result.Success)
        {
            onErr?.Invoke($"请求失败: HTTP {req.responseCode} / {req.error}\n{req.downloadHandler?.text}");
            yield break;
        }

        var body = req.downloadHandler?.text ?? "";
        var ct = req.GetResponseHeader("Content-Type") ?? "";

        if (req.responseCode == 301 || req.responseCode == 302 || req.responseCode == 303 || req.responseCode == 307 || req.responseCode == 308)
        {
            var loc = req.GetResponseHeader("Location");
            onErr?.Invoke($"被重定向了：HTTP {req.responseCode}, Location={loc}");
            yield break;
        }

        // 服务器回了 HTML 登录页：当失败
        if (ct.Contains("text/html") || body.Contains("JumpServer") || body.Contains("登录"))
        {
            onErr?.Invoke("看起来没带上有效登录态：返回了 JumpServer 登录页（HTML），而不是 JSON。");
            yield break;
        }

        onOk?.Invoke(body);

    }

    private static string TryGetCookieValue(string cookieHeader, string key)
    {
        if (string.IsNullOrEmpty(cookieHeader)) return null;
        var parts = cookieHeader.Split(';');
        foreach (var p in parts)
        {
            var s = p.Trim();
            if (s.StartsWith(key + "=", StringComparison.Ordinal))
                return s.Substring(key.Length + 1);
        }
        return null;
    }

}
