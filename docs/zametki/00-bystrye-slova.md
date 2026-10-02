# Быстрые слова

> Все сниппеты C++: напечатай слово из колонки «Печатай» и нажми **Tab**. Значок ⌄ — при вставке появится меню выбора. **Нажми на строку — раскроется её код.**

Слова встроены в расширение «Документация C++» (настройка `cppDocs.smartSnippets`). После вставки `Tab` прыгает по местам для заполнения, а `⌄` открывает список вариантов (стрелки + Enter).

> **Про `#include` и функции ввода.** Слово само дописывает недостающие `#include` к остальным — уже подключённые не повторяются. `readint`, `readdouble`, `readline`, `readyesno` внутри функции вставляют вызов, а саму функцию кладут над ней, если её ещё нет. Вне функций то же слово вставляет определение.

> _Страница собрана автоматически: `npm run docs:slova`. Слова правятся в `extension/lib/snippets-data.js`, потом перегенерируй._

---

## Каркас

```snippets
main	0	Скелет программы: UTF-8 для русского в консоли, все нужные `<include>` (сам добавит: `<windows.h>`, `<iostream>`, `<string>`)	aW50IG1haW4oKSB7CiAgICBTZXRDb25zb2xlQ1AoQ1BfVVRGOCk7CiAgICBTZXRDb25zb2xlT3V0cHV0Q1AoQ1BfVVRGOCk7CgogICAgcmV0dXJuIDA7Cn0=
maininput	0	Каркас + readInt. Остальные функции ввода добавятся сами, когда напишешь их слово (сам добавит: `<windows.h>`, `<iostream>`, `<string>`; readInt)	aW50IG1haW4oKSB7CiAgICBTZXRDb25zb2xlQ1AoQ1BfVVRGOCk7CiAgICBTZXRDb25zb2xlT3V0cHV0Q1AoQ1BfVVRGOCk7CgogICAgaW50IG4gPSByZWFkSW50KCLQktCy0LXQtNC40YLQtSDRh9C40YHQu9C+OiAiKTsKCiAgICByZXR1cm4gMDsKfQ==
func	1	Заготовка функции: вынести кусок кода из main. У void убери return	aW50IGRvV29yayhpbnQgeCkgewoKICAgIHJldHVybiAwOwp9
```

## Ввод

