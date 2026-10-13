using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class SimSmelt : MonoBehaviour
{
    public enum emAttr { 卓越一击,卓越一击抵抗,幸运一击,幸运一击抵抗,攻击加成,防御加成,生命上限加成,攻击等级加成,伤害率,免伤率,绝对增伤,绝对减伤, }
    public emAttr RandomAttr { get{ return (emAttr)System.Enum.GetValues(typeof(emAttr)).GetValue(Random.Range(0, System.Enum.GetValues(typeof(emAttr)).Length)); } }
    public List<emAttr> NewAttrs { get { return new List<emAttr> { RandomAttr, RandomAttr }; } }

    [SerializeField] Text text;

    public struct stSetting
    {
        public int lockCount;
        public float successProb;
    }

    public struct stResult
    {
        public long highCount;
        public long smeltCount;
        public long successCount;
        public long failureCount;
        public long cannotCount;
        public long lockCount;

        public override string ToString()
        {
            return $"{highCount}\t{smeltCount}\t{successCount}\t{failureCount}\t{cannotCount}\t{lockCount}";
        }
    }

    private void Start()
    {
        stSetting setting = new stSetting
        {
            lockCount = 0,
            successProb = 0.4f,
        };
        Simulate(setting);
        setting = new stSetting
        {
            lockCount = 1,
            successProb = 0.4f,
        };
        Simulate(setting);
        setting = new stSetting
        {
            lockCount = 2,
            successProb = 0.4f,
        };
        Simulate(setting);
        setting = new stSetting
        {
            lockCount = 0,
            successProb = 0.7f,
        };
        Simulate(setting);
        setting = new stSetting
        {
            lockCount = 1,
            successProb = 0.7f,
        };
        Simulate(setting);
        setting = new stSetting
        {
            lockCount = 2,
            successProb = 0.7f,
        };
        Simulate(setting);
    }

    public void Simulate(stSetting setting)
    {
        List<stResult> results = new List<stResult>();

        // 模拟熔炼过程
        for (int i = 0; i < 9999; i++)
        {
            stResult result = new stResult();
            List<emAttr> origin = NewAttrs;
            long lastHighCount = 0;
            while(!IsPerfact(origin))
            {
                int intSmelt = Smelt(setting, NewAttrs, ref origin);
                switch(intSmelt)
                {
                    case -2: result.cannotCount++; break;
                    case -1: result.failureCount++; break;
                    default: result.successCount++; result.lockCount += intSmelt; break;
                }
                result.smeltCount++;
                result.highCount = GetHighCount(origin);
                if(result.highCount != lastHighCount)
                {
                    results.Add(result);
                    lastHighCount = result.highCount;
                }
            }
        }

        //输出熔炼结果
        for (int i = 1; i <= 4; i++)
        {
            Output(results, i);
        }
    }

    public void Output(List<stResult> results, int highCount)
    {
        // 找到对应词条数的
        List<stResult> pool  = new List<stResult>();
        foreach (var r in results)
        {
            if(r.highCount != highCount) continue;
            pool.Add(r);
        }

        // 求和
        stResult sum = new stResult();
        foreach (var r in pool)
        {
            sum.highCount += r.highCount;
            sum.smeltCount += r.smeltCount;
            sum.successCount += r.successCount;
            sum.failureCount += r.failureCount;
            sum.cannotCount += r.cannotCount;
            sum.lockCount += r.lockCount;
        }

        // 平均
        stResult average = new stResult
        {
            highCount = sum.highCount / pool.Count,
            smeltCount = sum.smeltCount / pool.Count,
            successCount = sum.successCount / pool.Count,
            failureCount = sum.failureCount / pool.Count,
            cannotCount = sum.cannotCount / pool.Count,
            lockCount = sum.lockCount / pool.Count,
        };

        text.text += average + "\n";
    }

    /// <summary>
    /// 熔炼操作
    /// </summary>
    /// <param name="setting">设置</param>
    /// <param name="b">狗粮</param>
    /// <param name="a">想攒满的装备本体</param>
    /// <returns>消耗的熔炼符数量 -1 为不成功 -2 为无法熔炼</returns>
    private int Smelt(stSetting setting, List<emAttr> b, ref List<emAttr> a)
    {
        // 右侧提取出能熔炼的池子
        List<emAttr> pool = new List<emAttr>();
        foreach (var attr in b)
        {
            if(!a.Contains(attr))
            {
                pool.Add(attr);
            }
        }
        if(pool.Count == 0 || GetHighCount(pool) == 0) return -2;

        // 成功几率
        if(Random.Range(0f, 1f) > setting.successProb)
        {
            return -1;
        }

        // 选择右侧属性
        emAttr selected = pool[Random.Range(0, pool.Count)];

        // 补齐孔位
        if(a.Count < 4)
        {
            a.Add(selected);
            return 0;
        }

        // 选择左侧属性
        SortAttr(ref a);
        int startIndex = 0;
        for (int i = 0; i < setting.lockCount; i++)
        {
            if(a.Count > i && (int)a[i] > 7)
            {
                startIndex++;
            }
        }

        // 替换属性
        a[Random.Range(startIndex, a.Count)] = selected;
        return startIndex;
    }

    // 将高级属性挪到前面
    private void SortAttr(ref List<emAttr> attrs)
    {
        for (int i = 0; i < attrs.Count; i++)
        {
            if((int)attrs[i] > 7)
            {
                emAttr temp = attrs[i];
                attrs.RemoveAt(i);
                attrs.Insert(0, temp);
            }
        }
    }

    private bool IsPerfact(List<emAttr> sample)
    {
        if(sample.Count < 4) return false;
        for (int i = 0; i < 4; i++)
        {
            if((int)sample[i] < 8)
            {
                return false;
            }
        }
        return true;
    }

    private int GetHighCount(List<emAttr> sample)
    {
        int result = 0;
        for (int i = 0; i < sample.Count; i++)
        {
            if((int)sample[i] > 7)
            {
                result++;
            }
        }
        return result;
    }

    public void OnCopyButton()
    {
        GUIUtility.systemCopyBuffer = text.text;
    }
}
