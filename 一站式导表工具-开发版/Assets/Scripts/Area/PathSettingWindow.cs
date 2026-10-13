using System.IO;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using System.Linq;
using System;
using System.Reflection.Emit;
using UnityEditor;

public class PathSettingWindow : MonoBehaviour
{
    [HideInInspector] public List<string> defaultVersionList = new List<string>{"主版本", "辅助版本"};
    [HideInInspector] public string defaultRootPath = @"D:\Potian_Mini";
    [HideInInspector] public string defaultOriginPath = @"D:\Potian_Mini\PT_Cehua\trunk\数据表";
    [HideInInspector] public string defaultServerPath = @"D:\Potian_Mini\PT_Cehua\trunk\toServer\ServerConfig";
    [HideInInspector] public string defaultClientPath = @"D:\Potian_Mini\PT_Client\PCIKTrunk\Assets\PackageRes\CSVData";
    [HideInInspector] public string defaultMappingPath = @"D:\Potian_Mini\PT_Cehua\trunk\toServer\中英文数值表名对照.csv";
    [HideInInspector] public string defaultLanguagePath = @"D:\Potian_Mini\PT_Cehua\trunk\toServer\多语言键值对对应表.xlsx";
    [HideInInspector] public string defaultBlueprintPath = @"D:\Potian_Mini\PT_Cehua\public";

    [SerializeField] Manager manager;
    [SerializeField] Dropdown dropdown;
    [SerializeField] Text versionText;

    [SerializeField] InputField root;
    [SerializeField] InputField origin;
    [SerializeField] InputField server;
    [SerializeField] InputField client;
    [SerializeField] InputField mapping;
    [SerializeField] InputField language;
    [SerializeField] InputField blueprint;

    [SerializeField] Image rootImage;
    [SerializeField] Image originImage;
    [SerializeField] Image serverImage;
    [SerializeField] Image clientImage;
    [SerializeField] Image mappingImage;
    [SerializeField] Image languageImage;
    [SerializeField] Image blueprintImage;

    bool rootReady;
    bool originReady;
    bool serverReady;
    bool clientReady;
    bool mappingReady;
    bool languageReady;
    bool blueprintReady;

    [SerializeField] Sprite checkSprite;
    [SerializeField] Sprite errorSprite;

    List<string> versionsList = new List<string>();
    string selectVersionName;
    string SelectVersionName
    {
        get { return selectVersionName; }
        set
        {
            if(PlayerPrefs.HasKey("VersionPath:" + value))
            {
                string[] curtVersionPaths = PlayerPrefs.GetString("VersionPath:" + value).Split("\n");
                root.text = curtVersionPaths[0];
                origin.text = curtVersionPaths[1];
                server.text = curtVersionPaths[2];
                client.text = curtVersionPaths[3];
                mapping.text = curtVersionPaths[4];
                language.text = curtVersionPaths[5];
                blueprint.text = curtVersionPaths[6];
            }
            else
            {
                root.text = "";
                origin.text = "";
                server.text = "";
                client.text = "";
                mapping.text = "";
                language.text = "";
                blueprint.text = "";
            }

            selectVersionName = value;
        }
    }

    public bool Init()
    {
        if(!PlayerPrefs.HasKey("CurtVersion:"))
        {
            PlayerPrefs.SetString("Versions", "主版本\n辅助版本");
            versionsList = defaultVersionList;
            selectVersionName = "主版本";
            dropdown.ClearOptions();
            dropdown.AddOptions(defaultVersionList);
            root.text = defaultRootPath;
            origin.text = defaultOriginPath;
            server.text = defaultServerPath;
            client.text = defaultClientPath;
            mapping.text = defaultMappingPath;
            language.text = defaultLanguagePath;
            blueprint.text = defaultBlueprintPath;
            gameObject.SetActive(true);
            return false;
        }
        else
        {
            selectVersionName = PlayerPrefs.GetString("CurtVersion:");
            LoadVersionsName();
            versionText.text = $"版本：{SelectVersionName}";
            manager.rootPath = root.text;
            manager.originPath = origin.text;
            manager.serverPath = server.text;
            manager.clientPath = client.text;
            manager.mappingPath = mapping.text;
            manager.languagePath = language.text;
            manager.blueprintPath = blueprint.text;
            return true;
        }
    }

    void OnEnable()
    {
        CheckRootPath(root.text);
        CheckOriginPath(origin.text);
        CheckServerPath(server.text);
        CheckClientPath(client.text);
        CheckMappingPath(mapping.text);
        CheckLanguagePath(language.text);
        CheckBlueprintPath(blueprint.text);
    }

    public void LoadVersionsName()
    {
        dropdown.ClearOptions();
        versionsList = PlayerPrefs.GetString("Versions").Split("\n").ToList();
        dropdown.AddOptions(versionsList);

        int index = Mathf.Max(0, versionsList.IndexOf(SelectVersionName));
        dropdown.value = index;
        SelectVersionName = dropdown.options[index].text;
    }

    public void OnCloseButton()
    {
        gameObject.SetActive(false);
    }

    public void OnSaveButton()
    {
        if(rootReady && originReady && serverReady && clientReady && mappingReady && languageReady && blueprintReady)
        {
            PlayerPrefs.SetString("CurtVersion:", SelectVersionName);
            PlayerPrefs.SetString("VersionPath:" + SelectVersionName, root.text + "\n"
                                                                    + origin.text + "\n"
                                                                    + server.text + "\n"
                                                                    + client.text + "\n"
                                                                    + mapping.text + "\n"
                                                                    + language.text + "\n"
                                                                    + blueprint.text);
            manager.rootPath = root.text;
            manager.originPath = origin.text;
            manager.serverPath = server.text;
            manager.clientPath = client.text;
            manager.mappingPath = mapping.text;
            manager.languagePath = language.text;
            manager.blueprintPath = blueprint.text;
            manager.Init();
            versionText.text = $"版本：{SelectVersionName}";
            gameObject.SetActive(false);
        }
    }

    public void OnEditVersionButton()
    {
        manager.pathSettingWIndow_IFS.gameObject.SetActive(true);
        dropdown.Hide();
    }

    public void OnChangeVersionButton(int index)
    {
        SelectVersionName = versionsList[index];
    }

    public void CheckRootPath(string path)
    {
        rootReady = Directory.Exists(path);
        rootImage.sprite = rootReady ? checkSprite : errorSprite;
    }
    public void CheckOriginPath(string path)
    {
        originReady = Directory.Exists(path);
        originImage.sprite = originReady ? checkSprite : errorSprite;
    }
    public void CheckServerPath(string path)
    {
        serverReady = Directory.Exists(path);
        serverImage.sprite = serverReady ? checkSprite : errorSprite;
    }
    public void CheckClientPath(string path)
    {
        clientReady = Directory.Exists(path);
        clientImage.sprite = clientReady ? checkSprite : errorSprite;
    }
    public void CheckMappingPath(string path)
    {
        mappingReady = File.Exists(path);
        mappingImage.sprite = mappingReady ? checkSprite : errorSprite;
    }
    public void CheckLanguagePath(string path)
    {
        languageReady = File.Exists(path);
        languageImage.sprite = languageReady ? checkSprite : errorSprite;
    }

    public void CheckBlueprintPath(string path)
    {
        blueprintReady = Directory.Exists(path);
        blueprintImage.sprite = blueprintReady ? checkSprite : errorSprite;
    }
}