```snippets
readint	0	В функции — вызов, а сама readInt появится над ней. Отвергает «12abc» и «3.5»	aW50IHJlYWRJbnQoY29uc3Qgc3RkOjpzdHJpbmcgJnByb21wdCwKICAgICAgICAgICAgaW50IGxvID0gc3RkOjpudW1lcmljX2xpbWl0czxpbnQ+OjptaW4oKSwKICAgICAgICAgICAgaW50IGhpID0gc3RkOjpudW1lcmljX2xpbWl0czxpbnQ+OjptYXgoKSkgewogICAgaWYgKGxvID4gaGkpIHsKICAgICAgICBzdGQ6OnN3YXAobG8sIGhpKTsKICAgIH0KICAgIHdoaWxlICh0cnVlKSB7CiAgICAgICAgc3RkOjpjb3V0IDw8IHByb21wdDsKICAgICAgICBzdGQ6OnN0cmluZyBsaW5lOwogICAgICAgIGlmICghc3RkOjpnZXRsaW5lKHN0ZDo6Y2luLCBsaW5lKSkgewogICAgICAgICAgICBzdGQ6OmNvdXQgPDwgIlxu0JLQstC+0LQg0LfQsNC60L7QvdGH0LjQu9GB0Y8uXG4iOwogICAgICAgICAgICBzdGQ6OmV4aXQoMCk7CiAgICAgICAgfQogICAgICAgIHN0ZDo6aXN0cmluZ3N0cmVhbSBpbihsaW5lKTsKICAgICAgICBpbnQgdmFsdWUgPSAwOwogICAgICAgIGNoYXIgZXh0cmEgPSAwOwogICAgICAgIGlmICghKGluID4+IHZhbHVlKSB8fCBpbiA+PiBleHRyYSkgewogICAgICAgICAgICBzdGQ6OmNvdXQgPDwgItCd0YPQttC90L4g0YbQtdC70L7QtSDRh9C40YHQu9C+LlxuIjsKICAgICAgICB9IGVsc2UgaWYgKHZhbHVlIDwgbG8gfHwgdmFsdWUgPiBoaSkgewogICAgICAgICAgICBzdGQ6OmNvdXQgPDwgItCd0YPQttC90L4g0YfQuNGB0LvQviDQvtGCICIgPDwgbG8gPDwgIiDQtNC+ICIgPDwgaGkgPDwgIi5cbiI7CiAgICAgICAgfSBlbHNlIHsKICAgICAgICAgICAgcmV0dXJuIHZhbHVlOwogICAgICAgIH0KICAgIH0KfQ==
readintrange	0	Число строго от..до — readInt переспросит, пока не попадут (сам добавит: readInt)	aW50IG4gPSByZWFkSW50KCLQktCy0LXQtNC40YLQtSDRh9C40YHQu9C+OiAiLCAxLCAxMCk7
readdouble	0	Дробное число, понимает и 3.5, и 3,5. С диапазоном: readDouble("…", 0.5, 2.5)	ZG91YmxlIHJlYWREb3VibGUoY29uc3Qgc3RkOjpzdHJpbmcgJnByb21wdCwKICAgICAgICAgICAgICAgICAgZG91YmxlIGxvID0gc3RkOjpudW1lcmljX2xpbWl0czxkb3VibGU+Ojpsb3dlc3QoKSwKICAgICAgICAgICAgICAgICAgZG91YmxlIGhpID0gc3RkOjpudW1lcmljX2xpbWl0czxkb3VibGU+OjptYXgoKSkgewogICAgaWYgKGxvID4gaGkpIHsKICAgICAgICBzdGQ6OnN3YXAobG8sIGhpKTsKICAgIH0KICAgIHdoaWxlICh0cnVlKSB7CiAgICAgICAgc3RkOjpjb3V0IDw8IHByb21wdDsKICAgICAgICBzdGQ6OnN0cmluZyBsaW5lOwogICAgICAgIGlmICghc3RkOjpnZXRsaW5lKHN0ZDo6Y2luLCBsaW5lKSkgewogICAgICAgICAgICBzdGQ6OmNvdXQgPDwgIlxu0JLQstC+0LQg0LfQsNC60L7QvdGH0LjQu9GB0Y8uXG4iOwogICAgICAgICAgICBzdGQ6OmV4aXQoMCk7CiAgICAgICAgfQogICAgICAgIHN0ZDo6cmVwbGFjZShsaW5lLmJlZ2luKCksIGxpbmUuZW5kKCksICcsJywgJy4nKTsKICAgICAgICBzdGQ6OmlzdHJpbmdzdHJlYW0gaW4obGluZSk7CiAgICAgICAgZG91YmxlIHZhbHVlID0gMC4wOwogICAgICAgIGNoYXIgZXh0cmEgPSAwOwogICAgICAgIGlmICghKGluID4+IHZhbHVlKSB8fCBpbiA+PiBleHRyYSkgewogICAgICAgICAgICBzdGQ6OmNvdXQgPDwgItCd0YPQttC90L4g0YfQuNGB0LvQviAo0LzQvtC20L3QviDQtNGA0L7QsdC90L7QtTogMy41INC40LvQuCAzLDUpLlxuIjsKICAgICAgICB9IGVsc2UgaWYgKHZhbHVlIDwgbG8gfHwgdmFsdWUgPiBoaSkgewogICAgICAgICAgICBzdGQ6OmNvdXQgPDwgItCd0YPQttC90L4g0YfQuNGB0LvQviDQvtGCICIgPDwgbG8gPDwgIiDQtNC+ICIgPDwgaGkgPDwgIi5cbiI7CiAgICAgICAgfSBlbHNlIHsKICAgICAgICAgICAgcmV0dXJuIHZhbHVlOwogICAgICAgIH0KICAgIH0KfQ==
readline	0	Вся строка с пробелами (имя, фраза). Можно смешивать с readInt	c3RkOjpzdHJpbmcgcmVhZExpbmUoY29uc3Qgc3RkOjpzdHJpbmcgJnByb21wdCkgewogICAgc3RkOjpjb3V0IDw8IHByb21wdDsKICAgIHN0ZDo6c3RyaW5nIGxpbmU7CiAgICBpZiAoIXN0ZDo6Z2V0bGluZShzdGQ6OmNpbiwgbGluZSkpIHsKICAgICAgICBzdGQ6OmNvdXQgPDwgIlxu0JLQstC+0LQg0LfQsNC60L7QvdGH0LjQu9GB0Y8uXG4iOwogICAgICAgIHN0ZDo6ZXhpdCgwKTsKICAgIH0KICAgIGlmICghbGluZS5lbXB0eSgpICYmIGxpbmUuYmFjaygpID09ICdccicpIHsKICAgICAgICBsaW5lLnBvcF9iYWNrKCk7CiAgICB9CiAgICByZXR1cm4gbGluZTsKfQ==
readyesno	0	y/да → true, n/нет → false, на опечатку переспрашивает	Ym9vbCByZWFkWWVzTm8oY29uc3Qgc3RkOjpzdHJpbmcgJnByb21wdCkgewogICAgd2hpbGUgKHRydWUpIHsKICAgICAgICBzdGQ6OmNvdXQgPDwgcHJvbXB0OwogICAgICAgIHN0ZDo6c3RyaW5nIGxpbmU7CiAgICAgICAgaWYgKCFzdGQ6OmdldGxpbmUoc3RkOjpjaW4sIGxpbmUpKSB7CiAgICAgICAgICAgIHN0ZDo6Y291dCA8PCAiXG7QktCy0L7QtCDQt9Cw0LrQvtC90YfQuNC70YHRjy5cbiI7CiAgICAgICAgICAgIHN0ZDo6ZXhpdCgwKTsKICAgICAgICB9CiAgICAgICAgc3RkOjppc3RyaW5nc3RyZWFtIGluKGxpbmUpOwogICAgICAgIHN0ZDo6c3RyaW5nIHdvcmQ7CiAgICAgICAgaW4gPj4gd29yZDsKICAgICAgICBpZiAod29yZCA9PSAieSIgfHwgd29yZCA9PSAiWSIgfHwgd29yZCA9PSAieWVzIiB8fCB3b3JkID09ICLQtCIgfHwgd29yZCA9PSAi0JQiIHx8CiAgICAgICAgICAgIHdvcmQgPT0gItC00LAiIHx8IHdvcmQgPT0gItCU0LAiIHx8IHdvcmQgPT0gItCU0JAiKSB7CiAgICAgICAgICAgIHJldHVybiB0cnVlOwogICAgICAgIH0KICAgICAgICBpZiAod29yZCA9PSAibiIgfHwgd29yZCA9PSAiTiIgfHwgd29yZCA9PSAibm8iIHx8IHdvcmQgPT0gItC9IiB8fCB3b3JkID09ICLQnSIgfHwKICAgICAgICAgICAgd29yZCA9PSAi0L3QtdGCIiB8fCB3b3JkID09ICLQndC10YIiIHx8IHdvcmQgPT0gItCd0JXQoiIpIHsKICAgICAgICAgICAgcmV0dXJuIGZhbHNlOwogICAgICAgIH0KICAgICAgICBzdGQ6OmNvdXQgPDwgItCe0YLQstC10YLRjNGC0LUg0LTQsCDQuNC70Lgg0L3QtdGCICh5L24pLlxuIjsKICAgIH0KfQ==
inputkit	0	Добавит те функции ввода, которых ещё нет: readLine, readInt, readDouble, readYesNo (сам добавит: readLine, readInt, readDouble, readYesNo)	
inputloop	0	Читать поток чисел, пока они идут (стоп — буквы или Ctrl+Z) (сам добавит: `<iostream>`)	aW50IHggPSAwOwp3aGlsZSAoc3RkOjpjaW4gPj4geCkgewoKfQ==
readvec	0	Спросить количество и заполнить вектор целых (сам добавит: `<vector>`; readInt)	aW50IG4gPSByZWFkSW50KCLQodC60L7Qu9GM0LrQviDRh9C40YHQtdC7OiAiLCAwLCAxMDAwKTsKc3RkOjp2ZWN0b3I8aW50PiB2KG4pOwpmb3IgKGF1dG8gJml0ZW0gOiB2KSB7CiAgICBpdGVtID0gcmVhZEludCgi0KfQuNGB0LvQvjogIik7Cn0=
readvecd	0	Спросить количество и заполнить вектор дробных (сам добавит: `<vector>`; readInt, readDouble)	aW50IG4gPSByZWFkSW50KCLQodC60L7Qu9GM0LrQviDRh9C40YHQtdC7OiAiLCAwLCAxMDAwKTsKc3RkOjp2ZWN0b3I8ZG91YmxlPiB2KG4pOwpmb3IgKGF1dG8gJml0ZW0gOiB2KSB7CiAgICBpdGVtID0gcmVhZERvdWJsZSgi0KfQuNGB0LvQvjogIik7Cn0=
```

