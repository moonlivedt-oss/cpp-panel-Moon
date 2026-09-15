// Список дел: добавить, отметить выполненным, удалить, посмотреть.
// Показывает: vector структур, поиск по номеру, удаление, подсчёт, std::erase_if.

#include <windows.h>

#include <cstdlib>           // std::exit
#include <format>
#include <iostream>
#include <limits>
#include <string>
#include <vector>

struct Task {
  std::string title;      // что сделать
  bool done = false;      // выполнено или нет
};

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

std::string readLine(const std::string &prompt) {
  std::cout << prompt;
  std::string line;
  if (!std::getline(std::cin, line)) {     // ввод кончился — дальше спрашивать нечего
    std::cout << "\nВвод закончился.\n";
    std::exit(0);
  }
  return line;
}

// Показывает список с номерами, начиная с 1 — так привычнее человеку,
// хотя внутри вектора индексы начинаются с 0.
void printTasks(const std::vector<Task> &tasks) {
  if (tasks.empty()) {                       // пустой список — отдельный случай,
    std::cout << "Список пуст.\n";           // иначе человек видит просто ничего и теряется
    return;
  }
  std::cout << "\n--- Дела ---\n";
  for (std::size_t i = 0; i < tasks.size(); ++i) {
    const char *mark = tasks[i].done ? "[x]" : "[ ]";     // галочка или пусто
    std::cout << std::format("{}. {} {}\n", i + 1, mark, tasks[i].title);
  }
  // Считаем выполненные обычным циклом — заодно видно, сколько осталось
  int doneCount = 0;
  for (const auto &t : tasks)
    if (t.done)
      ++doneCount;
  std::cout << std::format("Выполнено {} из {}\n", doneCount, tasks.size());
}

// Возвращает индекс в векторе или -1, если номер неверный.
// Отдельная функция, потому что проверка нужна и при отметке, и при удалении.
int askTaskIndex(const std::vector<Task> &tasks, const std::string &prompt) {
  if (tasks.empty()) {
    std::cout << "Сначала добавьте хотя бы одно дело.\n";
    return -1;
  }
  int number = readInt(prompt);                    // человек вводит 1, 2, 3...
  if (number < 1 || number > static_cast<int>(tasks.size())) {
    std::cout << "Нет дела с таким номером.\n";    // ✅ проверка ДО обращения к вектору
    return -1;
  }
  return number - 1;                               // ...а вектору нужен индекс на 1 меньше
}

int main() {
  SetConsoleCP(CP_UTF8);
  SetConsoleOutputCP(CP_UTF8);

  std::vector<Task> tasks;
  bool running = true;

  while (running) {
    std::cout << "\n1 - показать  2 - добавить  3 - отметить  4 - удалить  "
                 "5 - убрать выполненные  0 - выход\n";
    switch (readInt("Выбор: ")) {
    case 1:
      printTasks(tasks);
      break;

    case 2: {
      std::string title = readLine("Что сделать: ");
      if (title.empty()) {                        // пустое дело добавлять бессмысленно
        std::cout << "Пустое название, отменено.\n";
        break;
      }
      tasks.push_back({title, false});            // собираем Task прямо в push_back
      std::cout << "Добавлено.\n";
      break;
    }

    case 3: {
      int index = askTaskIndex(tasks, "Номер выполненного: ");
      if (index >= 0) {
        tasks[static_cast<std::size_t>(index)].done = true;
        std::cout << "Отмечено.\n";
      }
      break;
    }

    case 4: {
      int index = askTaskIndex(tasks, "Номер для удаления: ");
      if (index >= 0) {
        // erase принимает итератор, поэтому к началу прибавляем номер
        tasks.erase(tasks.begin() + index);
        std::cout << "Удалено.\n";
      }
      break;
    }

    case 5: {
      // Убрать все выполненные разом — одна строка вместо цикла с erase
      std::size_t removed = std::erase_if(tasks, [](const Task &t) { return t.done; });
      std::cout << std::format("Убрано выполненных: {}\n", removed);
      break;
    }

    case 0:
      running = false;
      std::cout << "Пока!\n";
      break;

    default:
      std::cout << "Нет такого пункта.\n";
      break;
    }
  }
  return 0;
}
