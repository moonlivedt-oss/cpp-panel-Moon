  // ==== runtime/15-library.js — переключатель библиотеки: C++ ⇄ Unreal Engine ====
  // ---------------------------------------------------------------------------
  //  Переключение — это смена окна, а не вкладки: текущее окно сохраняет прогресс и полностью
  //  останавливается (cdStop: разметка, стиль, таймеры, подписки, поток событий), его данные
  //  отпускаются, и рантайм запускается заново (cdRuntime) с заготовкой другой библиотеки — только
  //  с адресами её файлов. Тексты она читает уже из своего файла данных (refreshData), прогресс —
  //  из своего зеркала и своего ключа localStorage. Из прежней библиотеки не остаётся ничего.
  //
  //  Хост узнаёт о смене действием «library» (боковая панель, статус-бар, другие окна VS Code
  //  переключаются следом); смену из VS Code (команда) окно ловит событием «lib».
  //  Во вкладке страницу под новую библиотеку пересобирает сам хост.
  // ---------------------------------------------------------------------------
  /** Другая подключённая библиотека ('' — её нет: кнопку переключения не показываем). */
  function otherLibrary() {
    var d = DATA();
    if (!d || !d.libs) return "";
    var ids = Object.keys(d.libs).filter(function (id) { return id !== LIB && d.libs[id].available; });
    return ids[0] || "";
  }

  var _switching = false;
  function switchLibrary(id, fromHost) {
    var d = DATA();
    if (_switching || _cdStopped || !d || !d.libs || !d.libs[id] || id === LIB) return false;
    if (!d.libs[id].available) {
      toast("Папка «" + libMeta(id).title + "» не найдена — укажи её в настройке cppDocs.unrealPath", true);
      return false;
    }
    _switching = true;
    if (!fromHost) {
      sendAction({ kind: "library", lib: id }, function (res) {
        if (IN_PANEL && !res.ok) { _switching = false; toast("Не переключилось: " + (res.error || "ошибка"), true); }
      });
    }
    if (IN_PANEL) return true;
    try { localStorage.setItem("cppdocs.lib", id); } catch (e) {}
    var stub = libStub(d, id);
    if (CD_NONCE) stub.scriptNonce = CD_NONCE;   // новый запуск не видит своего <script> — nonce отсюда
    window.__CPPDOCS_NEXT__ = { lib: id, open: isOpen() };
    cdStop();
    window.__CPPDOCS__ = stub;                   // данные прежней библиотеки больше никто не держит
    setTimeout(function () {
      try { cdRuntime(); } catch (e) { try { console.warn("[cpp-docs] смена библиотеки: " + (e && e.message || e)); } catch (x) {} }
    }, 0);
    return true;
  }

  /** Событие «lib» (файл выбора сменился): { lib, at }. */
  function onLibEvent(txt) {
    var o = null;
    try { o = JSON.parse(String(txt)); } catch (e) { return; }
    if (o && typeof o.lib === "string" && LIB_RE.test(o.lib) && o.lib !== LIB) switchLibrary(o.lib, true);
  }
  // Без потока событий — опрос файла выбора. Первое прочтение только запоминает метку: файл мог
  // ещё не догнать кнопку переключения (хост не ответил), и откатывать её нельзя.
  var _libAt = null;
  function pollLib() {
    if (IN_PANEL) return;
    var d = DATA(), txt = d && d.libUrl ? appRead(d.libUrl) : null, o = null;
    try { o = txt ? JSON.parse(txt) : null; } catch (e) { return; }
    if (!o || typeof o.at !== "number") return;
    if (_libAt === null) { _libAt = o.at; return; }
    if (o.at !== _libAt) { _libAt = o.at; onLibEvent(txt); }
  }
