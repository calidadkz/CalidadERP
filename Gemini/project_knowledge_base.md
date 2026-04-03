# 🧠 Master Index: Project Knowledge Base

This is the entry point for the AI Assistant to understand the ERP system. Use this index to navigate through the project's architecture, data, and business logic.

---

## 🗺️ 1. Infrastructure & Navigation
*   **Application Map:** [`app_map.md`](./app_map.md)
    *   *Purpose:* Full file tree of the project. Use this to find where specific components, hooks, or services are located.
*   **Database Schema:** [`db_schema_summary.md`](./db_schema_summary.md)
    *   *Purpose:* Documentation of all 45+ tables, columns, and relationships (Foreign Keys). Use this to understand the data model before writing queries or services.
*   **Project Summary:** [`project_summary.md`](./project_summary.md)
    *   *Purpose:* High-level overview of the project's goals and technology stack.

---

## 🔑 2. Environment & Infrastructure
*   **Supabase Project URL:** `https://umtlyxasirwpxizxcfbp.supabase.co`
*   **Supabase Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtdGx5eGFzaXJ3cHhpenhjZmJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMDY4NDcsImV4cCI6MjA4Mzg4Mjg0N30.HoAI6K-8FDI8l1u7gS-3C1f9xhC4IItkcNhFvIZt5oQ`
*   **Supabase Service Role Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtdGx5eGFzaXJ3cHhpenhjZmJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMwNjg0NywiZXhwIjoyMDgzODgyODQ3fQ.KuLH51owhnwLgTzge6cZAc4IfDB6ITxPicgH9nMGKGw`
*   *Usage:* Use these for maintenance scripts (introspection) and service-level operations.

---

## 🛠️ 3. Business Logic & Modules
Detailed descriptions of how each functional block works are located in `Gemini/Project modules description/`.

**Key Modules:**
*   **Procurement (Закупки):** [`procurement_module.md`](../Project%20modules%20description/procurement_module.md) — How orders from suppliers are created and tracked.
*   **Receiving (Приемка):** [`receiving_module.md`](../Project%20modules%20description/receiving_module.md) — Logistics, custom duties, and adding items to inventory.
*   **Inventory (Склад):** [`inventory_module.md`](../Project%20modules%20description/inventory_module.md) — Stock management, movements, and reservations.
*   **Finance (Финансы):** [`finance_calendar_module.md`](../Project%20modules%20description/finance_calendar_module.md), [`treasury_accounts_module.md`](../Project%20modules%20description/treasury_accounts_module.md).
*   **Sales (Продажи):** [`sales_orders_module.md`](../Project%20modules%20description/sales_orders_module.md) — Order processing and reservation logic.

---

## 📝 4. Prompts & Specifications (Промпты и ТЗ)
Located in `Gemini/Prompts/`.
*   *Purpose:* Detailed functional requirements and prompts for various modules. Essential for restoring or extending functionality.
*   *Distinction:* While overlapping with "Project modules description", these files serve as the technical "Source of Truth" for implementation details and AI-driven development.
*   **Example:** [`preCalculations.md`](../Prompts/preCalculations.md) — Comprehensive logic for the Pre-calculations module.

---

## 📈 5. Formulas & Calculations
*   **Source of Truth:** `Предрасчет.txt` (Root directory).
*   **Status:** ⚠️ *Do not use formulas from this file until the user provides the detailed prompt for the Pre-calculations module.*
*   **Contents:** Margin calculations (IP vs TOO), Logistics costs (China to KZ), VAT (НДС), and Bank commissions.

---

## 🎨 6. Development Standards
*   **UI/UX Standards:** [`ui_standards.md`](../Project%20modules%20description/ui_standards.md) — Guidelines for icons, colors (e.g., blue for totals), and layout consistency.
*   **System Overview:** [`system_overview.md`](../Project%20modules%20description/system_overview.md) — Global architecture and state management principles.

---

## 🔄 7. Maintenance Scripts
Located in `Gemini/scripts/`:
*   `generate_app_map.ts`: Run this to update the file structure map.
*   `introspect.ts`: Run this to refresh the database schema snapshot.
    *   *AI Note:* To run TypeScript ES Modules, use `NODE_OPTIONS='--loader ts-node/esm' node <script_path.ts>`.

---
*Note: This document is the primary context source for the AI. Always check here first when starting a new task.*
