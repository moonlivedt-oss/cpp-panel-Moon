#include <windows.h>
#include <iostream>
#include <map>
#include <string>
#include <vector>

int main() {
  SetConsoleOutputCP(CP_UTF8);

  // --- Ситуация 1: счётчик. Сколько раз что встретилось ---
  std::vector<std::string> words = {"кот", "пёс", "кот", "ёж", "кот"};
  std::map<std::string, int> counter;
  for (const auto &w : words)
    ++counter[w];                       // нет ключа -> создастся 0 -> станет 1
  std::cout << "1) кот встретился " << counter["кот"] << " раза\n";

  // --- Ситуация 2: справочник. Найти значение по имени ---
  std::map<std::string, std::string> phones = {{"Аня", "+7 900 111"},
                                               {"Борис", "+7 900 222"}};
  auto it = phones.find("Аня");         // find, а не [] — чтобы не создать пустышку
  if (it != phones.end())
    std::cout << "2) телефон Ани: " << it->second << "\n";

  // --- Ситуация 3: группировка. Для каждого ключа — список ---
  std::map<std::string, std::vector<int>> marks;
  marks["Аня"].push_back(5);            // [] создаст пустой вектор и добавит в него
  marks["Аня"].push_back(4);
  marks["Борис"].push_back(3);
  std::cout << "3) у Ани оценок: " << marks["Аня"].size() << "\n";

  // --- Ситуация 4: таблица перевода. Символ -> значение ---
  // ⚠️ Ключом char берём только латиницу: русская буква в char не помещается
  std::map<char, int> roman = {{'I', 1}, {'V', 5}, {'X', 10}, {'L', 50}};
  int total = 0;
  for (char c : std::string("XVI"))                 // XVI = 10 + 5 + 1
    total += roman.contains(c) ? roman.at(c) : 0;   // неизвестный символ пропускаем
  std::cout << "4) XVI = " << total << "\n";

  // --- Ситуация 5: настройки. Имя параметра -> значение ---
  std::map<std::string, int> settings = {{"ширина", 80}, {"высота", 25}};
  int width = settings.contains("ширина") ? settings.at("ширина") : 100;  // с запасным значением
  std::cout << "5) ширина: " << width << "\n";

  return 0;
}
