using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using ExcelDataReader.Log;
using System.Text.RegularExpressions;
using UnityEditor;

public class SyncArea : MonoBehaviour
{
    [SerializeField] Manager manager;

    [SerializeField] Transform modifyParent;
    [SerializeField] GameObject modifyExample;
    [SerializeField] Text repoDiffTxt;

    public void Init()
    {
        
    }

    public void RefreshModifyScroll()
    {
        foreach (Transform child in modifyParent)
        {
            Destroy(child.gameObject);
        }
        
        foreach (var key in manager.files.Keys.ToList())
        {
            stFile file = manager.files[key];
            if(file.state == emFileState.Modify)
            {
                GameObject obj = Instantiate(modifyExample, modifyParent);
                obj.GetComponent<ModifyExample>().SetExcel(manager, key);
                obj.name = file.excelName;
                obj.GetComponentInChildren<Text>().text = file.simpleName + "\n" + file.csvName;
                obj.SetActive(true);
            }
        }
    }

    public void CompareRepoVersion()
    {
        // IReadOnlyList<string> files = Tools.GetRemoteNewerFiles(manager.originPath);
        // string txt = 
    }

    public void CompareRepoVersion_Old()
    {
        // 获取本地仓库版本
        string localInfo = Tools.ExecuteSvnCommand($"info \"{manager.originPath}\"", false);
        Match localMatch = Regex.Match(localInfo, @"Last Changed Rev: (\d+)");
        if (!localMatch.Success) throw new System.Exception("找不到版本号");
        int localVersion = int.Parse(localMatch.Groups[1].Value);

        // 获取远端仓库地址
        Match match = Regex.Match(localInfo, @"URL: (.+)");
        if (!match.Success) throw new System.Exception("找不到URL");
        string repoUrl = match.Groups[1].Value.Trim();

        // 获得远端仓库版本
        string remoteInfo = Tools.ExecuteSvnCommand($"info \"{repoUrl}\"", false);
        Match remoteMatch = Regex.Match(remoteInfo, @"Last Changed Rev: (\d+)");
        if (!remoteMatch.Success) throw new System.Exception("找不到版本号");
        int remoteVersion = int.Parse(remoteMatch.Groups[1].Value);

        // 比较仓库版本
        int diff = remoteVersion - localVersion;
        repoDiffTxt.text = $"别人有{diff}个版本你没更";
        repoDiffTxt.gameObject.SetActive(diff > 0);

        // Debug.Log($"本地版本: {localVersion}, 远程版本: {remoteVersion}, 相差版本数: {diff}");
    }

    public void OnBlueprintToggle()
    {
        manager.blueprintArea.gameObject.SetActive(!manager.blueprintArea.gameObject.activeSelf);
    }

    public void OnRefreshButton()
    {
        manager.RefreshFiles();
    }

    public void OnFolderButton()
    {
        string path = manager.temp1Path.Replace('/', '\\');
        Tools.Log(path);
        System.Diagnostics.Process.Start("explorer.exe", path);
    }

    public void OnSyncButton()
    {
        Tools.Log("\n开始同步修改过的表格");
        StartCoroutine(SyncExcel());
    }

    IEnumerator SyncExcel()
    {
        yield return 0;

        manager.DeleteDirectory(manager.temp1Path);
        Directory.CreateDirectory(manager.temp1Path);

        for (int i = 0; i < modifyParent.childCount; i++)
        {
            if(!modifyParent.GetChild(i).GetComponent<Toggle>().isOn)
            {
                continue;
            }

            string name = modifyParent.GetChild(i).name;
            string eName = name + ".xlsx";
            string cName = manager.files[name].csvName + ".csv";
            string o = Path.Combine(manager.originPath, eName);
            string t = Path.Combine(manager.temp1Path, cName);
            string s = Path.Combine(manager.serverPath, cName);
            string c = Path.Combine(manager.clientPath, cName);
            // string e = Path.Combine(@"D:\Potian_Mini\PT_Client\branches\NewAction729\Assets\PackageRes\CSVData", cName);

            Tools.ExcelToCsv(o, t);
            File.Copy(t, s, true);
            if (File.Exists(c))
            {
                File.Copy(t, c, true);
                // File.Copy(t, e, true);
            }
            Tools.Log($"{ manager.files[name].simpleName }.xlsx -> { cName } 已完成同步");
            yield return 0;
        }

        Tools.Log("所有表格同步完成!!!");
    }

    public void OnSVNCommitButton()
    {
        List<stFile> files = new List<stFile>();

        for (int i = 0; i < modifyParent.childCount; i++)
        {
            if(!modifyParent.GetChild(i).GetComponent<Toggle>().isOn)
            {
                continue;
            }
            files.Add(manager.files[modifyParent.GetChild(i).name]);
        }
        
        manager.comfirmWindow.Open(files);
    }
}
