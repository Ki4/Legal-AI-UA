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
  "card.history": "Історія змін →",
  "card.law": "Норми, на які спирається →",

  // The history screen (§4.8) -----------------------------------------------
  // Deliberately plain words. This screen is read when somebody is trying to
  // find out what happened, often because something went wrong, and a reader in
  // that state does not want to decode a phrase.
  "history.title": "Історія змін",
  "history.loading": "Завантажуємо історію",
  "history.field.when": "Коли",
  "history.field.who": "Хто",
  "history.field.what": "Що",
  "history.field.action": "Дія",
  "history.field.changed": "Змінені поля",
  "history.action.insert": "Створено",
  "history.action.update": "Змінено",
  "history.action.delete": "Видалено",
  "history.entity.services": "Послуга",
  "history.entity.service_versions": "Версія послуги",
  "history.entity.service_version_prices": "Ціна версії",
  "history.entity.questionnaire_fields": "Поле анкети",
  "history.entity.service_assignments": "Призначення юриста",
  "history.entity.plan_services": "Послуга в тарифі",
  "history.entity.orders": "Замовлення",
  "history.entity.service_law_refs": "Посилання на норму",
  // Somebody acted and we have no name for them — not nobody, and not the
  // system. The sentence has to leave the reader knowing a person was involved.
  "history.actor.unnamed": "невідомий користувач",
  "history.actor.system": "система",
  "history.showMore": "Показати більше",
  "history.loadingMore": "Завантажуємо…",
  "history.empty.title": "Записів ще немає",
  "history.empty.hint":
    "Журнал фіксує зміни з моменту, коли його додали. Послуга, створена раніше, могла не залишити слідів.",
  // Nothing failed here, and the sentence must not sound as if it did.
  "history.restricted.title": "Ця історія вам не видна",
  "history.restricted.hint":
    "Юрист бачить історію послуг, до яких його залучено. Якщо вам потрібна ця — попросіть адміністратора залучити вас.",
  // For a failure that trying again cannot fix. The sentence must not end in
  // an invitation to retry, because there is no button beside it.
  "history.gone.hint": "Перевірте адресу — можливо, послугу видалено або посилання неточне.",
  "history.failed.title": "Історію не завантажено",
  "history.failed.hint": "Це не означає, що змін не було. Спробуйте ще раз.",
  "history.error.noneSelected": "Послугу не вибрано.",
  "history.error.notFound": "Послугу не знайдено.",
  "history.error.forbidden": "У вас немає доступу до історії цієї послуги.",
  "history.error.network": "Не вдалося зв’язатися із сервером. Перевірте з’єднання.",
  "history.error.load": "Не вдалося завантажити історію.",

  // Orders (ADM-66, §4.15) ---------------------------------------------------
  //
  // Клієнт на цих екранах — псевдонім, і жодне слово тут не має натякати, що
  // за ним видно людину. «Замовник» назвав би особу; «клієнт» називає рахунок.
  "nav.orders": "Замовлення",
  "orders.title": "Замовлення",
  "orders.subtitle": "Клієнти позначені псевдонімами. Персональних даних цей екран не показує.",
  "orders.loading": "Завантажуємо замовлення",
  "orders.field.client": "Клієнт",
  "orders.field.service": "Послуга",
  "orders.field.version": "Версія",
  "orders.field.status": "Стан",
  "orders.field.reviewer": "Перевіряє",
  "orders.field.placed": "Створено",
  "orders.reviewer.none": "нікому не передано",
  "orders.reviewer.unnamed": "невідомий юрист",
  "orders.humanReview": "Клієнт попросив людину",
  "orders.showMore": "Показати більше",
  "orders.loadingMore": "Завантажуємо…",
  "orders.empty.title": "Замовлень ще немає",
  "orders.empty.hint":
    "Замовлення створює клієнт через шлюз. Поки шлюз не працює, цей список порожній.",
  // Той самий порожній масив, що й у «немає замовлень», і інша причина.
  "orders.restricted.title": "Тут нічого вам не видно",
  "orders.restricted.hint":
    "Юрист бачить замовлення послуг, до яких його залучено, і ті, що передали особисто йому.",
  "orders.failed.title": "Замовлення не завантажено",
  "orders.failed.hint": "Це не означає, що замовлень немає. Спробуйте ще раз.",
  "orders.error.forbidden": "У вас немає доступу до замовлень.",
  "orders.error.network": "Не вдалося зв’язатися із сервером. Перевірте з’єднання.",
  "orders.error.load": "Не вдалося завантажити замовлення.",

  // Стани замовлення (ADR-0005, §4.16) --------------------------------------
  "order.status.intake": "Збираємо відповіді",
  "order.status.submitted": "Відповіді надано",
  "order.status.generating": "Готуємо документ",
  "order.status.in_review": "На перевірці юриста",
  "order.status.delivered": "Видано",
  "order.status.cancelled": "Скасовано",
  "order.status.abandoned": "Покинуто",

  // The order card (ADM-66, §4.16) -------------------------------------------
  "order.loading": "Завантажуємо замовлення",
  "order.backToList": "← До списку замовлень",
  "order.field.entitlement": "Оплачено за",
  "order.field.ended": "Завершено",
  "order.field.stillOpen": "ще триває",
  "order.gone.hint": "Перевірте адресу. Замовлення могло бути видалене — або воно не ваше.",
  "order.error.noneSelected": "Замовлення не вибрано.",
  "order.error.notFound": "Замовлення не знайдено.",
  "order.error.forbidden": "У вас немає доступу до цього замовлення.",
  "order.error.network": "Не вдалося зв’язатися із сервером. Перевірте з’єднання.",
  "order.error.load": "Не вдалося завантажити замовлення.",

  // Що саме закріплено (§5.4) ------------------------------------------------
  "order.pinned.frozen": "Заморожено",
  "order.pinned.hint":
    "Замовлення закріплене за цією версією назавжди. Навіть коли послугу перевидадуть, документ пояснюється саме нею.",

  // Покупка, за якою видадуть документ (§8.6, ADR-0019) ----------------------
  "order.entitlement.none": "ще не оплачено",
  // Не «нічого не куплено»: рядок існує, просто читати його — справа адміністрування.
  "order.entitlement.withheld": "записано, читає адміністратор",
  "order.entitlement.oneOff": "Разова покупка",
  "order.entitlement.subscription": "Підписка",
  "order.entitlement.until": "діє до",
  "order.entitlement.untilLawChanges": "діє, поки не зміниться закон",
  "order.entitlement.revoked": "Скасовано",

  // Стрічка подій — це читання журналу, а не друга історія (§6.1) ------------
  "order.timeline.title": "Що з ним відбувалося",
  "order.timeline.subtitle":
    "Це читання журналу змін, а не окремий запис. Стан замовлення — проєкція цих подій.",
  "order.timeline.what": "Що сталося",
  "order.timeline.empty.title": "Подій ще немає",
  "order.timeline.empty.hint": "Журнал фіксує зміни з моменту, коли його додали.",

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
  "team.loading": "Завантажуємо команду",
  "team.empty.title": "У команді поки нікого",
  "team.empty.hint": "Щойно хтось зареєструється, він зʼявиться тут і чекатиме на підтвердження.",
  "team.failed.title": "Команда не завантажилася",
  "team.failed.hint": "Це не означає, що в команді нікого — запит не дійшов.",
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

  // The law register (§4.11) -------------------------------------------------
  // The subtitle says the one thing about this screen a reader cannot deduce
  // from it: the register is shared. Without that sentence a lawyer meets a norm
  // their service rests on, changes its cadence, and has no way to know they
  // just changed it for somebody else's service too.
  "nav.law": "Реєстр норм",
  "law.title": "Реєстр норм",
  "law.subtitle":
    "Норму відстежують один раз. Послуги спираються на неї окремо — і на одну норму їх може бути кілька.",
  "law.loading": "Завантажуємо реєстр",
  "law.empty.title": "У реєстрі ще немає норм",
  "law.empty.hint":
    "Норма зʼявляється тут, коли юрист додає посилання на вкладці «Право» відповідної послуги.",
  "law.failed.title": "Реєстр не завантажився",
  "law.failed.hint": "Це не означає, що реєстр порожній — запит не дійшов.",
  "law.error.load": "Не вдалося завантажити реєстр норм.",
  "law.error.forbidden": "Реєстр норм читають лише співробітники фірми.",
  "law.error.network": "Не вдалося зʼєднатися із сервером. Перевірте мережу та спробуйте ще раз.",
  "law.field.act": "Акт",
  "law.field.article": "Стаття",
  "law.field.state": "Стан",
  "law.field.freshness": "Перевірка",
  "law.field.cadence": "Періодичність",
  "law.field.dependents": "Спираються",
  "law.wholeAct": "Весь акт",
  "law.wholeActReason": "Підстава відстежувати весь акт",
  "law.openSource": "Відкрити джерело",
  "law.source.zakon_rada": "zakon.rada.gov.ua",
  "law.dependents.none": "жодна послуга",
  "law.cadence.change": "Змінити періодичність",
  "law.cadence.hours": "Годин між перевірками",
  "law.cadence.reason": "Чому не рекомендована",
  "law.cadence.reasonHint": "Періодичність спільна для всіх послуг, що спираються на цю норму.",
  "law.cadence.save": "Зберегти",
  "law.cadence.saving": "Зберігаємо",
  "law.cadence.cancel": "Скасувати",
  // One sentence for two refusals, because the screen cannot tell them apart:
  // both arrive as a guard raising, and reading the server's own text back to a
  // lawyer is exactly what DoD §6 forbids.
  "law.cadence.error.validation":
    "Таку періодичність відхилено: або вона відрізняється від рекомендованої і не пояснена, або вона рідша за максимум для норми під опублікованою послугою.",
  "law.cadence.error.forbidden":
    "Періодичність змінює адміністратор або юрист послуги, що спирається на цю норму.",
  "law.cadence.error.network": "Не вдалося зʼєднатися із сервером. Зміну не збережено.",
  "law.cadence.error.save": "Не вдалося змінити періодичність.",

  // The states a norm can be in (§9.11) --------------------------------------
  // Six, not the eight §9.11 lists: "stale by time" and "scheduled" are derived
  // rather than stored, so they have their own keys below and none here.
  "law.state.unverified": "Ще не перевірялася",
  "law.state.verified": "Збігається",
  "law.state.drifted": "Текст змінився",
  "law.state.under_review": "Розбирають",
  "law.state.impact_confirmed": "Впливає на документ",
  "law.state.unreachable": "Не вдається прочитати",

  // §9.10: «розбіжностей не знайдено» і «перевірка не відбулася» — різні речі.
  "law.freshness.never": "жодної успішної перевірки",
  "law.freshness.fresh": "перевірено {when}",
  "law.freshness.stale": "не перевірялася з {when}",
  "law.freshness.staleHint":
    "Це окрема тривога, а не тиша: зламаний збирач виглядає точно як ідеальний порядок.",

  // A service's law dependencies (§4.9) --------------------------------------
  "serviceLaw.title": "Норми, на які спирається послуга",
  "serviceLaw.subtitle": "Кожен запис — одна норма і один рядок про те, заради чого вона тут.",
  "serviceLaw.loading": "Завантажуємо посилання на норми",
  "serviceLaw.notFound.title": "Послугу не знайдено",
  "serviceLaw.notFound.hint": "Схоже, в адресі помилка.",
  "serviceLaw.empty.title": "Жодної норми ще не записано",
  "serviceLaw.empty.hint": "Додайте перше посилання формою нижче.",
  "serviceLaw.failed.title": "Посилання не завантажилися",
  "serviceLaw.failed.hint": "Це не означає, що їх немає — запит не дійшов.",
  "serviceLaw.error.load": "Не вдалося завантажити посилання на норми.",
  "serviceLaw.error.forbidden": "Ці посилання читають лише співробітники фірми.",
  "serviceLaw.error.network":
    "Не вдалося зʼєднатися із сервером. Перевірте мережу та спробуйте ще раз.",
  "serviceLaw.reliedOn": "На що спирається",
  "serviceLaw.remove": "Прибрати",
  "serviceLaw.removing": "Прибираємо",
  "serviceLaw.remove.error": "Не вдалося прибрати посилання.",
  "serviceLaw.remove.forbidden":
    "Посилання прибирає адміністратор або юрист, призначений на цю послугу.",

  // Entry (§9.5) -------------------------------------------------------------
  "serviceLaw.add.title": "Додати посилання на норму",
  "serviceLaw.add.url": "Посилання",
  "serviceLaw.add.urlHint":
    "Вставте посилання на чинну редакцію. Якщо ви читали закріплену — вставляйте її, система приведе до чинної.",
  "serviceLaw.add.actTitle": "Назва акта",
  "serviceLaw.add.actTitleHint":
    "Так, як його називають юристи. Знадобиться, лише якщо норми ще немає в реєстрі.",
  "serviceLaw.add.article": "Стаття",
  "serviceLaw.add.articleHint": "Лише номер: 105 або 75-1. Частину чи пункт напишіть рядком нижче.",
  "serviceLaw.add.wholeAct": "Залежність від усього акта",
  "serviceLaw.add.wholeActReason": "Чому весь акт",
  "serviceLaw.add.wholeActHint":
    "Весь акт спрацьовує на будь-яку зміну в ньому. Беріть, лише якщо залежність справді така, і напишіть чому.",
  "serviceLaw.add.reliedOn": "На що спирається",
  "serviceLaw.add.reliedOnHint":
    "Один рядок. Через півроку саме він скаже читачеві, чи важлива зміна.",
  "serviceLaw.add.submit": "Додати",
  "serviceLaw.add.submitting": "Додаємо",
  "serviceLaw.add.resolved": "Відстежуватимемо: {act}",
  // §9.5.1 — вставлену закріплену редакцію не відхиляють, її розвʼязують. Але
  // мовчки цього не роблять: юрист має побачити, що дивитимуться не на те, що
  // він вставив.
  "serviceLaw.add.revisionStripped":
    "Ви вставили закріплену редакцію. Відстежуватимемо чинну — закріплена не змінюється ніколи, тож стеження за нею не спрацювало б жодного разу.",
  // §9.4: залежність від усього акта збирач не читає — стаття є одиницею
  // стеження, а в акта її немає. Кажемо це до кнопки, а не після запису.
  "serviceLaw.add.actNotFetched":
    "Залежність від усього акта текстом не звіряється: стежимо за датою редакції акта, а не за словами конкретної статті.",
  // Звірка з джерелом (§9.5.7, §9.6) -----------------------------------------
  "serviceLaw.check.button": "Показати текст статті",
  "serviceLaw.check.checking": "Читаємо джерело",
  "serviceLaw.check.title": "Текст статті з джерела",
  "serviceLaw.check.instruction":
    "Прочитайте і переконайтеся, що це саме та норма, на яку спирається послуга. Зберегти можна лише після цього.",
  "serviceLaw.check.redaction": "Редакція від {date}",
  "serviceLaw.check.noRedaction": "Джерело не назвало дату редакції.",
  "serviceLaw.check.stale":
    "Посилання або номер статті змінилися після перевірки. Покажіть текст ще раз.",
  "serviceLaw.check.error": "Не вдалося звернутися до збирача. Спробуйте ще раз.",
  "serviceLaw.check.forbidden": "Звіряти текст може адміністратор або юрист.",
  // Кожна відмова має власне речення: юрист може виправити хибний номер статті
  // і не може виправити недоступний сайт, і плутати ці два випадки — значить
  // навчити не читати жодного з них (§9.15).
  "serviceLaw.check.failure.transport":
    "Джерело не відповіло. Це не означає, що стаття змінилася, — це означає, що ми її не бачили.",
  "serviceLaw.check.failure.http_status": "Сторінка акта повернула помилку. Перевірте посилання.",
  "serviceLaw.check.failure.act_identity_moved":
    "Посилання привело до іншого акта. Ймовірно, акт перенесли — відкрийте його на сайті й скопіюйте адресу заново.",
  "serviceLaw.check.failure.heading_missing":
    "На сторінці не знайдено жодної статті. Схоже, джерело змінило розмітку — повідомте розробників.",
  "serviceLaw.check.failure.heading_mismatch":
    "В акті немає такої статті. Перевірте номер — саме цю помилку форма сама побачити не може.",
  "serviceLaw.check.failure.text_blank":
    "Заголовок статті є, а тексту під ним немає. Це схоже на зламану розмітку, а не на порожню статтю.",
  "serviceLaw.check.failure.text_implausibly_short":
    "Текст статті надто короткий, щоб бути статтею. Ми радше промовчимо, ніж запишемо уривок.",
  "serviceLaw.check.failure.revision_date_unparsable":
    "На сторінці акта не вдалося прочитати дату редакції. Без неї стежити за змінами нічим.",
  // Після запису: що саме сталося з нормою (§9.10, §9.11).
  "serviceLaw.check.confirmed": "Норму записано і звірено з джерелом.",
  "serviceLaw.check.moved":
    "Норму записано, але текст статті змінився між перевіркою і збереженням. Відкрийте норму в реєстрі та звірте ще раз.",
  "serviceLaw.check.unreachable":
    "Норму записано, проте звірити текст після запису не вдалося. У реєстрі вона стоїть як недоступна, а не як перевірена.",
  "serviceLaw.link.not_a_url": "Це не схоже на посилання.",
  "serviceLaw.link.unknown_source": "Ми стежимо лише за zakon.rada.gov.ua.",
  "serviceLaw.link.not_an_act_url": "Це посилання не на сторінку акта.",
  "serviceLaw.link.unparsable_act_id":
    "Не вдалося розібрати, який це акт. Відкрийте акт на сайті й скопіюйте адресу звідти.",
  "serviceLaw.article.blank": "Назвіть статтю.",
  "serviceLaw.article.unrecognized": "Лише номер статті: 105 або 75-1.",
  "serviceLaw.add.error.validation":
    "Запис відхилено. Перевірте посилання, номер статті та рядок про те, на що спирається послуга.",
  "serviceLaw.add.error.conflict": "Ця послуга вже спирається на цю норму.",
  "serviceLaw.add.error.forbidden":
    "Посилання додає адміністратор або юрист, призначений на цю послугу.",
  "serviceLaw.add.error.network": "Не вдалося зʼєднатися із сервером. Запис не додано.",
  "serviceLaw.add.error.save": "Не вдалося додати посилання.",
  // Questionnaire fields — §4.4 ------------------------------------------------
  "card.fields": "Поля анкети",
  "serviceFields.title": "Поля анкети",
  "serviceFields.subtitle":
    "Що послуга запитує в клієнта. Ключ незмінний — на нього посилаються блоки шаблона.",
  "serviceFields.backToService": "До послуги",
  "serviceFields.loading": "Завантажуємо поля",
  "serviceFields.empty.title": "Анкета ще порожня",
  "serviceFields.empty.hint": "Додайте перше поле — саме на них посилатиметься шаблон.",
  "serviceFields.failed.title": "Поля не завантажилися",
  "serviceFields.failed.hint": "Це не означає, що анкета порожня — запит не дійшов.",
  "serviceFields.notFound.title": "Послугу не знайдено",
  "serviceFields.notFound.hint": "Перевірте адресу. Можливо, послугу видалено або вона не ваша.",
  "serviceFields.error.load": "Не вдалося завантажити поля анкети.",
  "serviceFields.error.forbidden": "Анкети послуг читають лише співробітники фірми.",
  "serviceFields.error.network":
    "Не вдалося зʼєднатися із сервером. Перевірте мережу та спробуйте ще раз.",

  "serviceFields.column.field": "Поле",
  "serviceFields.column.type": "Тип",
  "serviceFields.column.gdpr": "Захист даних",
  "serviceFields.column.order": "Порядок",
  "serviceFields.column.actions": "Дії",
  "serviceFields.required": "Обовʼязкове",
  "serviceFields.optional": "Необовʼязкове",
  "serviceFields.personalData": "Персональні дані",
  "serviceFields.specialCategory": "Особлива категорія",
  "serviceFields.noPersonalData": "Не персональні",
  "serviceFields.moveUp": "Підняти вище",
  "serviceFields.moveDown": "Опустити нижче",
  "serviceFields.edit": "Редагувати",
  "serviceFields.delete": "Видалити",
  "serviceFields.add": "Додати поле",
  "serviceFields.moving": "Змінюємо порядок",
  "serviceFields.move.error": "Не вдалося змінити порядок.",

  "serviceFields.delete.title": "Видалити поле «{label}»?",
  "serviceFields.delete.description":
    "Блоки шаблона, які посилаються на цей ключ, залишаться без значення. Ключ не звільниться — опублікована версія все одно на нього посилається.",
  "serviceFields.delete.confirm": "Видалити поле",
  "serviceFields.delete.cancel": "Залишити",
  "serviceFields.delete.error": "Не вдалося видалити поле.",
  "serviceFields.delete.forbidden": "Змінювати анкету може адміністратор або юрист цієї послуги.",

  "serviceFields.editor.createTitle": "Нове поле",
  "serviceFields.editor.editTitle": "Поле «{label}»",
  "serviceFields.editor.close": "Закрити",
  "serviceFields.editor.save": "Зберегти",
  "serviceFields.editor.saving": "Зберігаємо",
  "serviceFields.editor.cancel": "Скасувати",
  "serviceFields.editor.key": "Ключ",
  "serviceFields.editor.keyHint": "Малі латинські літери, цифри та підкреслення: applicant_name.",
  "serviceFields.editor.keyImmutable":
    "Ключ не змінюється: на нього посилаються блоки й заморожені версії шаблона. Змінюйте назву.",
  "serviceFields.editor.label": "Назва для клієнта",
  "serviceFields.editor.labelHint": "Те, що людина побачить над полем.",
  "serviceFields.editor.helpText": "Підказка",
  "serviceFields.editor.helpTextHint": "Необовʼязково. Один рядок під полем.",
  "serviceFields.editor.type": "Тип",
  "serviceFields.editor.required": "Обовʼязкове поле",
  "serviceFields.editor.requiredHint": "Без нього клієнт не надішле анкету.",
  "serviceFields.editor.options": "Варіанти вибору",
  "serviceFields.editor.optionsHint": "Потрібен щонайменше один варіант.",
  "serviceFields.editor.optionAdd": "Додати варіант",
  "serviceFields.editor.optionRemove": "Прибрати варіант",
  "serviceFields.editor.optionPlaceholder": "Варіант",
  "serviceFields.editor.gdprSection": "Персональні дані",
  "serviceFields.editor.personalData": "Це персональні дані",
  "serviceFields.editor.personalDataHint":
    "Тоді потрібні підстава та строк зберігання — без них поле не збережеться.",
  "serviceFields.editor.basis": "Правова підстава (ст. 6 GDPR)",
  "serviceFields.editor.retention": "Строк зберігання, днів",
  "serviceFields.editor.retentionHint": "Ціле число днів, більше нуля.",
  "serviceFields.editor.specialCategory": "Особлива категорія (ст. 9 GDPR)",
  "serviceFields.editor.specialCategoryHint":
    "Здоровʼя, релігія, судимість. Це доповнення до підстави вище, а не заміна їй.",
  "serviceFields.editor.specialBasis": "Підстава за ст. 9(2)",

  "serviceFields.reject.key_shape":
    "Ключ має починатися з малої латинської літери й містити лише літери, цифри та підкреслення.",
  "serviceFields.reject.key_taken": "Поле з таким ключем у цій послузі вже є.",
  "serviceFields.reject.label_empty": "Напишіть назву, яку побачить клієнт.",
  "serviceFields.reject.missing_basis": "Оберіть правову підставу.",
  "serviceFields.reject.missing_retention": "Вкажіть строк зберігання.",
  "serviceFields.reject.retention_not_positive": "Строк зберігання — ціле число днів, більше нуля.",
  "serviceFields.reject.missing_special_basis": "Оберіть підставу за ст. 9(2).",
  "serviceFields.reject.options_required": "Додайте щонайменше один варіант вибору.",
  "serviceFields.reject.options_not_allowed": "Варіанти вибору бувають лише в полів вибору.",
  "serviceFields.save.error.save": "Не вдалося зберегти поле.",
  "serviceFields.save.error.validation": "Поле не збережено: запис не відповідає правилам.",
  "serviceFields.save.error.forbidden":
    "Змінювати анкету може адміністратор або юрист цієї послуги.",
  "serviceFields.save.error.conflict": "Хтось змінив це поле раніше. Оновіть сторінку.",
  "serviceFields.save.error.network":
    "Не вдалося зʼєднатися із сервером. Перевірте мережу та спробуйте ще раз.",

  // Типи полів — enum схеми, тому через vocabulary.ts
  "field.type.text": "Рядок",
  "field.type.long_text": "Текст",
  "field.type.number": "Число",
  "field.type.date": "Дата",
  "field.type.boolean": "Так або ні",
  "field.type.select": "Один із варіантів",
  "field.type.multi_select": "Кілька з варіантів",

  // Підстави за ст. 6(1) GDPR — назвами, а не літерами
  "gdpr.basis.consent": "Згода",
  "gdpr.basis.contract": "Виконання договору",
  "gdpr.basis.legal_obligation": "Юридичний обовʼязок",
  "gdpr.basis.vital_interests": "Життєво важливі інтереси",
  "gdpr.basis.public_task": "Публічний інтерес",
  "gdpr.basis.legitimate_interests": "Законний інтерес",

  // Підстави за ст. 9(2) GDPR
  "gdpr.specialBasis.explicit_consent": "Явна згода",
  "gdpr.specialBasis.employment_social_security": "Трудове право та соцзахист",
  "gdpr.specialBasis.vital_interests": "Життєво важливі інтереси",
  "gdpr.specialBasis.not_for_profit_body": "Неприбуткова організація",
  "gdpr.specialBasis.made_public_by_subject": "Оприлюднено самою особою",
  "gdpr.specialBasis.legal_claims": "Захист правових вимог",
  "gdpr.specialBasis.substantial_public_interest": "Істотний публічний інтерес",
  "gdpr.specialBasis.health_care": "Медична допомога",
  "gdpr.specialBasis.public_health": "Громадське здоровʼя",
  "gdpr.specialBasis.archiving_research": "Архівування та дослідження",

  // Document anatomy (§8) ------------------------------------------------------
  //
  // The screen renders a generation trace: which blocks a document is made of,
  // what each one rests on, and who stands behind it. The trace itself is
  // fixture data today (`features/anatomy/api`) — that is a fact about the data
  // source, not about the reader, so the copy is written for the lawyer who
  // will read the real one.
  "anatomy.title": "Анатомія документа",
  "anatomy.subtitle":
    "Послуга {service} — з яких блоків складено документ і на що спирається кожен.",
  "anatomy.loading": "Завантажуємо анатомію документа",
  "anatomy.empty": "Для цієї послуги ще немає згенерованого документа.",
  "anatomy.questionnaireFields": "Поля анкети: {fields}",

  // §8.2 — дві позначки, ніколи не відсоток. Впевнений блок мовчить.
  "anatomy.needsReview": "Варто перевірити",

  // §8.1 — хто написав текст блоку. Дизайн-система дає ці слова, і два з трьох
  // узято звідти дослівно. Третє — ні: `BlockTrust` у схемі траси відповідає на
  // питання «хто це написав», а стан `confirmed` у §8.1 означає «юрист це
  // затвердив», і це різні осі. Блок із шаблону написав юрист заздалегідь;
  // затвердження цього документа не відбувалося, і екран більше про нього не
  // говорить. Друга вісь — хто затвердив — у трасі не існує взагалі.
  "anatomy.trust.template": "Із шаблону юриста",
  "anatomy.trust.ai_generated": "Запропоновано AI",
  "anatomy.trust.lawyer_edited": "Змінено юристом",

  // Ключ на кожен код помилки — той самий підхід, що й у каталозі: сюди
  // приходить `AppError.code`, а не `error.message`.
  "anatomy.error.forbidden": "У вас немає доступу до цього документа.",
  "anatomy.error.notFound": "Для цієї послуги немає збереженої анатомії.",
  "anatomy.error.validation": "Запит відхилено — перевірте посилання, за яким ви прийшли.",
  "anatomy.error.conflict": "Документ змінився, поки ми його читали. Оновіть сторінку.",
  "anatomy.error.network": "Не вдалося зв’язатися із сервером. Перевірте з’єднання.",
  "anatomy.error.unknown": "Щось пішло не так під час завантаження анатомії документа.",

  // Чому блок узагалі тут (§8, «branching conditions»). Умову показуємо так, як
  // її написано в шаблоні, — розбирати її на екрані означало б другу реалізацію
  // мови шаблонів не в тій зоні.
  "anatomy.selectedBy": "Умова: {expression}",
  "anatomy.selectedBy.unconditional": "Блок безумовний — він є в кожному документі.",
  "anatomy.selectedBy.fields": "Умова читає: {fields}",

  // Що виконував core, поки робив блок. Порядок — той, у якому виклики
  // починалися; часу немає навмисне (див. `ToolCallView`).
  "anatomy.toolCalls": "Виклики інструментів",
  "anatomy.toolCall.ok": "виконано",
  "anatomy.toolCall.error": "помилка",
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
  // How much of the log is on screen. Counted, and therefore not a ternary:
  // 1 запис, 3 записи, 5 записів, and round again at 21.
  "history.shown": {
    one: "Показано {count} запис",
    few: "Показано {count} записи",
    many: "Показано {count} записів",
    other: "Показано {count} записів",
  },
  // 1 замовлення, 3 замовлення, 5 замовлень — і знову з 21.
  "orders.shown": {
    one: "Показано {count} замовлення",
    few: "Показано {count} замовлення",
    many: "Показано {count} замовлень",
    other: "Показано {count} замовлень",
  },
  "catalogue.matchesElsewhere": {
    one: "{count} послуга відповідає пошуку в інших галузях.",
    few: "{count} послуги відповідають пошуку в інших галузях.",
    many: "{count} послуг відповідають пошуку в інших галузях.",
    other: "{count} послуг відповідають пошуку в інших галузях.",
  },
  // How many services rest on one norm — the register's whole argument in a
  // number. 1 послуга, 3 послуги, 5 послуг, and round again at 21.
  "law.dependents": {
    one: "{count} послуга",
    few: "{count} послуги",
    many: "{count} послуг",
    other: "{count} послуг",
  },
  // Said on a service's own tab, about the *other* services sharing the norm.
  "serviceLaw.alsoRelied": {
    one: "На цю норму спирається ще {count} послуга.",
    few: "На цю норму спираються ще {count} послуги.",
    many: "На цю норму спираються ще {count} послуг.",
    other: "На цю норму спираються ще {count} послуг.",
  },
  // The cadence, in whichever unit divides evenly — see `cadenceLabel`. Both
  // forms are counted phrases, which is why neither is a ternary.
  // The singular form drops the number on purpose — "щодня" rather than "кожен
  // 1 день". That is what a plural entry is for: the alternative is a
  // `count === 1` ternary at the call site, which is correct English, wrong
  // Ukrainian, and invisible until somebody counts to five.
  "law.cadence.everyHours": {
    one: "щогодини",
    few: "кожні {count} години",
    many: "кожні {count} годин",
    other: "кожні {count} годин",
  },
  "law.cadence.everyDays": {
    one: "щодня",
    few: "кожні {count} дні",
    many: "кожні {count} днів",
    other: "кожні {count} днів",
  },
  // Скільки полів в анкеті. 1 поле, 3 поля, 5 полів — і знову з 21.
  "serviceFields.count": {
    one: "{count} поле",
    few: "{count} поля",
    many: "{count} полів",
    other: "{count} полів",
  },
  // Строк зберігання відповіді. 1 день, 3 дні, 5 днів.
  "serviceFields.retentionDays": {
    one: "зберігаємо {count} день",
    few: "зберігаємо {count} дні",
    many: "зберігаємо {count} днів",
    other: "зберігаємо {count} днів",
  },
  "serviceFields.optionsCount": {
    one: "{count} варіант",
    few: "{count} варіанти",
    many: "{count} варіантів",
    other: "{count} варіантів",
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
