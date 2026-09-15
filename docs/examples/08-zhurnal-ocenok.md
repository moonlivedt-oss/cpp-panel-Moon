# 8. Журнал оценок

> **Что показывает:** как соединяются все части сразу — ввод с проверкой, `struct`, `vector`, лямбда, сортировка, `std::format` и запись в файл.
> **Готовый файл:** [code/grades.cpp](code/grades.cpp) — открой и нажми `Ctrl+Alt+R`.
> Собирается без единого предупреждения со всеми строгими флагами.

[← Все примеры](README.md) · [← Крестики-нолики](07-krestiki-noliki.md) · [Проверка пароля →](09-parol.md) · [Начни отсюда](../00-НАЧНИ-ОТСЮДА.md)

---

## Код целиком

```cpp
#include <windows.h>       // Windows: SetConsoleCP / SetConsoleOutputCP

#include <algorithm>       // std::sort
#include <cstdlib>         // std::exit
#include <format>          // std::format
#include <fstream>         // std::ofstream
#include <iostream>        // std::cin, std::cout
#include <limits>          // std::numeric_limits — нужен для cin.ignore
#include <string>          // std::string, std::getline
#include <vector>          // std::vector

// ---------- 1. Данные: одна запись = один студент ----------
struct Student {
  std::string name;
  int score = 0;           // значение по умолчанию: мусора не будет никогда
};

// ---------- 2. Ввод с проверкой ----------
int readInt(const std::string &prompt) {
  int value = 0;
  while (true) {
    std::cout << prompt;
    if (std::cin >> value) {                  // получилось прочитать число?
      std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
      return value;                           // да — выходим и отдаём результат
    }
    if (std::cin.eof()) {                     // ввод кончился — иначе цикл станет вечным
      std::cout << "\nВвод закончился.\n";
      std::exit(0);
    }
    std::cin.clear();                         // снимаем флаг ошибки потока
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
    std::cout << "Нужно целое число.\n";
  }
}

int readIntInRange(const std::string &prompt, int lo, int hi) {
  while (true) {
    int value = readInt(prompt);
    if (value >= lo && value <= hi)
      return value;
    std::cout << std::format("Нужно число от {} до {}.\n", lo, hi);
  }
}

std::string readLine(const std::string &prompt) {
  std::cout << prompt;
  std::string line;
  if (!std::getline(std::cin, line)) {        // ввод кончился — спрашивать больше нечего
    std::cout << "\nВвод закончился.\n";
    std::exit(0);
  }
  return line;
}

// ---------- 3. Расчёты: маленькие функции с понятными именами ----------
double averageScore(const std::vector<Student> &group) {
  if (group.empty())
    return 0.0;
  int sum = 0;
  for (const auto &s : group)
    sum += s.score;
  return static_cast<double>(sum) / static_cast<double>(group.size());
}

// ---------- 4. Вывод ----------
void printTable(const std::vector<Student> &group) {
  std::cout << std::format("{:<12}{:>6}\n", "Имя", "Балл");
  std::cout << std::format("{:-<18}\n", "");
  for (const auto &s : group)
    std::cout << std::format("{:<12}{:>6}\n", s.name, s.score);
}

bool saveToFile(const std::vector<Student> &group, const std::string &path) {
  std::ofstream out(path);
  if (!out.is_open())
    return false;
  for (const auto &s : group)
    out << std::format("{};{}\n", s.name, s.score);
  return true;
}

int main() {
  SetConsoleCP(CP_UTF8);
  SetConsoleOutputCP(CP_UTF8);

  std::vector<Student> group;

  int count = readIntInRange("Сколько студентов (1-100): ", 1, 100);
  for (int i = 0; i < count; ++i) {
    std::cout << std::format("\n--- Студент {} из {} ---\n", i + 1, count);
    Student s;
    s.name = readLine("Имя: ");
    if (s.name.empty())                            // пустое имя в таблице выглядит
      s.name = std::format("Без имени {}", i + 1); // как потерянная строка
    s.score = readIntInRange("Балл (0-100): ", 0, 100);
    group.push_back(s);
  }

  std::sort(group.begin(), group.end(),
            [](const Student &a, const Student &b) { return a.score > b.score; });

  std::cout << "\n";
  printTable(group);

  double avg = averageScore(group);
  std::cout << std::format("\nСредний балл: {:.2f}\n", avg);
  std::cout << std::format("Лучший: {} ({})\n", group.front().name, group.front().score);

  std::cout << "Выше среднего: ";
  for (const auto &s : group)
    if (s.score > avg)
      std::cout << s.name << " ";
  std::cout << "\n";

  if (saveToFile(group, "result.txt"))
    std::cout << "Сохранено в result.txt\n";
  else
    std::cout << "Не удалось записать файл\n";
  return 0;
}
```

