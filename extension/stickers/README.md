# Наклейки плавающего окна

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
