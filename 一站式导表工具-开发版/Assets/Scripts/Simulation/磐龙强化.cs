using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

public class 磐龙强化 : MonoBehaviour
{
    Dictionary<int, float> prob = new Dictionary<int, float>{{1,1f},{2,0.9f},{3,0.85f},{4,0.85f},{5,0.8f},{6,0.8f},{7,0.75f},{8,0.75f},{9,0.7f},{10,0.7f},{11,0.65f},{12,0.65f},{13,0.65f},{14,0.65f},{15,0.65f},{16,0.65f},{17,0.65f},{18,0.65f},{19,0.65f},{20,0.65f},{21,0.6f},{22,0.6f},{23,0.6f},{24,0.6f},{25,0.6f},{26,0.6f},{27,0.6f},{28,0.6f},{29,0.6f},{30,0.6f},{31,0.55f},{32,0.55f},{33,0.55f},{34,0.55f},{35,0.55f},{36,0.55f},{37,0.55f},{38,0.55f},{39,0.55f},{40,0.55f},{41,0.5f},{42,0.5f},{43,0.5f},{44,0.5f},{45,0.5f},{46,0.5f},{47,0.5f},{48,0.5f},{49,0.5f},{50,0.5f},{51,0.5f},{52,0.5f},{53,0.5f},{54,0.5f},{55,0.5f},{56,0.5f},{57,0.5f},{58,0.5f}};
    Dictionary<int, int> back = new Dictionary<int, int>{{1,0},{2,1},{3,2},{4,3},{5,4},{6,5},{7,6},{8,7},{9,8},{10,9},{11,10},{12,10},{13,10},{14,10},{15,10},{16,15},{17,15},{18,15},{19,15},{20,15},{21,20},{22,20},{23,20},{24,20},{25,20},{26,25},{27,25},{28,25},{29,25},{30,25},{31,30},{32,30},{33,30},{34,30},{35,30},{36,35},{37,35},{38,35},{39,35},{40,35},{41,40},{42,40},{43,40},{44,40},{45,40},{46,45},{47,45},{48,45},{49,45},{50,45},{51,50},{52,50},{53,50},{54,50},{55,50},{56,55},{57,55},{58,55}};

    [SerializeField] int peopleCount = 100000;
    [SerializeField] int startLevel = 49;
    [SerializeField] int targetLevel = 50;

    void Start()
    {
        int maxTarget = targetLevel + 1;
        string log = "";
        for (int i = startLevel + 1; i < maxTarget; i++)
        {
            int count = 0;
            for (int j = 0; j < peopleCount; j++)
            {
                count += Man(i);
            }
            log += $"{i} {(float)count / (float)peopleCount}\n";
        }
        Debug.Log(log);
    }

    int Man(int target)
    {
        int level = 0;
        int count = 0;
        
        while(level < target)
        {
            count++;
            level = LevelUp(level);
        }
        return count;
    }

    /// <summary>
    /// 
    /// </summary>
    /// <param name="curtLvl">当前等级</param>
    /// <returns>新的等级</returns>
    int LevelUp(int curtLvl)
    {
        if(Random.Range(0f, 1f) < prob[curtLvl + 1])
        {
            return curtLvl + 1;
        }
        else
        {
            return back[curtLvl + 1];
        }
    }
}
