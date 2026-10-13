using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;


public class FlashManager : MonoSingleton<FlashManager>
{
    private struct stFlash
    {
        public GameObject obj;
        public bool lastIsOpen;
        public Action callback;
        public int count;
    }

    private static List<stFlash> objs = new List<stFlash>();
    
    // Update is called once per frame
    private void Update()
    {
        for (int i = 0; i < objs.Count; i++)
        {
            stFlash flash = objs[i];

            if(flash.count <= (flash.lastIsOpen ? 5 : 6))
            {
                flash.obj.SetActive(flash.count % 2 > 0);
                flash.count++;
                objs[i] = flash;
            }
            else
            {
                if(flash.callback != null)
                    flash.callback();
                objs.RemoveAt(i);
            }
        }
    }

    public static void Flash(GameObject obj, bool lastIsOpen = true, Action cb = null)
    {
        stFlash flash = new stFlash();
        flash.obj = obj;
        flash.lastIsOpen = lastIsOpen;
        flash.callback = cb;
        flash.count = 0;
        objs.Add(flash);
    }
}
