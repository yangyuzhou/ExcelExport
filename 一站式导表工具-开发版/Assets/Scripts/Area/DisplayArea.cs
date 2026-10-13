using System.Collections.Generic;
using UnityEngine;
using NPinyin;
using UnityEngine.UI;
using Unity.VisualScripting;

public class DisplayArea : MonoBehaviour
{
    [SerializeField]Manager manager;

    [SerializeField]Transform excelParent;
    [SerializeField]GameObject alphabetExample;
    [SerializeField]GameObject byAlphabetExample;
    [SerializeField]GameObject excelExample;
    [SerializeField]InputField inputField;

    Dictionary<string, List<string>> excelNameGroupByAlphabet = new Dictionary<string, List<string>>();
    Dictionary<string, GameObject> cataObjs = new  Dictionary<string, GameObject>();
    Dictionary<string, GameObject> titleObjs = new Dictionary<string, GameObject>();
    Dictionary<string, Transform> listObjs = new Dictionary<string, Transform>();
    Dictionary<string, ExcelEample> itemObjs = new Dictionary<string, ExcelEample>();

    public void Init()
    {
        Init_CollectCataObjs();
        Init_GroupExcel();
        Init_SpawnExcelItem();

        RefreshCatalogue();
    }

    void Init_CollectCataObjs()
    {
        cataObjs.Clear();
        Transform parent = transform.Find("Catalogue");
        for (int i = 0; i < parent.childCount; i++)
        {
            GameObject child = parent.GetChild(i).gameObject;
            cataObjs.Add(child.name, child);
        }
    }

    void Init_GroupExcel()
    {
        // 创建分组
        excelNameGroupByAlphabet.Clear();
        for (int i = 65; i < 91; i++)
        {
            excelNameGroupByAlphabet.Add(((char)i).ToString(), new List<string>());
        }
        excelNameGroupByAlphabet.Add("#", new List<string>());

        // 给表格按字母分组
        foreach (var file in manager.files)
        {
            string name = file.Value.simpleName;
            string pinyin = Pinyin.GetPinyin(name).Substring(0, 1).ToUpper();
            if(excelNameGroupByAlphabet.ContainsKey(pinyin))
            {
                excelNameGroupByAlphabet[pinyin].Add(file.Value.excelName);
            }
            else
            {
                excelNameGroupByAlphabet["#"].Add(file.Value.excelName);
            }
        }
    }

    void Init_SpawnExcelItem()
    {
        for (int i = 0; i < excelParent.childCount; i++)
        {
            Destroy(excelParent.transform.GetChild(i).gameObject);
        }
        titleObjs.Clear();
        listObjs.Clear();
        itemObjs.Clear();
        manager.excelEamples.Clear();
        foreach (var item1 in excelNameGroupByAlphabet)
        {
            // 字母标题
            GameObject title = Instantiate(alphabetExample, excelParent);
            title.GetComponent<Text>().text = item1.Key;
            title.SetActive(true);
            titleObjs.Add(item1.Key, title);
            
            // 表格区域
            GameObject list = Instantiate(byAlphabetExample, excelParent);
            list.SetActive(true);
            listObjs.Add(item1.Key, list.transform);

            // 表格项
            foreach (var excelName in item1.Value)
            {
                GameObject item = Instantiate(excelExample, list.transform);
                ExcelEample excelEample = item.GetComponent<ExcelEample>();
                excelEample.SetExcel(manager, excelName);
                item.SetActive(true);
                itemObjs.Add(excelName, excelEample);
                manager.excelEamples.Add(excelEample);
            }
        }
    }

    void RefreshCatalogue()
    {
        for (int i = 65; i < 91; i++)
        {
            string word = ((char)i).ToString();
            
            bool show = false;
            for (int j = 0; j < listObjs[word].childCount; j++)
            {
                if(listObjs[word].GetChild(j).gameObject.activeSelf)
                {
                    show = true;
                    break;
                }
            }

            cataObjs[word].GetComponentInChildren<Text>().color = (show ? Color.black : Color.grey);
            titleObjs[word].SetActive(show);
            listObjs[word].gameObject.SetActive(show);
        }
    }

    public void SetScrollPos(string word)
    {
        if(titleObjs.ContainsKey(word))
        {
            float y = titleObjs[word].GetComponent<RectTransform>().anchoredPosition.y;
            RectTransform rectTransform = excelParent.GetComponent<RectTransform>();
            Vector2 origin = rectTransform.anchoredPosition;
            origin.y = -y - 5;
            rectTransform.anchoredPosition = origin;
        }
    }

    public void OnSearchSubmit(string str)
    {
        foreach (var item in itemObjs)
        {
            item.Value.gameObject.SetActive(item.Value.Search(str));
        }
        RefreshCatalogue();
    }

    public void OnClearButton()
    {
        foreach (var item in itemObjs)
        {
            item.Value.gameObject.SetActive(true);
            inputField.text = "";
        }
        RefreshCatalogue();
    }
}
