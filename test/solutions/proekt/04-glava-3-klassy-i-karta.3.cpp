// Эталон к «Подземелье», квест 11.
#include <iostream>
#include <string>
#include <vector>

int main() {
  int rows = 0;
  std::cin >> rows;
  std::vector<std::string> map(rows);
  for (auto &row : map)
    std::cin >> row;
  std::string moves;
  std::cin >> moves;

  int x = 0, y = 0;
  for (int r = 0; r < rows; ++r) {
    auto c = map[r].find('@');
    if (c != std::string::npos) {
      x = static_cast<int>(c);
      y = r;
      map[r][c] = '.';
    }
  }

  int gold = 0;
  for (char m : moves) {
    int nx = x, ny = y;
    if (m == 'w')
      --ny;
    else if (m == 's')
      ++ny;
    else if (m == 'a')
      --nx;
    else if (m == 'd')
      ++nx;
    else
      continue;
    if (ny < 0 || ny >= rows || nx < 0 ||
        nx >= static_cast<int>(map[ny].size()))
      continue;
    if (map[ny][nx] == '#')
      continue;
    x = nx;
    y = ny;
    if (map[y][x] == '$') {
      gold += 10;
      map[y][x] = '.';
    }
  }
  std::cout << "позиция " << x << " " << y << ", золото " << gold << "\n";
}
