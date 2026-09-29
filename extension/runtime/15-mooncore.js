  // ==== runtime/15-mooncore.js — новое API Moon Core: выключение без перезагрузки, общая шина ====
  // ---------------------------------------------------------------------------
  //  Moon Core умеет выключить модуль без перезагрузки окна и снова включить его (тот же файл
  //  выполняется заново). Поэтому всё, что окно заводит глобально, снимается в cdStop():
  //  подписки (cdOnGlobal / cdTrack в 00-core.js), тикер, наблюдатели, поток событий моста,
  //  пилюля, окно, стиль. Прогресс перед этим сохраняется.
  //
  //  Общая шина модулей: акцент фона MoonLight BG приходит ключом «mlbg.accent» (раньше — только
  //  событием окна «mlbg-accent», оно тоже осталось для старого фона), а своё состояние окно
  //  публикует ключом «cppdocs.view» { open, title } — соседям видно, открыта ли документация.
  //  Со старым Moon Core (без onDispose / share) всё это молча пропускается.
  // ---------------------------------------------------------------------------
  var _cdStopped = false;

  function cdStop() {
    if (_cdStopped) return;
    try { flushMirror(); } catch (e) {}                 // отметки и прогресс — на диск до ухода
    _cdStopped = true;
    var off = _cdOff.splice(0);
    for (var i = off.length - 1; i >= 0; i--) { try { off[i](); } catch (e) {} }
    try { document.removeEventListener("keydown", onKey, true); } catch (e) {}
    try { if (_docked) applyDock(false); } catch (e) {}
    try { hideHlPop(); hideItemMenu(); hideBridge(); } catch (e) {}
    try { if (_es) { _es.close(); _es = null; } } catch (e) {}
    [WIN_ID, BTN_ID, STYLE_ID].forEach(function (id) {
      try { var n = document.getElementById(id); if (n) n.remove(); } catch (e) {}
    });
    try { if (winEl && winEl.parentNode) winEl.parentNode.removeChild(winEl); } catch (e) {}
    winEl = null; winOpen = false;
    try { if (MCM && typeof MCM.share === "function") MCM.share("cppdocs.view", undefined); } catch (e) {}
    // Повторное включение выполнит файл заново — защита «один рантайм на окно» не должна мешать.
    window.__CPPDOCS_RUNTIME__ = false;
    try { delete window.__cppDocs; } catch (e) { window.__cppDocs = undefined; }
  }

  var _cdViewSig = "";
  function cdShareView() {
    if (!MCM || typeof MCM.share !== "function" || _cdStopped) return;
    var open = false, title = "";
    try { open = !!isOpen(); } catch (e) {}
    try { title = current ? String(current.title || current.rel || "").slice(0, 120) : ""; } catch (e) {}
    var sig = open + "|" + title;
    if (sig === _cdViewSig) return;
    try { if (MCM.share("cppdocs.view", { open: open, title: title })) _cdViewSig = sig; } catch (e) {}
  }

  function cdMoonCoreApi() {
    if (!MCM) return;
    if (typeof MCM.onDispose === "function") MCM.onDispose(cdStop);
    if (typeof MCM.shared === "function") {
      cdTrack(MCM.shared("mlbg.accent", function () { _accentSig = ""; try { applyAccent(); } catch (e) {} }));
    }
    cdShareView();
  }
