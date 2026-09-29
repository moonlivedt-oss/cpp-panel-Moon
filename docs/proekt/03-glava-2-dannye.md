# Подземелье · Глава 2. Мир из данных

> Квесты 5–8: команды словами, инвентарь и журнал, таблица рекордов, сохранение в файл и случайности.

[← Проект: обзор](01-podzemelye.md) · [← Герой оживает](02-glava-1-osnovy.md) · [Классы и карта →](04-glava-3-klassy-i-karta.md)

---

**К концу главы:** игра понимает текстовые команды, помнит инвентарь, ведёт рекорды и сохраняется между запусками.

## Квест 5. Команды словами

**Нужна тема:** [Строки](../ref/05-stroki.md).

Вместо цифр — команды: `идти`, `отдых`, `статус`, `выход`. Регистр не важен («ИДТИ» тоже работает), лишние пробелы по краям — тоже.

- Команда с аргументом: `идти 3` — пройти сразу три шага (каждый со своей проверкой на монстра).
- Неизвестная команда — «Не понимаю. Команды: …».

**Так будет выглядеть игра после квеста 5** — пример; ваши тексты и числа могут отличаться:

```console
> <<   ИДТИ 3
Шаг 4… тихо.
Шаг 5… тихо.
Шаг 6. Из темноты выходит монстр! (HP 12, атака 3)
…
> << прыгать
Не понимаю. Команды: идти, отдых, статус, выход
```

```checklist
Квест 5 готов, если:
- « Идти  » и «идти» работают одинаково
- «идти 3» делает три шага, «идти» без числа — один
- на неизвестную команду игра подсказывает список
```

**Проверь кирпичик автоматически** — отдельная маленькая программа с тем же приёмом, что нужен в игре. Готовых решений нет; тесты скажут, верно ли.

```challenge
@id crd1xc3
@type run
@hint `std::string c = toUpperRu(cmd);` и сравнивай с `"ИДТИ"`, `"ОТДЫХ"`, … в цепочке `if / else if`.
@hint Число после «идти»: `int n = 1; if (!(in >> n)) n = 1;` — нет числа, значит один шаг. На `выход` — напечатать и `break`.
Кирпичик квеста — разбор команд. Каждая строка ввода — команда, регистр и лишние пробелы не важны. Ответы: `идти` → `идём: 1`, `идти 3` → `идём: 3`, `отдых` → `отдыхаем`, `статус` → `статус`, `выход` → `пока!` (и больше ничего не читать), иначе — `Не понимаю. Команды: идти, отдых, статус, выход`. Функция `toUpperRu` из [темы «Строки»](../ref/05-stroki.md#почему-toupper-не-делает-русские-буквы-заглавными) уже есть в заготовке.
---
#include <cctype>
#include <iostream>
#include <sstream>
#include <string>

// Заглавные буквы для русского и английского текста в UTF-8 (из темы «Строки»).
std::string toUpperRu(const std::string &s) {
    std::string out = s;
    for (std::size_t i = 0; i < out.size(); ++i) {
        unsigned char c = static_cast<unsigned char>(out[i]);
        if (c < 0x80) { out[i] = static_cast<char>(std::toupper(c)); continue; }
        if (i + 1 >= out.size()) break;
        unsigned char n = static_cast<unsigned char>(out[i + 1]);
        if (c == 0xD0 && n >= 0xB0 && n <= 0xBF) out[i + 1] = static_cast<char>(n - 0x20);
        else if (c == 0xD1 && n >= 0x80 && n <= 0x8F) { out[i] = static_cast<char>(0xD0); out[i + 1] = static_cast<char>(n + 0x20); }
        else if (c == 0xD1 && n == 0x91) { out[i] = static_cast<char>(0xD0); out[i + 1] = static_cast<char>(0x81); }
        ++i;
    }
    return out;
}

int main() {
    std::string line;
    while (std::getline(std::cin, line)) {
        std::istringstream in(line);   // in >> cmd сам пропустит пробелы по краям
        std::string cmd;
        if (!(in >> cmd)) continue;    // пустая строка
        // твой код: сравни toUpperRu(cmd) с "ИДТИ", "ОТДЫХ", ...; число после «идти» — in >> n
    }
}
---
идти => идём: 1
статус\n   Идти   2 => статус\nидём: 2
прыгать => Не понимаю. Команды: идти, отдых, статус, выход
Отдых\nВЫХОД\nидти => отдыхаем\nпока!
```

