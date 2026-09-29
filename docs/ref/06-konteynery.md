# Контейнеры: vector, map, set, pair

> Список чего-нибудь, поиск по имени, «а это уже было?», таблицы
>
> Это разделы 11–16 справочника. Нумерация сквозная во всех файлах: ссылка «см. [раздел 18](07-algoritmy.md#18-алгоритмы)» ведёт в [Итераторы и алгоритмы](07-algoritmy.md), а полный список — в [оглавлении](../00-НАЧНИ-ОТСЮДА.md).

**Уровень:** 🟡 нужна база · **Опирается на:** [Функции](04-funkcii.md), [Строки](05-stroki.md)

[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md) · [Маршрут изучения](../00-marshrut.md) · [← Строки](05-stroki.md) · [Алгоритмы →](07-algoritmy.md)

---

> Определения функций этой темы (`push_back`, `map[]`, `set.insert`) — коротко в [Словаре функций](10a-slovar-funkcij.md#тема-6-контейнеры).

## Что в этом файле

- [За 30 секунд](#за-30-секунд)
- [Какой контейнер выбрать](#какой-контейнер-выбрать)
- **[11. Массивы и `std::vector`](#11-массивы-и-stdvector)**
  - [Обычный массив — и почему от него уходят](#обычный-массив--и-почему-от-него-уходят)
  - [`std::array` — фиксированный размер, но безопасно](#stdarray--фиксированный-размер-но-безопасно)
  - [`std::vector` — массив, который умеет всё](#stdvector--массив-который-умеет-всё)
  - [Как вектор устроен: одна картинка](#как-вектор-устроен-одна-картинка)
  - [Как вектор растёт: `size` и `capacity`](#как-вектор-растёт-size-и-capacity)
  - [Главная опасность — выход за границы](#главная-опасность--выход-за-границы)
  - [Типовые ситуации](#типовые-ситуации)
  - [Очередь и стек: `queue` и `stack`](#очередь-и-стек-queue-и-stack)
  - [Очередь с приоритетом: `priority_queue`](#очередь-с-приоритетом-priority_queue)
- **[12. Словарь `std::map`](#12-словарь-stdmap)**
  - [Главная ловушка: `[]` при чтении создаёт элемент](#главная-ловушка--при-чтении-создаёт-элемент)
  - [А вот когда `[]` — именно то, что нужно](#а-вот-когда---именно-то-что-нужно)
  - [Перебор](#перебор)
  - [Удаление](#удаление)
  - [Типовые задачи с `map`](#типовые-задачи-с-map)
  - [Свой `struct` как ключ](#свой-struct-как-ключ)
- **[13. `std::unordered_map`](#13-stdunordered_map)**
- **[14. `std::set` — только уникальные](#14-stdset--только-уникальные)**
  - [Типовые задачи с `set`](#типовые-задачи-с-set)
- **[15. `std::pair` — две вещи вместе](#15-stdpair--две-вещи-вместе)**
  - [Где пара встречается сама собой](#где-пара-встречается-сама-собой)
  - [Структурные привязки — читай как «разложить на части»](#структурные-привязки--читай-как-разложить-на-части)
  - [Вектор пар — когда порядок важнее поиска](#вектор-пар--когда-порядок-важнее-поиска)
- **[16. Вложенные контейнеры](#16-вложенные-контейнеры)**
  - [Таблица чисел: `vector<vector<int>>`](#таблица-чисел-vectorvectorint)
  - [Словарь списков: `map<string, vector<int>>`](#словарь-списков-mapstring-vectorint)
  - [Словарь словарей](#словарь-словарей)
  - [Вектор структур — самая частая форма](#вектор-структур--самая-частая-форма)
- **[Рецепты: хочу X → вот код](#рецепты-хочу-x--вот-код)**
- **[Мини-проект: телефонная книга на `map`](#мини-проект-телефонная-книга-на-map)**
- **[Проверь себя](#проверь-себя)**
- **[Закрепление прошлых тем](#закрепление-прошлых-тем)**

---


### За 30 секунд

- `std::vector<T>` — список по порядку: `push_back`, `v[i]`, `v.size()`. Выбор по умолчанию.
- `std::map<K, V>` — словарь «ключ → значение», всегда по порядку ключей. `m[k]` **создаёт** ключ, если его не было.
- Проверять и читать `map`, не создавая записей, — `contains` и `find`.
- `std::set<T>` — только уникальные значения, по порядку.
- Перебор любого контейнера — `for (const auto &x : c)`.

```cpp
std::vector<int> v = {3, 1, 2};      v.push_back(5);
std::map<std::string, int> age;      age["Аня"] = 20;
if (age.contains("Борис")) { /* есть такой ключ */ }
std::set<int> seen;                  seen.insert(3);
for (const auto &[name, a] : age) std::cout << name << " " << a << "\n";
```

Если совсем с нуля: **контейнер** — это «умное хранилище» для многих значений. `vector` — список по порядку, `map` — словарь «ключ → значение», `set` — множество без повторов. Почти любая реальная задача — это они.

### Какой контейнер выбрать

Начни с вопроса «что я буду делать с данными чаще всего?» — ответ почти всегда однозначен:

```
   Нужно находить значение по ключу (имени, слову, коду)?
   ├─ да ─► важен порядок ключей (вывод по алфавиту)?
   │        ├─ да ──► std::map
   │        └─ нет ─► std::unordered_map   (или тоже map — на учебных объёмах разницы нет)
   └─ нет ─► нужны только уникальные значения («было / не было»)?
            ├─ да ──► std::set
            └─ нет ─► размер известен заранее и не меняется?
                     ├─ да ──► std::array
                     └─ нет ─► std::vector   ← выбор по умолчанию
```

| Задача | Бери | Раздел |
|---|---|---|
| Список по порядку, доступ по номеру: оценки, товары, ходы | `std::vector` | [11](#11-массивы-и-stdvector) |
| Фиксированный набор: 7 дней недели, поле 3×3 | `std::array` | [11](#stdarray--фиксированный-размер-но-безопасно) |
| Найти по ключу: имя → телефон, слово → перевод | `std::map` | [12](#12-словарь-stdmap) |
| Посчитать, сколько раз встречается каждое слово | `std::map<std::string, int>` | [12](#а-вот-когда---именно-то-что-нужно) |
| Очень много ключей, порядок не нужен | `std::unordered_map` | [13](#13-stdunordered_map) |
| «Это уже было?», убрать повторы | `std::set` | [14](#14-stdset--только-уникальные) |
| Две связанные вещи: координата, «имя + балл» | `std::pair` или свой `struct` | [15](#15-stdpair--две-вещи-вместе) |
| Очередь «кто первый пришёл» / стопка «последний сверху» | `std::queue` / `std::stack` | [11](#очередь-и-стек-queue-и-stack) |

Сомневаешься — бери `vector`. Он самый простой, самый быстрый на небольших объёмах и подходит для большинства учебных задач. Насколько быстро каждый контейнер ищет и вставляет — в разделе [«Как оценить скорость»](07-algoritmy.md#как-оценить-скорость-o1-olog-n-on-on²).

## 11. Массивы и `std::vector`

### Обычный массив — и почему от него уходят

```cpp
int a[5] = {1, 2, 3, 4, 5};      // размер известен на этапе компиляции и не меняется
std::cout << a[0] << "\n";       // → 1

int b[3] = {};                   // все нули
int c[] = {1, 2, 3};             // размер выведется сам: 3

// Проблемы:
std::cout << a[10];              // ❌ никто не проверит — читаем чужую память
// нет способа узнать размер, если массив передан в функцию
// нельзя добавить элемент
```

### `std::array` — фиксированный размер, но безопасно

Если размер и правда постоянный (доска 8×8, семь дней недели, три координаты), C-массив можно заменить на `std::array`. Тот же фиксированный размер, но со всеми удобствами контейнера.

```cpp
#include <array>

std::array<int, 5> a = {1, 2, 3, 4, 5};   // размер 5 — часть типа, задаётся при объявлении

std::cout << a.size() << "\n";       // → 5    массив ЗНАЕТ свой размер (у C-массива этого нет)
std::cout << a.at(1) << "\n";        // → 2    .at — с проверкой границ
std::cout << a.front() << " " << a.back();   // → 1 5

for (int x : a)                      // range-for работает
  std::cout << x << " ";             // → 1 2 3 4 5
```

Чем `std::array` лучше `int a[5]`:

| | `int a[5]` (C-массив) | `std::array<int, 5>` | `std::vector<int>` |
|---|---|---|---|
| Размер | фиксирован | фиксирован | **меняется** (`push_back`) |
| Знает свой размер | нет | `a.size()` | `v.size()` |
| Проверка границ | никогда | `a.at(i)` | `v.at(i)` |
| Копируется целиком | по-разному | как обычная переменная | как обычная переменная |
| Можно вернуть из функции | нет | да | да |

Разница с вектором ровно одна: у `std::array` размер **нельзя** изменить — ни `push_back`, ни `resize`. Это не недостаток, а гарантия: размер зашит в тип, и «а вдруг он поменялся» можно не думать.

> **Что брать по умолчанию.** Размер известен заранее и не меняется — `std::array`. Меняется по ходу (читаешь, пока вводят; добавляешь по условию) — `std::vector`. Сомневаешься — бери `vector`: он не ошибётся, просто размер будет храниться отдельно. C-массив `int a[5]` — только для чтения чужого кода.

```badgood
Обычный массив из C | std::array — тот же массив, но безопасный
int hp[3] = {30, 25, 40};
int n = sizeof(hp) / sizeof(hp[0]);  // размер —
                                      // фокусом
hp[3] = 0;       // за краем: тихо портит память
---
std::array<int, 3> hp = {30, 25, 40};
std::size_t n = hp.size();   // размер знает сам

hp.at(3) = 0;    // исключение out_of_range —
                 // ошибка видна сразу
```

### `std::vector` — массив, который умеет всё

```cpp
#include <vector>

std::vector<int> v;                    // пустой
std::vector<int> v2 = {3, 1, 2};       // сразу со значениями
std::vector<int> v3(10);               // 10 элементов, все нули
std::vector<int> v4(10, -1);           // 10 элементов, все -1
std::vector<std::string> names(3);     // 3 пустые строки
```

<details>
<summary>Разбор: пять способов создать вектор (и коварные скобки)</summary>

- **`std::vector<int> v;`** — пустой вектор целых. `<int>` — что внутри. Наполняют потом через `push_back`.
- **`std::vector<int> v2 = {3, 1, 2};`** — сразу с элементами. **Фигурные** скобки `{ }` перечисляют сами значения.
- **`std::vector<int> v3(10);`** — **круглые** скобки с одним числом: «десять элементов», все нули. Это НЕ элемент `10` — это их количество.
- **`std::vector<int> v4(10, -1);`** — «десять элементов, каждый `-1`»: сколько и чем заполнить.
- **`std::vector<std::string> names(3);`** — три пустые строки.

Главная путаница новичка: **`v(10)` — это десять нулей, а `v{10}` — один элемент, число 10.** Круглые скобки задают размер, фигурные — перечисляют значения.

</details>

```cpp
std::vector<int> v = {3, 1, 2};

v.push_back(10);            // добавить в конец         → {3, 1, 2, 10}
v.pop_back();               // удалить последний        → {3, 1, 2}

std::cout << v.size() << "\n";     // → 3    количество элементов
std::cout << v.empty() << "\n";    // → 0    пустой ли
std::cout << v[0] << "\n";         // → 3    по индексу, БЕЗ проверки границ
std::cout << v.at(0) << "\n";      // → 3    с проверкой: выбросит исключение
std::cout << v.front() << "\n";    // → 3    первый
std::cout << v.back() << "\n";     // → 2    последний

v.insert(v.begin() + 1, 42);       // вставить на позицию 1    → {3, 42, 1, 2}
v.erase(v.begin());                // удалить первый           → {42, 1, 2}
v.resize(5);                       // ровно 5 элементов        → {42, 1, 2, 0, 0}
v.clear();                         // очистить                 → {}
```

<details>
<summary>Разбор: что делают эти методы вектора</summary>

Их удобно разложить на группы:

- **Добавить / убрать с конца:** `push_back(x)` — дописать `x` в хвост; `pop_back()` — убрать последний.
- **Спросить о состоянии:** `size()` — сколько элементов; `empty()` — пустой ли (быстрее, чем `size() == 0`).
- **Достать элемент:** `v[i]` — по индексу без проверки; `v.at(i)` — с проверкой (бросит исключение при выходе за границу); `front()` / `back()` — первый / последний.
- **Вставить / удалить по позиции:** `insert(v.begin() + 1, 42)` — вставить перед позицией 1; `erase(v.begin())` — удалить по позиции. `v.begin()` — «указатель на начало», `+ 1` сдвигает его на элемент.
- **Поменять размер:** `resize(5)` — сделать ровно 5 элементов (лишние отрежет, недостающие добавит нулями); `clear()` — опустошить.

`push_back`, `size`, `[]` и range-for покрывают почти все учебные задачи — остальное по мере надобности.

</details>

### Как вектор устроен: одна картинка

```
   std::vector<int> v = {10, 20, 30};

   индекс:      0       1       2
             ┌───────┬───────┬───────┐
             │  10   │  20   │  30   │      v.size() == 3
             └───────┴───────┴───────┘
                 ↑                   ↑
            v.front()            v.back()   ← последний, это индекс size() - 1
                 ↑                        ↑
            v.begin()                  v.end()   ← «за последним», НЕ элемент
```

Три вещи, которые эта картинка объясняет сразу:

- **последний индекс — `size() - 1`, а не `size()`.** Отсюда `<` в условии цикла: `i < v.size()`;
- **`v.end()` — не элемент.** Это отметка «здесь список кончился», разыменовывать её нельзя. Зато с ней удобно сравнивать: `if (it == v.end())` значит «не нашлось»;
- **`v[3]` у вектора из трёх элементов** попадает **за** границу — туда, где лежит чужая память. Ни ошибки, ни падения: программа продолжит с мусором. Ловится флагом `-D_GLIBCXX_ASSERTIONS`.

### Как вектор растёт: `size` и `capacity`

```diagram
# Как растёт вектор: `size` — сколько занято, `capacity` — сколько выделено
<img src="data:image/webp;base64,UklGRjhiAABXRUJQVlA4TCtiAAAv58N8AP8HOQAgQ1JVtc62n3fhX0S23T3FNCDZttu2AUDSvfc2y1KytOwr8+wio94bG6gPuAEAKVJmZvdc0My1BfpPvQSI3OH8xuY/HPZf33UlqRUIQOGmMpNi3BnJiuvK1KgASezLEE4dCsAHVhwiz1JsfFspPlP6E1BtmQJR9//nWI3SH4mIqNLbr1Tc6PeMO3noCtVaiNrEzMq2aSZeeglwhdoPkqC5cWam5846VwMpE/F6T7hTuSZ+j1ekKBfgalgXnM1UWYjQIrQ6Q4p1wFmFrdADLhHXiVShnWFdcTYuSrIZ0QQtkgcjpgQ9zgqMpWAGGqHC22CKTIKzf2CYqILojPRNUGfGuTZFLThsm/5IwYpsmAgbzHgyM0dhmcWZC1uZ7bp3ClDgvApjq4dU20Zfc3bq3E4dAI+W14hQolYo41EbI7PJfK+FlisDEtSrc4GhMA9DnKN5ojLLrteE+BwkyhGjIrMFrhTb9tEQopZpB/wn6qRWbEuRVqJa5szXh/oGeeA/aT3KTFyYwL3Slx8sWDous96lnDu/XTT7qfxHOa0EJpBjjz7bj4/PUQfz7I5ufwUmb19f/O4CdBEF1PPsGYe6KktA+E8vwqgjxQVNPJjCZIoZw2DUQdivlVnr/D0AigwIeKbv+/D31KydytS4G/w42TyAm2PZk9lA0BWSF8lSDy+/LirB1JEq3vPk7o+9f3UuceLPGEQnKWpXZEFK9EOqteZnpPWCOkLJKhLR8iKBVmlD9yeJSt9eBoQ8GZnBz5NfLjlcex3sfl7aCXsKSs1HdYQurh8hid/vP+1yzyiO2zaSJEn5Z909Zy12vhExAWz9iylGlzWnSmtKFUsj2lsOCNhFva9T64gmrUWgYywIxkAVDaJs5d427byHKu4PUDdrSp173PWEK4NghmdAZ/kylo5K7QV6YrbTvqE3ecKnfrNflRe17XLkNrI2LQEyQkatxVJdmOwzn6ux54YUoVCqIIvICDqsNGhVghVQlqmaPNLjokfaVbRZq+SIDC+JtiSvvhTtGtyjdU6NagAE/i1nKntyBG2XPJ359Dz7XPeEjQ1E5AbTjDjD90f0fwL82Nr2bG8mSdMgPyC0jgDgcSphaVO6YWkd8YohhSTmEq6OCdzieZ7v++lFrG8fEf2fAF3Y/stW20gnrkCKpLClpCWvtfbBA1gYbEmWfHSokpukQ7qlwmnSEe4qcA6yM8/xkxqsDO7MciYhMjy6sgRCUsnpyYrjugJx9j5h/XflST1yrL7MFcJljMFCdlVUkac4uVj/vc9B+Iqefr+I/k+A+P/9/+7/d/+/+//d/+/+f/f/u///f8K3tO7u68d7B9i/p/ftLf/bWmvf+yqxl+wkvmfv7ubNs5a+oVjgmQCkQgCsBO6GWV9F4BMwlEySBJLR6Q2ynnsEngipB6CKZNDZFNuTSOKlgcxG4m+ENb1PEngtBSSuAKAgFQQAp4Rd9/i9+OXnmG88f2pzp2lQYq8ilXsv39J9fYnk5m5enpsRoGBmcALuHrMXnz3EETO/NrlxakOn6X0Se5KJoLLUXcq5Yye5+Za5mFAwM1Li/rF6/vAIrymZp6c2cwYkEU8mUn2xtIOmTpJd/yAlZQE8coxeOMRrR8qDQxxNN3IC8QBA7Nu8s2Qa+pf+m/9ZUe4fm1OTg0PmI4aab2zgnC5EX9pZ2oUGWPDsGfzTVKpS77jcODrUP8CpzZt9ol/eWdplAFgeUHRE50waeFRa1saLh7WPnt+42eiV9PLOEg1gifwtHbrOpp5kLANr47mDejc2bvolTO/dgZJpQFOQdOBZ8SRj37sWXjysf/Tspk1zRcGtd+4wjWAgSDp0zYgnE1besgaePdj86RF1asfOkgZAOxQJkg6dPoxl79X34mGDRzc2bfZoL+4ombwnECAdlsUTQPy2wpubcFU9d9DEC5s27xMPIO4umdAqTQolIAmQzs6Les/AEICBPb1vb7o6vnLY4NFUbNoOeZJSMYolCXB2kFQ6vZIzHt7bejU8d1CP+YXNmqbW3hllzgCwIQCUGtoASDrahTTDk0wgQNzfsrQXDxs8ek5szjZtfPfAUNWTFOKZAAEJqBxk6EjbnmTkjvvLunFU7wCnNmWa/nTvVOIl54JxJACFlXmHyDnxeh5geO9STk0OG3hebMTau/vv9UKSOaacqmROdknSMbIrAVIBUiAjo9BexpcO6h3dEJuw3mAsQAIvuZP2qEjSBSZfTag7sq0qQOXKi7++ZemZKUkV5AiXMa13NBWbr1Y/TKlBDyxERQB0zNFkmUFHTKVzt1xfIsuA6VxMFCQYNPf8Ye2jyamNF/uR3YJqx1NXZgTAC1FAx1UicWWpRMA60gLlrgUFGXmNPXdwyKx1hK+IDVfrkTEh1UghMwsvdl5vSu2J1NLqTVFAR2rf0KSjXchvsewDIGrqxUMAWkd4QWy2NvUOCzwyU8i9S53Xl0gDYMtMCszcYF2kuvr2GwoVB6wZOGLFK+ht0I2DQ2bmqiO8IDZb/3RIMj2Ryr1L3btKBpYEQHB5Kk6T5aJT2Ev1bd9U6OiKelS0z2vDDfrW0eHBkQbjebHR2tzvJaEG3Hf51hJpoKgom65LV+ZWsprMj9jUXFQEzypxa0NOTY9e44Oy4uiG2Gjdfa94IvPey5t37ijtQj4SKJdg6TK/Pf8bnfG8gr6GYHp0qECZnxWbrC3v9UwCIpV7f70DpV0g8yEkQJIIO9t4wLEIRDfEyt2Nee7oEK8pGEeTU5ssuyuSeFVQ6d6xs7QLZD0k1KCxbE0Jho5RESSnlMHGPP/aIXBQxhFeFMs89ZUXnn/x1AbHHi8JVZn59Y6dpV0hCVMHA64ui2CmIyMWAbeQrgK+dXAIMANHr70glviVG/uTQ2Dy3AsbGs37JPGq4HLpztIukAFMXSS4qjIW7TpG2tyqvGF6iIMjZsYLovmv3Jgclg+YcWMjo/VeSTwpRFrp3rmjlNNk51lllc08jIoAbp6RMOlrDPCl/ckhJjdOicZfvDE5OCwzM5if28DYOCOJJ4XAldLOXciBHMDVQOMZpCOLiFZE9RxoaQxw6iunRPNfee7wiIEDZgYA5qMbGxe7Y0l8KHH3ztIuMKfJaRvFVikpNSAH6cjobJr4EKz0NGipX54cHB1qHzDj1IZFr2fCUO7ZvHOX2QVkwORv0JkD1QQ56MiOKVGYEH1X2QvPHh5Am8tHX9qs6BOvAks7sEtVYPLaq5AyEdESWXQEVqoSMKH0X01fuTE5OKzLzDj61kZFn3gCIJJbdpZ2UQcJk2l5FaBRSUoIBAFkhOWuBQnIRAabVuXUlycHh/UZwNF0k6JPVI9qZ2kXmA0TUi0bC6JxJKgiShASJAEQJAGAKHfE4kmgJoP2arwwPWy0xJsUveKVtNJlUMq5y8CibLYsXyFxiwlXg6KlppOGkuW26VTCmuzaq3Dj8KC5ow2K3V7UdPp6g11ABky4PJ2IOtW5KjVpqSXVIGfdXBogkcHmVXvh2YPDhpkZR8+u793j9nzmrZ67Km+PJfSYMnABgBIJA7BrXhCzJjXMptWu1SBRUMyUTeYB6MhFBYkMNq/SjcMj4IAb4DKObqzruUGUkzIJt1aipSJhTaZ2lZzJgNEvSAxweooztVQ6jW20KjRXhQpIUiHALDhG9mLgmchQ86o8e8CHzI2B8ZX1PDtISDt6YHlNQxJ6TJVo9F0werlTZjGz3G0At+XZi8Y2XtVE+xAJklBJZtAxsh2JeJKJ3NO8CjeODg+Y0SgzA/wlsZbfH1PdfGtp/ZIEqGzeaeq0ILpmZK67VDaWBMDVnixN7OaiAjpGtr0qnmQig407NTkoN8LMAD8r1vE7O9Skv6Re0ePunaZOG6JriykbAHZN2gNAgCCZAToSW2LxJBO5u2FfPjhkZjTNePbUOt7WHjVZoL+Ut8UZW3buCiwJgGAmQAIgUM/Z1ZjHDJCok45EuxcCTORdjXruSMGNMCZfFmv4Xki6+SVUAElnGYPilaUdu4wGVXPW0epAHavoOEnkJACCjsSKZLY26FsHh8xokhn7Xz4l1u/tIKWs6j2fvP4MX7vyThV2ltAnHgDSfTtK1KCygWsgJI2OVs8CARKOjOzzGcNNDTpqhnny7AtiHb83pjQj9buuzXh/Cv7i9Xep0GusNRa1sqsEA1giuxFci0O+M2p9KhwZ2YXUC1CT/sbcOHqtHjOmN14U6/gP7BBSUucfm/GkPMX+5BdVsd3UPeKDpLtkAMvVqfPsqkR+/n8vzC8s3mLKjSFdOC0eALG7IS8evoZD/QPs33hBrOXbQUIFKt9zfTbR5GsqOWxoj3iEL5YMbAhmhauxyn7mH7734fSLxrrGtVXFA0D81kbgxpHWAfZvvCDW9HtjQkrKIv70jCe6U35ZAXiNbPSiXiiZDJI52DjHvErf/dvXISYw32UcGkBHRrZdQo/BhuBbh5UHmDz7/Cmxpu+8lZBS5Tee2Z9O9CbPXFJFjQyKmnSVDGzugCSB+lwGr5Bf/N+WrkwL4kTOdpl8IAmSjozsongANeltCG5MVPs3XhRr+1sxab7r2mx/Unv2SRX8BnaLvlQysI12JPOpVxe+A8NL04IYT2dYEiAAEgrJ6VTCkeaG4MUvPYvnbrxwSqztuyFp5h+b8aRJfo8qceoNKulUyTTEWaAMGICO9Z1ZZZWjpVv0TGSpZAAbAgAJgKTS7hXsbcy6vx0kpPme67NJo6M8OKvg7rr+VPRbdxjYeh0tgM6OS2RHlwGsq4e8ikJH0paXfcIZZ2BDuwVHRnYxVeLW//3Ai0jz0idm+9NmgLEvKj5prWdQSed27DKABTKcdbToujg3kwgAX51e6HAGXFOks0R5ToA24yyz2UAXRjMKBv53AzsoSPPyM7PJMj8igCeG6ugR/daSktORtm2xKnot9iTPLhu4PJaOvMpIAN0zs1eMrWvuyMitaLV3bBb0xqT5rmsznixxlN9UEunL95+0Kzt3mSxn6UjrlquCRFLMDiP2Car7vUx1ll0O0jqSq2TyQXfdsKFzGNl58QAwsEng7pBm/vEZT5bMJzwpQNKap0dU371jl4ENnY6ueUEMfGBvz9Hdeyo+TrC/So9Lxlln6UjrrLPkatUdECBJ5I8VbbuEHt7GgB0kVF289/pssoIf8xL+5zwDSvrMjl1GcRnYUpUYGNxdQO+wADGTKmNQcNE4kpbOOtqrLy/qWTuS9oL4INwU8CLSfPrTM54sf5Rf0fDOrJZYPAF07zQZtAHavcQY3l3AxmEBEi8gwdjHQIdxoSWdpbOrCA1BY1q7IHLtoj+wGfB4StX5N56ZTScryQe8Erdk9IoniX13lgxgsx3afVqT/qYC+rwkIDnQu7FnT0ViJJK02YC0dFyVuQEagzrDQNKRtAvig+EmgLdLmu/+/Iwnq/pwrKR3Zwxpt+40sDkduqppTfoKwN2SwIPYXQibBiRhLPPGOtLS0a4+wIaDrJVih+2iJs7aX2dYUFrxzk/NeLK6PKAAPUqrD6VSonHUnHXEhbQmvQVgIE3gCektZO7z1YR+2QTOho6rAJAkoDhqjlqo0uAI59MA/XW/rZhSkLJ43zOz6WSVf/kRbVjZI8qLO411qnUkcVFm075CU6Ff4lriIfcUslvj/VUm7DIutHSkXXUwrwvzRKq26MjIrYgarvd1QkJK6qc/PdufTlZ67KtKTf59MBQg7i4ZR9Lq6KoKBgpAn8QJAMq7cmDQVxPKUtnA0pH2KnW5bU5IA9QeOa0knXW+B2LKSH3r5Wdmk9V/IICPWwtg4oMLJWNzlZ/zrDQX0BpXE1U25tkrcQI/4wI6Szo2gB1HEiijBBggQBZDZd46sM+lAbYaevGFF79yau2tE1NGADLCe67NJsfxex8SwBP7CujzCQV4seTUwACY9txd+CPc47N66oLvMFZ1tI03OAJo67i0vERe7OgygCN0m/8Yb0qUsIlTN6aHACb41nNffv6Fr6yvhVQZf3LGk2PJr3pheFdhHxMB4i6Tr9ThOVAA3u2rMRNgFmlvngFFrhinsDEGgM6yc3Eq8RQ1nlpqM7AEiXCnslfkvHgAiVvv1PSo+uCIDyfT5248/+KpNbQeVX7jmf3JMR0d+6xPgkorBEA6VNIsSQClRc+NBTRXfMwENYDpQI7mik+CinEkbYO1ic4LPhUkMSnALFIkc51lYwE2YFN7XoFfb3pwCOajg9eAo0Pg4OiAX5tMn/3yqXWzQW32Kz8YO3RseS72oQzHylLJkbShAeDOykChGX0SJ0BNMJsIW7Pe7asJPCTuso52NQ0IAv+wIKRgZk52fy5PIQT8FVO2JpskUB+jItu9MBhhrecPDsHMDD46ODpgZgBgZp48v152XazMfuX7o4fW8NgXtMxby87qBkC508vuAporUgMwK5/5ekwZbNY2xgkUtJtVIkCc/V+oSAlARuBd//Rd759NJfaYuaWk2BBg/QE4LQUzEqfOs0eH6gMGAAUDwBGeXyv7D6L+/fcPreVRjH3SUzLTGQOrAwDLS2mlqYAeqQlQm5WHjnzUx354d1MBLX2xj5kAHnLJOEvHhoEguv6I/lYBJAxJAGT8zkJL34j4GH65ZABbJ+p7VgogpV6d6WHdEsBgPsKL62Tvl5oAsw+PrSmM8mAsOeZKBkAQOiz84u7CH6E/rQlmiU/8+MhnfVz1nN43WPVJDBIAZCXLsSEE0XWWUhr/rOvAG5WAdLil0Lx3v8QeV0o2rwnyOpJFRCtSMDLarnFqelCnkplfO3p2jax5WIBa+qmxQ2udB/IsKciyc//QWwCGpSZI5RNP/vjIwVkfVxNPMiYAkIBcNC67MQSm0oTebgtlv1TEGPmTAq4dlsTLYjmPapBFBTdUqUBKYQ18q6kjPjhivLA+1jIiwC/Sz6094MMZHrfkcqSd+kVLAc0jtVn50Gcf+hGAHz75GYkTkgTAMI9loxwW01mE94jKLVkwM/aVlgKaLksiWC67OvIr0TwVYOw5NW4cHIKbwBEzDr60ZlZLPzs2uub4Fc2TXYrNwtRfFJrRGpP+M0d+eDjE//rcrE+AOBuQSxnONhREuwC5KzQjSgswlqGmAjAgs/CdxuVAY56lggG4NV48bP7gtaPn1seaK4F86vDaw9jnAk9UTQmwJF1oWZ66u9CMHh+TySce+lHAH45+0scJ80I6jKN1pG0QMJ3OYiR0fUoKkjEGCk0FXBbirAEQAGjQSonRr4EbB81hnQyDEs5++/DaG/3ehwSeRKVkYB1JS0dLlObeVWjG7oCCzx4mf/SNJz4aJ8hXSzqNUxvkcElqsfysllcCUJO7Cm8uNFckxnIpgFpfVARuKqg0qIMbhwcNAUc31sj2SuKlJgfG1twoDn9ZfIjOssu2Bihd6Sk0o1cCEg/94PABT8b1yoyzeVwdjrSckiSWh7W6lFJYkw80FZoKfyaJVK3JnctpN/wtKgC8rRZevDE54GZee36NrCeBp2D24bHRNQd+Rpu2zLCkARZbtdnAP/TDb/gkzvSCjDnjVsE6tItnDF+LKVNgFr2FpgIGJMZyKY+t07EI4I8Vu/WAU1/ePzxoYnJqjQyD4omafObwobU+Cj4cS5gumsBmYqW10BSo/oEjDzBOSABSfRozifaccTawzjYQLF+RxMcy0gplBTFcANBCLxWT05KoL/q/FGO7AQAvPHd4UItviHXyu0R/aGztgV/wAdBpnM12jI4Wmgq7s0bOD/uYgTz90iu4+dkkwBZjSTraRgLoqnoyYeJqdKnSJ3FtYwHAXonRUTawBMB6nPZ/KuA2A7x4Y3J4oMWTU+tg99iswvu12YfHRo/X4VGM/fLDSjplLADka4kzkxEmAeXpVwC8+tqzvko/7SwdaRtigHKnDxOK7AonrkiAWPqDFgquGFiCBADm1/6BymsKOPX8cxONA7wg1r/dIBrjx7by1pGgJp85PIpjFY4dFKQCoKMcwJKO5J2FNxdwb6IRVGfxUoDXbq6S/jljSWcbC6C0JLEnkNHYU3THlBJuwScxST8YYEBQcQp0oq5/ouo2B+DFL+8fHignL4h1b2crTKkcKHineBA1+fLY5Pjz70WdMjksWS4AGPBVjRQfY/bnMy8Hr/K1p+Mq24wFGwwA5XmJPQBkhDDwg92CE6bLn/JxWCVbg92CWptCggDBvMp/Scr+UgC8cONZ4LnnT4k177devk8AeMxyqEnBgCSekJFzs+mxw/c/pKC9bGCJTRuuA7GpqQDs9rGe+Au/f/23sZx9RX31taf3y4IBGgV1RjKTmgDwcTUmv38kTgJW/V1Bc0XSS2VrQIIA61T+i5QKAI8uaz28eW8sOf+yWXvriCdZkwf2DTD2xaCWXjGWuPbY+IR6tAA0Vbwmz2wj+cLPZzJe8rN+S9nAqi4AgHxtiebJBLHu/+KHPxr2CuUPAQYkXSoZtUH4zxIq+2twd1Uk5yzuLmS+SzwA8LOz4zd68OcCIJ2y0eZjk8zgNYU/wh5RfPW2bd3ktqflpVdfAcizKeaMJeisC62jrYPokKwkjAlPfP2HeCjrbqVX0kXNNjBfsPbmDgqSHIjf+aYMDIoHgF+cznDMRnHow1ITpHFkjk2OM2Ny/JoCWuJEmd6m/sZXX3rlVb78dAq52TrrIus0UzaqQtLhYqohA/zEAwd/dJg4IFAGlNY4vRLYhq6rezwRT2TPfuqh849kXTcb1OjK/uTYjX1S6z42SVLjJFEA+qQas5qwe9vt7N52OYlx9mlUZTZ9zka2cwbtJiyXul405QxHMlctqSHwDx358Y8Ohw99SPK0zKSLARoS5Rqstz0QkabHh/7+q988+NTR5gxcFg8A+a/Pjt2hTyj3XTepjoeTJCcKwD5fJekvb7sd/N3ZpEp4xkznrKO5kP48Xux0pmvLlapMdZWNpSNpyUA8iUSAWhLgow/96PDo2GHgB/yMz9FUSZ8rr/vbykn3QwcO8lvfOPirI49ck9E8IuqvTo/duft9Ikg/cEzj+ATISZJHC2ge9tWYCX7bfdsLTydVNZYLzjraKZmFr56dphcgjS9aA5LonF80LHdI4glBTCABSS8PfPdw+JUnRvJgKF02qkVdTvkvcsX2OtvjpPuhAwcPnfsWDz55/qmjzW/ScJeGj+1PcazGvuATEvLAxDgVnpjEOCdJ4prCHw9LzBpk/3Q1oRr7Zwy6Lbpm/P37E08BZj/+V5LivrmlS1yeS1LZUkanJxOZeellvDQjMclZ4oHD5Lc/4SkJYunXhtNLxgZ5s4oAov8yUwTra/aIdD938JfnSD787SfP/+rII80ZuFsp3nl9f3Kcxx6+X+s7Oj7BSfL8aZ6cmBznJMnxawrNA4JZsiaxjupFo6745K/OPPhX/Dj54ON88IMpIKGPcalsuhIfy9mXX32Fr718VpJZkogP/uD7Iz4mE1L6tP1pZz6SGU7Bf0kACvhra28MKav65MFfggGDp44+ck3GWyviGcB7Z8eJX/mQD2Xm2olxEJg8dZonJgBMkuOTPFpAb0VSiXUkc23GkZZYlPjBMz8NH+fPQPzVx++Pawk/tr/mO43tmpGavPTqy68AfElqcZg89MMDvso4lF5tJHG2DmiOkfLPVP11tU5ECdSzX/wl/vGX/3gw+M7BJ488deRocwbeJSgYGX1idmx47nOip0tHJ8kJ4MQpnJwAwFOcADCJo4Wm3sFYAJAzVzotnWrn5f6fPQ6dxE9JHHiQB848KGg3DlOpzLz8ij6j+QM/Gkk0sFVp+tCUcQoZqAE1/hMqGIzemlpnTAnUn3h47BB+iUM4GODJ87966sgjb8rAX4jy0t+erdZoBvmlD0nm0PXXTnJ8Ajh56uTkBHD+pAZMjh9lE3e/89cvdnR3GeuyZ2Tk8TM/e1z/KckDPyUfB/9KKS8Kzr6acTZWk48+wEw/XFDfMrtkHABYrAIAeOtpnTFlpL58aAyZB8+R3zn45JFfPXX0mqweDZdXaxQ4xFGAD39GkGa8WN40zgkAkycmAfDUyVPUMN4dmdIOkGUD62zGzfelH3v8wM/Ux39KHiARBp1lU+r0cvYV9dWXZzQmPkv6tda406iWeaAUlf9LljJ3La0zpowAZIRPzQ7lPXiO38HB87966sgjb8rA3ar82my6QhglgcOHDsSSd95snsg7eeo0T0xkX+e6HUmbrcXpxx4/c4CPn+FjPznNRx8789OfHVDSuKtsSpgW/9JrAV9KYghnwTgnerS7pkwOkgrVSPs/qbTnrKPZEWWkzK/OJvkPBk8e+dVTR6/J+uNxKaNfnU5We/Qwv/ZRT+Ygby1tyJokT57GJMlxZYMzsHU6suu+9OOPP/j4mZ/gdPZjPz3wM2B/OmPKBqXnJD77ymvh07Vk/29ef+EZmc3CcJPWt1yqi5rT8EeKyFpHCykl5aVrs0nt734HT54/8qsjj2ShV5RT/thslUbBc5/1qjJNUubKm7RxcDLnuNbt6jGAq8jHHnz8J+GjGad45mePH4jlggm7EuDsS6/x5vmkVv3dttvB30g8S62voC91mSxkQSmG0Q2J4m1iDX1AKSkvXZ9NGvwuv/PkeT519JosDCktmDm5vj9dmVGOffl+zyQg5eyKmxZPbilvOD6BcZJgDgI4vsmxHhNOyf1nHuVPwNM5T+Gxx/82lsWSgSWWpZrsPwtKjN9su+32227vnpZYxUiz9pZbTY4QKkmX0U7KwRqaT5WXrs8mTX7v3He+/eR5PvVIDntMBSOj9+5PVnbsm5/xTKgKlxy5Ak9Mmc3jk+MKwEmOc3KcBMBup1uXqzQn958/dfpRns4NPPZXXjpKRp33VcYJCby+9XYA3U9n9Rb0O50lFQCEwtBF2vOq/vpZjyrf+bnZpNGD5/htHCTfeXd/X6uCHqk/OVuNUR46IKglniQEF24tuzYUp1IBlk33+KRC4DgmMo9f6/LmWpLkD6dO13/+fpnp1thVJRmTlBeCbd3TsSqDb9bebBzzZOdyC4rUXTvrJBX552eThs/x4YPfwGcFwOw7FeyoLv3mbLq80UP8ysck9Ewo07eUjWPUxhcEQNxlN41Pjk8cn8h//JhRbGBJZ0kGHYLLJ0+fyvMoT5MHJF0oG73UWY21C9tI3vHPSZWMq77SUtBLkSMtG+EycFYxttfOQqr85GzSHL/18AOeSW1WBrUOlzJ632yy7FHw3Ge96ESyZEqwpIva3EIqwILh5g0TOcfD40eNI2lzOlqSANyMfODkKQB1fDyVDmM1lLZUk5icjeWZ7m3d/1xVfbyxoN/pQmvqZRApbBflSKybb1Gm+vhs0vjBc+TnRB9pUeCXAFybLWmUhx66X7LTqc6SCS3oyGkBcKlszaajyjg5GW4wls7W6WhJAHOp/8OJk3n46E9OH5B0ytgwIDpnJA799IVpJjFJqbQW9DstaRqpFUP3vOavm3USUr9/Nlni9/CEZFaaNYSqd80m06XwW58S1LS0tmRgFQB0bE8EqHYZANcemxifVI9t6HakdWQ9qtkiuP/8iVzk+f2CS8YFOrrmvMQkE8+YpGCwpaAf3fAn12FzfTZ0kcZpJXXXzUaUKi49M1nm2BdET2SgkOkmCnxsfxlj33tiVnLOdZWtCwgScJFbEQDzgcX1mzdeC2zabBxJW38GMZfKX53MA5z8vGDBOA0kQZRvGYrFM4khAIZ7C/o1R8cnwmPX7rJ5qGewXdRIrJl7VHl1tgx+WXSPwZYsPE4FMzi/Pmtq9BC/8jEvmenMJQNHm9exGC0LkF4xLowcaUNHuwq2ayaVz5889SgDnMSpBxKZdsbqINQybl3aV6nGxFD/7qaCes3RSWrHMbFhV4bNdBGLoVsMUgrWzKyIMsU3ZpNlfivOwN2FvHZEBTP4vftTNDAKjJ37rKeERCpXuo11tHVE5POSSrpoAtKSBMCGOkuF2JKk8vHHTpM8hZOnHvurRGa6TBiQVEiU7mQL0FTQrzk6MZlznAA2WQUZUREgSJ4VD4C9NTOfMir/4mS5n5CatreQ3yP1p/cbGAXHvjzimSjAhVtLxtn6HSO3kqS/wGXjSEtCV1wuZ+msoyXpsCVOsf/zf/ivp0+d/8Pn40SmuwwAq4K6C1HaeefRpmt4lJwYn6wTADblcxGLAOFWRI3EenknIfVnZ8vgE74mal+h3qHq0m/O6oHf/IRnQpKC9L4XDWxDHUnbXklnZdHUGZDOOku6gDYbRNdcCsj9H/hY7AWYc4a2bkcbOlpumAAwjpA5xgPssnWwCNLNa/6a2ZAyxftmkyXyoBd9b6HuTqzAy/X4vScSSbwquOLK1mU4S8c8ls5Gc+nPZSGPzXSqbaCz7JiSFBLykoGzjQc3TeQfZ67jG6wBSTpLRrprFzXprJe5OSkv/e3JUj8i+vsLDdxS4eqsxvf/y4cl0+PezpKxhOIsXag5SwIkl2PBBVNS7NXoLLBl6ZkL4FKngSVWgRjPMUkA+cDNNnSWdFrRzaXKSKyXDylTfGq2DB4QvdLcCDxBKRXgd020Z9c/LXnTpX9jdEtH63QlBACyfUrS6baSAexV6izCUtlYEgAa5q6dVI9PgCdPnZjAOE6cmpzQxyevdaR1pHVRkSDp2kX31svsmJS/OFnm2Ld+ntFTaKibUMHMuPLFacUMH88l/1w5y+XNQRJ0NlqupLKsOXL16Eha0tEiZENBkMc0kidP4SQnwFM4kXX8mLNOjYoh4ebFB6FYL+9TofjErLkp+D2kHoqG/RIYn/7i/gSYMl/7Vao7Y0IbOptx5iwzVzHT0UaXhmSqzTrrwuW9RgOAGD9O7cTpUzwxOcETp3AyAzjmMos6XxCPsLtmFhKAjJ5+ZrLE/aukju2mOKIC5W9cn30R+7/5jYIr0tkRATzRUTKwGcxgPnumprNk25WhdqebgcEEmEGen+SJUwCDcZI5ipltVS26d73My0vAp2bL4MsVPdG4R5XJe1/+xvvigpmYJDD8jrsEADFXNjZ0oaWzPHvmLDOfOauloq29LXLkGSMaAMSx4xPjhHZiUpucGAc4yfHjGVEGF8STALpivXxEyktfmCxxdpXUO2KJj1eoMwKKhFJ5VwHNFVE7rSNpVaef0XmzAgTprIsCNga4YXJifFI9cX5S4wSASXWDVtSjFU9SajIg1ssfSFRXZs1Nwe9S5Q8sAyPKqjICkCbCvc0FAHskESBdMAEtnSWVM2dLzHz2DAMqki6nCUgQ3DTOCSiZJyYBgCTHJ7k5CoqZbVXxABC3rJltU1bKr0+WOLtKSjkUS7VGVFSUc2DwHQX1rbEXAGyzAWlJR1qe1T6jNKzjjDlx7Hg9wPjk+CQJ4PgxF0ZZ8xLWpLewXm6PSfn+2VLeo0o6ywEGhIJVGSF+tJA9IASQzhlNtY58puqMEtSzzph003g92cEmpahHCxLWZF9hnXmP1J+ZLHH2OVJvi6U/HFF1MnREzh4fAB0myzLQPHO2pDvdvtFumGzwOI9vsHRkUY8ui35fy3qzIaWlX5w0P8XsZalI3OXB7g2jMRA94d8v9AfEk8RZg/rOMNciHe0brrPcMDkx3ghyg6UjizpfkMzdhXXm9piU35g1h+kzlygrvVWsqO2ARe3WWDxJzJWMlnmGz545Wz5jekfLa8ePT4D1bYwcyagIEHArXqlJX2G9uUfqa8vgT5LaW5WG9yqJLJasZhlUn2nHzRsmjk8AmBzPcd31kSMZFVX3gheSSGSgsO48UD39zGQZ71GF4lg3DYsHmciiyXAknznLfIb5LHM7EJs2HBufPK6SPH/tZhs5klFRdZcFngQx1LT+LFK9PJsu4W/nqt7xQmsi+rM2oiNp857lM3y2HUhs3sRrrwOwYVM3I6dGRZXPCjzCSkth3fkDmerqbNI8f4qUF+1jhl6pKemcdZHTFWe13+howBCgIyOnR8WQbU9L5n2thfXnW6S89MxkGe9XBeLY/7kkAdKpLpvRoOb4hkWTSdLpUREAyfaFxap4AMRQYR36jur9s2X87Usq7/jhvVILgGqHWS37hg2AABhqUVHlTS+0R6iKB0nsWYcWlTL62DL486Qc2wbwXomDRPyiM40BFCYHmK1ExWwSfCERDwJJ67qzTkJARvnnJst4WTUSRnyv+ERIEtVLBi5Sc0QVZ02W0+nF7IgAuCL64LqzHimfnkyxhHertsyAPZ5JQOH8JRcVVWZXmBv1RUWdIQC45zX0rjfboqz0vtmkef7blxT5A4bAXVVRSGDqYsQAWWfezIYHslxYBBC57AgAOJ8qleZ1Ztuk/NgSpvx5Usa2KdA6JZ5QU1SWb4pcVEQA4MzxPcsrQhoELq8lqTEqArghFg/UZM86s0j16aVcUYXCnM39XqgAKeK5lTZnHbPezADMBWbnyB/wefEEUGleV+Ykivz6ZBmXKSsFBgF6hiR/Mr+40ha5iO4MM7+5vFJnS8ezESwC4LR4gOhbV+aR8unJMias6hsF+HcjWT4BBUhmpuYWLr35DMq8WisLoCGWdUTBJfEEcG/TerIt1buX8rffqUgeMAxa9o4IkHihDgD/sO8vvLnaQA11JOthEQDnJcDu9WSB6uXZEvav3aJybJsGaHlPReATkKInsqRxZoXPHqfMfFHwgta/nmyo+tgy+BOkjN5gHqC5d18s8EkGsKw4AwCr4YLlnuWqOevqYRGI2mIJK83ryELVp5fycdWOMHTre+6JJWfHX6riFXWls8zN1QS6XA6nuLCeqAhwTjwAblxHFqmuLuWKKjAVgNa+wTij883qMyt/djWIS23GOiqhs6Szms1iEeDzCt69fswel2R+fbKM96t8gwFo6dduefMZsMGxeMk4m+1s6KjlLQJRu5dwYP1YJ1Fc+tvLwLsLRc9seHfg0XEszjLzMly+uQXjWJ+tKyoCmFEG1489kBGQ0dPPLONvX1IkDxiuNwA63owzx/IsrwSAuRnrSCrO0pG0JJ3Nx2BKGW5aG/NI8auTpeSKuGO4bvHBJQOsCV5GTgC4Ip3G6TanoyXzRUVwTqm8ZW2sp3rvbHkytg23W9QX1wyfZV6F8nPpomYdM1zgLOtxi6nSsjb2iOp9S7muwC+ZbmPg8Vx5bZzlMw26+giUl9NpA4B0tPnoGjWyfmyrBFxeyudUkelavRBMr6yNs3xmVXFJsEVhDmr5oyKoVdadfWM5t0ghDN9SDTBn1sSqAkSHpAtabkda5isC0cL6MLfbQ5+ZtxCuRF6U4uDxrX6v3HWN1DSkVN7AAJDdcZp0GVdP6HJHwbwy3LTW5T6RUO2lcIV2vtMxEAaUpOsNDcSFFFcaQzqbr60q4WBhndtLKEszddXLS7muk4GQAYS4Y6C94gFgi7FvWASAZYHvNmgISS1iEWwXtX89lxVRgvrL+VxO9Rk7BtotADyWy+6NiqQBuqqCORPW57KjIuCeFx/ctZ7Lo0Y/tQz87SaAxDVPS6zMvaHREAtpIpdKdjUidUaJW9Zz9Slr4BefmSxzdoUk6qFvHtwjHkTVGb6B0eGSAHG3satQRAS3IupgYT33VpVERfae65MlX6ZyocVG2iseANrfOBxZn6N1Z9NZmTbWaY5ZpFIMo+lU6V3X5VHllWtXP3+t/LnZZNl8/Rrw69eAT/GVTJV6BrorIK4YB64ll4PONoTLAmDB0Cn5g6gI3OgWUwlHmtd18ZhSxaXPzSasxPK58gu/cYnUY9tALbGEVWdo17YjtdCxLsd5SbwsGLgcLmcRwI3RioQ12VNY392nyvzzs8mK87WcKvvCxIMKLq6Rs1w6q7CZzpJ09bVVPSkLpmwAWNLlLYZReyIeAEbess4LW6qM8quzCQ6xOl/4fE6VbxFG7lXSaWPXtKNVHS1J14jIrvhwurNkwjwRiwDdSiI+RG9h3TcrkNGtz8wmK/yFz+SUqQJh5vvGJaDDuLXiaDMdrUbmcWpEtyg+XDYlwGZFRZKO/A8KZUpDsQa+pQBw6+pscgisBn8mp4yUA2HqQJFOGYs1orqAjpaOlo420+kRi3QLAk9iesUZBFExJB3b/4hKyCiy1sGwVYFbn5lNDoFV4M/cooyUgTC2k5SADuPWEh1pyQxmucyiupCKOnOlPcrbtjIlKJgBYOyI9XBfJSm/OptgFfgzGSkL+MLgA0qDKWPXuqN1tM7SUXHWZUbBjcCipEEKmZl/bqV9S/ullcWpWFJRZhTfL9bFfQWA/POzyQryZzLKCCgYvjC5m5C6XHZmzThatQ7WA4Ar1VT0VOBJAKlkZjJyxPr446qM8quzZU0n/JmnClL7wuwjVbXLXAU4xWWRmlVdZlTM2fZsrMHryMwII1uskz+uAJBfnS0JfJUKqH1heDdRMG+Ahpm9VDNH1kFqLrSks3SZUS7YhQwAnkS2HPfFmrmvyoqnrs6WMuWrGVX6wviB+CBdKhk0AECg6EMvc5vpSOv0wGXRZUcs5uVNVfFZuePHbLF27iuQFfSZ2TL404RM5QvzW/eKfqnsGkAaKqpePtTHogsDMgczLOnyRnW4BfFkXbzHv0+so28RCjAyzq/OmpqCP0HVgWjDt8ea7yg76/IYIMisevnQRxi6Biq2johE9o2MlsUr9wyNJEo8PNDXWlhX36KCAU6Zrs4mOGwC/OmCKwLRjr0CDwDsKFvdAAjqrD585CdvaCs60jKIcjlaki53HVF7IgASGSygpbVnN8C3NhXWs/cLZUb4xOwQQD3+JFUHoi3fI4kAHlwpGyUzX9XL8BM3vfDs5ReAS+1tgCu2FYFIoaOlyxsFZAZvitMAbC2sl++XqPyJLxwCqDP7BFX7oj37JQbggUUD16Dq5UMfpzeuPIt5L0xiLhdv4g1AQNLmibJBgoS7qSphTfoK6+e3qID6E1+oN/sEVfuiTQckhjp/c9m6RvRSH/pIIuleSCRM5TkXFeHqj3RopGN7VTwBYLCwnt6n6k/MJtrTCX+Cqn3Rqk2DEitIlg1cGFDrpQ/VR6oXWjzrJXuuzdUbZRez6XjZ6zLSsq4Oj1fh6kyPP0FFRSBatnlQagrSmYvOWEfS6i/1oY/LXr51K2cld3XFGTJSIrJIol669ilREqKnsM7eryj46kyHP0nVgWjfIVWmqCy3WUOXGbGYSTq2PX9WcnsC0xeddcX6/5SK8c/+V5JUTgt0xdr9lirjp67OqvgTVB2INvYrwniuo8uUjaWLWAzpaBm1rSxUJa/XgZnF9shFrANgZvwX/+APSZIypaQr1vC3CAWAjPDJWWk64c/cqgpEO3djlScBVC88d7G9DSiGUVv7yvLifFWyPbFvLgdSmbqyckNEp59hPvun+D/7F//XH6YSVL3rirX8XkbljPDJ2QQAXy2oMhBtfd8goUKdUJBCakk8o1YTLwBIhUT1PYWmy0kgagokM1MLyxcv/dfM/E/xD/7XVxKSIN2BJdb0e1wqf3w2wRc+QchUj4sWd0cJeRI501AAMAEYCmqCZKC1AGDjPi8ZqMlqMnDBE+v7vaRImQnAlcMvXCFlwfBFu3tviwW1HKrPHdMjHugpZPYOCWoIQp+dAsw6GPtirb+XFCr5PzJIElAwfNH6PQP3CVBDHnioSQxPVvo3FvI29w4LEDMJGpkxATxwxJp/j1WApEpf3Am2cDCW0DNRY7IGCSsDvS2Fept79814IZkgX5YCTECy6zti/b+XUF1f3Cm29vbfU4kTyc2Rwf5/21JobEtv/1DVSwOT8dvPnbbERmAvJ0gdX9xRtrT29Pbt+fN+YO+evt6e1rcUVrXpbbvf079veCRmTriVJ+MoHPinHbE52MslVRbwxR1/U8vbWpWwLbFp6MVSUQC+2GzvPKFAsiXWBW1+Y9k+7tesls1ceoPNpyDwBrv6DXb5DfYqvmHV7gVgAbCr70Xp3jKrOe9eM1h1BXCPpc86FgATAN1gtDP0XbEO2OkHYRQvd4x4VYdD7nVW4k29YCcax+OLHIGZGeVYycqozLF6Pxoe7Qy33NVwesEofEdUvlg5BjNH1Vzp4nC0/ahnr4TT9UfhLoALoeaF3XK03N3yBewiUu+Ogp5z7NYGnX6YkGHj0UPLcrbChIwolfyk31mW3RvtkUkvBu6yrN4oJoOOR96KWKf7Pgc8KPu2hhOMgKFyEGzZOr2AB8PzI2DIfkfHXiGn6wfqc76r4/nnOOBtDLaZ/fs1nMe2gcE2+oH34u15mnnVsHV33569vA32HQ2rHzBvD8rb3NPpDwAM+fyQmX1bg/t+3+usjO32/ICZz23ZGh1/AAyVCH5Gw+oHAwz5PI8wPD/wNFyfuec5dwJ2EJORB3tWww7GBGRG2Iwft5fy6EUyaAYQkJx3l9HUOyzZPqPqzRDgUO/V0B0npLtrV7jjgpnKshy5FU5ISknlpFuxFUbhoO+shDN6hQAJgAAk/QprRGoJEJB4FZyQfr/CHUV4IvjpVTg9HCekLvgVr6ITkaYERlUj0pUYuxXdmAAkYeCtAg+ihCDLFHsV3aQgpSzTIxX22wuqlgD1Kh5JqDwe9e228yIycg3i725uWG9MRZqRWZkRec1xJMnEyVua6xmSN1qfUDDYumoPEDIlZUiRUFDxNko4BZBROZeRpRpRwpySOkdsK7ZIOR44y7N2C05BlSkljuoxSjMApC5wQWWNOUkBZIociaOwL1I5eVt3aT6VM6RIGFzsWqq3U6YBQPZUfQJQKIEsl6HKTohTgADs9pblhAUBGZAzwDK2FFZESQqQWiLvqHxKUmQAqJzLSOUmRZIiI0ga99vt32Vk8OHWBgWEtCAzft0AUsr8ppiMHToN9Upun3kRq5cAkomwb7UCmZP+RVvRGadU17MgAHtcMDNpZj1hCdjvoCQFUNC4v7RekRRM2j1VSAxd5sRVeElRJs2esISFLUqURfo2dzmnC8qomjlNTiuccUE1AtV5STVjRwCW6FJaMBOQkaQdZzkhpSioUlLmKjglbUnoq0ZUQD/uKPqUQJkR8A63ve4ZkaaElqyrkDUVslGNmsQ9DRlRWtCx/zr9/isb5aCZIelK5TIkQLIhqUlAocjoYqcRX3KmgOT/uv+9r3OqKWsGniTUPVdDioK5lGOs4jHlVQUjo8QVZTuiRCcHPGHh3s64SJmZkaAYLKtPCWp6qiElOgUjthVuruAq2S0Jn5IUADMXr/SX4lMCnQTcUVgRFayTVbHMVAUzI1MBbl4wkzKDjDvL8Kg6AyGTuaqT6wGypxpSrpXS2K64pQIyUOK11mVKVRL50x/+iO5l4CO4/JGalwF8BB+6/BH+APDByx8pX8YHcBn4gPavfPDnGoDZngaMKKWCwQzkT7/3ffz+9+m+n/l9/P7x936/3zvx9+sP6Ojv/HZOKFRy2ARTUZU9xX/AzL/3+8fxf+Lf4zL4D57KqDKjsdNAnzJTSPyBIeAv+dVX/HPYrfuX+2MBMtC3OluSMqqWAAv1lqwkpWSh3pJlgiRIAEOhHFAKFASkCQVL+mlCDkiSBEgAI6F2E0mQuueEeiSpUgJ4dSSUTkLMCmb0l5OXpJIgzwl1n6R+4qicPVkmtURfqAeSNHOEy3hUVpUl/p1QB7JcJUOhdnOpVgC+UNpjCUAB5IjsltqhlMoSv3Ll61+7acaXgP965m8+mIG4ta4hZVQu8Kufuv7M/ox5v3Km3G/yefZjeb/+yXdRpQzqMRVQP/XD1+e3q7/DjMoFbi93Ub69uK25mL/+e5kCQGTX6pM6RXz5d7dt205uO/pl/Hzhn2belnf7HWD365eronv0robtBInM43GkDruiuhdGumFXVHcj7b5QW0OqTHjsLMcekEQyjip9Ue2OIu2+qLw3iDG+GJVjRP69KngxScozJMw8dpbg5pTJV5HHyuhnRXU3jAFE6qEjKu/f+SVE1WFXVPtRnEggo3J83xI8SZB4FXFUDnuiuh/9UqR5zqqAuxM/FVWHXVHp7LzzUi4BAoosJ6+dfkwZKX/lytdeYnPePIW/e+xvf54qGGmuY4sqf/nqPvNEPQUmulO3zTu38+/LmGdXn1ZBbtXZosq9H9z+DjA34uI28PofVMhhndNJBS9337F9G7cCt4+fdqsc/u/w39e9HcBWgOF23vavcSqAJ9HTAPcxeAKWLQDHc22rUuhbynuYBUPfApiZwRC6bv8JCcXFhry+V7IE2O86FoB7BCyhbzEz1ELb0haadvfcWFJeeuX0EhAQ8vM9x1IKfUt9j2CGtqVkZobQtmz2HhtLZJQUY3sJ1pPyVcRDz7buEWDoW5UMoW8pBQCGts3OaT8ipAVnudtKj1DlR772Epv3zP5UwX/M10kq3v/M/nRSPZ0AU0AxY1Tu3brfcHdW7o/xGQD8zPulAomrx0mpYPxocXuuuVDOF/NFIwt1vQXmwAJz9W38IFMAPT1rlwomgQu33bFN3VpnA3WoYWYDfH1aPAlgpLmuXkJA4NjCrKdDSXlGvmjy3kFBGDkWhFEtf48S5iK0l8Gnu39ZmNPqxzJhGohluv4wsGHO3piQyZFo5Q9VXLn5NQOfOXjmwykC/JnWiNQvzya6U43pBJjCI5vFzd2N+407N/dpqWQyA8BXJEoY6Y1IgR9+9/YcC0CxADBfAJg3q7GYL+ZYVAFYAJgvlHN89/VMFdtaPhWKZ7Zzm7q1rsqwPI11AgB5QZR0bz2nU8oZ7ArjniMkgdXIgNIko0AY1xkR8tAVTTp+4AnAEqa1dzKM7GbcbkcAljCtHUp6h9NKPVLKj978moHPkI8+tl/UQR03Vb08m+hOAUzKU93H0EBOvHGfltty9rIq8XTcpFTg9767+A4wXwCYL+ZYKOcAFjqL8nyhnisXmGMxBxa6pfkCwPz2D1TwdZxxUZZntm/LzlOS6apOYZ0ACYK8IMpsi561SykB0jMPeNhHo70iZcpoxzyAHw0d0aQbS+C8YwkDu56NRv2cOLBZGNjrWaKVd1Qf+Jqpf8Izs0EinsaAlO+aTWpP6z92zg7hxky1/55SgfM6ASl/7zu3F/Xni/miPMdCSz1fAPPF0ue3L0vFRVvjMSoYjP3buBVQAGY019yiAMw6XAcAGG7v3i9h2qd3jpKCAekaCLDvacIZFylzIkcmAux7mrDHlDPLR4SZrUZ6hIxkIMzcTp1E8c7fNhb5d38rNQEwqrLHilvX9vWm9cu0ZqkTkBUzeLr/t99ZlOJOlRUpste/vSjPUTVfAPOai5rzxXyxgvPFUwr0quwxKV/ftlUl6g8TMxrBzCUGAM4PNeD232vDWs4rBTMlcijMfG8TAaUFg37BMRPsJs5RDrD0DdWoNaZyaKh23iLlR1/6qrHwd//1fgljp8KjrPT+2RQ60/r7ozJ2oL0m3DCdMQP44hUqmBn9KjdR/Oi7C7VGeb5Y4nyxmvPbP1Cdr/KKkvyn7VsBbCMABqGpClHYYGYo6iOkDu5PJXR1fEoLBoXC3N0BXC1nj8rJaWFqm13P0XPGhFLfXBYPWI+pYM6M1gt8p12GivzrN79m8FN/E9SoVxGors0mYFZN6+wzAFWqaERKi2pSaTrjyRT713PFoOpRKmffu11RngOlufKYAfOnFBftCp+Ur2/LIAGqlFnQSEuwGvVyA9v/RfN1IkLBSBxjOSOSyD2dPil9YWxnmPPeltYWZYSM3iaM7UYSCC2dsGBmQtdY9kgCcadN7okUH/6a0U+dCSCDilDxrv1JiUtTTKCxrwTahOaomlBBEPMMk9LsVwkFEFaNFE8ttOfAwpzz2z9SJG5FWJLjrfo2EiAJqiA0VXXCEhHgtqoAHiMNLyeAZSCM3SdkuQx1QlmKbXN1CRnJrk5YQuKYa0fm38ykr3F/UjCnMhTG3iJkOY3apLOn+Kjh/uv9yo7KjgnI6BtfnJagnGrvAwCXLZaaKs0oGgXwZFqevUzl2FZZ76ACwI8Wcx1gvpjDHD9Q4EGVNVb8H9u2UkVGFSVVSlEsVhTYfkEZW1WPUUZA7pjrHJUTt+r+hADIQJh7SBllFGp0EgJYDoWxrUhmBIytqj4VDMiuuXxJAGKnRdxEccVsX/3arygiVSdRfOpxv23u0XJgoUqhCjVsAlDxJxVJR+VcVPygNNcA5gtjLL6v6qucPcWPvyyajaZNVQyXsgON/5sKAIlTdb4kI2HuniyhX9WlovSQwbapnDhVXQKQUddcGMqcALhVgSJxzOURCk7RbREvU/wVs/HND5cQ2wo3p/LVjfvxmJyKlFpZMWMCYAr+rCJ7QNWJqfz9xRwozSvMOV+8nil8lZuU8G8/fyqGUVTNaO0saW7BDHD5T/8rBdyqUBEYzEkISCmo8ksycQzWVaRelV9CbBusL6ncqxpRAcjLwtx2TAVSGrRIj8q56fjDUusBUv7aFdOZgo2RUsa0VJpCB14Ti/kCwHwBzI0yzxWP1fgXnz+pjW29TqsoS8W/VsgqOypSguwZDBGBU9quOkcFMhkJg7sZASl1q4KSfFIY3CVlvyokADIwGCICMhqduG6zEiotUcVWhaY2Us2A/Wt19nSgMOu8uX/7+RMd1yulygTZ+zMNwTNZSAWnNKgKCIAMTeYkJfR0MoIMTebkhIJbZVcScIJ6Hlk+LjYJof1VWMwB00DHX4m580xoklJtofSvFNBJURC6ZktrSAJguoLTTGObUkrJbAkVNWTJP0l02+hnlvBAlZmzVFFoLcyMVpovx1mXY6IMoZ0/3URC5iNg2Dqkx8YrGjlnsqh1HmkjT6vZ+KCaVDpflUqViioAeHnlxXwxNwrmi3nSVG/aWK3WDWUwX0aQGn2ZUYKR6ZBnGgElRdICpEVAJn3TZa3Sa4ebjXnW7X67u92XDzFcj1JFlRmvwgLzhWENYsCkmkyV9AAUOj9P5pOlQZUdEgDPcECOrl5qOir3qvqETCaO0ah84uDGenbrPn+0OJFDOqwKo9yEE+st7mQyNtW+SiWjgagkDUcAtqvAQXSxL8yXPVh1jhJk0mx5HQR7FHvCaLKdbrXY47YRNDpw3J6hsp6gudtVxjVKWhyWa/JSz2iUUYJAA3AgzMeZV+VTAsgnW6CrAbfviJPI11vKs1YmbTjPyrDWMFnWAsZKm/ny+qg4haoCFdDADuUsyTVZIJOUqadl/EjmTHtOlZdRnsnAZNZY5kx8v47xB6/mBOm3z18x3M1lPNRQUSaXoop2qSwn08a+V1LOF3PjJI38i89vgUplYVbZ5D/9r2t1Ign4wuR2RMB50aanc0lpX2j6ucSPLZPBIwnyhbZlOCd6VWJHtE7eVj173O5Vk7adpcNUUcNkigmmfHVZxtV47NhNGTLb3eAmYPeHHsxu+6O+aFd3sO0JbffRvjC8O2QPrWr54ZZon1ume6kxNz0fd6KT7RguHdBaueItx816yGnM/Kf/Vb1WtMSJ2zIdYKOF8tZ69jDretNTmMXgO4t/exmDnUQb9mzqSD3LeJZ98mrBk9UjLTlgwaxScWw0YTDzZNpectWOSzXTUVQ96LWgVcPpeScex73nJzA3lxKkOvIqbcTADPAyFub+k+yYsKBx0S4Vpcss89l6/XFGoxOOP06edE1nnUB4WSl5W1OAUW5sMTcdHlu9KiqGg4Ypybr0r5uwjWfpnU4oI+kbzmq5LiGTsWM4+wTV8yGo0rXO0NQGA9xSr6v8lds9yaqyZABoxjEeLK1zlFImQ8PVt1tmSBll0v9JUhuX6mIDzNxQZ0/x/TuaJhigyrxytAlvdKFrOOfcqK+zTQVgOjvgjpblPzlyDXd6ELg6IwJgOKt/vndy8nxo6qLXCoCh9+CdVGhKU5U6g5vokgR8ozmRJDnUGFDBDLM5saSkqzOSwNgx2kMkkXdb5bIkBCeOmw1kKPV8LN8ejQAmU/BnVb32mKcGSEeHuYPcyC7lmWTHZIHMmeDVuWy0kcyZxnZVt0iyXA6MtksZy9hukT7lnJF38oEO8faWUPK1Gk58Z3TUxCRFG/yn/1WdTlIQIHsGsyLKKKOgakgAZGgyJyGA027VY5QSEJrMYQIguzoFG25EGSU4fwKCYpx0tbGyYKVioFlvrwUS8yyhcrQetwOnrdJJCEWS9nUyytoAPT02W0gFUto5abzURKZ4DtHoijkbbdLUOJlicufwL8zQRtfQicNJqOAEGucopaIVHm6VjDIanTS4Cego+hE4oMZDqk7FbY15O/xbE6gy1g8eoDVog4I51QkoLWC8AkC/TSSdqEbyygwO2fusyqtIFN/TmC/Mk9ZIzbFU9vnfNNQ1mmwfaoANlxNQ6DxBAH6yZNKEC9hZ2lKTyWrMDfQnqsfMdbhepyWA7aptKgCcQPATrGc8xOTSU/YPXVsSDDRPDFc6RVY5bSEHVQGlBRsPyGoQ2mWnHXDyuPmh5h6lukgcUNnQlAmmUH12Wfpzo7zFYDnndLuBnmyX4oSyc+L4cFMm6CLpcrlhqsCUr6m6KqfWHDpzU+Q1EgO5aq9gAh4yGpU1+pSD5dB40AMgW2UoM8pk33zhSeOlZj41UxcZ4hLhBtMJpphMNXoVcR1gjipTNvWnTVKd8lNVY4VnukLHjiTJ5C+3imyLh6tcknh1bP3k5UON/NrEtPNNB2dp5OZ+3cJkSQu4JiYAstsicAbRyBXGy2irzpNGSxT9KnSjeMcRP3n5cGO3utPVpMtNJ+79yTnfr5hjAWC+AOa4Y3J0AbfCihSewRBRUiQINAAbZueYCuToVW0pRiazEyoAdDUAR5h9R2aUY9g+XzfczaW5xuAslXLoj2ZexV4NzLGYVwCmyE033fny70fgS3zz1VCYvEsosOdowTIbzsk8o1BU22OZg06bDAN5i+SupWV6j2ROiXtSuikTF2jkDEWV8XZBJ6kDYA5goZwbImsDqdOwHedPOkZDf5zseqJNEOyNR2/UgBvuxX1h9iAejxzRpr04iz1xwvjqS4159iDXXIxGZHpzP3Z/E8q5SVLFY2ZrUb78xzF0HhKmt13UNR64I2qyDdPf3xEta3cd0UJ/pa1udR+72AVryO01zEtzxXxh0HnSDtF5sIzXoPl+4twOXDFu4Hm7zwyc5JUkbndXVc+xMOo8V/imk7HOsdvnJ8HWSeQDirjGrw89bne1iFNOt7XknE6N+QLzxXyhmMMYSTtUGs+x2sb2nBOP5ZxMfsdsX23o1zZIUvBa2KPMrwGwgAqYY2HK+WKet4PKebbxLOh1x8Ur/daxWqYbjQe26fhklNGvH6ApXo+tZo36kwPOXi3lHAuDNvY/mGh6jmW8mpwUKVOvbVrWTQkyNF3LqpIWQg0KmnsN1R5VCvrzI3HVonq+MOw8aYf65Lyub5vO7Xd0fEqKBDuG87iG0/dMd0/3Qa0hpZRR32xOr3OyakiVRp3OkcMkaqOr6uwpvqdl2HmLLE+ww4Jiz2yDjPJHNQaUFqDQaPeMqIhcnV78TRqYzYkkRa5GSGlB8pzR+gnxVvvkrXXTfT6jN4yBjV5ForptLNTqVP337TGkJJNjy2S+pIzgalFhuIBSUGRVuQnlQN9ooSTI2K4aUQFI32QeISNw+/wVs/FLH1TsNfB8rNgx4I10gltvbpp5Lcd4jtkxFQA8k31I5gQEVUMCII1mJwVTRl6VTzlSCk3mMAGQPR2YbkQJMhq1DhvuqxVJjV+bQKVEo85mi5PGy+YLA7eK4d+POIn5Isoo1ZLGc5KCmenhqoCAwnCJot8iIZXD1skNxy99QBE3k5hVerO2D91fx8gq2QLUD1jRRn2dtB3QNtnJ42ZjPR+lmmjfaxt1Umcpc6PAeBROialsvFRnoHjSbNQATiA4eXAznxp62Gg0cBYXpSZ/MvMq9nTmtUzZGk1svKnFKGuBch1ptrx95InKs0cwsZHO1LU01QWLOz1l/uU/f5iwppHR1eFRqtnY2usyVqaHHK3yHKbrVPwPpmmjhVtDPmQwK5K1gMxsnQYAyJ1WkT+ZudkE8NnHvSEMu0qv1Kp0Xkf1/SoT13Er/rSBuqhrNoCkxjZlLfFw1fZPgB7K2k5Fu/SambVo9ufnzQ33qNn8oN0TSdJjSimTkcmcUkq9qqCFqBWyVvHa4aXGPB9TpKK3aVhfZOx2KOuz8JDBEEmCVpdyZjkyXaEnS6M2GRCQyX9nNCqNThhfbSTTK03fyr5TkhZIzcJZdVXXZCFllJEGhhL4Bcd0yKirQRll7eIRvvkqXLOllNFOi/RaC1okQ8WbQsM/nze/M2r0CmTVfQr5kNkKpFroh0NXGC9PvCqfkpboVcFPZPyIMFuBHKM2obbK6Nce93o+TNZ6swzF8P0PTqLwTTE/olJDvhzCSObfRPJGkwUySQt4OuaPZM4U21VuknJOfZMhkjlT4mjA6TrC6IHMmanXPr9jNm4EKvrR6XWY2iDM6OhkforzDpLf7AmTW08SEIg29XIJ8oUmJ5kcCqO7uQT1RYvakSQMxEnj5ocbez4qBudRXGXlnL07qLKsTEzGK2B1fVeY3doKuqJd3YA9aLt+H4bvBOwKfctwsPxRX5xUxvVU6Wq9Zuc4d1alEY1YUChf/n0Cnbu0Nk4e3ITUOJedCtcR1Q/VXjP/wzGxH1VoOukcy3j32K1j1bLaxzLfG08iH2iq0x2gg3BIUqjhn/c6ieq2yRK9zvGS9jKWZFpf/uP7f4XUM38L3QG2AJ/wNF5ChZWBmjjDVX1vSfOyKZyKP30sqKGNBpTlxk9pWcaz6nDXPfk4J5O/0kL4bFNRZUVTq+OkAiBwCI37/tIWx7nW3nGqyGZzspnD0zK/Bb3ubsKDE449jPwTye8Y7uZqHWcyZ2Ynm4dGgVX43pKOuaIwBW0tawvb/0XU0zqOZzwHWs64SFLyDedYdZyO8VxbL5R4dWg6t5X+SjvEqgdKQBWaM3COLVsY5Sq8bq75glV9VeeYpWovobJu528CD1fDj/MnXbOdG8dDW6NfJClTaDRnJ77Q17JHl5LAbG/6UB77On3KWcIzWj9KRnabeAr8NbO9hA+RlpsTkNGnvlgCM2MZNEdlcXyBQ0DwZQE8q5w9xQ++vRLzY/I9ApDRwyonVvyb7VuBq820HMx0dTv421RCjS4hk7FtskCC5FDDLxLKZWSye3ZlBurrjOQ3Sf47k90TvSoBX2NIAKRvsr4EYadNOrniiuF++6mSjITSiRXfUDADQEP7NOo4WR4aO8xRHOIoD4gnmbgqe6z40e2lzKE6nvPbP5AEIPNU9rgk//dtW3nVD5UzA8mMC0riVI2IkUnPYE4i84xiW4NSyuTYMliXUiTFroabE4DIZF1JACKNkSIw2VhmhMxtETtRfMBwfyVR7KgQKd69r14FaoItQ9nlobHDJMY+rcSOCqHiDxZLOd7z2z9SJPerEJYw3rZWP51eBoCKEonqkFKC9A3mZgQg6VT1KSNIcg3mU8EpxvdVeQQUGNsGe1xmBIztqqEiNJiTSALgtQhCxdOGu0JF6fGKEZXz39ifMvNs/9jvUAXPfdCTlF1ROVBkr9+eL2t+HG5jAeApRWRXBFQAwOvbt15NSuVqkgRflzAdaYwUuwYLJKHgsVPlEYBM+gYLKS1Aoah2Eyo4pZ65rIgyYuyK6sckAUhscz0iCUDitkmgwJWbJuNfUcCr8BX41Ben2D/uJjXcRjF2CKPADx4SZVjVU+BH313acbwNfJu/+wMqyx1R6aWKZ+7YdlWd2Vm84xnxQV8joKQA4BrLGlPBKV8Q1faYAMjIXC4ByGigYUeKkbkeooKZMdDokbJvrlAxttvEyxQffslguELKSFS6ueLpfZ7ybFU4qTKMDgEY4+jh735YEPSq7hsrste/bSJm5t9T+VX2RSr77u1vTHd0ewaxo+FRwZzSj43lU1owaKCBUQl42FihpHJPAyNKCubMNdauqqvhJAQUiC1TdQkAYyRaNVLg371krt/+ZVVQhVCBK1/UAq65UEvAQ+HYEwLAo+JUYUgFwPj979wGDIPb315893Uqy9ytQqDAhTuuqk5Ap/CCeJIYELoRMXNKPUO5SVGmnk6vxHjFMZQvCYCMbZ1eUaLQVAGlBRPGlgZ2qGBOZWAoe0xFqd8uPmWlX/jtm8b6ECmTjsaW6ta1/SnPWHX8AYKxb4rWLzR/OinK9MPvLAz83defUo2EppsqcPm6OrYCqzG2VTl3+2/FK7u1fEoLZkpcIzljKuGircMRFcwphWbqkjoQuvZuwQTIwEx9UvtCt1cC0DeSFUoqj+126eyR8le+dtNQV0g9FJp2pMCl39yfYgbABIJDo8DYwx9UELfqYFQi4PXvLuam+c7re6TMXB2MVPjNHXm2guBqIhUKcubtW/mvEnoMFbTtMSlzz0BuTGpfaD9MacHMFDoG6rFqbGvBpwQAZGAin5QytrUQkQJ9AzmhJKUvWvbHlJXwK7/zkok+/1FSJ64OeoqMnr7+xSkmMMAzN8DoYX7zg6LvLWi7Cakvf5vngDHmWNz+QS5VA6HdSVS4vJ1bAYXgKkvbjhbcjq14JlWAnnzoq+Qt3zQW51Ihdy09jCgpAMjcM40zoKKcUk/o2xEpZeiahkOq6Av9LhUAIDG0TfNILEkZWW3jxKR+55WXbhrn6x+mykDoXy4ByD8546l636uuxCDcpmOjByRzuDkf/Ar51PcWwFxdMV9qab4A5roLYK5c4E/wIwlSju/TQ58KRTr9+vZtW9fyr4yz8XfTqahpf6HeUAEgNIsdSVInrqjpjOkWgFxGhtnKSJHSSNT1VJC5ZxbOqFDIoajLlFJZxo5Z3vqqJKnwROs+VCHpQ3/15ks3yy8pbwL4GgPMDIAZugzlS7hZkxnKl8o3/8pHc6oMRc1Oosio+NWrsy/um/HJ7335Y5I5+45CvTtSAUm/94P54tvM/F1NBsDMYAYAZqwm8+3v/SiXVPmgqDugNEAq//T77m3bG/751C/Tz0e/1Ofbfn9BMtOhprqcPalI4BnFl4mKPVGbEwKQydg2SockqSOuBV8qchma5e2UFkyADEVt64IsyfzVwCieBEAA5JZo4S0VgOJXrvDX+a/8Tvl3mb9e/t0yAMbXf1cfdZn567p/hf/alQ8mpM4osuvgEQWQFfyLL3/y2vXfKPfK/36Ov6r+/A8/OyLZsz2Fuu13SEU5/4Mf/bDuZeCHq375h7//VEbV8lFRf0SZqVQvXP5X9bch8jd3Yeb9169VJedwc6F+N6nwVRaPKofM52wNJxi9FdV9nUeGo7cOKwduxYhSQsFIPNEg7xEAGVb0RrpDT+OeR0a6A0fD+ndPjDQDp8KXpJSRIxoMFED8RpV3fjR8Kw+h7Ok8MtphAOeHAHBa443BzkgzcFT2mAowM0ZWPdihJADflKOK7uD8SD3k4LSGE4zUbz0/hG9pPDTaYVR7FT6pJYtW5irlrXLOfCsvJ08l2reYE81cO+E84Zxv5cy3mDm/BQBpwQRkFNqifi+jjABkVM5yAKD6GbgMAjLKeKmkn3iiQftJqcpAxpVZXzRojaRKW9YnSfWlmmpLgDQjRzTpRoSCkbjCEoAdSgKkmjB+U4WXSP1R1YAgdckXgAV7m7KCCaErGnXOJ8wjRygHJPUfr7BCqZ97Fc7PS4CUEkDilSzhk1KObNHoowkBuTxvK/okAVJKAMOqkQRIKcv9ik4s1QRIIHZKlh3KjAD4olFrSEBG6NtcGhAAWU1BhRNL/ciuCGQ1QQJ+yRJdhUx6oqW3Mi2TFlCORKNeTCkpMzJkVnWhIxq9d6gysIw90ey2TsHMMCUDb7dFs/cGCQGPCmUg04KZyhkSptBS2BFlAKkzQPZVD1ORgqpzSZ4o26EkjLdE485Pd4S6TxmoOsuJXdUWJdDN5UVbNZIZgBQoCEAuL9pCOSpd7Imm3VFC2HVEubNHeUYAMhDAQFfcW3qY8oyQpcgIQCbjjmqHEqiLFAnLHQsQgBtLUOSJprthRgiE8kFKAWSgcpYTPNWQEpQzgLKcZaDySD+jzBXKgIBk1BGt7UVmAoqUEIiGOyEhLZk1IwxE4/09QmaigS2a7sWywqAZIfFF8x1mT6iHVDd2FM64YNL3VQEVDN2M+gqAg76NVfSpZoKHVQNKtYCkowqpLjsq9EdgSyzRfbhrCaWbUN0toXyE0oI0JXJXFZFuwSnFtlA6ftATy/T6HtR9Sgsm7Z7q7ZwqKuVQ1adUC4CnwoOB76LN7SFJA2UFIeqK5v2YDDzuiSU6w4SA1DChJ5Z43yCXpkEyfJNYzUDmWoxQKK3dIik4q8rRVfmUoLJgThhexcr2KNFIC+TkqnxKtDKKbdVQ5lopje2KFXZeKVKtBF1Vt0gK5irI2FaNZK6RpQmFYuV7JWYdVzWiJC00cvkWlVfUydyKO0BvJ5cwDRA9YotlOm+JFRkoO3aZYuzbYrnu9pjMKUHJeU8s2Q3GJpE0ZlesaicmZcGMsqdCnwpmVMvIUjmx1GK8Xay6tUv6MhRqZ0y6Ejgn1G5CNX1xDANSSpUMLZUVkqYEwELt5qSfeKtnRZK05Y5QewnpSnBHhVDqyZG4k3yTvxNnJI1J2c8Pe/eIZdtbYUKANCFl8ahni+VzLwjHyfLzRJlzBiBpNo6e2O45YgUtzx9FiRHHYeBZYoXdUbzHCTPvvTLGrieq+7vj6hhDW1S6YbzHzK9gDCAK7JWDM7g41ox+bFfAGURjYE8Zj31R7Y4ujitjRH1xLDmK9xLlHjB0RKU9GAMx9pQIRLUX7jEnvMcxMA5/WhxDZzjei8eVUWBXwB1dHGOPOWHei0NXVNqDcTwGXgH2OB4H1h0FANvtBYNhg29lHupCnysBgJnfOmQGgMDvu5ZYTeeBnh+UtzHUR1DGYFh7BDDzAKwbMPs91xYra3Hj9zGzzffZ9zlgm/k+KNlW32fri1W2eBUdsPqNUNuaAPBG2xIrz2WHy0KfmS2Ay0KbdS1xLC1toW2BqyG0LYArxbFlTUtoW6wJoc2aljimFmtCaFvgaqFtsSbE/+///5efu333rstPBeyuX3RjQja4y+KTBAXrFk5CeUZy666KR8gI6K5Z9CkHMgrvqoxIOVyz8CkjALl7F8VJVKM1ix4p5fAuyoDKBYI1CydWIHfvmnCmALw1C+yoEN41uUDqSKxb9iukf5ckoEp/7cKOVED/rohPlbG9doF+FbbugpyjSumLNcxQVmB4t8MeUXVkrWO4eZWM3Lsa3pg0Waxl9qqAPHDuWjickWZfrGn6GpBJ4N6V8IaJJE1frG2yBiAp3HLvLnR6QUSSNOVArHFu5RoAJEdD33Nttk5cFhqy6upZwLGymBm4p8KyGdCy2O3656OE6g7EWmePKdMAIAngOLoQ1o20L4QAourdEMBupL6AnwuvjtRPhgBHy+cQ74jUT4bKCEAIjAK/59rHwOn5gxF2QiACcCEEcAG7kfpCCESNXmRmqHfDyt1ombshcGEX0W6oeyEEfm430h0DHOkyAFwIlbvROCFAUm1frHk+MKY7XqlLagmAkIRB11kd2/NHUUKQdKc+9sTapz2841lufL5nrwL3d2K6s88DW6yDeiHJO7SMAIwHvCwniOkOPxm4Yl2Ug/jOrJwREPaW4Q5iusOPg45YJ7X7YULyjgzICLjgNeUMErqDl4S9Uc8Wa6dOfxTld2TqodOE9VhCd/Ac7QSeLdZULdfr+4PhTqiM1CGAd0RN74aN7zADwIXdCLuh/i7C6ndE2A0BXIhqXuQxwNESxzFykvVk0q/nRaSdQZUn8TjSDHFhN2pyFxd2EWEXofLCLoCoevdCuNyowV1ElRd2yxdCYBcXlLvRLhCqI2WI0TDoex2xTmsBol2tSpuZoWQoBWABomyBHdfbGoZxDQAju4ZPtbPx6LGHPZcd2xLH914LYuPW8YILuVZGUUdrmzQzAqJh37XF5rYbjDWQUexWWTtSB3HgWmLT2+5HVQD23IqRzDQS3xab4VuxBmJHEVCO6qEjNsbtoCqjyBJAj6pl5ImNco5VyGgo4OxpDG2xYe5ElJUA9EVI1b7YPLefoEyVPIHqnthI36FModsTm+l2RHUDsanu7tWIrI01+JTp5J7YXLd2STcQm+xdndjeaEOo4YvN9m5V7Gy4WbsVQ7Hp7lMOZJR4G2+c5JwxRfbGG0ZU7ovNdzuIknFfrC3bbdQJngz9kwhg329jXdkdxdHjVtvcH0uCHJ5I1pjdhAA5apuhzAlgd6NmRDkAeC0TkdLfpOkkVJZ+u1hjVbRJw9RKCKUC3uaMFanALeOr5M7mTI/Ue07LuLkC8DZmwopQtG0kVeGmTI8q/dbhCvBmjBVVxE7rOHFF7m7EBKSWLNqXpQpjZwOmT5WJ00J2VIFxZ+OlT9Vboo29rAIxb7j4VCl3RDv7VQBvstgjqo6dlsJIA8HmihuRZk+0tR1pYMQbKv2ENAPR3p1YA1F3E6UzIt2haHM30UA+8jZN3EFCukPR7l6mASRh394c4d5OQtpD0fbdXCMjYDzw7E0QyxuMCch0BqL9fyaSFers4nDLc6wNDtvtB1FONZO+uBO0ghqAJCTjcBT4/R66ak8bQK9mF+DqBz0lqln5IOCp8SCjPjPQU3cBr9kHPeWDzB70H0RO7jXbrexpd8Ee84NAr7KrZo/5QYaaPSW0e8ruEh9E2dOHdq/cVfYqH+4zPwx0PXbZOVbWfY7L3sq7zF6jD3o/4h/sNsnMHj/IKLNnbAB40GOGmssocyUqH/R08SA0e0AX6FV3gd7DfT8Y7kRxTvVHjrhD9KIadwOTvWjkdzurZ7u9YBRejBPOaOUz+gl21BV3jnaQ3GVQczTo2qvDnh+OM7r7KGO2xR3l/cPkLkR5PPBWg4OI7krKJHDEHafjRyTvQgCI2FmW3Q/prqSkOHDFHanVG8Uk70IAydBbhhPEdDdS0sVhzxZ3rtwbRDlJ3G0AELqN+QndfZSgJwPPFne6ltsfhlFCgGxaIQECpFohUSXLBFluQqIkq1Wytp4st4qEYWRNlSSpkABIEiRAkCAJkiDIJpD7zXgRraAE7sjknZVUKvI42vFdccdsdbjX94Nh9QAImBkYMrYDZgyGzAyuBABmZihZF9gOBsAQ2A6YeQBgWAaDlahkNQAuQ5/LALYHjVbZ3gYw0N4GBuVtAAMA20GDA+U2KwdDZiBoFkquvc1gDHSHzAw1MwCuDbAaACsBgJkZZeZRiCjOSdYBRnYDfkZZrSQeR0+MhoOAeRsDYFgNVqJ6G8BAyWh2ewAwc44HzNsDDMtQb2NQZgDbQV0MMGRmIFBuDzS3B40Oy6jLAAJm3h5UD5UA1zRlhnIbg+0BAK5GeRsYgMuozcwMbCPAQDnUh5JR5roAwOqA/Z7n2mKd0mK36z8xzmpg7NVxQqo7Hvmea1ti45q9IEy0gEDPi0n/YuDZYoPbDWItDHV6GWmHPVtservDXAejqh4h0wg9sRHOoQ52VB7pRj2xMf5ooiGHJTfRGdhig7wTVgFbAjym6qQnNswHGrkrRjKruOiKjXO/So4epurQERvo/QogrwotsZG+VVUdWmJDPaiz54hNdSuq0Reb616uNRKb7AOdxNloc1gjEJvtQ1mRdzbc3FyR0UhsuocKoLfx1qccyCi2N944ojxjCsTmuxsmeTK0NuAAj138//5/9/+7/9/9/+7/d/+/+//d/+/+f/f/u//f/f9/TAMA" alt="Схема: как растёт вектор — size и capacity">
```

**На схеме:** закрашенные ячейки — это `size` (сколько элементов уже есть), вся дорожка — `capacity` (сколько места выделено заранее). Маскот добавляет элемент через `push_back`; когда дорожка кончается, вектор берёт кусок памяти побольше и переезжает.

У вектора два числа, и это не одно и то же:

- **`size()`** — сколько элементов **сейчас лежит**;
- **`capacity()`** — сколько мест **уже выделено** под них в памяти.

Когда `push_back` упирается в потолок вместимости, вектор выделяет **новый, больший** кусок памяти (обычно вдвое) и **переносит** туда всё содержимое. Поэтому вместимость растёт скачками, а не по одному:

```cpp
std::vector<int> v;
for (int i = 0; i < 5; ++i) {
  v.push_back(i);
  std::cout << v.size() << "/" << v.capacity() << " ";
}
// → 1/1 2/2 3/4 4/4 5/8    размер по +1, вместимость удваивается, когда места не хватило
```

Отсюда два практических следствия.

**1. Знаешь количество заранее — скажи `reserve`.** Тогда переселений не будет вовсе:

```cpp
std::vector<int> v;
v.reserve(1000);            // сразу просим место под 1000 элементов
for (int i = 0; i < 1000; ++i)
  v.push_back(i);           // ни одного переезда в памяти
```

`reserve` меняет только вместимость, `size` остаётся нулём — это не то же самое, что `std::vector<int> v(1000)` (тот создаёт 1000 нулей).

**2. Ловушка: `push_back` может «переселить» вектор — и старые ссылки повиснут.** После переезда все ссылки, указатели и итераторы на элементы указывают на **старую, уже освобождённую** память:

```cpp
std::vector<int> v = {1, 2, 3};
int &first = v[0];          // ссылка на первый элемент
v.push_back(4);             // ⚠️ вектор мог переехать — first теперь указывает в никуда
std::cout << first;         // ❌ UB: читаем по старому адресу
```

Это родственник ошибки «[менять контейнер во время перебора](03-logika-cikly.md#типовые-ошибки)». Лечится просто: **не держи ссылку/итератор на элемент через `push_back`.** Нужно значение после добавления — бери его по индексу заново (`v[0]`) или сделай `reserve` заранее, если знаешь итоговый размер.

### По шагам: `push_back` и переезд

> Цифры `capacity` — как у g++ (удваивает). В MSVC рост другой (×1.5), но идея та же.

```steps
@id cdjxj49
# Как вектор растёт и когда переезжает
std::vector<int> v;
v.push_back(10);
v.push_back(20);
v.push_back(30);
v.push_back(40);
v.push_back(50);
---
1 | v=[], size=0, capacity=0 | Пустой вектор: памяти под элементы ещё нет вообще.
2 | v=[10], size=1, capacity=1 | Первый элемент: вектор выделил место ровно под один.
3 | v=[10, 20], size=2, capacity=2 | Места нет → **переезд**: новый блок на 2, старые элементы скопированы, старый блок отдан обратно.
?4 | v=[10, 20, 30], size=3, capacity=4 | Снова тесно → переезд в блок на 4. Одно место осталось про запас.
5 | v=[10, 20, 30, 40], size=4, capacity=4 | Запасное место было — **никакого переезда**, просто записали. Это быстро.
6 | v=[10, 20, 30, 40, 50], size=5, capacity=8 | Переезд в блок на 8. Теперь три следующих `push_back` будут бесплатными.
```

Мораль: переезды редкие, потому что ёмкость **удваивается**. Но каждый переезд делает недействительными старые ссылки и итераторы на элементы — об этом ловушка ниже. Если размер известен заранее — `v.reserve(n)`, и переездов не будет вовсе.

**Память по шагам:** почему после `push_back` старые ссылки на элементы могут «протухнуть».

```memory
# Вектор переезжает, когда кончается место
std::vector<int> v;
v.push_back(1);
v.push_back(2);
v.push_back(3);
---
строка 1
стек main: v = пусто (size 0, capacity 0)
пояснение: Пустой вектор ещё не просил памяти в куче.
---
строка 2
стек main: v = →#1 (size 1, capacity 1)
куча: #1 int[1] = 1
пояснение: Первый элемент — вектор взял блок ровно на один `int`.
---
строка 3
стек main: v = →#2 (size 2, capacity 2)
куча: #1 ✗ int[1] = 1; #2 int[2] = 1, 2
пояснение: Места нет. Вектор выделил блок побольше, **скопировал** туда старое и освободил #1. Ссылка на `v[0]`, взятая раньше, смотрит в освобождённую память.
---
строка 4
стек main: v = →#3 (size 3, capacity 4)
куча: #2 ✗ int[2] = 1, 2; #3 int[4] = 1, 2, 3, _
пояснение: Снова переезд — теперь с запасом (ёмкость растёт в разы). Следующий `push_back` поместится без переезда. Заранее известен размер — `v.reserve(n)`, и переездов не будет.
```

### Главная опасность — выход за границы

> **Как надо.** Индекс — от `0` до `size() - 1`. Удобнее всего обходить через `for (int x : v)`, а при отладке — брать `v.at(i)`, который сразу сообщит о выходе за границу.

```cpp
std::vector<int> v = {1, 2, 3};

std::cout << v[5];         // ❌ мусор или порча чужой памяти. Программа НЕ падает и НЕ ругается
std::cout << v.at(5);      // ✅ бросит std::out_of_range — сразу видно, где ошибка
```

Индекс всегда от `0` до `size() - 1`. Три способа не ошибиться:

```cpp
// 1. Range-for — индексов нет вообще
for (int x : v)
  std::cout << x;

// 2. Правильное условие в цикле
for (std::size_t i = 0; i < v.size(); ++i)      // < , а не <=
  std::cout << v[i];

// 3. Проверка перед обращением к краям
if (!v.empty())
  std::cout << v.front();
```

```cpp
std::vector<int> v;              // ПУСТОЙ
std::cout << v.front();          // ❌ у пустого вектора нет первого элемента
std::cout << v[0];               // ❌ то же самое
```

### Типовые ситуации

**Заполнить с клавиатуры:**

```cpp
int n = readInt("Сколько чисел: ");
std::vector<int> v;
v.reserve(static_cast<std::size_t>(n));    // необязательно: заранее просим память под n штук

for (int i = 0; i < n; ++i)
  v.push_back(readInt("Число: "));         // добавляем по одному
```

**Статистика по вектору:**

```cpp
std::vector<int> v = {5, 3, 9, 1};

int sum = 0;
int mn = v[0];                    // ⚠️ только если вектор непустой
int mx = v[0];

for (int x : v) {
  sum += x;
  if (x < mn) mn = x;
  if (x > mx) mx = x;
}

double avg = static_cast<double>(sum) / static_cast<double>(v.size());
std::cout << sum << " " << mn << " " << mx << " " << avg;   // → 18 1 9 4.5
```

**Отбор по условию в новый вектор:**

```cpp
std::vector<int> v = {5, -3, 9, -1, 4};
std::vector<int> positives;                  // сюда сложим подходящие

for (int x : v)
  if (x > 0)
    positives.push_back(x);

for (int x : positives)
  std::cout << x << " ";                     // → 5 9 4
```

**Удаление по условию — правильный способ:**

```cpp
std::vector<int> v = {5, -3, 9, -1, 4};

// ❌ Так нельзя: удаление внутри перебора ломает индексы
// for (std::size_t i = 0; i < v.size(); ++i)
//   if (v[i] < 0) v.erase(v.begin() + i);

// ✅ C++20: одна строка, читается как предложение
std::erase_if(v, [](int x) { return x < 0; });   // «удали все, для которых правило верно»

for (int x : v)
  std::cout << x << " ";                         // → 5 9 4
```

`std::erase_if` возвращает, сколько элементов удалено — иногда это само по себе ответ:

```cpp
std::vector<int> v = {5, -3, 9, -1, 4};
std::size_t removed = std::erase_if(v, [](int x) { return x < 0; });
std::cout << "Убрано отрицательных: " << removed;      // → Убрано отрицательных: 2
```

```cpp alt: Убрать побеждённых монстров
struct Monster { std::string name; int hp; };
std::vector<Monster> wave = {{"гоблин", 0}, {"скелет", 12}, {"крыса", 0}};
std::erase_if(wave, [](const Monster &m) { return m.hp <= 0; });
std::cout << "Осталось: " << wave.size() << "\n";   // 1
```

```cpp alt: Список дел: удалить выполненные
struct Task { std::string title; bool done; };
std::vector<Task> todo = {{"лаба", true}, {"хлеб", false}, {"спорт", true}};
auto n = std::erase_if(todo, [](const Task &t) { return t.done; });
std::cout << "Удалено: " << n << ", осталось: " << todo.size() << "\n";
```

Удалить все элементы, равные конкретному значению, — ещё короче:

```cpp
std::vector<int> v = {1, 2, 3, 2};
std::erase(v, 2);                    // без лямбды: «удали все двойки»
for (int x : v)
  std::cout << x << " ";             // → 1 3
```

> **Старая форма, которую ты встретишь везде** — идиома «erase-remove». До C++20 другого способа не было:
>
> ```cpp
> v.erase(std::remove_if(v.begin(), v.end(),
>                        [](int x) { return x < 0; }),
>         v.end());                       // ⚠️ забыть v.end() — типичная ошибка
> ```
>
> Она работает и сейчас, так что узнавать её надо. Но в своём коде пиши `std::erase_if`: короче, и нечего забыть.

**Вектор в функции:**

```cpp
void printAll(const std::vector<int> &v) {     // читаем — const &
  for (int x : v)
    std::cout << x << " ";
  std::cout << "\n";
}

void doubleAll(std::vector<int> &v) {          // меняем — &
  for (int &x : v)                             // ⚠️ ссылка, иначе изменится копия
    x *= 2;
}

std::vector<int> makeRange(int n) {            // создаём — возврат по значению
  std::vector<int> result;
  for (int i = 1; i <= n; ++i)
    result.push_back(i);
  return result;
}

std::vector<int> v = makeRange(4);
doubleAll(v);
printAll(v);                                   // → 2 4 6 8
```

### Очередь и стек: `queue` и `stack`

Иногда важен не доступ по индексу, а **порядок обработки**. Тогда берут `std::queue` (очередь) или `std::stack` (стек) — они прячут лишнее и оставляют ровно нужные операции.

```cpp
#include <iostream>
#include <queue>
#include <stack>

int main() {
  std::queue<int> q;              // очередь: первым вошёл — первым вышел (FIFO)
  q.push(1);
  q.push(2);
  std::cout << q.front() << " ";  // → 1   смотрим первого
  q.pop();                        // убираем первого
  std::cout << q.front() << "\n"; // → 2

  std::stack<int> st;             // стек: последним вошёл — первым вышел (LIFO)
  st.push(1);
  st.push(2);
  std::cout << st.top() << " ";   // → 2   смотрим верхнего
  st.pop();
  std::cout << st.top() << "\n";  // → 1
  return 0;
}
```

| Контейнер | Правило | Методы | Когда брать |
|---|---|---|---|
| `std::queue` | FIFO — первым вошёл, первым вышел | `push` / `front` / `pop` | обработка по очереди, обход в ширину (BFS), задачи в порядке поступления |
| `std::stack` | LIFO — последним вошёл, первым вышел | `push` / `top` / `pop` | отмена (undo), разбор скобок, обход в глубину |
| `std::deque` | добавлять/убирать с **обоих** концов | `push_back` / `push_front` / … | нужен доступ к началу И концу |

> `queue` и `stack` — это «адаптеры» поверх `deque`: у них **нет** ни индексации `[]`, ни перебора `for (x : …)`. Это намеренно: доступ только через край. Нужно и то и другое — бери `std::deque` (умеет `[]` и добавление с обоих концов) или `vector`.

> **Что запомнить.** По умолчанию бери `std::vector`, а `std::array` — когда размер известен заранее. `size()` — сколько лежит, `capacity()` — под сколько выделено место; после переезда старые указатели на элементы недействительны. `v.at(i)` проверяет границы, `v[i]` — нет.

---

### Очередь с приоритетом: `priority_queue`

Обычная очередь отдаёт того, кто пришёл первым. `std::priority_queue` отдаёт **самого важного**: наверху всегда наибольший элемент. В играх это очередь ходов (кто быстрее — ходит раньше), список событий по времени, поиск кратчайшего пути.

```cpp
#include <iostream>
#include <queue>
#include <string>
#include <vector>

struct Turn {
  int speed = 0;
  std::string who;
};

// Правило «кто ниже в очереди»: priority_queue держит сверху того, кто «больше».
struct Slower {
  bool operator()(const Turn &a, const Turn &b) const { return a.speed < b.speed; }
};

int main() {
  std::priority_queue<Turn, std::vector<Turn>, Slower> order;
  order.push({5, "гоблин"});
  order.push({9, "лучник"});
  order.push({7, "воин"});
  while (!order.empty()) {
    std::cout << order.top().who << " (" << order.top().speed << ")\n";   // лучник, воин, гоблин
    order.pop();
  }
}
```

| Операция | Что делает | Скорость |
|---|---|---|
| `push(x)` | добавить | `O(log n)` |
| `top()` | посмотреть самого важного | `O(1)` |
| `pop()` | убрать самого важного | `O(log n)` |

Нужен **наименьший** сверху (ближайшее событие, самая дешёвая клетка пути) — `std::priority_queue<int, std::vector<int>, std::greater<int>>`. Перебрать очередь по порядку нельзя: видно только верх.

## 12. Словарь `std::map`

```diagram
# Словарь `map`: по ключу слева находим значение справа
<img src="data:image/webp;base64,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" alt="Схема: словарь map — ключ ведёт к значению">
```

**На схеме:** слева — ключи, справа — значения; от каждого ключа стрелка ведёт к его значению. Отдаёшь ключ — получаешь значение (`m.at("Аня")`), обратного пути нет.

Вектор ищет **по номеру**, словарь — **по ключу**. Как только в задаче появляется «найти по имени», «сколько раз встретилось», «для каждого X хранить Y» — это `map`.

```cpp
#include <map>
#include <string>

std::map<std::string, int> ages;    // ключ — строка, значение — число

ages["Аня"] = 21;                   // добавить или изменить
ages["Борис"] = 35;
ages.insert({"Вика", 28});          // добавить, НЕ перезаписывая существующее
ages["Аня"] = 22;                   // ключ уже есть → значение заменилось

std::cout << ages["Аня"] << "\n";   // → 22
std::cout << ages.size() << "\n";   // → 3
```

<details>
<summary>Разбор: что за команды у map</summary>

- **`std::map<std::string, int> ages;`** — словарь: каждому **ключу** (`std::string` — имя) сопоставлено **значение** (`int` — возраст). Тип пишется в углах через запятую: `<ключ, значение>`. Нужен заголовок `<map>`.
- **`ages["Аня"] = 21;`** — по ключу `"Аня"` положить значение `21`. Если ключа не было — создастся; если был — заменится. Так и добавляют, и меняют.
- **`ages.insert({"Вика", 28});`** — добавить пару «ключ-значение», но **не** перезаписывать, если ключ уже есть.
- **`ages["Аня"]`** (в выводе) — достать значение по ключу. **Осторожно при чтении** — см. ловушку ниже.
- **`ages.size()`** — сколько пар в словаре.

</details>

Ключом может быть почти что угодно сравнимое: `map<int, std::string>`, `map<char, int>`, `map<std::string, std::vector<int>>`.

### Главная ловушка: `[]` при чтении создаёт элемент

> **Как надо.** Проверять и читать `map` — через `contains`, `find` или `at`; `[]` — только когда запись действительно нужна (присвоить, `++counter[word]`).

```cpp
std::map<std::string, int> ages;
ages["Аня"] = 21;

std::cout << ages.size() << "\n";      // → 1
std::cout << ages["Гриша"] << "\n";    // → 0    ❌ и МОЛЧА создал "Гриша" = 0
std::cout << ages.size() << "\n";      // → 2    в словаре теперь лишний ключ
```

Четыре правильных способа:

```cpp
// 1. contains — просто «есть или нет» (C++20)
if (ages.contains("Гриша"))
  std::cout << ages.at("Гриша");
else
  std::cout << "нет такого\n";

// 2. at — если уверен, что ключ есть
std::cout << ages.at("Аня");           // → 21
std::cout << ages.at("Гриша");         // ❌ бросит std::out_of_range — но НЕ создаст ключ

// 3. find — проверить и сразу использовать значение (одна операция вместо двух)
auto it = ages.find("Аня");
if (it != ages.end())                  // end() = «не нашлось»
  std::cout << it->first << " = " << it->second;    // → Аня = 21

// 4. count — старый способ, вернёт 0 или 1
if (ages.count("Аня") > 0)
  std::cout << ages.at("Аня");
```

| Способ | Если ключа нет | Когда брать |
|---|---|---|
| `m[key]` | **создаст** элемент = 0 | только когда именно этого и хочешь |
| `m.at(key)` | исключение `out_of_range` | уверен, что ключ есть |
| `m.contains(key)` | `false` | просто проверить наличие (C++20) |
| `m.find(key)` | `m.end()` | проверить и сразу использовать значение |

### А вот когда `[]` — именно то, что нужно

**Счётчик слов:**

```cpp
std::map<std::string, int> counter;
std::string word;

while (std::cin >> word)          // читаем слова до конца ввода
  ++counter[word];                // нет слова → создастся 0 → станет 1. Есть → +1

for (const auto &[w, n] : counter)
  std::cout << w << ": " << n << "\n";
```

```cpp alt: Инвентарь: предмет → количество
std::map<std::string, int> inventory;
++inventory["зелье"];                 // нет ключа — появится с 0 и станет 1
inventory["стрела"] += 20;
for (const auto &[item, count] : inventory) std::cout << item << ": " << count << "\n";
```

```cpp alt: Голосование: кто набрал больше
std::vector<std::string> votes = {"Аня", "Борис", "Аня", "Вика", "Аня"};
std::map<std::string, int> tally;
for (const std::string &v : votes) ++tally[v];
auto best = std::max_element(tally.begin(), tally.end(),
    [](const auto &a, const auto &b) { return a.second < b.second; });
std::cout << best->first << " — " << best->second << "\n";
```

```
Ввод:   кот пёс кот кот
Вывод:  кот: 3
        пёс: 1
```

<details>
<summary>Разбор: счётчик слов по шагам</summary>

- **`std::map<std::string, int> counter;`** — словарь «слово → сколько раз встретилось».
- **`while (std::cin >> word)`** — читаем слова по одному, пока ввод не кончится.
- **`++counter[word];`** — весь фокус здесь. `counter[word]` берёт счётчик этого слова; если слова ещё не было, `map` создаёт его со значением `0`. `++` тут же прибавляет единицу. Итог: первое появление → `1`, каждое следующее → на 1 больше.
- **`for (const auto &[w, n] : counter)`** — перебор словаря. `[w, n]` — это **структурная привязка**: на каждом шаге пара «ключ-значение» раскладывается на две удобные переменные — `w` (слово) и `n` (счётчик). `const auto &` — берём без копирования и не меняем. Подробнее про `[a, b]` — в разделе [Структурные привязки](#структурные-привязки--читай-как-разложить-на-части).

</details>

<details>
<summary>Трассировка: счётчик слов на входе «кот пёс кот»</summary>

| шаг | прочитано `word` | что сделал `++counter[word]` | `counter` после шага |
|---|---|---|---|
| старт | — | — | `{}` |
| 1 | `кот` | ключа нет → создан с `0` → стал `1` | `{кот: 1}` |
| 2 | `пёс` | ключа нет → создан с `0` → стал `1` | `{кот: 1, пёс: 1}` |
| 3 | `кот` | ключ есть → `1 + 1` | `{кот: 2, пёс: 1}` |
| конец | ввод кончился, `std::cin >> word` ложно | — | вывод: `кот: 2`, `пёс: 1` |

Весь трюк — в шагах 1 и 2: `[]` сам создаёт отсутствующий счётчик со значением `0`, и `++` сразу делает его единицей.

</details>


**Счётчик символов:**

```cpp
std::string s = "hello";
std::map<char, int> freq;

for (char c : s)
  ++freq[c];                      // тот же приём

for (const auto &[c, n] : freq)
  std::cout << c << "=" << n << " ";    // → e=1 h=1 l=2 o=1  (по алфавиту!)
```

### Перебор

`map` **всегда отсортирован по ключу** — перебор идёт по возрастанию независимо от порядка вставки.

```cpp
std::map<std::string, int> ages = {{"Вика", 28}, {"Аня", 21}, {"Борис", 35}};

// Структурные привязки — самый читаемый способ
for (const auto &[name, age] : ages)
  std::cout << name << " — " << age << "\n";
// → Аня — 21
// → Борис — 35
// → Вика — 28

// То же самое без привязок: элемент map — это pair
for (const auto &entry : ages)
  std::cout << entry.first << " — " << entry.second << "\n";   // first = ключ, second = значение

// Изменение значений — без const
for (auto &[name, age] : ages)
  age += 1;                       // ✅ значение менять можно
                                  // ❌ name менять нельзя никогда — от него зависит порядок
```

### Удаление

```cpp
ages.erase("Борис");              // по ключу; если ключа нет — просто ничего не произойдёт
std::cout << ages.size();         // → 2

ages.clear();                     // удалить всё
```

### Типовые задачи с `map`

**Найти ключ с максимальным значением:**

```cpp
std::map<std::string, int> scores = {{"Аня", 90}, {"Борис", 75}, {"Вика", 95}};

std::string bestName;
int bestScore = -1;                          // заведомо меньше любого реального

for (const auto &[name, score] : scores) {
  if (score > bestScore) {
    bestScore = score;
    bestName = name;
  }
}
std::cout << bestName << " " << bestScore;   // → Вика 95
```

**Перевернуть словарь (значение становится ключом):**

```cpp
std::map<std::string, int> ages = {{"Аня", 21}, {"Борис", 35}};
std::map<int, std::string> byAge;

for (const auto &[name, age] : ages)
  byAge[age] = name;                    // ⚠️ если возрасты повторяются, часть имён потеряется

for (const auto &[age, name] : byAge)
  std::cout << age << ": " << name << "\n";
// → 21: Аня
// → 35: Борис
```

**Группировка — значение само является контейнером:**

```cpp
std::map<std::string, std::vector<int>> marks;

marks["Аня"].push_back(5);        // вектора ещё нет — [] создаст пустой, и мы в него добавим
marks["Аня"].push_back(4);
marks["Борис"].push_back(3);

for (const auto &[name, list] : marks) {
  std::cout << name << ": ";
  int sum = 0;
  for (int m : list) {
    std::cout << m << " ";
    sum += m;
  }
  std::cout << "| средний " << static_cast<double>(sum) / static_cast<double>(list.size()) << "\n";
}
// → Аня: 5 4 | средний 4.5
// → Борис: 3 | средний 3
```

Здесь автосоздание через `[]` — уже не ловушка, а самая удобная вещь в `map`.

**Телефонная книга с меню:**

```cpp
std::map<std::string, std::string> phones;

// добавление
phones["Аня"] = "+7 900 111-22-33";

// поиск
std::string who = "Аня";
auto it = phones.find(who);
if (it != phones.end())
  std::cout << it->second << "\n";           // → +7 900 111-22-33
else
  std::cout << "Контакт не найден\n";

// удаление с проверкой
if (phones.erase(who) > 0)                   // erase возвращает, сколько удалил
  std::cout << "Удалён\n";
else
  std::cout << "Такого не было\n";
```

### Свой `struct` как ключ

`map` держит ключи отсортированными, поэтому ключ обязан уметь сравниваться через `<`:

```cpp
struct Point {
  int x = 0;
  int y = 0;

  bool operator<(const Point &other) const {     // без этого не соберётся
    if (x != other.x)                            // сначала сравниваем по x,
      return x < other.x;
    return y < other.y;                          // при равных x — по y
  }
};

std::map<Point, std::string> labels;
labels[Point{1, 2}] = "старт";
labels[Point{3, 4}] = "финиш";

for (const auto &[p, name] : labels)
  std::cout << "(" << p.x << "," << p.y << ") " << name << "\n";
// → (1,2) старт
// → (3,4) финиш
```

Если увидишь ошибку на пол-экрана со словами `operator<` — причина здесь.

> **Что запомнить.** `std::map` хранит пары «ключ → значение» по возрастанию ключа. Для чтения — `find` или `contains`, потому что `m[k]` создаёт ключ; `m[k]` уместен, когда именно записываешь или считаешь (`++count[word]`). Перебор — `for (const auto &[k, v] : m)`.

---

## 13. `std::unordered_map`

```cpp
#include <unordered_map>

std::unordered_map<std::string, int> ages;   // все операции — те же самые
ages["Аня"] = 21;
ages.insert({"Борис", 35});

if (ages.contains("Аня"))
  std::cout << ages.at("Аня");               // → 21
```

Разница ровно одна, но важная:

| | `std::map` | `std::unordered_map` |
|---|---|---|
| Порядок при переборе | по возрастанию ключа | **произвольный** |
| Скорость поиска ([что это значит](07-algoritmy.md#как-оценить-скорость-o1-olog-n-on-on²)) | быстро (log n) | очень быстро (в среднем — мгновенно) |
| Устройство | дерево | хеш-таблица |
| Ключ требует | `operator<` | хеш-функцию |
| Когда брать | нужен порядок, выводишь на экран | нужна только скорость |

```cpp
std::unordered_map<std::string, int> m = {{"Аня", 1}, {"Борис", 2}, {"Вика", 3}};

for (const auto &[name, n] : m)
  std::cout << name << " ";
// → Вика Аня Борис    ⚠️ порядок произвольный: не такой, как при вставке, и не по алфавиту
```

<details>
<summary>Копнуть глубже: дерево против хеш-таблицы</summary>

`std::map` внутри — это **сбалансированное двоичное дерево поиска** (обычно красно-чёрное). Каждый узел хранит ключ и ссылки на «меньших» слева и «больших» справа; поиск идёт как в игре «угадай число»: сравнил с корнем — пошёл влево или вправо, на каждом шаге отбрасывая половину оставшихся. Отсюда скорость `O(log n)` (для миллиона ключей — около 20 сравнений) и «бесплатная» отсортированность: обход дерева слева направо сразу выдаёт ключи по возрастанию. При каждой вставке дерево балансируется, чтобы не выродиться в длинную «палку» и не потерять свой `log n`.

`std::unordered_map` устроен иначе — это **хеш-таблица**. Ключ прогоняют через хеш-функцию, которая превращает его в число-адрес «корзины» (bucket), и значение кладут прямо туда. Поиск не идёт по цепочке сравнений, а сразу вычисляет нужную корзину — поэтому в среднем `O(1)`, почти мгновенно и почти независимо от числа элементов. Плата за скорость — потерянный порядок: корзины расставлены по хешам, а не по величине ключа, поэтому перебор выдаёт ключи «как попало». Этот порядок не случайный от запуска к запуску — на твоём компиляторе он повторяется, — но зависит от реализации и от истории вставок, поэтому **полагаться на него нельзя**. Вот почему `map` требует `operator<` (сравнивать узлы в дереве), а `unordered_map` — хеш-функцию (вычислять корзину).

</details>

**Практический вывод:** пока задачи маленькие, выигрыш в скорости незаметен, а «перемешанный» вывод заметен сразу. **Бери `map`**, а `unordered_map` доставай, когда элементов десятки тысяч и профилировщик показал, что дело в поиске.

> **Что запомнить.** Тот же словарь, но без порядка ключей и обычно быстрее. Нужен порядок при выводе — `map`, нужна только скорость поиска — `unordered_map`.

---

## 14. `std::set` — только уникальные

```cpp
#include <set>

std::set<int> seen;

seen.insert(5);
seen.insert(3);
seen.insert(5);                     // дубликат просто игнорируется, без ошибки

std::cout << seen.size() << "\n";       // → 2
std::cout << seen.contains(3) << "\n";  // → 1   (C++20)
std::cout << seen.count(3) << "\n";     // → 1   старый способ: 0 или 1

seen.erase(3);
std::cout << seen.size() << "\n";       // → 1

for (int x : seen)                      // всегда по возрастанию
  std::cout << x << " ";                // → 5
```

`set` — это `map` без значений, одни ключи. Берёшь его, когда вопрос звучит как **«а это уже было?»**.

### Типовые задачи с `set`

**Убрать дубликаты:**

```cpp
std::vector<int> v = {3, 1, 3, 2, 1};

std::set<int> unique(v.begin(), v.end());              // конструктор принимает диапазон
std::vector<int> result(unique.begin(), unique.end()); // и обратно в вектор

for (int x : result)
  std::cout << x << " ";                               // → 1 2 3   (заодно отсортировалось)
```

<details>
<summary>Разбор: как эти две строки убирают дубликаты</summary>

- **`std::set<int> unique(v.begin(), v.end());`** — создаём `set` сразу из **диапазона** вектора. `v.begin()` / `v.end()` — «от начала до конца `v`». `set` хранит только уникальные значения, поэтому повторы отсеются сами, а заодно всё отсортируется.
- **`std::vector<int> result(unique.begin(), unique.end());`** — тем же приёмом собираем вектор обратно из множества. Теперь в `result` — уникальные значения по возрастанию.

Приём «залить в `set`, вылить обратно» — самый короткий способ получить уникальные отсортированные элементы.

</details>

**Проверка на повторы:**

```cpp
bool hasDuplicates(const std::vector<int> &v) {
  std::set<int> unique(v.begin(), v.end());
  return unique.size() != v.size();      // размеры разошлись → были повторы
}

std::cout << hasDuplicates({1, 2, 3}) << "\n";     // → 0
std::cout << hasDuplicates({1, 2, 1}) << "\n";     // → 1
```

```cpp alt: Уникальные посетители сайта
std::vector<std::string> visits = {"ip1", "ip2", "ip1", "ip3", "ip2"};
std::set<std::string> unique(visits.begin(), visits.end());
std::cout << "Уникальных: " << unique.size() << "\n";   // 3
```

```cpp alt: Какие клетки карты уже открыты
std::set<std::pair<int, int>> visited;
visited.insert({2, 3});
visited.insert({2, 3});                                  // повтор — не добавится
bool seen = visited.contains({2, 3});                    // C++20
std::cout << visited.size() << " " << seen << "\n";   // 1 1
```

**Отслеживание увиденного в цикле:**

```cpp
std::vector<std::string> words = {"кот", "пёс", "кот"};
std::set<std::string> seen;

for (const auto &w : words) {
  if (seen.contains(w))                     // уже встречалось?
    std::cout << w << " — повтор\n";
  else
    seen.insert(w);                         // нет — запоминаем
}
// → кот — повтор
```

Есть и `std::unordered_set` — соотношение с `set` такое же, как у `unordered_map` с `map`.

> **Что запомнить.** `std::set` хранит только уникальные значения, по возрастанию. Дубликат `insert` просто не добавит, проверка — `contains` или `count`. Сколько разных значений — `size()`.

---

## 15. `std::pair` — две вещи вместе

```cpp
#include <utility>

std::pair<std::string, int> person{"Аня", 21};    // фигурные скобки при создании

std::cout << person.first << "\n";      // → Аня   первое поле
std::cout << person.second << "\n";     // → 21    второе

person.second = 22;                     // поля можно менять
```

Имена `first` и `second` фиксированные, свои не задать. Если полей больше двух или имена важны для читаемости — это уже `struct` ([раздел 19](08-struct-fayly.md#19-struct)).

### Где пара встречается сама собой

```cpp
// 1. Элемент map — это pair
std::map<std::string, int> ages = {{"Аня", 21}};
for (const auto &entry : ages)
  std::cout << entry.first << " " << entry.second;   // ключ и значение

// 2. Возврат из функции двух значений
std::pair<int, int> divide(int a, int b) {
  return {a / b, a % b};                  // фигурные скобки — пара соберётся сама
}
auto [q, r] = divide(17, 5);              // и разберётся сама
std::cout << q << " " << r;               // → 3 2

// 3. minmax_element возвращает пару итераторов
std::vector<int> v = {5, 3, 9};
auto [lo, hi] = std::minmax_element(v.begin(), v.end());
std::cout << *lo << " " << *hi;           // → 3 9   ⚠️ звёздочки: это итераторы
```

<details>
<summary>Разбор: что за квадратные скобки `[q, r]` и звёздочки</summary>

- **`auto [q, r] = divide(17, 5);`** — функция вернула пару из двух чисел, а `[q, r]` тут же **раскладывает** её на две переменные: `q` — первое поле, `r` — второе. Удобнее, чем доставать `.first` и `.second` руками. Подробнее — в разделе ниже.
- **`return {a / b, a % b};`** — фигурные скобки собирают пару «на лету»: тип возврата уже `std::pair<int, int>`, поэтому два числа сами становятся парой.
- **`auto [lo, hi] = std::minmax_element(…);`** — здесь в паре лежат **итераторы** (указатели на элементы), а не сами числа. Поэтому значение достают звёздочкой: `*lo`, `*hi`. Про итераторы и `*` — в [теме 7](07-algoritmy.md).

</details>

### Структурные привязки — читай как «разложить на части»

```cpp
std::pair<std::string, int> p{"Аня", 21};

auto [name, age] = p;               // копия обоих полей
const auto &[n2, a2] = p;           // ссылка, без копирования

// Работает и со struct
struct Point { int x = 0; int y = 0; };
Point pt{3, 4};
auto [px, py] = pt;
std::cout << px << " " << py;       // → 3 4
```

### Вектор пар — когда порядок важнее поиска

```cpp
// map сортирует по ключу и не хранит дубликаты.
// Если нужен исходный порядок или повторяющиеся ключи — вектор пар:
std::vector<std::pair<std::string, int>> log;

log.push_back({"старт", 0});
log.push_back({"шаг", 5});
log.push_back({"шаг", 7});          // ключ повторяется — map бы такое не сохранил

for (const auto &[event, time] : log)
  std::cout << event << "@" << time << " ";
// → старт@0 шаг@5 шаг@7
```

> **Что запомнить.** `std::pair` — две вещи вместе: `first` и `second`; разложить удобно так: `auto [name, age] = p;`. Если полей больше двух или у них есть смысл — заведи `struct` с понятными именами.

---

## 16. Вложенные контейнеры

Контейнер может хранить контейнер. Скобки `>>` разделять не нужно — с C++11 это законно.

### Таблица чисел: `vector<vector<int>>`

```cpp
#include <vector>

// 3 строки по 4 столбца, всё нулями
std::vector<std::vector<int>> table(3, std::vector<int>(4, 0));
//                                  ↑             ↑
//                       сколько строк   чем заполнить каждую

table[1][2] = 7;                     // [строка][столбец]

for (const auto &row : table) {      // row — это vector<int>, ссылка без копии
  for (int cell : row)               // cell — обычное число
    std::cout << std::setw(3) << cell;
  std::cout << "\n";                 // перевод строки — после КАЖДОЙ строки таблицы
}
// →   0  0  0  0
// →   0  0  7  0
// →   0  0  0  0
```

**Заполнение по формуле:**

```cpp
std::vector<std::vector<int>> mult(4, std::vector<int>(4, 0));

for (std::size_t i = 0; i < mult.size(); ++i)              // по строкам
  for (std::size_t j = 0; j < mult[i].size(); ++j)         // по столбцам этой строки
    mult[i][j] = static_cast<int>((i + 1) * (j + 1));      // таблица умножения

std::cout << mult[2][3];             // → 12   (3 × 4)
```

**Размеры:**

```cpp
std::cout << table.size() << "\n";       // → 3   количество строк
std::cout << table[0].size() << "\n";    // → 4   длина первой строки
```

> Строки могут быть **разной длины** — это не матрица в математическом смысле, а вектор векторов. Если нужна честная матрица, следи за длинами сам.

**Живой пример:** подвигай размеры поля — посмотри, как считаются клетки и индекс последней.

```live
@R = 3 [1..12]
@C = 4 [1..12]
---
std::vector<std::vector<int>> grid({R}, std::vector<int>({C}, 0));
// строк: grid.size() == {R}; в каждой строке: grid[0].size() == {C}
int last = grid[{R-1}][{C-1}];   // последняя клетка: индексы на 1 меньше размеров
---
клеток всего: {R*C}
последняя клетка: grid[{R-1}][{C-1}]
```

### Словарь списков: `map<string, vector<int>>`

```cpp
std::map<std::string, std::vector<int>> marks;

marks["Аня"].push_back(5);      // [] создаст пустой вектор, push_back добавит в него
marks["Аня"].push_back(4);
marks["Борис"].push_back(3);

std::cout << marks["Аня"].size() << "\n";      // → 2
std::cout << marks["Аня"][0] << "\n";          // → 5   первая оценка Ани

for (const auto &[name, list] : marks) {
  std::cout << name << ": ";
  for (int m : list)
    std::cout << m << " ";
  std::cout << "\n";
}
// → Аня: 5 4
// → Борис: 3
```

### Словарь словарей

```cpp
// Матрица «кто кому сколько должен»
std::map<std::string, std::map<std::string, int>> debts;

debts["Аня"]["Борис"] = 500;         // Аня должна Борису 500
debts["Борис"]["Вика"] = 300;

for (const auto &[from, inner] : debts)          // inner — это map
  for (const auto &[to, amount] : inner)
    std::cout << from << " → " << to << ": " << amount << "\n";
// → Аня → Борис: 500
// → Борис → Вика: 300
```

### Вектор структур — самая частая форма

```cpp
struct Student {
  std::string name;
  int score = 0;
};

std::vector<Student> group = {          // заполняем сразу
    {"Аня", 95},
    {"Борис", 70},
    {"Вика", 88},
};

group.push_back({"Гриша", 60});         // добавляем ещё одного

for (const auto &s : group)             // const & — структуры не копируем
  std::cout << s.name << ": " << s.score << "\n";
```

Почти любая реальная задача выглядит именно так: список товаров, учеников, точек, ходов.

> **Что запомнить.** Контейнеры вкладываются: `vector<vector<int>>` — таблица, `map<string, vector<int>>` — словарь списков. Чаще всего нужен вектор структур. В функции такие контейнеры передавай по `const &` — копия может быть дорогой.

## Рецепты: хочу X → вот код

Ищешь не функцию, а решение задачи — начни отсюда.

- **Список, который растёт** — `std::vector<int> v; v.push_back(x);`. → [vector](#stdvector--массив-который-умеет-всё)
- **Найти по имени** — `auto it = m.find(name); if (it != m.end()) use(it->second);`. → [map](#12-словарь-stdmap)
- **Посчитать, сколько раз встречается** — `std::map<std::string, int> cnt; ++cnt[word];`. → [счётчик](#а-вот-когда---именно-то-что-нужно)
- **Убрать повторы** — `std::set<int> s(v.begin(), v.end());`. → [set](#14-stdset--только-уникальные)
- **«Это уже было?»** — `if (!seen.insert(x).second) { /* было */ }`. → [set](#типовые-задачи-с-set)
- **Таблица чисел** — `std::vector<std::vector<int>> grid(rows, std::vector<int>(cols, 0));`. → [вложенные](#таблица-чисел-vectorvectorint)
- **Удалить из вектора все подходящие** — `std::erase_if(v, [](int x) { return x < 0; });`

## Мини-проект: телефонная книга на `map`

Небольшая программа с командами — всё, что нужно от словаря: добавить, найти, удалить, вывести по алфавиту. Полная версия с сохранением в файл — в [примерах](../examples/06-telefonnaya-kniga.md); здесь — ядро на 40 строк.

```cpp {24-26}
#include <windows.h>
#include <iostream>
#include <map>
#include <string>

int main() {
  SetConsoleCP(CP_UTF8);
  SetConsoleOutputCP(CP_UTF8);

  std::map<std::string, std::string> book;   // имя → телефон, по алфавиту
  std::cout << "Команды: add Имя Телефон | find Имя | del Имя | list | quit\n";

  std::string cmd;
  while (std::cout << "> " && std::cin >> cmd) {
    if (cmd == "add") {
      std::string name, phone;
      std::cin >> name >> phone;
      bool isNew = !book.contains(name);
      book[name] = phone;                     // [] — создать или перезаписать
      std::cout << (isNew ? "Добавлен " : "Обновлён ") << name << "\n";
    } else if (cmd == "find") {
      std::string name;
      std::cin >> name;
      auto it = book.find(name);              // find не создаёт пустую запись, в отличие от []
      if (it != book.end()) std::cout << it->first << ": " << it->second << "\n";
      else std::cout << "Нет такого\n";
    } else if (cmd == "del") {
      std::string name;
      std::cin >> name;
      std::cout << (book.erase(name) ? "Удалён\n" : "Нет такого\n");
    } else if (cmd == "list") {
      if (book.empty()) std::cout << "Книга пуста\n";
      for (const auto &[name, phone] : book) std::cout << name << " — " << phone << "\n";
    } else if (cmd == "quit") {
      break;
    } else {
      std::cout << "Не понял команду\n";
    }
  }
  return 0;
}
```

```console
$ ./kniga
Команды: add Имя Телефон | find Имя | del Имя | list | quit
> add Борис 222
Добавлен Борис
> add Аня 111
Добавлен Аня
> add Аня 333
Обновлён Аня
> list
Аня — 333
Борис — 222
> del Вера
Нет такого
> quit
```

Что здесь из темы: **`[]` для записи** (создаёт или перезаписывает) и **`find` для чтения** — чтобы поиск не создавал пустых записей ([главная ловушка `map`](#главная-ловушка--при-чтении-создаёт-элемент)); `contains` — «есть ли ключ»; `erase` возвращает, сколько удалил (`0` или `1`); перебор со [структурными привязками](#структурные-привязки--читай-как-разложить-на-части) — и `map` сам выводит имена по алфавиту.

**Доделай сам:** команду `count` (сколько записей) и команду `starts А` — вывести всех, чьё имя начинается с заданной строки (подсказка: `name.starts_with(prefix)`).

---

## Проверь себя

Небольшой разбор по теме. Нажми вариант — сразу увидишь, верно или нет; можно и просто «Показать ответ».

```quiz
В: Чем удобнее посчитать, сколько РАЗНЫХ значений в наборе чисел?
+ `std::set` (его `.size()`)
- `std::vector`
- `std::pair`
= `set` хранит только уникальные значения — размер и есть число различных.

В: Как посчитать, сколько раз встретилось каждое слово?
+ `std::map<std::string,int>` и `++freq[word]`
- `std::vector<int>`
- `std::set<std::string>`
= `map`-счётчик — базовый приём: ключ-слово → количество.

В: Что делает `m[key]` в `std::map`, если такого ключа ещё нет?
+ Создаёт ключ со значением по умолчанию
- Бросает исключение
- Возвращает `nullptr`
= `operator[]` ВСТАВЛЯЕТ ключ. Чтобы проверить наличие без вставки — `m.count(key)` или `m.find(key)`.

В: В каком порядке `std::map` хранит ключи?
+ В отсортированном по ключу
- В порядке вставки
- В случайном
= `map` всегда упорядочен по ключу — этим удобно пользоваться при выводе.

В: Как добавить элемент в конец `std::vector v`?
+ `v.push_back(x)`
- `v.add(x)`
- `v.append(x)`
= У вектора метод `push_back`.

В: Как проверить, есть ли `x` в `std::set s`?
+ `s.count(x)` (или `s.contains(x)` в C++20)
- `s.find(x) == true`
- `s.has(x)`
= `count` вернёт 0 или 1; `find` возвращает итератор (сравнивают с `s.end()`), а не `bool`.
```

А теперь код — найди ошибку сам, потом сверься:

```findbug
std::map<std::string, int> ages;
ages["Аня"] = 20;
if (ages["Боря"] > 18)            // проверяем возраст Бори
    std::cout << "взрослый\n";
std::cout << ages.size();         // печатает 2, хотя добавляли одного
---
Обращение `ages["Боря"]` СОЗДАЁТ ключ «Боря» со значением 0 — поэтому размер стал 2. Чтобы проверить наличие без вставки, используй `ages.count("Боря")` или `ages.find("Боря")`.
```

И «заполни пропуск» — впиши недостающее и нажми «Проверить»:

```fillcode
// посчитать, сколько РАЗНЫХ значений в наборе
std::[[set]]<int> uniq;
for (int x : v)
    uniq.insert(x);
std::cout << uniq.size();
```

Карточки на повторение — вспомни ответ сам, потом проверь и отметь, насколько было легко (панель напомнит повторить позже):

```cards
Q: Что делает `m[key]` в `map`, если ключа ещё нет?
A: создаёт его со значением по умолчанию. Проверять наличие — `count`/`find`/`contains`, а не `[]`.

Q: `map` и `unordered_map` — чем отличаются?
A: `map` — дерево, отсортирован, поиск `O(log n)`; `unordered_map` — хеш-таблица, без порядка, поиск `O(1)` в среднем.

Q: Чем посчитать, сколько РАЗНЫХ значений в наборе?
A: `std::set` и его `.size()`.

Q: Как добавить элемент в конец вектора?
A: `v.push_back(x)`.

Q: Чем `v.size()` отличается от `v.capacity()`?
A: `size` — сколько элементов лежит, `capacity` — под сколько выделено место. Когда место кончается, вектор берёт блок побольше и переносит элементы туда.

Q: Как пройти по `map`, получая ключ и значение?
A: `for (const auto &[key, value] : m) { ... }` — структурная привязка (C++17). Ключи идут по возрастанию.

Q: Как проверить, есть ли ключ в `map`, не создавая его?
A: `m.contains(k)` (C++20), `m.count(k)` или `m.find(k) != m.end()`. `m[k]` для проверки не подходит — он вставит ключ.
H: Одна из карточек выше — о том, что делает `m[key]`.

Q: Что хранит `std::pair<std::string, int>` и как достать части?
A: Два значения разных типов: `p.first` и `p.second`. Удобно распаковать сразу: `auto [name, age] = p;`.

Q: Чем `std::array<int, 5>` отличается от `std::vector<int>`?
A: Размер `array` фиксирован при компиляции, элементы лежат прямо в объекте, без кучи. `vector` растёт во время работы.

Q: Почему нельзя удалять элементы вектора внутри `for (auto x : v)`?
A: Удаление сдвигает элементы и портит итераторы цикла — обход ломается. Удаляй разом: `std::erase_if(v, условие)` (C++20).

Q: Что лежит наверху `std::priority_queue<int>`?
A: Наибольший элемент. Наименьший сверху — с третьим параметром `std::greater<int>`.

Q: Где в игре нужна очередь с приоритетом?
A: Очередь ходов по скорости, события по времени, поиск кратчайшего пути (сначала самая дешёвая клетка).
```

Предскажи вывод — ловушка `[]` при чтении:

```challenge
@id czcu2e7
@type predict
Что напечатает программа? (через пробел)
---
std::map<std::string, int> m;
m["a"] = 1;
std::cout << m.size() << " ";
if (m["x"] == 0) std::cout << m.size() << " ";
std::cout << m.count("y") << " " << m.size();
---
1 2 0 2
```

Напиши сам и запусти:

```challenge
@id c1d7gxk
@type run
@hint `++count[word]` сразу и создаёт слово в словаре, и увеличивает его счётчик.
@hint `map` идёт по алфавиту: обновляй лучшего только при **строго** большем числе — при равенстве останется слово, которое раньше по алфавиту.
Прочитай слова до конца ввода и напечатай самое частое слово и сколько раз оно встретилось, через пробел. Если таких несколько — то, что раньше по алфавиту.
---
#include <iostream>
#include <map>
#include <string>

int main() {
    std::map<std::string, int> count;
    std::string word;
    // твой код: посчитай слова и найди самое частое

}
---
# вход => ожидаемый вывод
b a b => b 2
x => x 1
a b c a b a => a 3
b a => a 1
---
#include <iostream>
#include <map>
#include <string>

int main() {
    std::map<std::string, int> count;
    std::string word;
    while (std::cin >> word) ++count[word];
    std::string best;
    int bestN = 0;
    for (const auto &[w, n] : count) {
        if (n > bestN) {
            bestN = n;
            best = w;
        }
    }
    std::cout << best << " " << bestN << "\n";
}
```

> **Сквозной проект «Подземелье», квест 6:** [Инвентарь и журнал](../proekt/03-glava-2-dannye.md#квест-6-инвентарь-и-журнал) — добавьте в свою игру то, что выучили в этой теме.

## Босс темы

```boss
# Инвентарь героя
@id cojbvj8
Рюкзак персонажа на `std::map<std::string, int>` (предмет → количество).

1. Команды: `add меч 1`, `use зелье`, `show`, `exit`.
2. `use` уменьшает количество; дошло до нуля — предмет **удаляется** из словаря (не остаётся с нулём).
3. Нельзя использовать то, чего нет, — сообщение, а не падение (и без случайного создания через `[]`!).
4. `show` печатает предметы по алфавиту и общее число вещей.

**Бонус:** `std::vector<std::string>` с историей последних 5 действий, команда `log`.

<details>
<summary>Подсказка</summary>

Проверка наличия без создания: `auto it = bag.find(name); if (it == bag.end()) …`. Удаление: `bag.erase(it);`.

</details>
```

## Закрепление прошлых тем

Три вопроса из тем 3–5:

```quiz
В: Тема 5. Что вернёт `s.find("кот")`, если подстроки нет?
+ `std::string::npos`
- `-1`
- `0`
= `find` никогда не возвращает `-1`: «не нашлось» — это особое значение `npos`. Сравнивай только с ним.

В: Тема 4. Функция `void add(std::vector<int> v, int x) { v.push_back(x); }`. Что будет с вектором вызывающего?
+ Не изменится — функция получила копию
- В нём появится `x`
- Ошибка компиляции
= Параметр без `&` — копия. Чтобы менять вектор снаружи, нужно `std::vector<int> &v`.

В: Тема 3. `for (std::size_t i = v.size() - 1; i >= 0; --i)` — что не так?
+ Цикл бесконечный: беззнаковое `i` никогда не станет меньше нуля
- Всё верно — это обход с конца
- Пропустит последний элемент
= После `0` беззнаковое `--i` даёт огромное число, условие `i >= 0` всегда истинно. Обход с конца: `for (std::size_t i = v.size(); i > 0; --i)` и `v[i - 1]`.
```

> **Теперь потренируйся.** Теория освоена — закрепи её на задачах: [→ Задачник, тема 6. Контейнеры](../zadachnik/06-konteynery.md). Начни с 6.1 «Массив наоборот» и 6.2 «Сколько различных» (обе 🟢).

---

[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md) · [Маршрут изучения](../00-marshrut.md) · [← Строки](05-stroki.md) · [Алгоритмы →](07-algoritmy.md)
