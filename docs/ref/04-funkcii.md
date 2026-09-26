# Функции

> Как передать аргумент, лямбды, `std::optional`
>
> Это [раздел 9](#9-функции) справочника. Нумерация сквозная во всех файлах: ссылка «см. [раздел 18](07-algoritmy.md#18-алгоритмы)» ведёт в [Итераторы и алгоритмы](07-algoritmy.md), а полный список — в [оглавлении](../00-НАЧНИ-ОТСЮДА.md).

**Уровень:** 🟡 нужна база · **Опирается на:** [Логика и циклы](03-logika-cikly.md)

[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md) · [← Арифметика, логика, ветвления, циклы](03-logika-cikly.md) · [Строки →](05-stroki.md) · [Примеры программ](../examples/README.md)

---

> Определения функций этой темы (ссылки, лямбда, `auto`) — коротко в [Словаре функций](10a-slovar-funkcij.md#тема-4-функции).

## Что в этом файле

- [За 30 секунд](#за-30-секунд)
- **[9. Функции](#9-функции)**
  - [Из чего состоит функция](#из-чего-состоит-функция)
  - [Три способа передать аргумент](#три-способа-передать-аргумент)
  - [Ссылка вместо возврата — когда это уместно](#ссылка-вместо-возврата--когда-это-уместно)
  - [Значения по умолчанию](#значения-по-умолчанию)
  - [Перегрузка: одно имя, разные аргументы](#перегрузка-одно-имя-разные-аргументы)
  - [Возврат нескольких значений](#возврат-нескольких-значений)
  - [`std::optional` — когда ответа может не быть](#stdoptional--когда-ответа-может-не-быть)
  - [Лямбда — безымянная функция на месте](#лямбда--безымянная-функция-на-месте)
  - [Функция как аргумент (колбэк)](#функция-как-аргумент-колбэк)
  - [Стек вызовов: «как я сюда попал»](#стек-вызовов-как-я-сюда-попал)
  - [Рекурсия — функция вызывает саму себя](#рекурсия--функция-вызывает-саму-себя)
  - [`constexpr`-функции: вычисления на этапе компиляции](#constexpr-функции-вычисления-на-этапе-компиляции)
  - [Как понять, что функцию пора выделить](#как-понять-что-функцию-пора-выделить)
- **[Рецепты: хочу X → вот код](#рецепты-хочу-x--вот-код)**
- **[Мини-проект: меню из функций](#мини-проект-меню-из-функций)**
- **[Проверь себя](#проверь-себя)**
- **[Закрепление прошлых тем](#закрепление-прошлых-тем)**

---


### За 30 секунд

- Функция — именованный кусок кода: `тип имя(параметры) { … return результат; }`. Без результата — `void`.
- Параметр без `&` — **копия**; `T&` — работа с **оригиналом**; `const T&` — без копии и только для чтения.
- Функция должна быть объявлена **выше** места вызова.
- Вернуть несколько значений — `struct` или `std::pair`; «ответа может не быть» — `std::optional`.
- Лямбда — функция прямо на месте: `[](int x) { return x * 2; }`.

```cpp
int square(int x) { return x * x; }                // вернуть результат
void addOne(int &x) { ++x; }                       // изменить аргумент
int total(const std::vector<int> &v);              // большое — по const&
auto isEven = [](int x) { return x % 2 == 0; };    // лямбда
```

Если совсем с нуля: **функция** — это кусок кода со своим именем: написал один раз — зовёшь сколько угодно. Она принимает данные (параметры) и обычно возвращает результат. Так программа перестаёт быть одной длинной простынёй в `main`.

## 9. Функции

### Из чего состоит функция

```cpp
bool isLeapYear(int year) {          // тип возврата | имя | параметры
  return (year % 400 == 0)           // return отдаёт результат и СРАЗУ выходит
      || (year % 4 == 0 && year % 100 != 0);
}

void printHeader() {                 // void = ничего не возвращает
  std::cout << "=== Отчёт ===\n";
  // return здесь не нужен
}

int main() {
  printHeader();                              // вызов функции без результата
  std::cout << isLeapYear(2024) << "\n";      // → 1
  std::cout << isLeapYear(1900) << "\n";      // → 0  (делится на 100, но не на 400)
}
```

Функция должна быть объявлена **выше** места вызова. Либо ставь её выше `main`, либо пиши прототип:

```cpp
bool isLeapYear(int year);          // прототип: обещание, что функция где-то есть
                                    // ⚠️ точка с запятой, а не тело

int main() {
  std::cout << isLeapYear(2024);    // уже можно вызывать
}

bool isLeapYear(int year) {         // а тело — ниже
  return (year % 400 == 0) || (year % 4 == 0 && year % 100 != 0);
}
```

### Три способа передать аргумент

```diagram
# По значению — копия; ссылка `&` — та же коробка под двумя именами
<img src="data:image/webp;base64,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" alt="Схема: копия против ссылки">
```

**На схеме:** слева — копия: получается вторая, независимая коробка (меняешь одну — другая цела). Справа — ссылка `&`: два имени на одной коробке (меняешь через любое — меняется общий объект).

```cpp
void byValue(int x) {                    // получили КОПИЮ значения
  x = 99;                                // меняем копию...
  std::cout << "внутри: " << x << "\n";  // → внутри: 99   здесь она правда 99
}

void byRef(int &x) {                     // ССЫЛКА на оригинал
  x = 99;                                // меняем сам оригинал
}

void byConstRef(const std::string &s) {  // ссылка, но менять нельзя
  std::cout << s.length();               // читать можно, копии нет
  // s += "!";                           // ❌ error: assignment of read-only reference
}

int main() {
  int a = 5;

  byValue(a);                 // → внутри: 99
  std::cout << a << "\n";     // → 5    снаружи НЕ изменилось: функция трогала копию

  byRef(a);
  std::cout << a << "\n";     // → 99   изменилось: функция работала с оригиналом
}
```

Посмотрите, как это выглядит изнутри — у копии своя «коробка», у ссылки нет:

```steps
@id cna4t9w
# Копия против ссылки
void byValue(int x) {
    x = 99;
}
void byRef(int &x) {
    x = 99;
}
int main() {
    int a = 5;
    byValue(a);
    byRef(a);
    std::cout << a;
}
---
9 | a=5 | В `main` появилась переменная `a`.
10 | | Вызываем `byValue(a)` — значение **копируется** в новый параметр.
1 | x (копия)=5 | Внутри функции своя переменная `x` = 5. С `a` она никак не связана.
2 | x (копия)=99 | Меняем `x`... а `a` по-прежнему 5!
3 | x (копия)=— | Функция закончилась — копия `x` уничтожена. Изменение пропало вместе с ней.
11 | | Вызываем `byRef(a)`. Копии **нет**: `x` — просто второе имя для `a`.
5 | x → a=5 | `x` смотрит прямо на `a`.
?5 | x → a=99, a=99 | Пишем в `x` — на самом деле пишем в `a`.
6 | x → a=— | Функция закончилась. Исчезло только имя `x`, сама `a` осталась — и она 99.
12 | | Печатаем. | 99
```

**Правило выбора:**

| Что передаём | Как | Почему |
|---|---|---|
| `int`, `double`, `bool`, `char` | по значению: `int x` | копия дешевле ссылки |
| `string`, `vector`, `map`, `struct` — только читаем | `const T &x` | копия дорогая, изменение запрещено |
| Что угодно, что надо изменить | `T &x` | функция работает с оригиналом |

### Ссылка вместо возврата — когда это уместно

```cpp
// Функция заполняет вектор, который ей дали
void fillWithSquares(std::vector<int> &v, int n) {   // & — меняем оригинал
  v.clear();                                         // очищаем на всякий случай
  for (int i = 1; i <= n; ++i)
    v.push_back(i * i);
}

std::vector<int> squares;
fillWithSquares(squares, 5);
for (int x : squares)
  std::cout << x << " ";              // → 1 4 9 16 25
```

```cpp
// Но чаще правильнее просто вернуть результат
std::vector<int> makeSquares(int n) {         // возвращаем по значению
  std::vector<int> result;
  for (int i = 1; i <= n; ++i)
    result.push_back(i * i);
  return result;                              // копии НЕ будет — компилятор отдаст напрямую
}

std::vector<int> squares = makeSquares(5);    // ✅ читается лучше первого варианта
```

> Возврат вектора по значению **не копирует** его: компилятор умеет отдавать результат напрямую (RVO/move). Не выдумывай возврат через параметр-ссылку ради «скорости» — код станет хуже, а быстрее не станет.

### Значения по умолчанию

```cpp
void greet(const std::string &name, int times = 1) {   // times можно не передавать
  for (int i = 0; i < times; ++i)
    std::cout << "Привет, " << name << "\n";
}

greet("Аня");        // → Привет, Аня           (times = 1)
greet("Борис", 2);   // → Привет, Борис
                     // → Привет, Борис
```

Параметры со значением по умолчанию идут **последними** — иначе непонятно, что пропущено.

### Перегрузка: одно имя, разные аргументы

```cpp
int maxOf(int a, int b) {                    // версия для целых
  return (a > b) ? a : b;
}

double maxOf(double a, double b) {           // версия для дробных
  return (a > b) ? a : b;
}

std::string maxOf(const std::string &a, const std::string &b) {   // и для строк
  return (a.length() > b.length()) ? a : b;
}

std::cout << maxOf(3, 7) << "\n";            // → 7      выбралась int-версия
std::cout << maxOf(3.5, 7.1) << "\n";        // → 7.1    double-версия
std::cout << maxOf("аб", "абв") << "\n";     // → абв    string-версия
```

Компилятор выбирает версию по типам аргументов. Различаться должны **аргументы**, а не только тип возврата.

### Возврат нескольких значений

```cpp
#include <utility>

// Через pair — когда значения разнородные
std::pair<int, int> divide(int a, int b) {
  return {a / b, a % b};              // частное и остаток
}

auto [quotient, remainder] = divide(17, 5);       // структурные привязки
std::cout << quotient << " " << remainder;        // → 3 2

// Через ссылки — когда значений больше двух
void stats(const std::vector<int> &v, int &min, int &max, double &avg) {
  min = v[0];                        // ⚠️ вектор должен быть непустым
  max = v[0];
  int sum = 0;
  for (int x : v) {
    if (x < min) min = x;
    if (x > max) max = x;
    sum += x;
  }
  avg = static_cast<double>(sum) / static_cast<double>(v.size());
}

int mn = 0, mx = 0;
double av = 0.0;
stats({3, 8, 1, 6}, mn, mx, av);
std::cout << mn << " " << mx << " " << av;        // → 1 8 4.5
```

### `std::optional` — когда ответа может не быть

> **Как надо.** Если ответа может не быть, возвращай `std::optional<T>` и проверяй его перед использованием: `if (auto pos = findFirstNegative(v)) use(*pos);`.

Функция ищет что-то и не находит. Что вернуть? Обычный ход — вернуть `-1` и договориться, что это значит «не нашлось». Договорённость легко забыть, а `-1` иногда бывает и настоящим ответом.

```cpp
// ❌ Так пишут по привычке
int findFirstNegative(const std::vector<int> &v) {
  for (std::size_t i = 0; i < v.size(); ++i)
    if (v[i] < 0)
      return static_cast<int>(i);
  return -1;                       // «не нашлось» — но об этом надо ЗНАТЬ
}

int pos = findFirstNegative(v);
std::cout << v[pos];               // ❌ забыл проверить на -1 → обращение за границы
```

`std::optional<T>` — это «либо значение типа `T`, либо ничего», и «ничего» невозможно не заметить:

```cpp
#include <optional>

std::optional<int> findFirstNegative(const std::vector<int> &v) {
  for (std::size_t i = 0; i < v.size(); ++i)
    if (v[i] < 0)
      return static_cast<int>(i);   // нашли — возвращаем как обычно
  return std::nullopt;              // ✅ не нашли — специальное «пусто»
}
```

```cpp
std::vector<int> v = {5, 3, -2, 8};

auto pos = findFirstNegative(v);
if (pos)                            // optional в условии = «значение есть?»
  std::cout << "Позиция: " << *pos << "\n";   // * достаёт значение
else
  std::cout << "Отрицательных нет\n";
// → Позиция: 2
```

Ещё короче — объявить и проверить одной строкой:

```cpp
if (auto pos = findFirstNegative(v))          // объявили и сразу проверили
  std::cout << "Позиция: " << *pos << "\n";   // внутри if значение точно есть
else
  std::cout << "Отрицательных нет\n";
```

Когда «нет значения» можно заменить чем-то разумным — `value_or`:

```cpp
auto pos = findFirstNegative({1, 2, 3});      // отрицательных нет
std::cout << pos.value_or(-1) << "\n";        // → -1   подставили запасное значение
```

| Выражение | Что делает |
|---|---|
| `if (opt)` | есть ли значение |
| `opt.has_value()` | то же самое, длиннее и понятнее новичку |
| `*opt` | достать значение — **только когда убедился, что оно есть** |
| `opt.value()` | достать значение, но при пустом бросит исключение |
| `opt.value_or(x)` | значение либо `x`, если пусто |
| `std::nullopt` | само «пусто», его и возвращают |

> Главная ошибка — написать `*opt` без проверки: у пустого `optional` это такое же неопределённое поведение, как `v[5]` у короткого вектора. Смысл `optional` не в том, что он защищает сам, а в том, что **тип функции честно сообщает: ответа может не быть.** Пропустить проверку становится трудно, потому что без разыменования значение просто не достать.

### Лямбда — безымянная функция на месте

```cpp
// Обычная функция — если правило нужно во многих местах
bool isEven(int x) { return x % 2 == 0; }

// Лямбда — если правило нужно прямо здесь
auto isOdd = [](int x) { return x % 2 != 0; };    // [] — начало лямбды
std::cout << isOdd(5) << "\n";                    // → 1

// Типичное применение: маленькая проверка, повторяющаяся в условии
auto outOfBoard = [](int v) { return v < 1 || v > 8; };
if (outOfBoard(x1) || outOfBoard(y1) || outOfBoard(x2) || outOfBoard(y2)) {
  std::cout << "Координаты вне доски\n";
  return 1;
}
```

**Захват — лямбда может видеть внешние переменные:**

```cpp
int limit = 10;

auto tooBig = [limit](int x) { return x > limit; };   // [limit] — копия переменной
std::cout << tooBig(15) << "\n";                      // → 1

auto tooBig2 = [&limit](int x) { return x > limit; }; // [&limit] — ссылка на неё
limit = 100;                                          // изменили после создания лямбды
std::cout << tooBig2(15) << "\n";                     // → 0   лямбда видит новое значение

auto anything = [&](int x) { return x > limit; };     // [&] — захватить всё по ссылке
auto copyAll  = [=](int x) { return x > limit; };     // [=] — захватить всё копией
```

<details>
<summary>Разбор: как читать лямбду и её квадратные скобки</summary>

Лямбда — это функция без имени, записанная прямо там, где нужна. Читается по трём частям: `[захват](параметры){ тело }`.

- **`[](int x){ return x % 2 != 0; }`** — пустые `[]`, один параметр `x`, тело возвращает `true`/`false`. По сути та же `isEven`, только безымянная и на месте. `auto` слева даёт ей имя-переменную, чтобы потом вызвать: `isOdd(5)`.
- **Квадратные скобки — это «захват»:** что из окружающих переменных лямбде видно.
  - **`[limit]`** — взять **копию** `limit` в момент создания лямбды. Изменишь `limit` позже — лямбда этого не заметит.
  - **`[&limit]`** — взять **ссылку** на `limit`. Лямбда видит его текущее значение, даже если оно поменялось после.
  - **`[&]`** — захватить по ссылке **всё**, что понадобится; **`[=]`** — то же, но копиями.
- **`isOdd(5)`** — вызывается лямбда как обычная функция, через имя и скобки.

Начинай с копий (`[limit]`) — они безопаснее. Ссылки (`[&]`) бери, когда осознанно хочешь видеть изменения.

</details>

Главное применение лямбд — задать своё правило алгоритмам сортировки и поиска, см. [раздел 18](07-algoritmy.md#18-алгоритмы).

### Функция как аргумент (колбэк)

Лямбду (или обычную функцию) можно **передать в другую функцию** как параметр — тогда одна функция описывает «что делать со всеми элементами», а правило подставляется на месте вызова. Именно так устроены `std::sort`, `std::count_if` и вся `<algorithm>`. Самый простой способ принять такое правило в C++20 — параметр `auto`:

```cpp
#include <iostream>
#include <vector>

// keep — переданное правило: любая функция/лямбда, принимающая int и возвращающая bool.
// Параметр auto — это шаблон в короткой записи (подробнее — раздел 17).
void printIf(const std::vector<int> &v, auto keep) {
  for (int x : v)
    if (keep(x))
      std::cout << x << " ";
  std::cout << "\n";
}

int main() {
  std::vector<int> v = {1, 2, 3, 4, 5, 6};

  printIf(v, [](int x) { return x % 2 == 0; });     // → 2 4 6    правило прямо на месте

  int limit = 3;
  printIf(v, [limit](int x) { return x > limit; }); // → 4 5 6    лямбда с захватом
  return 0;
}
```

<details>
<summary>Разбор: как функция принимает другую функцию</summary>

- **`void printIf(const std::vector<int> &v, auto keep)`** — у `printIf` два параметра: вектор и `keep` — само **правило** (функция или лямбда, принимающая `int` и возвращающая `bool`). `auto` здесь значит «пусть компилятор подставит тип того правила, что передали».
- **`if (keep(x))`** — внутри цикла зовём переданное правило для каждого `x`. Что именно проверять — решает не `printIf`, а тот, кто её вызвал.
- **`printIf(v, [](int x){ return x % 2 == 0; });`** — передаём правило прямо в аргументе: лямбда «чётное ли `x`». Второй вызов передаёт другое правило — и цикл переписывать не нужно.

Смысл приёма: один раз пишешь «пройтись по всем и что-то сделать», а «что именно делать» подставляешь снаружи. На этом стоит вся `<algorithm>` (`sort`, `count_if` и другие).

</details>

Одна функция `printIf` — сколько угодно правил, не переписывая цикл. Есть и «тяжёлый» универсальный тип `std::function<bool(int)>` (из `<functional>`) — он удобнее для хранения колбэка в переменной/структуре, но чуть медленнее; для передачи параметром хватает `auto`.

### Стек вызовов: «как я сюда попал»

```diagram
# Стек и куча: где живут переменные
<img src="data:image/webp;base64,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" alt="Схема: стек против кучи">
```

**На схеме:** стек (слева) — строгий порядок, кладём и снимаем только сверху; тут живут локальные переменные и убираются сами. Куча (справа) — свободная область «вразброс», доступ по указателю; сюда уходит то, что растёт (данные `vector`, `string`).

Когда одна функция вызывает другую, вызовы складываются стопкой:

```cpp
int main() {
  double a = average(marks);   // main вызывает average
  ...
}
double average(const std::vector<int> &v) {
  int s = total(v);            // average вызывает total
  ...
}
```

```
   ┌────────────────────────┐
   │  total()               │  ← программа сейчас здесь
   ├────────────────────────┤
   │  average()             │  ← отсюда вызвали total
   ├────────────────────────┤
   │  main()                │  ← а сюда пришли с самого начала
   └────────────────────────┘
```

Именно эту стопку показывает панель **Call Stack** в отладчике. Она отвечает на вопрос, который иначе выяснять долго: программа упала где-то в глубине — **из какого места моего кода** туда пришли?

Щелчок по строке `main` в этой панели перенесёт редактор туда, а панель переменных покажет значения уже той функции.

Когда функция заканчивается, её «тарелка» снимается со стопки, и все объявленные внутри переменные исчезают — поэтому вернуть ссылку на локальную переменную нельзя: возвращать будет не на что.

<details>
<summary>Копнуть глубже: что такое «тарелка» на самом деле</summary>

Каждый вызов получает свой **кадр стека** (stack frame) — участок памяти, куда кладутся аргументы функции, её локальные переменные и **адрес возврата** (куда прыгнуть, когда функция закончится). Кадры лежат в особой области — **стеке** — и складываются буквально стопкой: новый вызов надстраивает свой кадр сверху, а процессор помнит вершину в отдельном регистре (указателе стека). Поэтому вход в функцию и выход почти бесплатны — надо лишь сдвинуть этот указатель, а не искать память по всей куче; и поэтому же локальные переменные живут ровно до конца функции — её кадр снимается, и память отдаётся под следующие вызовы. Стек не резиновый (обычно около 1 МБ): если кадров становится слишком много — например, при бесконечной рекурсии, — стопка упирается в потолок, и это и есть **переполнение стека**.

</details>

### Рекурсия — функция вызывает саму себя

Иногда задачу удобно решить через **саму себя, но поменьше**. Факториал `5! = 5 · 4!`, а `4! = 4 · 3!` и так далее. Функция, которая вызывает себя, называется **рекурсивной**.

```cpp
#include <iostream>

long long factorial(int n) {          // n! = n · (n-1) · … · 1
  if (n <= 1)                         // БАЗА: дальше сводить некуда, ответ известен
    return 1;
  return n * factorial(n - 1);        // ШАГ: свели задачу к меньшей такой же
}

int main() {
  std::cout << factorial(5) << "\n";  // → 120
  return 0;
}
```

Пройдите вызов `factorial(3)` по шагам. Следите за переменной «стек»: вызовы сначала **накапливаются**, а потом **сворачиваются** в обратном порядке:

```steps
@id c1dr0vhj
# factorial(3): вниз до базы и обратно
long long factorial(int n) {
    if (n <= 1)
        return 1;
    return n * factorial(n - 1);
}
int main() {
    std::cout << factorial(3);
}
---
8 | стек=main | Программа стартует в `main` и вызывает `factorial(3)`.
1 | стек=main → f(3), n=3 | Новая «тарелка» на стопке: `factorial` с `n = 3`.
2 | | 3 <= 1? Нет — база не сработала.
4 | | Чтобы вернуть `3 * factorial(2)`, сначала нужно узнать `factorial(2)`. Эта тарелка **ждёт**.
1 | стек=main → f(3) → f(2), n=2 | Ещё одна тарелка сверху. У неё **своя** `n`, равная 2 (прежняя `n = 3` лежит в тарелке ниже).
4 | | 2 <= 1? Нет. Нужен `factorial(1)` — эта тарелка тоже ждёт.
1 | стек=main → f(3) → f(2) → f(1), n=1 | Третья тарелка, `n = 1`.
3 | | 1 <= 1 — **база**! Возвращаем 1 без новых вызовов. Дно достигнуто.
4 | стек=main → f(3) → f(2), n=2, вернулось=1 | Тарелка f(1) снята. f(2) досчитывает: 2 * 1 = 2.
4 | стек=main → f(3), n=3, вернулось=2 | Тарелка f(2) снята. f(3) досчитывает: 3 * 2 = 6.
8 | стек=main, n=—, вернулось=6 | Все тарелки сняты, в `main` вернулось 6. Печатаем. | 6
```

У любой рекурсии обязаны быть **две части**, и обе одинаково важны:

1. **База** — случай, который решается сразу, без обращения к себе (`n <= 1 → 1`). Это «дно», на котором спуск останавливается.
2. **Шаг** — сведение задачи к **меньшей** версии той же задачи (`n! → n * (n-1)!`). Каждый шаг обязан приближать к базе.

Как это выполняется — та же стопка вызовов, что и выше, только все «тарелки» одной функции:

```
   factorial(3)  = 3 * factorial(2)
                        factorial(2) = 2 * factorial(1)
                                            factorial(1) = 1      ← база, спуск кончился
                        factorial(2) = 2 * 1 = 2                  ← и пошёл подъём обратно
   factorial(3)  = 3 * 2 = 6
```

Сначала вызовы **углубляются** до базы, потом результаты **собираются обратно** снизу вверх.

<details>
<summary>Трассировка: factorial(4) — спуск и подъём</summary>

Каждый вызов ждёт, пока вернётся следующий, и помнит своё `n`. Стек растёт на спуске и сворачивается на подъёме:

| шаг | что происходит | стек (сверху — текущий вызов) | результат |
|---|---|---|---|
| 1 | `factorial(4)`: `4 > 1`, нужен `factorial(3)` | `f(4)` | — |
| 2 | `factorial(3)`: нужен `factorial(2)` | `f(3)` · `f(4)` | — |
| 3 | `factorial(2)`: нужен `factorial(1)` | `f(2)` · `f(3)` · `f(4)` | — |
| 4 | `factorial(1)`: база, `return 1` | `f(1)` · `f(2)` · `f(3)` · `f(4)` | 1 |
| 5 | `f(2)` досчитывает: `2 * 1` | `f(2)` · `f(3)` · `f(4)` | 2 |
| 6 | `f(3)`: `3 * 2` | `f(3)` · `f(4)` | 6 |
| 7 | `f(4)`: `4 * 6` | `f(4)` | **24** |

Шаги 1–4 — спуск (ничего ещё не посчитано), 5–7 — подъём (умножения выполняются в обратном порядке). Без базы на шаге 4 спуск шёл бы бесконечно — до переполнения стека.

</details>


**Ещё пример — сумма цифр, только рекурсией:**

```cpp
int digitSum(int n) {                 // n >= 0
  if (n == 0)                         // база: цифр не осталось
    return 0;
  return n % 10 + digitSum(n / 10);   // последняя цифра + сумма остальных
}
// digitSum(1234) → 1234%10 + digitSum(123) → 4 + (3 + (2 + (1 + 0))) = 10
```

#### Главная ловушка: нет базы — переполнение стека

Если база недостижима (забыл её или шаг не приближает к ней), вызовы не кончаются. Каждый кладёт на стопку новую «тарелку», стопка не резиновая — и программа падает с **переполнением стека** (`stack overflow`, в Windows — код `0xC00000FD`).

```cpp
int bad(int n) {
  return n + bad(n - 1);   // ❌ базы нет: спуск n → n-1 → n-2 → … → -1 → … не остановится
}                          //    стопка вызовов растёт, пока не переполнит стек и не уронит программу
```

Это рекурсивный двойник бесконечного цикла из [раздела 8](03-logika-cikly.md#типовые-ошибки). Только `while` без выхода просто висит, а рекурсия без базы **падает** — стопка вызовов ограничена (от нескольких тысяч до десятков тысяч уровней — зависит от того, сколько места занимает каждый вызов).

#### Когда рекурсия — плохой выбор

Естественная запись не всегда быстрая. Классика — числа Фибоначчи «в лоб»:

```cpp
long long fib(int n) {
  if (n < 2)
    return n;                     // база: fib(0)=0, fib(1)=1
  return fib(n - 1) + fib(n - 2); // шаг: сумма двух предыдущих
}
// fib(10) → 55 мгновенно, а fib(50) считается ВЕЧНОСТЬ
```

`fib(50)` зависает не из-за глубины, а из-за **повторов**: `fib(48)` вычисляется дважды, `fib(47)` — трижды, и число вызовов растёт лавиной (экспоненциально). Та же задача обычным циклом — за `n` шагов:

```cpp
long long fibFast(int n) {        // тот же результат, но линейно
  long long a = 0, b = 1;
  for (int i = 0; i < n; ++i) {
    long long next = a + b;       // следующее — сумма двух текущих
    a = b;
    b = next;
  }
  return a;                       // fibFast(50) → 12586269025, мгновенно
}
```

**Практическое правило:** любую рекурсию можно переписать циклом, и наоборот. Выбирай так:

| Бери рекурсию | Бери цикл |
|---|---|
| структура сама вложенная: разбор дерева, папки внутри папок, скобки внутри скобок | простой проход по числу, вектору, строке |
| задача естественно сводится к себе-поменьше и глубина невелика | глубина может быть большой (десятки тысяч) — иначе переполнишь стек |
| так короче и **читается яснее** | так быстрее и без риска повторных вычислений |

Пока задачи учебные, рекурсия — прежде всего **инструмент понимания** (факториал, сумма цифр, разворот). Там, где цикл очевиден, пиши цикл: он тут и проще, и надёжнее.

### `constexpr`-функции: вычисления на этапе компиляции

Функцию можно пометить `constexpr` — тогда, если аргументы известны заранее, компилятор **посчитает её ещё при сборке**, а в готовую программу попадёт уже результат. Это продолжение [`constexpr`-констант](01-osnovy.md#constexpr-константа-времени-компиляции) из основ: такой функцией можно задать даже размер массива.

```cpp
#include <array>
#include <iostream>

constexpr int square(int x) {           // может вычисляться на этапе компиляции
  return x * x;
}

int main() {
  constexpr int side = square(4);       // посчитано компилятором → 16
  std::array<int, square(3)> cells{};   // размер массива — тоже компайл-тайм (9 элементов)
  std::cout << side << " " << cells.size() << "\n";   // → 16 9

  int n = 5;
  std::cout << square(n) << "\n";       // ту же функцию можно звать и в рантайме → 25
  return 0;
}
```

Правило простое: помечай `constexpr` короткие чистые функции-вычисления (без ввода-вывода). Хуже не станет — в рантайме они работают как обычные, а где значение известно заранее, компилятор сделает работу за тебя.

### Как понять, что функцию пора выделить

- один и тот же кусок кода написан дважды;
- функция не помещается на экран;
- внутри `main` есть блок, которому хочется дать имя в комментарии — вот это имя и станет именем функции.

## Рецепты: хочу X → вот код

Ищешь не функцию, а решение задачи — начни отсюда.

- **Функция меняет переменную вызывающего** — `void reset(int &x) { x = 0; }`. → [три способа](#три-способа-передать-аргумент)
- **Передать вектор или строку без копии** — `int sum(const std::vector<int> &v)`
- **Вернуть два значения** — `std::pair<int, int> minMax(…) { return {lo, hi}; }` — или свой `struct`. → [несколько значений](#возврат-нескольких-значений)
- **«Ответа может не быть»** — `std::optional<int> find(…)`, снаружи `if (auto r = find(…)) use(*r);`. → [optional](#stdoptional--когда-ответа-может-не-быть)
- **Необязательный параметр** — `void greet(const std::string &name = "гость")`. → [по умолчанию](#значения-по-умолчанию)
- **Своё правило для сортировки** — `std::sort(v.begin(), v.end(), [](int a, int b) { return a > b; });`. → [лямбда](#лямбда--безымянная-функция-на-месте)

## Мини-проект: меню из функций

Всё из темы в одной программе на 50 строк: меню в цикле, `switch` по номеру пункта, а каждое действие — отдельная функция. Такой каркас подходит для любой «программы с командами»: калькулятор, список дел, учёт расходов.

```cpp {32-52}
#include <windows.h>
#include <iostream>
#include <limits>

// Каждое действие меню — своя маленькая функция.
void showMenu() {
  std::cout << "\n1 — сложить  2 — возвести в квадрат  3 — чётное?  0 — выход\n> ";
}

int readInt(const char *prompt) {
  int x = 0;
  std::cout << prompt;
  while (!(std::cin >> x)) {                                   // ввели не число
    std::cin.clear();
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
    std::cout << "Нужно целое число: ";
  }
  return x;
}

int add(int a, int b) { return a + b; }
long long square(int x) { return 1LL * x * x; }
bool isEven(int x) { return x % 2 == 0; }

int main() {
  SetConsoleCP(CP_UTF8);
  SetConsoleOutputCP(CP_UTF8);

  while (true) {
    showMenu();
    int choice = readInt("");
    switch (choice) {
      case 1: {
        int a = readInt("a = ");
        int b = readInt("b = ");
        std::cout << "Сумма: " << add(a, b) << "\n";
        break;
      }
      case 2: {
        int x = readInt("x = ");
        std::cout << "Квадрат: " << square(x) << "\n";
        break;
      }
      case 3: {
        int x = readInt("x = ");
        std::cout << (isEven(x) ? "чётное" : "нечётное") << "\n";
        break;
      }
      case 0:
        std::cout << "Пока!\n";
        return 0;
      default:
        std::cout << "Нет такого пункта\n";
    }
  }
}
```

```console
$ ./menu

1 — сложить  2 — возвести в квадрат  3 — чётное?  0 — выход
> 1
a = 2
b = 3
Сумма: 5

1 — сложить  2 — возвести в квадрат  3 — чётное?  0 — выход
> 3
x = 7
нечётное

1 — сложить  2 — возвести в квадрат  3 — чётное?  0 — выход
> 0
Пока!
```

Что здесь из темы: **функции без результата** (`showMenu`) и с результатом (`add`, `isEven`); **одна функция чтения** `readInt` вместо трёх копий проверки ввода; `long long` в `square`, чтобы квадрат большого числа не переполнился; фигурные скобки у `case`, потому что внутри объявлены переменные (иначе — [`jump to case label`](11-oshibki.md#jump-to-case-label)).

**Доделай сам:** пункт «4 — максимум из трёх» (функция `maxOf3`), и чтобы после неверного пункта меню не печаталось заново сразу — а только после Enter.

---

## Проверь себя

Небольшой разбор по теме. Нажми вариант — сразу увидишь, верно или нет; можно и просто «Показать ответ».

```quiz
В: Чтобы функция изменила переменную вызывающего кода, параметр берут…
+ по ссылке — `int &x`
- по значению — `int x`
- как `const int &x`
= Ссылка работает с самой переменной. По значению меняется копия, а `const &` менять нельзя.

В: Что обязательно нужно рекурсии, чтобы она не зациклилась?
+ Условие остановки (базовый случай)
- Ключевое слово `static`
- Цикл внутри функции
= Без базового случая функция будет вызывать себя бесконечно.

В: Как вернуть из функции сразу два значения — и минимум, и максимум?
+ Вернуть `struct` или `std::pair` (можно и через параметры-ссылки)
- Написать два `return` подряд
- Через глобальные переменные
= Проще всего — вернуть пару или структуру и разобрать её через `auto [mn, mx] = …`; параметры-ссылки — запасной вариант, когда значений много. Два `return` не выполнятся, глобальные переменные — плохая практика.

В: Большой объект (`std::vector`) в функцию лучше передавать…
+ по `const`-ссылке — `const std::vector<int> &v`
- по значению
- по указателю на копию
= `const &` — без копирования (быстро) и без права менять (безопасно).

В: Функция `void f(int x){ x = 5; }`; после `int a = 1; f(a);` чему равно `a`?
+ `1` — менялась копия
- `5`
- Ошибка компиляции
= Параметр по значению — копия; изменение внутри функции не трогает `a`.

В: `factorial` с циклом `for (i = 1; i <= n; ++i) r *= i;` и `r = 1`. Чему равно `factorial(0)`?
+ `1`
- `0`
- Ошибка
= Цикл не выполнится ни разу, вернётся стартовое `r = 1`. И это верно: 0! = 1.
```

А теперь код — найди ошибку сам, потом сверься:

```findbug
int gcd(int a, int b) {
    return gcd(b, a % b);       // алгоритм Евклида
    if (b == 0) return a;       // условие остановки
}
---
Базовый случай `if (b == 0) return a;` стоит ПОСЛЕ `return` — до него управление уже не доходит, рекурсия бесконечна. Проверку остановки нужно поставить ПЕРЕД рекурсивным вызовом.
```

И «заполни пропуск» — впиши недостающее и нажми «Проверить»:

```fillcode
long long factorial(int n) {
    if (n <= 1) return [[1]];     // база рекурсии: начинаем произведение с единицы
    return n * factorial(n - 1);  // шаг: сводим к меньшей задаче
}
```

Карточки на повторение — вспомни ответ сам, потом проверь и отметь, насколько было легко (панель напомнит повторить позже):

```cards
Q: Чтобы функция изменила переменную снаружи — как её передать?
A: по ссылке `T&`. По значению функция меняет копию, оригинал не трогается.

Q: Что обязательно нужно любой рекурсии?
A: база (условие остановки) и шаг, приближающий к базе. Без базы — переполнение стека.

Q: Большой объект (`vector`, `string`) в функцию лучше как?
A: по `const&` — без копирования и без права изменить.

Q: Почему нельзя вернуть ссылку на локальную переменную?
A: её кадр стека снимается при выходе из функции — возвращать будет не на что.

Q: Что такое перегрузка функций?
A: Несколько функций с одним именем и разными параметрами: `print(int)`, `print(std::string)`. Компилятор выбирает версию по типам аргументов.

Q: Как правильно задать параметр по умолчанию?
A: В объявлении, справа налево: `void greet(std::string name, int times = 1);` — все параметры правее тоже должны иметь значения по умолчанию.

Q: Как выглядит лямбда?
A: `[захват](параметры) { тело }`, например `[](int x) { return x * 2; }`. Часто её передают в `std::sort` или `std::count_if`.

Q: Чем `[&]` отличается от `[=]` в лямбде?
A: `[&]` захватывает внешние переменные по ссылке — видит и может менять оригиналы. `[=]` — по копии, это снимок значений на момент создания лямбды.
H: Амперсанд — как у ссылки.

Q: Когда вернуть `std::optional<int>`, а не `int`?
A: Когда результата может не быть: «не нашли», «ввели не число». Вызывающий проверяет `if (r)` и берёт значение `*r` — никаких «магических» `-1`.

Q: Что будет, если функция `int f()` дошла до конца без `return`?
A: Неопределённое поведение: вернётся мусор или программа упадёт. С `-Wall` компилятор предупредит (`-Wreturn-type`).
```

Предскажи вывод — копия или оригинал:

```challenge
@id c1c8gjxu
@type predict
Что напечатает программа? (через пробел)
---
void byValue(int x) { x = 100; }
void byRef(int &x) { x = 100; }

int a = 1, b = 1;
byValue(a);
byRef(b);
std::cout << a << " " << b;
---
1 100
```

Собери рекурсию из строк:

```challenge
@id c1oundf
@type parsons
Собери рекурсивный факториал: база, шаг и вызов.
---
long long factorial(int n) {
    if (n <= 1)
        return 1;
    return n * factorial(n - 1);
}
std::cout << factorial(5);
```

> **Сквозной проект «Подземелье», квест 4:** [Порядок в коде: функции](../proekt/02-glava-1-osnovy.md#квест-4-порядок-в-коде-функции) — добавьте в свою игру то, что выучили в этой теме.

## Босс темы

```boss
# Калькулятор из функций
@id cqcn00m
Калькулятор, где **каждое действие — отдельная функция**, а `main` только читает ввод и зовёт их.

1. `add`, `sub`, `mul` — обычные. `divide` возвращает `std::optional<double>`: при делении на ноль — пусто.
2. `power(base, n)` — **рекурсией**, без `pow` и без цикла.
3. `readNumber(const std::string &prompt)` — спрашивает число, пока не введут корректное.
4. Функция `sortTwo(int &a, int &b)` — меняет местами, если `a > b` (проверьте на паре чисел).

<details>
<summary>Подсказка</summary>

База рекурсии для степени: `n == 0 → 1`. Шаг: `base * power(base, n - 1)`. У `optional` проверка — `if (res)`, значение — `*res`.

</details>
```

## Закрепление прошлых тем

Три вопроса из тем 1–3, чтобы пройденное не выветрилось:

```quiz
В: Тема 1. Чему равно `double avg = 7 / 2;`?
+ `3.0` — деление целое, дробь потеряна ещё до присваивания
- `3.5`
- Ошибка компиляции
= Сначала считается `7 / 2` в `int` (это `3`), и только потом результат кладётся в `double`. Нужен дробный операнд: `7 / 2.0` или `static_cast<double>(a) / b`.

В: Тема 2. После `std::cin >> age;` сразу идёт `std::getline(std::cin, name);`. Что будет в `name`?
+ Пустая строка — `getline` прочитал оставшийся Enter
- Имя, которое введёт пользователь
- Программа зависнет
= `>>` оставляет `⏎` в буфере, `getline` читает до него — пусто. Между ними нужен `std::cin.ignore(10000, '\n');`.

В: Тема 3. Сколько раз выполнится `for (int i = 1; i < 10; i += 3)`?
+ 3 раза: `i = 1, 4, 7`
- 4 раза
- 9 раз
= После `7` будет `10`, а условие `i < 10` уже ложно. Выписывай значения счётчика — это самый надёжный способ.
```

> **Теперь потренируйся.** Теория освоена — закрепи её на задачах: [→ Задачник, тема 4. Функции](../zadachnik/04-funkcii.md). Начни с 4.1 «Факториал функцией» 🟢.

---

[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md) · [← Арифметика, логика, ветвления, циклы](03-logika-cikly.md) · [Строки →](05-stroki.md) · [Примеры программ](../examples/README.md)