## Объявления

```snippets
vec	1	Объявить вектор (сам добавит: `<vector>`)	c3RkOjp2ZWN0b3I8aW50PiB2Ow==
mapd	1	map: поиск по ключу, ключи отсортированы (сам добавит: `<map>`)	c3RkOjptYXA8c3RkOjpzdHJpbmcsIGludD4gbTs=
setd	1	set: только уникальные значения (сам добавит: `<set>`)	c3RkOjpzZXQ8aW50PiBzZWVuOw==
struct	0	struct с полями и значениями по умолчанию (сам добавит: `<string>`)	c3RydWN0IFN0dWRlbnQgewogICAgc3RkOjpzdHJpbmcgbmFtZTsKICAgIGludCBzY29yZSA9IDA7Cn07
enumclass	0	enum class: именованные варианты вместо чисел	ZW51bSBjbGFzcyBDb2xvciB7IFJlZCwgR3JlZW4sIEJsdWUgfTs=
grid	1	Сетка rows×cols (карта, поле). Тип выбирается один раз (сам добавит: `<vector>`)	aW50IHJvd3MgPSAzLCBjb2xzID0gMzsKc3RkOjp2ZWN0b3I8c3RkOjp2ZWN0b3I8aW50Pj4gZ3JpZChyb3dzLCBzdGQ6OnZlY3RvcjxpbnQ+KGNvbHMpKTs=
```

