# 🗄️ Database Schema Summary

Generated on: Mon, 16 Mar 2026 13:05:13 GMT

### 📄 Table: `shipments`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `date` | `date` | YES | CURRENT_DATE |
| `sales_order_id` | `text` | YES | - |
| `client_name` | `text` | YES | - |
| `status` | `text` | NO | - |
| `updated_at` | `timestamp with time zone` | YES | now() |

---
### 📄 Table: `currency_lots`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | gen_random_uuid() |
| `date` | `timestamp with time zone` | YES | now() |
| `currency` | `text` | NO | - |
| `amount_original` | `numeric` | NO | - |
| `amount_remaining` | `numeric` | NO | - |
| `rate` | `numeric` | NO | - |
| `cost_in_kzt` | `numeric` | NO | - |

---
### 📄 Table: `bank_accounts`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `name` | `text` | NO | - |
| `bank` | `text` | NO | - |
| `number` | `text` | NO | - |
| `currency` | `text` | NO | - |
| `balance` | `numeric` | YES | 0 |
| `updated_at` | `timestamp with time zone` | YES | now() |

---
### 📄 Table: `cash_flow_items`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | gen_random_uuid() |
| `name` | `text` | NO | - |
| `type` | `text` | NO | - |
| `updated_at` | `timestamp with time zone` | YES | now() |

---
### 📄 Table: `exchange_rates`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `currency` | `text` | NO | - |
| `rate` | `numeric` | NO | 1.0 |
| `updated_at` | `timestamp with time zone` | YES | now() |

---
### 📄 Table: `internal_order_items`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | (gen_random_uuid())::text |
| `internal_order_id` | `text` | YES | - |
| `product_id` | `text` | YES | - |
| `quantity` | `numeric` | NO | - |

---
### 📄 Table: `pre_calculations`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `name` | `text` | NO | - |
| `date` | `timestamp with time zone` | YES | now() |
| `status` | `text` | NO | 'Draft'::text |
| `tax_scheme` | `text` | NO | - |
| `exchange_rate_usd_kzt` | `numeric` | NO | 450 |
| `shipping_china_usd` | `numeric` | NO | 0 |
| `shipping_karaganda_kzt` | `numeric` | NO | 0 |
| `svh_kzt` | `numeric` | NO | 0 |
| `broker_kzt` | `numeric` | NO | 0 |
| `customs_fees_kzt` | `numeric` | NO | 0 |
| `customs_vat_kzt` | `numeric` | NO | 0 |
| `total_volume_m3` | `numeric` | YES | 0 |
| `total_weight_kg` | `numeric` | YES | 0 |
| `notes` | `text` | YES | - |
| `updated_at` | `timestamp with time zone` | YES | now() |
| `exchange_rate_cny_kzt` | `numeric` | YES | 63 |
| `cit_rate_standard` | `numeric` | YES | 20 |
| `cit_rate_simplified` | `numeric` | YES | 3 |
| `vat_rate` | `numeric` | YES | 16 |
| `intercompany_markup_percent` | `numeric` | YES | 1 |

---
### 📄 Table: `pre_calculation_items`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `pre_calculation_id` | `text` | YES | - |
| `product_id` | `text` | YES | - |
| `product_name` | `text` | NO | - |
| `sku` | `text` | YES | - |
| `order_id` | `text` | YES | - |
| `client_id` | `text` | YES | - |
| `client_name` | `text` | YES | - |
| `type` | `text` | NO | 'Stock'::text |
| `quantity` | `integer` | NO | 1 |
| `supplier_price_usd` | `numeric` | NO | 0 |
| `selling_price_kzt` | `numeric` | NO | 0 |
| `length_mm` | `numeric` | YES | 0 |
| `width_mm` | `numeric` | YES | 0 |
| `height_mm` | `numeric` | YES | 0 |
| `weight_kg` | `numeric` | YES | 0 |
| `volume_m3` | `numeric` | YES | 0 |
| `purchase_kzt` | `numeric` | YES | 0 |
| `logistics_cn_kzt` | `numeric` | YES | 0 |
| `logistics_local_kzt` | `numeric` | YES | 0 |
| `svh_kzt` | `numeric` | YES | 0 |
| `broker_kzt` | `numeric` | YES | 0 |
| `customs_fees_kzt` | `numeric` | YES | 0 |
| `customs_vat_kzt` | `numeric` | YES | 0 |
| `pnr_kzt` | `numeric` | YES | 0 |
| `delivery_local_kzt` | `numeric` | YES | 0 |
| `advertising_kzt` | `numeric` | YES | 0 |
| `bonus_kzt` | `numeric` | YES | 0 |
| `tax_kzt` | `numeric` | YES | 0 |
| `vat_kzt` | `numeric` | YES | 0 |
| `total_expenses_kzt` | `numeric` | YES | 0 |
| `profit_kzt` | `numeric` | YES | 0 |
| `margin_percent` | `numeric` | YES | 0 |

