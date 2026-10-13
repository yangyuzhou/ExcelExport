using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using System;
public class MonoSingleton<T> : MonoBehaviour where T : MonoSingleton<T>
{
    protected static T _instance;
    public static T Instance
    {
        get
        {
            if (_instance == null)
            {
                //在场景当中寻找一个Single类型   GameObject  Object
                if(_instance = FindObjectOfType(typeof(T)) as T)
                    DontDestroyOnLoad(_instance.gameObject);
            }
            if (_instance == null)
            {
                GameObject go = new GameObject();
                _instance = go.AddComponent<T>();
                DontDestroyOnLoad(_instance.gameObject);
            }
            return _instance;
        }
    }
}