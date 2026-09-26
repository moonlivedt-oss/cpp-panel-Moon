// Эталон к «Подземелье», квест 8.
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

struct Record {
  std::string name;
  int gold = 0;
  int steps = 0;
};

// Целое число во всей строке: «12» — да, «12abc», «abc», «» — нет.
bool toInt(const std::string &s, int &out) {
  std::istringstream in(s);
  char extra = 0;
  return static_cast<bool>(in >> out) && !(in >> extra);
}

bool parseRecord(const std::string &line, Record &r) {
  std::istringstream in(line);
  std::string gold, steps;
  if (!std::getline(in, r.name, ';') || !std::getline(in, gold, ';') ||
      !std::getline(in, steps))
    return false;
  return !r.name.empty() && toInt(gold, r.gold) && toInt(steps, r.steps);
}

int main() {
  std::vector<Record> loaded;
  int broken = 0;
  std::string line;
  while (std::getline(std::cin, line)) {
    if (line.empty())
      continue;
    Record r;
    if (parseRecord(line, r))
      loaded.push_back(r);
    else
      ++broken;
  }
  std::cout << "загружено: " << loaded.size() << ", битых: " << broken << "\n";
  if (loaded.empty()) {
    std::cout << "лучший: нет\n";
    return 0;
  }
  const Record *best = &loaded[0];
  for (const auto &r : loaded)
    if (r.gold > best->gold)
      best = &r;
  std::cout << "лучший: " << best->name << " " << best->gold << "\n";
}
