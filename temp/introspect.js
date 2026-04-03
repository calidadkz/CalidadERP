"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var supabase_js_1 = require("@supabase/supabase-js");
var promises_1 = require("fs/promises");
var path_1 = require("path");
var supabaseUrl = process.env.VITE_SUPABASE_URL;
var supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Environment variables VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.');
    process.exit(1);
}
var supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
function introspectDatabase() {
    return __awaiter(this, void 0, void 0, function () {
        var schemaData, _a, tables, tablesError, typedTables, _i, typedTables_1, table, tableName, _b, columns, columnsError, _c, fks, fksError, jsonOutputPath, mdOutputPath, mdContent, _loop_1, _d, _e, table, error_1;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    console.log('🚀 Starting database introspection...');
                    schemaData = {
                        tables: [],
                        foreignKeys: [],
                    };
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 11, , 12]);
                    return [4 /*yield*/, supabase.rpc('get_schema_tables')];
                case 2:
                    _a = _f.sent(), tables = _a.data, tablesError = _a.error;
                    if (tablesError)
                        throw new Error("Failed to get tables: ".concat(tablesError.message));
                    typedTables = tables;
                    console.log("\uD83D\uDCCA Found ".concat(typedTables.length, " tables. Fetching details..."));
                    _i = 0, typedTables_1 = typedTables;
                    _f.label = 3;
                case 3:
                    if (!(_i < typedTables_1.length)) return [3 /*break*/, 6];
                    table = typedTables_1[_i];
                    tableName = table.table_name;
                    return [4 /*yield*/, supabase.rpc('get_table_columns', { p_table_name: tableName })];
                case 4:
                    _b = _f.sent(), columns = _b.data, columnsError = _b.error;
                    if (columnsError) {
                        console.error("\u26A0\uFE0F Error fetching columns for ".concat(tableName, ":"), columnsError.message);
                        return [3 /*break*/, 5];
                    }
                    schemaData.tables.push({
                        name: tableName,
                        columns: columns,
                    });
                    _f.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6: return [4 /*yield*/, supabase.rpc('get_foreign_keys')];
                case 7:
                    _c = _f.sent(), fks = _c.data, fksError = _c.error;
                    if (fksError) {
                        console.error('⚠️ Error fetching foreign keys:', fksError.message);
                    }
                    else {
                        schemaData.foreignKeys = fks;
                    }
                    jsonOutputPath = path_1.default.join('Gemini', 'Project summaries', 'db_schema.json');
                    mdOutputPath = path_1.default.join('Gemini', 'Project summaries', 'db_schema_summary.md');
                    // 4. Save JSON result
                    return [4 /*yield*/, promises_1.default.mkdir(path_1.default.dirname(jsonOutputPath), { recursive: true })];
                case 8:
                    // 4. Save JSON result
                    _f.sent();
                    return [4 /*yield*/, promises_1.default.writeFile(jsonOutputPath, JSON.stringify(schemaData, null, 2))];
                case 9:
                    _f.sent();
                    console.log("\u2705 Schema JSON saved to ".concat(jsonOutputPath));
                    mdContent = "# \uD83D\uDDC4\uFE0F Database Schema Summary\n\n";
                    mdContent += "Generated on: ".concat(new Date().toUTCString(), "\n\n");
                    _loop_1 = function (table) {
                        mdContent += "### \uD83D\uDCC4 Table: `".concat(table.name, "`\n");
                        mdContent += "| Column | Type | Nullable | Default |\n";
                        mdContent += "| :--- | :--- | :--- | :--- |\n";
                        for (var _g = 0, _h = table.columns; _g < _h.length; _g++) {
                            var col = _h[_g];
                            mdContent += "| `".concat(col.column_name, "` | `").concat(col.data_type, "` | ").concat(col.is_nullable, " | ").concat(col.column_default || '-', " |\n");
                        }
                        var tableFks = schemaData.foreignKeys.filter(function (fk) { return fk.table_name === table.name; });
                        if (tableFks.length > 0) {
                            mdContent += "\n**\uD83D\uDD17 Foreign Keys:**\n";
                            for (var _j = 0, tableFks_1 = tableFks; _j < tableFks_1.length; _j++) {
                                var fk = tableFks_1[_j];
                                mdContent += "- `".concat(fk.column_name, "` \u2192 `").concat(fk.foreign_table_name, ".").concat(fk.foreign_column_name, "`\n");
                            }
                        }
                        mdContent += "\n---\n";
                    };
                    for (_d = 0, _e = schemaData.tables; _d < _e.length; _d++) {
                        table = _e[_d];
                        _loop_1(table);
                    }
                    return [4 /*yield*/, promises_1.default.writeFile(mdOutputPath, mdContent)];
                case 10:
                    _f.sent();
                    console.log("\u2705 Schema Markdown summary saved to ".concat(mdOutputPath));
                    return [3 /*break*/, 12];
                case 11:
                    error_1 = _f.sent();
                    console.error('❌ Introspection failed:', error_1);
                    return [3 /*break*/, 12];
                case 12: return [2 /*return*/];
            }
        });
    });
}
introspectDatabase();
