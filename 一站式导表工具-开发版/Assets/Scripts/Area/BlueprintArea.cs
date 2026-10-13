using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.UI;

public struct stBlueprintFile
{
    public string filename;
    public string fullpath;
}

public class BlueprintArea : MonoBehaviour
{
    [SerializeField]Manager manager;

    Dictionary<string, Transform> buttonsDict = new Dictionary<string, Transform>();
    Dictionary<string, stBlueprintFile> blueprintFiles = new Dictionary<string, stBlueprintFile>();

    public void Init()
    {
        Init_AddEvents();
        Init_CollectFiles();
    }

    public void Init_AddEvents()
    {
        Button[] buttons = GetComponentsInChildren<Button>();
        for (int i = 0; i < buttons.Length; i++)
        {
            string name = buttons[i].gameObject.name;
            buttons[i].onClick.AddListener(() => OpenFile(name));
            buttonsDict.Add(name, buttons[i].transform);
        }
    }

    public void Init_CollectFiles()
    {
        string[] files = Directory.GetFiles(manager.blueprintPath, "*", SearchOption.AllDirectories);
        foreach (var file in files)
        {
            stBlueprintFile f = new stBlueprintFile();
            f.fullpath = file;
            f.filename = Path.GetFileNameWithoutExtension(file);

            if(buttonsDict.ContainsKey(f.filename))
            {
                blueprintFiles.Add(f.filename, f);
            }
        }
    }

    public void OpenFile(string filename)
    {
        Tools.Run(blueprintFiles[filename].fullpath);
    }
}
