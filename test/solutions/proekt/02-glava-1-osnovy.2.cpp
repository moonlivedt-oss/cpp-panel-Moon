// Эталон к «Подземелье», квест 2.
#include <iostream>
#include <limits>
#include <string>

int main() {
  std::string name;
  std::getline(std::cin, name);

  int cls = 0;
  while (true) {
    if (std::cin >> cls && (cls == 1 || cls == 2))
      break;
    if (!std::cin) {
      if (std::cin.eof())
        return 0;
      std::cin.clear();
    }
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
    std::cout << "Нужен номер 1 или 2\n";
  }

  if (cls == 1)
    std::cout << name << " — воин, HP 40, атака 5\n";
  else
    std::cout << name << " — лучник, HP 30, атака 7\n";
}
