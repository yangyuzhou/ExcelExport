using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

public sealed class WsClient : MonoBehaviour
{
    public static WsClient Instance { get; private set; }

    private ClientWebSocket _ws;
    private CancellationTokenSource _cts;
    private Task _recvTask;
    private Task _pingTask;

    public bool IsConnected => _ws != null && _ws.State == WebSocketState.Open;

    private void Awake()
    {
        if (Instance != null) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    public async Task ConnectAsync(string wsUrl, string cookie, string sid)
    {
        await DisconnectAsync();

        _cts = new CancellationTokenSource();
        _ws = new ClientWebSocket();

        // 关键 1：子协议（你抓包里是 JMS-KOKO）
        _ws.Options.AddSubProtocol("JMS-KOKO");

        // 关键 2：带 Cookie（很多环境需要登录态；即使 wsUrl 有 token，也建议带上）
        if (!string.IsNullOrEmpty(cookie))
            _ws.Options.SetRequestHeader("Cookie", cookie);

        // 可选：更像浏览器
        _ws.Options.SetRequestHeader("User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36");

        await _ws.ConnectAsync(new Uri(wsUrl), _cts.Token);
        Debug.Log("[WS] Connected: " + wsUrl);

        // 启动收包/心跳
        _recvTask = Task.Run(() => ReceiveLoop(_cts.Token));
        _pingTask = Task.Run(() => PingLoop(sid, _cts.Token));
    }

    public async Task DisconnectAsync()
    {
        try
        {
            if (_cts != null && !_cts.IsCancellationRequested) _cts.Cancel();

            if (_ws != null)
            {
                if (_ws.State == WebSocketState.Open || _ws.State == WebSocketState.CloseReceived)
                    await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None);
                _ws.Dispose();
            }
        }
        catch { /* ignore */ }
        finally
        {
            _ws = null;
            _cts = null;
            _recvTask = null;
            _pingTask = null;
        }
    }

    private async Task PingLoop(string sid, CancellationToken ct)
    {
        // 重要：浏览器控制台里你看到的 PING 消息就是这个意思——让服务端把该“窗口/sid”注册到 ws 会话上
        // sid 用你 HTTP upload 里的 sid（也就是 JMS-KoKo-Request-ID）保持一致
        var pingJson = $"{{\"name\":\"PING\",\"id\":\"{sid}\"}}";
        var bytes = Encoding.UTF8.GetBytes(pingJson);

        while (!ct.IsCancellationRequested && IsConnected)
        {
            try
            {
                await _ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, ct);
            }
            catch (Exception e)
            {
                Debug.LogError("[WS] Ping send failed: " + e.Message);
                break;
            }

            await Task.Delay(TimeSpan.FromSeconds(10), ct);
        }
    }

    private async Task ReceiveLoop(CancellationToken ct)
    {
        var buffer = new byte[64 * 1024];

        while (!ct.IsCancellationRequested && IsConnected)
        {
            try
            {
                var result = await _ws.ReceiveAsync(new ArraySegment<byte>(buffer), ct);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    Debug.LogWarning("[WS] Closed by server.");
                    break;
                }

                var msg = Encoding.UTF8.GetString(buffer, 0, result.Count);
                // 先打日志，方便你确认服务端确实认了连接
                Debug.Log("[WS] " + msg);
            }
            catch (Exception e)
            {
                Debug.LogError("[WS] Receive failed: " + e.Message);
                break;
            }
        }
    }
}