> 💾 **Сохраните версию:** `git add . && git commit -m "Квест 5: Команды словами"` — к ней всегда можно вернуться (`git log`, `git checkout`).

## Квест 6. Инвентарь и журнал

**Нужна тема:** [Контейнеры](../ref/06-konteynery.md).

- Инвентарь — `std::map<std::string, int>`: предмет → количество. С монстра падает «зелье» (каждый второй) или «кость».
- Команды `инвентарь` и `выпить зелье` (+15 HP). Нет зелья — сообщение, а не падение и не создание пустого предмета.
- Журнал событий — `std::vector<std::string>`; команда `журнал` показывает последние 5.

**Так будет выглядеть игра после квеста 6** — пример; ваши тексты и числа могут отличаться:

```console
> << инвентарь
зелье: 2, кость: 1
> << выпить зелье
+15 HP → 40/40. Зелий осталось: 1
> << журнал
Шаг 3: победа над монстром, +10 золота
Шаг 6: победа над монстром, выпало: зелье
Шаг 6: выпито зелье
```

```checklist
Квест 6 готов, если:
- выпитое последнее зелье исчезает из инвентаря, а не остаётся с нулём
- «выпить зелье» без зелий не создаёт запись «зелье: 0»
- журнал хранит все события, а показывает только 5 последних
```

**Проверь кирпичик автоматически** — отдельная маленькая программа с тем же приёмом, что нужен в игре. Готовых решений нет; тесты скажут, верно ли.

```challenge
@id c1e6rcuo
@type run
@hint Взять: `++inv[item];` — `[]` создаст запись с нулём и сразу её увеличит.
@hint Выпить: `auto it = inv.find("зелье");`. Нет — `Зелий нет`. Есть — `--it->second`, а при нуле `inv.erase(it)`.
Кирпичик квеста — инвентарь на `std::map`. Команды построчно: `взять <предмет>` (молча +1), `выпить зелье` (`+15 HP` или `Зелий нет`), `инвентарь` (`предмет: число` через запятую в порядке `map`, либо `пусто`). Последнее выпитое зелье должно **исчезнуть**, а не остаться с нулём.
---
#include <iostream>
#include <map>
#include <string>

int main() {
    std::map<std::string, int> inv;
    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.rfind("взять ", 0) == 0) {          // строка начинается с «взять »
            std::string item = line.substr(std::string("взять ").size());
            // твой код
        } else if (line == "выпить зелье") {
            // твой код: inv.find, а не inv["зелье"] — [] создал бы пустую запись
        } else if (line == "инвентарь") {
            // твой код
        }
    }
}
---
взять зелье\nвыпить зелье\nинвентарь => +15 HP\nпусто
выпить зелье\nинвентарь => Зелий нет\nпусто
взять кость\nвзять зелье\nвзять зелье\nвыпить зелье\nинвентарь => +15 HP\nзелье: 1, кость: 1
```

> 💾 **Сохраните версию:** `git add . && git commit -m "Квест 6: Инвентарь и журнал"` — к ней всегда можно вернуться (`git log`, `git checkout`).

## Квест 7. Таблица рекордов

**Нужна тема:** [Алгоритмы](../ref/07-algoritmy.md).

После конца игры результат (`имя`, `золото`, `шаги`) попадает в таблицу рекордов.

- Сортировка по золоту, при равенстве — у кого меньше шагов (`std::sort` с лямбдой).
- Показать топ-5 и место текущего игрока (`std::find_if`).
- Пока таблица живёт только в памяти — несколько забегов подряд в одном запуске программы («Сыграть ещё? да/нет»).

**Так будет выглядеть игра после квеста 7** — пример; ваши тексты и числа могут отличаться:

```console
Герой пал. Шагов: 21, золото: 60
=== Рекорды ===
1. Мира        90 золота, 30 шагов
2. Торин       60 золота, 21 шаг    ← вы
3. Ланселот    60 золота, 25 шагов
Ваше место: 2
Сыграть ещё? (да/нет) << нет
```

