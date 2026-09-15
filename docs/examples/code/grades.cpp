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
