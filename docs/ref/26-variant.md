# optional и variant: «может не быть» и «одно из нескольких»

> Как честно сказать в типе «значения может не быть» (`std::optional`) и «здесь одно из нескольких» (`std::variant`), а потом разобрать все случаи без забытых веток (`std::visit`).
>
> Это **раздел 40** справочника — тема «на вырост». Нужна, когда функция то находит, то не находит; когда событие в игре бывает разного вида; когда хочется вернуть «или результат, или ошибку». Полный список — в [оглавлении](../00-НАЧНИ-ОТСЮДА.md).

**Уровень:** продвинутая тема · **Опирается на:** [Функции](04-funkcii.md), [struct и файлы](08-struct-fayly.md)

[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md) · [Маршрут изучения](../00-marshrut.md) · [← constexpr](25-constexpr.md) · [Потоки →](27-potoki.md)

---

## Что в этом файле

- **[40. optional и variant](#40-optional-и-variant)**
  - [За 30 секунд](#за-30-секунд)
  - [`std::optional`: значение или ничего](#stdoptional-значение-или-ничего)
  - [`std::variant`: одно из нескольких](#stdvariant-одно-из-нескольких)
  - [`std::visit`: разобрать все случаи](#stdvisit-разобрать-все-случаи)
  - [Результат или ошибка](#результат-или-ошибка)
  - [variant против наследования](#variant-против-наследования)
  - [Типовые ошибки](#типовые-ошибки)
- **[Рецепты: хочу X → вот код](#рецепты-хочу-x--вот-код)**
- **[Проверь себя](#проверь-себя)**
- **[Босс темы](#босс-темы)**

---

## 40. optional и variant

> **Коротко это уже было:** `std::optional` — в [«Функциях»](04-funkcii.md#stdoptional--когда-ответа-может-не-быть), `stoi` в `optional` — в [«Исключениях»](14-isklyucheniya.md#безопасный-разбор-числа-stoi-в-optional). Здесь к нему добавляется `std::variant`.

### За 30 секунд

- `std::optional<T>` — «`T` или ничего». Вместо магических `-1`, пустой строки и флага `found`.
- Проверка: `if (opt)`; значение: `*opt`; значение или запасное: `opt.value_or(x)`.
- `std::variant<A, B, C>` — ровно одно из `A`, `B`, `C` в каждый момент. Какое сейчас — `index()` или `std::holds_alternative<B>(v)`.
- `std::visit(функция, v)` вызывает функцию для того, что лежит внутри. Лямбда с `auto` или набор перегрузок — и компилятор не даст забыть случай.
- Заголовки: `<optional>` и `<variant>`.

### `std::optional`: значение или ничего

```cpp
#include <iostream>
#include <optional>
#include <string>
#include <vector>

struct Item { std::string name; int price = 0; };

std::optional<Item> findItem(const std::vector<Item> &shop, const std::string &name) {
    for (const Item &it : shop)
        if (it.name == name) return it;
    return std::nullopt;                 // «не нашли» — отдельное значение, не выдуманный Item
}

int main() {
    std::vector<Item> shop = {{"меч", 50}, {"щит", 30}};
    if (auto it = findItem(shop, "щит")) std::cout << it->name << ": " << it->price << "\n";
    auto miss = findItem(shop, "лук");
    std::cout << (miss ? "есть" : "нет в продаже") << "\n";
    std::cout << findItem(shop, "лук").value_or(Item{"ничего", 0}).name << "\n";
}
```

`*opt` у пустого `optional` — неопределённое поведение, как чтение за концом массива. Сначала `if (opt)`, либо `value_or`.

### `std::variant`: одно из нескольких

В игре событие бывает разным: удар, лечение, находка. У каждого свои данные. `variant` хранит **одно** из них и помнит, какое.

```cpp
#include <iostream>
#include <string>
#include <variant>

struct Hit { int damage = 0; };
struct Heal { int amount = 0; };
struct Loot { std::string item; };

using Event = std::variant<Hit, Heal, Loot>;

int main() {
    Event e = Heal{15};
    std::cout << e.index() << "\n";                             // 1 — второй тип в списке
    if (std::holds_alternative<Heal>(e)) std::cout << std::get<Heal>(e).amount << "\n";
    e = Loot{"зелье"};                                          // теперь внутри Loot, Heal исчез
    if (auto *loot = std::get_if<Loot>(&e)) std::cout << loot->item << "\n";
}
```

`std::get<Heal>(e)`, когда внутри `Loot`, бросает `std::bad_variant_access`. `std::get_if` возвращает `nullptr` — удобно в `if`.

### `std::visit`: разобрать все случаи

Цепочка `if (holds_alternative…)` легко теряет случай. `std::visit` вызывает функцию для содержимого, а набор перегрузок заставляет перечислить **все** типы: забыл один — не соберётся.

```cpp
#include <iostream>
#include <string>
#include <variant>
#include <vector>

struct Hit { int damage = 0; };
struct Heal { int amount = 0; };
struct Loot { std::string item; };
using Event = std::variant<Hit, Heal, Loot>;

// Набор лямбд в один объект с перегрузками operator() — известный приём.
template <class... Fs> struct Overloaded : Fs... { using Fs::operator()...; };

int main() {
    int hp = 30;
    std::vector<Event> log = {Hit{7}, Heal{5}, Loot{"кость"}, Hit{3}};
    for (const Event &e : log) {
        std::visit(Overloaded{
            [&](const Hit &h) { hp -= h.damage; std::cout << "удар " << h.damage << "\n"; },
            [&](const Heal &h) { hp += h.amount; std::cout << "лечение " << h.amount << "\n"; },
            [](const Loot &l) { std::cout << "находка: " << l.item << "\n"; },
        }, e);
    }
    std::cout << "HP " << hp << "\n";   // 25
}
```

Уберите ветку `Loot` — компилятор скажет, что для `Loot` нет подходящего вызова. Это и есть защита от забытого случая.

### Результат или ошибка

Функция разбора ввода либо даёт число, либо объясняет, что не так. Бросать исключение ради обычной опечатки — тяжело; возвращать `-1` — теряется причина. `variant` из результата и текста ошибки решает обе проблемы.

```cpp
#include <iostream>
#include <string>
#include <variant>

using ParseResult = std::variant<int, std::string>;   // число или текст ошибки

ParseResult parseLevel(const std::string &s) {
    if (s.empty()) return std::string("пустая строка");
    int v = 0;
    for (char c : s) {
        if (c < '0' || c > '9') return std::string("не число: ") + s;
        v = v * 10 + (c - '0');
    }
    if (v < 1 || v > 20) return std::string("уровень вне 1..20");
    return v;
}

int main() {
    for (std::string s : {"7", "abc", "40"}) {
        ParseResult r = parseLevel(s);
        if (auto *lvl = std::get_if<int>(&r)) std::cout << "уровень " << *lvl << "\n";
        else std::cout << "ошибка: " << std::get<std::string>(r) << "\n";
    }
}
```

В C++23 для этого есть готовый `std::expected<int, std::string>`; курс собирается как C++20, поэтому здесь — `variant`.

### variant против наследования

| | `std::variant` | наследование + `virtual` ([тема 20](20-nasledovanie.md)) |
|---|---|---|
| набор типов | закрытый, известен заранее | открытый: новый класс-наследник — без правки старого кода |
| новая операция над всеми типами | новый `visit` — легко | новый виртуальный метод во всех классах — тяжело |
| память | лежит на месте, без кучи | обычно `unique_ptr` и куча |
| когда брать | события, команды, результат-или-ошибка | монстры, у которых растёт семейство |

### Типовые ошибки

| Что видишь | Почему | Как чинить |
|---|---|---|
| программа падает на `*opt` | `optional` пустой | проверь `if (opt)` или возьми `value_or` |
| `std::bad_variant_access` | `std::get<T>` запросил не тот тип | `std::get_if<T>(&v)` или `std::visit` |
| `no matching function for call` в `std::visit` | в наборе лямбд нет ветки для одного из типов | добавь ветку — компилятор как раз об этом и говорит |
| `variant` со ссылками не собирается | `variant<int&>` запрещён | храни значения или указатели |

```findbug
std::optional<int> findHp(const std::string &name);

int hp = *findHp("гоблин");   // берём значение
std::cout << hp << "\n";
---
Если гоблина нет, `optional` пустой, и `*` у пустого — неопределённое поведение. Сначала проверка: `if (auto h = findHp("гоблин")) std::cout << *h;` или запасное значение: `findHp("гоблин").value_or(0)`.
```

```fillcode
std::variant<int, std::string> v = 42;
if (std::[[holds_alternative]]<int>(v))
    std::cout << std::[[get]]<int>(v);   // 42
```

```steps
@id c1df2u2v
# Что лежит в variant
std::variant<int, std::string> v = 7;
std::cout << v.index();
v = std::string("меч");
std::cout << v.index() << std::get<std::string>(v).size();
---
1 | v=7 | Внутри `int`, это первый тип в списке — индекс 0.
2 | | Печатаем индекс. | 0
?3 | v="меч" | Присвоили строку: `int` исчез, теперь внутри `std::string`.
4 | | Индекс 1; длина «меч» в байтах UTF-8 — 6 (кириллица — по 2 байта на букву). | 16
```

## Рецепты: хочу X → вот код

Ищешь не функцию, а решение задачи — начни отсюда.

- **Функция может не найти ответ** — вернуть `std::optional<T>`, «нет» — `std::nullopt`. → [optional](#stdoptional-значение-или-ничего)
- **Значение или запасное** — `opt.value_or(x)`. → [optional](#stdoptional-значение-или-ничего)
- **Хранить одно из нескольких видов** — `std::variant<Hit, Heal, Loot>`. → [variant](#stdvariant-одно-из-нескольких)
- **Разобрать все виды и не забыть ни одного** — `std::visit` с набором лямбд. → [visit](#stdvisit-разобрать-все-случаи)
- **Вернуть «результат или текст ошибки»** — `std::variant<int, std::string>`. → [результат или ошибка](#результат-или-ошибка)

## Проверь себя

```cards
Q: Что вернуть из поиска, когда ничего не нашлось, если функция возвращает `std::optional<Item>`?
A: `std::nullopt` (или `{}`) — пустой `optional`.

Q: Как взять значение `optional` или запасное, если пусто?
A: `opt.value_or(запасное)`.

Q: Что хранит `std::variant<A, B>` в каждый момент?
A: Ровно одно значение: либо `A`, либо `B`. Какое — видно по `index()` или `holds_alternative`.

Q: Чем `std::visit` с набором перегрузок лучше цепочки `if (holds_alternative…)`?
A: Забытый тип не соберётся: компилятор требует ветку для каждого варианта.

Q: Когда `variant` удобнее наследования?
A: Когда набор видов закрыт и известен заранее, а операции над ними добавляются часто: события, команды, результат-или-ошибка.

Q: Что делает `std::get_if<T>(&v)`?
A: Возвращает указатель на значение, если внутри `T`, иначе `nullptr`. Удобно прямо в `if`.

Q: Зачем приём `Overloaded` с набором лямбд?
A: Собрать несколько лямбд в один объект с перегрузками — `std::visit` вызовет нужную для каждого типа.

Q: Что вместо `variant<T, std::string>` для «результат или ошибка» есть в C++23?
A: `std::expected<T, E>`. Курс собирается как C++20, поэтому здесь — `variant`.
```

```quiz
В: `std::optional<int> x;` — что в `x`?
+ ничего (пустой optional)
- 0
- мусор
= Созданный без значения `optional` пуст; `if (x)` даст `false`.

В: Внутри `variant<int, std::string>` лежит строка. Что сделает `std::get<int>(v)`?
- вернёт 0
+ бросит `std::bad_variant_access`
- вернёт длину строки
= `std::get` с чужим типом — исключение. Безопасно спросить можно через `std::get_if`.

В: Что будет, если в `std::visit(Overloaded{...}, v)` нет ветки для одного из типов?
+ программа не соберётся
- ветка тихо пропустится
- упадёт при запуске
= `visit` должен уметь вызвать функцию для любого содержимого — это проверяется при сборке.

В: `std::optional<int> o = 5; o.reset();` — что теперь `o.value_or(-1)`?
+ -1
- 5
- 0
= `reset()` делает optional пустым, `value_or` отдаёт запасное.

В: Сколько байт памяти `variant<int, double>` тратит на значения?
+ Место под самый большой вариант (плюс метка), а не под оба сразу
- Сумму размеров всех вариантов
- Всегда 8
= В каждый момент хранится одно значение — места нужно под самое большое.

В: Когда `variant` удобнее наследования?
+ Набор видов закрыт, а операции над ними добавляются часто
- Когда виды постоянно добавляются
- Никогда
= Растущему семейству видов больше подходит наследование.
```

```challenge
@id cug0e9
@type predict
Что напечатает программа?
---
#include <iostream>
#include <string>
#include <variant>

int main() {
    std::variant<int, std::string> v = 5;
    std::cout << v.index() << " ";
    v = std::string("hp");
    std::cout << v.index() << " " << std::get<std::string>(v).size() << "\n";
}
---
0 1 2
```

```challenge
@id c1k25a2a
@type run
@hint Цикл по `std::string` — `for (char c : s)`. Нашёл не цифру — сразу `return std::nullopt;`.
@hint В `main`: `if (auto n = parsePositive(s)) std::cout << *n * 2 << "\n"; else std::cout << "нет\n";`
Функция `std::optional<int> parsePositive(const std::string &s)`: строка только из цифр (и не пустая) — число, иначе `std::nullopt`. Программа читает слова до конца ввода и для каждого печатает удвоенное число или `нет`.
---
#include <iostream>
#include <optional>
#include <string>

// твой код: std::optional<int> parsePositive(const std::string &s)

int main() {
    std::string s;
    while (std::cin >> s) {
        // твой код
    }
}
---
12 => 24
abc => нет
7 x 0 => 14\nнет\n0
---
#include <iostream>
#include <optional>
#include <string>

std::optional<int> parsePositive(const std::string &s) {
    if (s.empty()) return std::nullopt;
    int v = 0;
    for (char c : s) {
        if (c < '0' || c > '9') return std::nullopt;
        v = v * 10 + (c - '0');
    }
    return v;
}

int main() {
    std::string s;
    while (std::cin >> s) {
        if (auto n = parsePositive(s)) std::cout << *n * 2 << "\n";
        else std::cout << "нет\n";
    }
}
```

## Босс темы

```boss
# Журнал событий подземелья
@id c1iswe8h
Перепишите события боя «Подземелья» на `std::variant`.

1. Типы событий: `Hit` (урон), `Heal` (лечение), `Loot` (предмет), `Level` (новый уровень) — `using Event = std::variant<…>`.
2. Журнал — `std::vector<Event>`; по нему `std::visit` с `Overloaded` считает итог: HP, собранные предметы, уровень.
3. Поиск предмета в инвентаре возвращает `std::optional`; «нет такого» — не `-1` и не пустая строка.
4. Разбор команды игрока возвращает `std::variant<Command, std::string>` — команду или понятный текст ошибки.
5. Проверьте: уберите одну ветку в `visit` и прочитайте, что скажет компилятор.

<details>
<summary>Подсказка</summary>

`template <class... Fs> struct Overloaded : Fs... { using Fs::operator()...; };` — одна строка, и лямбды собираются в один объект. Лямбды, меняющие HP, захватывают его по ссылке `[&]`.

</details>
```

## Закрепление прошлых тем

Три вопроса из прошлых тем — на них опирается эта:

```quiz
В: Тема 4. Функция поиска не нашла элемент. Что честнее вернуть?
+ `std::optional` без значения
- `-1`
- `0`
= «Нет ответа» — отдельное значение, а не выдуманное число, которое может оказаться настоящим.

В: Тема 14. `std::get<int>(v)` для чужого типа бросает исключение. Как поймать любое стандартное?
+ `catch (const std::exception &e)`
- `catch (int)`
- `catch (std::string)`
= Все стандартные исключения — наследники `std::exception`.

В: Тема 20. Когда удобнее наследование, чем закрытый набор видов?
+ Когда семейство типов будет расти, и новые виды пишут, не трогая старый код
- Когда видов ровно три и они не меняются
- Всегда
= Для закрытого набора видов удобнее `variant`, для растущего семейства — наследование.
```

---

[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md) · [Маршрут изучения](../00-marshrut.md) · [← constexpr](25-constexpr.md) · [Потоки →](27-potoki.md)