## Циклы

```snippets
fore	0	range-for без копирования	Zm9yIChjb25zdCBhdXRvICZpdGVtIDogdikgewoKfQ==
forref	0	range-for по ссылке: можно менять элементы	Zm9yIChhdXRvICZpdGVtIDogdikgewoKfQ==
fori	0	Когда нужен номер элемента (size_t, а не int)	Zm9yIChzdGQ6OnNpemVfdCBpID0gMDsgaSA8IHYuc2l6ZSgpOyArK2kpIHsKCn0=
forn	0	Счётный цикл от 0 до n-1	Zm9yIChpbnQgaSA9IDA7IGkgPCBuOyArK2kpIHsKCn0=
form	0	Перебор map: сразу ключ и значение	Zm9yIChjb25zdCBhdXRvICZba2V5LCB2YWx1ZV0gOiBtKSB7Cgp9
```

## Алгоритмы

```snippets
sort	1	less — по возрастанию, greater — по убыванию (сам добавит: `<algorithm>`, `<functional>`)	c3RkOjpzb3J0KHYuYmVnaW4oKSwgdi5lbmQoKSwgc3RkOjpsZXNzPD4oKSk7
sortby	1	Вектор структур по полю: > убывание, < возрастание (сам добавит: `<algorithm>`)	c3RkOjpzb3J0KGdyb3VwLmJlZ2luKCksIGdyb3VwLmVuZCgpLAogICAgICAgICAgW10oY29uc3QgU3R1ZGVudCAmYSwgY29uc3QgU3R1ZGVudCAmYikgeyByZXR1cm4gYS5zY29yZSA+IGIuc2NvcmU7IH0pOw==
countif	0	Сколько элементов подходит под условие (сам добавит: `<algorithm>`)	YXV0byBjb3VudCA9IHN0ZDo6Y291bnRfaWYodi5iZWdpbigpLCB2LmVuZCgpLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtdKGNvbnN0IGF1dG8gJngpIHsgcmV0dXJuIHggPiA0OyB9KTs=
findv	0	Поиск в векторе: end() — не нашли (сам добавит: `<algorithm>`)	YXV0byBpdCA9IHN0ZDo6ZmluZCh2LmJlZ2luKCksIHYuZW5kKCksIHZhbHVlKTsKaWYgKGl0ICE9IHYuZW5kKCkpIHsKCn0=
sumv	1	Начальное значение задаёт тип суммы: 0LL — для целых, 0.0 — для double (сам добавит: `<numeric>`)	YXV0byBzdW0gPSBzdGQ6OmFjY3VtdWxhdGUodi5iZWdpbigpLCB2LmVuZCgpLCAwTEwpOw==
maxv	1	Наибольший/наименьший элемент (на пустом векторе нельзя) (сам добавит: `<algorithm>`)	aWYgKCF2LmVtcHR5KCkpIHsKICAgIGF1dG8gYmVzdCA9ICpzdGQ6Om1heF9lbGVtZW50KHYuYmVnaW4oKSwgdi5lbmQoKSk7Cgp9
eraseif	0	Убрать из вектора все элементы по условию (C++20) (сам добавит: `<vector>`)	c3RkOjplcmFzZV9pZih2LCBbXShjb25zdCBhdXRvICZ4KSB7IHJldHVybiB4IDwgMDsgfSk7
countmap	1	Сколько раз что встретилось: нет ключа → 0 → 1 (сам добавит: `<map>`, `<string>`)	c3RkOjptYXA8c3RkOjpzdHJpbmcsIGludD4gY291bnRlcjsKZm9yIChjb25zdCBhdXRvICZpdGVtIDogaXRlbXMpIHsKICAgICsrY291bnRlcltpdGVtXTsKfQ==
clampv	0	Меньше нижней границы — станет ею, больше верхней — тоже (сам добавит: `<algorithm>`)	dmFsdWUgPSBzdGQ6OmNsYW1wKHZhbHVlLCAwLCAxMDApOw==
```

