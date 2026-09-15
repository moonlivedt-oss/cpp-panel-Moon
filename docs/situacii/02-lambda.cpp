#include <windows.h>
#include <algorithm>
#include <iostream>
#include <numeric>
#include <string>
#include <vector>

struct Student {
  std::string name;
  int score = 0;
};

int main() {
  SetConsoleOutputCP(CP_UTF8);
  std::vector<int> v = {5, -3, 9, 1, -8, 4};
  std::vector<Student> group = {{"Аня", 95}, {"Борис", 70}, {"Вика", 88}};

  // --- Ситуация 1: правило сортировки ---
  // Лямбда отвечает на вопрос: «a должен идти раньше b?»
  std::sort(group.begin(), group.end(),
            [](const Student &a, const Student &b) { return a.score > b.score; });
  std::cout << "1) первый после сортировки: " << group[0].name << "\n";

  // --- Ситуация 2: условие отбора ---
  // Лямбда отвечает: «этот элемент подходит?»
  auto negatives = std::count_if(v.begin(), v.end(), [](int x) { return x < 0; });
  std::cout << "2) отрицательных: " << negatives << "\n";

  // --- Ситуация 3: что удалять ---
  std::vector<int> cleaned = v;
  std::erase_if(cleaned, [](int x) { return x < 0; });
  std::cout << "3) осталось после чистки: " << cleaned.size() << "\n";

  // --- Ситуация 4: короткая проверка, которая повторяется ---
  // Вместо того чтобы писать одно и то же условие четыре раза
  auto outOfBoard = [](int coord) { return coord < 1 || coord > 8; };
  int x1 = 3, y1 = 9;
  if (outOfBoard(x1) || outOfBoard(y1))
    std::cout << "4) координаты вне доски\n";

  // --- Ситуация 5: правило накопления ---
  // Лямбда отвечает: «как присоединить очередной элемент к сумме?»
  int totalScore = std::accumulate(group.begin(), group.end(), 0,
                                   [](int sum, const Student &s) { return sum + s.score; });
  std::cout << "5) сумма баллов: " << totalScore << "\n";

  // --- Ситуация 6: лямбда помнит внешнюю переменную (захват) ---
  int limit = 50;
  auto tooBig = [limit](int score) { return score > limit; };   // [limit] — копия значения
  auto goodCount = std::count_if(group.begin(), group.end(),
                                 [&tooBig](const Student &s) { return tooBig(s.score); });
  std::cout << "6) выше " << limit << " баллов: " << goodCount << "\n";

  return 0;
}
