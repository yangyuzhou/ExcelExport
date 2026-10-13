using System.IO;
using System.Text;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class CreateWindow : MonoBehaviour
{
    [SerializeField] Manager manager;
    [SerializeField] InputField chineseName;
    [SerializeField] InputField englishName;

    public void OnSubmit()
    {
        string cn = "《破天一剑》" + chineseName.text;
        string en = englishName.text;

        // 在对照表中增加内容
        string newLine = cn + "," + en;
        using (StreamWriter sw = new StreamWriter(manager.mappingPath, true, Encoding.GetEncoding("GB2312")))
        {
            sw.WriteLine(newLine);
        }

        // 新建客户端CSV
        string targetCsvName = en + ".csv";
        string sourceFilePath = Path.Combine(Application.streamingAssetsPath, "CSV示例文件.csv");
        string destClientCSV = Path.Combine(manager.clientPath, targetCsvName);
        File.Copy(sourceFilePath, destClientCSV, true);

        // 新建客户端mate
        sourceFilePath = Path.Combine(Application.streamingAssetsPath, "Meta示例文件");
        string destClientCSVMate = Path.Combine(manager.clientPath, targetCsvName + ".meta");
        File.Copy(sourceFilePath, destClientCSVMate, true);

        // 新建服务器CSV
        string destServerCSV = Path.Combine(manager.serverPath, targetCsvName);
        File.Copy(sourceFilePath, destServerCSV, true);

        // 新建Excel
        string targetExcelName = cn + ".xlsx";
        sourceFilePath = Path.Combine(Application.streamingAssetsPath, "Excel示例文件.xlsx");
        string destOriginExcel = Path.Combine(manager.originPath, targetExcelName);
        File.Copy(sourceFilePath, destOriginExcel, true);

        // 提交SVN
        string destFiles = $" {destClientCSV} {destClientCSVMate} {destServerCSV} {destOriginExcel}";
        Tools.ExecuteSvnCommand($"add {destFiles}", true);
        Tools.ExecuteSvnCommand($"commit -m \"创建新表格: {cn} ~ {en}\" {manager.mappingPath} {destFiles}", true);
        gameObject.SetActive(false);
    }
}
