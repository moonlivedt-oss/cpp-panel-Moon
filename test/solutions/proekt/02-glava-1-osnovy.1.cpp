// Эталон к «Подземелье», квест 1 — проверяется scripts/check-challenges.js.
#include <iostream>
#include <string>

int main() {
  std::string name = "Торин";
  int hp = 30;
  int maxHp = 30;
  int gold = 0;
  int attack = 5;

  hp -= 7;    // ловушка
  gold += 12; // нашёл кошелёк

  std::cout << name << " | HP " << hp << "/" << maxHp << " | золото " << gold
            << " | атака " << attack << "\n";
}
