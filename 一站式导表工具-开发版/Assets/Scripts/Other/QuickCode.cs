using System.Collections;
using System.Collections.Generic;
using System.Text;
using System.IO;
using System.Data;
using System.Threading.Tasks;
using UnityEngine;
using ExcelDataReader;
using System;

public class QuickCode : MonoSingleton<QuickCode>
{
    public Manager manager;
    [HideInInspector] public List<stDropSheet> dropSheets = new List<stDropSheet>();
    [HideInInspector] public List<MonsterData> monsterDatas = new List<MonsterData>();
    [HideInInspector] public List<QuestData> questDatas = new List<QuestData>();

    public void Init()
    {
    }

    void LoadDropSheet()
    {
        // 读取Excel文件
        dropSheets.Clear();
        string excelFilePath = @"C:\Users\user\Desktop\改表自动化\《破天一剑》掉落数据表.xlsx";
        using (FileStream stream = File.Open(excelFilePath, FileMode.Open, FileAccess.Read))
        {
            using (IExcelDataReader reader = ExcelReaderFactory.CreateOpenXmlReader(stream))
            {
                // 以数据集的形式加载Excel文件
                DataSet result = reader.AsDataSet();

                // 获取第一个工作表
                DataTable table = result.Tables[0];

                // 写入数据
                for (int i = 3; i < table.Rows.Count; i++)
                {
                    DataRow row = table.Rows[i];
                    stDropSheet s = new stDropSheet();

                    // 读取id
                    if(!int.TryParse(row[0].ToString(), out s.id))
                    {
                        continue;
                    }

                    try
                    {
                        // 读取备注
                        s.beizhu = row[1].ToString();
                        // 读取随机类型
                        s.type = int.Parse(row[2].ToString());
                        //s.order = int.Parse(row[10].ToString());

                        // 读取组数据
                        string arraydata = row[7].ToString();
                        string[] arraydata_split = arraydata.Split(";", System.StringSplitOptions.RemoveEmptyEntries);
                        foreach (var item in arraydata_split)
                        {
                            string[] item_split = item.Split(",", System.StringSplitOptions.RemoveEmptyEntries);
                            if(item_split.Length == 2)
                            {
                                int isf = int.Parse(item_split[0]);
                                float iss = float.Parse(item_split[1]) / 100;
                                s.arraydata_id.Add(isf);
                                s.arraydata_probability.Add(iss);
                            }
                            else if(item_split.Length != 0)
                            {
                                Debug.LogError($"arraydata列配置错误，在ID为{s.id}的行");
                            }
                        }

                        // 读取道具数据
                        string itemdata = row[8].ToString();
                        string[] itemdata_split = itemdata.Split(";", System.StringSplitOptions.RemoveEmptyEntries);
                        foreach (var item in itemdata_split)
                        {
                            string[] split1 = item.Split("*", System.StringSplitOptions.RemoveEmptyEntries);
                            string[] split2 = split1[1].Split(",", System.StringSplitOptions.RemoveEmptyEntries);

                            if(split1.Length == 2 && split2.Length == 2)
                            {
                                s.itemdata_id.Add(split1[0].ToString());
                                int count = 0;
                                int.TryParse(split2[0], out count);
                                s.itemdata_count.Add(count);
                                s.itemdata_probability.Add(float.Parse(split2[1]) / 100f);
                            }
                            else
                            {
                                Debug.LogError($"itemdata列配置错误，在ID为{s.id}的行");
                            }
                        }

                        dropSheets.Add(s);
                    }
                    catch(Exception e)
                    {
                        Debug.LogError($"掉落表中ID为{s.id}的行报错，{e}");
                    }
                }
            }
        }
        Debug.Log($"掉落表加载完成，共有{dropSheets.Count}条");
    }

    public async void LoadMonsterSheetAsync()
    {
        // 读取Excel文件
        monsterDatas.Clear();
        string excelFilePath = Path.Combine(manager.originPath, "《破天一剑》怪物数值表原型版.xlsx");

        await Task.Run(() =>
        {
            using (FileStream stream = File.Open(excelFilePath, FileMode.Open, FileAccess.Read))
            {
                using (IExcelDataReader reader = ExcelReaderFactory.CreateOpenXmlReader(stream))
                {
                    // 以数据集的形式加载Excel文件
                    DataSet result = reader.AsDataSet();

                    // 获取第一个工作表
                    DataTable table = result.Tables[0];

                    // 写入数据
                    for (int i = 3; i < table.Rows.Count; i++)
                    {
                        DataRow row = table.Rows[i];
                        MonsterData s = new MonsterData();

                        try
                        {
                            s.id = row[0].ToString();
                            s.map = row[1].ToString();
                            s.name = row[2].ToString();
                            int.TryParse(row[12].ToString(), out s.lv);

                            string did = row[73].ToString();
                            string[] did_split = did.Split("|", StringSplitOptions.RemoveEmptyEntries);
                            foreach (var item in did_split)
                            {
                                s.dropId.Add(int.Parse(item));
                            }

                            lock (monsterDatas) // 确保多线程安全
                            {
                                monsterDatas.Add(s);
                            }
                        }
                        catch (Exception e)
                        {
                            Debug.LogError($"怪物数值原型表中ID为{s.id}的行报错，{e}");
                        }
                    }
                }
            }
        });

        Debug.Log("怪物数据加载完成");
    }

    public void ReadQuestSheet(string excelFilePath)
    {
        // 读取Excel文件
        questDatas.Clear();
        using (FileStream stream = File.Open(excelFilePath, FileMode.Open, FileAccess.Read))
        {
            using (IExcelDataReader reader = ExcelReaderFactory.CreateOpenXmlReader(stream))
            {
                // 以数据集的形式加载Excel文件
                DataSet result = reader.AsDataSet();

                // 获取第一个工作表
                DataTable table = result.Tables[0];

                // 写入数据
                for (int i = 0; i < table.Rows.Count; i++)
                {
                    DataRow row = table.Rows[i];
                    QuestData data = new QuestData();

                    try
                    {
                        data.row = i + 1;
                        data.id = row[0].ToString();
                        data.previousId = row[1].ToString();
                        data.nextId = row[2].ToString();
                        data.job = row[13].ToString();
                        questDatas.Add(data);
                    }
                    catch(Exception e)
                    {
                        Debug.LogError($"掉落表中ID为{data.id}的行报错，{e}");
                    }
                }
            }
        }
        Debug.Log($"任务表加载完成，共有{questDatas.Count}条");
    }
}
