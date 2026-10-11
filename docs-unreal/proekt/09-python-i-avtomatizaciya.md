# 9. Python и автоматизация

> Как я управлял открытым редактором из скриптов: плагин Python, удалённое выполнение, какие скрипты есть в проекте и как запускать их самому.

← [Площадка под дом](08-ploshchadka-pod-dom.md) · [Маршрут](../00-marshrut.md) · [Начни отсюда](../00-НАЧНИ-ОТСЮДА.md)

---

**К концу главы:** ты запускаешь Python прямо в редакторе, читаешь и меняешь свойства объектов и ассетов из кода и делаешь скриптом то, что руками заняло бы полчаса.

## Что в этом файле

- [За 30 секунд](#за-30-секунд)
- [Зачем скрипты](#зачем-скрипты) · [Что для этого включено](#что-для-этого-включено) · [Скрипты проекта](#скрипты-проекта)
- [Как запустить скрипт](#как-запустить-скрипт) · [Основы API на примерах](#основы-api-на-примерах)
- [Грабли, на которые я наступил](#грабли-на-которые-я-наступил)
- [Квест 1. Первый скрипт](#квест-1-первый-скрипт) · [Квест 2. Кольцо камней](#квест-2-кольцо-камней)
- [Проверь себя](#проверь-себя) · [Босс главы](#босс-главы)

---

### За 30 секунд

- В редакторе есть Python: модуль `unreal` умеет почти всё, что кнопки.
- Быстрее всего — **Журнал выходных данных** → переключить `Cmd` на `Python` → писать прямо в строку.
- Файл целиком — **Инструменты → Выполнить сценарий Python…**
- Имена как в блюпринтах, только `snake_case`: `set_editor_property`, `get_all_level_actors`.
- Не знаешь, что есть у объекта, — `help(объект)` или `print(dir(объект))`.

## Зачем скрипты

Почти всё в Unreal можно сделать не только мышкой, но и **Python-скриптом**: импорт, создание материалов, настройка ассетов, расстановка объектов. Плюсы:

- **повторяемость** — поменял число, запустил, получил тот же результат с новым числом;
- **запись того, что сделано** — скрипт и есть инструкция;
- **масштаб** — настроить 28 текстур или 400 узлов материала руками долго.

Минус: сначала надо понять, что делать руками, иначе непонятно, что писать в скрипте. Поэтому в методичке везде есть «как руками».

## Что для этого включено

| Что | Где | Зачем |
|---|---|---|
| **Python Editor Script Plugin** | Правка → Плагины | Python внутри редактора (модуль `unreal`) |
| **Remote Execution** | Настройки проекта → Plugins → Python → Enable Remote Execution | редактор слушает команды снаружи — только с этого компьютера (127.0.0.1) |

Строки в `Config/DefaultEngine.ini`:

```ini
[/Script/PythonScriptPlugin.PythonScriptPluginSettings]
bRemoteExecution=True
```

<details>
<summary>🔎 Подробнее: как ue_remote.py разговаривает с редактором</summary>

1. `ue_remote.py` рассылает по **UDP multicast** на группу `239.0.0.1:6766` запрос **ping** — «есть тут редакторы?». TTL = 0 и адрес привязки `127.0.0.1` — сообщение не покидает компьютер.
2. Редактор с включённым Remote Execution слушает эту группу и отвечает **pong** — «я здесь, мой id такой-то».
3. Скрипт открывает у себя **TCP-порт** `127.0.0.1:6776` и отправляет по UDP **open_connection** — «подключись ко мне». Редактор подключается.
4. По TCP отправляется JSON: `{"command": "...код...", "exec_mode": "ExecuteFile"}`.
5. Редактор выполняет код в своём Python и присылает обратно вывод и результат.

Всё это реализовано в модуле движка `remote_execution.py` — мой скрипт лишь вызывает его. Снаружи компьютера редактор недоступен: адрес привязки — только локальный.

</details>

## Скрипты проекта

Все в `prog2/Scripts/`:

| Скрипт | Где запускать | Что делает |
|---|---|---|
| `fetch_polyhaven.py` | обычный Python | скачивает текстуры и модели с Poly Haven в `SourceArt/` |
| `setup_terrain.py` | в редакторе | импорт текстур, сборка `M_Terrain`, назначение ландшафту |
| `setup_foliage.py` | в редакторе | импорт моделей, типы травы `LGT_*`, материал `M_Foliage` с ветром |
| `capture_view.py` | в редакторе | снимок сцены в `Saved/Captures/` — так я смотрел результат |
| `ue_remote.py` | обычный Python | отправляет код или файл в открытый редактор |

Порядок пересборки с нуля: `fetch_polyhaven.py` → `setup_foliage.py` → `setup_terrain.py` (материал земли подключает траву, только если типы травы уже есть).

## Как запустить скрипт

**Способ 1 — из редактора.** **Инструменты → Выполнить сценарий Python…** → выбрать файл.

**Способ 2 — консоль Python.** Окно → Журнал выходных данных → слева от строки ввода переключи `Cmd` на `Python` и пиши прямо там:

```python
import unreal
unreal.log("привет из Python")
mi = unreal.load_asset("/Game/Terrain/MI_Terrain")
unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(mi, "RockSlopeStart", 0.12)
```

**Способ 3 — снаружи, как делал я.** Из терминала в папке проекта:

```bash
python Scripts/ue_remote.py Scripts/setup_terrain.py
```

`ue_remote.py` использует модуль `remote_execution.py`, который лежит в самом движке. Редактор должен быть открыт, Remote Execution — включён.

## Основы API на примерах

Модуль `unreal` повторяет то, что есть в блюпринтах, только имена в `snake_case`.

| Задача | Код |
|---|---|
| Загрузить ассет | `unreal.load_asset("/Game/Terrain/MI_Terrain")` |
| Прочитать/записать свойство | `obj.get_editor_property("srgb")`, `obj.set_editor_property("srgb", True)` |
| Сохранить ассет | `unreal.EditorAssetLibrary.save_loaded_asset(obj)` |
| Все акторы на уровне | `unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()` |
| Создать узел материала | `unreal.MaterialEditingLibrary.create_material_expression(mat, unreal.MaterialExpressionNoise, x, y)` |
| Соединить узлы | `MaterialEditingLibrary.connect_material_expressions(a, "", b, "A")` |
| Консольная команда | `unreal.SystemLibrary.execute_console_command(world, "grass.Enable 0")` |
| Импорт файла | `unreal.AssetImportTask()` + `AssetTools.import_asset_tasks([task])` |

Как узнать, что есть у объекта: `help(unreal.GrassVariety)` или `print(unreal.GrassVariety.__doc__)` — покажет все свойства с описаниями. Так я находил имена вроде `grass_density` или `instance_world_position_offset_disable_distance`.

## Грабли, на которые я наступил

| Грабли | Урок |
|---|---|
| Смотрел старый лог (`prog2.log`) вместо текущего (`prog2_2.log`) | после перезапуска редактор пишет в новый файл — бери самый свежий |
| Имя входа узла Noise не `Position`, а `World Position` | не угадывай — спроси: `get_material_expression_input_names(node)` |
| Камера захвата не видит траву | ландшафтная трава строится вокруг **камеры вьюпорта** — двигай её |
| Снимок окна редактора в фоне не делается | рендер в фоне замирает; `SceneCapture2D` + `export_render_target` работает |
| Из Python нельзя добавить камеру в запущенную игру | поставь актор на уровень **до** Play — он скопируется в игру |

## Квест 1. Первый скрипт

**Где:** учебный уровень `Lvl_Practice`. Внизу экрана — поле **Cmd** → кликни по слову `Cmd` → выбери **Python**. Теперь сюда можно писать код по одной строке (Enter — выполнить).

1. Поздоровайся:

```python
print("Привет из Unreal!")
```

   В **Журнале выходных данных** появится `LogPython: Привет из Unreal!`.

**2.** Сколько объектов на уровне:

```python
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors(); print(len(actors))
```

**3.** Все их имена и классы:

```python
for a in actors: print(a.get_actor_label(), "—", a.get_class().get_name())
```

**4.** Подними солнце из кода (найди его имя в выводе шага 3):

```python
sun = [a for a in actors if isinstance(a, unreal.DirectionalLight)][0]; sun.set_actor_rotation(unreal.Rotator(roll=0, pitch=-60, yaw=40), False)
```

Сцена изменилась сразу. `Ctrl+Z` работает и для действий скрипта.

```checklist
Квест 1 готов, если:
- переключил консоль в режим Python и вывел строку
- получил список акторов уровня с классами
- повернул солнце из кода и отменил через Ctrl+Z
```

## Квест 2. Кольцо камней

**Цель:** поставить 12 камней кругом радиусом 5 м — руками это долго и неровно, скриптом — секунда.

1. Создай в любом месте файл `ring.py` (например, в `prog2/Scripts/`), вставь:

```python
import math
import unreal

# камень из набора, который скачан для травы
mesh = unreal.load_asset(
    "/Game/Foliage/rock_moss_set_01/rock_moss_set_01_2k_centered/StaticMeshes/rock_moss_set_01_rock01")
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

COUNT = 12          # сколько камней
RADIUS = 500        # радиус, см
CENTER = unreal.Vector(0, 0, 0)

for i in range(COUNT):
    angle = 2 * math.pi * i / COUNT
    pos = CENTER + unreal.Vector(math.cos(angle) * RADIUS, math.sin(angle) * RADIUS, 0)
    rock = actors.spawn_actor_from_class(unreal.StaticMeshActor, pos,
                                         unreal.Rotator(0, 0, math.degrees(angle)))
    rock.static_mesh_component.set_static_mesh(mesh)
    rock.set_actor_label(f"Rock_{i:02d}")
    rock.set_folder_path("RockRing")      # папка в Структуре
print("Готово:", COUNT, "камней")
```

**2.** **Инструменты → Выполнить сценарий Python…** → выбери `ring.py`.
**3.** Посмотри: в Структуре появилась папка `RockRing` с 12 камнями, стоящими кругом.
**4.** Поменяй `COUNT = 24`, `RADIUS = 1000` → удали старые (выдели папку → `Delete`) → запусти снова.

> ⚠ Если ругается `NoneType has no attribute …` — путь к мешу неверный. Найди камень в каталоге → правый клик → **Копировать ссылку** и вставь путь из неё (без `StaticMesh'…'`).

```checklist
Квест 2 готов, если:
- кольцо из 12 камней появилось одним запуском
- меняю COUNT и RADIUS — получаю другое кольцо
- понимаю каждую строку скрипта
```

## Проверь себя

```quiz
В: Как выполнить одну строку Python в редакторе?
+ Внизу поле Cmd → переключить на Python → ввести строку → Enter
- Python работает только из внешнего терминала
- Через меню Справка
= Строка консоли в Журнале выходных данных умеет и консольные команды (Cmd), и Python.

В: Как узнать, какие свойства есть у объекта?
+ help(obj) или print(dir(obj))
- Только в документации на сайте
- Никак
= help показывает свойства с описаниями — так находятся имена вроде grass_density.

В: Скрипт поставил 12 камней не туда. Как быстро отменить?
+ Ctrl+Z — действия скрипта тоже попадают в историю отмены
- Только удалять по одному
- Перезапустить редактор
= Изменения уровня из Python записываются в ту же историю, что и ручные.
```

## Босс главы

```boss
# Наведи порядок
@id ue-boss-09
Напиши скрипт-«уборщик» для каталога `Content/Practice`.

1. Найди все ассеты в папке (`unreal.EditorAssetLibrary.list_assets("/Game/Practice", recursive=True)`).
2. Для каждого определи тип (`unreal.load_asset(путь).get_class().get_name()`).
3. Проверь префикс по типу: Texture2D → `T_`, Material → `M_`, MaterialInstanceConstant → `MI_`, StaticMesh → `SM_`, Blueprint → `BP_`.
4. Выведи список нарушителей: «`ground_diff` — Texture2D — должен начинаться с T_».
5. Бонус: переименуй их сам (`unreal.EditorAssetLibrary.rename_asset(старый, новый)`) — ссылки обновятся автоматически.

<details>
<summary>Подсказка</summary>

Путь из `list_assets` выглядит как `/Game/Practice/MyRock/ground_diff.ground_diff` — имя ассета после последней точки. Словарь `PREFIX = {"Texture2D": "T_", ...}` и `if not name.startswith(PREFIX[cls])`. Переименовывай в том же каталоге: `folder + "/" + PREFIX[cls] + name`.

</details>
```

---

← [Площадка под дом](08-ploshchadka-pod-dom.md) · [Начни отсюда](../00-НАЧНИ-ОТСЮДА.md)