```checklist
Квест 7 готов, если:
- при равном золоте выше тот, кто прошёл меньше шагов
- топ-5 не падает, если игр было меньше пяти
- место текущего игрока верное
```

**Проверь кирпичик автоматически** — отдельная маленькая программа с тем же приёмом, что нужен в игре. Готовых решений нет; тесты скажут, верно ли.

```challenge
@id c1035l4a
@type run
@hint Компаратор: `if (a.gold != b.gold) return a.gold > b.gold; return a.steps < b.steps;`.
@hint Топ — до `std::min<std::size_t>(5, table.size())`. Место — `it - table.begin() + 1`, где `it` вернул `std::find_if`.
Кирпичик квеста — таблица рекордов. Вход: число записей, записи `имя золото шаги`, в конце — имя текущего игрока. Сортировка: больше золота — выше, при равенстве выше тот, у кого меньше шагов. Напечатай топ-5 (`1. Имя золото шаги`) и строку `Место Имя: N`.
---
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
    for (auto &r : table) std::cin >> r.name >> r.gold >> r.steps;
    std::string me;
    std::cin >> me;

    // твой код: std::sort с лямбдой
    // твой код: топ-5 — осторожно, записей может быть меньше пяти
    // твой код: место через std::find_if
}
---
3\nАрагорн 50 20\nБоромир 50 10\nГимли 70 30\nАрагорн => 1. Гимли 70 30\n2. Боромир 50 10\n3. Арагорн 50 20\nМесто Арагорн: 3
1\nФродо 5 99\nФродо => 1. Фродо 5 99\nМесто Фродо: 1
6\nА 1 1\nБ 2 1\nВ 3 1\nГ 4 1\nД 5 1\nЕ 6 1\nА => 1. Е 6 1\n2. Д 5 1\n3. Г 4 1\n4. В 3 1\n5. Б 2 1\nМесто А: 6
```

> 💾 **Сохраните версию:** `git add . && git commit -m "Квест 7: Таблица рекордов"` — к ней всегда можно вернуться (`git log`, `git checkout`).

## Квест 8. Сохранение и случайности

**Нужна тема:** [struct и файлы](../ref/08-struct-fayly.md).

- Соберите героя в `struct Hero`, монстра — в `struct Monster`. Функции теперь принимают `Hero &`.
- Рекорды сохраняются в `records.txt` и загружаются при старте — таблица переживает перезапуск.
- Встреча с монстром теперь случайна (`<random>`, шанс 1 к 3), сила монстра растёт с глубиной.

**Так будет выглядеть игра после квеста 8** — пример; ваши тексты и числа могут отличаться:

```console
Загружено рекордов: 3 (records.txt)
…
Шаг 7, глубина 2. Монстр крепче: HP 16, атака 4
…
Рекорды сохранены в records.txt
```

```checklist
Квест 8 готов, если:
- после перезапуска программы старые рекорды на месте
- первый запуск без файла — не ошибка
- каждая игра проходит по-разному
```

**Проверь кирпичик автоматически** — отдельная маленькая программа с тем же приёмом, что нужен в игре. Готовых решений нет; тесты скажут, верно ли.

```challenge
@id ccs7pen
@type run
@hint `std::istringstream in(line);` и три `std::getline(in, поле, ';')` — если хоть один не удался, строка битая.
@hint Числа проверяй готовой `toInt`: она отвергает и «abc», и «12abc». Пустые строки пропускай ещё до разбора.
Кирпичик квеста — загрузка рекордов. Каждая строка файла — `имя;золото;шаги`. Разбери её в `struct Record`; строку, где не хватает полей или вместо числа текст, пропусти и посчитай как битую (пустые строки не считаются). Итог: `загружено: N, битых: M` и `лучший: Имя золото` (или `лучший: нет`).
---
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

// твой код: bool parseRecord(const std::string &line, Record &r)
//           — std::getline(in, поле, ';') три раза, числа через toInt

int main() {
    std::vector<Record> loaded;
    int broken = 0;
    std::string line;
    while (std::getline(std::cin, line)) {
        // твой код
    }
    // твой код: итог
}
---
Арагорн;50;12\nГимли;70;30 => загружено: 2, битых: 0\nлучший: Гимли 70
Арагорн;50;12\nмусор\nБоромир;abc;3 => загружено: 1, битых: 2\nлучший: Арагорн 50
ерунда => загружено: 0, битых: 1\nлучший: нет
=> загружено: 0, битых: 0\nлучший: нет
```

