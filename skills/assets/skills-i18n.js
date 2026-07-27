(() => {
  const dict = {
    en: {
      "skills.page.title": "Skill Forge evidence | SemeAI",
      "skills.skip": "Skip to Skill Forge evidence",
      "skills.kicker": "SKILL FORGE / REVIEW FOUNDATION",
      "skills.h1": "METHOD BECOMES A CANDIDATE.",
      "skills.h1.span": "REVIEW DECIDES ADMISSION.",
      "skills.lede": "A public evidence surface for reusable workflow candidates. Generation, repository presence, and successful tests do not admit a skill.",
      "skills.action.registry": "Inspect the registry",
      "skills.action.contract": "Read the admission boundary",
      "skills.trace.aria": "Skill candidate sequence",
      "skills.trace.evidence": "WORKFLOW EVIDENCE",
      "skills.trace.candidate": "SKILL CANDIDATE",
      "skills.trace.review": "REVIEW / ADMISSION",
      "skills.trace.registry": "REGISTRY TRACE",
      "skills.boundary.title": "Skill generation is not skill admission.",
      "skills.boundary.body": "Codex may extract or generate a candidate. An explicit review decision is still required. No admitted skills or operating marketplace are represented here.",
      "skills.registry.title": "One candidate. Zero admitted skills.",
      "skills.registry.fallback": "The available evidence supports qualitative review only. Statistical improvement and universal transfer are not established.",
      "skills.cases.title": "Available GET JOB cases.",
      "skills.cases.fallback": "Structured case evidence loads without changing the preserved source artifacts.",
      "skills.market.title": "Marketplace remains a future hypothesis.",
      "skills.market.body": "Admission, installation, versioning, evaluation, provenance, permissions, demand, payment, legal, and operator contracts must exist first."
    },
    uk: {
      "skills.page.title": "Докази Skill Forge | SemeAI",
      "skills.skip": "Перейти до доказів Skill Forge",
      "skills.kicker": "SKILL FORGE / ОСНОВА ПЕРЕГЛЯДУ",
      "skills.h1": "МЕТОД СТАЄ КАНДИДАТОМ.",
      "skills.h1.span": "ПЕРЕГЛЯД ВИРІШУЄ ДОПУСК.",
      "skills.lede": "Публічна доказова поверхня для кандидатів повторно використовуваних процесів. Генерація, наявність репозиторію і успішні тести не допускають навичку.",
      "skills.action.registry": "Переглянути реєстр",
      "skills.action.contract": "Прочитати межу допуску",
      "skills.trace.aria": "Послідовність кандидата навички",
      "skills.trace.evidence": "ДОКАЗИ ПРОЦЕСУ",
      "skills.trace.candidate": "КАНДИДАТ НАВИЧКИ",
      "skills.trace.review": "ПЕРЕГЛЯД / ДОПУСК",
      "skills.trace.registry": "СЛІД РЕЄСТРУ",
      "skills.boundary.title": "Генерація навички не є її допуском.",
      "skills.boundary.body": "Codex може виділити або згенерувати кандидата. Потрібне окреме рішення перегляду. Тут немає допущених навичок чи діючого маркетплейсу.",
      "skills.registry.title": "Один кандидат. Нуль допущених навичок.",
      "skills.registry.fallback": "Наявні докази підтримують лише якісний перегляд. Статистичне покращення та універсальне перенесення не встановлені.",
      "skills.cases.title": "Наявні випадки GET JOB.",
      "skills.cases.fallback": "Структуровані докази випадків завантажуються без зміни збережених джерел.",
      "skills.market.title": "Маркетплейс залишається майбутньою гіпотезою.",
      "skills.market.body": "Спочатку мають існувати допуск, встановлення, версіонування, оцінка, походження, дозволи, попит, оплата, юридичні та операторські контракти."
    },
    ru: {
      "skills.page.title": "Доказательства Skill Forge | SemeAI",
      "skills.skip": "Перейти к доказательствам Skill Forge",
      "skills.kicker": "SKILL FORGE / ОСНОВА ПРОВЕРКИ",
      "skills.h1": "МЕТОД СТАНОВИТСЯ КАНДИДАТОМ.",
      "skills.h1.span": "ПРОВЕРКА РЕШАЕТ ДОПУСК.",
      "skills.lede": "Публичная доказательная поверхность для кандидатов повторно используемых процессов. Генерация, наличие репозитория и успешные тесты не допускают навык.",
      "skills.action.registry": "Проверить реестр",
      "skills.action.contract": "Прочитать границу допуска",
      "skills.trace.aria": "Последовательность кандидата навыка",
      "skills.trace.evidence": "ДОКАЗАТЕЛЬСТВА ПРОЦЕССА",
      "skills.trace.candidate": "КАНДИДАТ НАВЫКА",
      "skills.trace.review": "ПРОВЕРКА / ДОПУСК",
      "skills.trace.registry": "СЛЕД РЕЕСТРА",
      "skills.boundary.title": "Генерация навыка не является его допуском.",
      "skills.boundary.body": "Codex может выделить или сгенерировать кандидата. Требуется отдельное решение проверки. Здесь нет допущенных навыков или действующего маркетплейса.",
      "skills.registry.title": "Один кандидат. Ноль допущенных навыков.",
      "skills.registry.fallback": "Имеющиеся доказательства поддерживают только качественную проверку. Статистическое улучшение и универсальный перенос не установлены.",
      "skills.cases.title": "Доступные случаи GET JOB.",
      "skills.cases.fallback": "Структурированные доказательства случаев загружаются без изменения сохранённых источников.",
      "skills.market.title": "Маркетплейс остаётся будущей гипотезой.",
      "skills.market.body": "Сначала должны существовать допуск, установка, версионирование, оценка, происхождение, разрешения, спрос, оплата, юридические и операторские контракты."
    }
  };

  function merge() {
    const api = window.SemeAI_I18n;
    if (!api?.dict) return false;
    ["en", "uk", "ru"].forEach((lang) => Object.assign(api.dict[lang], dict[lang]));
    return true;
  }

  function apply() {
    if (merge()) window.SemeAI_I18n.apply(document);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
  else apply();
})();
