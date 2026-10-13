using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

public class ExcelEample : MonoBehaviour, IPointerClickHandler
{
    public Manager manager;
    public Text label;
    [SerializeField] GameObject stateFrame;
    [SerializeField] Text stateText;

    public stFile me;
    string labelContent;

    Color conflictColor = Color.yellow;
    Color modifyColor = Color.blue;

    public void SetExcel(Manager a_manager, string a_excelName)
    {
        manager = a_manager;
        me = manager.files[a_excelName];

        labelContent = "";
        labelContent += me.simpleName;
        labelContent += "\n";
        labelContent += me.csvName;
        label.text = labelContent;
    }

    public void OnButtonClick()
    {
        Tools.Run(me.excelFullPath);
    }

    public bool Search(string content)
    {
        return labelContent.ToLower().Contains(content.ToLower());
    }

    public void ResetState()
    {
        stateFrame.SetActive(false);
        stateText.gameObject.SetActive(false);
    }

    public void RefreshStateBySVN(stFile file)
    {
        switch(file.state)
        {
            case emFileState.Normal:
                stateFrame.SetActive(false);
                stateText.gameObject.SetActive(false);
                break;
            case emFileState.Modify:
                stateFrame.SetActive(true);
                stateText.gameObject.SetActive(true);
                stateFrame.GetComponent<Image>().color = modifyColor;
                stateText.text = "已修改";
                break;
            case emFileState.Conflict:
                stateFrame.SetActive(true);
                stateText.gameObject.SetActive(true);
                stateFrame.GetComponent<Image>().color = conflictColor;
                stateText.text = "冲突";
                break;

        }
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
