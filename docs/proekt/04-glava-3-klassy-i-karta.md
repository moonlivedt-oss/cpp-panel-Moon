# Подземелье · Глава 3. Классы и карта

> Квесты 9–11: класс героя, семейство монстров через наследование и карта подземелья с движением.

[← Проект: обзор](01-podzemelye.md) · [← Мир из данных](03-glava-2-dannye.md) · [Взрослый код →](05-glava-4-vzroslyj-kod.md)

---

**К концу главы:** герой-класс ходит по карте, где его ждут разные монстры со своим поведением.

## Квест 9. Класс героя

**Нужна тема:** [Классы](../ref/13-klassy.md).

`struct Hero` превращается в `class Hero` с закрытыми полями:

- `takeDamage`, `heal`, `addGold` — здоровье всегда в пределах `0…maxHp`, отрицательное золото невозможно;
- `isAlive() const`, `operator<<` для карточки;
- теперь **никакой** код снаружи не может сделать `hp = -100`.

**Так будет выглядеть игра после квеста 9** — пример; ваши тексты и числа могут отличаться:

```console
> << статус
Торин [воин] HP 12/40 | золото 60 | атака 5
```

```checklist
Квест 9 готов, если:
- все поля героя private
- попытка вылечить мёртвого героя ничего не делает (или так задумано и написано в комментарии)
- карточка печатается одной строкой `std::cout << hero;`
```

**Проверь кирпичик автоматически** — отдельная маленькая программа с тем же приёмом, что нужен в игре. Готовых решений нет; тесты скажут, верно ли.

```challenge
@id cc08xih
@type run
@hint После каждого изменения «зажимай» значение: `if (hp_ < 0) hp_ = 0;`, `if (hp_ > maxHp_) hp_ = maxHp_;`.
@hint `heal` у мёртвого — первой строкой `if (!isAlive()) return;`. Золото: `gold_ += amount; if (gold_ < 0) gold_ = 0;`.
Кирпичик квеста — `class Hero` с закрытыми полями. Вход: имя и максимум HP, дальше команды `урон N`, `лечить N`, `золото N` (N может быть отрицательным — это трата). HP всегда в пределах `0…maxHp`, мёртвого не лечим, золото не уходит ниже нуля. В конце — `std::cout << hero;` в виде `Торин HP 12/30 золото 5`.
---
#include <iostream>
#include <string>

class Hero {
public:
    Hero(std::string name, int maxHp) : name_(std::move(name)), hp_(maxHp), maxHp_(maxHp) {}

    bool isAlive() const { return hp_ > 0; }
    // твой код: takeDamage, heal, addGold

    friend std::ostream &operator<<(std::ostream &out, const Hero &h) {
        return out << h.name_ << " HP " << h.hp_ << "/" << h.maxHp_ << " золото " << h.gold_;
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
        // твой код: вызвать нужный метод
    }
    std::cout << hero << "\n";
}
---
Торин 30\nурон 10\nлечить 100\nзолото 7 => Торин HP 30/30 золото 7
Торин 30\nурон 50\nлечить 10 => Торин HP 0/30 золото 0
Торин 30\nзолото 5\nзолото -20 => Торин HP 30/30 золото 0
```

> 💾 **Сохраните версию:** `git add . && git commit -m "Квест 9: Класс героя"` — к ней всегда можно вернуться (`git log`, `git checkout`).

## Квест 10. Зверинец

**Нужна тема:** [Наследование](../ref/20-nasledovanie.md).

- Базовый класс `Monster` с `virtual int attack()` и виртуальным деструктором.
- Наследники: `Goblin` (слабый, быстрый — бьёт дважды), `Skeleton` (обычный), `Dragon` (редкий, раз в 3 хода дышит огнём на 15).
- Встреча создаёт случайного монстра: `std::unique_ptr<Monster>`. Код боя **один** для всех.

**Так будет выглядеть игра после квеста 10** — пример; ваши тексты и числа могут отличаться:

