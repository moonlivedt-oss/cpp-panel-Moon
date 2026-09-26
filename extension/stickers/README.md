# Наклейки плавающего окна

> **2026-09-26:** наклейки — в **WebP** (PNG-дубликаты удалены; уникальные рисунки без WebP перенесены в
> `art/unused/`). Список слотов — `SLOTS` в `scripts/embed-stickers.js`, ещё не нарисованные — `PENDING`,
> промпты к ним — [`art/PROMPTS.md`](../../art/PROMPTS.md).

Сюда кладутся рисованные наклейки (в духе `dop/emo.jpg`), которые показываются в окне
документации в «пустых» местах и на приветствии. Пока файла нет — рисуется аккуратная
SVG-заглушка, так что окно никогда не выглядит пустым.

> **Уже готово:** пять наклеек вырезаны прямо из `dop/emo.jpg` (с прозрачным фоном) и лежат
> здесь. Хочешь свои — просто замени файлы с теми же именами и запусти `npm run embed:stickers`.

## Что нужно

Пять картинок. Имя файла важно — по нему наклейка попадает в своё место:

| Файл            | Где показывается                                   | Что нарисовать (идея из emo.jpg)          |
|-----------------|----------------------------------------------------|-------------------------------------------|
| `welcome.png`   | у приветствия, пока изучено 0%                       | улыбка 🙂, ладошка «Hi!», звёздочка       |
| `progress.png`  | у приветствия, пока идёт учёба (1–99%)               | огонёк 🔥, молния ⚡, звезда ⭐            |
| `noresult.png`  | когда поиск ничего не нашёл                          | лупа с «?», «?!», задумчивый смайл         |
| `empty.png`     | когда материалов нет / не загрузились               | пустая коробка/лист, грустный смайл        |
| `done.png`      | когда весь справочник изучен (100%)                 | корона 👑, звезда ⭐, кубок               |

## Требования к картинкам

- **Формат:** PNG с **прозрачным фоном** (лучше всего). Можно webp, gif, svg.
- **Размер:** квадрат, **256×256** (в окне рисуются от 34 до 118 px — с запасом на чёткость).
- **Стиль:** как в `dop/emo.jpg` — толстый белый контур, яркая заливка, лёгкая небрежность.
  Белый контур важен: он читается и на тёмной, и на светлой теме.
- **Вес:** до ~200 КБ на файл (они встраиваются прямо в код окна). Меньше — лучше.

## Как подключить

1. Положи файлы в эту папку: `extension/stickers/welcome.png` и т.д.
2. Встрой их в рантайм:

   ```bash
   node scripts/embed-stickers.js
   ```

3. Пересобери и поставь расширение:

   ```bash
   npm run install:vsix
   ```

   Затем в VS Code — «Developer: Reload Window». Проверить вживую без установки:
   `npm run preview:window docs` и открыть `build/preview-window.html`.

Любого файла может не быть — на его месте останется SVG-заглушка. Можно добавлять по одной.

## Промпты для генерации (если делаешь картинки по промпту)

Единый стиль в конце каждого промпта помогает попасть в общий вид. Проси **PNG с
прозрачным фоном** (или потом убери фон), квадрат 256×256.

**welcome.png**
> Cute hand-drawn sticker of a smiling round face waving hello, marker-doodle style,
> thick white outline, bright flat colors, small sparkle, playful, transparent background,
> square, centered. Same style as a colorful doodle sticker pack.

**progress.png**
> Cute hand-drawn sticker of a small flame / fire with an energetic "keep going" vibe,
> marker-doodle style, thick white outline, bright orange and yellow, playful, transparent
> background, square, centered.

**noresult.png**
> Cute hand-drawn sticker of a magnifying glass with a small question mark inside,
> marker-doodle style, thick white outline, bright flat colors, playful, transparent
> background, square, centered.

**empty.png**
> Cute hand-drawn sticker of an empty open box with a small shrug face, marker-doodle
> style, thick white outline, bright flat colors, a little sad but friendly, transparent
> background, square, centered.

