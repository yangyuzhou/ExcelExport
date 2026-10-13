using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class 马尔科夫链 : MonoBehaviour
{
    int[,] prob = new int[,]{
        {5000, 5000, 0, 0, 0, 0},
        {2000, 5000, 3000, 0, 0, 0},
        {2000, 4000, 3000, 1000, 0, 0},
        {1000, 4000, 3000, 1000, 1000, 0},
        {1000, 3000, 3000, 1000, 1000, 1000},
        {1000, 3000, 2000, 2000, 1000, 1000},
        {500, 3000, 2000, 2000, 1000, 1500},
        {500, 2000, 2000, 2000, 1000, 2500},
        {500, 2000, 2000, 2000, 500, 3000},
        {500, 1500, 2000, 2000, 500, 3500},
        {0, 1500, 2500, 2000, 500, 3500},
        {0, 1000, 2500,  2500, 500, 3500},
    };

    float[] average = new float[12];

    [SerializeField] int peopleCount = 100000;
    [SerializeField] int startLevel = 0;
    [SerializeField] int targetLevel = 12;

    void Start()
    {
        string log = "";
        for (int i = 0; i < peopleCount; i++)
        {
            float[] result = Test(targetLevel);
            for (int j = 0; j < result.Length; j++)
            {
                average[j] += result[j];
            }
        }
        for (int i = 0; i < average.Length; i++)
        {
            average[i] /= peopleCount;
            log += $"{i+1} {average[i]}\n";
        }
        Debug.Log(log);
    }

    float[] Test(int target)
    {
        int level = startLevel;
        int count = 0;
        float[] result = new float[12];

        while (level < target)
        {
            count++;
            level = Upgrade(level);
            for (int i = 0; i < level; i++)
            {
                if (result[i] == 0)
                {
                    result[i] = count;
                }
            }
        }
        return result;
    }

    int Upgrade(int curtLvl)
    {
        int rand = Random.Range(0, 10000);
        int sum = 0;
        for (int i = 0; i < 6; i++)
        {
            sum += prob[curtLvl, i];
            if (rand < sum)
            {
                switch (i)
                {
                    case 0:
                        curtLvl += 2;
                        break;
                    case 1:
                        curtLvl += 1;
                        break;
                    case 3:
                        curtLvl -= 1;
                        break;
                    case 4:
                        curtLvl -= 2;
                        break;
                    case 2:
                    case 5:
                        break;
                    default:
                        throw new System.Exception("概率错误");
                }
                break;
            }
        }
        return Mathf.Clamp(curtLvl, 0, targetLevel);
    }
}
