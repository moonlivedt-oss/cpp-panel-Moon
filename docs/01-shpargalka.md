# Шпаргалка на один экран

> Самое частое — без объяснений. Объяснения в [справочнике](00-НАЧНИ-ОТСЮДА.md), готовые программы в [примерах](examples/README.md).
> Весь код здесь проверен сборкой со строгими флагами.

---

## Скелет программы

```cpp
#include <windows.h>        // Windows: русские буквы
#include <iostream>

int main() {
  SetConsoleCP(CP_UTF8);
  SetConsoleOutputCP(CP_UTF8);

  // 1. ВВОД   2. РАСЧЁТ   3. ВЫВОД

  return 0;
}
```

## Безопасный ввод числа — копировать целиком

```cpp
#include <cstdlib>
#include <limits>

int readInt(const std::string &prompt) {
  int value = 0;
  while (true) {
    std::cout << prompt;
    if (std::cin >> value) {
      std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
      return value;
    }
    if (std::cin.eof()) {                    // без этого — вечный цикл
      std::cout << "\nВвод закончился.\n";
      std::exit(0);
    }
    std::cin.clear();
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
    std::cout << "Нужно число.\n";
  }
}
```

Строка целиком: `std::getline(std::cin, line);` — после `cin >>` сначала `cin.ignore(10000, '\n');`

## Типы

`int` целые · `long long` большие · `double` дробные · `std::string` текст · `bool` да/нет · `char` один символ

## Контейнеры

```cpp
std::vector<int> v = {3, 1, 2};      // список по порядку
std::map<std::string, int> m;        // поиск по ключу, отсортирован
std::set<int> seen;                  // только уникальные
struct Student { std::string name; int score = 0; };
std::vector<Student> group = {{"Аня", 95}};
```

| Действие | vector | map | set |
|---|---|---|---|
| добавить | `v.push_back(x)` | `m[key] = val` | `s.insert(x)` |
| размер | `v.size()` | `m.size()` | `s.size()` |
| есть? | `std::find(...)` | `m.contains(key)` | `s.contains(x)` |
| взять | `v[i]` / `v.at(i)` | `m.at(key)` | — |
| удалить | `std::erase(v, x)` | `m.erase(key)` | `s.erase(x)` |
| пусто? | `v.empty()` | `m.empty()` | `s.empty()` |

⚠️ `m[key]` при **чтении** создаёт ключ. Читать — через `m.at(key)`, `m.find(key)` или `m.contains(key)`.

## Циклы

```cpp
for (int x : v)                     // прочитать
for (const auto &x : v)             // прочитать без копий (строки, структуры)
for (auto &x : v)                   // изменить на месте
for (std::size_t i = 0; i < v.size(); ++i)      // нужен номер
for (const auto &[key, val] : m)                // по словарю
while (std::cin >> x)                           // пока вводят числа
```

## Алгоритмы

```cpp
#include <algorithm>
#include <numeric>

std::sort(v.begin(), v.end());                                  // по возрастанию
std::sort(v.begin(), v.end(), [](int a, int b) { return a > b; });   // своё правило
auto n  = std::count_if(v.begin(), v.end(), [](int x) { return x > 4; });
auto it = std::find(v.begin(), v.end(), 9);      // it == v.end() → не нашли
long long sum = std::accumulate(v.begin(), v.end(), 0LL);       // 0LL, не 0!
std::erase_if(v, [](int x) { return x < 0; });   // удалить подходящие
std::cout << *std::max_element(v.begin(), v.end());             // звёздочка!

std::sort(group.begin(), group.end(),            // структуры по полю
          [](const Student &a, const Student &b) { return a.score > b.score; });
```

## Вывод

```cpp
#include <format>

std::cout << std::format("{} + {} = {}\n", 2, 3, 5);      // 2 + 3 = 5
std::cout << std::format("{:.2f}\n", 3.14159);            // 3.14
std::cout << std::format("{:<10}{:>6}\n", "Имя", 95);     // ровная таблица
```

`{:<10}` влево · `{:>10}` вправо · `{:^10}` по центру · `{:05}` нулями · `{:.2f}` два знака

⚠️ Для русских подписей — только `std::format`: `setw` считает байты и разъезжается.

## Файлы

```cpp
#include <fstream>

std::ifstream in("data.txt");
if (!in.is_open()) { std::cout << "нет файла\n"; return 1; }   // ⚠️ is_open(), не (!in)
std::string line;
while (std::getline(in, line)) { /* ... */ }

std::ofstream out("result.txt");        // ⚠️ старое содержимое стирается
if (out.is_open()) out << "текст\n";
```

## Числа

```cpp
double avg = static_cast<double>(sum) / static_cast<double>(v.size());  // ОБА cast
long long big = 1LL * n * (n + 1) / 2;                    // от переполнения
if (d != 0) { /* делить */ }                              // всегда проверяй
if (std::abs(a - b) < 1e-9) { /* дробные равны */ }       // не ==
```

## Приоритет операторов (частое)

От высокого к низкому — что посчитается раньше **без** скобок:

| Уровень | Операторы | Заметка |
|---|---|---|
| выше всех | `()` `[]` `.` `->` | вызов, индекс, поле |
| унарные | `!` `-` `++` `--` `*`(разыменование) | `!found`, `-x`, `*it` |
| `* / %` | умножение, деление, остаток | `a + b * c` → сначала `b * c` |
| `+ -` | сложение, вычитание | |
| `<< >>` | сдвиг **и вывод в поток** | ⚠️ `cout << a == b` = `(cout << a) == b` — нужны скобки |
| `< <= > >=` | сравнения | |
| `== !=` | равенство | |
| `&&` | логическое И | считается раньше `\|\|` |
| `\|\|` | логическое ИЛИ | |
| `? :` | тернарный | |
| ниже всех | `=` `+=` `-=` `*=` … | присваивание — в самом конце |

Сомневаешься — ставь скобки: `a && b \|\| c` это `(a && b) \|\| c`, а `1 << 2 + 3` это `1 << (2 + 3)`.

## Спецсимволы в строках (escape)

| Запись | Что это |
|---|---|
| `\n` | новая строка |
| `\t` | табуляция |
| `\\` | сама обратная косая `\` |
| `\"` | кавычка внутри `"..."` |
| `\'` | апостроф внутри `'a'` |
| `\0` | нулевой символ (конец C-строки) |

Пример: `std::cout << "путь:\tC:\\tmp\n";` печатает `путь:`, таб, `C:\tmp` и перевод строки.

## Сборка

```bash
g++ -std=c++20 -Wall -Wextra -Wpedantic -Wshadow -Wconversion -Wsign-conversion -D_GLIBCXX_ASSERTIONS -g -O0 -o main.exe main.cpp
```

| Клавиша | Действие |
|---|---|
| `Ctrl+Alt+R` | запустить этот файл |
| `Ctrl+Alt+D` | отладить этот файл |
| `F9` | точка останова |
| `F10` / `F11` | шаг через / шаг внутрь |
| `F5` | продолжить |

## Пять ловушек, стоящих больше всего времени

1. `7 / 2` даёт `3` → `static_cast<double>(a) / b`
2. `m[key]` при чтении создаёт ключ → `m.at()` / `m.contains()`
3. `cin >>` сломался и молчит → `readInt` выше
4. `v[i]` за границей не ругается → `-D_GLIBCXX_ASSERTIONS`
5. `if (!in)` не ловит отсутствие файла → `if (!in.is_open())`

---

[Справочник](00-НАЧНИ-ОТСЮДА.md) · [Словарь терминов](ref/10-slovar.md) · [Примеры программ](examples/README.md)
