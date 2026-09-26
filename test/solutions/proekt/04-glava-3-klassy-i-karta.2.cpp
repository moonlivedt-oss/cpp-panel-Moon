// Эталон к «Подземелье», квест 10.
#include <iostream>
#include <memory>
#include <string>

class Monster {
public:
  virtual ~Monster() = default;
  virtual int attack() = 0; // урон за один ход
};

class Goblin : public Monster {
public:
  int attack() override { return 2 + 2; } // бьёт дважды по 2
};

class Skeleton : public Monster {
public:
  int attack() override { return 4; }
};

class Dragon : public Monster {
public:
  int attack() override {
    ++turn_;
    return turn_ % 3 == 0 ? 15 : 3; // каждый третий ход — огонь
  }

private:
  int turn_ = 0;
};

std::unique_ptr<Monster> makeMonster(const std::string &kind) {
  if (kind == "гоблин")
    return std::make_unique<Goblin>();
  if (kind == "скелет")
    return std::make_unique<Skeleton>();
  if (kind == "дракон")
    return std::make_unique<Dragon>();
  return nullptr;
}

int main() {
  std::string kind;
  int turns = 0;
  std::cin >> kind >> turns;
  auto m = makeMonster(kind);
  if (!m) {
    std::cout << "нет такого монстра\n";
    return 0;
  }
  int total = 0;
  for (int i = 0; i < turns; ++i)
    total += m->attack();
  std::cout << "урон за " << turns << " ходов: " << total << "\n";
}