## Файлы

```snippets
readfile	0	Путь — относительно папки, откуда запущена программа (сам добавит: `<fstream>`, `<iostream>`, `<string>`)	c3RkOjppZnN0cmVhbSBpbigiZGF0YS50eHQiKTsKaWYgKCFpbi5pc19vcGVuKCkpIHsKICAgIHN0ZDo6Y291dCA8PCAi0KTQsNC50Lsg0L3QtSDQvdCw0LnQtNC10L1cbiI7CiAgICByZXR1cm4gMTsKfQpzdGQ6OnN0cmluZyBsaW5lOwp3aGlsZSAoc3RkOjpnZXRsaW5lKGluLCBsaW5lKSkgewoKfQ==
writefile	0	Создать файл и записать в него (старое содержимое стирается) (сам добавит: `<fstream>`, `<iostream>`)	c3RkOjpvZnN0cmVhbSBvdXQoInJlc3VsdC50eHQiKTsKaWYgKCFvdXQuaXNfb3BlbigpKSB7CiAgICBzdGQ6OmNvdXQgPDwgItCd0LUg0YPQtNCw0LvQvtGB0Ywg0LfQsNC/0LjRgdCw0YLRjCDRhNCw0LnQu1xuIjsKICAgIHJldHVybiAxOwp9Cm91dCA8PCA7
```

## Вывод и дроби