---
### 📄 Table: `packing_places`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `pre_calculation_id` | `text` | YES | - |
| `place_number` | `integer` | NO | - |
| `length_mm` | `numeric` | YES | 0 |
| `width_mm` | `numeric` | YES | 0 |
| `height_mm` | `numeric` | YES | 0 |
| `weight_kg` | `numeric` | YES | 0 |
| `volume_m3` | `numeric` | YES | 0 |
| `description` | `text` | YES | - |
| `updated_at` | `timestamp with time zone` | YES | now() |

---
### 📄 Table: `packing_place_items`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `packing_place_id` | `text` | YES | - |
| `pre_calculation_item_id` | `text` | YES | - |
| `quantity` | `integer` | NO | 1 |

---
### 📄 Table: `sales_order_items`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | gen_random_uuid() |
| `sales_order_id` | `text` | YES | - |
| `product_id` | `text` | YES | - |
| `product_name` | `text` | YES | - |
| `sku` | `text` | YES | - |
| `quantity` | `integer` | NO | - |
| `price_kzt` | `numeric` | NO | - |
| `total_kzt` | `numeric` | NO | - |
| `configuration` | `ARRAY` | YES | '{}'::text[] |

---
### 📄 Table: `pricing_profile_categories`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `profile_id` | `uuid` | NO | - |
| `category_id` | `text` | NO | - |

---
### 📄 Table: `pre_calculation_packages`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | gen_random_uuid() |
| `pre_calculation_id` | `text` | YES | - |
| `package_number` | `integer` | NO | - |
| `length_mm` | `numeric` | YES | - |
| `width_mm` | `numeric` | YES | - |
| `height_mm` | `numeric` | YES | - |
| `weight_kg` | `numeric` | YES | - |
| `volume_m3` | `numeric` | YES | - |
| `description` | `text` | YES | - |
| `items` | `jsonb` | YES | '[]'::jsonb |
| `created_at` | `timestamp with time zone` | YES | now() |

---
### 📄 Table: `manufacturers`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `name` | `text` | NO | - |
| `country` | `text` | YES | - |
| `description` | `text` | YES | - |
| `legal_address` | `text` | YES | - |
| `bin_iin` | `text` | YES | - |
| `iik` | `text` | YES | - |
| `bik` | `text` | YES | - |
| `kbe` | `text` | YES | - |
| `bank_name` | `text` | YES | - |
| `director` | `text` | YES | - |
| `legal_email` | `text` | YES | - |
| `updated_at` | `timestamp with time zone` | YES | now() |

---
### 📄 Table: `role_permissions`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | gen_random_uuid() |
| `role` | `text` | NO | - |
| `matrix` | `jsonb` | NO | '{}'::jsonb |
| `updated_at` | `timestamp with time zone` | YES | now() |

---
### 📄 Table: `hscodes`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `code` | `text` | NO | - |
| `name` | `text` | NO | - |
| `description` | `text` | YES | - |
| `updated_at` | `timestamp with time zone` | YES | now() |
| `duty_percentage` | `numeric` | YES | 0 |
| `duty_wto_percentage` | `numeric` | YES | 0 |
| `permits` | `text` | YES | - |
| `explanation` | `text` | YES | - |

