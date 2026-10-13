using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.EventSystems;

public class Menu : MonoBehaviour, IPointerClickHandler
{
    [SerializeField] Manager manager;

    public RectTransform activeObj;
    [SerializeField] GameObject openButton;
    [SerializeField] GameObject abandonButton;
    [SerializeField] GameObject useTheirButton;
    [SerializeField] GameObject useMineButton;

    stFile curtFile;

    public void OnPointerClick(PointerEventData eventData)
    {
        gameObject.SetActive(false);
    }

    public void Open(stFile file)
    {
        curtFile = file;
        gameObject.SetActive(true);
        switch(file.state)
        {
            case emFileState.Conflict:
                openButton.SetActive(true);
                abandonButton.SetActive(false);
                useTheirButton.SetActive(true);
                useMineButton.SetActive(true);
                break;
            case emFileState.Modify:
                openButton.SetActive(true);
                abandonButton.SetActive(true);
                useTheirButton.SetActive(false);
                useMineButton.SetActive(false);
                break;
            case emFileState.Normal:
                openButton.SetActive(true);
                abandonButton.SetActive(false);
                useTheirButton.SetActive(false);
                useMineButton.SetActive(false);
                break;
        }
    }

    public void OnOpenButton()
    {
        Tools.Run(curtFile.excelFullPath);
        gameObject.SetActive(false);
    }

    public void OnOpenServerCsvButton()
    {
        Tools.Run(curtFile.serverFullPath);
        gameObject.SetActive(false);
    }

    public void OnOpenClientCsvButton()
    {
        Tools.Run(curtFile.cliectFullPath);
        gameObject.SetActive(false);
    }

    public void OnOpenOriginFolderButton()
    {
        Tools.Run("explorer.exe", $"/select, \"{curtFile.excelFullPath}\"");
        gameObject.SetActive(false);
    }

    public void OnOpenServerFolderButton()
    {
        Tools.Run("explorer.exe", $"/select, \"{curtFile.serverFullPath}\"");
        gameObject.SetActive(false);
    }

    public void OnOpenClientFolderButton()
    {
        Tools.Run("explorer.exe", $"/select, \"{curtFile.cliectFullPath}\"");
        gameObject.SetActive(false);
    }

    public void OnCompareButton()
    {
        Tools.ExecuteSvnDiff(curtFile.cliectFullPath);
        gameObject.SetActive(false);
    }

    public void OnUseTheirButton()
    {
        Tools.ExecuteSvnCommand($"resolve --accept=theirs-full {curtFile.excelFullPath} {curtFile.serverFullPath} {curtFile.cliectFullPath}");
        manager.RefreshFiles();
        gameObject.SetActive(false);
    }

    public void OnUseMineButton()
    {
        Tools.ExecuteSvnCommand($"resolve --accept=mine-full {curtFile.excelFullPath} {curtFile.serverFullPath} {curtFile.cliectFullPath}");
        manager.RefreshFiles();
        gameObject.SetActive(false);
    }

    public void OnRevertButton()
    {
        Tools.ExecuteSvnCommand($"revert {curtFile.excelFullPath} {curtFile.serverFullPath} {curtFile.cliectFullPath}");
        manager.RefreshFiles();
        gameObject.SetActive(false);
    }
    
}
