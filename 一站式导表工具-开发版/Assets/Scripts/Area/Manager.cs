using System.Collections;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Text;
using UnityEngine;
using UnityEngine.UI;
using System.Linq;
using System;

public class Manager : MonoBehaviour
{
    public Menu menu;
  
    public DisplayArea displayArea;
    public BlueprintArea blueprintArea;
    public SyncArea syncArea;
    public PathSettingWindow pathSettingWindow;
    public PathSettingWIndow_IFS pathSettingWIndow_IFS;
    public GameObject errorArea;
    public ComfirmWindow comfirmWindow;

    [SerializeField] Text logText;
    [SerializeField] ScrollRect logScroll;

    public bool isReady = false;
    public string rootPath;
    public string originPath;
    public string serverPath;
    public string clientPath;
    public string mappingPath;
    public string languagePath;
    public string blueprintPath;
    public string temp1Path { get { return Path.Combine(Application.streamingAssetsPath, "temp1"); } }
    
    [HideInInspector] public Dictionary<string, stFile> files = new Dictionary<string, stFile>();
    [HideInInspector] public List<ExcelEample> excelEamples = new List<ExcelEample>();

    bool inited = false;

    void Start()
    {
        Application.logMessageReceived += LogCallback;

        QuickCode.Instance.Init();
        Tools.manager = this;
        Tools.logText = logText;
        Tools.logScroll = logScroll;

        if(!CheckSvnExist())
        {
            errorArea.SetActive(true);
            return;
        }

        if(pathSettingWindow.Init())
        {
            Init();
            RefreshFiles();
        }
    }

    public void Init()
    {
        isReady = true;
        Tools.Log("加载版本：" + PlayerPrefs.GetString("CurtVersion:"));
        LoadExcelsByMapping();
        LanguageTools.Init(this);
        LanguageTools.ReloadLanguage();
        displayArea.Init();
        blueprintArea.Init();
        syncArea.Init();
        inited = true;
    }

    public async void Test()
    {
        string cookie = "X-JMS-LUNA-ORG=00000000-0000-0000-0000-000000000002; SESSION_COOKIE_NAME_PREFIX=jms_; jms_public_key=LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUF6VENmbElzcjVWVHJNWEgvZ01BVgpDZXlMSW5keGdQUmRrQk9iUXpwMEs0dlEvWDRDVlNWcHJHeFNsb2V2a2RQR1ZweFlidVV1cFVLbmNzZDBKT0NECm92ajh1TTkwaXRpSDNuNkhVVXpLVFZWSzFlRUhmY1ovbW5jTzR6WmJ1QUNCRnk0cHowUE1ETmRHOHNGZEFpbngKN1dnKzluMlhKYkhpcFhsK01QMkc2MENidUgrZVZ3SzBPb1dCc2dsYTRBQUVEL3dHclVUTGZFT3o0THJrcWRFNQp0MlFVWTRJK2lIVnVzMFh3aTNVTHdRY1NxQTRjTVE4dnA0cWFKOHZ1aW9EYlRlN052N21YbGt3VmVtKzJ3bTM2CktPOTA0c1FqYlZIYUJsK1cyVFNzWFNmVmdwUCtRNnh1ZURZdDRKcmk0UjBQN0RwcWtCemttd3ljVXlHZG1WbkkKbXdJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0t; jms_csrftoken=cWm1NhckkYqYCeMouTLcRkC3AM9BOlAC; jms_sessionid=wvk38uhx0rjjx13id710k7i701oxpjrs";
        string wsUrl = "ws://192.168.105.204:8081/koko/ws/elfinder/?type=elfinder&target_id=_&token=b70c348c-35da-46ad-ade5-48f7eb98e9f6&asset=683ce85a-9f37-4af3-beed-bdf24ce14643";

        string sid = Guid.NewGuid().ToString();

        await WsClient.Instance.ConnectAsync(wsUrl, cookie, sid);

        if (!WsClient.Instance.IsConnected)
        {
            Debug.LogError("WS没连上，先别上传");
            return;
        }

        StartCoroutine(UploadServer.UploadCsvs(
            url: "http://192.168.105.204:8081/koko/elfinder/connector/_/",
            cookie: cookie,
            targetHash: "f4810b3695b3e60e1f3c8b86afd69465_L1NlcnZlckNvbmZpZw",
            sid:sid,
            referer: null,
            csvPaths: new [] { @"D:\Potian_Mini\PT_Cehua\自动化导表工具箱\一站式导表工具-发行版\ExcelByOne_Data\StreamingAssets\temp1\SigilStar.csv"},
            onOk: body => Debug.Log("OK: " + body),
            onErr: err => Debug.LogError(err)
        ));

    }