---
### 📄 Table: `reception_items`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | gen_random_uuid() |
| `reception_id` | `text` | YES | - |
| `product_id` | `text` | NO | - |
| `product_name` | `text` | YES | - |
| `sku` | `text` | YES | - |
| `qty_plan` | `integer` | YES | - |
| `qty_fact` | `integer` | YES | - |
| `price_foreign` | `numeric` | YES | - |
| `cost_base_kzt` | `numeric` | YES | - |
| `allocated_expense_kzt` | `numeric` | YES | - |
| `final_cost_unit_kzt` | `numeric` | YES | - |
| `configuration` | `ARRAY` | YES | '{}'::text[] |
| `volume_m3` | `numeric` | YES | 0 |

---
### 📄 Table: `option_types`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `name` | `text` | NO | - |
| `is_required` | `boolean` | YES | false |
| `is_single_select` | `boolean` | YES | true |
| `updated_at` | `timestamp with time zone` | YES | now() |
| `category_id` | `text` | YES | - |
| `supplier_id` | `text` | YES | - |
| `manufacturer` | `text` | YES | - |

---
### 📄 Table: `option_variants`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `type_id` | `text` | YES | - |
| `name` | `text` | NO | - |
| `price` | `numeric` | YES | 0 |
| `currency` | `text` | YES | 'CNY'::text |
| `composition` | `jsonb` | YES | '[]'::jsonb |
| `updated_at` | `timestamp with time zone` | YES | now() |
| `category_id` | `text` | YES | - |
| `supplier_id` | `text` | YES | - |
| `manufacturer` | `text` | YES | - |
| `length_mm` | `numeric` | YES | - |
| `width_mm` | `numeric` | YES | - |
| `height_mm` | `numeric` | YES | - |
| `volume_m3` | `numeric` | YES | - |
| `supplier_product_name` | `text` | YES | - |
| `description` | `text` | YES | - |

---
### 📄 Table: `internal_orders`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | (gen_random_uuid())::text |
| `date` | `text` | NO | - |
| `requested_by` | `text` | YES | - |
| `status` | `text` | NO | 'Draft'::text |

---
### 📄 Table: `our_companies`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `name` | `text` | NO | - |
| `contact_person` | `text` | YES | - |
| `phone` | `text` | YES | - |
| `legal_address` | `text` | YES | - |
| `bin_iin` | `text` | YES | - |
| `iik` | `text` | YES | - |
| `bik` | `text` | YES | - |
| `kbe` | `text` | YES | - |
| `bank_name` | `text` | YES | - |
| `director` | `text` | YES | - |
| `legal_email` | `text` | YES | - |
| `updated_at` | `timestamp with time zone` | YES | now() |

---
### 📄 Table: `logs`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `timestamp` | `timestamp with time zone` | YES | now() |
| `user` | `text` | YES | 'Admin'::text |
| `action` | `text` | NO | - |
| `document_type` | `text` | YES | - |
| `document_id` | `text` | YES | - |
| `description` | `text` | YES | - |

---
### 📄 Table: `trash`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | gen_random_uuid() |
| `original_id` | `text` | NO | - |
| `type` | `text` | NO | - |
| `name` | `text` | YES | - |
| `data` | `jsonb` | NO | - |
| `deleted_at` | `timestamp with time zone` | YES | now() |

---
### 📄 Table: `suppliers`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `name` | `text` | NO | - |
| `country` | `text` | YES | - |
| `updated_at` | `timestamp with time zone` | YES | now() |
| `legal_address` | `text` | YES | - |
| `bin_iin` | `text` | YES | - |
| `iik` | `text` | YES | - |
| `bik` | `text` | YES | - |
| `kbe` | `text` | YES | - |
| `bank_name` | `text` | YES | - |
| `director` | `text` | YES | - |
| `legal_email` | `text` | YES | - |

