using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class CommonMiniWindow : MonoBehaviour
{
    [SerializeField] Manager manager;

    void Start()
    {

    }

    public void OnTranspositionButton()
    {
        string clipboardText = GUIUtility.systemCopyBuffer;
        clipboardText = Tools.TranspositionAttr(clipboardText);
        GUIUtility.systemCopyBuffer = clipboardText;
    }
}