**done.png**
> Cute hand-drawn sticker of a golden crown with sparkles, celebratory, marker-doodle
> style, thick white outline, bright flat colors, playful, transparent background,
> square, centered.

## Значки интерфейса `ui-*` (вместо эмодзи, 2026-09-25)

Мелкие значки: показываются размером 20–34 px, поэтому рисунок — **один простой предмет,
крупно, без лица и без текста**. Файл: `extension/stickers/<имя>.png` (или `.webp`), квадрат
256×256, прозрачный фон. Потом `npm run optimize:images` (или `npm run embed:stickers` +
`npm run hash:runtime`). Нет файла — в окне остаётся прежний эмодзи, ничего не ломается.

Общий хвост для каждого промпта:
> …, simple single object, no face, no text, marker-doodle sticker style, thick white outline,
> bright flat colors, soft shadow, transparent background, square, centered, readable at 24px.

| Файл | Где | Промпт (начало) |
|---|---|---|
| `ui-read` | плитка «изучено» | a small blue open book |
| `ui-solve` | плитка «решено» | a green check mark inside a rounded square badge |
| `ui-streak` | плитка «дней подряд» | a small orange flame |
| `ui-steps` | плитка «разборов по шагам» | two small footprints walking forward |
| `ui-cards` | «к повторению», кнопка «Повторить», шапка «🎴 N» | a small stack of three flashcards, top one tilted |
| `ui-warm` | «Разминка дня» | a small sunrise over a hill |
| `ui-deck` | заголовок колоды «Карточки темы» | a single playing-card style flashcard with a question mark |
| `ui-shuffle` | «Перемешать» | two crossing curved arrows (shuffle) |
| `ui-hint` | «Подсказка» | a glowing yellow light bulb |
| `ui-dice` | «Случайная задача» | a single white game die showing five dots |
| `ui-guide` | «Обучение» | a small compass or a map with a pin |
| `ui-news` | «Что нового» | three little sparkles / stars |

### Варианты под палитры

Файл без суффикса (`ui-read.webp`) — общий: показывается в палитре «Как в редакторе» и там,
где своего варианта нет. Вариант под палитру — `ui-read@tokyo.webp` и т. п. Можно делать
варианты не для всех значков и не для всех палитр — недостающие берутся из общего.

Шаблон промпта (подставь предмет из таблицы выше и три цвета палитры):
> [ПРЕДМЕТ], cute marker-doodle sticker, simple single object, no face, no text,
> thick white outline, flat colors — main color [C1], accents [C2], small highlights [C3],
> soft drop shadow, transparent background, square 512x512, centered, readable at 24px.

| Суффикс | Палитра | C1 | C2 | C3 |
|---|---|---|---|---|
| *(нет)* | общий / Catppuccin | #cba6f7 lavender | #89b4fa sky blue | #fab387 peach |
| `@tokyo` | Tokyo Night | #7aa2f7 blue | #bb9af7 purple | #7dcfff cyan |
| `@dracula` | Dracula | #bd93f9 purple | #ff79c6 pink | #50fa7b green |
| `@nord` | Nord | #88c0d0 frost cyan | #81a1c1 steel blue | #eceff4 snow white |
| `@gruvbox` | Gruvbox | #fe8019 orange | #fabd2f yellow | #8ec07c aqua |
| `@rosepine` | Rosé Pine | #ebbcba rose | #c4a7e7 iris | #f6c177 gold |
| `@onedark` | One Dark | #61afef blue | #c678dd purple | #98c379 green |
| `@forest` | Лес | #7fd4a0 mint green | #d8c97a straw yellow | #7cc7d6 teal |
| `@sunset` | Закат | #ff9e7a coral | #e879b9 pink | #ffd479 gold |

Вес: генерируй крупно (512), а `npm run optimize:images` сожмёт в WebP. Каждый значок в окне
весит ~3–6 КБ; полный набор 12 × 9 — около 0,5 МБ в рантайме, поэтому разумно начать с общего
набора и вариантов для 2–3 любимых палитр.