    void OnApplicationFocus(bool hasFocus)
    {
        if (hasFocus)
        {
            RefreshFiles();
        }
    }

    bool CheckSvnExist()
    {
        try
        {
            Tools.ExecuteSvnCommand("--version", false);
        }
        catch(System.Exception e)
        {
            Debug.Log(e);
            return false;
        }

        return true;
    }

    // 加载对照表
    void LoadExcelsByMapping()
    {
        files.Clear();

        // 单独把 Chinese.txt 加进去
        stFile chineseFile = new stFile
        {
            excelName = "Chinese.txt",
            simpleName = "Chinese",
            csvName = "",
            excelFullPath = Path.Combine(Directory.GetParent(clientPath).FullName , "Localization", "Chinese.txt"),
            serverFullPath = "",
            cliectFullPath = "",
            state = emFileState.Normal
        };
        files.Add("Chinese.txt", chineseFile);

        using (StreamReader reader = new StreamReader(mappingPath, Encoding.GetEncoding("GB2312")))
        {
            string line;
            while ((line = reader.ReadLine()) != null)
            {
                string[] columns = line.Split(',');
                stFile file = new stFile
                {
                    excelName = columns[0],
                    simpleName = columns[0].Replace("《破天一剑》", ""),
                    csvName = columns[1],
                    excelFullPath = Path.Combine(originPath, columns[0] + ".xlsx"),
                    serverFullPath = Path.Combine(serverPath, columns[1] + ".csv"),
                    cliectFullPath = Path.Combine(clientPath, columns[1] + ".csv"),
                    state = emFileState.Normal
                };
                files.Add(columns[0], file);
            }
        }

        Tools.Log($"读取到 {files.Count} 个文件");
    }

    public void TriggerAllFileState()
    {
        for (int i = 0; i < excelEamples.Count; i++)
        {
            excelEamples[i].RefreshStateBySVN(excelEamples[i].me);
        }
    }

    public string GB2312ToUTF8(string str)
    {
        byte[] gb2312Bytes = Encoding.GetEncoding("GB2312").GetBytes(str); // 将 GB2312 编码的字符串转换为字节数组
        string utf8String = Encoding.UTF8.GetString(gb2312Bytes); // 将字节数组使用 UTF-8 编码转换为字符串
        return utf8String;
    }

    public void DeleteDirectory(string folderPath)
    {
        // 确保文件夹存在
        if (Directory.Exists(folderPath))
        {
            // 删除文件夹里的所有文件
            string[] files = Directory.GetFiles(folderPath);
            foreach (string file in files)
            {
                File.Delete(file);
            }

            // 删除文件夹本身
            Directory.Delete(folderPath);
        }
    }

    public void RefreshFiles()
    {
        if(!inited) return;

        // 更新同步区的未更新标记
        syncArea.CompareRepoVersion();

        // 重新加载多语言对照表
        if(LanguageTools.IsChanged())
        {
            LanguageTools.ReloadLanguage();
        }

        // 重置所有文件状态
        foreach (var key in files.Keys.ToList())
        {
            files[key].state = emFileState.Normal;
        }

        // 从SVN获取数据
        string output = Tools.ExecuteSvnCommand("status " + originPath);

        // 提取修改过的文件
        List<string> excel = new List<string>();
        string[] lines = output.Split('\n');
        foreach (var line in lines)
        {
            string[] columns = line.Split("       ");
            if(columns.Length >= 2)
            {
                string excelName = Path.GetFileNameWithoutExtension(columns[1].Trim());
                switch(columns[0])
                {
                    case "M":
                        if(files.ContainsKey(excelName))
                        {
                            files[excelName].state = emFileState.Modify;
                        }
                        break;
                    case "C":
                        if(files.ContainsKey(excelName))
                        {
                            files[excelName].state = emFileState.Conflict;
                        }
                        break;
                }
            }
        }

        TriggerAllFileState();
        syncArea.RefreshModifyScroll();
    }
    private void LogCallback(string condition, string stackTrace, LogType type)
    {
        try{
            string color = "black";
            switch(type)
            {
                case LogType.Log:
                    color = "black";
                    break;
                case LogType.Warning:
                    color = "yellow";
                    break;
                case LogType.Error:
                case LogType.Exception:
                    color = "red";
                    break;
            }
            Tools.Log(string.Format("<color={0}>    {1}</color>", color, condition + "\n" + stackTrace));
        }catch{}
    }
}
