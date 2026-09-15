#include <windows.h>
#include <format>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

struct Student {
  std::string name;
  int score = 0;
};

int main() {
  SetConsoleOutputCP(CP_UTF8);
  std::vector<Student> group = {{"Аня", 95}, {"Борис", 70}, {"Вика", 8}};

  // --- Ситуация 1: ровная таблица ---
  // {:<12} — влево в поле 12, {:>5} — вправо в поле 5
  std::cout << std::format("{:<12}{:>5}\n", "Имя", "Балл");
  std::cout << std::format("{:-<17}\n", "");          // линия из дефисов нужной длины
  for (const auto &s : group)
    std::cout << std::format("{:<12}{:>5}\n", s.name, s.score);

  // --- Ситуация 2: число с нужной точностью ---
  double avg = 57.6666;
  std::cout << std::format("Средний балл: {:.2f}\n", avg);      // ровно два знака

  // --- Ситуация 3: собрать строку, а не печатать ---
  std::string title = std::format("Отчёт по группе из {} человек", group.size());
  std::cout << title << "\n";

  // --- Ситуация 4: строка для записи в файл (CSV) ---
  std::ofstream out("format_demo.csv");
  if (out.is_open()) {
    for (const auto &s : group)
      out << std::format("{};{}\n", s.name, s.score);            // тот же приём, другой поток
    std::cout << "Файл записан\n";
  }

  // --- Ситуация 5: понятное сообщение об ошибке ---
  int line = 7;
  std::string bad = "abc;xyz";
  std::cout << std::format("Строка {} испорчена и пропущена: {}\n", line, bad);

  // --- Ситуация 6: аргументы в своём порядке и заполнение ---
  std::cout << std::format("{1} — {0}\n", "результат", "Итог");  // {1} идёт первым
  std::cout << std::format("{:*^21}\n", " МЕНЮ ");               // по центру, звёздочками

  return 0;
}
