// Телефонная книга, которая помнит записи между запусками.
// Показывает: map вместо vector, find/erase/contains, поиск по части имени,
//             загрузку и сохранение в файл при старте и выходе.

#include <windows.h>

#include <cstdlib>          // std::exit
#include <format>
#include <fstream>
#include <iostream>
#include <limits>
#include <map>
#include <sstream>
#include <string>

const std::string DATA_FILE = "phones.txt";

int readInt(const std::string &prompt) {
  int value = 0;
  while (true) {
    std::cout << prompt;
    if (std::cin >> value) {
      std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
      return value;
    }
    if (std::cin.eof()) {
      std::cout << "\nВвод закончился.\n";
      std::exit(0);
    }
    std::cin.clear();
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
    std::cout << "Нужно число.\n";
  }
}

std::string readLine(const std::string &prompt) {
  std::cout << prompt;
  std::string line;
  if (!std::getline(std::cin, line)) {
    std::cout << "\nВвод закончился.\n";
    std::exit(0);
  }
  return line;
}

// Загружает книгу из файла. Если файла нет — просто вернёт пустую книгу,
// это не ошибка: первый запуск выглядит именно так.
std::map<std::string, std::string> load() {
  std::map<std::string, std::string> book;
  std::ifstream in(DATA_FILE);
  if (!in.is_open())                             // ⚠️ is_open(), а не (!in)
    return book;

  std::string line;
  while (std::getline(in, line)) {
    std::istringstream parts(line);
    std::string name;
    std::string phone;
    if (std::getline(parts, name, ';') && std::getline(parts, phone))
      book[name] = phone;                        // здесь [] уместен: мы именно создаём запись
  }
  return book;                                   // возврат по значению — копии не будет
}

bool save(const std::map<std::string, std::string> &book) {
  std::ofstream out(DATA_FILE);
  if (!out.is_open())
    return false;
  for (const auto &[name, phone] : book)         // перебор словаря: сразу ключ и значение
    out << name << ";" << phone << "\n";
  return true;
}

void printAll(const std::map<std::string, std::string> &book) {
  if (book.empty()) {
    std::cout << "Книга пуста.\n";
    return;
  }
  std::cout << std::format("\n{:<20}{}\n", "Имя", "Телефон");
  std::cout << std::format("{:-<38}\n", "");
  for (const auto &[name, phone] : book)         // map всегда отсортирован по имени
    std::cout << std::format("{:<20}{}\n", name, phone);
  std::cout << std::format("Всего записей: {}\n", book.size());
}

int main() {
  SetConsoleCP(CP_UTF8);
  SetConsoleOutputCP(CP_UTF8);

  std::map<std::string, std::string> book = load();
  std::cout << std::format("Загружено записей: {}\n", book.size());

  bool running = true;
  while (running) {
    std::cout << "\n1 - показать все  2 - добавить  3 - найти  "
                 "4 - удалить  5 - поиск по части имени  0 - выход\n";

    switch (readInt("Выбор: ")) {
    case 1:
      printAll(book);
      break;

    case 2: {
      std::string name = readLine("Имя: ");
      if (name.empty()) {
        std::cout << "Пустое имя.\n";
        break;
      }
      // ⚠️ ';' — разделитель в файле. Пусти его в имя, и строка
      //    "Иванов;Иван;+7 900" при загрузке разберётся как имя "Иванов",
      //    а телефон склеится из остатка. Данные испортятся молча.
      if (name.find(';') != std::string::npos) {
        std::cout << "В имени нельзя ';' — им разделяются поля в файле.\n";
        break;
      }
      if (book.contains(name)) {                 // C++20: есть ли уже такой ключ
        std::cout << std::format("{} уже есть: {}. Заменить? (1 - да): ", name, book[name]);
        if (readInt("") != 1)
          break;                                 // передумали — выходим из case
      }
      std::string phone = readLine("Телефон: ");
      if (phone.empty()) {                       // запись без телефона бесполезна
        std::cout << "Пустой телефон, отменено.\n";
        break;
      }
      if (phone.find(';') != std::string::npos) {
        std::cout << "В телефоне нельзя ';'.\n";
        break;
      }
      book[name] = phone;
      std::cout << "Сохранено.\n";
      break;
    }

    case 3: {
      std::string name = readLine("Кого искать: ");
      auto it = book.find(name);                 // find не создаёт лишних ключей
      if (it != book.end())
        std::cout << std::format("{}: {}\n", it->first, it->second);
      else
        std::cout << "Не найдено.\n";
      break;
    }

    case 4: {
      std::string name = readLine("Кого удалить: ");
      if (book.erase(name) > 0)                  // erase возвращает, сколько удалил
        std::cout << "Удалено.\n";
      else
        std::cout << "Такого не было.\n";
      break;
    }

    case 5: {
      std::string part = readLine("Часть имени: ");
      int found = 0;
      for (const auto &[name, phone] : book) {
        // find у строки возвращает позицию или npos — так проверяют «содержит ли»
        if (name.find(part) != std::string::npos) {
          std::cout << std::format("{}: {}\n", name, phone);
          ++found;
        }
      }
      if (found == 0)
        std::cout << "Совпадений нет.\n";
      break;
    }

    case 0:
      running = false;
      break;

    default:
      std::cout << "Нет такого пункта.\n";
      break;
    }
  }

  if (save(book))                                // сохраняем один раз, при выходе
    std::cout << std::format("Сохранено в {}. Пока!\n", DATA_FILE);
  else
    std::cout << "Не удалось сохранить файл!\n";
  return 0;
}
