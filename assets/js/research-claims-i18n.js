(() => {
  const copy = {
    en: {
      "research.claims.eyebrow": "CLAIM CLASSIFICATION",
      "research.claims.title": "Evidence changes what may be said.",
      "research.claims.measured": "A value captured by a named method, fixture, and bounded observation.",
      "research.claims.demonstrated": "A behavior reproduced by an inspectable implementation or test.",
      "research.claims.observed": "A recorded outcome without enough cases for a general claim.",
      "research.claims.hypothesis": "A direction requiring further implementation or evaluation.",
      "research.claims.historical": "Preserved prior language that is not promoted into a current technical claim."
    },
    uk: {
      "research.claims.eyebrow": "КЛАСИФІКАЦІЯ ТВЕРДЖЕНЬ",
      "research.claims.title": "Докази змінюють те, що можна стверджувати.",
      "research.claims.measured": "Значення, зафіксоване названим методом, fixture та обмеженим спостереженням.",
      "research.claims.demonstrated": "Поведінка, відтворена інспектованою реалізацією або тестом.",
      "research.claims.observed": "Зафіксований результат без достатньої кількості випадків для загального твердження.",
      "research.claims.hypothesis": "Напрям, що потребує подальшої реалізації або оцінки.",
      "research.claims.historical": "Збережена попередня мова, яка не переноситься у поточне технічне твердження."
    },
    ru: {
      "research.claims.eyebrow": "КЛАССИФИКАЦИЯ УТВЕРЖДЕНИЙ",
      "research.claims.title": "Доказательства меняют то, что можно утверждать.",
      "research.claims.measured": "Значение, зафиксированное названным методом, fixture и ограниченным наблюдением.",
      "research.claims.demonstrated": "Поведение, воспроизведённое инспектируемой реализацией или тестом.",
      "research.claims.observed": "Зафиксированный результат без достаточного числа случаев для общего утверждения.",
      "research.claims.hypothesis": "Направление, требующее дальнейшей реализации или оценки.",
      "research.claims.historical": "Сохранённая прежняя формулировка, которая не переносится в текущее техническое утверждение."
    }
  };

  function apply() {
    const api = window.SemeAI_I18n;
    if (!api?.dict) return;
    ["en", "uk", "ru"].forEach((lang) => Object.assign(api.dict[lang], copy[lang]));
    api.apply(document);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
  else apply();
})();
