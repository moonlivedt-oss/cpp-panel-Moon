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
