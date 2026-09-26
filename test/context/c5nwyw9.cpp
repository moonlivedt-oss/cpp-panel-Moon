// Контекст для check-challenges: igry/02 — «собери код»: главный цикл.
enum class State { Menu, Playing, Quit };
State menu() { return State::Playing; }
State play() { return State::Quit; }
