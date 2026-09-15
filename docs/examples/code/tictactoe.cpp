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
