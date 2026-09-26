// Контекст для check-challenges: igry/02 — цикл по состояниям.
enum class State { Menu, Playing, GameOver, Quit };
State menu() { return State::Playing; }
State play() { return State::GameOver; }
State gameOver() { return State::Quit; }
