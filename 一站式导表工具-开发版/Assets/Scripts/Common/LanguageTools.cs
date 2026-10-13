using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using System.IO;
using System.Text;
using ExcelDataReader;
using System.Data;

public static class LanguageTools
{
    static Manager manager;
    static string oldMd5;

    public static Dictionary<string, string> chinese = new Dictionary<string, string>();

    public static void Init(Manager a_manager)
    {
        manager = a_manager;
    }

    public static bool IsChanged()
    {
        string a = Tools.GetFileMd5(manager.languagePath);
        return a != oldMd5;
    }

    public static void ReloadLanguage()
    {
        chinese.Clear();
        using (FileStream stream = File.Open(manager.languagePath, FileMode.Open, FileAccess.Read))
        {
            using (IExcelDataReader reader = ExcelReaderFactory.CreateOpenXmlReader(stream))
            {
                DataSet result = reader.AsDataSet();
                DataTable table = result.Tables[0];
                foreach (DataRow row in table.Rows)
                {
                    string key = row[0].ToString();
                    string value = row[1].ToString();
                    if(!chinese.ContainsKey(key))
                    {
                        chinese.Add(key, value);
                    }
                    else
                    {
                        chinese[key] = value;   // 当某个项重复出现时，用后面的替代前面的
                    }
                }
            }
        }
        oldMd5 = Tools.GetFileMd5(manager.languagePath);
        Tools.Log($"读取到 {chinese.Count} 行多语言配置");
    }
}
