# CMake: сборка проекта из многих файлов

> Как описать проект один раз — и собирать его одной командой: цели, библиотеки, папки, режимы сборки и тесты.
>
> Это **раздел 38** справочника — тема «на вырост». Нужна, когда проект перерос один `.cpp` и одну строку `g++`: появились папки, общий код для игры и тестов, режимы «отладка/релиз». Опирается на [разделение на `.h`/`.cpp`](19-razdelenie.md). Полный список — в [оглавлении](../00-НАЧНИ-ОТСЮДА.md).

**Уровень:** 🟡 нужна база · **Опирается на:** [Разделение на файлы](19-razdelenie.md), [Функции](04-funkcii.md)

[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md) · [Маршрут изучения](../00-marshrut.md) · [← Разделение на файлы](19-razdelenie.md) · [Игра в консоли →](21-igra-v-konsoli.md)

---

## Что в этом файле

- **[38. CMake](#38-cmake)**
  - [За 30 секунд](#за-30-секунд)
  - [Зачем, если есть `g++`](#зачем-если-есть-g)
  - [Две команды: настроить и собрать](#две-команды-настроить-и-собрать)
  - [Цель — главное слово CMake](#цель--главное-слово-cmake)
  - [Библиотека: общий код для игры и тестов](#библиотека-общий-код-для-игры-и-тестов)
  - [`PRIVATE`, `PUBLIC`: что достаётся соседям](#private-public-что-достаётся-соседям)
  - [Папки: `add_subdirectory`](#папки-add_subdirectory)
  - [Отладка и релиз](#отладка-и-релиз)
  - [Тесты: `ctest`](#тесты-ctest)
  - [CMake в VS Code](#cmake-в-vs-code)
  - [А в Unreal?](#а-в-unreal)
  - [Типовые ошибки](#типовые-ошибки)
- **[Проверь себя](#проверь-себя)**
- **[Босс темы](#босс-темы)**

---

## 38. CMake

### За 30 секунд

- `CMakeLists.txt` описывает **что** собрать; CMake сам составляет команды для компилятора.
- Две команды: `cmake -S . -B build` — один раз **настроить**, `cmake --build build` — **собирать** (только изменённое).
- **Цель** (target) — программа (`add_executable`) или библиотека (`add_library`). Флаги, папки заголовков и зависимости вешают **на цель**: `target_…(цель PRIVATE …)`.
- Общий код — в библиотеку: её подключают и игра, и тесты (`target_link_libraries`).
- Папку `build/` в git не кладут: она пересоздаётся.

### Зачем, если есть `g++`

Для трёх файлов хватает одной строки:

```bash
g++ -std=c++20 -Wall -Wextra src/main.cpp src/geometry.cpp -o app
```

Но проект растёт: 20 файлов в папках, общий код для игры и для тестов, «быстрая сборка для отладки» и «оптимизированная для друзей». Строка превращается в скрипт, скрипт — в ошибки. CMake решает это описанием: перечисли файлы и связи **один раз** — дальше он сам знает, что пересобрать после правки.

> CMake не компилирует сам. Он **генерирует** правила для настоящей системы сборки (Ninja, Make, Visual Studio), а та уже зовёт `g++`/`clang++`/`cl`. Поэтому один `CMakeLists.txt` работает на Windows, Linux и macOS.

### Две команды: настроить и собрать

Минимальный проект из [темы про файлы](19-razdelenie.md#cmake-проект-который-собирается-одной-командой):

```cmake
cmake_minimum_required(VERSION 3.20)
project(dungeon LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(app src/main.cpp src/geometry.cpp)
```

```bash
cmake -S . -B build -G Ninja      # 1) настроить: -S откуда исходники, -B куда класть сборку
cmake --build build               # 2) собрать (каждый раз после правок)
./build/app                       # 3) запустить (на Windows: .\build\app.exe)
```

Шаг 1 делают один раз (и после правки `CMakeLists.txt` — CMake заметит это сам при шаге 2). Шаг 2 повторяют постоянно: он пересобирает **только изменённые** `.cpp`.

### Цель — главное слово CMake

Всё в современном CMake крутится вокруг **целей**. Цель — это то, что получится в итоге: программа или библиотека. У цели есть свойства: из каких файлов она собирается, с какими флагами, где её заголовки, от кого она зависит.

```cmake
add_executable(app src/main.cpp)

target_compile_features(app PRIVATE cxx_std_20)            # стандарт — свойство цели
target_compile_options(app PRIVATE -Wall -Wextra -Wpedantic) # строгие предупреждения
target_include_directories(app PRIVATE include)            # где искать #include "…"
```

> **Старый стиль, который не надо копировать:** `include_directories(...)`, `add_definitions(...)`, `set(CMAKE_CXX_FLAGS "...")` без цели. Они действуют на **всё подряд** в папке, и через год никто не понимает, откуда взялся флаг. Пиши `target_…` — как `std::` вместо `using namespace std`.

Флаги `-Wall -Wextra` понимают g++ и clang++, но не MSVC. Если проект должен собираться везде:

```cmake
if(MSVC)
  target_compile_options(app PRIVATE /W4)
else()
  target_compile_options(app PRIVATE -Wall -Wextra -Wpedantic)
endif()
```

### Библиотека: общий код для игры и тестов

Логика игры нужна и самой игре, и тестам. Копировать `.cpp` в два списка — плохая идея. Выносим её в **библиотеку**:

```
dungeon/
├── CMakeLists.txt
├── include/dungeon/
│   └── combat.h
├── src/
│   ├── combat.cpp
│   └── main.cpp
└── tests/
    └── combat_test.cpp
```

```cmake
cmake_minimum_required(VERSION 3.20)
project(dungeon LANGUAGES CXX)

add_library(dungeon_core src/combat.cpp)                  # общий код — библиотека
target_compile_features(dungeon_core PUBLIC cxx_std_20)
target_include_directories(dungeon_core PUBLIC include)   # её заголовки видят все, кто её подключит

add_executable(game src/main.cpp)
target_link_libraries(game PRIVATE dungeon_core)          # игра = main + библиотека

add_executable(combat_test tests/combat_test.cpp)
target_link_libraries(combat_test PRIVATE dungeon_core)   # тесты — та же библиотека
```

Теперь `combat.cpp` компилируется **один раз**, а игра и тесты его используют. В `main.cpp` подключение выглядит так: `#include "dungeon/combat.h"` — папка `include` уже известна благодаря библиотеке.

### `PRIVATE`, `PUBLIC`: что достаётся соседям

Слово после имени цели отвечает на вопрос «передать ли это тем, кто меня подключит»:

| Слово | Нужно мне | Нужно тем, кто подключит меня | Пример |
|-------|-----------|-------------------------------|--------|
| `PRIVATE` | да | нет | `-Wall` у игры; `.cpp` библиотеки использует `<random>` |
| `PUBLIC` | да | да | папка `include` библиотеки: её заголовки подключают и она сама, и игра |
| `INTERFACE` | нет | да | библиотека только из заголовков (шаблоны) |

Правило для начала: **флаги предупреждений — `PRIVATE`**, **папка заголовков библиотеки — `PUBLIC`**, **связь игра → библиотека — `PRIVATE`**.

### Папки: `add_subdirectory`

Когда частей много, у каждой папки — свой `CMakeLists.txt`, а корневой их собирает:

```cmake
# корневой CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(dungeon LANGUAGES CXX)

add_subdirectory(core)    # core/CMakeLists.txt — библиотека dungeon_core
add_subdirectory(game)    # game/CMakeLists.txt — программа, link к dungeon_core
add_subdirectory(tests)
```

Цели видны между папками по имени: в `game/CMakeLists.txt` можно писать `target_link_libraries(game PRIVATE dungeon_core)`, хотя библиотека объявлена в `core/`.

### Отладка и релиз

Одна и та же программа собирается по-разному:

- **Debug** — без оптимизаций, с отладочной информацией: отладчик показывает переменные, шаги идут по строкам кода.
- **Release** — с оптимизациями (`-O2`/`-O3`): быстрее в разы, но отлаживать тяжело.
- **RelWithDebInfo** — оптимизации **и** отладочная информация: для поиска «тормозов».

```bash
cmake -S . -B build-debug   -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake -S . -B build-release -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build-release
```

Две папки сборки живут рядом и не мешают друг другу. Тип сборки задают при **настройке** (`-D…` на шаге 1), а не в `CMakeLists.txt` — это выбор того, кто собирает.

> Пока учишься — собирай **Debug**: ошибки вроде выхода за границу ловятся понятнее, а отладчик показывает правду.

### Тесты: `ctest`

CMake умеет запускать тесты одной командой. Тест — это обычная программа: вернула `0` — прошёл, не `0` — упал.

```cmake
enable_testing()
add_test(NAME combat COMMAND combat_test)
```

```bash
cmake --build build
ctest --test-dir build --output-on-failure
```

Сам тест может быть простым — без библиотек:

```cpp
#include <iostream>

int damage(int attack, int armor) {           // в проекте — из dungeon/combat.h
  return attack > armor ? attack - armor : 1;
}

int main() {
  int fails = 0;
  if (damage(10, 3) != 7) { std::cout << "FAIL: 10-3\n"; ++fails; }
  if (damage(2, 5) != 1)  { std::cout << "FAIL: минимум 1\n"; ++fails; }
  if (fails == 0) std::cout << "OK\n";
  return fails == 0 ? 0 : 1;                  // ctest смотрит на код возврата
}
```

Когда тестов станет много, берут библиотеку тестов (GoogleTest, Catch2, doctest) — их тоже подключают через CMake.

### CMake в VS Code

Расширение **CMake Tools** (от Microsoft) делает всё из этой темы кнопками:

- открыл папку с `CMakeLists.txt` — предложит выбрать **kit** (компилятор; выбери свой g++ из MSYS2);
- внизу окна — **Build**, **Run**, **Debug** и выбор типа сборки (Debug/Release);
- `compile_commands.json` для подсказок IntelliSense/clangd — включается строкой `set(CMAKE_EXPORT_COMPILE_COMMANDS ON)`.

Команды из терминала при этом работают как раньше — расширение просто зовёт тот же `cmake`.

### А в Unreal?

Unreal Engine собирает C++ **своей** системой — Unreal Build Tool: вместо `CMakeLists.txt` у каждого модуля файл `*.Build.cs` (на C#). Но идеи те же, что здесь: **модули** (как цели), **публичные и приватные зависимости** (`PublicDependencyModuleNames` / `PrivateDependencyModuleNames` — ровно `PUBLIC`/`PRIVATE`), папки `Public/` и `Private/` для заголовков. Разберёшься с целями и `PUBLIC`/`PRIVATE` здесь — `Build.cs` прочитаешь с первого взгляда.

### Типовые ошибки

**Добавил `.cpp`, а он не собирается («undefined reference»).** Файл не попал в список цели. CMake не ищет `.cpp` сам: допиши его в `add_executable`/`add_library` и пересобери.

**`fatal error: combat.h: No such file or directory`.** Цели не сказали, где заголовки: `target_include_directories(цель PUBLIC include)` у библиотеки (или `PRIVATE` у программы).

**Собираю из папки с исходниками — всё замусорено.** Всегда `-B build`: сборка отдельно от кода. Папку `build/` добавь в `.gitignore`.

**Поменял компилятор — CMake берёт старый.** Настройки кэшируются в `build/CMakeCache.txt`. Удали папку `build` и настрой заново.

**Флаг «потерялся» у соседей.** Флаг повешен `PRIVATE`, а нужен и тем, кто подключает библиотеку, — значит, `PUBLIC`. И наоборот: `-Wall` через `PUBLIC` навязывает твои предупреждения чужому коду.

---

## Проверь себя

Нажми вариант — сразу увидишь, верно или нет.

```quiz
В: Что делает `cmake -S . -B build`?
+ Настраивает сборку: читает CMakeLists.txt и готовит правила в папке build
- Компилирует все .cpp
- Запускает программу
= Компилирует вторая команда — `cmake --build build`. Первую повторять после каждой правки не нужно.

В: Игра и тесты используют один и тот же `combat.cpp`. Как правильно?
+ Вынести его в `add_library`, подключить к обеим целям через `target_link_libraries`
- Вписать `combat.cpp` в обе `add_executable`
- Скопировать `combat.cpp` в папку tests
= Библиотека компилируется один раз, а обе программы её используют.

В: Папка `include` библиотеки нужна и самой библиотеке, и игре, которая её подключает. Какое слово?
+ `PUBLIC`
- `PRIVATE`
- `INTERFACE`
= `PUBLIC` — «нужно мне и тем, кто подключит меня». `INTERFACE` — только тем, кто подключит.

В: Где задают Debug или Release?
+ При настройке: `-DCMAKE_BUILD_TYPE=Debug`
- В `add_executable`
- В `main.cpp`
= Тип сборки — выбор того, кто собирает. Удобно держать две папки: build-debug и build-release.

В: Как `ctest` понимает, что тест прошёл?
+ Программа теста вернула 0
- Программа напечатала «OK»
- В выводе нет слова «FAIL»
= Только код возврата: `return 0` — прошёл, иначе — упал.
```

Найди ошибку:

```findbug
cmake_minimum_required(VERSION 3.20)
project(dungeon LANGUAGES CXX)

add_library(dungeon_core src/combat.cpp)
target_include_directories(dungeon_core PRIVATE include)

add_executable(game src/main.cpp)
target_link_libraries(game PRIVATE dungeon_core)
---
`main.cpp` пишет `#include "dungeon/combat.h"`, но папка `include` отдана библиотеке как **`PRIVATE`** — игре она не достаётся, и сборка падает с «No such file or directory».

**Исправление:** `target_include_directories(dungeon_core PUBLIC include)` — заголовки библиотеки нужны всем, кто её подключает.
```

Карточки на повторение:

```cards
Q: Что такое цель (target) в CMake?
A: То, что получится в итоге: программа (`add_executable`) или библиотека (`add_library`). Флаги, заголовки и зависимости вешают на цель командами `target_…`.

Q: Две команды CMake — какие и зачем?
A: `cmake -S . -B build` — настроить (один раз), `cmake --build build` — собрать (каждый раз; пересобирает только изменённое).

Q: Чем `PUBLIC` отличается от `PRIVATE` в `target_…`?
A: `PRIVATE` — нужно только самой цели. `PUBLIC` — ей и всем, кто её подключит через `target_link_libraries`.

Q: Зачем выносить общий код в `add_library`?
A: Его используют несколько программ (игра, тесты): код компилируется один раз, а подключается везде.

Q: Почему `build/` не кладут в git?
A: Это результат сборки: он пересоздаётся командой настройки и зависит от машины (пути, компилятор).

Q: Debug против Release?
A: Debug — без оптимизаций, с отладочной информацией (для учёбы и отладчика). Release — оптимизации, быстрая программа.
H: Выбирается флагом `-DCMAKE_BUILD_TYPE=…` при настройке.

Q: Что общего у CMake и сборки Unreal?
A: Идея модулей-целей и публичных/приватных зависимостей: в `*.Build.cs` это `PublicDependencyModuleNames` и `PrivateDependencyModuleNames`.
```

> **Сквозной проект «Подземелье»:** когда игра разрастётся до нескольких файлов, переведите её на CMake: библиотека `dungeon_core` + программа `game` + тест `combat_test` — [квест 16](../proekt/05-glava-4-vzroslyj-kod.md#квест-16-сборка-на-cmake).

## Босс темы

```boss
# Подземелье на CMake
@id ccfegn6
Переведите свой проект (или три файла из [темы про разделение](19-razdelenie.md)) на CMake.

1. Структура: `include/`, `src/`, `tests/`. Логика — в библиотеке `dungeon_core`, `main.cpp` — в программе `game`.
2. Строгие предупреждения на **обе** цели, стандарт C++20.
3. Тест `combat_test`: проверяет 2–3 функции логики, возвращает `0`/`1`; подключён через `enable_testing()` + `add_test`.
4. Две сборки рядом: `build-debug` и `build-release`. `ctest --test-dir build-debug` — зелёный.
5. Бонус: откройте папку в VS Code с CMake Tools — собирается и запускается кнопками.

<details>
<summary>Подсказка</summary>

Начните с одной цели `add_executable(game …)` и убедитесь, что собирается. Потом вынесите файлы логики в `add_library(dungeon_core …)` и замените их в `game` на `target_link_libraries(game PRIVATE dungeon_core)`. Ошибка «No such file» — почти всегда `PRIVATE` вместо `PUBLIC` у папки `include`.

</details>
```
