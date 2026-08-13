// Ukrainian — the default locale, and the dictionary that defines the key set.
//
// Every other dictionary is typed against this one, so a key added here and
// forgotten elsewhere fails to compile rather than rendering blank in front of
// somebody. That is the whole reason one dictionary has to be the source: with
// two peers, "which is missing a key" is a question nobody can answer.
//
// Keys are flat and dotted rather than nested. Flat greps: `t("nav.services")`
// finds the string and the usage in one search, which is what a person actually
// does when a label is wrong.
//
// This file and its siblings are the one place in the repository where the
// language rule does not apply (root `CLAUDE.md`): dictionaries are content.

export const uk = {
  // Shell -------------------------------------------------------------------
  "app.name": "Legal-AI-UA",
  "app.console": "Кабінет Legal-AI-UA",
  "nav.services": "Послуги",
  "nav.team": "Команда",
  "nav.account": "Профіль",
  "nav.design": "Дизайн-система",
  "route.notFound": "Сторінку не знайдено",
  "shell.role": "Роль: {role}",
  "shell.roleNone": "немає",

  // Theme -------------------------------------------------------------------
  "theme.toLight": "Світла тема",
  "theme.toDark": "Темна тема",

  // Language ----------------------------------------------------------------
  "language.label": "Мова",

  // Authentication ----------------------------------------------------------
  "auth.email": "Електронна пошта",
  "auth.password": "Пароль",
  "auth.fullName": "Повне ім’я",
  "auth.signIn": "Увійти",
  "auth.register": "Зареєструватися",
  // The prompt and the link are separate keys rather than one sentence with a
  // link inside it. A sentence split across markup fixes its word order in the
  // language it was written in, and translating it then means reordering JSX.
  "auth.noAccount": "Немає облікового запису?",
  "auth.haveAccount": "Уже є обліковий запис?",
  "auth.signingIn": "Входимо…",
  "auth.creatingAccount": "Створюємо обліковий запис…",
  "auth.confirmEmail": "Перевірте пошту, підтвердьте адресу — і тоді увійдіть.",
  "auth.pending.title": "Очікує підтвердження",
  "auth.pending.body":
    "Ваш обліковий запис створено. Доступ відкриється, коли адміністратор підтвердить реєстрацію.",
  "auth.denied.body": "Немає доступу — цей розділ призначено для іншої ролі.",
  "auth.pending.reSignIn":
    "Після підтвердження вийдіть і увійдіть знову — роль приходить із новою сесією.",
  "auth.signOut": "Вийти",

  // Common ------------------------------------------------------------------
  "common.loading": "Завантаження…",
  "common.tryAgain": "Спробувати ще раз",
  "common.somethingWentWrong": "Щось пішло не так. Спробуйте ще раз.",
} as const satisfies Record<string, string>;

/**
 * Counted phrases, kept apart from the plain ones because they are a different
 * shape, not a different subject.
 *
 * Ukrainian has three forms where English has two, which is why this cannot be
 * a `count === 1 ? a : b` at the call site: that ternary is correct English and
 * wrong Ukrainian, and it is invisible until somebody counts to five. The forms
 * a locale actually uses come from `Intl.PluralRules`, so this stays data — no
 * language is special-cased anywhere.
 */
export const ukPlurals = {
  "catalogue.matchesElsewhere": {
    one: "{count} послуга відповідає пошуку в інших галузях.",
    few: "{count} послуги відповідають пошуку в інших галузях.",
    many: "{count} послуг відповідають пошуку в інших галузях.",
    other: "{count} послуг відповідають пошуку в інших галузях.",
  },
} as const satisfies PluralDictionaryShape;

/** The key set every dictionary must provide. */
export type TranslationKey = keyof typeof uk;

/** The counted-phrase key set. */
export type PluralKey = keyof typeof ukPlurals;

/**
 * A plural entry lists only the forms its language has, and must always list
 * `other` — that is the form `Intl.PluralRules` falls back on, and the only one
 * every locale is guaranteed to define.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

type PluralDictionaryShape = Record<string, PluralForms>;

export type Dictionary = Record<TranslationKey, string>;
export type PluralDictionary = Record<PluralKey, PluralForms>;