```snippets
fmt	0	{} — место для значения (сам добавит: `<format>`, `<iostream>`)	c3RkOjpjb3V0IDw8IHN0ZDo6Zm9ybWF0KCJ7fSA9IHt9XG4iLCBhLCBiKTs=
fmtf	0	Дробь с N знаками после точки (сам добавит: `<format>`, `<iostream>`)	c3RkOjpjb3V0IDw8IHN0ZDo6Zm9ybWF0KCJ7Oi4yZn1cbiIsIHZhbHVlKTs=
table	0	Ровные колонки: format считает символы, а не байты (сам добавит: `<format>`, `<iostream>`)	c3RkOjpjb3V0IDw8IHN0ZDo6Zm9ybWF0KCJ7OjwxMn17Oj42fVxuIiwgItCY0LzRjyIsICLQkdCw0LvQuyIpOwpmb3IgKGNvbnN0IGF1dG8gJnMgOiBncm91cCkgewogICAgc3RkOjpjb3V0IDw8IHN0ZDo6Zm9ybWF0KCJ7OjwxMn17Oj42fVxuIiwgcy5uYW1lLCBzLnNjb3JlKTsKfQ==
avg	0	Среднее: проверка на пустоту и оба static_cast	ZG91YmxlIGF2ZyA9IHYuZW1wdHkoKSA/IDAuMAogICAgOiBzdGF0aWNfY2FzdDxkb3VibGU+KHN1bSkgLyBzdGF0aWNfY2FzdDxkb3VibGU+KHYuc2l6ZSgpKTs=
dbleq	0	double не сравнивают через == (сам добавит: `<cmath>`)	aWYgKHN0ZDo6YWJzKGEgLSBiKSA8IDFlLTkpIHsKCn0=
```

## Строки

```snippets
strconv	0	stoi бросит исключение, если в строке не число (сам добавит: `<string>`)	aW50IG51bWJlciA9IHN0ZDo6c3RvaSh0ZXh0KTsKc3RkOjpzdHJpbmcgdGV4dDIgPSBzdGQ6OnRvX3N0cmluZyhudW1iZXIpOw==
strcase	1	Только латиница: кириллицу в UTF-8 так не поменять (сам добавит: `<cctype>`)	Zm9yIChjaGFyICZjIDogdGV4dCkgewogICAgYyA9IHN0YXRpY19jYXN0PGNoYXI+KHN0ZDo6dG9sb3dlcihzdGF0aWNfY2FzdDx1bnNpZ25lZCBjaGFyPihjKSkpOwp9
split	0	Строка → вектор слов (сам добавит: `<sstream>`, `<string>`, `<vector>`)	c3RkOjppc3RyaW5nc3RyZWFtIHN0cmVhbShsaW5lKTsKc3RkOjpzdHJpbmcgd29yZDsKc3RkOjp2ZWN0b3I8c3RkOjpzdHJpbmc+IHdvcmRzOwp3aGlsZSAoc3RyZWFtID4+IHdvcmQpIHsKICAgIHdvcmRzLnB1c2hfYmFjayh3b3JkKTsKfQ==
```

## Числа и случайность

```snippets
rnd	0	Целое в [от; до], оба конца включены (сам добавит: `<random>`)	c3RhdGljIHN0ZDo6bXQxOTkzNyBybmcoc3RkOjpyYW5kb21fZGV2aWNle30oKSk7CnN0ZDo6dW5pZm9ybV9pbnRfZGlzdHJpYnV0aW9uPGludD4gZGlzdCgxLCA2KTsKaW50IHJvbGwgPSBkaXN0KHJuZyk7
```

## Управление

```snippets
inrange	0	Отвергнуть значение вне [от; до] (сам добавит: `<iostream>`)	aWYgKHZhbHVlIDwgMSB8fCB2YWx1ZSA+IDEwMCkgewogICAgc3RkOjpjb3V0IDw8ICLQndGD0LbQvdC+INGH0LjRgdC70L4g0L7RgiAxINC00L4gMTAwXG4iOwoKfQ==
menu	0	readInt с диапазоном сам отсекает неверные пункты (сам добавит: `<iostream>`; readInt)	aW50IGNob2ljZSA9IHJlYWRJbnQoItCS0YvQsdC10YDQuNGC0LUg0L/Rg9C90LrRgjogIiwgMSwgMyk7CnN3aXRjaCAoY2hvaWNlKSB7CiAgICBjYXNlIDE6CgogICAgICAgIGJyZWFrOwogICAgY2FzZSAyOgogICAgICAgIGJyZWFrOwogICAgZGVmYXVsdDoKICAgICAgICBicmVhazsKfQ==
```

---

_Всего слов: **45**._ Знаешь слово — печатаешь пару букв, VS Code подскажет остальное. Полные примеры каждого приёма — в [Шпаргалке](../01-shpargalka.md) и [Справочнике](../00-НАЧНИ-ОТСЮДА.md).
