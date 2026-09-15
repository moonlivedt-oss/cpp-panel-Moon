# Рецепты: «как сделать X»

> Навигация не по темам, а по задачам. Когда знаешь, **что** нужно, но не помнишь, **как** это называется.
> Весь код проверен сборкой со строгими флагами. Объяснения — по ссылкам под рецептами.

[← Начни отсюда](00-НАЧНИ-ОТСЮДА.md) · [Шпаргалка](01-shpargalka.md) · [Указатель](07-ukazatel.md) · [Примеры программ](examples/README.md)

---

## Числа и списки

### Посчитать сумму и среднее

```cpp
#include <numeric>

long long sum = std::accumulate(v.begin(), v.end(), 0LL);   // 0LL, а не 0 — иначе переполнится
double avg = v.empty() ? 0.0                                // ✅ пустой список — не делим
                       : static_cast<double>(sum) / static_cast<double>(v.size());
```

Два `static_cast` не для красоты: без второго `-Wconversion` выдаст предупреждение.
→ [про `0LL`](ref/07-algoritmy.md#18-алгоритмы) · [про оба cast](ref/01-osnovy.md#среднее-почему-static_cast-нужен-с-обеих-сторон)

### Найти максимум и его позицию

```cpp
#include <algorithm>

auto it = std::max_element(v.begin(), v.end());   // возвращает итератор, а не число
if (it != v.end()) {                              // ✅ у пустого вектора максимума нет
  int best = *it;                                 // звёздочка обязательна
  auto pos = std::distance(v.begin(), it);        // порядковый номер
  std::cout << best << " на позиции " << pos << "\n";
}
```
→ [почему звёздочка](ref/07-algoritmy.md#17-итераторы--на-пальцах)

### Отобрать подходящие в новый список

```cpp
std::vector<int> big;
for (int x : v)
  if (x > 3)
    big.push_back(x);        // исходный вектор не трогаем
```

### Удалить подходящие из списка

```cpp
std::erase_if(v, [](int x) { return x < 4; });   // C++20, одна строка
std::erase(v, 7);                                // удалить все семёрки
```

⚠️ Удалять внутри обычного цикла нельзя — индексы съезжают.
→ [раздел 11](ref/06-konteynery.md#11-массивы-и-stdvector)

### Убрать дубликаты

```cpp
#include <set>

std::set<int> uniq(v.begin(), v.end());           // set не хранит повторы
std::vector<int> noDup(uniq.begin(), uniq.end()); // и обратно — заодно отсортировано
```
→ [раздел 14](ref/06-konteynery.md#14-stdset--только-уникальные)

### Проверить, есть ли элемент

```cpp
bool has = std::find(v.begin(), v.end(), 9) != v.end();   // в векторе
bool inMap = ages.contains("Аня");                        // в словаре (C++20)
bool inSet = seen.contains(5);                            // в множестве
```

### Посчитать, сколько раз встречается

```cpp
auto n = std::count(v.begin(), v.end(), 9);                          // конкретное значение
auto evens = std::count_if(v.begin(), v.end(),
                           [](int x) { return x % 2 == 0; });        // по условию
```

Результат ловим в `auto`: это не `int`, и присваивание в `int` даст предупреждение.

## Структуры

### Отсортировать по полю

```cpp
std::sort(group.begin(), group.end(),
          [](const Student &a, const Student &b) { return a.score > b.score; });   // по убыванию

// при равных баллах — по алфавиту
std::sort(group.begin(), group.end(),
          [](const Student &a, const Student &b) {
            if (a.score != b.score) return a.score > b.score;
            return a.name < b.name;
          });
```
→ [раздел 18](ref/07-algoritmy.md#18-алгоритмы) · целиком в [Журнале оценок](examples/08-zhurnal-ocenok.md)

### Взять первые N

```cpp
std::sort(group.begin(), group.end(), /* правило */);    // сначала отсортировать
for (std::size_t i = 0; i < group.size() && i < 3; ++i)  // ✅ && size() — если их меньше трёх
  std::cout << group[i].name << " ";
```

### Найти лучшего по полю

```cpp
auto best = std::max_element(group.begin(), group.end(),
                             [](const Student &a, const Student &b) {
                               return a.score < b.score;   // ⚠️ для max_element именно <
                             });
if (best != group.end())
  std::cout << best->name;      // -> потому что это итератор
```

### Вернуть из функции два значения

```cpp
#include <utility>

std::pair<int, int> divide(int a, int b) {
  return {a / b, a % b};
}

auto [q, r] = divide(17, 5);      // → 3 и 2
```

Больше двух значений или нужны имена — заводи `struct`.
→ [раздел 15](ref/06-konteynery.md#15-stdpair--две-вещи-вместе)

## Словари

### Посчитать частоты

```cpp
#include <map>

std::map<std::string, int> freq;
for (const auto &w : words)
  ++freq[w];                     // здесь [] уместен: нет ключа → создастся 0 → станет 1
```

### Найти самое частое

```cpp
std::string top;
int topCount = 0;
for (const auto &[word, count] : freq)
  if (count > topCount) { topCount = count; top = word; }
```

Нужен весь список по убыванию частоты — перекладывай в `vector<pair>` и сортируй:
→ [Анализ текста](examples/03-analiz-teksta.md)

### Сгруппировать по ключу

```cpp
std::map<std::string, std::vector<int>> byName;

byName["Аня"].push_back(5);      // вектора ещё нет — [] создаст пустой
byName["Аня"].push_back(4);
```
→ [раздел 16](ref/06-konteynery.md#16-вложенные-контейнеры)

### Прочитать значение, ничего не создав

```cpp
auto it = ages.find("Аня");      // ✅ find не создаёт лишних ключей
if (it != ages.end())
  std::cout << it->second;

std::cout << ages["Гриша"];      // ❌ молча создаст ключ "Гриша" = 0
```
→ [раздел 12](ref/06-konteynery.md#12-словарь-stdmap)

## Текст

### Разбить строку на слова

```cpp
#include <sstream>

std::istringstream stream(text);      // строка превращается в поток
std::vector<std::string> words;
std::string word;
while (stream >> word)                // >> сам режет по пробелам
  words.push_back(word);
```

### Разобрать строку с разделителем

```cpp
std::istringstream row("Аня;95");
std::string name, scoreText;
std::getline(row, name, ';');         // третий аргумент — по какому символу резать
std::getline(row, scoreText);         // последний кусок — до конца строки
int score = std::stoi(scoreText);     // ⚠️ бросит исключение на "абв"
```
→ целиком в [Расходах из файла](examples/05-raskhody-csv.md)

### Число ↔ строка

```cpp
std::string s = std::to_string(42);   // → "42"
int n = std::stoi("42");              // → 42
double d = std::stod("3.14");         // → 3.14
```

### Найти подстроку

```cpp
if (name.find("Ан") != std::string::npos)      // ⚠️ сравнивать с npos, а не с -1
  std::cout << "содержит\n";
```
→ [раздел 10](ref/05-stroki.md#10-stdstring)

### Обрезать пробелы по краям

```cpp
std::size_t a = s.find_first_not_of(" \t\n\r");   // первый непробельный
std::size_t b = s.find_last_not_of(" \t\n\r");    // последний непробельный
std::string trimmed = (a == std::string::npos) ? "" : s.substr(a, b - a + 1);
```
→ [готовая функция `trim`](ref/05-stroki.md#обрезать-пробелы-trim)

## Ввод, вывод, файлы

### Прочитать числа, пока не кончатся

```cpp
int x = 0;
int sum = 0;
while (std::cin >> x)          // закончится на нечисле или на конце ввода
  sum += x;
```

### Прочитать файл построчно

```cpp
#include <fstream>

std::ifstream in("data.txt");
if (!in.is_open()) {                    // ⚠️ именно is_open(), а не (!in)
  std::cout << "Файл не найден\n";
  return 1;
}
std::string line;
while (std::getline(in, line))
  std::cout << line << "\n";
```
→ [почему is_open](ref/08-struct-fayly.md#сначала--главная-ловушка-на-твоей-сборке)

### Записать в файл

```cpp
std::ofstream out("result.txt");        // ⚠️ старое содержимое стирается
if (out.is_open())
  out << "Результат: " << 42 << "\n";   // пишем как в cout

std::ofstream log("log.txt", std::ios::app);   // дописать в конец, не стирая
```

### Вывести ровную таблицу

```cpp
#include <format>

std::cout << std::format("{:<12}{:>5}\n", "Имя", "Балл");
for (const auto &s : group)
  std::cout << std::format("{:<12}{:>5}\n", s.name, s.score);
```

⚠️ Для русских подписей — только `std::format`: `setw` считает байты и таблица разъезжается.
→ [раздел 4](ref/02-vvod-vyvod.md#stdformat--современный-способ-c20)

### Прочитать число, не боясь букв

Готовая функция — в [шпаргалке](01-shpargalka.md), полностью разобрана в [разделе 4](ref/02-vvod-vyvod.md#безопасное-чтение--держи-под-рукой).

## Математика

### Округлить до N знаков

```cpp
std::cout << std::format("{:.2f}", x);        // для вывода: само число не меняется
double rounded = std::round(x * 100) / 100;   // для вычислений
```

### Разобрать число на цифры

```cpp
int n = std::abs(-1234);        // ⚠️ сначала модуль, иначе цикл не выполнится ни разу
int digitSum = 0;
while (n > 0) {
  digitSum += n % 10;           // последняя цифра
  n /= 10;                      // отбрасываем её
}
```

### Проценты и доли

```cpp
if (total > 0) {                          // ✅ иначе получится nan
  double share = 100.0 * part / total;    // 100.0, а не 100 — от целочисленного деления
  std::cout << std::format("{:.1f}%\n", share);
}
```

### Случайное число

```cpp
#include <random>

std::mt19937 rng(std::random_device{}());          // генератор — создать ОДИН раз
std::uniform_int_distribution<int> dice(1, 6);      // диапазон включительно

int roll = dice(rng);                               // каждый вызов — новое число 1..6
```

Не бери старый `rand()`. → [раздел 20](ref/08-struct-fayly.md#случайные-числа) · [в игре целиком](ref/21-igra-v-konsoli.md#случайность-random)

### Удержать число в границах

```cpp
#include <algorithm>

hp = std::clamp(hp, 0, 100);            // меньше 0 → 0, больше 100 → 100
volume = std::clamp(volume, 0.0, 1.0);  // ⚠️ все три аргумента одного типа (0.0, не 0)
```
→ [раздел 5](ref/03-logika-cikly.md#удержать-число-в-границах-min-max-clamp)

---

Не нашёл нужного? Загляни в [указатель](07-ukazatel.md) — там имена функций по алфавиту.

[← Начни отсюда](00-НАЧНИ-ОТСЮДА.md) · [Шпаргалка](01-shpargalka.md) · [Указатель](07-ukazatel.md) · [Примеры программ](examples/README.md)
