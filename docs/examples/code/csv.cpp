// Расходы из файла: читаем CSV, считаем итоги по категориям, записываем отчёт.
// Показывает: чтение файла, разбор строки по разделителю, map для группировки,
//             запись файла, создание файла-примера, если его нет.

#include <windows.h>

#include <algorithm>        // std::sort
#include <cstdlib>          // std::exit
#include <format>
#include <fstream>          // std::ifstream, std::ofstream
#include <iostream>
#include <map>
#include <sstream>          // std::istringstream — разбор одной строки
#include <string>
#include <vector>

struct Expense {
  std::string date;         // 2026-09-01
  std::string category;     // еда
  double amount = 0.0;      // 250.50
};

// Разбирает строку вида "2026-09-01;еда;250.50" на части.
// Возвращает false, если строка кривая — так вызывающий сам решит, что делать.
bool parseLine(const std::string &line, Expense &out) {
  std::istringstream stream(line);
  std::string amountText;

  // getline с третьим аргументом режет не по пробелам, а по нужному символу
  if (!std::getline(stream, out.date, ';'))
    return false;
  if (!std::getline(stream, out.category, ';'))
    return false;
  if (!std::getline(stream, amountText))       // последний кусок — до конца строки
    return false;

  try {
    out.amount = std::stod(amountText);        // строка -> число
  } catch (...) {                              // stod бросает исключение на "абв"
    return false;                              // ловим всё, чтобы программа не упала
  }
  return true;
}

// Если файла нет — создаём с примером, чтобы программу можно было просто запустить.
void createSampleFile(const std::string &path) {
  std::ofstream out(path);
  if (!out.is_open())
    return;
  out << "2026-09-01;еда;250.50\n"
      << "2026-09-01;транспорт;60\n"
      << "2026-09-02;еда;180\n"
      << "2026-09-02;развлечения;900\n"
      << "2026-09-03;еда;320.25\n"
      << "2026-09-03;транспорт;60\n";
  std::cout << std::format("Файла не было — создал пример: {}\n", path);
}

int main() {
  SetConsoleCP(CP_UTF8);
  SetConsoleOutputCP(CP_UTF8);

  const std::string inputPath = "expenses.csv";

  // Первая попытка открыть; если не вышло — создаём пример и пробуем снова
  std::ifstream in(inputPath);
  if (!in.is_open()) {                         // ⚠️ именно is_open(), а не (!in) — см. пояснение
    createSampleFile(inputPath);
    in.clear();                                // ⚠️ ОБЯЗАТЕЛЬНО: после неудачи поток
                                               //    в состоянии ошибки, и open() его не сбросит
    in.open(inputPath);                        // теперь повторное открытие сработает
    if (!in.is_open()) {
      std::cout << "Не удалось ни открыть, ни создать файл.\n";
      return 1;
    }
  }

  std::vector<Expense> expenses;
  std::string line;
  int lineNumber = 0;
  int badLines = 0;

  while (std::getline(in, line)) {             // читаем файл построчно
    ++lineNumber;
    if (line.empty())                          // пустые строки просто пропускаем
      continue;
    Expense e;
    if (parseLine(line, e)) {
      expenses.push_back(e);
    } else {
      ++badLines;                              // не падаем, а считаем и сообщаем в конце
      std::cout << std::format("Строка {} испорчена, пропущена: {}\n", lineNumber, line);
    }
  }

  if (expenses.empty()) {
    std::cout << "Ни одной корректной записи.\n";
    return 1;
  }

  // --- Группировка по категориям ------------------------------------
  std::map<std::string, double> byCategory;    // категория -> сумма
  std::map<std::string, int> countByCategory;  // категория -> сколько покупок
  double total = 0.0;

  for (const auto &e : expenses) {
    byCategory[e.category] += e.amount;        // [] создаст 0.0 и прибавит — здесь это удобно
    ++countByCategory[e.category];
    total += e.amount;
  }

  // --- Вывод --------------------------------------------------------
  std::cout << std::format("\nЗаписей: {}, испорчено: {}\n", expenses.size(), badLines);
  std::cout << std::format("Всего потрачено: {:.2f}\n\n", total);

  // ⚠️ Доля — это деление на total. Если все суммы нулевые, total == 0,
  //    и 100.0 * sum / 0.0 даст nan: в таблице появилось бы "-nan%".
  //    Поэтому колонку с долей показываем, только когда делить осмысленно.
  const bool showShare = (total > 0.0);

  if (showShare)
    std::cout << std::format("{:<15}{:>10}{:>8}{:>9}\n", "Категория", "Сумма", "Штук", "Доля");
  else
    std::cout << std::format("{:<15}{:>10}{:>8}\n", "Категория", "Сумма", "Штук");
  std::cout << std::format("{:-<42}\n", "");

  // map отсортирован по названию; чтобы отсортировать по сумме — перекладываем в вектор
  std::vector<std::pair<std::string, double>> sorted(byCategory.begin(), byCategory.end());
  std::sort(sorted.begin(), sorted.end(),
            [](const auto &a, const auto &b) { return a.second > b.second; });

  for (const auto &[category, sum] : sorted) {
    if (showShare) {
      double share = 100.0 * sum / total;      // сюда попадаем только при total > 0
      std::cout << std::format("{:<15}{:>10.2f}{:>8}{:>8.1f}%\n",
                               category, sum, countByCategory[category], share);
    } else {
      std::cout << std::format("{:<15}{:>10.2f}{:>8}\n",
                               category, sum, countByCategory[category]);
    }
  }

  if (!showShare)
    std::cout << "\n(Доли не показаны: общая сумма равна нулю, делить не на что.)\n";

  // --- Отчёт в файл --------------------------------------------------
  const std::string reportPath = "report.txt";
  std::ofstream report(reportPath);
  if (!report.is_open()) {
    std::cout << "\nОтчёт записать не удалось.\n";
    return 1;
  }
  report << std::format("Всего: {:.2f}\n", total);
  for (const auto &[category, sum] : sorted)
    report << std::format("{};{:.2f}\n", category, sum);

  std::cout << std::format("\nОтчёт сохранён в {}\n", reportPath);
  return 0;
}