---
### 📄 Table: `clients`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `name` | `text` | NO | - |
| `contact_person` | `text` | YES | - |
| `phone` | `text` | YES | - |
| `updated_at` | `timestamp with time zone` | YES | now() |
| `legal_address` | `text` | YES | - |
| `bin_iin` | `text` | YES | - |
| `iik` | `text` | YES | - |
| `bik` | `text` | YES | - |
| `kbe` | `text` | YES | - |
| `bank_name` | `text` | YES | - |
| `director` | `text` | YES | - |
| `legal_email` | `text` | YES | - |

---
### 📄 Table: `employees`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `name` | `text` | NO | - |
| `contact_person` | `text` | YES | - |
| `phone` | `text` | YES | - |
| `legal_address` | `text` | YES | - |
| `bin_iin` | `text` | YES | - |
| `iik` | `text` | YES | - |
| `bik` | `text` | YES | - |
| `kbe` | `text` | YES | - |
| `bank_name` | `text` | YES | - |
| `director` | `text` | YES | - |
| `legal_email` | `text` | YES | - |
| `updated_at` | `timestamp with time zone` | YES | now() |

---
### 📄 Table: `shipment_items`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | gen_random_uuid() |
| `shipment_id` | `text` | YES | - |
| `product_id` | `text` | NO | - |
| `product_name` | `text` | YES | - |
| `sku` | `text` | YES | - |
| `qty_shipped` | `integer` | NO | - |
| `price_kzt` | `numeric` | NO | - |
| `configuration` | `ARRAY` | YES | '{}'::text[] |

---
### 📄 Table: `actual_payments`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `date` | `date` | YES | CURRENT_DATE |
| `direction` | `text` | NO | - |
| `counterparty_id` | `text` | YES | - |
| `counterparty_name` | `text` | YES | - |
| `amount` | `numeric` | NO | - |
| `currency` | `text` | NO | - |
| `bank_account_id` | `text` | YES | - |
| `exchange_rate` | `numeric` | YES | 1 |
| `total_cost_kzt` | `numeric` | YES | 0 |

---
### 📄 Table: `internal_transactions`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `date` | `date` | YES | CURRENT_DATE |
| `type` | `text` | NO | - |
| `from_account_id` | `text` | YES | - |
| `to_account_id` | `text` | YES | - |
| `amount_sent` | `numeric` | NO | - |
| `amount_received` | `numeric` | NO | - |
| `fee` | `numeric` | YES | 0 |
| `rate` | `numeric` | YES | 1 |

---
### 📄 Table: `payment_allocations`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `actual_payment_id` | `text` | NO | - |
| `planned_payment_id` | `text` | NO | - |
| `amount_covered` | `numeric` | NO | - |

---
### 📄 Table: `planned_payments`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `direction` | `text` | NO | - |
| `source_doc_id` | `text` | NO | - |
| `source_doc_type` | `text` | NO | - |
| `counterparty_id` | `text` | YES | - |
| `counterparty_name` | `text` | YES | - |
| `amount_due` | `numeric` | NO | - |
| `amount_paid` | `numeric` | YES | 0 |
| `currency` | `text` | NO | - |
| `due_date` | `date` | YES | - |
| `is_paid` | `boolean` | YES | false |
| `cash_flow_item_id` | `uuid` | YES | - |

---
### 📄 Table: `supplier_order_items`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | gen_random_uuid() |
| `supplier_order_id` | `text` | YES | - |
| `product_id` | `text` | YES | - |
| `product_name` | `text` | YES | - |
| `sku` | `text` | YES | - |
| `quantity` | `integer` | NO | - |
| `price_foreign` | `numeric` | NO | - |
| `total_foreign` | `numeric` | NO | - |
| `configuration` | `ARRAY` | YES | '{}'::text[] |
| `product_base_price` | `numeric` | YES | 0 |
| `product_currency` | `text` | YES | - |
| `exchange_rate_to_order_currency` | `numeric` | YES | 1 |
| `product_type` | `text` | YES | - |

