using System;
using System.Collections;
using System.Collections.Generic;
using Unity.VisualScripting;
using UnityEngine;
using UnityEngine.UI;

public class SimBattle : MonoBehaviour
{
    [SerializeField] InputField inputFieldA;
    [SerializeField] InputField inputFieldB;
    [SerializeField] Button buttonA;
    [SerializeField] Button buttonB;
    [SerializeField] Text logText;

    public delegate void SkillDelegate(SimAttribute a, ref List<SimAttribute> b);
    List<SkillDelegate> Actions = new List<SkillDelegate>{SimSkill.Normal, SimSkill.Normal, SimSkill.One, SimSkill.Range};

    SimAttribute player;
    List<SimAttribute> monsters = new List<SimAttribute>();
    List<int> diePool = new List<int>();
    int killCount = 0;

    public SimAttribute PlayerFactory()
    {
        string[] split = inputFieldA.text.Split('\n');
        return new SimAttribute
        {
            attack = int.Parse(split[0]),
            defense = int.Parse(split[1]),
            health = int.Parse(split[2]),
        };
    }

    public SimAttribute MonsterFactory()
    {
        string[] split = inputFieldB.text.Split('\n');
        return new SimAttribute
        {
            attack = int.Parse(split[0]),
            defense = int.Parse(split[1]),
            health = int.Parse(split[2]),
        };
    }

    public void OnSimulateButton()
    {
        player = PlayerFactory();
        SimulateWorld(86400);
    }

    public void OnCopyAButton()
    {
        inputFieldA.text = Tools.TranspositionAttr(GUIUtility.systemCopyBuffer);
    }

    public void OnCopyBButton()
    {
        inputFieldB.text = Tools.TranspositionAttr(GUIUtility.systemCopyBuffer);
    }

    public void SimulateWorld(int time, string desc = "")
    {
        int actionId = 0;
        killCount = 0;
        monsters.Clear();
        while(monsters.Count < 7)
        {
            monsters.Add(MonsterFactory());
        }

        for (int s = 0; s < time; s++)
        {
            // if(s % 10 == 0)
            // {
            //     SpawnMiniMonster();
            // }

            SpawnMiniMonster();

            Actions[actionId](player, ref monsters);
            actionId = actionId + 1 > Actions.Count - 1 ? 0 : actionId + 1;

            CleanBody();
        }

        string log = $"本次模拟完成 耗时{time}秒 共计杀怪{killCount}只 效率{(killCount/(float)time).ToString("F2")}只/秒 {desc}";
        logText.text = log;
        Debug.Log(log);
    }

    public void SpawnMiniMonster()
    {
        // while(monsters.Count < 7)
        // {
        //     monsters.Add(MonsterFactory());
        // }

        while(diePool.Count > 0 && diePool[0] == 0)
        {
            monsters.Add(MonsterFactory());
            diePool.RemoveAt(0);
        }

        for (int i = 0; i < diePool.Count; i++)
        {
            diePool[i] -= 1;
        }
    }

    public void CleanBody()
    {
        for (int i = 0; i < monsters.Count; i++)
        { 
            if(monsters[i].health <= 0)
            {
                monsters.RemoveAt(0);
                diePool.Add(4);
                i--;
                killCount++;
            }
        }
    }
}