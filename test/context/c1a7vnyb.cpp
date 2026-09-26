// Контекст для check-challenges: ref/13 — конструктор и деструктор (класс Scope из текста выше).
class Scope {
 public:
  Scope(std::string name) : name_(std::move(name)) { std::cout << "+ " << name_ << "\n"; }
  ~Scope() { std::cout << "- " << name_ << "\n"; }
 private:
  std::string name_;
};
