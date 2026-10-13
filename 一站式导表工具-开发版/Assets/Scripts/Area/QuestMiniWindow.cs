using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using System.Threading.Tasks;
using UnityEditor;
using System.Linq;
using NPOI.HSSF.Record;

public class QuestMiniWindow : MonoBehaviour
{
    public Manager manager;

    // 加载表格用
    private string filePath
    {
        get {return System.IO.Path.Combine(manager.originPath, "《破天一剑》任务表.xlsx");}
    }
        
    public Text stateText;

    //功能区1：自动编号功能
    public InputField func1_inputField_startRow;
    public InputField func1_inputField_endRow;
    public Text func1_stateText;

    public async void OnLoadButton()
    {
        stateText.text = "加载中...";
        await LoadQuestSheetAsync();
        stateText.text = "表格已更新\n" + System.DateTime.Now;
        
        // 给func1功能找到主线的头尾
        func1_inputField_startRow.text = (QuickCode.Instance.questDatas.FindIndex(x => x.id == "#主线开始") + 2).ToString();
        func1_inputField_endRow.text = QuickCode.Instance.questDatas.FindIndex(x => x.id == "#主线结束").ToString();
    }

    private async Task LoadQuestSheetAsync()
    {
        // 使用异步方法加载表格数据
        await Task.Run(() => QuickCode.Instance.ReadQuestSheet(filePath));
    }

    // 功能区1：自动编号功能
    public async void OnAutoNumberButton()
    {
        func1_stateText.text = "编码中……";

        // 等待下一帧以确保 UI 更新
        await Task.Yield();

        var questDatas = QuickCode.Instance.questDatas;

        var startRow = int.Parse(func1_inputField_startRow.text) - 1;
        int endRow = int.Parse(func1_inputField_endRow.text);

        List<CellUpdateInfo> updates = new List<CellUpdateInfo>();
        for (int i = startRow; i < endRow; i++)
        {
            // 拿到当前任务
            var curtCell = questDatas[i];
            if(curtCell.id.Contains("#"))
            {
                updates.Add(new CellUpdateInfo(i, 1, ""));
                updates.Add(new CellUpdateInfo(i, 2, ""));
                continue;
            }

            // 拿到前一个任务
            int preIndex = i - 1;
            QuestData preCell = null;
            do
            {
                preCell = preIndex >= startRow ? questDatas[preIndex--] : null;
                if(preCell == null) break;
            }
            while(preCell.id.Contains("#"));

            // 拿到后一个任务
            var nextIndex = i + 1;
            QuestData nextCell = null;
            do
            {
                nextCell = nextIndex < endRow ? questDatas[nextIndex++] : null;
                if(nextCell == null) break;
            }
            while(nextCell.id.Contains("#"));

            // 填充previous列
            if(i > startRow)
            {
                if(curtCell.job == "-1")
                {
                    if(preCell.job == "-1")
                    {
                        curtCell.previousId = preCell.id;
                    }
                    else
                    {
                        string combineId = "";
                        int index = i - 1;
                        while (questDatas[index].id.Contains("#") || !(questDatas[index].job == "-1"))
                        {
                            if(!questDatas[index].id.Contains("#"))
                            {
                                combineId = "|" + questDatas[index].id + combineId;
                            }
                            index --;
                        }
                        curtCell.previousId = combineId[1..];
                    }
                }
                else
                {
                    int index = i - 1;
                    while(questDatas[index].id.Contains("#") || questDatas[index].job != "-1")
                    {
                        index--;
                    }
                    curtCell.previousId = questDatas[index].id;
                }
                updates.Add(new CellUpdateInfo(i, 1, curtCell.previousId));
            }

            // 填充next列
            if(i < endRow - 1)
            {
                if(curtCell.job == "-1")
                {
                    if(nextCell.job == "-1")
                    {
                        curtCell.nextId = nextCell.id;
                    }
                    else
                    {
                        string combineId = "";
                        int index = i + 1;
                        while(questDatas[index].id.Contains("#") || questDatas[index].job != "-1")
                        {
                            if(!questDatas[index].id.Contains("#"))
                            {
                                combineId = combineId + questDatas[index].id + "|";
                            }
                            index++;
                        }
                        curtCell.nextId = combineId[..^1];
                    }
                }
                else
                {
                    int index = i + 1;
                    while(questDatas[index].id.Contains("#") || questDatas[index].job != "-1")
                    {
                        index++;
                    }
                    curtCell.nextId = questDatas[index].id;
                }
                updates.Add(new CellUpdateInfo(i, 2, curtCell.nextId));
            }
        }

        func1_stateText.text = "写入文件……";
        await Task.Yield();
        
        await Tools.WriteExcelCellsAsync(filePath, 0, updates);
        
        func1_stateText.text = "编号";
    }
}
