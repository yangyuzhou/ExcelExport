using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class MultifunctionalWindow : MonoBehaviour
{
    public Manager manager;
    public Dropdown dropdown;
    public List<GameObject> gameObjects;

    void Start()
    {
        dropdown.onValueChanged.AddListener(OnDropdownValueChanged);
        UpdateGameObjects(dropdown.value);
    }

    void OnDisable()
    {
        manager.RefreshFiles();
    }

    void OnDropdownValueChanged(int index)
    {
        UpdateGameObjects(index);
    }

    void UpdateGameObjects(int activeIndex)
    {
        for (int i = 0; i < gameObjects.Count; i++)
        {
            if (i == activeIndex)
            {
                gameObjects[i].SetActive(true);
            }
            else
            {
                gameObjects[i].SetActive(false);
            }
        }
    }

    void OnDestroy()
    {
        dropdown.onValueChanged.RemoveListener(OnDropdownValueChanged);
    }
}
