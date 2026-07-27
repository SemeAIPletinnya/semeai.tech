(() => {
  const copy = {
    en: {
      "workspace.nav.skills": "Skills",
      "workspace.link.skills.index": "METHOD EVIDENCE",
      "workspace.link.skills": "Skill Forge review",
      "workspace.skills.title": "Skills",
      "workspace.skills.body": "Admitted skill records will belong here when a backend persistence and admission contract exists. The public registry currently contains review evidence only.",
      "workspace.skills.open": "Inspect public Skill Forge evidence",
      "workspace.context.skills": "Skills"
    },
    uk: {
      "workspace.nav.skills": "Навички",
      "workspace.link.skills.index": "ДОКАЗИ МЕТОДУ",
      "workspace.link.skills": "Перегляд Skill Forge",
      "workspace.skills.title": "Навички",
      "workspace.skills.body": "Допущені записи навичок будуть тут, коли з’явиться backend-контракт збереження й допуску. Публічний реєстр зараз містить лише докази для перегляду.",
      "workspace.skills.open": "Переглянути публічні докази Skill Forge",
      "workspace.context.skills": "Навички"
    },
    ru: {
      "workspace.nav.skills": "Навыки",
      "workspace.link.skills.index": "ДОКАЗАТЕЛЬСТВА МЕТОДА",
      "workspace.link.skills": "Проверка Skill Forge",
      "workspace.skills.title": "Навыки",
      "workspace.skills.body": "Допущенные записи навыков будут здесь, когда появится backend-контракт хранения и допуска. Публичный реестр сейчас содержит только доказательства для проверки.",
      "workspace.skills.open": "Проверить публичные доказательства Skill Forge",
      "workspace.context.skills": "Навыки"
    }
  };

  const api = window.SemeAI_I18n;
  if (api?.dict) {
    ["en", "uk", "ru"].forEach((lang) => Object.assign(api.dict[lang], copy[lang]));
    api.apply(document);
  }
})();
