# Картинки, которые ждут рисования

Окно уже работает без них (запасная наклейка или полоса цветом раздела). Нарисовал — положи файл в
`extension/stickers/`, убери имя из `PENDING` в `scripts/embed-stickers.js` и запусти `npm run embed:stickers`.

Общий стиль — как у остальных наклеек (`dop/emo.jpg`): толстый белый контур, яркая заливка, лёгкая
небрежность, **прозрачный фон**, формат **WebP** (или PNG — скрипт возьмёт), до 200 КБ.

## Маскот

| Файл | Размер | Где | Промпт |
|---|---|---|---|
| `mascot-oops.webp` | 256×256 | рядом с результатом «Запустить», когда сборка или тесты не прошли | Cute hand-drawn sticker of the same small round mascot character as the others (purple-lavender blob with big eyes), looking sympathetic and slightly sheepish, one hand scratching its head, a tiny band-aid on its cheek, small "oops" sweat drop; thick white outline around the whole figure, bright flat colors, playful slightly wobbly lines, transparent background, no text |

## Значок настроек (необязательно)

| Файл | Размер | Где | Промпт |
|---|---|---|---|
| `ui-settings.webp` | 128×128 | шапка окна «Настройки» (сейчас там эмодзи ⚙) | Cute hand-drawn sticker icon: a chunky rounded gear with a tiny paintbrush and a small letter "A" leaning on it, lavender and warm yellow, thick white outline, bright flat colors, slightly wobbly lines, transparent background, no text |

## Иконки вкладок настроек и повторения (128×128)

Стиль как у `ui-cards`/`ui-news`: рисованная наклейка, толстый белый контур, прозрачный фон, без текста.
Показываются маленькими (22 px) — рисунок должен читаться силуэтом, без мелких деталей.

| Файл | Где (сейчас эмодзи) | Промпт |
|---|---|---|
| `ui-tab-look.webp` | вкладка «Вид» (🎨) | Cute hand-drawn sticker icon of a painter's palette with three bright paint blobs and a small brush, chunky shapes, thick white outline, transparent background, no text |
| `ui-tab-text.webp` | вкладка «Текст» (🔤) | Cute hand-drawn sticker icon of a big friendly capital letter "A" next to a small letter "a", like typography blocks, chunky, thick white outline, transparent background |
| `ui-tab-window.webp` | вкладка «Окно» (🪟) | Cute hand-drawn sticker icon of a small rounded app window with a title bar and three dots, slightly tilted, chunky, thick white outline, transparent background, no text |
| `ui-tab-behave.webp` | вкладка «Поведение» (✨) | Cute hand-drawn sticker icon of a toggle switch turned on with two little sparkles around it, chunky, thick white outline, transparent background, no text |
| `ui-tab-progress.webp` | вкладка «Прогресс» (💾) | Cute hand-drawn sticker icon of a treasure chest slightly open with a glowing star inside (saved progress), chunky, thick white outline, transparent background, no text |
| `ui-calendar.webp` | итог повторения: «завтра вернётся…» (📅) | Cute hand-drawn sticker icon of a small tear-off calendar page with a circled day and a tiny arrow looping back, chunky, thick white outline, transparent background, no numbers |
| `ui-pencil.webp` | «Сначала вспомни» в карточке (✎) | Cute hand-drawn sticker icon of a chunky pencil writing a squiggle line, thick white outline, transparent background, no text |

## Обложки тем (баннер над названием темы)

Широкий баннер **1200×240**, без текста. Левая половина — спокойная (поверх неё пишется название темы),
основной рисунок — в правой трети. Палитра — под цвет раздела, мягкий градиент, те же рисованные линии.

| Файл | Раздел | Промпт |
|---|---|---|
| `cover-ref.webp` | Справочник по темам (фиолетовый) | Wide hand-drawn banner illustration, soft purple-violet gradient, on the right third: an open glowing reference book with floating C++ symbols `{ }`, `<>`, `::` drawn as cute stickers with white outlines; left two thirds calm and almost empty for a title; playful doodle style, no text |
| `cover-tasks.webp` | Задачник (красный) | Wide hand-drawn banner, warm coral-red gradient, right third: a notebook with checkboxes, a pencil and a small trophy, sticker style with thick white outlines; calm left side for a title; no text |
| `cover-examples.webp` | Примеры программ (зелёный) | Wide hand-drawn banner, fresh green gradient, right third: a little terminal window with blinking cursor and a calculator, tic-tac-toe grid and a password lock as small stickers; calm left side; no text |
| `cover-proekt.webp` | Сквозной проект «Подземелье» (жёлтый) | Wide hand-drawn banner, golden-yellow gradient, right third: a tiny dungeon entrance with a torch, a hero with a sword and a friendly slime monster, ASCII-like stone blocks; sticker style, white outlines; calm left side; no text |
| `cover-igry.webp` | Создание игр (оранжевый) | Wide hand-drawn banner, orange-peach gradient, right third: a game controller, a jumping pixel hero with a motion arc, a heart and a coin; sticker style, white outlines; calm left side; no text |
| `cover-main.webp` | Главное (синий) | Wide hand-drawn banner, calm blue gradient, right third: a signpost with arrows, a map and a compass; sticker style, white outlines; calm left side; no text |
| `cover-notes.webp` | Мои заметки (бирюзовый) | Wide hand-drawn banner, teal gradient, right third: sticky notes, a pen and a highlighter marking a line; sticker style, white outlines; calm left side; no text |

## Уже есть, но пока не используются

`art/unused/` — схемы (`scheme-*.png`: стек и куча, итератор, map, vector, копия или ссылка),
`double.png`, `overflow-int.png`, `cards-review.png` и старые наклейки состояний. Их можно вставить
картинками прямо в темы (`![подпись](...)`) — например, `scheme-Stack-and-heap.png` рядом с
блоком «Память по шагам» в теме про указатели.
