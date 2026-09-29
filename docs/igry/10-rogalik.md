# Финал: собери рогалик

> Все девять тем раздела в одной игре: пещера из семени, монстры, которые ищут путь и убегают раненые, сундуки с весами, яд, цветной экран, меню и сохранения. Около трёхсот строк, которые можно собрать и сыграть прямо сейчас, — и шесть способов прокачать игру самому.
>
> Нужна база: все темы раздела «Создание игр» — от [времени и игрового цикла](01-vremya-i-cikl.md) до [ИИ врагов](08-ii-vragov.md).

[← Физика прыжка](09-fizika-pryzhka.md) · [Создание игр: начало](01-vremya-i-cikl.md) · [Сквозной проект](../proekt/01-podzemelye.md)

---

## Что в этом файле

- [За 30 секунд](#за-30-секунд)
- [Какая игра получится](#какая-игра-получится)
- [Карта кода: где какая тема](#карта-кода-где-какая-тема)
- [Полный код](#полный-код)
- [Как читать этот код](#как-читать-этот-код)
- [Прокачай игру](#прокачай-игру)
- [Проверь себя](#проверь-себя)
- [Босс темы](#босс-темы)

---

### За 30 секунд

- Это **рогалик**: пошаговая игра на сетке, каждый забег — новый мир, смерть — навсегда.
- Мир строится из **семени**: одно число → одна и та же пещера, монстры и сундуки. Поэтому сохранению хватает семени и номера этажа.
- Монстры идут к герою по **одной волне BFS**, посчитанной от героя, — а не каждый свою.
- Игра — **машина состояний**: меню → игра → «герой пал» → меню.
- Код — одна программа без сторонних библиотек: собирается на Windows, Linux и macOS.

## Какая игра получится

Вот кусок настоящей партии (мир по семени 42):

```console
################################
###############  ##      g     #
##############  o              #
##############     #           #
############      #    g $   @ #
###########      ##           ##
############ #   ##         $  #
############> #####            #
############# # ####         ###
###########        o         ###
#################       $    ###
################################
HP 26/30 | атака 5 | золото 0 | этаж 1
  Гоблин бьёт на 2
  Вы бьёте: Гоблин −5
  Гоблин бьёт на 2
Ход (w a s d, можно «ddd»), сохр, меню: << a
```

`@` — герой, `g` — гоблин, `s` — паук, `o` — орк, `$` — сундук, `>` — лестница вниз. Лестница всегда в **самой дальней** от старта клетке — это тоже волна BFS.

## Карта кода: где какая тема

| Тема | Что делает в игре | Где в коде |
|---|---|---|
| [1. Время](01-vremya-i-cikl.md) | таймер забега в итогах | `Game::started`, экран «герой пал» |
| [2. Состояния](02-sostoyaniya.md) | меню → игра → конец | `enum class State`, цикл в `main` |
| [3. Карта и путь](03-karta-i-put.md) | стены, волна до героя, лестница в дальней клетке | `walkable`, `distFrom`, `buildFloor` |
| [4. Случайность и лут](04-sluchaynost-i-lut.md) | пещера «пьяным шахтёром», семя мира, сундуки 60/30/10 | `makeCave`, `openChest` |
| [5. Сущности и бой](05-sushchnosti-i-boy.md) | одна структура на всех, формула урона, яд, уборка павших | `Unit`, `damage`, `std::erase_if` |
| [6. Консоль как экран](06-konsol-ekran.md) | цвет, кадр одной строкой | `enableConsole`, `draw` |
| [7. Сохранения](07-sokhraneniya.md) | `ключ=значение` с версией, запись через временный файл | `saveGame`, `loadGame` |
| [8. ИИ врагов](08-ii-vragov.md) | погоня, бегство раненого труса, блуждание | `monstersTurn` |
| [9. Физика прыжка](09-fizika-pryzhka.md) | в пошаговой игре не нужна — это задание «секретный уровень» ниже | — |

## Полный код

Сохраните как `rogue.cpp` и соберите:

```bash
g++ -std=c++20 -Wall -Wextra rogue.cpp -o rogue
```

```cpp
// Финал раздела «Создание игр»: рогалик из девяти приёмов.
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <queue>
#include <random>
#include <sstream>
#include <string>
#include <tuple>
#include <vector>
#ifdef _WIN32
#include <windows.h>
#endif

// ---------- Тема 6. Консоль как экран ----------
void enableConsole() {
#ifdef _WIN32
  HANDLE out = GetStdHandle(STD_OUTPUT_HANDLE);
  DWORD mode = 0;
  if (GetConsoleMode(out, &mode))
    SetConsoleMode(out, mode | ENABLE_VIRTUAL_TERMINAL_PROCESSING);
  SetConsoleOutputCP(CP_UTF8);
#endif
}
const std::string RESET = "\x1b[0m", RED = "\x1b[31m", GREEN = "\x1b[32m",
                  YELLOW = "\x1b[33m", CYAN = "\x1b[36m", GRAY = "\x1b[90m";

// ---------- Тема 5. Сущности и бой ----------
struct Unit {
  char glyph = '?';
  std::string name;
  int x = 0, y = 0;
  int hp = 1, maxHp = 1, atk = 1, def = 0;
  int poison = 0;          // сколько ходов ещё действует яд
  bool poisons = false;    // удар отравляет (паук)
  int bravery = 0;         // Тема 8: здоровье ниже bravery % — убегает
};

int damage(const Unit &attacker, const Unit &target) {
  return std::max(1, attacker.atk - target.def);   // хотя бы 1: иначе бой вечный
}

// ---------- Тема 3. Карта ----------
const int W = 32, H = 12;
using Grid = std::vector<std::string>;
using Dist = std::vector<std::vector<int>>;
const int DX[4] = {1, -1, 0, 0}, DY[4] = {0, 0, 1, -1};

bool inside(int x, int y) { return x >= 0 && y >= 0 && x < W && y < H; }
bool walkable(const Grid &g, int x, int y) { return inside(x, y) && g[y][x] != '#'; }

// Волна BFS: сколько шагов от (sx, sy) до каждой клетки (-1 — не дойти).
Dist distFrom(const Grid &g, int sx, int sy) {
  Dist d(H, std::vector<int>(W, -1));
  std::queue<std::pair<int, int>> q;
  d[sy][sx] = 0;
  q.push({sx, sy});
  while (!q.empty()) {
    auto [x, y] = q.front();
    q.pop();
    for (int k = 0; k < 4; ++k) {
      int nx = x + DX[k], ny = y + DY[k];
      if (walkable(g, nx, ny) && d[ny][nx] == -1) {
        d[ny][nx] = d[y][x] + 1;
        q.push({nx, ny});
      }
    }
  }
  return d;
}

// ---------- Тема 4. Случайность: пещера «пьяным шахтёром» ----------
Grid makeCave(std::mt19937 &rng) {
  Grid g(H, std::string(W, '#'));
  std::uniform_int_distribution<int> dir(0, 3);
  int x = W / 2, y = H / 2, dug = 0;
  while (dug < W * H * 40 / 100) {                 // выкопать 40 % поля
    if (g[y][x] == '#') { g[y][x] = '.'; ++dug; }
    int k = dir(rng);
    int nx = x + DX[k], ny = y + DY[k];
    if (nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1) { x = nx; y = ny; }
  }
  return g;
}

std::pair<int, int> freeCell(const Grid &g, std::mt19937 &rng) {
  std::uniform_int_distribution<int> rx(1, W - 2), ry(1, H - 2);
  while (true) {
    int x = rx(rng), y = ry(rng);
    if (g[y][x] == '.') return {x, y};
  }
}

// ---------- Всё состояние забега ----------
struct Game {
  unsigned seed = 0;
  int depth = 1, gold = 0, turns = 0;
  Grid map;
  Unit hero;
  std::vector<Unit> mobs;
  std::vector<std::string> log;
  std::chrono::steady_clock::time_point started;   // Тема 1: таймер забега
};

Unit makeMonster(int kind, int depth) {
  Unit m;
  if (kind == 0)      { m.glyph = 'g'; m.name = "Гоблин"; m.maxHp = 6;  m.atk = 3; m.bravery = 40; }
  else if (kind == 1) { m.glyph = 's'; m.name = "Паук";   m.maxHp = 5;  m.atk = 2; m.poisons = true; }
  else                { m.glyph = 'o'; m.name = "Орк";    m.maxHp = 12; m.atk = 4; m.def = 1; }
  m.maxHp += depth;                                    // глубже — крепче
  m.hp = m.maxHp;
  return m;
}

// Этаж целиком выводится из семени и глубины: одно семя — один и тот же мир (Тема 4).
// Поэтому сохранению не нужно хранить карту — только seed и depth (Тема 7).
void buildFloor(Game &gm) {
  std::mt19937 rng(gm.seed + static_cast<unsigned>(gm.depth) * 7919u);
  gm.map = makeCave(rng);
  auto [hx, hy] = freeCell(gm.map, rng);
  gm.hero.x = hx; gm.hero.y = hy;

  // Лестница — в самую дальнюю от героя клетку (волна из Темы 3).
  Dist d = distFrom(gm.map, hx, hy);
  int bx = hx, by = hy;
  for (int y = 0; y < H; ++y)
    for (int x = 0; x < W; ++x)
      if (d[y][x] > d[by][bx]) { bx = x; by = y; }
  gm.map[by][bx] = '>';

  std::uniform_int_distribution<int> kind(0, 2);
  gm.mobs.clear();
  for (int i = 0; i < 3 + gm.depth; ++i) {
    Unit m = makeMonster(kind(rng), gm.depth);
    std::tie(m.x, m.y) = freeCell(gm.map, rng);
    if (d[m.y][m.x] > 4) gm.mobs.push_back(m);          // не рядом со стартом
  }
  for (int i = 0; i < 3; ++i) {                          // сундуки
    auto [cx, cy] = freeCell(gm.map, rng);
    gm.map[cy][cx] = '$';
  }
}

void newGame(Game &gm, unsigned seed) {
  gm = Game{};
  gm.seed = seed;
  gm.hero.glyph = '@'; gm.hero.name = "Герой";
  gm.hero.maxHp = gm.hero.hp = 30; gm.hero.atk = 5; gm.hero.def = 1;
  gm.started = std::chrono::steady_clock::now();
  buildFloor(gm);
  gm.log.push_back("Семя мира: " + std::to_string(seed) + ". Найдите лестницу >");
}

// ---------- Тема 4. Лут с весами ----------
void openChest(Game &gm, std::mt19937 &rng) {
  std::discrete_distribution<int> loot({60, 30, 10});
  int r = loot(rng);
  if (r == 0) {
    int g = std::uniform_int_distribution<int>(5, 15)(rng);
    gm.gold += g;
    gm.log.push_back("Сундук: " + std::to_string(g) + " золота");
  } else if (r == 1) {
    gm.hero.hp = std::min(gm.hero.maxHp, gm.hero.hp + 10);
    gm.hero.poison = 0;
    gm.log.push_back("Сундук: зелье — +10 HP, яд снят");
  } else {
    ++gm.hero.atk;
    gm.log.push_back("Сундук: ЛЕГЕНДАРНЫЙ меч! Атака " + std::to_string(gm.hero.atk));
  }
}

// ---------- Тема 8. ИИ врагов ----------
void monstersTurn(Game &gm, std::mt19937 &rng) {
  Dist d = distFrom(gm.map, gm.hero.x, gm.hero.y);     // одна волна — на всех монстров
  for (Unit &m : gm.mobs) {
    int here = d[m.y][m.x];
    if (here == 1) {                                     // рядом — бьёт
      int dmg = damage(m, gm.hero);
      gm.hero.hp -= dmg;
      gm.log.push_back(m.name + " бьёт на " + std::to_string(dmg));
      if (m.poisons) { gm.hero.poison = 3; gm.log.push_back("Вы отравлены!"); }
      continue;
    }
    bool scared = m.hp * 100 < m.bravery * m.maxHp;      // ранен и трус — убегает
    bool sees = here >= 0 && here <= 8;
    int bestX = m.x, bestY = m.y, best = here;
    for (int k = 0; k < 4; ++k) {
      int nx = m.x + DX[k], ny = m.y + DY[k];
      if (!walkable(gm.map, nx, ny) || d[ny][nx] < 0) continue;
      bool busy = (nx == gm.hero.x && ny == gm.hero.y) ||
                  std::any_of(gm.mobs.begin(), gm.mobs.end(), [&](const Unit &o) { return o.x == nx && o.y == ny; });
      if (busy) continue;
      if (sees && !scared && d[ny][nx] < best) { best = d[ny][nx]; bestX = nx; bestY = ny; }   // погоня
      if (sees && scared && d[ny][nx] > best)  { best = d[ny][nx]; bestX = nx; bestY = ny; }   // бегство
    }
    if (!sees && std::uniform_int_distribution<int>(0, 3)(rng) == 0) {   // не видит — бродит
      int k = std::uniform_int_distribution<int>(0, 3)(rng);
      if (walkable(gm.map, m.x + DX[k], m.y + DY[k])) { bestX = m.x + DX[k]; bestY = m.y + DY[k]; }
    }
    m.x = bestX; m.y = bestY;
  }
}

// ---------- Ход героя ----------
void heroStep(Game &gm, int dx, int dy, std::mt19937 &rng) {
  int nx = gm.hero.x + dx, ny = gm.hero.y + dy;
  if (!walkable(gm.map, nx, ny)) return;
  auto target = std::find_if(gm.mobs.begin(), gm.mobs.end(), [&](const Unit &m) { return m.x == nx && m.y == ny; });
  if (target != gm.mobs.end()) {                         // шаг в монстра — удар
    int dmg = damage(gm.hero, *target);
    target->hp -= dmg;
    gm.log.push_back("Вы бьёте: " + target->name + " −" + std::to_string(dmg));
  } else {
    gm.hero.x = nx; gm.hero.y = ny;
  }
  // Тема 5: павших убираем одним erase_if — без ловушки erase в цикле.
  std::erase_if(gm.mobs, [&](const Unit &m) {
    if (m.hp > 0) return false;
    gm.gold += 5;
    gm.log.push_back(m.name + " повержен, +5 золота");
    return true;
  });
  char &cell = gm.map[gm.hero.y][gm.hero.x];
  if (cell == '$') { cell = '.'; openChest(gm, rng); }
  if (cell == '>') {
    ++gm.depth;
    buildFloor(gm);
    gm.log.push_back("Вы спускаетесь на этаж " + std::to_string(gm.depth));
    return;
  }
  monstersTurn(gm, rng);
  if (gm.hero.poison > 0) { --gm.hero.hp; --gm.hero.poison; gm.log.push_back("Яд: −1 HP"); }
  ++gm.turns;
}

// ---------- Тема 6. Кадр одной строкой ----------
void draw(const Game &gm) {
  std::string frame = "\x1b[H\x1b[2J";
  for (int y = 0; y < H; ++y) {
    for (int x = 0; x < W; ++x) {
      auto m = std::find_if(gm.mobs.begin(), gm.mobs.end(), [&](const Unit &u) { return u.x == x && u.y == y; });
      if (x == gm.hero.x && y == gm.hero.y) frame += GREEN + "@" + RESET;
      else if (m != gm.mobs.end())          frame += RED + std::string(1, m->glyph) + RESET;
      else if (gm.map[y][x] == '$')          frame += YELLOW + "$" + RESET;
      else if (gm.map[y][x] == '>')          frame += CYAN + ">" + RESET;
      else if (gm.map[y][x] == '#')          frame += GRAY + "#" + RESET;
      else frame += ' ';
    }
    frame += '\n';
  }
  frame += "HP " + std::to_string(std::max(0, gm.hero.hp)) + "/" + std::to_string(gm.hero.maxHp) +
           (gm.hero.poison ? " (яд)" : "") + " | атака " + std::to_string(gm.hero.atk) +
           " | золото " + std::to_string(gm.gold) + " | этаж " + std::to_string(gm.depth) + "\n";
  std::size_t from = gm.log.size() > 4 ? gm.log.size() - 4 : 0;     // последние 4 события
  for (std::size_t i = from; i < gm.log.size(); ++i) frame += "  " + gm.log[i] + "\n";
  frame += "Ход (w a s d, можно «ddd»), сохр, меню: ";
  std::cout << frame << std::flush;
}

// ---------- Тема 7. Сохранения: ключ=значение с версией ----------
bool saveGame(const Game &gm, const std::string &file) {
  std::ofstream out(file + ".tmp");                       // сначала во временный файл
  out << "version=1\nseed=" << gm.seed << "\ndepth=" << gm.depth << "\ngold=" << gm.gold
      << "\nhp=" << gm.hero.hp << "\nmaxHp=" << gm.hero.maxHp << "\natk=" << gm.hero.atk << "\n";
  out.close();
  if (!out) return false;
  std::remove(file.c_str());
  return std::rename((file + ".tmp").c_str(), file.c_str()) == 0;
}

bool loadGame(Game &gm, const std::string &file) {
  std::ifstream in(file);
  if (!in) return false;
  Game g;
  std::string line;
  int version = 0, found = 0;                             // found — сколько обязательных полей прочиталось
  while (std::getline(in, line)) {
    auto eq = line.find('=');
    if (eq == std::string::npos) continue;
    std::string key = line.substr(0, eq);
    std::istringstream val(line.substr(eq + 1));
    long long v = 0;
    if (!(val >> v)) continue;                            // не число — поле считается отсутствующим
    if (key == "version") version = static_cast<int>(v);
    else if (key == "seed")  { g.seed = static_cast<unsigned>(v); ++found; }
    else if (key == "depth") { g.depth = std::max(1, static_cast<int>(v)); ++found; }
    else if (key == "hp")    { g.hero.hp = static_cast<int>(v); ++found; }
    else if (key == "maxHp") { g.hero.maxHp = static_cast<int>(v); ++found; }
    else if (key == "atk")   { g.hero.atk = static_cast<int>(v); ++found; }
    else if (key == "gold")  g.gold = std::max(0, static_cast<int>(v));   // необязательное: нет — будет 0
  }
  // Без любого из пяти обязательных полей игру честно не восстановить — лучше сказать, что файл битый.
  if (version != 1 || found < 5 || g.hero.maxHp <= 0 || g.hero.hp <= 0) return false;
  g.hero.hp = std::min(g.hero.hp, g.hero.maxHp);
  g.hero.glyph = '@'; g.hero.name = "Герой"; g.hero.def = 1;
  g.started = std::chrono::steady_clock::now();
  buildFloor(g);                                          // этаж — заново из семени
  g.log.push_back("Загружено: этаж " + std::to_string(g.depth) + " с начала");
  gm = g;
  return true;
}

// ---------- Тема 2. Состояния игры ----------
enum class State { Menu, Play, Over };

int main() {
  enableConsole();
  const std::string SAVE = "rogue-save.txt";
  std::mt19937 rng(std::random_device{}());
  Game gm;
  State state = State::Menu;
  std::string line;

  while (true) {
    if (state == State::Menu) {
      std::cout << "\n=== РОГАЛИК ===\n1 — новая игра\n2 — продолжить\n3 — мир по семени\n0 — выход\n> ";
      if (!std::getline(std::cin, line) || line == "0") break;
      if (line == "1") { newGame(gm, rng()); state = State::Play; }
      else if (line == "2") {
        if (loadGame(gm, SAVE)) state = State::Play;
        else std::cout << "Сохранения нет или оно повреждено.\n";
      } else if (line == "3") {
        std::cout << "Семя (число): ";
        unsigned seed = 0;
        if (std::getline(std::cin, line) && (std::istringstream(line) >> seed)) { newGame(gm, seed); state = State::Play; }
      }
    } else if (state == State::Play) {
      draw(gm);
      if (!std::getline(std::cin, line)) break;
      if (line == "меню") { state = State::Menu; continue; }
      if (line == "сохр") {
        gm.log.push_back(saveGame(gm, SAVE) ? "Сохранено" : "Не удалось сохранить");
        continue;
      }
      for (char c : line) {                                // «ddd» — три шага
        if (c == 'w') heroStep(gm, 0, -1, rng);
        else if (c == 's') heroStep(gm, 0, 1, rng);
        else if (c == 'a') heroStep(gm, -1, 0, rng);
        else if (c == 'd') heroStep(gm, 1, 0, rng);
        if (gm.hero.hp <= 0) { state = State::Over; break; }
      }
    } else {                                               // State::Over
      auto secs = std::chrono::duration_cast<std::chrono::seconds>(std::chrono::steady_clock::now() - gm.started).count();
      draw(gm);
      std::cout << "\n\nГерой пал на этаже " << gm.depth << ". Золото: " << gm.gold << ", ходов: " << gm.turns
                << ", время забега: " << secs / 60 << " мин " << secs % 60 << " с.\nEnter — в меню";
      std::getline(std::cin, line);
      state = State::Menu;
    }
  }
  std::cout << "\nДо встречи в подземелье!\n";
}
```

## Как читать этот код

Не пытайтесь проглотить триста строк сверху вниз. Читайте **по вопросам игрока**:

1. **Что происходит, когда я нажал `d`?** → `main` (состояние `Play`) → `heroStep`: шаг или удар → уборка павших → сундук или лестница → ход монстров → яд.
2. **Откуда берётся пещера?** → `buildFloor` → `makeCave` + `freeCell`. Весь этаж зависит только от `seed` и `depth`: запустите «мир по семени» дважды с одним числом — пещера совпадёт до клетки.
3. **Как монстр находит героя?** → `monstersTurn`. Волна считается **один раз от героя**, а каждый монстр просто делает шаг в соседнюю клетку с меньшим числом (или с большим — если убегает). Десять монстров — всё равно одна волна.

Три решения, которые стоит унести в свои игры:

- **Мир из семени → маленькое сохранение.** Карту не нужно записывать в файл: её можно построить заново. Плата за это — этаж после загрузки начинается сначала (монстры воскресают). Исправить это — задание ниже.
- **Уборка павших одним `std::erase_if`** сразу после удара — в списке никогда не бывает «монстра с отрицательным здоровьем», и ходить по нему безопасно.
- **Состояние — одно значение `State`**, а не пять флагов. Добавить экран «пауза» или «магазин» = одна новая ветка в `main`.

> 🎮 **В настоящих играх.** Жанр назван в честь Rogue (1980): процедурные подземелья, пошаговые ходы и вечная смерть. Те же идеи живут в Spelunky, Hades и Dead Cells — только уровни там собираются из заготовленных кусков, а не копаются «пьяным шахтёром».

## Прокачай игру

Каждое задание — небольшое и опирается на одну тему. Делайте в любом порядке.

**1. Туман войны** (тема 3). Показывайте только клетки, до которых от героя не больше 6 шагов по волне; остальное — пробелы. Уже виденные клетки можно рисовать серым — «память карты».

```checklist
Туман войны готов, если:
- монстры за стеной не видны, даже если они близко по прямой
- открытые раньше коридоры остаются на карте серыми
```

**2. Лавка на этаже** (темы 2 и 5). На каждом этаже есть торговец `T`. Шаг на него — отдельное состояние `State::Shop`: зелье за 15 золота, +1 к защите за 40.

```checklist
Лавка готова, если:
- в лавке нельзя купить без денег и золото не уходит в минус
- выход из лавки возвращает в игру на то же место
```

**3. Управление без Enter** (тема 6). На Windows замените `std::getline` в состоянии `Play` на `_getch()`: одна клавиша — один шаг, стрелки тоже работают.

```checklist
Управление готово, если:
- w a s d и стрелки двигают героя без Enter
- команда сохранения теперь на клавише (например, F5 или k)
```

**4. Мешок для сундуков** (тема 4). Вместо `discrete_distribution` — мешок на 10 исходов: 6 × золото, 3 × зелье, 1 × меч. Легендарный меч теперь гарантирован за 10 сундуков.

```checklist
Мешок готов, если:
- за любые 10 сундуков подряд выпадает ровно один меч
- мешок перемешивается заново, когда опустеет
```

**5. Сохранение этажа целиком** (тема 7). Сохраняйте ещё и монстров (`mob=g,12,5,4` — вид, x, y, hp) и открытые сундуки, чтобы убитые не воскресали. Поднимите `version` до 2 и научите загрузку читать старые файлы версии 1.

```checklist
Сохранение готово, если:
- после загрузки убитые монстры не возвращаются
- файл версии 1 по-прежнему загружается (этаж — с начала)
```

**6. Секретный уровень** (тема 9). Спрятанная клетка `?` на третьем этаже переносит героя в короткий платформер вида сбоку из [темы про прыжок](09-fizika-pryzhka.md#босс-темы); дошёл до конца — +50 золота и обратно в подземелье.

```checklist
Секретный уровень готов, если:
- рогалик и платформер — разные состояния одной игры
- после платформера герой возвращается на то же место подземелья
```

## Проверь себя

```quiz
В: Почему сохранению хватает `seed` и `depth`, а карту в файл писать не нужно?
+ Этаж строится генератором, заведённым от `seed` и `depth`: одинаковые числа дают одинаковую пещеру
- Карта хранится в `records.txt`
- Карта не меняется между этажами
= Это главная идея «семени мира»: случайность повторяема. Минус — то, что поменялось во время игры (убитые монстры, открытые сундуки), из семени не восстановить.

В: Сколько раз за ход считается волна BFS, если на этаже 7 монстров?
+ Один раз — от героя; каждый монстр смотрит в неё
- Семь раз — от каждого монстра
- Ни разу — монстры ходят случайно
= Волна «от цели» отвечает всем сразу: из любой клетки видно, в какую сторону ближе к герою. Это и есть «карта Дейкстры» из настоящих рогаликов.

В: Гоблин с `maxHp = 7` и `bravery = 40` получил удар и остался с 2 HP. Что он сделает?
+ Убежит: `2 * 100 < 40 * 7`, то есть здоровья меньше 40 %
- Нападёт — гоблины не отступают
- Встанет на месте
= Сравнение без дробей: вместо `hp / maxHp < 0.4` — `hp * 100 < bravery * maxHp`. Так целые числа не теряют точность при делении.

В: Зачем `saveGame` пишет сначала в `rogue-save.txt.tmp`, а потом переименовывает?
+ Если игра упадёт посреди записи, старое сохранение останется целым
- Так быстрее
- Иначе файл нельзя открыть на запись
= Переименование почти мгновенное и не оставляет «половину файла». Приём из [темы про сохранения](07-sokhraneniya.md#запись-которая-не-портит-файл).
```

## Босс темы

```boss
# Дракон на пятом этаже
@id c1dib7se
Добавьте в игру босса — с фазами поведения, как у настоящих боссов.

1. На пятом этаже вместо лестницы — логово: дракон `D` (HP 60, атака 7, защита 2). Пока он жив, лестница не появляется.
2. У дракона три фазы — **машина состояний** из темы 2: «спит» (пока герой дальше 5 шагов по волне), «бой» (ходит и бьёт), «ярость» (HP ниже половины: каждый третий ход дышит огнём на 12 по всем клеткам в 2 шагах от себя).
3. Перед огнём дракон один ход «набирает воздух» и в журнале появляется предупреждение — у игрока есть шанс отойти.
4. Победа — отдельный экран: время забега, золото, число ходов. Результат попадает в таблицу рекордов из [квеста 7](../proekt/03-glava-2-dannye.md#квест-7-таблица-рекордов).

<details>
<summary>Подсказка</summary>

Фазу храните в самом монстре: `enum class Phase { Sleep, Fight, Rage };` и поле `Phase phase` в `Unit` (или в отдельной структуре `Boss`). Огонь — это та же волна BFS, но от дракона: клетки с `d <= 2`.

</details>
```

---

[← Физика прыжка](09-fizika-pryzhka.md) · [Создание игр: начало](01-vremya-i-cikl.md) · [Сквозной проект](../proekt/01-podzemelye.md)
