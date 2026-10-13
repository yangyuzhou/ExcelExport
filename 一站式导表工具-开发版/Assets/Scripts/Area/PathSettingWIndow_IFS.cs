using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

public class PathSettingWIndow_IFS : MonoBehaviour
{
    [SerializeField] Manager manager;
    [SerializeField] InputField inputField;

    void OnEnable()
    {
        inputField.text = PlayerPrefs.GetString("Versions");
    }

    public void OnCloseButton()
    {
        gameObject.SetActive(false);
    }

    public void OnSaveButton()
    {
        List<string> os = PlayerPrefs.GetString("Versions").Split("\n").ToList();
        List<string> ns = inputField.text.Split("\n").ToList();
        for (int i = 0; i < os.Count; i++)
        {
            if(!ns.Contains(os[i]))
            {
                PlayerPrefs.DeleteKey("VersionPath:" + os[i]);
            }
        }

        PlayerPrefs.SetString("Versions", inputField.text);
        manager.pathSettingWindow.LoadVersionsName();
        gameObject.SetActive(false);
    }
}
