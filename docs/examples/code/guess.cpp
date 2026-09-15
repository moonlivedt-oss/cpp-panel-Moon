// Игра «угадай число»: компьютер загадал, ты угадываешь.
// Показывает: <random>, цикл с неизвестным числом повторов, подсказки, статистику по партиям.

#include <windows.h>

#include <cstdlib>           // std::exit
#include <format>
#include <iostream>
#include <limits>
#include <random>           // нормальные случайные числа
#include <string>
#include <vector>

int readInt(const std::string &prompt) {
  int value = 0;
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
    std::cout << "Нужно число.\n";
  }
}

// Одна партия. Возвращает, за сколько попыток угадали.
// Генератор передаём по ссылке: если создавать его внутри, он будет
// загадывать одно и то же число каждую партию.
int playRound(std::mt19937 &generator, int low, int high) {
  std::uniform_int_distribution<int> distribution(low, high);
  const int secret = distribution(generator);       // загаданное число
  int attempts = 0;

  std::cout << std::format("\nЯ загадал число от {} до {}.\n", low, high);

  while (true) {                                    // сколько витков — заранее неизвестно
    int guess = readInt("Твой вариант: ");
    ++attempts;

    if (guess < low || guess > high) {              // подсказка, а не отказ
      std::cout << std::format("Это вне диапазона {}..{}, но попытка засчитана.\n", low, high);
      continue;                                     // остаток витка пропускаем
    }
    if (guess < secret) {
      std::cout << "Больше.\n";
    } else if (guess > secret) {
      std::cout << "Меньше.\n";
    } else {
      std::cout << std::format("Угадал! Это было {}. Попыток: {}\n", secret, attempts);
      return attempts;                              // единственный выход из цикла
    }
  }
}

int main() {
  SetConsoleCP(CP_UTF8);
  SetConsoleOutputCP(CP_UTF8);

  std::random_device seedSource;              // источник настоящей случайности
  std::mt19937 generator(seedSource());       // генератор, засеянный от него — создаём ОДИН раз

  std::vector<int> results;                   // сколько попыток заняла каждая партия

  bool playing = true;
  while (playing) {
    int attempts = playRound(generator, 1, 100);
    results.push_back(attempts);

    playing = (readInt("\nЕщё партию? (1 - да, 0 - нет): ") == 1);
  }

  // --- Итоги: считаем только если партии вообще были ---
  if (results.empty()) {                      // сюда попасть нельзя, но привычка полезная
    std::cout << "Партий не было.\n";
    return 0;
  }

  int sum = 0;
  int best = results[0];                      // ⚠️ можно брать [0] — вектор точно не пуст
  for (int r : results) {
    sum += r;
    if (r < best)                             // лучший результат — это МЕНЬШЕ попыток
      best = r;
  }
  double average = static_cast<double>(sum) / static_cast<double>(results.size());

  std::cout << std::format("\n=== Итоги ===\nПартий: {}\nЛучший результат: {} попыток\n"
                           "В среднем: {:.1f}\n",
                           results.size(), best, average);
  return 0;
}
