# 7. Крестики-нолики

> **Что показывает:** `vector<vector<char>>`, проверка победы, ничья, смена игрока.
> **Готовый файл:** [code/tictactoe.cpp](code/tictactoe.cpp) — открой и нажми `Ctrl+Alt+R`.
> Собирается без единого предупреждения со всеми строгими флагами.

[← Все примеры](README.md) · [← Телефонная книга](06-telefonnaya-kniga.md) · [Журнал оценок →](08-zhurnal-ocenok.md) · [Начни отсюда](../00-НАЧНИ-ОТСЮДА.md)

---

## Код целиком

```cpp
// Крестики-нолики на двоих.
// Показывает: vector<vector<char>>, ввод координат с проверкой, поиск победителя,
//             ничью, смену игрока.

#include <windows.h>

#include <cstdlib>          // std::exit
#include <format>
#include <iostream>
#include <limits>
#include <string>
#include <vector>

// ⚠️ Не называй это просто SIZE: windows.h уже занял такое имя под свой тип.
const int BOARD_SIZE = 3;           // размер поля
const char EMPTY = '.';             // пустая клетка

using Board = std::vector<std::vector<char>>;   // короткое имя для длинного типа

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

void printBoard(const Board &board) {
  std::cout << "\n   ";
  for (int c = 0; c < BOARD_SIZE; ++c)
    std::cout << std::format("{} ", c + 1);     // шапка со столбцами
  std::cout << "\n";

  for (int r = 0; r < BOARD_SIZE; ++r) {
    std::cout << std::format("{}  ", r + 1);    // номер строки слева
    for (int c = 0; c < BOARD_SIZE; ++c)
      std::cout << board[static_cast<std::size_t>(r)][static_cast<std::size_t>(c)] << " ";
    std::cout << "\n";
  }
}

// Все клетки в ряду одинаковые и не пустые?
bool sameLine(char a, char b, char c) {
  return a != EMPTY && a == b && b == c;
}

// Возвращает символ победителя или EMPTY, если победителя пока нет.
char findWinner(const Board &board) {
  // Строки
  for (std::size_t r = 0; r < BOARD_SIZE; ++r)
    if (sameLine(board[r][0], board[r][1], board[r][2]))
      return board[r][0];

  // Столбцы
  for (std::size_t c = 0; c < BOARD_SIZE; ++c)
    if (sameLine(board[0][c], board[1][c], board[2][c]))
      return board[0][c];

  // Диагонали
  if (sameLine(board[0][0], board[1][1], board[2][2]))
    return board[0][0];
  if (sameLine(board[0][2], board[1][1], board[2][0]))
    return board[0][2];

  return EMPTY;                                  // никто не выиграл
}

// Свободные клетки ещё остались?
bool hasFreeCells(const Board &board) {
  for (const auto &row : board)                  // row — целая строка, const & чтобы не копировать
    for (char cell : row)
      if (cell == EMPTY)
        return true;
  return false;
}

int main() {
  SetConsoleCP(CP_UTF8);
  SetConsoleOutputCP(CP_UTF8);

  // BOARD_SIZE строк, в каждой BOARD_SIZE клеток, все пустые
  Board board(BOARD_SIZE, std::vector<char>(BOARD_SIZE, EMPTY));

  char player = 'X';                             // ходят по очереди, начинает X
  int movesMade = 0;

  std::cout << "Крестики-нолики. Вводите номер строки и столбца (1-3).\n";

  while (true) {
    printBoard(board);
    std::cout << std::format("\nХодит {}\n", player);

    int row = readInt("Строка: ");
    int col = readInt("Столбец: ");

    // Проверка 1: попали ли вообще в поле
    if (row < 1 || row > BOARD_SIZE || col < 1 || col > BOARD_SIZE) {
      std::cout << std::format("Нужно от 1 до {}.\n", BOARD_SIZE);
      continue;                                  // ход не засчитан, игрок не меняется
    }

    std::size_t r = static_cast<std::size_t>(row - 1);   // человек считает с 1, вектор с 0
    std::size_t c = static_cast<std::size_t>(col - 1);

    // Проверка 2: клетка свободна
    if (board[r][c] != EMPTY) {
      std::cout << "Клетка занята, выберите другую.\n";
      continue;
    }

    board[r][c] = player;                        // ход сделан
    ++movesMade;

    char winner = findWinner(board);
    if (winner != EMPTY) {
      printBoard(board);
      std::cout << std::format("\nПобедил {}! Ходов сделано: {}\n", winner, movesMade);
      break;                                     // игра окончена
    }

    if (!hasFreeCells(board)) {                  // поле кончилось, победителя нет
      printBoard(board);
      std::cout << "\nНичья.\n";
      break;
    }

    player = (player == 'X') ? 'O' : 'X';        // передаём ход другому
  }
  return 0;
}
```

