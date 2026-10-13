using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEditor;

public class Tools : MonoBehaviour
{
    [MenuItem("Tools/设置字母目录")]
    static void CreateTemp()
    {
        Transform catalogueParent = null;
        GameObject catalogueEample = null;

        GameObject[] objs = Selection.gameObjects;
        for (int i = 0; i < objs.Length; i++)
        {
            if(objs[i].name == "Catalogue")
            {
                catalogueParent = objs[i].transform;
            }
            else if(objs[i].name == "A")
            {
                catalogueEample = objs[i];
            }
        }

        for (int i = 65; i < 91; i++)
        {
            string word = ((char)i).ToString();
            GameObject obj = Instantiate(catalogueEample, catalogueParent);
            Text text = obj.GetComponentInChildren<Text>();
            text.text = word;
            obj.name = word;
            obj.SetActive(true);
        }
    }
}
