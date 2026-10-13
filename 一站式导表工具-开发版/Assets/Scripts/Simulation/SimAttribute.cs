using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class SimAttribute
{
    public long attack;
    public long defense;
    public long health;

    public override string ToString()
    {
        return $"攻击：{attack} 防御：{defense} 血量：{health}";
    }
}

public static class SimSkill
{
    public static void Empty()
    {
        
    }

    public static void Normal(SimAttribute A, ref List<SimAttribute> B)
    {
        if(B.Count > 0)
        {
            B[0].health -= Damage(A, B[0]);
        }
    }

    public static void One(SimAttribute A, ref List<SimAttribute> B)
    {
        if(B.Count > 0)
            B[0].health -= Damage(A, B[0]);
    }

    public static void Range(SimAttribute A, ref List<SimAttribute> B)
    {
        for (int i = 0; i < B.Count; i++)
        {
            B[i].health -= Damage(A, B[i]);
        }
    }

    private static long Damage(SimAttribute A, SimAttribute B)
    {
        return (A.attack * A.attack) / (A.attack + 3 * B.defense);
    }
}