```console
Шаг 9. Гоблин! Бьёт дважды: 2 + 2
…
Шаг 14. ДРАКОН преграждает путь!
Дракон бьёт: 3.
Дракон бьёт: 3.
Дракон дышит огнём: 15!
```

```checklist
Квест 10 готов, если:
- функция боя не знает, какой именно монстр перед ней (нет if по типу)
- добавить нового монстра = написать новый класс, бой не трогать
- у Monster виртуальный деструктор
```

**Проверь кирпичик автоматически** — отдельная маленькая программа с тем же приёмом, что нужен в игре. Готовых решений нет; тесты скажут, верно ли.

```challenge
@id c1cfmrtr
@type run
@hint Каждый монстр — `class Goblin : public Monster { public: int attack() override { ... } };`.
@hint Дракону нужен свой счётчик ходов в поле класса: `++turn_; return turn_ % 3 == 0 ? 15 : 3;`.
Кирпичик квеста — зверинец. Допиши наследников `Monster`: гоблин бьёт **дважды по 2** за ход, скелет — 4, дракон — 3, а каждый третий свой ход дышит огнём на 15. Вход: `вид число-ходов`; цикл в `main` уже один на всех и о видах не знает.
---
#include <iostream>
#include <memory>
#include <string>

class Monster {
public:
    virtual ~Monster() = default;
    virtual int attack() = 0;   // урон за один ход
};

// твой код: class Goblin, class Skeleton, class Dragon (дракону нужен счётчик ходов)

std::unique_ptr<Monster> makeMonster(const std::string &kind) {
    // твой код: "гоблин", "скелет", "дракон" → std::make_unique<...>()
    return nullptr;
}

int main() {
    std::string kind;
    int turns = 0;
    std::cin >> kind >> turns;
    auto m = makeMonster(kind);
    if (!m) { std::cout << "нет такого монстра\n"; return 0; }
    int total = 0;
    for (int i = 0; i < turns; ++i) total += m->attack();
    std::cout << "урон за " << turns << " ходов: " << total << "\n";
}
---
гоблин 3 => урон за 3 ходов: 12
скелет 2 => урон за 2 ходов: 8
дракон 3 => урон за 3 ходов: 21
дракон 7 => урон за 7 ходов: 45
тролль 1 => нет такого монстра
```

> 💾 **Сохраните версию:** `git add . && git commit -m "Квест 10: Зверинец"` — к ней всегда можно вернуться (`git log`, `git checkout`).

## Квест 11. Карта подземелья

**Нужна тема:** [Игра в консоли](../ref/21-igra-v-konsoli.md).

Финал: вместо «идти» — настоящая карта.

- Поле — `std::vector<std::string>`: `#` стены, `.` пол, `@` герой, `M` монстры, `$` золото, `>` выход на следующий уровень.
- Движение `w a s d`; в стену пройти нельзя; наступил на `M` — бой, на `$` — золото.
- Следующий уровень — новая карта и монстры сильнее.

**Так будет выглядеть игра после квеста 11** — пример; ваши тексты и числа могут отличаться:

```console
##########
#@..#...$#
#.#.#.##.#
#.#...M..#
#...##..>#
##########
HP 40/40 | золото 60 | уровень 1
Ход (w/a/s/d): << d
```

```checklist
Квест 11 готов, если:
- герой не проходит сквозь стены и не выходит за край поля
- после боя монстр исчезает с карты
- на выходе `>` начинается новый уровень
```

**Проверь кирпичик автоматически** — отдельная маленькая программа с тем же приёмом, что нужен в игре. Готовых решений нет; тесты скажут, верно ли.

```challenge
@id ci2qztn
@type run
@hint Найди `@`: `map[r].find('@')` в каждой строке; запомни `x`, `y` и замени `@` на `.`.
@hint Ход: посчитай `nx`, `ny`; пропусти, если за краем или `#`; иначе перейди, а на `$` — `gold += 10` и клетку в `.`.
Кирпичик квеста — движение по карте. Вход: число строк, сами строки карты (`#` стена, `.` пол, `@` герой, `$` золото +10), затем ходы `wasd` одной строкой. В стену и за край ходить нельзя, подобранное золото исчезает. Итог: `позиция x y, золото N` (x — столбец, y — строка, с нуля).
---
#include <iostream>
#include <string>
#include <vector>

