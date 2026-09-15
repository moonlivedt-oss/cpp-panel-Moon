#include <windows.h>
#include <algorithm>
#include <format>
#include <iostream>
#include <string>
#include <vector>

int main() {
  SetConsoleOutputCP(CP_UTF8);

  // --- Ситуация 1: просто список значений ---
  std::vector<int> marks = {5, 4, 5, 3};
  std::cout << "1) оценок: " << marks.size() << ", первая: " << marks.front() << "\n";

  // --- Ситуация 2: стопка (последний пришёл — первый ушёл) ---
  // push_back кладёт наверх, back смотрит наверх, pop_back снимает
  std::vector<std::string> undoStack;
  undoStack.push_back("напечатал текст");
  undoStack.push_back("удалил слово");
  std::cout << "2) отменяем: " << undoStack.back() << "\n";
  undoStack.pop_back();
  std::cout << "   осталось шагов: " << undoStack.size() << "\n";

  // --- Ситуация 3: история/журнал — копим и потом смотрим целиком ---
  std::vector<std::string> log;
  log.push_back("старт");
  log.push_back("расчёт");
  log.push_back("готово");
  std::cout << "3) журнал: ";
  for (const auto &entry : log)         // const & — строки не копируем
    std::cout << entry << " ";
  std::cout << "\n";

  // --- Ситуация 4: таблица (вектор векторов) ---
  std::vector<std::vector<int>> table(3, std::vector<int>(3, 0));   // 3x3 нулями
  for (std::size_t r = 0; r < table.size(); ++r)
    for (std::size_t c = 0; c < table[r].size(); ++c)
      table[r][c] = static_cast<int>((r + 1) * (c + 1));            // таблица умножения
  std::cout << "4) table[2][2] = " << table[2][2] << "\n";

  // --- Ситуация 5: буфер для отобранных элементов ---
  std::vector<int> all = {5, -3, 9, -1, 4};
  std::vector<int> positives;                 // сюда складываем подходящие
  positives.reserve(all.size());              // необязательно: заранее просим память
  for (int x : all)
    if (x > 0)
      positives.push_back(x);
  std::cout << "5) положительных: " << positives.size() << "\n";

  // --- Ситуация 6: рабочая копия, чтобы не портить оригинал ---
  std::vector<int> sorted = all;              // копия
  std::sort(sorted.begin(), sorted.end());
  std::cout << std::format("6) оригинал начинается с {}, копия — с {}\n", all[0], sorted[0]);

  return 0;
}
