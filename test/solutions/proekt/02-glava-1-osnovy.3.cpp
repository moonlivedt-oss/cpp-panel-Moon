// Эталон к «Подземелье», квест 3.
#include <iostream>

int main() {
  int heroHp = 0, heroAtk = 0, monsterHp = 0, monsterAtk = 0;
  std::cin >> heroHp >> heroAtk >> monsterHp >> monsterAtk;

  int rounds = 0;
  while (heroHp > 0 && monsterHp > 0) {
    ++rounds;
    monsterHp -= heroAtk;
    if (monsterHp > 0)
      heroHp -= monsterAtk;
  }
  if (heroHp > 0)
    std::cout << "победа: HP " << heroHp << ", раундов " << rounds << "\n";
  else
    std::cout << "поражение: раундов " << rounds << "\n";
}