> 💾 **Сохраните версию:** `git add . && git commit -m "Квест 8: Сохранение и случайности"` — к ней всегда можно вернуться (`git log`, `git checkout`).

## Контрольная точка главы

**Сверься с эталоном.** Глава пройдена — сравни свою игру с одним из возможных вариантов. Окно документации возьмёт открытый в редакторе `.cpp` и покажет построчно, что совпало, чего у тебя нет и что у тебя своё.

```checkpoint
# Игра к концу главы 2
Вариант игры после квестов 5–8: текстовые команды без учёта регистра, инвентарь в `std::map`, журнал в `std::vector`, рекорды с `std::sort` и `std::find_if`, файл `records.txt`, случайные встречи из `<random>` и герой в `struct Hero`.

Открой свой файл игры в редакторе и нажми «Сравнить с моим кодом».
---
#include <windows.h> // только Windows: русские буквы в консоли

#include <algorithm>
#include <cctype>
#include <fstream>
#include <iostream>
#include <map>
#include <random>
#include <sstream>
#include <string>
#include <vector>

struct Hero {
  std::string name;
  int hp = 40;
  int maxHp = 40;
  int attack = 5;
  int gold = 0;
  std::map<std::string, int> inventory; // предмет → сколько
  std::vector<std::string> log;         // журнал событий
};

struct Monster {
  int hp = 12;
  int attack = 3;
};

struct Record {
  std::string name;
  int gold = 0;
  int steps = 0;
};

// Команды без учёта регистра: кириллица в UTF-8 — два байта на букву, toupper
// её не знает.
std::string toUpperRu(const std::string &s) {
  std::string out = s;
  for (std::size_t i = 0; i < out.size(); ++i) {
    unsigned char c = static_cast<unsigned char>(out[i]);
    if (c < 0x80) {
      out[i] = static_cast<char>(std::toupper(c));
      continue;
    }
    if (i + 1 >= out.size())
      break;
    unsigned char n = static_cast<unsigned char>(out[i + 1]);
    if (c == 0xD0 && n >= 0xB0 && n <= 0xBF) {
      out[i + 1] = static_cast<char>(n - 0x20);
    } else if (c == 0xD1 && n >= 0x80 && n <= 0x8F) {
      out[i] = static_cast<char>(0xD0);
      out[i + 1] = static_cast<char>(n + 0x20);
    }
    ++i;
  }
  return out;
}

void note(Hero &hero, int step, const std::string &text) {
  hero.log.push_back("Шаг " + std::to_string(step) + ": " + text);
}

// Монстр крепнет с глубиной: каждые 5 шагов — уровень глубже.
Monster makeMonster(int depth) {
  Monster m;
  m.hp = 12 + 4 * (depth - 1);
  m.attack = 3 + (depth - 1);
  return m;
}

bool fight(Hero &hero, Monster m) {
  while (hero.hp > 0 && m.hp > 0) {
    m.hp -= hero.attack;
    if (m.hp <= 0)
      break;
    hero.hp -= m.attack;
  }
  if (hero.hp < 0)
    hero.hp = 0;
  return hero.hp > 0;
}

std::vector<Record> loadRecords(const std::string &file) {
  std::vector<Record> list;
  std::ifstream in(file);
  Record r;
  while (in >> r.name >> r.gold >> r.steps)
    list.push_back(r);
  return list;
}

void saveRecords(const std::string &file, const std::vector<Record> &list) {
  std::ofstream out(file);
  for (const Record &r : list)
    out << r.name << ' ' << r.gold << ' ' << r.steps << '\n';
}

// Одна игра: возвращает число пройденных шагов.
int play(Hero &hero, std::mt19937 &rng) {
  std::uniform_int_distribution<int> meet(1, 3); // встреча — шанс 1 к 3
  int step = 0;
  std::string line;
  while (hero.hp > 0) {
    std::cout << "> ";
    if (!std::getline(std::cin, line))
      break;
    std::istringstream in(line);
    std::string cmd;
    if (!(in >> cmd))
      continue;
    cmd = toUpperRu(cmd);
    if (cmd == "ИДТИ") {
      int n = 1;
      if (!(in >> n) || n < 1)
        n = 1;
      for (int i = 0; i < n && hero.hp > 0; ++i) {
        ++step;
        int depth = 1 + step / 5;
        if (meet(rng) != 1) {
          std::cout << "Шаг " << step << "… тихо.\n";
          continue;
        }
        Monster m = makeMonster(depth);
        std::cout << "Шаг " << step << ", глубина " << depth << ". Монстр: HP "
                  << m.hp << ", атака " << m.attack << "\n";
        if (!fight(hero, m))
          break;
        hero.gold += 10;
        std::string loot = step % 2 == 0 ? "зелье" : "кость";
        ++hero.inventory[loot];
        note(hero, step, "победа над монстром, выпало: " + loot);
      }
    } else if (cmd == "ОТДЫХ") {
      hero.hp = std::min(hero.maxHp, hero.hp + 5);
    } else if (cmd == "СТАТУС") {
      std::cout << hero.name << " | HP " << hero.hp << "/" << hero.maxHp
                << " | золото " << hero.gold << "\n";
    } else if (cmd == "ИНВЕНТАРЬ") {
      for (const auto &[item, count] : hero.inventory)
        std::cout << item << ": " << count << "\n";
    } else if (cmd == "ВЫПИТЬ") {
      auto it =
          hero.inventory.find("зелье"); // find, а не [] — не создаёт «зелье: 0»
      if (it == hero.inventory.end()) {
        std::cout << "Зелий нет.\n";
        continue;
      }
      hero.hp = std::min(hero.maxHp, hero.hp + 15);
      if (--it->second == 0)
        hero.inventory.erase(it);
      note(hero, step, "выпито зелье");
    } else if (cmd == "ЖУРНАЛ") {
      std::size_t from = hero.log.size() > 5 ? hero.log.size() - 5 : 0;
      for (std::size_t i = from; i < hero.log.size(); ++i)
        std::cout << hero.log[i] << "\n";
    } else if (cmd == "ВЫХОД") {
      break;
    } else {
      std::cout << "Не понимаю. Команды: идти, отдых, статус, инвентарь, "
                   "выпить зелье, журнал, выход\n";
    }
  }
  return step;
}

int main() {
  SetConsoleCP(CP_UTF8);
  SetConsoleOutputCP(CP_UTF8);

  const std::string file = "records.txt";
  std::vector<Record> records = loadRecords(file);
  std::cout << "Загружено рекордов: " << records.size() << "\n";
  std::mt19937 rng(std::random_device{}());

  std::string again = "да";
  while (again == "да") {
    Hero hero;
    std::cout << "Как зовут героя? ";
    std::getline(std::cin, hero.name);
    if (hero.name.empty())
      hero.name = "Безымянный";
    int steps = play(hero, rng);
    std::cout << "Конец забега. Шагов: " << steps << ", золото: " << hero.gold
              << "\n";

    std::string key = hero.name;
    std::replace(key.begin(), key.end(), ' ',
                 '_'); // имя в файле — одним словом
    records.push_back({key, hero.gold, steps});
    std::sort(records.begin(), records.end(),
              [](const Record &a, const Record &b) {
                return a.gold != b.gold ? a.gold > b.gold : a.steps < b.steps;
              });
    auto me =
        std::find_if(records.begin(), records.end(), [&](const Record &r) {
          return r.name == key && r.gold == hero.gold && r.steps == steps;
        });
    for (std::size_t i = 0; i < records.size() && i < 5; ++i) {
      std::cout << i + 1 << ". " << records[i].name << "  " << records[i].gold
                << " золота, " << records[i].steps << " шагов\n";
    }
    std::cout << "Ваше место: " << (me - records.begin()) + 1 << "\n";
    saveRecords(file, records);

    std::cout << "Сыграть ещё? (да/нет) ";
    if (!std::getline(std::cin, again))
      break;
  }
}
```

---

**Дальше:** [Глава 3. Классы и карта](04-glava-3-klassy-i-karta.md)
