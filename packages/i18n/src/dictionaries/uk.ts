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

  // What Supabase's auth errors say, in the reader's language.
  //
  // Keyed off `AuthError.code`, never off the message: the message is English
  // prose from the auth server, it changes between releases, and matching on it
  // is a translation that silently stops working. A code with no key here falls
  // back to the generic sentence for the action, which is a worse message and
  // never a wrong one.
  "auth.error.invalidCredentials": "Невірна пошта або пароль.",
  "auth.error.emailNotConfirmed": "Адресу ще не підтверджено — перевірте пошту.",
  "auth.error.emailExists": "Обліковий запис із цією адресою вже існує.",
  "auth.error.weakPassword": "Пароль надто простий. Візьміть довший.",
  "auth.error.rateLimited": "Забагато спроб. Спробуйте за кілька хвилин.",
  "auth.error.signupDisabled": "Реєстрацію вимкнено.",
  "auth.error.signInFailed": "Не вдалося увійти. Спробуйте ще раз.",
  "auth.error.registerFailed": "Не вдалося створити обліковий запис. Спробуйте ще раз.",

  // Common ------------------------------------------------------------------
  "common.loading": "Завантаження…",
  "common.tryAgain": "Спробувати ще раз",
  "common.somethingWentWrong": "Щось пішло не так. Спробуйте ще раз.",

  // Domain vocabulary -------------------------------------------------------
  //
  // Enum values the schema holds in English, in the words a lawyer reads. The
  // value itself never changes — `?status=published` stays `published`, and so
  // does the audit row; what changes is what a person sees on screen.
  //
  // The role is deliberately NOT in here. `admin` and `lawyer` are the words an
  // RLS policy is written in, and somebody comparing a screen to a policy needs
  // the same word in both places (see `AppShell`). A service status is not
  // compared to anything — it is read.
  "service.status.draft": "Чернетка",
  "service.status.in_review": "На перевірці",
  "service.status.published": "Опубліковано",
  "service.status.paused": "Призупинено",
  "service.status.archived": "В архіві",

  "service.generationMode.template": "Шаблон",
  "service.generationMode.block_assembly": "Збірка з блоків",
  "service.generationMode.full_generation": "Повна генерація",

  "service.reviewMode.auto": "Автоматично",
  "service.reviewMode.lawyer_required": "Потрібен юрист",

  // Catalogue ---------------------------------------------------------------
  "catalogue.title": "Послуги",
  "catalogue.subtitle":
    "Фільтри та пошук живуть в адресному рядку, тож звужений каталог — це посилання.",
  "catalogue.search.placeholder": "Пошук за назвою, скороченням або описом",
  "catalogue.search.label": "Пошук послуг",
  "catalogue.display.label": "Як показано каталог",
  "catalogue.display.cards": "Картки",
  "catalogue.display.table": "Таблиця",
  "catalogue.filter.area": "Галузь права",
  "catalogue.filter.status": "Статус",
  "catalogue.filter.mineOnly": "Лише послуги, до яких я залучений",
  "catalogue.filter.on": "відфільтровано",
  "catalogue.filter.clear": "Очистити фільтри",
  "catalogue.loading": "Завантажуємо послуги",

  // Three emptinesses, not one (spec §4.1): nothing exists, nothing matches,
  // the request failed. Each keeps its own pair of keys, because collapsing
  // them in a dictionary would collapse them on screen the next time somebody
  // reuses a key that reads close enough.
  "catalogue.empty.none.title": "Послуг ще немає",
  "catalogue.empty.none.hint": "Створіть першу — це кілька хвилин",
  "catalogue.empty.search.title": "Нічого не знайдено",
  "catalogue.empty.search.hint":
    "Жодна послуга не відповідає пошуку. Очистіть фільтри, щоб побачити весь каталог.",
  "catalogue.empty.filters.title": "Нічого не відповідає цим фільтрам",
  "catalogue.empty.filters.hint": "Очистіть фільтри, щоб побачити весь каталог.",
  "catalogue.empty.filters.elsewhere": "У вибраній галузі нічого немає.",
  "catalogue.failed.title": "Не вдалося завантажити каталог",
  "catalogue.failed.hint": "Спробуйте за хвилину",

  "catalogue.error.forbidden": "У вас немає доступу до каталогу послуг.",
  "catalogue.error.notFound": "Цього каталогу більше немає.",
  "catalogue.error.validation": "Не вдалося застосувати фільтр. Спробуйте його очистити.",
  "catalogue.error.conflict":
    "Хтось змінив це, поки ви дивилися. Перезавантажте, щоб побачити поточний стан.",
  "catalogue.error.network": "Не вдалося зв’язатися із сервером. Перевірте з’єднання.",
  "catalogue.error.unknown": "Щось пішло не так під час завантаження каталогу.",

  // A service, as the catalogue and the card describe one ---------------------
  "service.field.service": "Послуга",
  "service.field.area": "Галузь",
  "service.field.accountable": "Відповідальний",
  "service.field.lawyer": "Юрист",
  "service.field.version": "Версія",
  "service.field.currentVersion": "Поточна версія",
  "service.field.price": "Ціна",
  "service.field.status": "Статус",
  "service.field.generationMode": "Режим генерації",
  "service.field.reviewMode": "Перевірка",
  "service.field.lastChanged": "Востаннє змінено",
  // Still a key, though both locales say the same thing today: the day this
  // becomes "верс. {version}" it is a dictionary edit, not a component edit.
  "service.versionShort": "v{version}",
  "service.noVersions": "немає версій",
  "service.noVersionsYet": "версій ще немає",
  "service.nobody": "нікого",
  "service.nameUnavailable": "ім’я недоступне",
  "service.coverExtra": "+{count} на заміні",
  "service.coverExtraShort": "+{count}",

  // The service card --------------------------------------------------------
  "card.loading": "Завантажуємо послугу",
  "card.error.noneSelected": "Послугу не вибрано.",
  "card.error.notFound": "Послугу не знайдено.",
  "card.error.load": "Не вдалося завантажити цю послугу.",
  "card.anatomy": "Анатомія документа →",

  // Who answers for a service (ADM-10) --------------------------------------
  "assignment.title": "Хто відповідає за цю послугу",
  "assignment.subtitle": "Відповідальний — один. Заміна має ті самі права й жодного з обов’язків.",
  "assignment.accountable": "Відповідальний",
  "assignment.nobodyAccountable": "Немає відповідального",
  "assignment.nobodyAccountableHint": "У такому стані послугу не можна опублікувати.",
  "assignment.leaveNobody": "Зняти відповідального",
  "assignment.cover": "Заміна",
  "assignment.noCover": "Ніхто не заміняє на цій послузі.",
  "assignment.makeAccountable": "Зробити відповідальним",
  "assignment.remove": "Прибрати",
  "assignment.attach": "Залучити юриста",
  "assignment.addAsCover": "Додати як заміну",
  "assignment.loadingLawyers": "Завантажуємо юристів…",
  "assignment.lawyersFailed": "Не вдалося завантажити список юристів.",
  "assignment.noLawyers": "Підтверджених юристів ще немає.",
  "assignment.allAttached": "Усіх юристів уже залучено до цієї послуги.",
  "assignment.error.forbidden":
    "Ви не можете зробити цю зміну. Відповідального переносить лише адміністратор, а заміну добирає сам відповідальний.",
  "assignment.error.notFound": "Цієї послуги більше немає.",
  "assignment.error.conflict": "Хтось змінив це першим. Перезавантажте сторінку.",
  "assignment.error.failed": "Зміна не пройшла.",

  // The team screen ---------------------------------------------------------
  "team.title": "Команда",
  // The role itself is not translated (see the domain-vocabulary note above),
  // but the *absence* of one is not a role — it is our word for a registration
  // nobody has decided on yet, and it belongs in the dictionary.
  "team.pending": "очікує",
  "team.approveAsLawyer": "Підтвердити як юриста",
  "team.approveAsAdmin": "Підтвердити як адміністратора",
  "team.error.load": "Не вдалося завантажити команду.",
  "team.error.forbidden": "Підтверджувати реєстрації може лише адміністратор.",
  "team.error.notFound": "Цього користувача більше немає.",
  "team.error.conflict": "Хтось змінив це першим. Оновіть сторінку.",
  "team.error.network": "Не вдалося зв’язатися із сервером. Перевірте з’єднання.",
  "team.error.approve": "Не вдалося підтвердити реєстрацію.",

  // The account screen ------------------------------------------------------
  "account.title": "Профіль",
  "account.role": "Роль",
  "account.roleNone": "не призначено",
  "account.userId": "Ідентифікатор користувача",
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
