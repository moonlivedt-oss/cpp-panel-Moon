#include <windows.h>
#include <cmath>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

int main() {
  SetConsoleOutputCP(CP_UTF8);

  // --- Ситуация 1: разобрать число на цифры ---
  // Условие «пока что-то осталось» — классика для while
  int n = std::abs(-1234);              // ⚠️ модуль сначала, иначе цикл не выполнится
  int digitSum = 0;
  int digitCount = 0;
  while (n > 0) {
    digitSum += n % 10;                 // последняя цифра
    ++digitCount;
    n /= 10;                            // отбрасываем её
  }
  std::cout << "1) сумма цифр 1234 = " << digitSum << ", цифр: " << digitCount << "\n";

  // --- Ситуация 2: перевернуть число ---
  int source = 1234;
  int reversed = 0;
  while (source > 0) {
    reversed = reversed * 10 + source % 10;   // сдвигаем влево и приклеиваем цифру
    source /= 10;
  }
  std::cout << "2) 1234 наоборот = " << reversed << "\n";

  // --- Ситуация 3: читать, пока данные не кончатся ---
  // Условие — сам результат чтения
  std::istringstream input("10 20 30");       // ведёт себя как cin
  int value = 0;
  int sum = 0;
  while (input >> value)                      // поток в условии = «удалось прочитать?»
    sum += value;
  std::cout << "3) сумма из потока: " << sum << "\n";

  // --- Ситуация 4: обработать строки по одной ---
  std::istringstream text("первая\nвторая\nтретья");
  std::string line;
  int lineCount = 0;
  while (std::getline(text, line))
    ++lineCount;
  std::cout << "4) строк: " << lineCount << "\n";

  // --- Ситуация 5: найти все вхождения (сдвигаем позицию) ---
  std::string s = "a-b-c-d";
  std::size_t pos = 0;
  int dashes = 0;
  while ((pos = s.find('-', pos)) != std::string::npos) {
    ++dashes;
    ++pos;                              // ⚠️ без сдвига — вечный цикл на том же месте
  }
  std::cout << "5) дефисов: " << dashes << "\n";

  // --- Ситуация 6: повторять, пока не получим годное значение ---
  std::vector<int> attempts = {-5, 0, 7};     // изображаем ввод пользователя
  std::size_t i = 0;
  int accepted = 0;
  while (i < attempts.size()) {
    if (attempts[i] > 0) {              // условие выхода — «данные годятся»
      accepted = attempts[i];
      break;
    }
    ++i;
  }
  std::cout << "6) первое положительное: " << accepted << "\n";

  return 0;
}
