# 3. Анализ текста

> **Что показывает:** `map` как счётчик, `istringstream`, сортировка словаря по значению.
> **Готовый файл:** [code/text.cpp](code/text.cpp) — открой и нажми `Ctrl+Alt+R`.
> Собирается без единого предупреждения со всеми строгими флагами.

[← Все примеры](README.md) · [← Список дел](02-spisok-del.md) · [Угадай число →](04-ugaday-chislo.md) · [Начни отсюда](../00-НАЧНИ-ОТСЮДА.md)

---

## Код целиком

```cpp
// Анализ текста: сколько слов, какие повторяются, самое частое.
// Показывает: map как счётчик, istringstream, сортировку словаря по значению, vector<pair>.

#include <windows.h>

#include <algorithm>        // std::sort
#include <cctype>           // std::tolower, std::ispunct
#include <cstdlib>           // std::exit
#include <format>
#include <iostream>
#include <map>              // std::map — счётчик
#include <sstream>          // std::istringstream — разбор строки на слова
#include <string>
#include <utility>          // std::pair
#include <vector>

// Приводит слово к «чистому» виду: нижний регистр, без знаков препинания по краям.
// Без этого "Кот," и "кот" посчитаются как два разных слова.
std::string normalize(const std::string &word) {
  std::string result;
  for (char c : word) {
    unsigned char uc = static_cast<unsigned char>(c);   // так безопасно для не-ASCII
    if (std::ispunct(uc))                               // точки, запятые — выбрасываем
      continue;
    result += static_cast<char>(std::tolower(uc));      // на латиницу действует, на кириллицу нет
  }
  return result;
}

int main() {
  SetConsoleCP(CP_UTF8);
  SetConsoleOutputCP(CP_UTF8);

  std::cout << "Введите текст одной строкой:\n";
  std::string text;
  std::getline(std::cin, text);              // getline — потому что нужны пробелы

  if (text.empty()) {                        // пустой ввод — считать нечего
    std::cout << "Пустой текст.\n";
    return 1;                                // ✅ выходим сразу, а не считаем нули
  }

  // --- Разбор на слова ---------------------------------------------
  std::istringstream stream(text);           // строка превращается в поток, как cin
  std::map<std::string, int> frequency;      // слово -> сколько раз встретилось
  int totalWords = 0;
  std::string word;

  while (stream >> word) {                   // >> сам режет по пробелам
    std::string clean = normalize(word);
    if (clean.empty())                       // слово было целиком из знаков препинания
      continue;
    ++frequency[clean];                      // нет ключа -> создастся 0 -> станет 1
    ++totalWords;
  }

  if (frequency.empty()) {
    std::cout << "Слов не нашлось.\n";
    return 1;
  }

  // --- Общая статистика --------------------------------------------
  std::cout << std::format("\nВсего слов: {}\n", totalWords);
  std::cout << std::format("Уникальных: {}\n", frequency.size());
  std::cout << std::format("Символов (с пробелами): {}\n", text.length());

  // --- Самое длинное слово -----------------------------------------
  std::string longest;
  for (const auto &[w, count] : frequency)          // перебор словаря: ключ и значение
    if (w.length() > longest.length())
      longest = w;
  std::cout << std::format("Самое длинное: {}\n", longest);

  // --- Топ по частоте ----------------------------------------------
  // map отсортирован по КЛЮЧУ, а нам нужно по ЗНАЧЕНИЮ.
  // Поэтому перекладываем в вектор пар и сортируем его как хотим.
  std::vector<std::pair<std::string, int>> byCount(frequency.begin(), frequency.end());

  std::sort(byCount.begin(), byCount.end(),
            [](const auto &a, const auto &b) {
              if (a.second != b.second)      // главный критерий: частота, по убыванию
                return a.second > b.second;
              return a.first < b.first;      // при равной частоте — по алфавиту
            });

  std::cout << "\n--- Топ-5 слов ---\n";
  for (std::size_t i = 0; i < byCount.size() && i < 5; ++i)   // ✅ && i < size() — защита
    std::cout << std::format("{:<15}{:>3}\n", byCount[i].first, byCount[i].second);

  // --- Повторяющиеся слова -----------------------------------------
  std::cout << "\nПовторяются: ";
  bool anyRepeat = false;
  for (const auto &[w, count] : frequency) {
    if (count > 1) {
      std::cout << w << " ";
      anyRepeat = true;
    }
  }
  if (!anyRepeat)                            // иначе после «Повторяются:» была бы пустота
    std::cout << "(нет)";
  std::cout << "\n";
  return 0;
}
```

## Что происходит при запуске

_Ввод: `the cat sat on the mat, the cat was happy`_

```
Введите текст одной строкой:

Всего слов: 10
Уникальных: 7
Символов (с пробелами): 41
Самое длинное: happy

--- Топ-5 слов ---
the              3
cat              2
happy            1
mat              1
on               1

Повторяются: cat the 
```

## Разбор: почему сделано именно так

**`std::getline`, а не `std::cin >>`.** Оператор `>>` останавливается на первом пробеле и прочитал бы только одно слово. Текст всегда читается через `getline`.

**`normalize` приводит слово к общему виду.** Без неё `"Кот,"` и `"кот"` — два разных ключа в словаре, и статистика разъезжается. Функция убирает знаки препинания и опускает регистр.

**`static_cast<unsigned char>` перед `tolower` и `ispunct`.** У обычного `char` для русских букв значение отрицательное, а эти функции от отрицательного числа дают неопределённое поведение. Подробности — в [разделе 10](../ref/05-stroki.md#10-stdstring) в [Строках](../ref/05-stroki.md).

**`++frequency[clean]` — тот редкий случай, когда `[]` у словаря хорош.** Обычно `[]` при чтении молча создаёт лишний ключ, и это ловушка. Но здесь создание как раз нужно: нового слова ещё нет, `[]` заводит его со значением `0`, а `++` делает `1`.

**Топ-5 считается через `vector<pair>`, а не по словарю.** `map` всегда отсортирован **по ключу** (по алфавиту), а нам нужен порядок **по значению** (по частоте). Перекладываем пары в вектор и сортируем как хотим — приём, который понадобится в любой задаче «покажи самые частые».

**В лямбде сортировки два критерия.** Сначала по частоте убыванием, а при равной частоте — по алфавиту. Без второго критерия слова с одинаковой частотой вставали бы в непредсказуемом порядке, и вывод менялся бы от запуска к запуску.

**`i < byCount.size() && i < 5`.** Если уникальных слов меньше пяти, обращение к `byCount[4]` вышло бы за границы. Сначала проверяем размер, потом лимит.

## Что попробовать изменить

1. Считай не слова, а буквы: `std::map<char, int>` и `++freq[c]` по строке. Что получится с русским текстом и почему?
2. Добавь список стоп-слов (`the`, `a`, `и`, `в`) в `std::set<std::string>` и не учитывай их в топе.
3. Найди самое длинное **предложение**: режь текст по точкам через `std::getline(stream, part, '.')`.
4. Посчитай среднюю длину слова — сумма длин делить на количество (не забудь `static_cast<double>` с обеих сторон).
5. Сложное: читай текст не с клавиатуры, а из файла — понадобится `std::ifstream` и проверка `is_open()` ([раздел 21](../ref/08-struct-fayly.md#21-файлы)).

---

[← Все примеры](README.md) · [← Список дел](02-spisok-del.md) · [Угадай число →](04-ugaday-chislo.md) · [Начни отсюда](../00-НАЧНИ-ОТСЮДА.md)