## Что происходит при запуске

_Ввод: 3 студента — Аня 95, Борис 70, Вика 88_

```
Сколько студентов (1-100): 
--- Студент 1 из 3 ---
Имя: Балл (0-100): 
--- Студент 2 из 3 ---
Имя: Балл (0-100): 
--- Студент 3 из 3 ---
Имя: Балл (0-100): 
Имя           Балл
------------------
Аня             95
Вика            88
Борис           70

Средний балл: 84.33
Лучший: Аня (95)
Выше среднего: Аня Вика 
Сохранено в result.txt
```

Рядом появится `result.txt`:

```
Аня;95
Вика;88
Борис;70
```

### Что здесь стоит заметить

**Каждая функция отвечает на один вопрос.** `readInt` — «как получить число»; `averageScore` — «как посчитать среднее»; `printTable` — «как показать». Из-за этого `main` читается как оглавление: собрать данные → отсортировать → показать → сохранить. Пока функция помещается на экран целиком, её легко чинить.

**`readIntInRange` построен поверх `readInt`, а не написан заново.** Сначала гарантируем, что это вообще число, потом проверяем границы. Так проверки не путаются друг с другом.

**В `readInt` есть `ignore` даже после удачного чтения.** После `std::cin >> value` в буфере остаётся Enter, и следующий `std::getline` прочитал бы пустую строку (ловушка из [раздела 4](../ref/02-vvod-vyvod.md#4-ввод-и-вывод)). Здесь ввод числа и ввод имени идут вперемешку, поэтому буфер чистится **всегда**, а не только при ошибке.

**`averageScore` возвращает `0.0` для пустого списка.** Без этой строки было бы деление на ноль и `nan`, который потом молча испортил бы сравнение `s.score > avg` ([раздел 5](../ref/03-logika-cikly.md#5-арифметика-и-её-ловушки)).

**`saveToFile` возвращает `bool`, а не печатает сам.** Функция делает своё дело и сообщает результат; решение, что писать пользователю, принимает `main`. Так функцию можно использовать и там, где печатать ничего не надо.

**Структура `Student` передаётся как `const Student &`.** Копировать строку на каждом витке цикла незачем, а `const` гарантирует, что функция ничего не испортит.

**Пустое имя заменяется на «Без имени N».** Если просто нажать Enter в ответ на «Имя:», `getline` вернёт пустую строку — и в таблице появится строка без имени с баллом непонятно чьим. Программа не сломается, но результат станет бессмысленным. Это не «настоящий» баг, а недосмотр удобства, и найден он тем же способом: прогнать программу с пустым вводом.

### Как её запускать

Сохрани в `main.cpp`, нажми `Ctrl+Alt+R`. Пример сеанса:

```
Сколько студентов (1-100): 3

--- Студент 1 из 3 ---
Имя: Аня
Балл (0-100): 95

--- Студент 2 из 3 ---
Имя: Борис
Балл (0-100): 70

--- Студент 3 из 3 ---
Имя: Вика
Балл (0-100): 88

Имя           Балл
------------------
Аня             95
Вика            88
Борис           70

Средний балл: 84.33
Лучший: Аня (95)
Выше среднего: Аня Вика
Сохранено в result.txt
```

Рядом появится `result.txt`:

```
Аня;95
Вика;88
Борис;70
```

### Что попробовать изменить

Читать чужую программу полезно, менять — полезнее. Пять задач по возрастанию сложности:

1. Добавь в таблицу столбец «место» (1, 2, 3) — понадобится счётчик и `{:>4}`.
2. Выведи не только лучшего, но и худшего — через `group.back()`. Что будет, если список пуст?
3. Добавь второй критерий сортировки: при равных баллах — по имени (см. [раздел 18](../ref/07-algoritmy.md#18-алгоритмы)).
4. Спроси в конце «показать только тех, у кого больше N баллов?» и покажи их отдельной таблицей.
5. Научи программу **читать** `result.txt` обратно в `vector<Student>` — пригодится `std::getline` с разделителем `;` ([раздел 21](../ref/08-struct-fayly.md#21-файлы)).

---

---

[← Все примеры](README.md) · [← Крестики-нолики](07-krestiki-noliki.md) · [Проверка пароля →](09-parol.md) · [Начни отсюда](../00-НАЧНИ-ОТСЮДА.md)
