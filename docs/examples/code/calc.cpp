// Калькулятор с меню.
// Показывает: do-while меню, enum class, switch, функции, защита от деления на ноль.

#include <windows.h>        // только Windows: русские буквы в консоли

#include <cmath>            // std::isinf, std::isnan
#include <cstdlib>          // std::exit
#include <format>           // std::format
#include <iostream>         // std::cin, std::cout
#include <limits>           // std::numeric_limits — для cin.ignore
#include <string>           // std::string

// Пункты меню. enum class даёт числам имена: Divide понятнее, чем 4.
enum class Operation {
  Add = 1,
  Subtract = 2,
  Multiply = 3,
  Divide = 4,
  Power = 5,
  Quit = 0
};

// Читает целое число. Не выйдет, пока пользователь не введёт именно число.
int readInt(const std::string &prompt) {
  int value = 0;
  while (true) {
    std::cout << prompt;
    if (std::cin >> value) {                 // поток в условии = «чтение удалось?»
      std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
      return value;
    }
    if (std::cin.eof()) {                    // ввод кончился (Ctrl+Z или конец файла)
      std::cout << "\nВвод закончился.\n";   // без неё цикл крутился бы вечно
      std::exit(0);
    }
    std::cin.clear();                        // снимаем флаг ошибки
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');  // чистим буфер
    std::cout << "Это не число. Попробуйте снова.\n";
  }
}

// То же самое для дробных: калькулятор должен уметь 2.5
double readDouble(const std::string &prompt) {
  double value = 0.0;
  while (true) {
    std::cout << prompt;
    if (std::cin >> value) {
      std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
      return value;
    }
    if (std::cin.eof()) {                    // ввод кончился (Ctrl+Z или конец файла)
      std::cout << "\nВвод закончился.\n";   // без неё цикл крутился бы вечно
      std::exit(0);
    }
    std::cin.clear();
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
    std::cout << "Это не число. Попробуйте снова.\n";
  }
}

void printMenu() {
  std::cout << "\n=== Калькулятор ===\n"
            << "1 - сложение\n"
            << "2 - вычитание\n"
            << "3 - умножение\n"
            << "4 - деление\n"
            << "5 - возведение в степень\n"
            << "0 - выход\n";
}

// Возводит в степень своим циклом, чтобы не тянуть std::pow ради целой степени.
// Возвращает false, если посчитать нельзя — тогда result не трогается.
bool power(double base, int exponent, double &result) {
  if (base == 0.0 && exponent < 0)      // ⚠️ 0^-2 это 1/0 — деление на ноль.
    return false;                       //    Ловим ДО вычислений, иначе выйдет inf

  double value = 1.0;
  int times = (exponent < 0) ? -exponent : exponent;   // модуль показателя
  for (int i = 0; i < times; ++i)
    value *= base;

  if (exponent < 0)                     // отрицательная степень = 1 / положительная
    value = 1.0 / value;

  if (std::isinf(value) || std::isnan(value))   // ⚠️ 10^400 не влезает даже в double
    return false;                               //    и дальше заразит все расчёты

  result = value;
  return true;
}

int main() {
  SetConsoleCP(CP_UTF8);
  SetConsoleOutputCP(CP_UTF8);

  bool running = true;
  while (running) {                       // главный цикл: меню показывается снова и снова
    printMenu();
    int choice = readInt("Выбор: ");
    Operation op = static_cast<Operation>(choice);   // число -> пункт меню

    if (op == Operation::Quit) {          // выход проверяем ДО ввода чисел:
      std::cout << "Пока!\n";             // спрашивать операнды для выхода незачем
      running = false;
      continue;                           // на следующий виток, где цикл и закончится
    }

    // Сюда попадаем только для настоящих операций
    double a = readDouble("Первое число: ");
    double b = 0.0;
    if (op != Operation::Power)           // у степени второй операнд целый, спросим отдельно
      b = readDouble("Второе число: ");

    switch (op) {
    case Operation::Add:
      std::cout << std::format("{} + {} = {}\n", a, b, a + b);
      break;
    case Operation::Subtract:
      std::cout << std::format("{} - {} = {}\n", a, b, a - b);
      break;
    case Operation::Multiply:
      std::cout << std::format("{} * {} = {}\n", a, b, a * b);
      break;
    case Operation::Divide:
      if (b == 0.0)                       // ✅ проверка ДО деления
        std::cout << "На ноль делить нельзя\n";
      else
        std::cout << std::format("{} / {} = {:.4f}\n", a, b, a / b);
      break;
    case Operation::Power: {              // фигурные скобки: внутри case объявляется переменная
      int exponent = readInt("Степень (целая): ");
      double result = 0.0;
      if (power(a, exponent, result))
        std::cout << std::format("{} ^ {} = {}\n", a, exponent, result);
      else if (a == 0.0)
        std::cout << "Ноль в отрицательной степени — это деление на ноль\n";
      else
        std::cout << "Результат не помещается в double\n";
      break;
    }

    case Operation::Quit:                 // сюда не попадём, но перечислить надо —
      break;                              // иначе -Wall предупредит о необработанном варианте
    default:
      std::cout << "Нет такого пункта меню\n";
      break;
    }
  }
  return 0;
}
