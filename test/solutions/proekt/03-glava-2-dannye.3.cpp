// Эталон к «Подземелье», квест 7.
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

struct Record {
  std::string name;
  int gold = 0;
  int steps = 0;
};

int main() {
  int n = 0;
  std::cin >> n;
  std::vector<Record> table(n);
  for (auto &r : table)
    std::cin >> r.name >> r.gold >> r.steps;
  std::string me;
  std::cin >> me;

  std::sort(table.begin(), table.end(), [](const Record &a, const Record &b) {
    if (a.gold != b.gold)
      return a.gold > b.gold;
    return a.steps < b.steps;
  });

  const std::size_t top = std::min<std::size_t>(5, table.size());
  for (std::size_t i = 0; i < top; ++i)
    std::cout << i + 1 << ". " << table[i].name << " " << table[i].gold << " "
              << table[i].steps << "\n";

  auto it = std::find_if(table.begin(), table.end(),
                         [&](const Record &r) { return r.name == me; });
  if (it == table.end())
    std::cout << "Место " << me << ": нет в таблице\n";
  else
    std::cout << "Место " << me << ": " << (it - table.begin()) + 1 << "\n";
}
