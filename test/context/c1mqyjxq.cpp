// Контекст для check-challenges: ref/21 — один ход игры.
struct GameState { int turn = 0; };
enum class Command { Wait, Quit };
bool running = true;
void render(const GameState &) {}
Command readInput() { return Command::Quit; }
void update(GameState &s, Command c) {
    ++s.turn;
    if (c == Command::Quit) running = false;
}
// @main
GameState state;