int main() {
    int rows = 0;
    std::cin >> rows;
    std::vector<std::string> map(rows);
    for (auto &row : map) std::cin >> row;
    std::string moves;
    std::cin >> moves;

    int x = 0, y = 0, gold = 0;
    // твой код: найти '@' и запомнить x, y

    for (char m : moves) {
        // твой код: куда хотим шагнуть; проверить край и '#'; подобрать '$'
    }
    std::cout << "позиция " << x << " " << y << ", золото " << gold << "\n";
}
---
# карта: #####  #@.$#  #.#.#  #####
4\n#####\n#@.$#\n#.#.#\n#####\nddd => позиция 3 1, золото 10
4\n#####\n#@.$#\n#.#.#\n#####\nss => позиция 1 2, золото 0
4\n#####\n#@.$#\n#.#.#\n#####\ndddaaaddd => позиция 3 1, золото 10
```

> 💾 **Сохраните версию:** `git add . && git commit -m "Квест 11: Карта подземелья"` — к ней всегда можно вернуться (`git log`, `git checkout`).

## Контрольная точка главы

**Сверься с эталоном.** Глава пройдена — сравни свою игру с одним из возможных вариантов. Окно документации возьмёт открытый в редакторе `.cpp` и покажет построчно, что совпало, чего у тебя нет и что у тебя своё.

```checkpoint
# Игра к концу главы 3
Вариант игры после квестов 9–11: `class Hero` с закрытыми полями и `operator<<`, зверинец `Goblin`/`Skeleton`/`Dragon` за `std::unique_ptr<Monster>` с одним кодом боя, карта из `std::vector<std::string>` с движением `w a s d` и спуском на следующий уровень.

Открой свой файл игры в редакторе и нажми «Сравнить с моим кодом».
---
#include <windows.h> // только Windows: русские буквы в консоли

#include <algorithm>
#include <iostream>
#include <memory>
#include <random>
#include <string>
#include <utility>
#include <vector>

// Герой: поля закрыты — здоровье всегда в 0…maxHp, золото не уходит в минус.
class Hero {
public:
  Hero(std::string name, std::string cls, int maxHp, int attack)
      : name_(std::move(name)), cls_(std::move(cls)), hp_(maxHp), maxHp_(maxHp),
        attack_(attack) {}

  void takeDamage(int dmg) { hp_ = std::max(0, hp_ - std::max(0, dmg)); }
  void heal(int amount) {
    if (!isAlive())
      return; // мёртвого не лечим — так задумано
    hp_ = std::min(maxHp_, hp_ + std::max(0, amount));
  }
  void addGold(int amount) { gold_ = std::max(0, gold_ + amount); }
  bool isAlive() const { return hp_ > 0; }
  int attack() const { return attack_; }
  int gold() const { return gold_; }

  friend std::ostream &operator<<(std::ostream &out, const Hero &h) {
    return out << h.name_ << " [" << h.cls_ << "] HP " << h.hp_ << "/"
               << h.maxHp_ << " | золото " << h.gold_ << " | атака "
               << h.attack_;
  }

private:
  std::string name_, cls_;
  int hp_, maxHp_, attack_;
  int gold_ = 0;
};

// Зверинец: бой знает только Monster — какой именно монстр, ему всё равно.
class Monster {
public:
  explicit Monster(int hp) : hp_(hp) {}
  virtual ~Monster() = default;
  virtual std::string name() const = 0;
  virtual int attack() = 0; // урон за ход (может печатать, как бьёт)
  void hit(int dmg) { hp_ -= dmg; }
  bool alive() const { return hp_ > 0; }
  int hp() const { return hp_; }

private:
  int hp_;
};

class Goblin : public Monster {
public:
  explicit Goblin(int level) : Monster(8 + 2 * level) {}
  std::string name() const override { return "Гоблин"; }
  int attack() override {
    std::cout << "Гоблин бьёт дважды: 2 + 2\n";
    return 4;
  }
};

