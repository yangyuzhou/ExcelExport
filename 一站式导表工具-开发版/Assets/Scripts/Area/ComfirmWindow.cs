using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

public class ComfirmWindow : MonoBehaviour
{
    [SerializeField] Manager manager;
    [SerializeField] GameObject toggleExample;
    [SerializeField] Transform content;
    [SerializeField] InputField inputField;

    List<string> fullCommitFiles = new List<string>();

    public void Open(List<stFile> files)
    {
        fullCommitFiles.Clear();
        for (int i = 0; i < content.childCount; i++)
        {
            Destroy(content.GetChild(i).gameObject);
        }

        // 算出都有啥文件
        foreach (var item in files)
        {
            if(File.Exists(item.excelFullPath)) fullCommitFiles.Add(item.excelFullPath);
            if(File.Exists(item.serverFullPath)) fullCommitFiles.Add(item.serverFullPath);
            if(File.Exists(item.cliectFullPath)) fullCommitFiles.Add(item.cliectFullPath);
        }

        // 生成Toggle
        foreach (var item in fullCommitFiles)
        {
            GameObject obj = Instantiate(toggleExample, content);
            obj.name = item;
            obj.GetComponentInChildren<Text>().text = SplitAndColorPath(item, 3);
            obj.GetComponentInChildren<Button>().onClick.AddListener(()=>{OnCompareButton(item);});
            obj.SetActive(true);
        }

        // 自动填充信息栏
        string msg = "配表工具：";
        foreach (var item in files)
        {
            msg += item.simpleName + " ";
        }

        inputField.text = msg;
        gameObject.SetActive(true);
    }

    public void OnCompareButton(string filePath)
    {
        Tools.ExecuteSvnDiff(filePath);
    }

    public void OnCloseButton()
    {
        gameObject.SetActive(false);
    }

    public void OnCommitButton()
    {
        string files = "";
        for (int i = 0; i < content.childCount; i++)
        {
            if(!content.GetChild(i).GetComponent<Toggle>().isOn)
            {
                continue;
            }

            files += content.GetChild(i).name + " ";
        }
        files = files.Substring(0, files.Length - 1);
        Tools.Log(files);

        // 定义 SVN 命令
        Tools.ExecuteSvnCommand($"commit -m \"{ inputField.text }\" " + files);

        inputField.text = "";
        manager.RefreshFiles();
        gameObject.SetActive(false);
    }

    public static string SplitAndColorPath(string path, int layerCount)
    {
        char separator = Path.DirectorySeparatorChar;
        
        string[] parts = path.Split(separator);
        string last = parts[parts.Length - 1];
        last = "<color=green>" + last + "</color>";
        parts[parts.Length - 1] = last;

        if (parts.Length <= layerCount)
        {
            return path;
        }
        return string.Join(separator.ToString(), parts.TakeLast(layerCount));
    }
}
