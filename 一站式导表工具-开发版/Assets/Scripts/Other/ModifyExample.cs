using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;

public class ModifyExample : MonoBehaviour, IPointerClickHandler
{
    public Manager manager;
    public stFile me;

    public void SetExcel(Manager a_manager, string a_excelName)
    {
        manager = a_manager;
        me = manager.files[a_excelName];
    }

    public void OnPointerClick(PointerEventData eventData)
    {
        if (eventData.button == PointerEventData.InputButton.Right)
        {
            RectTransform rectTransform = manager.menu.activeObj;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(rectTransform.parent as RectTransform, eventData.position, eventData.pressEventCamera, out Vector2 localPoint);
            rectTransform.localPosition = localPoint;
            manager.menu.Open(me);
        }
    }
}
