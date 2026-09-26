// Эталон к «Подземелье», квест 9.
#include <iostream>
#include <string>

class Hero {
public:
  Hero(std::string name, int maxHp)
      : name_(std::move(name)), hp_(maxHp), maxHp_(maxHp) {}

  bool isAlive() const { return hp_ > 0; }
  void takeDamage(int dmg) {
    if (dmg <= 0)
      return;
    hp_ -= dmg;
    if (hp_ < 0)
      hp_ = 0;
  }
  void heal(int amount) {
    if (!isAlive() || amount <= 0)
      return; // мёртвого не лечим
    hp_ += amount;
    if (hp_ > maxHp_)
      hp_ = maxHp_;
  }
  void addGold(int amount) {
    gold_ += amount;
    if (gold_ < 0)
      gold_ = 0;
  }

  friend std::ostream &operator<<(std::ostream &out, const Hero &h) {
    return out << h.name_ << " HP " << h.hp_ << "/" << h.maxHp_ << " золото "
               << h.gold_;
  }

private:
  std::string name_;
  int hp_ = 0;
  int maxHp_ = 0;
  int gold_ = 0;
};

int main() {
  std::string name;
  int maxHp = 0;
  std::cin >> name >> maxHp;
  Hero hero(name, maxHp);

  std::string cmd;
  int value = 0;
  while (std::cin >> cmd >> value) {
    if (cmd == "урон")
      hero.takeDamage(value);
    else if (cmd == "лечить")
      hero.heal(value);
    else if (cmd == "золото")
      hero.addGold(value);
  }
  std::cout << hero << "\n";
}
