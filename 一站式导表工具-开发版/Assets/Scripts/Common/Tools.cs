using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text;
using System.IO;
using System.Data;
using System.Threading.Tasks;
using System.Security.Cryptography;
using UnityEngine;
using UnityEngine.UI;
using ExcelDataReader;
using System;
using System.Linq;
using System.Text.RegularExpressions;
using NPOI.SS.UserModel;
using NPOI.XSSF.UserModel;

public static class Tools
{
    public static Manager manager;
    public static Text logText;
    public static ScrollRect logScroll;

    public static string ExecuteSvnCommand(string arguments, bool log = true)
    {
        if (log) Log("svn " + arguments);
        ProcessStartInfo startInfo = new ProcessStartInfo
        {
            FileName = "svn",
            Arguments = arguments,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.GetEncoding("GB2312"),
        };

        Process process = new Process { StartInfo = startInfo };
        process.Start();

        // 读取输出和错误信息
        string standardOutput = process.StandardOutput.ReadToEnd();
        string standardError = process.StandardError.ReadToEnd();

        process.WaitForExit(); // 确保命令完全执行完成

        // 记录输出和错误
        if (!string.IsNullOrEmpty(standardOutput) && log)
        {
            //剔除Excel临时文件
            var filteredLines = standardOutput.Split('\n').Where(line => !line.Contains('~'));
            string output = string.Join("\n", filteredLines);

            if (output == "")
            {
                output = "没有更新到修改过的表格";
            }

            Log("<color=green>" + output + "</color>");
        }
        if (!string.IsNullOrEmpty(standardError))
        {
            if (log) Log("<color=red>" + standardError + "</color>");
        }

        return standardOutput;
    }

    public static void ExecuteSvnDiff(string path)
    {
        ProcessStartInfo startInfo = new ProcessStartInfo
        {
            FileName = "TortoiseProc",
            Arguments = $"/command:diff /path:\"{path}\"",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.GetEncoding("GB2312"),
        };

        Process process = new Process { StartInfo = startInfo };
        process.Start();
        process.WaitForExit(); // 确保命令完全执行完成
    }

    public static async Task<string> ExecuteTortoiseSVNCommand(string arguments)
    {
        ProcessStartInfo startInfo = new ProcessStartInfo
        {
            FileName = "TortoiseProc",
            Arguments = arguments,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.GetEncoding("GB2312"),
        };

        string output = await Task.Run(() =>
        {
            using (Process process = new Process { StartInfo = startInfo })
            {
                process.Start();

                // 读取输出和错误信息
                string standardOutput = process.StandardOutput.ReadToEnd();
                string standardError = process.StandardError.ReadToEnd();

                process.WaitForExit(); // 确保命令完全执行完成

                // 记录输出和错误
                if (!string.IsNullOrEmpty(standardOutput))
                {
                    UnityEngine.Debug.Log(standardOutput);
                }
                if (!string.IsNullOrEmpty(standardError))
                {
                    UnityEngine.Debug.Log(standardError);
                }

                return standardOutput;
            }
        });
        return output;
    }

    public static void Log(string text)
    {
        if (logText.text.Length >= 10000)
        {
            logText.text = "日志太多了，清空一次";
        }
        logText.text += "\n" + text;
        Canvas.ForceUpdateCanvases();
        logScroll.verticalNormalizedPosition = 0f;
    }

    public static void ExcelToCsv(string excelFilePath, string csvFilePath)
    {
        // 读取Excel文件
        using (FileStream stream = File.Open(excelFilePath, FileMode.Open, FileAccess.Read))
        {
            using (IExcelDataReader reader = ExcelReaderFactory.CreateOpenXmlReader(stream))
            {
                // 以数据集的形式加载Excel文件
                DataSet result = reader.AsDataSet();

                // 获取第一个工作表
                DataTable table = result.Tables[0];

                // 写入CSV文件
                using (StreamWriter writer = new StreamWriter(csvFilePath, false, new UTF8Encoding(true)))
                {
                    // 写入数据
                    foreach (DataRow row in table.Rows)
                    {
                        for (int i = 0; i < table.Columns.Count; i++)
                        {
                            // string content = row[i].ToString();
                            string content = GetContent(row[i]);

                            if (LanguageTools.chinese.ContainsKey(content))
                            {
                                content = LanguageTools.chinese[content];
                            }
                            string cellContent = ReplaceCellBy小程序(row[i].GetType(), content);
                            // string cellContent = ReplaceCellBy手游(content);
                            if (i < table.Columns.Count - 1)
                            {
                                cellContent += ",";
                            }
                            writer.Write(cellContent);
                        }
                        writer.WriteLine();
                    }
                }
            }
        }
    }

    static string ReplaceCellBy小程序(Type type, string content)
    {
        return type == typeof(string) ? "\"" + content + "\"" : content;
    }