class Skeleton : public Monster {
public:
  explicit Skeleton(int level) : Monster(12 + 3 * level), power_(3 + level) {}
  std::string name() const override { return "Скелет"; }
  int attack() override { return power_; }

private:
  int power_;
};

class Dragon : public Monster {
public:
  explicit Dragon(int level) : Monster(30 + 5 * level) {}
  std::string name() const override { return "Дракон"; }
  int attack() override {
    if (++turn_ % 3 == 0) {
      std::cout << "Дракон дышит огнём: 15!\n";
      return 15;
    }
    return 3;
  }

private:
  int turn_ = 0;
};

std::unique_ptr<Monster> randomMonster(std::mt19937 &rng, int level) {
  int roll = std::uniform_int_distribution<int>(1, 10)(rng);
  if (roll <= 5)
    return std::make_unique<Goblin>(level);
  if (roll <= 9)
    return std::make_unique<Skeleton>(level);
  return std::make_unique<Dragon>(level); // редкий
}

// Один код боя для всех монстров.
void fight(Hero &hero, Monster &m) {
  std::cout << m.name() << " преграждает путь! (HP " << m.hp() << ")\n";
  while (hero.isAlive() && m.alive()) {
    m.hit(hero.attack());
    if (!m.alive())
      break;
    hero.takeDamage(m.attack());
  }
  if (hero.isAlive()) {
    hero.addGold(10);
    std::cout << m.name() << " повержен! +10 золота\n";
  }
}

// Уровень: # стены, . пол, @ герой, M монстр, $ золото, > выход.
std::vector<std::string> makeLevel() {
  return {
      "##########", "#@..#...$#", "#.#.#.##.#",
      "#.#...M..#", "#M..##.$>#", "##########",
  };
}

int main() {
  SetConsoleCP(CP_UTF8);
  SetConsoleOutputCP(CP_UTF8);
  std::mt19937 rng(std::random_device{}());

  Hero hero("Торин", "воин", 40, 5);
  int level = 1;
  std::vector<std::string> map = makeLevel();
  int r = 1, c = 1; // где стоит герой

  char cmd = 0;
  while (hero.isAlive()) {
    for (const std::string &row : map)
      std::cout << row << "\n";
    std::cout << hero << " | уровень " << level
              << "\nХод (w/a/s/d, q — выход): ";
    if (!(std::cin >> cmd) || cmd == 'q')
      break;
    int nr = r, nc = c;
    if (cmd == 'w')
      --nr;
    else if (cmd == 's')
      ++nr;
    else if (cmd == 'a')
      --nc;
    else if (cmd == 'd')
      ++nc;
    else
      continue;
    if (nr < 0 || nr >= static_cast<int>(map.size()) || nc < 0 ||
        nc >= static_cast<int>(map[static_cast<std::size_t>(nr)].size()))
      continue;
    char &cell =
        map[static_cast<std::size_t>(nr)][static_cast<std::size_t>(nc)];
    if (cell == '#')
      continue; // в стену не пройти
    if (cell == 'M') {
      std::unique_ptr<Monster> m = randomMonster(rng, level);
      fight(hero, *m);
      if (!hero.isAlive())
        break;
    } else if (cell == '$') {
      hero.addGold(15);
    } else if (cell == '>') {
      ++level;
      map = makeLevel();
      r = 1;
      c = 1;
      std::cout << "Спуск на уровень " << level << ": монстры сильнее.\n";
      continue;
    }
    map[static_cast<std::size_t>(r)][static_cast<std::size_t>(c)] = '.';
    cell = '@'; // монстр после боя исчезает с карты
    r = nr;
    c = nc;
  }
  std::cout << (hero.isAlive() ? "Вы покинули подземелье. " : "Герой пал. ")
            << "Золото: " << hero.gold() << "\n";
}
```

---

**Дальше:** [Глава 4. Взрослый код](05-glava-4-vzroslyj-kod.md)
