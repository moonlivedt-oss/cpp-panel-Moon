# Ошибки компилятора: словарь

> Двадцать семь сообщений, которые ты увидишь чаще всего. Все они **воспроизведены** на твоём g++ 15.2 —
> тексты приведены дословно, а не пересказаны.
> Как устроено сообщение вообще — [раздел 1](01-osnovy.md#как-читать-ошибку-компилятора).

**Уровень:** 🟢 первые шаги · **Опирается на:** [Основы](01-osnovy.md)

[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md) · [← Словарь функций](10a-slovar-funkcij.md) · [Как ловить баги →](12-lovim-bagi.md) · [Примеры программ](../examples/README.md)

---

## Что в этом файле

- **[27. Что означают сообщения компилятора](#27-что-означают-сообщения-компилятора)**
  - [Три правила, которые экономят больше всего времени](#три-правила-которые-экономят-больше-всего-времени)
- **[Имена и опечатки](#имена-и-опечатки)**
  - [`'cout' was not declared in this scope`](#cout-was-not-declared-in-this-scope)
  - [`'vector' is not a member of 'std'`](#vector-is-not-a-member-of-std)
  - [`'string' does not name a type`](#string-does-not-name-a-type)
  - [`request for member 'size' in 'n', which is of non-class type 'int'`](#request-for-member-size-in-n-which-is-of-non-class-type-int)
- **[Знаки препинания](#знаки-препинания)**
  - [`expected ';' after struct definition`](#expected--after-struct-definition)
  - [`expected '}' at end of input`](#expected--at-end-of-input)
  - [`jump to case label`](#jump-to-case-label)
  - [`expected primary-expression before ';' token`](#expected-primary-expression-before--token)
  - [`extended character « is not valid in an identifier`](#extended-character--is-not-valid-in-an-identifier)
- **[Функции](#функции)**
  - [`too many arguments to function`](#too-many-arguments-to-function)
  - [`no matching function for call to 'max(int&, double&)'`](#no-matching-function-for-call-to-maxint-double)
  - [`undefined reference to 'calc(int)'`](#undefined-reference-to-calcint)
  - [`multiple definition of 'main'`](#multiple-definition-of-main)
  - [`control reaches end of non-void function`](#control-reaches-end-of-non-void-function)
  - [`reference to local variable returned`](#reference-to-local-variable-returned)
- **[Типы и `const`](#типы-и-const)**
  - [`assignment of read-only variable`](#assignment-of-read-only-variable)
  - [`narrowing conversion`](#narrowing-conversion)
  - [`invalid conversion from 'const char*' to 'int'`](#invalid-conversion-from-const-char-to-int)
  - [`no match for 'operator+=' ... 'const std::string'`](#no-match-for-operator--const-stdstring)
  - [`'int Box::size' is private within this context`](#int-boxsize-is-private-within-this-context)
  - [`lvalue required as left operand of assignment`](#lvalue-required-as-left-operand-of-assignment)
  - [`invalid operands of types 'const char [15]' and 'const char [7]' to binary 'operator+'`](#invalid-operands-of-types-const-char-15-and-const-char-7-to-binary-operator)
- **[Страшные ошибки на пол-экрана](#страшные-ошибки-на-пол-экрана)**
- **[Предупреждения, которые нельзя игнорировать](#предупреждения-которые-нельзя-игнорировать)**
  - [`'count' is used uninitialized`](#count-is-used-uninitialized)
  - [`suggest parentheses around assignment used as truth value`](#suggest-parentheses-around-assignment-used-as-truth-value)
  - [`comparison of integer expressions of different signedness`](#comparison-of-integer-expressions-of-different-signedness)
  - [`conversion from 'double' to 'int' may change value`](#conversion-from-double-to-int-may-change-value)
  - [`unused variable 'unused'`](#unused-variable-unused)
- **[Куда смотреть, если сообщения нет вовсе](#куда-смотреть-если-сообщения-нет-вовсе)**

---

## 27. Что означают сообщения компилятора

### Три правила, которые экономят больше всего времени

**1. Читай только первую ошибку.** Остальные почти всегда — её последствия. Исправил первую, собрал заново, посмотрел, что осталось.

**2. Ошибка часто на строку выше, чем показано.** Компилятор сообщает о месте, где *заметил* проблему, а не где ты её *сделал*. Классика — забытая точка с запятой:

```cpp
int a = 5      // ← ошибка сделана здесь
int b = 6;     // ← а компилятор показывает сюда
```

```
error: expected ',' or ';' before 'int'
    4 |   int b = 6;
      |   ^~~
```

**3. Слово `note:` — это подсказка, а не вторая ошибка.** Компилятор объясняет, почему ругается, и часто прямо называет причину.

---

## Имена и опечатки

### `'cout' was not declared in this scope`

```
error: 'cout' was not declared in this scope; did you mean 'std::cout'?
```

Имени в этом месте не существует. Три причины по частоте: **опечатка**, забыт **`std::`**, переменная объявлена **ниже** или в другом блоке.

Компилятор часто подсказывает `did you mean` — и обычно угадывает верно.

```cpp
std::cout << cout;        // ❌ забыли std::
std::cout << std::cout;   // а вот так — бессмыслица, но имя существует
```

Если имя точно есть, а компилятор его не видит — проверь [область видимости](01-osnovy.md#область-видимости): переменная из цикла снаружи не существует.

### `'vector' is not a member of 'std'`

```
error: 'vector' is not a member of 'std'
```

Имя правильное, но **забыт `#include`**. Компилятор знает `std`, но в нём пока нет `vector`.

| Что не найдено | Чего не хватает |
|---|---|
| `vector` | `#include <vector>` |
| `sort`, `count_if`, `max_element` | `#include <algorithm>` |
| `map`, `set` | `#include <map>` / `<set>` |
| `accumulate` | `#include <numeric>` |
| `format` | `#include <format>` |
| `setw`, `setprecision` | `#include <iomanip>` |

Полная таблица — [раздел 23](09-spravka.md#23-заголовки--что-откуда).

Иногда подсказка сбивает с толку:

```
error: 'sort' is not a member of 'std'; did you mean 'qsort'?
```

`qsort` — это старая функция из C. Она **не** то, что тебе нужно: подключи `<algorithm>` и пиши `std::sort`.

### `'string' does not name a type`

```
error: 'string' does not name a type; did you mean 'stdin'?
    2 | string name = "Аня";
      | ^~~~~~
```

Компилятор встретил слово там, где ждал **тип** (`int`, `std::string`, имя своей `struct`), и такого типа не знает. Причины по частоте:

1. Забыт `std::` — пиши `std::string`, `std::vector<int>`.
2. Не подключён заголовок: `<string>`, `<vector>`, `<map>`.
3. Опечатка в имени своей структуры (`Studnet` вместо `Student`) или структура объявлена **ниже** места, где её используют.

```cpp
string name = "Аня";          // ❌ нет std::
std::string name = "Аня";     // ✅ и #include <string> в начале файла
```

Подсказка `did you mean 'stdin'` здесь мимо: компилятор просто ищет похожее по буквам имя.

Та же ошибка бывает, когда **обычный код стоит вне функции**: `count = 5;` прямо в файле, а не внутри `main` — снаружи функций можно только объявлять.

### `request for member 'size' in 'n', which is of non-class type 'int'`

```
error: request for member 'size' in 'n', which is of non-class type 'int'
    4 |   std::cout << n.size();
      |                  ^~~~
```

Точка `.` — это «достать что-то изнутри объекта». Она работает у `std::string`, `std::vector`, своей `struct`. У `int`, `double`, `char` ничего внутри нет — точке не за что зацепиться.

```cpp
int n = 5;
std::cout << n.size();         // ❌ у числа нет .size()

std::string s = "кот";
std::cout << s.size();         // ✅ у строки есть
```

Чаще всего это значит, что переменная **не того типа**, который ты думал: объявил `int`, а хотел `std::string` или `std::vector<int>`. Посмотри на объявление.

Если в сообщении `which is of pointer type` — слева **указатель**, и вместо точки нужна стрелка: `p->name`. Подробнее — [ссылки и указатели](22-ukazateli.md#стрелка----поле-через-указатель).

## Знаки препинания

### `expected ';' after struct definition`

```
error: expected ';' after struct definition
    5 | }
      |  ^
      |  ;
```

После закрывающей скобки `struct` нужна точка с запятой. Компилятор даже показывает, что именно вставить.

```cpp
struct Point {
  int x = 0;
};              // ← вот она
```

### `expected '}' at end of input`

```
error: expected '}' at end of input
    6 | }
      |  ^
skobki.cpp:2:12: note: to match this '{'
    2 | int main() {
      |            ^
```

Не закрыта фигурная скобка. Ценность здесь в строке `note`: она показывает, **какая именно** скобка осталась открытой. В примере — та, что открыла `main`.

Быстрый способ найти: поставь курсор на скобку — VS Code подсветит парную. Если парной нет, подсветки не будет.

### `jump to case label`

```
error: jump to case label
    9 |   case 2:
      |        ^
note:   crosses initialization of 'int x'
    6 |     int x = 5;
```

Внутри `case` объявлена переменная, а фигурных скобок нет. Лечится скобками вокруг этого `case`:

```cpp
case 1: {                  // ← открыли
  int x = 5;
  std::cout << x;
  break;
}                          // ← закрыли
```

Подробнее — [раздел 7](03-logika-cikly.md#switch--выбор-из-фиксированного-списка).

### `expected primary-expression before ';' token`

```
error: expected primary-expression before ';' token
    4 |   std::cout << x << ;
      |                     ^
```

«Primary expression» — это **значение**: число, переменная, вызов функции. Компилятор дошёл до оператора, ждал справа значение, а встретил `;` (или `)`, или `,`). Значит, в выражении дыра:

```cpp
std::cout << x << ;            // ❌ после << ничего нет
std::cout << x << "\n";        // ✅

int y = ;                      // ❌ после = пусто
foo(1, );                      // ❌ лишняя запятая
```

Вместо `';'` в сообщении может стоять любой символ — `')'`, `'<<'`, `'else'`: это то, что компилятор увидел **на месте** пропущенного значения. Смотри на символ под `^` и на то, что стоит перед ним.

Ещё одна частая причина — **имя типа там, где нужно значение**: `int x = int;` или вызов `f(int a)` вместо `f(a)`.

### `extended character « is not valid in an identifier`

```
error: extended character « is not valid in an identifier
    3 |   std::cout << «Hi»;
      |                ^
```

В код попал символ, которого нет в C++, — почти всегда после **копирования из браузера, Word или чата**: «ёлочки» `«»`, «лапки» `“”`, длинное тире `—`, неразрывный пробел. Выглядят похоже на `"` и `-`, но для компилятора это совсем другие символы.

Старые версии g++ (и сейчас — для символов вроде `@` или `` ` ``) пишут то же самое иначе:

```
error: stray '\302' in program
error: stray '@' in program
```

`\302`, `\342` — это байты русской или «типографской» буквы в UTF-8. Сколько их в сообщении — столько байтов у одного символа, не пугайся трёх ошибок подряд.

Лечение одно: **перепечатай это место руками**. Кавычки — прямые `"`, минус — обычный `-`, пробел — обычный пробел. Русские буквы допустимы только внутри кавычек `"…"` и в комментариях.

## Функции

### `too many arguments to function`

```
error: too many arguments to function 'int square(int)'
```

Вызвал с большим числом аргументов, чем принимает функция. Компилятор тут же показывает её настоящую сигнатуру — сверься с ней.

Бывает и наоборот: `too few arguments to function`.

### `no matching function for call to 'max(int&, double&)'`

```
error: no matching function for call to 'max(int&, double&)'
    5 |   auto m = std::max(a, b);
      |            ~~~~~~~~^~~~~~
note: there are 4 candidates
note: candidate 1: 'template<class _Tp> constexpr const _Tp& std::max(const _Tp&, const _Tp&)'
note:   deduced conflicting types for parameter 'const _Tp' ('int' and 'double')
note: candidate 2: '... std::max(const _Tp&, const _Tp&, _Compare)'
note: candidate expects 3 arguments, 2 provided
```

Функция с таким именем есть, но **ни один её вариант не подходит к твоим аргументам** — по числу или по типам. В скобках сообщения — типы, которые ты передал (`int&` — это просто «переменная типа `int`»).

Дальше идут строки `note: candidate` — это варианты, которые компилятор примерял. Под каждым кандидатом — строка с причиной, почему он не подошёл. У первого — `conflicting types`: `std::max` хочет **два значения одного типа**, а пришли `int` и `double`.

```cpp
int a = 3;
double b = 2.5;
std::max(a, b);                        // ❌ разные типы
std::max<double>(a, b);                // ✅ явно сказать, в каком типе сравнивать
std::max(static_cast<double>(a), b);   // ✅ или привести один аргумент
```

Для своих функций — то же самое: сравни вызов с объявлением. Частый случай: функция ждёт `std::string`, а передаёшь число, или аргументы перепутаны местами.

Если функция твоя, а ошибка `could not convert '3' from 'int' to 'std::string'` — это та же беда, только вариант у функции один, и компилятор сразу показывает, какой аргумент не подошёл.

### `undefined reference to 'calc(int)'`

```
ld.exe: main.cpp:(.text+0x13): undefined reference to `calc(int)'
collect2.exe: error: ld returned 1 exit status
```

**Это ошибка не компилятора, а компоновщика** — и она устроена иначе. Обрати внимание: в ней нет номера строки твоего кода, зато есть `ld.exe` и `collect2.exe`.

Смысл: функция **объявлена**, компилятор поверил, что где-то есть её тело, — а тела нет.

Причины:

```cpp
int calc(int x);          // объявили (прототип)
// ...тело так и не написали → undefined reference

int Calc(int x) { ... }   // написали, но имя с другой буквы → тоже undefined reference
```

### `multiple definition of 'main'`

```
ld.exe: two_main.cpp:(.text+0x0): multiple definition of `main';
        net_tela.cpp:(.text+0x0): first defined here
collect2.exe: error: ld returned 1 exit status
```

Собираются сразу два файла, и в каждом свой `main`. В программе он должен быть один.

Обычная причина — собрали целую папку («Build Folder», `Ctrl+K B`) вместо одного файла. Запускай один файл: кнопка ▶ в правом верхнем углу редактора → «C/C++ Runner: Run File» (или `Ctrl+Alt+R`).

### `control reaches end of non-void function`

```
warning: control reaches end of non-void function [-Wreturn-type]
```

Функция обещает вернуть значение, но существует путь, на котором `return` не выполнится:

```cpp
int getValue(bool flag) {
  if (flag)
    return 1;
              // ❌ а если flag == false? Вернётся мусор
}
```

Формально это предупреждение, по сути — ошибка: значение будет случайным. Дописывай `return` для всех веток.

### `reference to local variable returned`

```
warning: reference to local variable 'result' returned [-Wreturn-local-addr]
```

Функция вернула **ссылку** на свою локальную переменную, а та исчезает вместе с функцией (её «тарелка» снимается со [стека вызовов](04-funkcii.md#стек-вызовов-как-я-сюда-попал)). Ссылка повисает — читать по ней нельзя.

```cpp
const std::string &bad() {
  std::string result = "привет";
  return result;        // ❌ result умрёт на выходе — ссылка укажет в никуда
}

std::string good() {    // ✅ верни по ЗНАЧЕНИЮ: копия/move живёт дальше, это не тормозит (RVO)
  std::string result = "привет";
  return result;
}
```

Формально предупреждение, по сути — гарантированный баг. Возвращай по значению; ссылку возвращают только на то, что живёт дольше функции (например, на элемент переданного контейнера).

## Типы и `const`

### `assignment of read-only variable`

```
error: assignment of read-only variable 'SIZE'
```

Попытка изменить `const`. Либо значение и правда должно меняться (тогда убери `const`), либо ты меняешь не ту переменную.

### `narrowing conversion`

```
error: narrowing conversion of '3.1400000000000001e+0' from 'double' to 'int' [-Wnarrowing]
```

Появляется при инициализации через **фигурные скобки** `{}`, когда значение не влезает без потери. Это не придирка, а защита — `{}` заставляет написать преобразование явно:

```cpp
int a{3.14};      // ❌ фигурные скобки запрещают терять дробную часть
int b = 3.14;     // соберётся (b = 3), но с -Wconversion предупредит о потере
int c{3};         // ✅ ровно влезает
```

Подробнее про это поведение — [раздел 3](01-osnovy.md#инициализация-в-фигурных-скобках-ловит-сужение).

### `invalid conversion from 'const char*' to 'int'`

```
error: invalid conversion from 'const char*' to 'int' [-fpermissive]
```

Присваиваешь текст числу или наоборот. `const char*` в сообщении означает «строковый литерал в кавычках».

```cpp
int n = "текст";              // ❌
int n = std::stoi("42");      // ✅ если нужно превратить текст в число
```

### `no match for 'operator+=' ... 'const std::string'`

```
error: no match for 'operator+=' (operand types are 'const std::string' and 'const char [2]')
```

Слово `const` в типе — главная подсказка. Ты пытаешься **изменить то, что получил только для чтения**:

```cpp
void show(const std::string &s) {
  s += "!";        // ❌ параметр помечен const
}
```

Либо убери `const` (если менять действительно надо), либо не меняй. Про выбор — [раздел 9](04-funkcii.md#три-способа-передать-аргумент).

### `'int Box::size' is private within this context`

```
error: 'int Box::size' is private within this context
```

Поле спрятано внутри класса. У `class` всё приватно по умолчанию, у `struct` — открыто. Для учебных задач достаточно писать `struct`.

### `lvalue required as left operand of assignment`

```
error: lvalue required as left operand of assignment
    3 |   if (x + 1 = 5) { }
      |       ~~^~~
```

Слева от `=` должно стоять **место, куда можно записать** — переменная, элемент массива, поле структуры. Это место и называется *lvalue*. А `x + 1` — просто временное число, записать в него нельзя.

Почти всегда это **перепутанные `=` и `==`** в условии:

```cpp
if (x + 1 = 5)  { }     // ❌ присваивание во временное значение
if (x + 1 == 5) { }     // ✅ сравнение
```

Другие варианты той же ошибки: `5 = x;` (перепутаны стороны), `f() = 3;` (результат функции — не переменная).

### `invalid operands of types 'const char [15]' and 'const char [7]' to binary 'operator+'`

```
error: invalid operands of types 'const char [15]' and 'const char [7]' to binary 'operator+'
    3 |   std::string s = "Привет, " + "мир";
      |                   ~~~~~~~~~~ ^ ~~~~~
```

Операция (`+`, `-`, `<`, …) применена к типам, для которых она не определена. Самый частый случай — **склеивание двух литералов в кавычках**. `"текст"` — это не `std::string`, а массив символов (`const char [N]`, где N — длина в байтах вместе с завершающим нулём; русская буква занимает два байта). Складывать массивы C++ не умеет.

```cpp
std::string s = "Привет, " + "мир";                  // ❌ оба — литералы
std::string s = std::string("Привет, ") + "мир";     // ✅ хотя бы один — string
std::string s = "Привет, " + name;                   // ✅ если name — std::string
```

В clang и в подсказках VS Code та же ошибка звучит как `invalid operands to binary expression`. Если в сообщении вместо `const char` стоят твои типы (`Point`, `std::string` и `int`) — для них просто нет такой операции: структуры сравнивай по полям, число в строку превращай через `std::to_string(x)`.

## Страшные ошибки на пол-экрана

Иногда одна строка твоего кода порождает простыню из системных заголовков:

```
In file included from D:/msys64/ucrt64/include/c++/15.2.0/bits/stl_tree.h:67,
                 from D:/msys64/ucrt64/include/c++/15.2.0/map:64,
                 from main.cpp:1:
.../stl_function.h: In instantiation of 'constexpr bool std::less<_Tp>::operator()...
  554 |         if (__i == end() || key_comp()(__k, (*__i).first))
```

Пугаться не надо — читается это по одному правилу:

> **Найди в простыне первую строку, где упомянут ТВОЙ файл.** Всё остальное — внутренности библиотеки, туда лезть незачем.

В примере выше настоящая причина спрятана дальше: `no match for 'operator<'` для типа `Point`. То есть `struct` используется ключом `map`, а сравнивать его компилятор не умеет.

```cpp
struct Point {
  int x = 0;
  int y = 0;
  bool operator<(const Point &other) const {   // ← вот чего не хватало
    if (x != other.x) return x < other.x;
    return y < other.y;
  }
};
```

Подробнее — [раздел 12](06-konteynery.md#свой-struct-как-ключ).

**Признак этой группы ошибок:** в тексте есть `In instantiation of`, `required from` и пути внутрь `include/c++`. Значит дело в шаблоне — контейнере или алгоритме, — и почти всегда причина в том, что твой тип чего-то не умеет.

## Предупреждения, которые нельзя игнорировать

Формально программа собралась. По сути — три из них означают настоящую ошибку.

### `'count' is used uninitialized`

```
warning: 'count' is used uninitialized [-Wuninitialized]
```

Переменная используется до того, как ей задали значение. Внутри — мусор. Правило простое: **задавай значение при объявлении**.

### `suggest parentheses around assignment used as truth value`

```
warning: suggest parentheses around assignment used as truth value [-Wparentheses]
```

Написал `=` вместо `==` в условии:

```cpp
if (x = 5)      // ❌ присвоили 5, условие всегда истинно
if (x == 5)     // ✅
```

### `comparison of integer expressions of different signedness`

```
warning: comparison of integer expressions of different signedness:
         'int' and 'std::vector<int>::size_type' [-Wsign-compare]
```

Сравниваешь `int` с размером контейнера. Почему это опасно и три способа починить — [раздел 2](01-osnovy.md#stdsize_t--почему-компилятор-ругается-на-vsize).

### `conversion from 'double' to 'int' may change value`

```
warning: conversion from 'double' to 'int' may change value [-Wfloat-conversion]
```

Дробное кладётся в целое, дробная часть теряется. Если так и задумано — напиши это явно, и предупреждение исчезнет:

```cpp
int n = static_cast<int>(3.99);   // ✅ 3, и видно, что отбрасывание намеренное
```

### `unused variable 'unused'`

```
warning: unused variable 'unused' [-Wunused-variable]
```

Самое безобидное — но полезное. Часто означает, что ты завёл переменную и забыл её использовать, а считаешь в другом месте по ошибке.

---

## Куда смотреть, если сообщения нет вовсе

Программа собралась, но работает не так. Компилятор молчит — значит, ошибка не в синтаксисе, а в логике. Это уже другой инструмент: [Как ловить баги](12-lovim-bagi.md).

## Расшифруй ошибку

Настоящие сообщения g++ — ровно такие, какие ты увидишь в терминале. Выбери, что на самом деле случилось; объяснение появится после ответа.

```quiz
В: `error: expected ';' before '}' token` — строка `int main() { int n = 5; std::cout << n }`. В чём дело?
+ После `std::cout << n` не хватает точки с запятой
- Лишняя фигурная скобка
- Переменная `n` не объявлена
= Компилятор замечает пропуск, только когда видит следующий символ — здесь это `}`. Поэтому он и пишет «перед `}`», а ошибка на конце предыдущей инструкции.

В: `error: 'cout' is not a member of 'std'` — а `std::cout` написан без опечаток. Что забыто?
+ `#include <iostream>`
- `using namespace std;`
- Объявить `cout` как переменную
= Пространство имён `std` огромное, но каждое его имя живёт в своём заголовке. Не подключил `<iostream>` — для компилятора `std::cout` не существует.

В: `error: no match for 'operator<<' (operand types are 'std::ostream' ... and 'std::vector<int>')`. Что это значит?
+ `cout` не умеет печатать вектор целиком — выводи элементы циклом
- В векторе лежат не числа
- Нужно подключить `<vector>`
= «No match for operator» — нет подходящей операции для таких типов. У `std::vector` нет готового вывода в поток: печатай элементы по одному или напиши свой `operator<<`.

В: `error: cannot convert 'std::string' ... to 'int' in initialization`. Что случилось?
+ Строку пытаются положить в переменную типа `int`
- Строка слишком длинная
- Забыт `#include <string>`
= Типы не совпадают, и C++ не превращает строку в число сам. Нужно явное преобразование: `std::stoi(s)`.

В: `error: passing 'const A' as 'this' argument discards qualifiers`. Как чинить?
+ Пометить вызываемый метод `const`: `int get() const`
- Убрать `const` у всех параметров
- Добавить `-fpermissive` в флаги
= У `const`-объекта можно звать только `const`-методы — это обещание не менять объект. Если метод и правда только читает, пометь его `const`. Флаг `-fpermissive` не чинит ошибку, а прячет её.

В: `warning: comparison of integer expressions of different signedness: 'int' and 'std::vector<int>::size_type'` в `for (int i = 0; i < v.size(); ++i)`. Что это?
+ Сравнение знакового `int` с беззнаковым размером — отрицательное число превратилось бы в огромное
- Ошибка: программа не соберётся
- Вектор пуст
= Это предупреждение, программа соберётся. Но на границе оно превращается в баг: `-1 < v.size()` даёт `false`. Бери `std::size_t i` или `std::ssize(v)`.

В: `warning: control reaches end of non-void function` у функции `int f(int x) { if (x > 0) return 1; }`. Чем опасно?
+ При `x <= 0` функция не вернёт значение — неопределённое поведение
- Ничем, компилятор сам вернёт 0
- Функция не скомпилируется
= Сам вернёт `0` только `main`. Любая другая функция, дошедшая до `}` без `return`, отдаёт мусор или ломает программу. Добавь `return` на все пути.

В: `warning: suggest parentheses around assignment used as truth value` в `if (x = 5)`. Что не так?
+ Внутри `if` присваивание, а имелось в виду сравнение `==`
- Нужно взять `5` в скобки
- Переменная `x` не инициализирована
= `x = 5` кладёт в `x` пятёрку и возвращает её — условие всегда истинно. Нужно `x == 5`. Компилятор подсказывает скобки на случай, если присваивание в условии задумано.
```

Карточки на повторение — вспомни ответ сам, потом переверни карточку и отметь, насколько было легко:

```cards
Q: Что обычно значит `'x' was not declared in this scope`?
A: Имя неизвестно в этом месте: опечатка, переменная объявлена в другом блоке или забыт `#include` либо `std::`.

Q: Компилятор выдал 40 строк ошибок. С какой начинать?
A: С самой первой: остальные часто — её следствие. Исправь её и собери снова.

Q: `expected ';' before '}'` — где искать ошибку?
A: Обычно на строке выше указанной: там забыта `;` в конце инструкции.
H: Компилятор замечает проблему, только когда видит следующий символ.

Q: `no match for 'operator<<'` — что случилось?
A: В `cout` выводится тип, который он не умеет печатать: вектор или своя структура. Выводи поля по одному или напиши свой `operator<<`.

Q: Чем предупреждение (warning) отличается от ошибки (error)?
A: Ошибка не даёт собрать программу. Предупреждение собирает, но указывает на вероятный баг — его тоже стоит исправить.

Q: `undefined reference to 'foo()'` — это ошибка компиляции или компоновки?
A: Компоновки (линкера): функция объявлена, но её тело не найдено — не написано или нужный `.cpp` не добавлен в сборку.

Q: Что значит `discards qualifiers` при вызове метода?
A: У `const`-объекта вызывается метод без `const`. Пометь метод `const`, если он ничего не меняет.

Q: Что значит `comparison of integer expressions of different signedness`?
A: Сравниваются `int` и `size_t`, например `i < v.size()`. Бери `size_t i` или `std::ssize(v)`, чтобы отрицательное число не превратилось в огромное.
```

---

[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md) · [← Словарь функций](10a-slovar-funkcij.md) · [Как ловить баги →](12-lovim-bagi.md) · [Примеры программ](../examples/README.md)
