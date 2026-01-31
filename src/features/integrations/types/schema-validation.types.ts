// =====================================================
// TIS TIS PLATFORM - Schema Validation Types
// Types for validating Soft Restaurant database schema
// =====================================================

// ======================
// EXPECTED SCHEMA DEFINITION
// Based on SoftRestaurantRepository.cs queries
// ======================

/**
 * Column definition for schema validation
 */
export interface ColumnDefinition {
  name: string;
  required: boolean;
  expectedTypes?: string[]; // SQL Server data types
  description?: string;
}

/**
 * Table definition for schema validation
 */
export interface TableDefinition {
  tableName: string;
  schemaName: string; // Usually 'dbo'
  required: boolean;
  description: string;
  columns: ColumnDefinition[];
  usedFor: ('sales' | 'menu' | 'inventory' | 'tables')[];
}

/**
 * Expected Soft Restaurant database schema
 * Based on analysis of SoftRestaurantRepository.cs queries
 */
export const SR_EXPECTED_SCHEMA: TableDefinition[] = [
  // ======================
  // SALES MODULE TABLES
  // ======================
  {
    tableName: 'Ventas',
    schemaName: 'dbo',
    required: true,
    description: 'Tabla principal de ventas/tickets',
    usedFor: ['sales'],
    columns: [
      { name: 'IdVenta', required: true, expectedTypes: ['bigint', 'int'], description: 'ID único de venta' },
      { name: 'NumeroOrden', required: true, expectedTypes: ['varchar', 'nvarchar'], description: 'Número de orden' },
      { name: 'Folio', required: true, expectedTypes: ['varchar', 'nvarchar'], description: 'Folio de venta' },
      { name: 'Estacion', required: false, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Almacen', required: false, expectedTypes: ['varchar', 'nvarchar'], description: 'CodigoTienda para multi-sucursal' },
      { name: 'FechaApertura', required: true, expectedTypes: ['datetime', 'datetime2'] },
      { name: 'FechaCierre', required: false, expectedTypes: ['datetime', 'datetime2'] },
      { name: 'NumeroMesa', required: false, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'CodigoCliente', required: false, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'CodigoEmpleado', required: false, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Observaciones', required: false, expectedTypes: ['varchar', 'nvarchar', 'text'] },
      { name: 'Subtotal', required: false, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'Impuestos', required: false, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'Descuento', required: false, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'Propina', required: false, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'Total', required: false, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'Moneda', required: false, expectedTypes: ['varchar', 'nvarchar', 'char'] },
      { name: 'Cancelada', required: false, expectedTypes: ['bit', 'int', 'tinyint'] },
      { name: 'Pagada', required: false, expectedTypes: ['bit', 'int', 'tinyint'] },
      { name: 'TipoOrden', required: false, expectedTypes: ['int', 'tinyint'] },
      { name: 'NumeroComensales', required: false, expectedTypes: ['int', 'tinyint'] },
    ],
  },
  {
    tableName: 'DetalleVentas',
    schemaName: 'dbo',
    required: true,
    description: 'Detalle de productos por venta',
    usedFor: ['sales'],
    columns: [
      { name: 'IdDetalle', required: false, expectedTypes: ['bigint', 'int'] },
      { name: 'NumeroOrden', required: true, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'CodigoProducto', required: true, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Descripcion', required: false, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Cantidad', required: true, expectedTypes: ['decimal', 'float', 'int'] },
      { name: 'PrecioUnitario', required: true, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'Importe', required: false, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'Descuento', required: false, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'Impuesto', required: false, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'Modificadores', required: false, expectedTypes: ['varchar', 'nvarchar', 'text'] },
      { name: 'Notas', required: false, expectedTypes: ['varchar', 'nvarchar', 'text'] },
      { name: 'Cancelado', required: false, expectedTypes: ['bit', 'int', 'tinyint'] },
      { name: 'HoraEnvio', required: false, expectedTypes: ['datetime', 'datetime2'] },
      { name: 'HoraServido', required: false, expectedTypes: ['datetime', 'datetime2'] },
    ],
  },
  {
    tableName: 'PagosVenta',
    schemaName: 'dbo',
    required: false, // Some SR versions may not have this
    description: 'Pagos asociados a ventas',
    usedFor: ['sales'],
    columns: [
      { name: 'NumeroOrden', required: true, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'FormaPago', required: true, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Monto', required: true, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'Referencia', required: false, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Propina', required: false, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'Moneda', required: false, expectedTypes: ['varchar', 'nvarchar', 'char'] },
      { name: 'TipoCambio', required: false, expectedTypes: ['decimal', 'float'] },
      { name: 'Ultimos4Digitos', required: false, expectedTypes: ['varchar', 'nvarchar', 'char'] },
      { name: 'MarcaTarjeta', required: false, expectedTypes: ['varchar', 'nvarchar'] },
    ],
  },
  {
    tableName: 'FormasPago',
    schemaName: 'dbo',
    required: false,
    description: 'Catálogo de formas de pago',
    usedFor: ['sales'],
    columns: [
      { name: 'Codigo', required: true, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Descripcion', required: true, expectedTypes: ['varchar', 'nvarchar'] },
    ],
  },

  // ======================
  // MENU MODULE TABLES
  // ======================
  {
    tableName: 'Productos',
    schemaName: 'dbo',
    required: true,
    description: 'Catálogo de productos/platillos',
    usedFor: ['menu', 'sales'],
    columns: [
      { name: 'Codigo', required: true, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Descripcion', required: true, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Precio', required: false, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'PrecioMayoreo', required: false, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'Costo', required: false, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'CodigoCategoria', required: false, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Activo', required: false, expectedTypes: ['bit', 'int', 'tinyint'] },
      { name: 'EsReceta', required: false, expectedTypes: ['bit', 'int', 'tinyint'] },
      { name: 'EsModificador', required: false, expectedTypes: ['bit', 'int', 'tinyint'] },
      { name: 'TiempoPreparacion', required: false, expectedTypes: ['int', 'smallint'] },
      { name: 'Calorias', required: false, expectedTypes: ['int', 'smallint'] },
      { name: 'Alergenos', required: false, expectedTypes: ['varchar', 'nvarchar', 'text'] },
      { name: 'DescripcionMenu', required: false, expectedTypes: ['varchar', 'nvarchar', 'text'] },
      { name: 'Imagen', required: false, expectedTypes: ['varchar', 'nvarchar', 'text'] },
      { name: 'CodigoBarras', required: false, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'UnidadMedida', required: false, expectedTypes: ['varchar', 'nvarchar', 'char'] },
      { name: 'TasaImpuesto', required: false, expectedTypes: ['decimal', 'float'] },
      { name: 'PrecioIncluyeImpuesto', required: false, expectedTypes: ['bit', 'int', 'tinyint'] },
      { name: 'Orden', required: false, expectedTypes: ['int', 'smallint'] },
      { name: 'Impresora', required: false, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'FechaModificacion', required: false, expectedTypes: ['datetime', 'datetime2'] },
    ],
  },
  {
    tableName: 'Categorias',
    schemaName: 'dbo',
    required: false,
    description: 'Categorías de productos',
    usedFor: ['menu'],
    columns: [
      { name: 'Codigo', required: true, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Descripcion', required: true, expectedTypes: ['varchar', 'nvarchar'] },
    ],
  },

  // ======================
  // INVENTORY MODULE TABLES
  // ======================
  {
    tableName: 'Inventario',
    schemaName: 'dbo',
    required: false, // Only required if sync_inventory is enabled
    description: 'Inventario de insumos',
    usedFor: ['inventory'],
    columns: [
      { name: 'Codigo', required: true, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Descripcion', required: true, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'UnidadMedida', required: false, expectedTypes: ['varchar', 'nvarchar', 'char'] },
      { name: 'ExistenciaActual', required: false, expectedTypes: ['decimal', 'float', 'int'] },
      { name: 'ExistenciaMinima', required: false, expectedTypes: ['decimal', 'float', 'int'] },
      { name: 'ExistenciaMaxima', required: false, expectedTypes: ['decimal', 'float', 'int'] },
      { name: 'CostoPromedio', required: false, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'UltimoCosto', required: false, expectedTypes: ['decimal', 'money', 'float'] },
      { name: 'UltimaCompra', required: false, expectedTypes: ['datetime', 'datetime2'] },
      { name: 'CodigoCategoria', required: false, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Activo', required: false, expectedTypes: ['bit', 'int', 'tinyint'] },
      { name: 'Almacen', required: false, expectedTypes: ['varchar', 'nvarchar'], description: 'CodigoTienda para multi-sucursal' },
      { name: 'CodigoProveedor', required: false, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'CodigoBarras', required: false, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'EsPerecedero', required: false, expectedTypes: ['bit', 'int', 'tinyint'] },
      { name: 'DiasVigencia', required: false, expectedTypes: ['int', 'smallint'] },
      { name: 'UltimoConteo', required: false, expectedTypes: ['datetime', 'datetime2'] },
    ],
  },
  {
    tableName: 'CategoriasInventario',
    schemaName: 'dbo',
    required: false,
    description: 'Categorías de inventario',
    usedFor: ['inventory'],
    columns: [
      { name: 'Codigo', required: true, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Descripcion', required: true, expectedTypes: ['varchar', 'nvarchar'] },
    ],
  },
  {
    tableName: 'Proveedores',
    schemaName: 'dbo',
    required: false,
    description: 'Catálogo de proveedores',
    usedFor: ['inventory'],
    columns: [
      { name: 'Codigo', required: true, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Nombre', required: true, expectedTypes: ['varchar', 'nvarchar'] },
    ],
  },

  // ======================
  // TABLES MODULE
  // ======================
  {
    tableName: 'Mesas',
    schemaName: 'dbo',
    required: false, // Only required if sync_tables is enabled
    description: 'Configuración de mesas',
    usedFor: ['tables'],
    columns: [
      { name: 'Numero', required: true, expectedTypes: ['varchar', 'nvarchar', 'int'] },
      { name: 'Nombre', required: false, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Capacidad', required: false, expectedTypes: ['int', 'smallint', 'tinyint'] },
      { name: 'Seccion', required: false, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Activo', required: false, expectedTypes: ['bit', 'int', 'tinyint'] },
      { name: 'Orden', required: false, expectedTypes: ['int', 'smallint'] },
      { name: 'PosicionX', required: false, expectedTypes: ['int', 'smallint', 'decimal'] },
      { name: 'PosicionY', required: false, expectedTypes: ['int', 'smallint', 'decimal'] },
      { name: 'Forma', required: false, expectedTypes: ['varchar', 'nvarchar'] },
    ],
  },

  // ======================
  // REFERENCE TABLES
  // ======================
  {
    tableName: 'Clientes',
    schemaName: 'dbo',
    required: false,
    description: 'Catálogo de clientes',
    usedFor: ['sales'],
    columns: [
      { name: 'Codigo', required: true, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Nombre', required: true, expectedTypes: ['varchar', 'nvarchar'] },
    ],
  },
  {
    tableName: 'Empleados',
    schemaName: 'dbo',
    required: false,
    description: 'Catálogo de empleados/meseros',
    usedFor: ['sales'],
    columns: [
      { name: 'Codigo', required: true, expectedTypes: ['varchar', 'nvarchar'] },
      { name: 'Nombre', required: true, expectedTypes: ['varchar', 'nvarchar'] },
    ],
  },
];

// ======================
// VALIDATION RESULT TYPES
// ======================

/**
 * Result of validating a single column
 */
export interface ColumnValidationResult {
  columnName: string;
  exists: boolean;
  required: boolean;
  expectedTypes?: string[];
  actualType?: string;
  isTypeMatch: boolean;
}

/**
 * Result of validating a single table
 */
export interface TableValidationResult {
  tableName: string;
  schemaName: string;
  exists: boolean;
  required: boolean;
  usedFor: string[];
  columns: ColumnValidationResult[];
  missingRequiredColumns: string[];
  presentOptionalColumns: string[];
}

/**
 * Overall schema validation result
 */
export interface SchemaValidationResult {
  success: boolean;
  validatedAt: string;
  databaseName: string;
  sqlServerVersion?: string;
  srVersionDetected?: string;

  // Summary
  totalTablesExpected: number;
  tablesFound: number;
  tablesMissing: number;
  requiredTablesMissing: string[];

  // Feature availability based on schema
  canSyncSales: boolean;
  canSyncMenu: boolean;
  canSyncInventory: boolean;
  canSyncTables: boolean;

  // Detailed results
  tables: TableValidationResult[];

  // Errors and warnings
  errors: string[];
  warnings: string[];
}

/**
 * Request to validate schema from agent
 */
export interface ValidateSchemaRequest {
  agent_id: string;
  database_name: string;
  sql_server_version?: string;
  tables: Array<{
    table_name: string;
    schema_name: string;
    columns: Array<{
      column_name: string;
      data_type: string;
      is_nullable: boolean;
    }>;
  }>;
}

/**
 * Response from validate-schema endpoint
 */
export interface ValidateSchemaResponse {
  success: boolean;
  validation: SchemaValidationResult;
  recommendations?: string[];
}

// ======================
// SR VERSION DETECTION
// ======================

/**
 * Known Soft Restaurant versions and their schema characteristics
 */
export interface SRVersionInfo {
  version: string;
  minVersion: string;
  maxVersion: string;
  schemaFeatures: {
    hasMonedaColumn: boolean;
    hasTipoOrdenColumn: boolean;
    hasNumeroComensalesColumn: boolean;
    hasDetalleVentasTable: boolean;
    hasPagosVentaTable: boolean;
    hasInventarioTable: boolean;
  };
  isSupported: boolean;
  notes?: string;
}

/**
 * Known SR versions and their characteristics
 * Based on actual Soft Restaurant versions: 12, 11, 10
 */
export const SR_KNOWN_VERSIONS: SRVersionInfo[] = [
  {
    version: 'SR 12.x',
    minVersion: '12.0.0',
    maxVersion: '12.99.99',
    schemaFeatures: {
      hasMonedaColumn: true,
      hasTipoOrdenColumn: true,
      hasNumeroComensalesColumn: true,
      hasDetalleVentasTable: true,
      hasPagosVentaTable: true,
      hasInventarioTable: true,
    },
    isSupported: true,
    notes: 'Versión más reciente - soporte completo',
  },
  {
    version: 'SR 11.x',
    minVersion: '11.0.0',
    maxVersion: '11.99.99',
    schemaFeatures: {
      hasMonedaColumn: true,
      hasTipoOrdenColumn: true,
      hasNumeroComensalesColumn: true,
      hasDetalleVentasTable: true,
      hasPagosVentaTable: true,
      hasInventarioTable: true,
    },
    isSupported: true,
    notes: 'Versión estable muy utilizada',
  },
  {
    version: 'SR 10.x',
    minVersion: '10.0.0',
    maxVersion: '10.99.99',
    schemaFeatures: {
      hasMonedaColumn: true,
      hasTipoOrdenColumn: true,
      hasNumeroComensalesColumn: true,
      hasDetalleVentasTable: true,
      hasPagosVentaTable: true,
      hasInventarioTable: true,
    },
    isSupported: true,
    notes: 'Versión anterior soportada',
  },
  {
    version: 'SR Legacy',
    minVersion: '1.0.0',
    maxVersion: '9.99.99',
    schemaFeatures: {
      hasMonedaColumn: false,
      hasTipoOrdenColumn: false,
      hasNumeroComensalesColumn: false,
      hasDetalleVentasTable: true,
      hasPagosVentaTable: false,
      hasInventarioTable: true,
    },
    isSupported: false,
    notes: 'Versión legacy (SR 9.x o anterior) - funcionalidad limitada',
  },
];

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Get tables required for a specific sync type
 */
export function getRequiredTablesForSync(
  syncType: 'sales' | 'menu' | 'inventory' | 'tables'
): TableDefinition[] {
  return SR_EXPECTED_SCHEMA.filter(
    (table) => table.usedFor.includes(syncType) && table.required
  );
}

/**
 * Get all tables used for a specific sync type (including optional)
 */
export function getTablesForSync(
  syncType: 'sales' | 'menu' | 'inventory' | 'tables'
): TableDefinition[] {
  return SR_EXPECTED_SCHEMA.filter((table) => table.usedFor.includes(syncType));
}

/**
 * Check if a data type matches expected types (case-insensitive)
 */
export function isTypeMatch(actualType: string, expectedTypes: string[]): boolean {
  const normalizedActual = actualType.toLowerCase().replace(/\(.*\)/, '').trim();
  return expectedTypes.some(
    (expected) => normalizedActual.includes(expected.toLowerCase())
  );
}
