#include <windows.h>
#include <cctype>
#include <iostream>
#include <optional>
#include <string>
#include <vector>

// --- Ситуация 1: функция-проверка. Отвечает «да/нет» ---
bool isLeapYear(int year) {
  return (year % 400 == 0) || (year % 4 == 0 && year % 100 != 0);
}

// --- Ситуация 2: проверка данных с ранним выходом ---
// Как только нашли причину отказа — сразу return, дальше проверять нечего
bool isValidPassword(const std::string &p) {
  if (p.length() < 8)
    return false;
  bool hasDigit = false;
  for (char c : p)
    if (std::isdigit(static_cast<unsigned char>(c)))
      hasDigit = true;
  return hasDigit;
}

// --- Ситуация 3: функция-преобразователь. Из одного вида в другой ---
std::string repeat(const std::string &s, int times) {
  std::string result;
  for (int i = 0; i < times; ++i)
    result += s;
  return result;                       // возврат по значению — копии не будет
}

// --- Ситуация 4: функция, которая может не найти ответ ---
std::optional<std::size_t> findFirstNegative(const std::vector<int> &v) {
  for (std::size_t i = 0; i < v.size(); ++i)
    if (v[i] < 0)
      return i;
  return std::nullopt;                 // честное «не нашлось»
}

// --- Ситуация 5: функция меняет то, что ей дали (ссылка без const) ---
void addBonus(std::vector<int> &scores, int bonus) {
  for (int &s : scores)                // ⚠️ ссылка, иначе изменится копия
    s += bonus;
}

// --- Ситуация 6: функция только читает (const-ссылка) ---
double average(const std::vector<int> &v) {
  if (v.empty())                       // защита: делить на ноль нельзя
    return 0.0;
  long long sum = 0;
  for (int x : v)
    sum += x;
  return static_cast<double>(sum) / static_cast<double>(v.size());
}

int main() {
  SetConsoleOutputCP(CP_UTF8);

  std::cout << "1) 2024 високосный? " << std::boolalpha << isLeapYear(2024) << "\n";
  std::cout << "2) пароль 'abc' годится? " << isValidPassword("abc")
            << ", 'qwerty12' годится? " << isValidPassword("qwerty12") << "\n";
  std::cout << "3) " << repeat("ab", 3) << "\n";

  std::vector<int> v = {5, 3, -2, 8};
  if (auto pos = findFirstNegative(v))            // если значение есть
    std::cout << "4) первое отрицательное на позиции " << *pos << "\n";
  else
    std::cout << "4) отрицательных нет\n";

  std::vector<int> scores = {70, 80};
  addBonus(scores, 5);
  std::cout << "5) после бонуса: " << scores[0] << " и " << scores[1] << "\n";
  std::cout << "6) среднее: " << average(scores) << "\n";

  return 0;
}
