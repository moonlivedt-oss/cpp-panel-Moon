// Проверка пароля по правилам.
// Показывает: std::getline (видит пробелы), перебор символов строки,
//             классификацию символов через <cctype>, набор запрещённых
//             символов, функцию-проверку, которая возвращает отчёт, а не просто
//             «да/нет».

#include <windows.h> // только Windows: русские буквы в консоли

#include <cctype>   // std::isdigit, std::isupper, std::islower
#include <cstddef>  // std::size_t
#include <iostream> // std::cin, std::cout
#include <string>   // std::string, std::getline

// Правила собраны в одном месте — поменять требование потом легко.
constexpr std::size_t kMinLength = 8;
constexpr std::size_t kMaxLength = 20;

// Что вводить нельзя: пробел, табуляция и кавычки часто ломают формы и базы
// данных.
const std::string kForbidden = " \t\"'`\\";

// Отчёт о проверке: какие правила нарушены. Разбито по пунктам, а не одним
// bool, чтобы сказать пользователю не «неверно», а что именно не так.
struct Report {
  bool tooShort = false;
  bool tooLong = false;
  bool hasForbidden = false;
  // первый встреченный запрещённый символ — чтобы назвать его в сообщении
  char forbiddenChar = 0;
  bool noDigit = false;
  bool noUpper = false;
  bool noLower = false;
  bool ok = false;
};

// Один символ — цифра? заглавная? строчная? Заворачиваем <cctype> так, чтобы не
// забыть про static_cast<unsigned char>: isdigit и родня требуют значение,
// представимое как unsigned char. Передать голый char — UB на символах вроде
// байтов кириллицы в UTF-8: у signed char они отрицательные.
bool isDigitCh(char c) {
  return std::isdigit(static_cast<unsigned char>(c)) != 0;
}
bool isUpperCh(char c) {
  return std::isupper(static_cast<unsigned char>(c)) != 0;
}
bool isLowerCh(char c) {
  return std::islower(static_cast<unsigned char>(c)) != 0;
}

Report check(const std::string &password) {
  Report r;
  r.tooShort = password.size() < kMinLength;
  r.tooLong = password.size() > kMaxLength;

  bool digit = false;
  bool upper = false;
  bool lower = false;
  for (char c : password) { // проходим строку символ за символом
    if (!r.hasForbidden && kForbidden.find(c) != std::string::npos) {
      r.hasForbidden = true; // запомнили первый запрещённый и его самого
      r.forbiddenChar = c;
    }
    if (isDigitCh(c))
      digit = true;
    else if (isUpperCh(c))
      upper = true;
    else if (isLowerCh(c))
      lower = true;
  }
  r.noDigit = !digit;
  r.noUpper = !upper;
  r.noLower = !lower;

  // Годится, только когда не нарушено ни одно правило.
  r.ok = !r.tooShort && !r.tooLong && !r.hasForbidden && !r.noDigit &&
         !r.noUpper && !r.noLower;
  return r;
}

void explain(const Report &r) {
  if (r.ok) {
    std::cout << "OK: пароль подходит.\n";
    return;
  }
  std::cout << "Не годится:\n";
  if (r.tooShort)
    std::cout << "   - слишком короткий (нужно минимум " << kMinLength << ")\n";
  if (r.tooLong)
    std::cout << "   - слишком длинный (максимум " << kMaxLength << ")\n";
  if (r.hasForbidden) {
    std::cout << "   - есть запрещённый символ: ";
    if (r.forbiddenChar == ' ')
      std::cout << "пробел";
    else if (r.forbiddenChar == '\t')
      std::cout << "табуляция";
    else
      std::cout << "'" << r.forbiddenChar << "'";
    std::cout << "\n";
  }
  if (r.noDigit)
    std::cout << "   - нет ни одной цифры\n";
  if (r.noUpper)
    std::cout << "   - нет заглавной буквы\n";
  if (r.noLower)
    std::cout << "   - нет строчной буквы\n";
}

int main() {
  SetConsoleCP(CP_UTF8);
  SetConsoleOutputCP(CP_UTF8);

  std::cout << "Придумай пароль: " << kMinLength << "-" << kMaxLength
            << " символов, латиница и цифры,\n"
            << "хотя бы одна цифра, одна заглавная и одна строчная буква,\n"
            << "без пробелов и кавычек. Пустая строка — выход.\n";

  std::string password;
  while (true) {
    std::cout << "\nПароль: ";
    if (!std::getline(std::cin, password)) { // ввод кончился (Ctrl+Z) — выходим
      std::cout << "\nВвод закончился.\n";
      break;
    }
    if (password.empty()) {
      std::cout << "Выход.\n";
      break;
    }
    Report r = check(password); // getline берёт строку целиком —
    explain(r); // значит пробелы внутри увидим и отвергнем
    if (r.ok)
      break; // подошёл — больше спрашивать незачем
  }
  return 0;
}
