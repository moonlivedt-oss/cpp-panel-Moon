# Контейнеры: vector, map, set, pair

> Список чего-нибудь, поиск по имени, «а это уже было?», таблицы
>
> Это разделы 11–16 справочника. Нумерация сквозная во всех файлах: ссылка «см. [раздел 18](07-algoritmy.md#18-алгоритмы)» ведёт в [Итераторы и алгоритмы](07-algoritmy.md), а полный список — в [оглавлении](../00-НАЧНИ-ОТСЮДА.md).

[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md) · [← Строки](05-stroki.md) · [Итераторы и алгоритмы →](07-algoritmy.md) · [Примеры программ](../examples/README.md)

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
<img src="data:image/png;base64,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" alt="Схема: как растёт вектор — size и capacity">
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

---

## 12. Словарь `std::map`

```diagram
# Словарь `map`: по ключу слева находим значение справа
<img src="data:image/png;base64,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" alt="Схема: словарь map — ключ ведёт к значению">
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
```

Предскажи вывод — ловушка `[]` при чтении:

```challenge
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
@type run
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

[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md) · [← Строки](05-stroki.md) · [Итераторы и алгоритмы →](07-algoritmy.md) · [Примеры программ](../examples/README.md)