---
### 📄 Table: `pricing_profiles`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | gen_random_uuid() |
| `name` | `text` | NO | - |
| `supplier_id` | `text` | YES | - |
| `logistics_rate_usd` | `numeric` | NO | 0 |
| `batch_volume_m3` | `numeric` | NO | 0 |
| `batch_shipping_cost_kzt` | `numeric` | NO | 0 |
| `batch_svh_cost_kzt` | `numeric` | NO | 0 |
| `broker_cost_kzt` | `numeric` | NO | 0 |
| `customs_fees_kzt` | `numeric` | NO | 0 |
| `vat_rate` | `numeric` | NO | 16 |
| `cit_rate` | `numeric` | NO | 20 |
| `sales_bonus_rate` | `numeric` | NO | 0 |
| `pnr_cost_kzt` | `numeric` | NO | 0 |
| `delivery_kzt` | `numeric` | NO | 0 |
| `target_net_margin_percent` | `numeric` | NO | 20 |
| `updated_at` | `timestamp with time zone` | YES | now() |

---
### 📄 Table: `product_categories`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `name` | `text` | NO | - |
| `type` | `text` | NO | - |
| `updated_at` | `timestamp with time zone` | YES | now() |

---
### 📄 Table: `profiles`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | - |
| `email` | `text` | NO | - |
| `full_name` | `text` | YES | - |
| `role` | `text` | YES | 'manager'::text |
| `updated_at` | `timestamp with time zone` | YES | now() |
| `nickname` | `text` | YES | - |

---
### 📄 Table: `counterparties`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `name` | `text` | NO | - |
| `type` | `text` | NO | - |
| `bin_iin` | `text` | YES | - |
| `legal_address` | `text` | YES | - |
| `contact_person` | `text` | YES | - |
| `phone` | `text` | YES | - |
| `director` | `text` | YES | - |
| `legal_email` | `text` | YES | - |
| `notes` | `text` | YES | - |
| `created_at` | `timestamp with time zone` | NO | now() |
| `updated_at` | `timestamp with time zone` | NO | now() |
| `country` | `text` | YES | - |
| `bank_name` | `text` | YES | - |
| `iik` | `text` | YES | - |
| `bik` | `text` | YES | - |
| `kbe` | `text` | YES | - |

---
### 📄 Table: `counterparty_accounts`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | gen_random_uuid() |
| `counterparty_id` | `text` | NO | - |
| `name` | `text` | NO | - |
| `iik` | `text` | NO | - |
| `bik` | `text` | NO | - |
| `bank_name` | `text` | NO | - |
| `currency` | `text` | NO | - |
| `is_default` | `boolean` | NO | false |
| `created_at` | `timestamp with time zone` | NO | now() |
| `updated_at` | `timestamp with time zone` | NO | now() |

---
### 📄 Table: `supplier_orders`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `date` | `date` | YES | CURRENT_DATE |
| `supplier_id` | `text` | YES | - |
| `currency` | `text` | NO | - |
| `status` | `text` | NO | - |
| `total_amount_foreign` | `numeric` | YES | 0 |
| `received_item_count` | `integer` | YES | 0 |
| `total_item_count` | `integer` | YES | 0 |
| `updated_at` | `timestamp with time zone` | YES | now() |
| `buyer_id` | `text` | YES | - |
| `supplier_name` | `text` | YES | - |
| `total_amount_kzt_est` | `numeric` | YES | 0 |
| `paid_amount_foreign` | `numeric` | YES | 0 |
| `total_paid_kzt` | `numeric` | YES | 0 |

---
### 📄 Table: `receptions`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `order_id` | `text` | YES | - |
| `warehouse_name` | `text` | YES | 'Главный склад'::text |
| `date` | `date` | YES | CURRENT_DATE |
| `exchange_rate` | `numeric` | NO | - |
| `status` | `text` | NO | - |
| `close_order` | `boolean` | YES | false |
| `updated_at` | `timestamp with time zone` | YES | now() |

---
### 📄 Table: `reception_expenses`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | gen_random_uuid() |
| `reception_id` | `text` | YES | - |
| `type` | `text` | NO | - |
| `amount` | `numeric` | NO | - |
| `currency` | `text` | YES | 'KZT'::text |
| `exchange_rate_to_kzt` | `numeric` | YES | 1 |
| `allocation_method` | `text` | NO | - |
| `target_item_id` | `uuid` | YES | - |

