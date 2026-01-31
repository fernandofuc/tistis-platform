// =====================================================
// TIS TIS PLATFORM - Schema Validator Service
// Validates Soft Restaurant database schema compatibility
// =====================================================

import type {
  TableDefinition,
  ColumnDefinition,
  SchemaValidationResult,
  TableValidationResult,
  ColumnValidationResult,
  ValidateSchemaRequest,
  ValidateSchemaResponse,
} from '../types/schema-validation.types';

import {
  SR_EXPECTED_SCHEMA,
  SR_KNOWN_VERSIONS,
  isTypeMatch,
  getTablesForSync,
} from '../types/schema-validation.types';

// ======================
// SERVICE CLASS
// ======================

class SchemaValidatorService {
  /**
   * Validates the schema sent by the agent against expected SR schema.
   * Returns detailed validation results including feature availability.
   */
  validateSchema(request: ValidateSchemaRequest): ValidateSchemaResponse {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Create lookup map for received tables
    const receivedTablesMap = new Map<string, typeof request.tables[0]>();
    for (const table of request.tables) {
      const key = `${table.schema_name.toLowerCase()}.${table.table_name.toLowerCase()}`;
      receivedTablesMap.set(key, table);
    }

    // Validate each expected table
    const tableResults: TableValidationResult[] = [];
    let tablesFound = 0;
    let tablesMissing = 0;
    const requiredTablesMissing: string[] = [];

    for (const expectedTable of SR_EXPECTED_SCHEMA) {
      const tableKey = `${expectedTable.schemaName.toLowerCase()}.${expectedTable.tableName.toLowerCase()}`;
      const receivedTable = receivedTablesMap.get(tableKey);

      const tableResult = this.validateTable(expectedTable, receivedTable);
      tableResults.push(tableResult);

      if (tableResult.exists) {
        tablesFound++;
      } else {
        tablesMissing++;
        if (expectedTable.required) {
          requiredTablesMissing.push(expectedTable.tableName);
          errors.push(`Tabla requerida no encontrada: ${expectedTable.schemaName}.${expectedTable.tableName}`);
        } else {
          warnings.push(`Tabla opcional no encontrada: ${expectedTable.schemaName}.${expectedTable.tableName}`);
        }
      }

      // Check for missing required columns in existing tables
      if (tableResult.exists && tableResult.missingRequiredColumns.length > 0) {
        errors.push(
          `Tabla ${expectedTable.tableName}: columnas requeridas faltantes - ${tableResult.missingRequiredColumns.join(', ')}`
        );
      }
    }

    // Determine feature availability
    const canSyncSales = this.canSyncFeature('sales', tableResults);
    const canSyncMenu = this.canSyncFeature('menu', tableResults);
    const canSyncInventory = this.canSyncFeature('inventory', tableResults);
    const canSyncTables = this.canSyncFeature('tables', tableResults);

    // Detect SR version based on schema characteristics
    const srVersionDetected = this.detectSRVersion(tableResults);

    // Generate recommendations
    if (!canSyncSales) {
      recommendations.push('Para sincronizar ventas, asegúrese de que las tablas Ventas, DetalleVentas y Productos existan.');
    }
    if (!canSyncInventory) {
      recommendations.push('Para sincronizar inventario, asegúrese de que la tabla Inventario exista.');
    }
    if (!canSyncTables) {
      recommendations.push('Para sincronizar mesas, asegúrese de que la tabla Mesas exista.');
    }
    if (requiredTablesMissing.length > 0) {
      recommendations.push(
        `Considere verificar que está conectado a la base de datos correcta de Soft Restaurant.`
      );
    }

    // Check for unknown/extra tables that might indicate wrong database
    const knownTableNames = new Set(
      SR_EXPECTED_SCHEMA.map((t) => t.tableName.toLowerCase())
    );
    const hasAnyKnownTable = Array.from(receivedTablesMap.values()).some(
      (t) => knownTableNames.has(t.table_name.toLowerCase())
    );

    if (!hasAnyKnownTable && request.tables.length > 0) {
      warnings.push(
        'No se encontró ninguna tabla conocida de Soft Restaurant. Verifique que está conectado a la base de datos correcta.'
      );
    }

    const success = requiredTablesMissing.length === 0 && (canSyncSales || canSyncMenu);

    const validation: SchemaValidationResult = {
      success,
      validatedAt: new Date().toISOString(),
      databaseName: request.database_name,
      sqlServerVersion: request.sql_server_version,
      srVersionDetected,
      totalTablesExpected: SR_EXPECTED_SCHEMA.length,
      tablesFound,
      tablesMissing,
      requiredTablesMissing,
      canSyncSales,
      canSyncMenu,
      canSyncInventory,
      canSyncTables,
      tables: tableResults,
      errors,
      warnings,
    };

    return {
      success,
      validation,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    };
  }

