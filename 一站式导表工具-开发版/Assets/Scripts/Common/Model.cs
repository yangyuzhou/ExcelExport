using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public enum emFileState
{
    Normal,
    Modify,
    Conflict,
}

public class stFile
{
    public string excelName;
    public string simpleName;
    public string csvName;
    public string excelFullPath;
    public string serverFullPath;
    public string cliectFullPath;
    public emFileState state;
}

// 用于存储单元格信息的类
public class CellUpdateInfo
{
    public int RowIndex { get; set; }
    public int CellIndex { get; set; }
    public string NewValue { get; set; }

    public CellUpdateInfo(int rowIndex, int cellIndex, string newValue)
    {
        RowIndex = rowIndex;
        CellIndex = cellIndex;
        NewValue = newValue;
    }
}

public class stDropSheet
{
    public int id;
    public string beizhu;
    public int type;
    public int order;
    public List<int> arraydata_id = new List<int>();
    public List<float> arraydata_probability = new List<float>();
    public List<string> itemdata_id = new List<string>();
    public List<int> itemdata_count = new List<int>();
    public List<float> itemdata_probability = new List<float>();
}

public class MonsterData
{
    public string id;
    public string map;
    public string name;
    public int lv;
    public List<int> dropId = new List<int>();
    public List<string> realDrop_id = new List<string>();
    public List<int> realDrop_count = new List<int>();
    public List<float> realDrop_probability = new List<float>();
}

public class QuestData
{
    public int row;
    public string id;
    public string previousId;
    public string nextId;
    public string job;
}

public class CharacterInfo
{
    public long atk;
    public long def;
    public long exa;//命中
    public long dod;//闪避
    public long hpmax;
    public long mshurt, msontop;//秒杀攻击，防御，伤害率，免伤率
    public Dictionary<CharacterBasePropType, long> Attrs = new Dictionary<CharacterBasePropType, long>();

    public CharacterInfo()
    {
        foreach (var item in System.Enum.GetValues(typeof(CharacterBasePropType)))
        {
            Attrs.Add((CharacterBasePropType)item, 0);
        }
    }

}

public enum CharacterBasePropType
{
    NoOpen = -1,//未开启
    None = 0,
    Atk,// 攻击
    Def,// 防御
    HpMax,// 生命上限
    Exa,// 精准
    Dod,// 闪避
    hurt,// 伤害率
    ontop,// 免伤率
    ty_2x,// 2倍天运暴击提高
    ty_3x,// 3倍天运暴击提高
    ty_4x,// 4倍天运暴击提高
    ty_5x,// 5倍天运暴击提高
    ty_6x,// 6倍天运暴击提高
    tyfree_2x,// 2倍天运暴击抵抗
    tyfree_3x,// 3倍天运暴击抵抗
    tyfree_4x,// 4倍天运暴击抵抗
    tyfree_5x,// 5倍天运暴击抵抗
    tyfree_6x,// 6倍天运暴击抵抗
    MpMax,// 魔法值上限
    Atksp,// 攻速 增益
    De_Atksp,// 攻速 减益
    Movsp,// 移动速度 增益
    De_Movsp,// 移动速度 减益
    Rehp, // 每5s回血
    Remp,// 每5s回蓝
    Expup,//经验提升
    MsAtk,  //秒杀攻击
    MsDef,  //秒杀防御
    MsHurt,  //秒杀伤害率
    MsOutop,//秒杀免伤率
    SoulExp,//魂值加成
    DropUp,//掉落加成
    ChildExp = 32,  //子女经验加成
    MetalAtk = 38,      //金攻击
    MetalDef = 39,      //金防御
    MetalDmg = 40,	    //金伤害
    MetalResist = 41,   //金抵抗
    MetalItd = 42,	    //金破防
    WoodAtk = 43,       //木攻击
    WoodDef = 44,       //木防御
    WoodDmg = 45,	    //木伤害
    WoodResist = 46,    //木抵抗
    WoodItd = 47,	    //木破防
    WaterAtk = 48,      //水攻击
    WaterDef = 49,      //水防御
    WaterDmg = 50,	    //水伤害
    WaterResist = 51,   //水抵抗
    WaterItd = 52,	    //水破防
    FireAtk = 53,       //火攻击
    FireDef = 54,       //火防御
    FireDmg = 55,	    //火伤害
    FireResist = 56,    //火抵抗
    FireItd = 57,	    //火破防
    EarthAtk = 58,      //土攻击
    EarthDef = 59,      //土防御
    EarthDmg = 60,	    //土伤害
    EarthResist = 61,   //土抵抗
    EarthItd = 62,	    //土破防
    WuXingAtk = 63,     //五行攻击
    WuXingDef = 64,     //五行防御
    WuXingDmg = 65,     //五行伤害
    WuXingResist = 66,  //五行抵抗
    WuXingItd = 67,     //五行破防 

    superior_atk,        //卓越一击superior_atk
    superior_atk_holdout, //卓越一击抵抗superior_atk_holdout
    luckly_atk,          //幸运一击 luckly_atk
    luckly_atk_holdout,   //幸运一击抵抗luckly_atk_holdout

    lgnore_def,           //无视防御lgnore_def
    sunder_armor,         //破甲sunder_armor
    dizziness_holdout,    //眩晕抵抗dizziness_holdout
    absolute_hurt,        //绝对伤害率
    absolute_outop,        //绝对免伤率
    absolute_avoidrate,        //绝对属性免除率

    Atk_Add = 78,        // 攻击加成
    Def_Add = 79,        // 防御加成
    HpMax_Add = 80,        // 生命上限加成
    Exp_Rem = 81,        // 每分钟经验值
    MetalDM = 82,        // 金伤害
    MetalIF = 83,        // 金免伤
    WoodDM = 84,        // 木伤害
    WoodIF = 85,        // 木免伤
    WaterDM = 86,        // 水伤害
    WaterIF = 87,        // 水免伤
    FireDM = 88,        // 火伤害
    FireIF = 89,        // 火免伤
    EarthDM = 90,        // 土伤害
    EarthIF = 91,        // 土免伤
    WxingDM = 92,        // 五行增伤
    WxingIF = 93,        // 五行免伤
    Block = 94,        // 格挡
    BlockHoldOut = 95,        // 格挡抵抗
    Thorns = 96,        // 反伤
    ThornsHoldOut = 97,        // 反伤抵抗
    Vampirism = 98,        // 吸血
    VamHoldOut = 99,        // 吸血抵抗
    FlyTime = 100,        // 飞行时间
    Coin_Rem = 101,        // 每分钟金币数
};

