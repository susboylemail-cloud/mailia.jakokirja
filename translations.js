// Multi-language translations for Mailia Delivery Tracking System
// Supports: Finnish (fi), Russian (ru), English (en)

const translations = {
    fi: {
        // Login & Authentication
        'login.title': 'Kirjaudu sisään',
        'login.username': 'Käyttäjätunnus',
        'login.password': 'Salasana',
        'login.button': 'Kirjaudu',
        'login.swipeUp': 'Vedä ylös kirjautuaksesi',
        'logout.button': 'Kirjaudu ulos',
        
        // Navigation & Tabs
        'nav.delivery': 'Jakelu',
        'nav.tracker': 'Seuranta',
        'nav.messages': 'Piirien viestit',
        'nav.reports': 'Raportit',
        
        // Settings
        'settings.title': 'Asetukset',
        'settings.theme': 'Teema',
        'settings.language': 'Kieli',
        'settings.checkboxes': 'Kuittausruudut käytössä',
        'settings.hideStf': 'Piilota STF',
        'settings.hideDelivered': 'Piilota kuitatut tilaukset',
        'settings.addSubscriber': 'Lisää tilaaja',
        
        // Themes
        'theme.light': 'Vaalea',
        'theme.dark': 'Tumma',
        'theme.highContrast': 'Korkea kontrasti',
        'theme.sepia': 'Seepia',
        
        // Languages
        'language.finnish': 'Suomi',
        'language.russian': 'Русский',
        'language.english': 'English',
        
        // Circuit Selection
        'circuit.select': 'Valitse piiri',
        'circuit.search': 'Valitse piiri',
        'circuit.noResults': 'Ei tuloksia',
        
        // Route Management
        'route.start': 'Aloita reitti',
        'route.complete': 'Merkitse valmiiksi',
        'route.completeFull': 'Reitti valmis',
        'route.startTime': 'Aloitusaika',
        'route.endTime': 'Lopetusaika',
        'route.optimize': 'Optimoi järjestys',
        'route.showMap': 'Näytä kartalla',
        'route.hideMap': 'Piilota kartta',
        'route.progress': 'Edistyminen',
        
        // Delivery
        'delivery.counts': 'Piirin lehtimäärät',
        'delivery.total': 'Yhteensä',
        'delivery.delivered': 'Toimitettu',
        'delivery.remaining': 'Jäljellä',
        'delivery.number': 'Toimitus',
        
        // Products
        'products.title': 'Tuotteet',
        'products.es': 'ES',
        'products.uv': 'UV',
        'products.hs': 'HS',
        'products.stf': 'STF',
        
        // Date & Time
        'date.today': 'Tänään',
        'date.monday': 'Maanantai',
        'date.tuesday': 'Tiistai',
        'date.wednesday': 'Keskiviikko',
        'date.thursday': 'Torstai',
        'date.friday': 'Perjantai',
        'date.saturday': 'Lauantai',
        'date.sunday': 'Sunnuntai',
        
        // Actions
        'action.save': 'Tallenna',
        'action.cancel': 'Peruuta',
        'action.delete': 'Poista',
        'action.edit': 'Muokkaa',
        'action.add': 'Lisää',
        'action.refresh': 'Päivitä',
        'action.close': 'Sulje',
        'action.confirm': 'Vahvista',
        'action.back': 'Takaisin',
        
        // Messages
        'message.title': 'Viestit',
        'message.send': 'Lähetä',
        'message.typeMessage': 'Kirjoita viesti...',
        'message.noMessages': 'Ei viestejä',
        'message.report': 'Raportoi ongelma',
        
        // Notifications
        'notif.routeStarted': 'Reitti aloitettu',
        'notif.routeCompleted': 'Reitti valmis!',
        'notif.circuitUpdated': 'Piiri päivitetty',
        'notif.updateFailed': 'Päivitys epäonnistui',
        'notif.saved': 'Tallennettu',
        'notif.deleted': 'Poistettu',
        'notif.error': 'Virhe',
        'notif.success': 'Onnistui',
        
        // Pull to Refresh
        'pullToRefresh.pull': 'Vedä päivittääksesi',
        'pullToRefresh.release': 'Vapauta päivittääksesi',
        'pullToRefresh.refreshing': 'Päivitetään...',
        
        // Admin
        'admin.title': 'Hallinta',
        'admin.addSubscriber': 'Lisää tilaaja',
        'admin.editSubscriber': 'Muokkaa tilaajaa',
        'admin.deleteSubscriber': 'Poista tilaaja',
        'admin.duplicates': 'Duplikaatit',
        'admin.export': 'Vie tiedot',
        
        // Subscriber
        'subscriber.name': 'Nimi',
        'subscriber.address': 'Osoite',
        'subscriber.products': 'Tuotteet',
        'subscriber.building': 'Rakennus',
        'subscriber.apartment': 'Asunto',
        
        // Weather
        'weather.temperature': 'Lämpötila',
        'weather.feelsLike': 'Tuntuu kuin',
        'weather.wind': 'Tuuli',
        
        // Errors
        'error.loginFailed': 'Kirjautuminen epäonnistui',
        'error.loadFailed': 'Lataus epäonnistui',
        'error.saveFailed': 'Tallennus epäonnistui',
        'error.network': 'Verkkovirhe',
        'error.notFound': 'Ei löytynyt',
        'error.unauthorized': 'Ei käyttöoikeutta',
        
        // Confirmation
        'confirm.deleteSubscriber': 'Haluatko varmasti poistaa tämän tilaajan?',
        'confirm.completeRoute': 'Merkitäänkö reitti valmiiksi?',
        'confirm.deleteMessage': 'Haluatko varmasti poistaa tämän viestin?',
    },
    
    ru: {
        // Login & Authentication
        'login.title': 'Войти',
        'login.username': 'Имя пользователя',
        'login.password': 'Пароль',
        'login.button': 'Войти',
        'login.swipeUp': 'Проведите вверх для входа',
        'logout.button': 'Выйти',
        
        // Navigation & Tabs
        'nav.delivery': 'Доставка',
        'nav.tracker': 'Отслеживание',
        'nav.messages': 'Сообщения маршрутов',
        'nav.reports': 'Отчёты',
        
        // Settings
        'settings.title': 'Настройки',
        'settings.theme': 'Тема',
        'settings.language': 'Язык',
        'settings.checkboxes': 'Флажки включены',
        'settings.hideStf': 'Скрыть STF',
        'settings.hideDelivered': 'Скрыть доставленные заказы',
        'settings.addSubscriber': 'Добавить подписчика',
        
        // Themes
        'theme.light': 'Светлая',
        'theme.dark': 'Тёмная',
        'theme.highContrast': 'Высокий контраст',
        'theme.sepia': 'Сепия',
        
        // Languages
        'language.finnish': 'Suomi',
        'language.russian': 'Русский',
        'language.english': 'English',
        
        // Circuit Selection
        'circuit.select': 'Выберите маршрут',
        'circuit.search': 'Выберите маршрут',
        'circuit.noResults': 'Нет результатов',
        
        // Route Management
        'route.start': 'Начать маршрут',
        'route.complete': 'Отметить как выполненное',
        'route.completeFull': 'Маршрут завершён',
        'route.startTime': 'Время начала',
        'route.endTime': 'Время окончания',
        'route.optimize': 'Оптимизировать порядок',
        'route.showMap': 'Показать на карте',
        'route.hideMap': 'Скрыть карту',
        'route.progress': 'Прогресс',
        
        // Delivery
        'delivery.counts': 'Количество газет на маршруте',
        'delivery.total': 'Всего',
        'delivery.delivered': 'Доставлено',
        'delivery.remaining': 'Осталось',
        'delivery.number': 'Доставка',
        
        // Products
        'products.title': 'Продукты',
        'products.es': 'ES',
        'products.uv': 'UV',
        'products.hs': 'HS',
        'products.stf': 'STF',
        
        // Date & Time
        'date.today': 'Сегодня',
        'date.monday': 'Понедельник',
        'date.tuesday': 'Вторник',
        'date.wednesday': 'Среда',
        'date.thursday': 'Четверг',
        'date.friday': 'Пятница',
        'date.saturday': 'Суббота',
        'date.sunday': 'Воскресенье',
        
        // Actions
        'action.save': 'Сохранить',
        'action.cancel': 'Отмена',
        'action.delete': 'Удалить',
        'action.edit': 'Редактировать',
        'action.add': 'Добавить',
        'action.refresh': 'Обновить',
        'action.close': 'Закрыть',
        'action.confirm': 'Подтвердить',
        'action.back': 'Назад',
        
        // Messages
        'message.title': 'Сообщения',
        'message.send': 'Отправить',
        'message.typeMessage': 'Введите сообщение...',
        'message.noMessages': 'Нет сообщений',
        'message.report': 'Сообщить о проблеме',
        
        // Notifications
        'notif.routeStarted': 'Маршрут начат',
        'notif.routeCompleted': 'Маршрут завершён!',
        'notif.circuitUpdated': 'Маршрут обновлён',
        'notif.updateFailed': 'Не удалось обновить',
        'notif.saved': 'Сохранено',
        'notif.deleted': 'Удалено',
        'notif.error': 'Ошибка',
        'notif.success': 'Успешно',
        
        // Pull to Refresh
        'pullToRefresh.pull': 'Потяните для обновления',
        'pullToRefresh.release': 'Отпустите для обновления',
        'pullToRefresh.refreshing': 'Обновление...',
        
        // Admin
        'admin.title': 'Управление',
        'admin.addSubscriber': 'Добавить подписчика',
        'admin.editSubscriber': 'Редактировать подписчика',
        'admin.deleteSubscriber': 'Удалить подписчика',
        'admin.duplicates': 'Дубликаты',
        'admin.export': 'Экспорт данных',
        
        // Subscriber
        'subscriber.name': 'Имя',
        'subscriber.address': 'Адрес',
        'subscriber.products': 'Продукты',
        'subscriber.building': 'Здание',
        'subscriber.apartment': 'Квартира',
        
        // Weather
        'weather.temperature': 'Температура',
        'weather.feelsLike': 'Ощущается как',
        'weather.wind': 'Ветер',
        
        // Errors
        'error.loginFailed': 'Не удалось войти',
        'error.loadFailed': 'Не удалось загрузить',
        'error.saveFailed': 'Не удалось сохранить',
        'error.network': 'Ошибка сети',
        'error.notFound': 'Не найдено',
        'error.unauthorized': 'Нет доступа',
        
        // Confirmation
        'confirm.deleteSubscriber': 'Вы действительно хотите удалить этого подписчика?',
        'confirm.completeRoute': 'Отметить маршрут как завершённый?',
        'confirm.deleteMessage': 'Вы действительно хотите удалить это сообщение?',
    },
    
    en: {
        // Login & Authentication
        'login.title': 'Sign In',
        'login.username': 'Username',
        'login.password': 'Password',
        'login.button': 'Login',
        'login.swipeUp': 'Swipe up to login',
        'logout.button': 'Logout',
        
        // Navigation & Tabs
        'nav.delivery': 'Delivery',
        'nav.tracker': 'Tracker',
        'nav.messages': 'Route Messages',
        'nav.reports': 'Reports',
        
        // Settings
        'settings.title': 'Settings',
        'settings.theme': 'Theme',
        'settings.language': 'Language',
        'settings.checkboxes': 'Checkboxes enabled',
        'settings.hideStf': 'Hide STF',
        'settings.hideDelivered': 'Hide delivered orders',
        'settings.addSubscriber': 'Add subscriber',
        
        // Themes
        'theme.light': 'Light',
        'theme.dark': 'Dark',
        'theme.highContrast': 'High Contrast',
        'theme.sepia': 'Sepia',
        
        // Languages
        'language.finnish': 'Suomi',
        'language.russian': 'Русский',
        'language.english': 'English',
        
        // Circuit Selection
        'circuit.select': 'Select circuit',
        'circuit.search': 'Select circuit',
        'circuit.noResults': 'No results',
        
        // Route Management
        'route.start': 'Start route',
        'route.complete': 'Mark complete',
        'route.completeFull': 'Route complete',
        'route.startTime': 'Start time',
        'route.endTime': 'End time',
        'route.optimize': 'Optimize order',
        'route.showMap': 'Show on map',
        'route.hideMap': 'Hide map',
        'route.progress': 'Progress',
        
        // Delivery
        'delivery.counts': 'Circuit newspaper counts',
        'delivery.total': 'Total',
        'delivery.delivered': 'Delivered',
        'delivery.remaining': 'Remaining',
        'delivery.number': 'Delivery',
        
        // Products
        'products.title': 'Products',
        'products.es': 'ES',
        'products.uv': 'UV',
        'products.hs': 'HS',
        'products.stf': 'STF',
        
        // Date & Time
        'date.today': 'Today',
        'date.monday': 'Monday',
        'date.tuesday': 'Tuesday',
        'date.wednesday': 'Wednesday',
        'date.thursday': 'Thursday',
        'date.friday': 'Friday',
        'date.saturday': 'Saturday',
        'date.sunday': 'Sunday',
        
        // Actions
        'action.save': 'Save',
        'action.cancel': 'Cancel',
        'action.delete': 'Delete',
        'action.edit': 'Edit',
        'action.add': 'Add',
        'action.refresh': 'Refresh',
        'action.close': 'Close',
        'action.confirm': 'Confirm',
        'action.back': 'Back',
        
        // Messages
        'message.title': 'Messages',
        'message.send': 'Send',
        'message.typeMessage': 'Type a message...',
        'message.noMessages': 'No messages',
        'message.report': 'Report issue',
        
        // Notifications
        'notif.routeStarted': 'Route started',
        'notif.routeCompleted': 'Route complete!',
        'notif.circuitUpdated': 'Circuit updated',
        'notif.updateFailed': 'Update failed',
        'notif.saved': 'Saved',
        'notif.deleted': 'Deleted',
        'notif.error': 'Error',
        'notif.success': 'Success',
        
        // Pull to Refresh
        'pullToRefresh.pull': 'Pull to refresh',
        'pullToRefresh.release': 'Release to refresh',
        'pullToRefresh.refreshing': 'Refreshing...',
        
        // Admin
        'admin.title': 'Administration',
        'admin.addSubscriber': 'Add subscriber',
        'admin.editSubscriber': 'Edit subscriber',
        'admin.deleteSubscriber': 'Delete subscriber',
        'admin.duplicates': 'Duplicates',
        'admin.export': 'Export data',
        
        // Subscriber
        'subscriber.name': 'Name',
        'subscriber.address': 'Address',
        'subscriber.products': 'Products',
        'subscriber.building': 'Building',
        'subscriber.apartment': 'Apartment',
        
        // Weather
        'weather.temperature': 'Temperature',
        'weather.feelsLike': 'Feels like',
        'weather.wind': 'Wind',
        
        // Errors
        'error.loginFailed': 'Login failed',
        'error.loadFailed': 'Load failed',
        'error.saveFailed': 'Save failed',
        'error.network': 'Network error',
        'error.notFound': 'Not found',
        'error.unauthorized': 'Unauthorized',
        
        // Confirmation
        'confirm.deleteSubscriber': 'Are you sure you want to delete this subscriber?',
        'confirm.completeRoute': 'Mark route as complete?',
        'confirm.deleteMessage': 'Are you sure you want to delete this message?',
    }
};

// Translation helper function
function t(key, lang = null) {
    const currentLang = lang || localStorage.getItem('language') || 'fi';
    return translations[currentLang]?.[key] || translations.fi[key] || key;
}

// Apply translations to all elements with data-i18n attribute
function applyTranslations(lang = null) {
    const currentLang = lang || localStorage.getItem('language') || 'fi';
    
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = translations[currentLang]?.[key] || translations.fi[key];
        
        if (translation) {
            // Check if we should update placeholder, value, or text content
            if (element.hasAttribute('placeholder')) {
                element.placeholder = translation;
            } else if (element.tagName === 'INPUT' && element.type !== 'checkbox') {
                element.value = translation;
            } else {
                element.textContent = translation;
            }
        }
    });
    
    // Update document language attribute
    document.documentElement.lang = currentLang;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { translations, t, applyTranslations };
}
