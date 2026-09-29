# Итераторы и алгоритмы

> Что такое `v.begin()`, `sort`, `count_if` вместо ручного цикла
>
> Это разделы 17–18 справочника. Нумерация сквозная во всех файлах: ссылка «см. [раздел 18](#18-алгоритмы)» ведёт в [Итераторы и алгоритмы](07-algoritmy.md), а полный список — в [оглавлении](../00-НАЧНИ-ОТСЮДА.md).

**Уровень:** 🟡 нужна база · **Опирается на:** [Контейнеры](06-konteynery.md), [Функции](04-funkcii.md)

[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md) · [Маршрут изучения](../00-marshrut.md) · [← Контейнеры](06-konteynery.md) · [struct, математика, файлы →](08-struct-fayly.md)

---

> Определения функций этой темы (`sort`, `count_if`, `accumulate`) — коротко в [Словаре функций](10a-slovar-funkcij.md#тема-7-алгоритмы).

## Что в этом файле

- [За 30 секунд](#за-30-секунд)
- **[17. Итераторы — на пальцах](#17-итераторы--на-пальцах)**
  - [Зачем это знать, если есть range-for](#зачем-это-знать-если-есть-range-for)
  - [Ручной обход итератором](#ручной-обход-итератором)
- **[18. Алгоритмы](#18-алгоритмы)**
  - [Базовый набор](#базовый-набор)
  - [Со своим правилом — через лямбду](#со-своим-правилом--через-лямбду)
  - [Ещё несколько нужных алгоритмов](#ещё-несколько-нужных-алгоритмов)
  - [Сортировка структур](#сортировка-структур)
  - [`stable_sort`: сохранить порядок равных](#stable_sort-сохранить-порядок-равных)
  - [Поиск максимума по полю](#поиск-максимума-по-полю)
  - [Сумма по полю](#сумма-по-полю)
  - [Что чем заменяется](#что-чем-заменяется)
  - [Как оценить скорость: `O(1)`, `O(log n)`, `O(n)`, `O(n²)`](#как-оценить-скорость-o1-olog-n-on-on²)
- **[Рецепты: хочу X → вот код](#рецепты-хочу-x--вот-код)**
- **[Проверь себя](#проверь-себя)**
- **[Закрепление прошлых тем](#закрепление-прошлых-тем)**

---


### За 30 секунд

- Итератор — «закладка» на элемент: `*it` — значение, `++it` — следующий, `v.end()` — «за последним», не элемент.
- Алгоритмы берут диапазон `(v.begin(), v.end())` и заменяют ручные циклы.
- `std::sort` — сортировка, `std::find` — поиск, `std::count_if` — «сколько подходит», `std::max_element` — максимум (со звёздочкой: `*std::max_element(…)`).
- Своё правило — лямбда: `[](int a, int b) { return a > b; }`.
- Повторы убирают тройкой `sort` → `unique` → `erase`.

```cpp
std::sort(v.begin(), v.end());                                    // по возрастанию
int big = *std::max_element(v.begin(), v.end());                  // максимум
auto neg = std::count_if(v.begin(), v.end(), [](int x) { return x < 0; });
v.erase(std::unique(v.begin(), v.end()), v.end());                // убрать повторы (после sort)
```

Если совсем с нуля: **алгоритмы** стандартной библиотеки — готовые операции над данными: отсортировать, найти, посчитать. Вместо цикла руками зовёшь `std::sort`, `std::count_if` и подобные — короче и меньше мест для ошибки.

## 17. Итераторы — на пальцах

```diagram
# Итератор — «закладка» на элемент; `end()` — сразу за последним
<img src="data:image/webp;base64,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" alt="Схема: итератор — закладка на элемент, end за последним">
```

**На схеме:** маркер-закладка стоит на элементе (`*it` — значение под ней, `++it` — сдвиг вправо). Второй маркер — `end()`: он за последним элементом, сам элементом не является и разыменовывать его нельзя.

Итератор — это **закладка**, указывающая на элемент контейнера.

```cpp
std::vector<int> v = {10, 20, 30};

auto it = v.begin();             // закладка на ПЕРВЫЙ элемент
std::cout << *it << "\n";        // → 10   * = «дай значение под закладкой»

++it;                            // сдвинули закладку на следующий
std::cout << *it << "\n";        // → 20

it = v.end();                    // закладка ЗА последним — это НЕ элемент
std::cout << *it;                // ❌ разыменовывать end() нельзя
```

```
   v = [ 10 ][ 20 ][ 30 ]
         ↑                ↑
      begin()           end()   ← указывает за последний, а не на него
```

<details>
<summary>Копнуть глубже: почему `end()` за последним и почему это удобно</summary>

Пара `begin()`…`end()` задаёт **полуоткрытый** промежуток `[begin, end)`: первый элемент включён, а `end()` — граница «за последним», сама в диапазон не входит. Такая договорённость убирает возню с краями: пустой контейнер — это просто `begin() == end()` (нулевой диапазон, без особого случая), а цикл всегда пишется одинаково — `while (it != end())`. И ещё глубже: итератор — это **обобщённый указатель**. У вектора `++it` буквально сдвигает «закладку» на соседнюю ячейку непрерывной памяти, у `map` — переходит к следующему узлу дерева, у `set` — тоже; но снаружи все они выглядят одинаково (`*it`, `++it`, `it != end()`). Именно поэтому один и тот же `std::sort` или `std::find` работает с любым подходящим контейнером: алгоритм не знает, что под итератором, — он лишь двигает закладку и разыменовывает её.

</details>

### Зачем это знать, если есть range-for

**1. Алгоритмы говорят на этом языке.**

```cpp
std::sort(v.begin(), v.end());        // «отсортируй от начала до конца»
std::sort(v.begin(), v.begin() + 3);  // можно и часть: только первые три
```

**2. `find` возвращает итератор, и сравнение с `end()` — способ сказать «не нашлось».**

```cpp
auto it = std::find(v.begin(), v.end(), 20);

if (it == v.end()) {
  std::cout << "нет числа 20\n";
} else {
  std::cout << "значение: " << *it << "\n";              // → значение: 20
  std::cout << "позиция: " << (it - v.begin()) << "\n";  // → позиция: 1
}
```

**3. Звёздочка у `max_element` — не магия, а разыменование.**

```cpp
auto it = std::max_element(v.begin(), v.end());   // возвращает ЗАКЛАДКУ на максимум
std::cout << *it << "\n";                         // → 30   значение
std::cout << (it - v.begin()) << "\n";            // → 2    позиция максимума

std::cout << std::max_element(v.begin(), v.end());  // ❌ без * не соберётся:
                                                    //    error: no match for 'operator<<'
```

Итератор — это закладка, а не число, и печатать его `std::cout` не умеет. Отсюда длинная ошибка про `operator<<` с непонятным типом `__normal_iterator` — её лечит одна звёздочка.

**4. У `map` итератор указывает на пару.**

```cpp
std::map<std::string, int> ages = {{"Аня", 21}};

auto it = ages.find("Аня");
if (it != ages.end()) {
  std::cout << it->first << "\n";     // → Аня   ключ    (сокращение от (*it).first)
  std::cout << it->second << "\n";    // → 21    значение
  it->second = 22;                    // значение можно менять прямо через итератор
}
```

### Ручной обход итератором

```cpp
for (auto it = v.begin(); it != v.end(); ++it)     // то же, что range-for, только руками
  std::cout << *it << " ";                         // → 10 20 30

for (auto it = v.rbegin(); it != v.rend(); ++it)   // r = reverse, обход с конца
  std::cout << *it << " ";                         // → 30 20 10
```

Ручной обход нужен редко: когда надо удалять по ходу или идти нестандартным шагом.

> **C++20 даёт короткую форму без `begin()/end()`:** `std::ranges::sort(v);`, `std::ranges::find(v, 42);`, `std::ranges::count(v, 5);`. Работает и читается лучше. Но в учебниках и на форумах ты будешь видеть классику с двумя итераторами — знать надо обе.

---

## 18. Алгоритмы

Прежде чем писать цикл, проверь: возможно, это уже написано. Всё ниже — из `<algorithm>`, кроме `accumulate` (`<numeric>`).

### Базовый набор

```cpp
#include <algorithm>
#include <numeric>

std::vector<int> v = {5, 3, 9, 1};

std::sort(v.begin(), v.end());                     // → 1 3 5 9   по возрастанию
std::sort(v.begin(), v.end(), std::greater<>());   // → 9 5 3 1   по убыванию (<functional>)
std::reverse(v.begin(), v.end());                  // перевернуть

auto count5 = std::count(v.begin(), v.end(), 5);   // сколько раз встречается 5
auto it = std::find(v.begin(), v.end(), 9);        // итератор на первую 9 или end()

std::cout << *std::max_element(v.begin(), v.end());   // → 9   максимум
std::cout << *std::min_element(v.begin(), v.end());   // → 1   минимум

std::cout << std::max(3, 7);          // → 7   максимум из двух значений
std::cout << std::min(3, 7);          // → 3

int a = 1, b = 2;
std::swap(a, b);                      // теперь a = 2, b = 1

long long total = std::accumulate(v.begin(), v.end(), 0LL);   // сумма
```

<details>
<summary>Разбор: как читать вызовы алгоритмов</summary>

Почти все алгоритмы берут **пару итераторов** `v.begin(), v.end()` — «обработай от начала до конца» (можно и часть: `v.begin(), v.begin() + 3`).

- **`std::sort(v.begin(), v.end())`** — отсортировать по возрастанию прямо в векторе. Третий аргумент (`std::greater<>()` или лямбда) задаёт своё правило.
- **`std::count(v.begin(), v.end(), 5)`** — сколько раз встречается `5`.
- **`std::find(v.begin(), v.end(), 9)`** — вернуть **закладку** (итератор) на первую `9` или `v.end()`, если не нашлось.
- **`std::max_element(…)` / `std::min_element(…)`** — тоже возвращают закладку, поэтому значение достают звёздочкой: `*std::max_element(…)`.
- **`std::swap(a, b)`** — обменять два значения местами.
- **`std::accumulate(v.begin(), v.end(), 0LL)`** — сумма всех элементов; `0LL` — стартовое значение и тип (см. заметку ниже).

Итог: `sort`, `find`, `count`, `max_element`, `accumulate` — этими пятью закрывается большинство задач.

</details>

> **`0LL`, а не `0`.** Начальное значение задаёт тип, в котором идёт сложение. С `0` сумма считается в `int` и молча переполняется на больших данных.

```badgood
Ручной цикл | Готовый алгоритм
int best = v[0];
for (std::size_t i = 1; i < v.size(); ++i)
  if (v[i] > best)
    best = v[i];

int positives = 0;
for (int x : v)
  if (x > 0) ++positives;
---
int best = *std::max_element(v.begin(), v.end());

auto positives = std::count_if(v.begin(), v.end(),
    [](int x) { return x > 0; });

// имя алгоритма говорит, ЧТО делаем,
// а цикл — только КАК
```

### Со своим правилом — через лямбду

Лямбда отвечает на вопрос алгоритма. Для `sort` вопрос звучит «первый должен идти раньше второго?», для `count_if` — «этот элемент подходит?».

```cpp
std::vector<int> v = {5, 3, 9, 1, 8};

// Сортировка по своему правилу
std::sort(v.begin(), v.end(),
          [](int a, int b) { return a > b; });        // «a раньше b, если a больше»
// → 9 8 5 3 1

// Сколько подходит под условие
auto evens = std::count_if(v.begin(), v.end(),
                           [](int x) { return x % 2 == 0; });
std::cout << evens;                                   // → 1   (только 8)

// Первый подходящий
auto it = std::find_if(v.begin(), v.end(),
                       [](int x) { return x > 4; });
if (it != v.end())
  std::cout << *it;                                   // → 9

// Есть ли хоть один / все ли подходят / ни одного
bool anyNegative = std::any_of(v.begin(), v.end(), [](int x) { return x < 0; });   // → 0
bool allPositive = std::all_of(v.begin(), v.end(), [](int x) { return x > 0; });   // → 1
bool noneZero   = std::none_of(v.begin(), v.end(), [](int x) { return x == 0; });  // → 1
```

```cpp alt: Товары: сначала дешёвые, при равной цене — по имени
struct Item { std::string name; int price; };
std::vector<Item> shop = {{"щит", 30}, {"меч", 50}, {"лук", 30}};
std::sort(shop.begin(), shop.end(), [](const Item &a, const Item &b) {
  return a.price != b.price ? a.price < b.price : a.name < b.name;
});
```

```cpp alt: Сколько студентов сдали
std::vector<int> marks = {5, 2, 4, 3, 2};
auto passed = std::count_if(marks.begin(), marks.end(), [](int m) { return m >= 3; });
std::cout << "Сдали: " << passed << " из " << marks.size() << "\n";
```

**Лови результат в `auto`.** `count_if` возвращает не `int`, а `ptrdiff_t`, и присваивание в `int` даст предупреждение от `-Wconversion`.

### Ещё несколько нужных алгоритмов

**`transform` — применить действие к каждому элементу.** Ручной цикл «пройти и пересчитать» пишется одной строкой:

```cpp
std::vector<int> v = {5, 3, 9, 1};
std::vector<int> doubled(v.size());               // заранее той же длины

std::transform(v.begin(), v.end(), doubled.begin(),
               [](int x) { return x * 2; });      // → doubled = {10, 6, 18, 2}
```

**`unique` — убрать подряд идущие дубликаты.** Важно: только **подряд идущие**, поэтому перед ним почти всегда `sort`:

```cpp
std::vector<int> v = {3, 1, 3, 2, 1, 3};
std::sort(v.begin(), v.end());                       // → 1 1 2 3 3 3
v.erase(std::unique(v.begin(), v.end()), v.end());   // → 1 2 3
```

<details>
<summary>Разбор: почему `unique` идёт в паре с `erase`</summary>

Строка `v.erase(std::unique(v.begin(), v.end()), v.end());` делает два дела:

- **`std::unique(v.begin(), v.end())`** — сдвигает уникальные значения в начало вектора, «схлопывая» подряд идущие дубликаты. Но сам вектор **не укорачивает** — в хвосте остаётся мусор. Возвращает закладку на границу «здесь кончилось полезное».
- **`v.erase(<эта граница>, v.end())`** — отрезает хвост от границы до конца. Вот теперь в векторе только уникальные значения.

Их всегда пишут вместе — это устойчивая идиома «`erase` + `unique`». И обязательно `sort` перед ними: `unique` схлопывает только **соседей**.

</details>

<details>
<summary>Трассировка: unique + erase на {1, 1, 2, 3, 3, 3}</summary>

`unique` идёт по вектору и держит «границу полезного» — куда писать следующее новое значение. Черта `|` — эта граница:

| шаг | читаем | совпадает с последним оставленным? | действие | вектор |
|---|---|---|---|---|
| старт | `v[0] = 1` | — | первый всегда остаётся | `1 ‖ 1 2 3 3 3` |
| 1 | `v[1] = 1` | да | пропустить | `1 ‖ 1 2 3 3 3` |
| 2 | `v[2] = 2` | нет | записать на место 1 | `1 2 ‖ 2 3 3 3` |
| 3 | `v[3] = 3` | нет | записать на место 2 | `1 2 3 ‖ 3 3 3` |
| 4 | `v[4] = 3` | да | пропустить | `1 2 3 ‖ 3 3 3` |
| 5 | `v[5] = 3` | да | пропустить | `1 2 3 ‖ 3 3 3` |

`unique` возвращает итератор на черту, но размер вектора **не меняет**: хвост после черты — что угодно, полагаться на него нельзя. `v.erase(черта, v.end())` отрезает хвост — остаётся `1 2 3`.

</details>


Если пропустить `sort`, `unique` схлопнет только соседей: `{1, 1, 2, 1}` → `{1, 2, 1}`, а не `{1, 2}`. (Убрать дубликаты без сортировки — это `std::set`, см. [раздел 14](06-konteynery.md#14-stdset--только-уникальные).)

**`binary_search` и `lower_bound` — быстрый поиск в отсортированном.** По отсортированному вектору искать можно за `log n` вместо `n` — но данные **обязаны быть отсортированы**, иначе ответ молча неверный:

```cpp
std::vector<int> v = {1, 3, 5, 7, 9};                    // ⚠️ отсортирован!

std::cout << std::binary_search(v.begin(), v.end(), 7);  // → 1   есть ли 7
std::cout << std::binary_search(v.begin(), v.end(), 6);  // → 0   6 нет

auto it = std::lower_bound(v.begin(), v.end(), 6);       // первый элемент >= 6
std::cout << (it - v.begin());                           // → 3   между 5 и 7 — куда вставить, не сломав порядок
```

**`fill` и `iota` — заполнить готовое.** Одинаковым значением или подряд идущими числами:

```cpp
#include <numeric>                     // для iota

std::vector<int> a(5);
std::fill(a.begin(), a.end(), 7);      // → 7 7 7 7 7
std::iota(a.begin(), a.end(), 1);      // → 1 2 3 4 5   (от 1, с шагом +1)
```

> **Про сортированность.** `binary_search`, `lower_bound`, `unique` доверяют, что данные упорядочены, и **не проверяют** этого. На неотсортированном они не ругаются — просто врут. Правило: раз в коде появился один из них, рядом должен быть `sort` (или уверенность, что данные и так по порядку).

### Сортировка структур

```cpp
struct Student {
  std::string name;
  int score = 0;
};

std::vector<Student> group = {{"Аня", 95}, {"Борис", 70}, {"Вика", 88}};

// По баллу, по убыванию
std::sort(group.begin(), group.end(),
          [](const Student &a, const Student &b) { return a.score > b.score; });
// → Аня(95), Вика(88), Борис(70)

// По имени, по алфавиту
std::sort(group.begin(), group.end(),
          [](const Student &a, const Student &b) { return a.name < b.name; });
// → Аня, Борис, Вика

// Сначала по баллу, при равенстве — по имени
std::sort(group.begin(), group.end(),
          [](const Student &a, const Student &b) {
            if (a.score != b.score)          // основной критерий
              return a.score > b.score;
            return a.name < b.name;          // запасной, когда баллы равны
          });

// Топ-3 — просто первые три после сортировки
for (std::size_t i = 0; i < 3 && i < group.size(); ++i)     // ⚠️ && i < size() — защита
  std::cout << group[i].name << " ";
```

### `stable_sort`: сохранить порядок равных

Обычный `std::sort` **не обещает** сохранить взаимный порядок элементов, у которых ключ сортировки одинаковый — двух студентов с равным баллом он может поставить как угодно. Когда это важно (список уже упорядочен по одному признаку, а ты сортируешь по другому), бери `std::stable_sort`:

```cpp
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

struct Student {
  std::string name;
  int score = 0;
};

int main() {
  // Ввели в этом порядке (например, по времени сдачи):
  std::vector<Student> group = {{"Аня", 90}, {"Вика", 75}, {"Борис", 90}};

  std::stable_sort(group.begin(), group.end(),
                   [](const Student &a, const Student &b) { return a.score > b.score; });
  // Балл по убыванию; у Ани и Бориса он равный (90) — stable_sort сохраняет
  // их во ВХОДНОМ порядке: сначала Аня, потом Борис.

  for (const auto &s : group)
    std::cout << s.name << "(" << s.score << ") ";   // → Аня(90) Борис(90) Вика(75)
  return 0;
}
```

Приём «отсортировать по второму ключу `stable_sort`-ом, сохранив первый» заменяет составное правило сравнения, когда критериев много. `stable_sort` чуть медленнее и требует немного памяти — на учебных данных разницы нет.

> Нужны не все отсортированные, а лишь **несколько лучших** — полную сортировку можно не делать: `std::partial_sort` доводит до порядка только начало диапазона, а `std::nth_element` просто ставит на место элемент нужного ранга (медиану, топ-k-й). На больших данных это заметно быстрее; на маленьких хватает `sort`.

### Поиск максимума по полю

```cpp
auto best = std::max_element(group.begin(), group.end(),
                             [](const Student &a, const Student &b) {
                               return a.score < b.score;    // ⚠️ для max_element — именно <
                             });
std::cout << best->name << " " << best->score;    // → Аня 95
```

```cpp alt: Самый опасный монстр в волне
struct Monster { std::string name; int atk; };
std::vector<Monster> wave = {{"гоблин", 2}, {"дракон", 15}, {"скелет", 4}};
auto boss = std::max_element(wave.begin(), wave.end(),
    [](const Monster &a, const Monster &b) { return a.atk < b.atk; });
std::cout << boss->name << "\n";   // дракон
```

```cpp alt: Самый дешёвый рейс
struct Flight { std::string to; int price; };
std::vector<Flight> list = {{"Казань", 4200}, {"Сочи", 6100}, {"Пермь", 3900}};
auto cheap = std::min_element(list.begin(), list.end(),
    [](const Flight &a, const Flight &b) { return a.price < b.price; });
std::cout << cheap->to << " за " << cheap->price << "\n";
```

### По шагам: как `max_element` ищет максимум

Внутри `std::max_element` — обычный цикл «помню лучшего и сравниваю с каждым». Вот он вручную:

```steps
@id cjguh53
# Ищем максимум в {4, 9, 2, 9, 7}
std::vector<int> v = {4, 9, 2, 9, 7};
int best = 0;
for (int i = 1; i < (int)v.size(); ++i)
    if (v[i] > v[best])
        best = i;
std::cout << "max " << v[best] << " at " << best;
---
1 | v=[4, 9, 2, 9, 7] | Пять чисел.
2 | best=0 | Считаем лучшим **первый** элемент (индекс 0, значение 4). Не 0 как значение — именно индекс!
3 | i=1 | Начинаем сравнение со второго.
4 | | v[1] = 9 > v[0] = 4 — да.
?5 | best=1 | Новый лучший — индекс 1.
3 | i=2 |
4 | | v[2] = 2 > 9? Нет, лучший не меняется.
3 | i=3 |
4 | | v[3] = 9 > 9? **Нет** — строго больше. Поэтому при равных остаётся **первый** максимум, как и у `max_element`.
3 | i=4 |
4 | | 7 > 9? Нет.
3 | i=5 | 5 < 5 — ложь, цикл окончен.
6 | i=— | Печатаем. | max 9 at 1
```

### Сумма по полю

```cpp
int totalScore = std::accumulate(group.begin(), group.end(), 0,
                                 [](int sum, const Student &s) {   // накопитель + элемент
                                   return sum + s.score;           // возвращаем новый накопитель
                                 });
std::cout << totalScore;         // → 253
```

### Что чем заменяется

| Ручной цикл | Алгоритм |
|---|---|
| перебрать и найти максимум | `std::max_element` |
| посчитать, сколько подходит | `std::count_if` |
| найти первый подходящий | `std::find_if` |
| сложить всё | `std::accumulate` |
| проверить «есть ли хоть один» | `std::any_of` |
| отсортировать | `std::sort` |
| убрать подходящие | `std::erase_if` (C++20; старая идиома — `remove_if` + `erase`) |
| перевернуть | `std::reverse` |

Написать сортировку руками полезно **один раз**, чтобы понять устройство. Дальше — `std::sort`: и быстрее, и читается с первого взгляда.

### Как оценить скорость: `O(1)`, `O(log n)`, `O(n)`, `O(n²)`

Запись `O(…)` («о большое») отвечает на один вопрос: **во сколько раз больше работы, если данных стало больше?** Точное время она не обещает — только то, как оно растёт. `n` — сколько элементов.

| Запись | На пальцах | Шагов при n = 1 000 | При n = 1 000 000 | Примеры |
|---|---|---|---|---|
| `O(1)` | не зависит от размера | 1 | 1 | `v[i]`, `v.size()`, `v.push_back(x)`, поиск в `unordered_map` (в среднем) |
| `O(log n)` | делим пополам, пока не найдём | ~10 | ~20 | поиск в `map` и `set`, `binary_search` в отсортированном |
| `O(n)` | пройти каждого один раз | 1 000 | 1 000 000 | цикл по вектору, `std::find`, `count_if`, `max_element` |
| `O(n log n)` | хорошая сортировка | ~10 000 | ~20 000 000 | `std::sort` |
| `O(n²)` | каждого сравнить с каждым | 1 000 000 | 1 000 000 000 000 | цикл в цикле, `find` внутри цикла |

Ориентир: обычный компьютер делает порядка **сотен миллионов** простых шагов в секунду. Отсюда правило:

- до миллиона элементов `O(n)` и `O(n log n)` — мгновенно;
- `O(n²)` при n = 1 000 — ещё мгновенно, при n = 100 000 — уже секунды, при миллионе — часы.

Как узнать сложность своего кода — посмотри на **вложенность циклов**: один цикл по данным — `O(n)`, цикл в цикле — `O(n²)`. Прячутся циклы и в вызовах: `std::find`, `std::count`, `v.erase(v.begin())` — сами по себе `O(n)`, и внутри цикла дают `O(n²)`.

Пример — «есть ли в векторе повторы?» — тремя способами:

```cpp
// O(n²): каждый с каждым
bool hasDupSlow(const std::vector<int> &v) {
  for (std::size_t i = 0; i < v.size(); ++i)
    for (std::size_t j = i + 1; j < v.size(); ++j)
      if (v[i] == v[j]) return true;
  return false;
}

// O(n log n): отсортировать копию — одинаковые окажутся рядом
bool hasDupSort(std::vector<int> v) {
  std::sort(v.begin(), v.end());
  return std::adjacent_find(v.begin(), v.end()) != v.end();
}

// O(n log n): складывать в set — insert скажет, что такое уже было
bool hasDupSet(const std::vector<int> &v) {
  std::set<int> seen;
  for (int x : v)
    if (!seen.insert(x).second) return true;
  return false;
}
```

На учебных данных из десятка чисел разницы не будет — пиши самый понятный вариант. Думать про `O(…)` стоит, когда данных тысячи и больше или когда программа вдруг «задумалась»: первым делом ищи цикл в цикле.

**Живой пример:** сколько сравнений делает проверка «есть ли повторы» каждый с каждым — и сколько работы у `std::set`.

```live
@N = 10 [2..2000 step 2]
---
// каждый с каждым: O(n²)
for (int i = 0; i < {N}; ++i)
    for (int j = i + 1; j < {N}; ++j)
        if (v[i] == v[j]) return true;
---
сравнений в худшем случае: {N*(N-1)/2}
вставок в std::set вместо этого: {N}
```

```challenge
@id c1n524av
@type run
@hint Храни пары `std::pair<std::string, int>` или `struct { std::string name; int score; }` в векторе.
@hint Правило для `std::sort`: `a.score != b.score ? a.score > b.score : a.name < b.name`.
Отсортируй студентов: по баллам от большего к меньшему, при равных баллах — по имени по алфавиту. Вход: `n`, потом `n` пар «имя баллы». Вывод: имена через пробел.
---
#include <iostream>
#include <string>
#include <vector>

int main() {
    int n = 0;
    std::cin >> n;
    // твой код: прочитать, отсортировать, напечатать имена
}
---
3 Bob 70 Ann 90 Cid 70 => Ann Bob Cid
2 Zed 5 Amy 5 => Amy Zed
1 Solo 1 => Solo
---
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

struct Student { std::string name; int score = 0; };

int main() {
    int n = 0;
    std::cin >> n;
    std::vector<Student> v(static_cast<std::size_t>(n));
    for (Student &s : v) std::cin >> s.name >> s.score;
    std::sort(v.begin(), v.end(), [](const Student &a, const Student &b) {
        return a.score != b.score ? a.score > b.score : a.name < b.name;
    });
    for (std::size_t i = 0; i < v.size(); ++i) std::cout << (i ? " " : "") << v[i].name;
    std::cout << "\n";
}
```

## Рецепты: хочу X → вот код

Ищешь не функцию, а решение задачи — начни отсюда.

- **Отсортировать по убыванию** — `std::sort(v.begin(), v.end(), std::greater<int>());`. → [базовый набор](#базовый-набор)
- **Максимум / минимум** — `*std::max_element(v.begin(), v.end())`
- **Сколько элементов подходит** — `std::count_if(v.begin(), v.end(), [](int x) { return x > 0; })`. → [лямбда](#со-своим-правилом--через-лямбду)
- **Есть ли элемент** — `std::find(v.begin(), v.end(), x) != v.end()`
- **Убрать повторы** — `std::sort(…); v.erase(std::unique(v.begin(), v.end()), v.end());`. → [unique](#ещё-несколько-нужных-алгоритмов)
- **Сумма** — `std::accumulate(v.begin(), v.end(), 0)` (`<numeric>`)
- **Отсортировать структуры по полю** — `std::sort(…, [](const S &a, const S &b) { return a.score > b.score; });`. → [структуры](#сортировка-структур)
- **Понять, быстро ли будет** — посчитай вложенность циклов: цикл в цикле — `O(n²)`. → [скорость](#как-оценить-скорость-o1-olog-n-on-on²)

---

## Проверь себя

Небольшой разбор по теме. Нажми вариант — сразу увидишь, верно или нет; можно и просто «Показать ответ».

```quiz
В: Как отсортировать `std::vector v` по возрастанию?
+ `std::sort(v.begin(), v.end())`
- `v.sort()`
- `std::order(v)`
= `std::sort` принимает пару итераторов начала и конца.

В: Как отсортировать по УБЫВАНИЮ?
+ передать компаратор `[](int a, int b){ return a > b; }`
- `std::sort(...).reverse()`
- `std::rsort(...)`
= Своё правило сравнения задаётся лямбдой (или сортируют по возрастанию и переворачивают).

В: Зачем `*` в `*std::max_element(v.begin(), v.end())`?
+ `max_element` возвращает итератор, `*` берёт значение
- `*` здесь умножение
- чтобы получить указатель на копию
= Алгоритмы возвращают итератор (позицию); значение достаётся разыменованием `*`.

В: Чем посчитать, сколько элементов удовлетворяют условию?
+ `std::count_if(begin, end, предикат)`
- `std::count(begin, end)`
- только ручным циклом
= `count_if` считает по предикату-лямбде; `count` — по конкретному значению.

В: `std::accumulate(v.begin(), v.end(), 0)` при больших суммах рискует…
+ переполнением: стартовое `0` — это `int`; нужно `0LL`
- ничем
- потерей точности
= Тип аккумулятора берётся от начального значения. Для больших сумм — `0LL` (long long).

В: Что возвращает `std::sort`?
+ ничего — сортирует диапазон на месте
- новый отсортированный вектор
- итератор на середину
= `sort` меняет сам диапазон; отдельного результата нет.
```

А теперь код — найди ошибку сам, потом сверься:

```findbug
std::vector<int> v = {3, 1, 2};
int mx = std::max_element(v.begin(), v.end());   // хотим максимум
std::cout << mx;
---
`max_element` возвращает ИТЕРАТОР, а не число. Забыт `*`: правильно `int mx = *std::max_element(v.begin(), v.end());` — иначе итератор не приведётся к `int`.
```

И «заполни пропуск» — впиши недостающее и нажми «Проверить»:

```fillcode
// сумма больших чисел без переполнения:
// начальное значение задаёт тип, в котором идёт сложение
long long total = std::accumulate(v.begin(), v.end(), [[0LL]]);
```

Карточки на повторение — вспомни ответ сам, потом проверь и отметь, насколько было легко (панель напомнит повторить позже):

```cards
Q: Зачем `*` в `*std::max_element(...)`?
A: алгоритм возвращает итератор (позицию); `*` достаёт из него значение.

Q: Чем опасен `std::accumulate(v.begin(), v.end(), 0)`?
A: стартовое `0` — это `int`, сумма может переполниться. Бери `0LL`.

Q: Что такое диапазон `[begin, end)`?
A: полуоткрытый: `begin()` включён, `end()` — за последним. Пустой контейнер: `begin() == end()`.

Q: Почему один `std::sort` работает и с вектором, и с частью массива?
A: он говорит на языке итераторов — двигает «закладку» и разыменовывает, не зная, что под ней.

Q: Что вернёт `std::count_if(v.begin(), v.end(), [](int x) { return x > 0; })`?
A: Количество элементов, для которых условие вернуло `true`, — здесь количество положительных.

Q: Как найти элемент в векторе и понять, что его нет?
A: `auto it = std::find(v.begin(), v.end(), x);` Если `it == v.end()` — не нашли; иначе позиция — `it - v.begin()`.

Q: Что нужно сделать перед `std::binary_search`?
A: Отсортировать диапазон: бинарный поиск работает только на упорядоченных данных, зато за O(log n).

Q: Как отсортировать людей по возрасту?
A: `std::sort(v.begin(), v.end(), [](const Person &a, const Person &b) { return a.age < b.age; });` — компаратор отвечает на вопрос «идёт ли `a` раньше `b`?».

Q: Зачем после `std::unique` вызывают `erase`?
A: `unique` только сдвигает неповторяющиеся элементы в начало и возвращает новый конец, «хвост» остаётся. `v.erase(it, v.end())` его отрезает. Работает на отсортированном векторе.
H: `unique` не умеет менять размер вектора.

Q: Что делает `std::reverse(s.begin(), s.end())`?
A: Разворачивает диапазон на месте: `"abc"` становится `"cba"`. Работает и со строкой, и с вектором.
```

Собери из строк:

```challenge
@id chlg41o
@type parsons
Собери сортировку учеников по убыванию баллов и печать имён.
---
struct Student { std::string name; int score = 0; };
std::vector<Student> group = {{"Аня", 90}, {"Борис", 75}, {"Вера", 82}};
std::sort(group.begin(), group.end(),
          [](const Student &a, const Student &b) {
              return a.score > b.score;
          });
for (const auto &s : group) std::cout << s.name << " ";
```

Предскажи вывод — `unique` без `sort`:

```challenge
@id c1fc8pe0
@type predict
Что напечатает программа? (через пробел)
---
std::vector<int> v = {1, 1, 2, 1, 3, 3};
v.erase(std::unique(v.begin(), v.end()), v.end());
for (int x : v) std::cout << x << " ";
---
1 2 1 3
```

> **Сквозной проект «Подземелье», квест 7:** [Таблица рекордов](../proekt/03-glava-2-dannye.md#квест-7-таблица-рекордов) — добавьте в свою игру то, что выучили в этой теме.

## Босс темы

```boss
# Таблица лидеров
@id cjsh6x6
Вектор игроков (`struct Player { std::string name; int score; };`) — и всё про него **алгоритмами**, без ручных циклов поиска.

1. Отсортировать по очкам по убыванию; при равенстве — по имени (`std::sort` с лямбдой).
2. Напечатать топ-3 (аккуратно, если игроков меньше трёх).
3. Найти игрока по имени (`std::find_if`) и сказать, какое у него место.
4. Средний счёт (`std::accumulate`) и сколько игроков выше среднего (`std::count_if`).

<details>
<summary>Подсказка</summary>

Место = `it - players.begin() + 1`. Для топа: `std::min<std::size_t>(3, players.size())`.

</details>
```

## Закрепление прошлых тем

Три вопроса из тем 4–6:

```quiz
В: Тема 6. Что сделает `if (m["Вера"] > 0)` для `std::map<std::string, int> m`, где Веры нет?
+ Создаст запись «Вера → 0» и вернёт ложь
- Просто вернёт ложь, ничего не меняя
- Бросит исключение
= `[]` при чтении добавляет отсутствующий ключ. Проверять — через `m.contains("Вера")` или `m.find`.

В: Тема 4. Что такое `[](int x) { return x > 0; }`?
+ Лямбда — безымянная функция, которую можно передать в алгоритм
- Массив из одного элемента
- Объявление указателя
= `[]` — захват, `(int x)` — параметры, `{ … }` — тело. Именно такие функции ждут `count_if`, `find_if`, `sort`.

В: Тема 5. Как проверить, что в строке `s` есть слово «кот»?
+ `s.find("кот") != std::string::npos`
- `s.find("кот") != -1`
- `s.find("кот") > 0`
= `find` возвращает `npos`, если не нашёл. `> 0` пропустит находку в самом начале (позиция `0`).
```

> **Теперь потренируйся.** Теория освоена — закрепи её на задачах: [→ Задачник, тема 7. Итераторы и алгоритмы](../zadachnik/07-algoritmy.md). Начни с 7.1 «Отсортировать по возрастанию» 🟢 и 7.6 «Минимум и максимум одной строкой» 🟢.

---

[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md) · [Маршрут изучения](../00-marshrut.md) · [← Контейнеры](06-konteynery.md) · [struct, математика, файлы →](08-struct-fayly.md)