  /**
   * Validates a single table against expected definition
   */
  private validateTable(
    expected: TableDefinition,
    received: ValidateSchemaRequest['tables'][0] | undefined
  ): TableValidationResult {
    if (!received) {
      return {
        tableName: expected.tableName,
        schemaName: expected.schemaName,
        exists: false,
        required: expected.required,
        usedFor: expected.usedFor,
        columns: expected.columns.map((col) => ({
          columnName: col.name,
          exists: false,
          required: col.required,
          expectedTypes: col.expectedTypes,
          isTypeMatch: false,
        })),
        missingRequiredColumns: expected.columns
          .filter((c) => c.required)
          .map((c) => c.name),
        presentOptionalColumns: [],
      };
    }

    // Create lookup for received columns
    const receivedColumnsMap = new Map<string, typeof received.columns[0]>();
    for (const col of received.columns) {
      receivedColumnsMap.set(col.column_name.toLowerCase(), col);
    }

    // Validate each expected column
    const columnResults: ColumnValidationResult[] = [];
    const missingRequiredColumns: string[] = [];
    const presentOptionalColumns: string[] = [];

    for (const expectedCol of expected.columns) {
      const receivedCol = receivedColumnsMap.get(expectedCol.name.toLowerCase());
      const columnResult = this.validateColumn(expectedCol, receivedCol);
      columnResults.push(columnResult);

      if (!columnResult.exists && expectedCol.required) {
        missingRequiredColumns.push(expectedCol.name);
      }
      if (columnResult.exists && !expectedCol.required) {
        presentOptionalColumns.push(expectedCol.name);
      }
    }

    return {
      tableName: expected.tableName,
      schemaName: expected.schemaName,
      exists: true,
      required: expected.required,
      usedFor: expected.usedFor,
      columns: columnResults,
      missingRequiredColumns,
      presentOptionalColumns,
    };
  }

  /**
   * Validates a single column against expected definition
   */
  private validateColumn(
    expected: ColumnDefinition,
    received: { column_name: string; data_type: string; is_nullable: boolean } | undefined
  ): ColumnValidationResult {
    if (!received) {
      return {
        columnName: expected.name,
        exists: false,
        required: expected.required,
        expectedTypes: expected.expectedTypes,
        isTypeMatch: false,
      };
    }

    const typeMatches = expected.expectedTypes
      ? isTypeMatch(received.data_type, expected.expectedTypes)
      : true;

    return {
      columnName: expected.name,
      exists: true,
      required: expected.required,
      expectedTypes: expected.expectedTypes,
      actualType: received.data_type,
      isTypeMatch: typeMatches,
    };
  }

