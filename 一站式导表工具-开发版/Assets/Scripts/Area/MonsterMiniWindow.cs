using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using System.Linq;

public class MonsterMiniWindow : MonoBehaviour
{
    public GameObject monsterExample;
    public Transform content;
    public InputField searchInputField;  // InputField (Legacy)

    private List<GameObject> instantiatedMonsters = new List<GameObject>();

    // Start is called before the first frame update
    void Start()
    {
        searchInputField.onValueChanged.AddListener(OnSearchValueChanged);
        DisplayMonstersAsync(QuickCode.Instance.monsterDatas);
    }

    public async Task DisplayMonstersAsync(List<MonsterData> monsters)
    {
        // 清空之前的显示
        foreach (var monsterObj in instantiatedMonsters)
        {
            Destroy(monsterObj);
        }
        instantiatedMonsters.Clear();

        // 异步创建新的怪物对象
        await Task.Run(() =>
        {
            foreach (MonsterData monster in monsters)
            {
                // 确保在主线程上进行 GameObject 的创建和操作
                MainThreadDispatcher.Instance().Enqueue(() =>
                {
                    GameObject monsterInstance = Instantiate(monsterExample, content);
                    Text[] texts = monsterInstance.GetComponentsInChildren<Text>();
                    if (texts.Length >= 3)
                    {
                        texts[0].text = monster.id.ToString();
                        texts[1].text = monster.name;
                        // texts[2].text = monster.Position;
                    }
                    monsterInstance.SetActive(true);
                    instantiatedMonsters.Add(monsterInstance);
                });
            }
        });
    }

    void OnSearchValueChanged(string searchTerm)
    {
        // 筛选符合搜索条件的怪物
        List<MonsterData> filteredMonsters = QuickCode.Instance.monsterDatas
            .Where(m => m.id.Contains(searchTerm) || m.name.Contains(searchTerm))
            .ToList();

        // 显示筛选结果
        DisplayMonstersAsync(filteredMonsters);
    }
}
