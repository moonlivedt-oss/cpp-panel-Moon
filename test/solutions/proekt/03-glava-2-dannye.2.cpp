// Эталон к «Подземелье», квест 6.
#include <iostream>
#include <map>
#include <string>

int main() {
  std::map<std::string, int> inv;
  std::string line;
  while (std::getline(std::cin, line)) {
    if (line.rfind("взять ", 0) == 0) {
      ++inv[line.substr(std::string("взять ").size())];
    } else if (line == "выпить зелье") {
      auto it = inv.find("зелье");
      if (it == inv.end()) {
        std::cout << "Зелий нет\n";
        continue;
      }
      if (--it->second == 0)
        inv.erase(it);
      std::cout << "+15 HP\n";
    } else if (line == "инвентарь") {
      if (inv.empty()) {
        std::cout << "пусто\n";
        continue;
      }
      bool first = true;
      for (const auto &[item, count] : inv) {
        std::cout << (first ? "" : ", ") << item << ": " << count;
        first = false;
      }
      std::cout << "\n";
    }
  }
}
