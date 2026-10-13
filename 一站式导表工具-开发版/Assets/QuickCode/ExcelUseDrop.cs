using System.IO;
using System.Linq;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using System;
using Unity.VisualScripting;

public class ExcelUseDrop : MonoBehaviour
{
    void Start()
    {
        CalArrayDrop();
        CalMonsterDrop();

        int[] ids = new int[]{17203,10062,10063,10064,10065,10066,10067,10068,10047,10069,10107,10070,10071,10072,10073,10109,10061,10096,10097,10101,10098,10099,10100,10102,10111,10117,10122,10112,10113,10116,10121,10118,10119,10120,10114,10115,10140,10124,10126,10136,10138,10139,10141,10137,10156,10142,10143,10144,10145,10149,10148,10172,10173,10146,10147,10183,10186,10187,10188,10189,10191,10416,10417,10418,10419,10420,10421,10422,10428,10430,10429,10431,10432,10433,10434,80151,80152,80153,80154,80155,10447,10448,10449,10450,10451,10452,10453};

        string result = "";
        foreach (var id in ids)
        {
            MonsterData monster = null;// = QuickCode.Instance.monsterSheets.FirstOrDefault(x => x.id == id);
            for (int i = 0; i < monster.realDrop_id.Count; i++)
            {
                result += monster.realDrop_id[i];
                result += "&";
                // result += Mathf.RoundToInt(monster.realDrop_probability[i] * 1000000);
                // result += ";";
            }
            result += "\n";
        }

        string path = Application.dataPath + "/output/log.txt"; // 文件路径
        File.WriteAllText(path, result);
    }

    void CalArrayDrop()
    {
        List<stDropSheet> dropSheets = QuickCode.Instance.dropSheets;
        // 第一层：遍历掉落表
        for (int i = 0; i < dropSheets.Count; i++)
        {
            // 第二层：遍历组ID
            for (int j = 0; j < dropSheets[i].arraydata_id.Count; j++)
            {
                stDropSheet child = dropSheets.FirstOrDefault(dropSheets => dropSheets.id == QuickCode.Instance.dropSheets[i].arraydata_id[j]);
                if(child == null)
                {
                    Debug.Log(QuickCode.Instance.dropSheets[i].arraydata_id[j]);
                }
                // 第三层：遍历子组的物品
                for (int k = 0; k < child.itemdata_id.Count; k++)
                {
                    dropSheets[i].itemdata_id.Add(child.itemdata_id[k]);
                    dropSheets[i].itemdata_count.Add(child.itemdata_count[k]);
                    // dropSheets[i].itemdata_probability.Add((float)child.itemdata_probability[k]);
                    dropSheets[i].itemdata_probability.Add((float)(child.itemdata_probability[k] * dropSheets[i].arraydata_probability[j]));
                }
            }
        }
    }

    void CheckArrayDrop()
    {
        List<stDropSheet> dropSheets = QuickCode.Instance.dropSheets;
        // 第一层：遍历掉落表
        for (int i = 0; i < dropSheets.Count; i++)
        {
            if(dropSheets[i].itemdata_id.Count == 0)
                Debug.Log(dropSheets[i].id);
        }
    }

    void CalMonsterDrop()
    {
        List<MonsterData> monsterSheets = QuickCode.Instance.monsterDatas;
        List<stDropSheet> dropSheets = QuickCode.Instance.dropSheets;
        // 第一层：遍历怪物表
        for (int i = 0; i < monsterSheets.Count; i++)
        {
            // 第二层：遍历掉落ID
            for (int j = 0; j < monsterSheets[i].dropId.Count; j++)
            {
                stDropSheet child = dropSheets.FirstOrDefault(dropSheets => dropSheets.id == monsterSheets[i].dropId[j]);
                if(child != null)
                {
                    // 第三层：遍历掉落组
                    for (int k = 0; k < child.itemdata_id.Count; k++)
                    {
                        if(monsterSheets[i].realDrop_id.Contains(child.itemdata_id[k]))
                            continue;
                        monsterSheets[i].realDrop_id.Add(child.itemdata_id[k]);
                        monsterSheets[i].realDrop_count.Add(child.itemdata_count[k]);
                        monsterSheets[i].realDrop_probability.Add(child.itemdata_probability[k]);
                    }
                }
                else
                {
                    // Debug.LogError($"ID为{monsterSheets[i].id}的怪物配置了不存在的掉落组{monsterSheets[i].dropId[j]}");
                }
            }
        }
    }
}
