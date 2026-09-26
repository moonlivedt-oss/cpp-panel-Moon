// Контекст для check-challenges: igry/08 — решение раненого врага.
enum class Mode { Patrol, Chase, Attack, Flee };
struct Pos { int x = 0; int y = 0; };
struct Enemy {
    Pos pos;
    int hp = 10;
};
int dist(Pos a, Pos b) { return std::abs(a.x - b.x) + std::abs(a.y - b.y); }
// @function Mode think(const Enemy &e, Pos hero)
