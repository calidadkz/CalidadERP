# Tech Stack — CalidadERP
> Связанные заметки: [[Architecture]] | [[Session-Log]]

## Frontend
| Технология | Версия | Назначение |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | ~5.8 | Типизация |
| Vite | 6 | Bundler/dev server |
| Tailwind CSS | 4 | Стили |
| React Router | 7 | Маршрутизация (lazy-loaded routes) |
| React Hook Form | 7 | Формы |
| react-window | 2 | Виртуализация больших списков |
| lucide-react | — | Иконки (единственная иконочная библиотека) |
| xlsx | 0.18 | Экспорт в Excel |
| uuid | 13 | Генерация UUID |

## Backend & Инфраструктура
| Технология | Назначение |
|---|---|
| Supabase | PostgreSQL БД + Auth + Realtime |
| Firebase | Хостинг (Firebase Hosting) |
| Express.js | Локальный сервер (`server.js`) |

## Тестирование
| Технология | Назначение |
|---|---|
| Vitest | Unit-тесты |
| React Testing Library | Компонентные тесты |

## Команды
```bash
npm run dev        # Dev-сервер (Vite)
npm run build      # Production build
npm run test       # Vitest
npm run test:ui    # Vitest UI
npm run start      # Express сервер (server.js)
```

## Конфигурационные файлы
- `vite.config.ts` — Vite config
- `tailwind.config.js` — Tailwind
- `tsconfig.json` — TypeScript
- `firebase.json` — Firebase Hosting deploy
- `eslint.config.js` — ESLint
