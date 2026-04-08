# ADR-003: Точечный пересчёт цен по ценовому профилю
> Связанные заметки: [[Architecture]] | [[Session-Log]]
> Дата: 2026-04-07
> Статус: Принято

## Контекст

В модуле Ценообразование была только кнопка «Пересчитать все» — она обходила все товары и все профили.
При наличии 10+ профилей это неудобно: изменил один профиль → хочешь пересчитать только его товары.

Дополнительная сложность: товар может быть привязан к профилю **явно** (`product.pricingProfileId`)
или **автоматически** — `findProfile(product, allProfiles)` возвращает первый подходящий профиль
по критериям: `supplierId`, `applicableCategoryIds`, `applicableManufacturer`.

## Рассмотренные варианты

1. **Фильтровать по `product.pricingProfileId === profile.id`**
   — Работает только для явно привязанных товаров
   — Пропускает товары, подбирающие профиль автоматически (большинство случаев)

2. **Вызывать `findProfile(product, allProfiles)` для каждого товара и сравнивать результат**
   — Захватывает оба случая: явную и автоматическую привязку
   — Гарантирует, что товар считается по тому же профилю, который бы применился при полном пересчёте
   — Чуть медленнее (O(n × m)), но при реальных объёмах (сотни товаров, десятки профилей) несущественно

## Принятое решение

**Вариант 2** — через `findProfile`.

```typescript
static async recalculateProfilePrices(
    profile: PricingProfile,
    allProfiles: PricingProfile[],
    products: Product[],
    rates: Record<Currency, number>
): Promise<number> {
    const matching = products.filter(p =>
        p && this.findProfile(p, allProfiles)?.id === profile.id
    );
    for (const p of matching) {
        const pricing = this.calculateSmartPrice(p, profile, rates);
        await ApiService.update(TableNames.PRODUCTS, p.id, { salesPrice: pricing.finalPrice });
    }
    return matching.length;
}
```

`findProfile` учитывает все три критерия применимости: поставщик, категория, производитель.
Результат — точно те же товары, которые получили бы этот профиль при массовом пересчёте.

## Последствия

**Плюсы:**
- Точечный пересчёт работает согласованно с массовым — нет расхождений
- UX: кнопка `RefreshCw` на каждой строке таблицы, показывает спиннер и тост «✓ N товаров»
- Массовый пересчёт теперь тоже возвращает `count` обновлённых товаров

**Минусы / компромиссы:**
- Если у товара заполнен `pricingProfileId` (явная привязка), но `findProfile` возвращает другой профиль
  (из-за более специфичного матча), явная привязка будет проигнорирована.
  Это известное ограничение логики `findProfile` — специфичный профиль всегда выигрывает у явного.
- При PART-товарах `configVolumeM3 = undefined` → `calculateSmartPrice` берёт `product.workingVolumeM3`,
  что корректно, но стоит проверить на реальных данных

## Связанный код

- `services/PricingService.ts` — `recalculateProfilePrices()`, `findProfile()` (добавлен `matchManufacturer`)
- `features/products/pages/PricingManagerPage.tsx` — `handleRecalculateProfile()`, состояния `recalcingId` / `recalcResult`
- `types/product.ts` — `PricingProfile.applicableManufacturer?: string`
- **БД**: `ALTER TABLE pricing_profiles ADD COLUMN applicable_manufacturer text`