## Что происходит при запуске

_Партия целиком: X выиграл по верхней строке_

```
Крестики-нолики. Вводите номер строки и столбца (1-3).

   1 2 3 
1  . . . 
2  . . . 
3  . . . 

Ходит X
Строка: Столбец: 
   1 2 3 
1  X . . 
2  . . . 
3  . . . 

Ходит O
Строка: Столбец: 
   1 2 3 
1  X . . 
2  . O . 
3  . . . 

Ходит X
Строка: Столбец: 
   1 2 3 
1  X X . 
2  . O . 
3  . . . 

Ходит O
Строка: Столбец: 
   1 2 3 
1  X X . 
2  . O . 
3  . . O 

Ходит X
Строка: Столбец: 
   1 2 3 
1  X X X 
2  . O . 
3  . . O 

Победил X! Ходов сделано: 5
```

## Разбор: почему сделано именно так

**`using Board = std::vector<std::vector<char>>;`** — псевдоним типа. Без него этот длинный тип пришлось бы писать в каждой функции, и заголовки стали бы нечитаемыми. Это современная форма `typedef`.

**Поле создаётся как `Board board(BOARD_SIZE, std::vector<char>(BOARD_SIZE, EMPTY));`.** Читается изнутри наружу: сначала строка из `BOARD_SIZE` пустых клеток, потом `BOARD_SIZE` таких строк.

**Константа названа `BOARD_SIZE`, а не `SIZE`.** Просто `SIZE` не соберётся: это имя уже занято в `windows.h` под свой тип, и ошибка будет выглядеть совершенно не по делу. Список занятых имён — в [разделе 1](../ref/01-osnovy.md#1-каркас-и-сборка) в [Основах](../ref/01-osnovy.md).

**`continue` при неверном ходе, а не смена игрока.** Игрок, промахнувшийся мимо поля или ткнувший в занятую клетку, ходит заново — ход не переходит к сопернику. Если бы вместо `continue` шло обычное продолжение, ошибка стоила бы хода.

**Две проверки идут в строгом порядке.** Сначала «попал ли в поле», потом «свободна ли клетка». Поменяй их местами — и `board[r][c]` обратится за границы вектора раньше, чем программа поймёт, что координаты неверные. Это тот же принцип, что у `&&` в [разделе 6](../ref/03-logika-cikly.md#6-сравнения-и-логика).

**`findWinner` возвращает символ, а не `bool`.** Так одним вызовом получаем и факт победы, и имя победителя. Возвращать `EMPTY` как «никто» — тот же приём, что `npos` у строк.

**`sameLine` вынесена отдельно.** Проверка «три одинаковых и не пустые» повторяется восемь раз (3 строки + 3 столбца + 2 диагонали). Одна функция вместо восьми копий условия.

**Ничья проверяется после победы, а не до.** Последний ход может одновременно заполнить поле и выиграть партию. Проверь ничью первой — и победа на девятом ходу превратится в ничью.

## Что попробовать изменить

1. Считай счёт по партиям и предлагай сыграть ещё — как в [Угадай число](04-ugaday-chislo.md).
2. Сделай поле 4×4. Заметь: `BOARD_SIZE` поменять мало — `findWinner` написана под три в ряд, её придётся обобщить циклом.
3. Добавь простейшего компьютерного соперника: ходит в первую свободную клетку. Потом улучши — пусть сначала проверяет, может ли выиграть одним ходом.
4. Запрети «глупый» ввод буквами так, чтобы игра не теряла ход (сейчас `readInt` это уже делает — проверь, как).
5. Сложное: сохраняй партию в файл ходами и научи программу проигрывать её заново.

---

[← Все примеры](README.md) · [← Телефонная книга](06-telefonnaya-kniga.md) · [Журнал оценок →](08-zhurnal-ocenok.md) · [Начни отсюда](../00-НАЧНИ-ОТСЮДА.md)