  /**
   * Determines if a sync feature can be enabled based on validated tables
   */
  private canSyncFeature(
    syncType: 'sales' | 'menu' | 'inventory' | 'tables',
    tableResults: TableValidationResult[]
  ): boolean {
    const requiredTables = getTablesForSync(syncType).filter((t) => t.required);

    // Check that all required tables exist with their required columns
    for (const requiredTable of requiredTables) {
      const validationResult = tableResults.find(
        (r) => r.tableName.toLowerCase() === requiredTable.tableName.toLowerCase()
      );

      if (!validationResult || !validationResult.exists) {
        return false;
      }

      if (validationResult.missingRequiredColumns.length > 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Attempts to detect the Soft Restaurant version based on schema characteristics
   */
  private detectSRVersion(tableResults: TableValidationResult[]): string | undefined {
    // Check for specific columns that indicate version
    const ventasTable = tableResults.find((t) => t.tableName === 'Ventas');

    if (!ventasTable || !ventasTable.exists) {
      return undefined;
    }

    const hasMoneda = ventasTable.columns.some(
      (c) => c.columnName.toLowerCase() === 'moneda' && c.exists
    );
    const hasTipoOrden = ventasTable.columns.some(
      (c) => c.columnName.toLowerCase() === 'tipoorden' && c.exists
    );
    const hasNumeroComensales = ventasTable.columns.some(
      (c) => c.columnName.toLowerCase() === 'numerocomensales' && c.exists
    );

    // Check for PagosVenta table
    const hasPagosVenta = tableResults.some(
      (t) => t.tableName === 'PagosVenta' && t.exists
    );

    // Match against known versions
    for (const versionInfo of SR_KNOWN_VERSIONS) {
      const features = versionInfo.schemaFeatures;

      // Simple heuristic: count matching features
      let matches = 0;
      let total = 0;

      if (features.hasMonedaColumn === hasMoneda) matches++;
      total++;

      if (features.hasTipoOrdenColumn === hasTipoOrden) matches++;
      total++;

      if (features.hasNumeroComensalesColumn === hasNumeroComensales) matches++;
      total++;

      if (features.hasPagosVentaTable === hasPagosVenta) matches++;
      total++;

      // If 75%+ match, return this version
      if (matches / total >= 0.75) {
        return versionInfo.version;
      }
    }

    return 'Versión desconocida';
  }

  /**
   * Generates a summary for display in the UI
   */
  generateSummary(validation: SchemaValidationResult): {
    status: 'success' | 'warning' | 'error';
    title: string;
    description: string;
    features: { name: string; enabled: boolean; reason?: string }[];
  } {
    let status: 'success' | 'warning' | 'error';
    let title: string;
    let description: string;

    if (validation.success && validation.errors.length === 0) {
      status = 'success';
      title = 'Schema validado correctamente';
      description = `Se encontraron ${validation.tablesFound} de ${validation.totalTablesExpected} tablas esperadas.`;
    } else if (validation.requiredTablesMissing.length > 0) {
      status = 'error';
      title = 'Tablas requeridas no encontradas';
      description = `Faltan las tablas: ${validation.requiredTablesMissing.join(', ')}. Verifique la conexión a la base de datos.`;
    } else {
      status = 'warning';
      title = 'Schema parcialmente compatible';
      description = 'Algunas funcionalidades pueden estar limitadas.';
    }

    const features = [
      {
        name: 'Sincronización de Ventas',
        enabled: validation.canSyncSales,
        reason: !validation.canSyncSales
          ? 'Requiere tablas Ventas, DetalleVentas y Productos'
          : undefined,
      },
      {
        name: 'Sincronización de Menú',
        enabled: validation.canSyncMenu,
        reason: !validation.canSyncMenu
          ? 'Requiere tabla Productos'
          : undefined,
      },
      {
        name: 'Sincronización de Inventario',
        enabled: validation.canSyncInventory,
        reason: !validation.canSyncInventory
          ? 'Requiere tabla Inventario'
          : undefined,
      },
      {
        name: 'Sincronización de Mesas',
        enabled: validation.canSyncTables,
        reason: !validation.canSyncTables
          ? 'Requiere tabla Mesas'
          : undefined,
      },
    ];

    return { status, title, description, features };
  }
}

// ======================
// SINGLETON EXPORT
// ======================

let instance: SchemaValidatorService | null = null;

export function getSchemaValidatorService(): SchemaValidatorService {
  if (!instance) {
    instance = new SchemaValidatorService();
  }
  return instance;
}

export { SchemaValidatorService };
export type { SchemaValidatorService as SchemaValidatorServiceType };
