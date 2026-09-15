#include <windows.h>
#include <cmath>
#include <format>
#include <iostream>
#include <string>
#include <vector>

// --- Ситуация 1: точка на плоскости — два числа, которые всегда вместе ---
struct Point {
  double x = 0;
  double y = 0;
};

// --- Ситуация 2: запись о человеке — разнородные поля ---
struct Student {
  std::string name;
  int score = 0;
  bool passed = false;
};

// --- Ситуация 3: товар — структура с методом ---
struct Item {
  std::string title;
  double price = 0;
  int count = 0;

  double total() const {          // const = метод ничего не меняет
    return price * count;
  }
};

// --- Ситуация 4: ход в игре — «событие», которое хочется хранить списком ---
struct Move {
  int row = 0;
  int col = 0;
  char player = '.';
};

// --- Ситуация 5: настройки — вместо кучи отдельных переменных ---
struct Settings {
  int width = 80;
  int height = 25;
  bool colors = true;
};

double distance(const Point &a, const Point &b) {   // const & — не копируем и не меняем
  double dx = a.x - b.x;
  double dy = a.y - b.y;
  return std::sqrt(dx * dx + dy * dy);
}

int main() {
  SetConsoleOutputCP(CP_UTF8);

  Point start{0, 0};
  Point finish{3, 4};
  std::cout << std::format("1) расстояние: {:.1f}\n", distance(start, finish));

  Student s{"Аня", 95, true};
  std::cout << std::format("2) {} — {} баллов, сдала: {}\n", s.name, s.score, s.passed);

  Item apple{"яблоки", 120.5, 3};
  std::cout << std::format("3) {} на сумму {:.2f}\n", apple.title, apple.total());

  std::vector<Move> history;              // список ходов — история партии
  history.push_back({1, 1, 'X'});
  history.push_back({2, 2, 'O'});
  std::cout << std::format("4) ходов сделано: {}, последний: {}{}\n",
                           history.size(), history.back().row, history.back().col);

  Settings cfg;                           // все значения по умолчанию уже заданы
  cfg.colors = false;                     // меняем только то, что нужно
  std::cout << std::format("5) окно {}x{}, цвета: {}\n", cfg.width, cfg.height, cfg.colors);

  return 0;
}
