// Эталон к «Подземелье», квест 5.
#include <cctype>
#include <iostream>
#include <sstream>
#include <string>

std::string toUpperRu(const std::string &s) {
  std::string out = s;
  for (std::size_t i = 0; i < out.size(); ++i) {
    unsigned char c = static_cast<unsigned char>(out[i]);
    if (c < 0x80) {
      out[i] = static_cast<char>(std::toupper(c));
      continue;
    }
    if (i + 1 >= out.size())
      break;
    unsigned char n = static_cast<unsigned char>(out[i + 1]);
    if (c == 0xD0 && n >= 0xB0 && n <= 0xBF)
      out[i + 1] = static_cast<char>(n - 0x20);
    else if (c == 0xD1 && n >= 0x80 && n <= 0x8F) {
      out[i] = static_cast<char>(0xD0);
      out[i + 1] = static_cast<char>(n + 0x20);
    } else if (c == 0xD1 && n == 0x91) {
      out[i] = static_cast<char>(0xD0);
      out[i + 1] = static_cast<char>(0x81);
    }
    ++i;
  }
  return out;
}

int main() {
  std::string line;
  while (std::getline(std::cin, line)) {
    std::istringstream in(line);
    std::string cmd;
    if (!(in >> cmd))
      continue;
    cmd = toUpperRu(cmd);
    if (cmd == "ИДТИ") {
      int n = 1;
      if (!(in >> n) || n < 1)
        n = 1;
      std::cout << "идём: " << n << "\n";
    } else if (cmd == "ОТДЫХ") {
      std::cout << "отдыхаем\n";
    } else if (cmd == "СТАТУС") {
      std::cout << "статус\n";
    } else if (cmd == "ВЫХОД") {
      std::cout << "пока!\n";
      break;
    } else {
      std::cout << "Не понимаю. Команды: идти, отдых, статус, выход\n";
    }
  }
}