    static string ReplaceCellBy手游(string content)
    {
        StringBuilder sb = new StringBuilder();
        string fielddata = content;
        var cs = fielddata.ToCharArray();

        bool hasqote = false;
        foreach (char ch in cs)
        {
            if (ch == '"' ||
                ch == ',' ||
                ch == '\r' ||
                ch == '\n')
            {
                hasqote = true;
                break;
            }
        }

        if (hasqote)
        {
            sb.Append('"');
            foreach (char ch in cs)
            {
                if (ch == '"')
                    sb.Append("\"\"");
                else
                    sb.Append(ch);
            }
            sb.Append('"');
        }
        else
            sb.Append(cs);

        return sb.ToString();
    }

    static string GetContent(object obj)
    {
        if (obj == null)
            obj = "";
        else
        {
            var objtype = obj.GetType();
            if (objtype == typeof(double))
                obj = Math.Round((double)obj, 12);
            else if (objtype == typeof(float))
                obj = Math.Round((float)obj, 6);
            else if (objtype == typeof(DateTime))
            {
                DateTime dt = (DateTime)obj;
                if (dt.Year == 1899)
                {
                    if (dt.Second == 0)
                        obj = dt.ToString("HH:mm");
                    else
                        obj = dt.ToString("HH:mm:ss");
                }
                else if (dt.Hour == 0 && dt.Minute == 0 && dt.Second == 0)
                    obj = dt.ToString("yyyy/MM/dd");
                else
                    obj = dt.ToString("yyyy/MM/dd HH:mm:ss");
            }
        }

        return Convert.ToString(obj);
    }

    public static void Run(string path)
    {
        Process.Start(path);
    }

    public static void Run(string path, string param)
    {
        Process.Start(path, param);
    }

    public static string GetFileMd5(string path)
    {
        using (var md5 = MD5.Create())
        {
            using (var stream1 = File.OpenRead(path))
            {
                byte[] hash = md5.ComputeHash(stream1);
                stream1.Close();
                return BitConverter.ToString(hash);
            }
        }
    }


    public static void WriteExcelCells(string filePath, int sheetIndex, List<CellUpdateInfo> updates)
    {
        // 打开 Excel 文件
        using (FileStream file = new FileStream(filePath, FileMode.Open, FileAccess.ReadWrite))
        {
            IWorkbook workbook = new XSSFWorkbook(file);  // 如果是 .xls 文件，改为 HSSFWorkbook(file)
            ISheet sheet = workbook.GetSheetAt(sheetIndex);

            // 批量更新单元格
            foreach (var update in updates)
            {
                IRow row = sheet.GetRow(update.RowIndex) ?? sheet.CreateRow(update.RowIndex);
                ICell cell = row.GetCell(update.CellIndex) ?? row.CreateCell(update.CellIndex);

                // 设置新值
                if (double.TryParse(update.NewValue, out double numericValue))
                {
                    // 写入数字
                    cell.SetCellValue(numericValue);
                }
                else
                {
                    // 写入字符串
                    cell.SetCellValue(update.NewValue);
                }
            }

            // 重新保存文件
            using (FileStream outputFile = new FileStream(filePath, FileMode.Create, FileAccess.Write))
            {
                workbook.Write(outputFile);
            }
        }
    }

    public static Task WriteExcelCellsAsync(string filePath, int sheetIndex, List<CellUpdateInfo> updates)
    {
        return Task.Run(() => WriteExcelCells(filePath, sheetIndex, updates));
    }

    public static string TranspositionAttr(string attr)
    {
        return attr.Replace("\t", "\n").TrimEnd('\n', '\r').Replace(" ", "");
    }
    

    /// <summary>
    /// 找出 <paramref name="localPath"/> 工作副本中落后于远程 HEAD 的文件或新增文件。
    /// </summary>
    public static IReadOnlyList<string> GetRemoteNewerFiles(string localPath)
    {
        // 正则匹配 svn status -u 输出中带有“*”的行。   例： " * 1053 Assets/Scripts/MyClass.cs"
        Regex _remoteNewerLine = new Regex(@"^\s*[A-Z\?\s]{7}\s\*\s+\d+\s+(?<path>.+)$",RegexOptions.Compiled | RegexOptions.CultureInvariant);

        if (string.IsNullOrWhiteSpace(localPath))
        {
            throw new ArgumentException("localPath 不能为空", nameof(localPath));
        }

        // -u 代表联系服务器；在第 9 列出现 '*' 表示该条目在远程有更新
        string output = ExecuteSvnCommand($"status -u \"{localPath}\"");

        List<string> newerFiles = new List<string>();

        using var reader = new StringReader(output);
        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            var match = _remoteNewerLine.Match(line);
            if (match.Success)
            {
                // 捕获组 "path" 即为相对路径
                newerFiles.Add(match.Groups["path"].Value.Trim());
            }
        }

        return newerFiles;
    }
}
