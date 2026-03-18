import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Environment variables VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Column {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface Table {
  table_name: string;
}

interface ForeignKey {
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

interface SchemaData {
  tables: Array<{
    name: string;
    columns: Column[];
  }>;
  foreignKeys: ForeignKey[];
}

async function introspectDatabase() {
  console.log('🚀 Starting database introspection...');

  const schemaData: SchemaData = {
    tables: [],
    foreignKeys: [],
  };

  try {
    // 1. Get all tables via RPC
    const { data: tables, error: tablesError } = await supabase.rpc('get_schema_tables');

    if (tablesError) throw new Error(`Failed to get tables: ${tablesError.message}`);
    const typedTables = tables as Table[];
    
    console.log(`📊 Found ${typedTables.length} tables. Fetching details...`);

    for (const table of typedTables) {
      const tableName = table.table_name;

      // 2. Get columns for each table via RPC
      const { data: columns, error: columnsError } = await supabase.rpc('get_table_columns', { p_table_name: tableName });
      
      if (columnsError) {
          console.error(`⚠️ Error fetching columns for ${tableName}:`, columnsError.message);
          continue;
      }

      schemaData.tables.push({
        name: tableName,
        columns: columns as Column[],
      });
    }

    // 3. Get all foreign keys via RPC
    const { data: fks, error: fksError } = await supabase.rpc('get_foreign_keys');

    if (fksError) {
        console.error('⚠️ Error fetching foreign keys:', fksError.message);
    } else {
        schemaData.foreignKeys = fks as ForeignKey[];
    }

    // Paths
    const jsonOutputPath = path.join('Gemini', 'Project summaries', 'db_schema.json');
    const mdOutputPath = path.join('Gemini', 'Project summaries', 'db_schema_summary.md');

    // 4. Save JSON result
    await fs.mkdir(path.dirname(jsonOutputPath), { recursive: true });
    await fs.writeFile(jsonOutputPath, JSON.stringify(schemaData, null, 2));
    console.log(`✅ Schema JSON saved to ${jsonOutputPath}`);

    // 5. Generate and save Markdown Summary
    let mdContent = `# 🗄️ Database Schema Summary\n\n`;
    mdContent += `Generated on: ${new Date().toUTCString()}\n\n`;

    for (const table of schemaData.tables) {
      mdContent += `### 📄 Table: \`${table.name}\`\n`;
      mdContent += `| Column | Type | Nullable | Default |\n`;
      mdContent += `| :--- | :--- | :--- | :--- |\n`;
      for (const col of table.columns) {
        mdContent += `| \`${col.column_name}\` | \`${col.data_type}\` | ${col.is_nullable} | ${col.column_default || '-'} |\n`;
      }
      
      const tableFks = schemaData.foreignKeys.filter(fk => fk.table_name === table.name);
      if (tableFks.length > 0) {
        mdContent += `\n**🔗 Foreign Keys:**\n`;
        for (const fk of tableFks) {
          mdContent += `- \`${fk.column_name}\` → \`${fk.foreign_table_name}.${fk.foreign_column_name}\`\n`;
        }
      }
      mdContent += `\n---\n`;
    }

    await fs.writeFile(mdOutputPath, mdContent);
    console.log(`✅ Schema Markdown summary saved to ${mdOutputPath}`);

  } catch (error) {
    console.error('❌ Introspection failed:', error);
  }
}

introspectDatabase();