// Контекст для check-challenges: igry/05 — яд на 3 хода.
struct Effect {
    std::string name;
    int perTurn = 0;
    int turnsLeft = 0;
};
struct Unit {
    int hp = 10;
    std::vector<Effect> effects;
};
// @main
Unit unit;
unit.effects.push_back({"яд", 2, 3});
