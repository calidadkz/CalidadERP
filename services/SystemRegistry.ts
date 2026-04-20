
import { 
  PackageSearch, Box, List, Settings, Truck, ShoppingCart, 
  FileText, History, Calendar, Receipt, Landmark, Users, 
  RefreshCcw, Calculator, ShieldCheck, Trash2, Tag, Hash 
} from 'lucide-react';

export interface RegistryEntry {
  label: string;
  icon: any;
  tabs?: Record<string, { label: string }>;
  fields?: Record<string, { label: string; group?: string }>;
  actions?: Record<string, { label: string }>;
}

/**
 * Единый источник правды для всех контролируемых объектов системы.
 */
export const SystemRegistry: Record<string, RegistryEntry> = {
  inventory: {
    label: 'Остатки и Движения',
    icon: PackageSearch,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' },
      stock_view: { label: 'Вкладка: Остатки' },
      movements_view: { label: 'Вкладка: Движения' }
    },
    fields: {
      kpi_value: { label: 'KPI: Ценность склада', group: 'Аналитика' },
      kpi_revenue: { label: 'KPI: Потенциальная выручка', group: 'Аналитика' },
      col_model: { label: 'Колонка: Модель', group: 'Таблица' },
      col_stock: { label: 'Колонка: Склад', group: 'Таблица' },
      col_incoming: { label: 'Колонка: Путь', group: 'Таблица' },
      col_reserved: { label: 'Колонка: Резерв', group: 'Таблица' },
      col_free: { label: 'Колонка: Свободно', group: 'Таблица' },
      col_cost: { label: 'Колонка: Себестоимость ед.', group: 'Финансы' },
      col_total_cost: { label: 'Колонка: Общая себестоимость', group: 'Финансы' },
      col_sales_price: { label: 'Колонка: Цена продажи', group: 'Финансы' },
      col_revenue: { label: 'Колонка: Выручка (строка)', group: 'Финансы' }
    },
    actions: {
      adjust_btn: { label: 'Кнопка: Ввод остатков' }
    }
  },
  nomenclature: {
    label: 'Номенклатура',
    icon: Box,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    fields: {
      sku: { label: 'Артикул (SKU)', group: 'Основные' },
      name: { label: 'Наименование', group: 'Основные' },
      basePrice: { label: 'Видеть цену закупа (ВЦП)', group: 'Финансы' },
      markup: { label: 'Управлять наценкой', group: 'Финансы' },
      pricingDetails: { label: 'Видеть юнит-экономику', group: 'Финансы' }
    },
    actions: {
      create: { label: 'Создание новых позиций' },
      edit: { label: 'Редактирование состава/BOM' },
      import: { label: 'Импорт из CSV' },
      delete: { label: 'Удаление в корзину' }
    }
  },
  hscodes: {
    label: 'Коды ТНВЭД',
    icon: Hash,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    actions: {
      create: { label: 'Добавление кодов' },
      edit: { label: 'Редактирование кодов' },
      delete: { label: 'Удаление в корзину' },
      import_export: { label: 'Импорт / Экспорт' }
    }
  },
  bundles: {
    label: 'Комплектации',
    icon: List,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' },
      build_tab: { label: 'Вкладка: Сборка новой' },
      templates_tab: { label: 'Вкладка: Библиотека шаблонов' }
    },
    fields: {
      col_name: { label: 'Название шаблона', group: 'Таблица' },
      col_base_model: { label: 'Базовая модель', group: 'Таблица' },
      col_composition: { label: 'Состав опций', group: 'Таблица' },
      col_price: { label: 'Цена продажи (KZT)', group: 'Финансы' },
      option_purchase_price: { label: 'Цена закупа опций (CNY)', group: 'Финансы' },
      economy_details: { label: 'Детализация расчета (Все подробности)', group: 'Финансы' }
    },
    actions: {
      save_template: { label: 'Кнопка: Сохранить шаблон' },
      delete_template: { label: 'Кнопка: Удалить шаблон' },
      edit_template: { label: 'Кнопка: Изменить шаблон' }
    }
  },
  options_editor: {
    label: 'Опции',
    icon: Settings,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    fields: {
      col_purchase_price: { label: 'Цена закупа варианта', group: 'Финансы' },
      col_bom_composition: { label: 'Состав BOM (Привязка к складу)', group: 'Данные' },
      col_compatibility: { label: 'Совместимые категории', group: 'Данные' }
    },
    actions: {
      manage_groups: { label: 'Детали Групп (Типов) опций' },
      manage_variants: { label: 'Детали Вариантов и Состава' },
      import_export: { label: 'Импорт / Экспорт базы' }
    }
  },
  categories: {
    label: 'Категории',
    icon: Settings,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    actions: {
      create: { label: 'Кнопка: Добавить категорию' },
      delete: { label: 'Кнопка: Удалить в корзину' }
    }
  },
  procurement: {
    label: 'Снабжение (ЗП)',
    icon: Truck,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    actions: {
      create: { label: 'Создание заказов поставщикам' },
      edit_prices: { label: 'Правка цен в инвойсе' }
    }
  },
  receiving: {
    label: 'Приемка на склад',
    icon: Box,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    actions: {
      post: { label: 'Проведение приемок' }
    }
  },
  sales: {
    label: 'Продажи (ЗК)',
    icon: ShoppingCart,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' },
      items_tab: { label: 'Вкладка: Состав заказа' },
      payments_tab: { label: 'Вкладка: График оплат' }
    },
    fields: {
      col_client: { label: 'Колонка: Клиент', group: 'Таблица' },
      col_amount: { label: 'Колонка: Сумма', group: 'Таблица' },
      col_payment: { label: 'Колонка: Прогресс оплаты', group: 'Таблица' },
      col_shipment: { label: 'Колонка: Статус отгрузки', group: 'Таблица' },
      col_responsible: { label: 'Колонка: Ответственный менеджер', group: 'Таблица' },
      sales_prices: { label: 'Редактирование цен продажи', group: 'Финансы' },
      economy_details: { label: 'Видеть юнит-экономику (Прибыль)', group: 'Финансы' }
    },
    actions: {
      create: { label: 'Кнопка: Создать новый заказ' },
      edit: { label: 'Кнопка: Редактировать (Карандаш)' },
      delete: { label: 'Кнопка: Удалить в корзину' },
      add_client: { label: 'Кнопка: Быстрое создание клиента' }
    }
  },
  shipment: {
    label: 'Отгрузка',
    icon: FileText,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    fields: {
      col_client: { label: 'Колонка: Клиент', group: 'Журнал' },
      col_order: { label: 'Колонка: Заказ-основание', group: 'Журнал' },
      col_amount: { label: 'Колонка: Сумма накладной', group: 'Журнал' },
      col_status: { label: 'Колонка: Статус', group: 'Журнал' },
      col_stock_info: { label: 'Видеть остатки на складе', group: 'Форма' },
      col_price: { label: 'Видеть цены товаров', group: 'Форма' }
    },
    actions: {
      create: { label: 'Кнопка: Создать отгрузку' },
      post: { label: 'Кнопка: Провести (Списать со склада)' },
      draft: { label: 'Кнопка: В черновик' },
      storno: { label: 'Кнопка: Сторно (Отмена проведения)' }
    }
  },
  discrepancy: {
    label: 'Брак и потери',
    icon: History,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    actions: {
      resolve: { label: 'Принятие решений по браку' }
    }
  },
  finance_calendar: {
    label: 'Календарь (IPP)',
    icon: Calendar,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    actions: {
      execute: { label: 'Исполнение платежей' }
    }
  },
  finance_statements: {
    label: 'Выписки (IP)',
    icon: Receipt,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    actions: {
      allocate: { label: 'Разноска платежей' }
    }
  },
  finance_accounts: {
    label: 'Наши счета',
    icon: Landmark,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    actions: {
      manage: { label: 'Управление счетами' },
      transfer: { label: 'Внутренние переводы/обмен' }
    }
  },
  finance_categories: {
    label: 'Статьи ДДС',
    icon: Tag,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    actions: {
      create: { label: 'Добавление статьи' },
      delete: { label: 'Удаление статьи' }
    }
  },
  counterparties: {
    label: 'Контрагенты',
    icon: Users,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' },
      suppliers_tab: { label: 'Вкладка: Поставщики' },
      clients_tab: { label: 'Вкладка: Клиенты' },
      manufacturers_tab: { label: 'Вкладка: Производители' },
      our_companies_tab: { label: 'Вкладка: Наши компании' },
      employees_tab: { label: 'Вкладка: Сотрудники' }
    },
    fields: {
      col_country: { label: 'Колонка: Страна (Пост.)', group: 'Журнал' },
      col_contact: { label: 'Колонка: Конт. лицо (Кл.)', group: 'Журнал' },
      col_phone: { label: 'Колонка: Телефон (Кл.)', group: 'Журнал' },
      col_balance: { label: 'Видеть баланс (Взаиморасчеты)', group: 'Финансы' }
    },
    actions: {
      manage: { label: 'Кнопка: Добавить контрагента' },
      edit: { label: 'Кнопка: Редактировать' },
      delete: { label: 'Кнопка: Удалить в корзину' }
    }
  },
  rates: {
    label: 'Курсы валют',
    icon: RefreshCcw,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    actions: {
      update: { label: 'Обновление курсов' },
      recalculate: { label: 'Массовый пересчет цен' }
    }
  },
  pricing: {
    label: 'Ценообразование',
    icon: Calculator,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    actions: {
      manage_profiles: { label: 'Управление профилями ЮЭ' }
    }
  },
  permissions: {
    label: 'Права доступа',
    icon: ShieldCheck,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    }
  },
  history: {
    label: 'История (Логи)',
    icon: History,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    }
  },
  recycle_bin: {
    label: 'Корзина',
    icon: Trash2,
    tabs: {
      main: { label: 'Главная: Доступ к разделу' }
    },
    actions: {
      restore: { label: 'Восстановление объектов' },
      purge: { label: 'Окончательное удаление' }
    }
  }
};
