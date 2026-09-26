// Эталон к «Подземелье», квест 4.
#include <iostream>

void rest(int &hp, int maxHp) {
  hp += 5;
  if (hp > maxHp)
    hp = maxHp;
}

int main() {
  int hp = 0, maxHp = 0, times = 0;
  std::cin >> hp >> maxHp >> times;
  for (int i = 0; i < times; ++i)
    rest(hp, maxHp);
  std::cout << hp << "\n";
}