---
### 📄 Table: `sales_orders`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `date` | `date` | YES | CURRENT_DATE |
| `client_id` | `text` | YES | - |
| `status` | `text` | NO | - |
| `total_amount` | `numeric` | YES | 0 |
| `shipped_item_count` | `integer` | YES | 0 |
| `total_item_count` | `integer` | YES | 0 |
| `updated_at` | `timestamp with time zone` | YES | now() |
| `client_name` | `text` | YES | - |
| `paid_amount` | `numeric` | YES | 0 |

---
### 📄 Table: `products`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `sku` | `text` | NO | - |
| `name` | `text` | NO | - |
| `type` | `text` | NO | - |
| `category_id` | `text` | YES | - |
| `supplier_id` | `text` | YES | - |
| `base_price` | `numeric` | YES | 0 |
| `currency` | `text` | YES | 'CNY'::text |
| `markup_percentage` | `numeric` | YES | 0 |
| `sales_price` | `numeric` | YES | 0 |
| `min_stock` | `integer` | YES | 0 |
| `description` | `text` | YES | - |
| `pricing_profile_id` | `uuid` | YES | - |
| `machine_config` | `jsonb` | YES | '[]'::jsonb |
| `internal_composition` | `jsonb` | YES | '[]'::jsonb |
| `updated_at` | `timestamp with time zone` | YES | now() |
| `stock` | `numeric` | YES | 0 |
| `reserved` | `numeric` | YES | 0 |
| `incoming` | `numeric` | YES | 0 |
| `working_length_mm` | `numeric` | YES | - |
| `working_width_mm` | `numeric` | YES | - |
| `working_height_mm` | `numeric` | YES | - |
| `working_volume_m3` | `numeric` | YES | 0 |
| `working_weight_kg` | `numeric` | YES | 0 |
| `compatible_machine_category_ids` | `ARRAY` | YES | '{}'::text[] |
| `manufacturer` | `text` | YES | - |
| `supplier_product_name` | `text` | YES | - |
| `hs_code_id` | `text` | YES | - |
| `pricing_method` | `text` | YES | 'Наценка (без НДС)'::text |
| `packages` | `jsonb` | YES | '[]'::jsonb |

---
### 📄 Table: `bundles`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `name` | `text` | NO | - |
| `base_product_id` | `text` | YES | - |
| `selected_variant_ids` | `ARRAY` | YES | '{}'::text[] |
| `total_purchase_price` | `numeric` | YES | 0 |
| `total_price` | `numeric` | YES | 0 |
| `is_template` | `boolean` | YES | true |
| `description` | `text` | YES | - |
| `updated_at` | `timestamp with time zone` | YES | now() |
| `base_product_name` | `text` | YES | - |

---
### 📄 Table: `stock_movements`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `date` | `timestamp with time zone` | YES | now() |
| `product_id` | `text` | NO | - |
| `sku` | `text` | YES | - |
| `product_name` | `text` | YES | - |
| `type` | `text` | NO | - |
| `quantity` | `numeric` | NO | - |
| `unit_cost_kzt` | `numeric` | YES | 0 |
| `total_cost_kzt` | `numeric` | YES | 0 |
| `status_type` | `text` | NO | - |
| `document_type` | `text` | NO | - |
| `document_id` | `text` | NO | - |
| `description` | `text` | YES | - |
| `configuration` | `ARRAY` | YES | '{}'::text[] |
| `total_sales_price_kzt` | `numeric` | YES | 0 |
| `sales_price_kzt` | `numeric` | YES | 0 |

---
### 📄 Table: `discrepancies`
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NO | - |
| `date` | `date` | YES | CURRENT_DATE |
| `reception_id` | `text` | YES | - |
| `order_id` | `text` | YES | - |
| `product_id` | `text` | NO | - |
| `product_name` | `text` | YES | - |
| `sku` | `text` | YES | - |
| `missing_qty` | `integer` | NO | - |
| `reason` | `text` | YES | - |
| `resolution` | `text` | YES | - |

---
