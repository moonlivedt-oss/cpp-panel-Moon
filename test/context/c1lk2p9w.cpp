// Контекст для check-challenges: ref/20 — виртуальный вызов и срезка.
class Shape {
 public:
  virtual ~Shape() = default;
  virtual double area() const { return 0; }
};
class Circle : public Shape {
 public:
  explicit Circle(double r) : r_(r) {}
  double area() const override { return 3.14159265358979 * r_ * r_; }
 private:
  double r_;
};
