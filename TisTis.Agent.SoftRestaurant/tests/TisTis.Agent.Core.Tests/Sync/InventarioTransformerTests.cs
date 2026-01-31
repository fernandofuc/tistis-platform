// =====================================================
// TIS TIS PLATFORM - InventarioTransformer Unit Tests
// Comprehensive tests for inventory data transformation
// =====================================================

using FluentAssertions;
using TisTis.Agent.Core.Database.Models;
using TisTis.Agent.Core.Sync.Transformers;
using Xunit;

namespace TisTis.Agent.Core.Tests.Sync;

/// <summary>
/// Unit tests for InventarioTransformer class.
/// Tests transformation of Soft Restaurant inventory to TIS TIS format.
/// </summary>
public class InventarioTransformerTests
{
    private readonly InventarioTransformer _transformer;

    public InventarioTransformerTests()
    {
        _transformer = new InventarioTransformer();
    }

    #region Transform Basic Tests

    [Fact]
    public void Transform_ValidInventory_TransformsCorrectly()
    {
        // Arrange
        var source = CreateValidSRInventario();

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Should().NotBeNull();
        result.ExternalId.Should().Be("sr-inv-INV-001");
        result.Name.Should().Be("Tomate");
        result.CurrentStock.Should().Be(50.5m);
        result.AverageCost.Should().Be(15.00m);
    }

    [Fact]
    public void Transform_SetsExternalIdWithPrefix()
    {
        // Arrange
        var source = new SRInventario { Codigo = "TEST-INV-123" };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.ExternalId.Should().Be("sr-inv-TEST-INV-123");
    }

    [Fact]
    public void Transform_PreservesStockLevels()
    {
        // Arrange
        var source = new SRInventario
        {
            Codigo = "INV",
            ExistenciaActual = 100.50m,
            ExistenciaMinima = 10.00m,
            ExistenciaMaxima = 200.00m
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.CurrentStock.Should().Be(100.50m);
        result.MinStock.Should().Be(10.00m);
        result.MaxStock.Should().Be(200.00m);
    }

    [Fact]
    public void Transform_PreservesCosts()
    {
        // Arrange
        var source = new SRInventario
        {
            Codigo = "INV",
            CostoPromedio = 25.50m,
            UltimoCosto = 28.00m
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.AverageCost.Should().Be(25.50m);
        result.LastCost.Should().Be(28.00m);
    }

    [Fact]
    public void Transform_PreservesSupplierInfo()
    {
        // Arrange
        var source = new SRInventario
        {
            Codigo = "INV",
            CodigoProveedor = "PROV-001",
            NombreProveedor = "Proveedor ABC"
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.SupplierId.Should().Be("PROV-001");
        result.SupplierName.Should().Be("Proveedor ABC");
    }

    [Fact]
    public void Transform_IncludesMetadata()
    {
        // Arrange
        var lastCount = new DateTime(2026, 1, 15, 10, 30, 0, DateTimeKind.Utc);
        var source = new SRInventario
        {
            Codigo = "META-INV",
            Temperatura = "Refrigerado",
            UltimoConteo = lastCount
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Metadata.Should().ContainKey("source").WhoseValue.Should().Be("soft_restaurant");
        result.Metadata.Should().ContainKey("sr_codigo").WhoseValue.Should().Be("META-INV");
        result.Metadata.Should().ContainKey("temperature_requirements").WhoseValue.Should().Be("Refrigerado");
        result.Metadata["last_count_date"].Should().NotBe("");
    }

    [Fact]
    public void Transform_NullTemperature_SetsEmptyString()
    {
        // Arrange
        var source = new SRInventario
        {
            Codigo = "INV",
            Temperatura = null
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Metadata["temperature_requirements"].Should().Be("");
    }

    [Fact]
    public void Transform_ComputedProperties_SetCorrectly()
    {
        // Arrange - Stock bajo scenario
        var source = new SRInventario
        {
            Codigo = "INV",
            ExistenciaActual = 5.0m,
            ExistenciaMinima = 10.0m,
            CostoPromedio = 25.00m
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.IsLowStock.Should().BeTrue(); // 5 <= 10
        result.StockValue.Should().Be(125.00m); // 5 * 25
    }

    #endregion

    #region Unit Mapping Tests

    [Theory]
    [InlineData("PZA", "unit")]
    [InlineData("KG", "kg")]
    [InlineData("GR", "g")]
    [InlineData("LT", "l")]
    [InlineData("ML", "ml")]
    [InlineData("OZ", "oz")]
    [InlineData("LB", "lb")]
    [InlineData("CAJA", "box")]
    [InlineData("CAJAS", "box")]
    [InlineData("BOLSA", "bag")]
    [InlineData("BOLSAS", "bag")]
    [InlineData("BOTELLA", "bottle")]
    [InlineData("BOTELLAS", "bottle")]
    [InlineData("LATA", "can")]
    [InlineData("LATAS", "can")]
    public void Transform_UnitMapping_MapsCorrectly(string input, string expected)
    {
        // Arrange
        var source = new SRInventario { Codigo = "INV", UnidadMedida = input };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Unit.Should().Be(expected);
    }

    [Theory]
    [InlineData(null, "unit")]
    [InlineData("", "unit")]
    [InlineData("   ", "unit")]
    public void Transform_NullOrEmptyUnit_ReturnsUnit(string? input, string expected)
    {
        // Arrange
        var source = new SRInventario { Codigo = "INV", UnidadMedida = input! };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Unit.Should().Be(expected);
    }

    [Fact]
    public void Transform_UnknownUnit_ReturnsLowercasedOriginal()
    {
        // Arrange
        var source = new SRInventario { Codigo = "INV", UnidadMedida = "GALON" };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Unit.Should().Be("galon");
    }

    #endregion

    #region TransformMany Tests

    [Fact]
    public void TransformMany_MultipleItems_TransformsAll()
    {
        // Arrange
        var sources = new List<SRInventario>
        {
            new() { Codigo = "INV-001", Descripcion = "Item 1" },
            new() { Codigo = "INV-002", Descripcion = "Item 2" },
            new() { Codigo = "INV-003", Descripcion = "Item 3" }
        };

        // Act
        var results = _transformer.TransformMany(sources).ToList();

        // Assert
        results.Should().HaveCount(3);
        results[0].ExternalId.Should().Be("sr-inv-INV-001");
        results[1].ExternalId.Should().Be("sr-inv-INV-002");
        results[2].ExternalId.Should().Be("sr-inv-INV-003");
    }

    [Fact]
    public void TransformMany_EmptyCollection_ReturnsEmpty()
    {
        // Arrange
        var sources = new List<SRInventario>();

        // Act
        var results = _transformer.TransformMany(sources);

        // Assert
        results.Should().BeEmpty();
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void Transform_DefaultValues_HandlesGracefully()
    {
        // Arrange
        var source = new SRInventario();

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Should().NotBeNull();
        result.ExternalId.Should().Be("sr-inv-");
        result.Name.Should().BeEmpty();
        result.CurrentStock.Should().Be(0m);
        result.IsActive.Should().BeTrue();
    }

    [Fact]
    public void Transform_AllOptionalFieldsNull_HandlesGracefully()
    {
        // Arrange
        var source = new SRInventario
        {
            Codigo = "INV",
            Descripcion = "Test",
            ExistenciaMaxima = null,
            UltimoCosto = null,
            UltimaCompra = null,
            Categoria = null,
            Almacen = null,
            CodigoProveedor = null,
            DiasVigencia = null
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.MaxStock.Should().BeNull();
        result.LastCost.Should().BeNull();
        result.LastPurchase.Should().BeNull();
        result.Category.Should().BeNull();
        result.LocationCode.Should().BeNull();
        result.SupplierId.Should().BeNull();
        result.ShelfLifeDays.Should().BeNull();
    }

    #endregion

    #region Helper Methods

    private static SRInventario CreateValidSRInventario()
    {
        return new SRInventario
        {
            Codigo = "INV-001",
            Descripcion = "Tomate",
            UnidadMedida = "KG",
            ExistenciaActual = 50.5m,
            ExistenciaMinima = 10.0m,
            ExistenciaMaxima = 100.0m,
            CostoPromedio = 15.00m,
            UltimoCosto = 16.50m,
            UltimaCompra = DateTime.UtcNow.AddDays(-5),
            Categoria = "Verduras",
            CodigoCategoria = "CAT-VEG",
            Activo = true,
            Almacen = "CENTRAL",
            CodigoProveedor = "PROV-001",
            NombreProveedor = "Verduras del Campo",
            EsPerecedero = true,
            DiasVigencia = 7,
            Temperatura = "Refrigerado"
        };
    }

    #endregion
}

/// <summary>
/// Unit tests for MesasTransformer class.
/// Tests transformation of Soft Restaurant tables to TIS TIS format.
/// </summary>
public class MesasTransformerTests
{
    private readonly MesasTransformer _transformer;

    public MesasTransformerTests()
    {
        _transformer = new MesasTransformer();
    }

    #region Transform Basic Tests

    [Fact]
    public void Transform_ValidTable_TransformsCorrectly()
    {
        // Arrange
        var source = CreateValidSRMesa();

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Should().NotBeNull();
        result.ExternalId.Should().Be("sr-table-10");
        result.Number.Should().Be("10");
        result.Name.Should().Be("Mesa 10");
        result.Capacity.Should().Be(4);
    }

    [Fact]
    public void Transform_SetsExternalIdWithPrefix()
    {
        // Arrange
        var source = new SRMesa { Numero = "VIP-1" };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.ExternalId.Should().Be("sr-table-VIP-1");
    }

    [Fact]
    public void Transform_PreservesPosition()
    {
        // Arrange
        var source = new SRMesa
        {
            Numero = "1",
            PosicionX = 100,
            PosicionY = 200
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.PositionX.Should().Be(100);
        result.PositionY.Should().Be(200);
    }

    [Fact]
    public void Transform_PreservesShape()
    {
        // Arrange
        var source = new SRMesa
        {
            Numero = "1",
            Forma = "REDONDA"
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Shape.Should().Be("redonda");
    }

    [Fact]
    public void Transform_NullShape_ReturnsNull()
    {
        // Arrange
        var source = new SRMesa
        {
            Numero = "1",
            Forma = null
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Shape.Should().BeNull();
    }

    #endregion

    #region Status Mapping Tests

    [Theory]
    [InlineData("libre", "available")]
    [InlineData("LIBRE", "available")]
    [InlineData("available", "available")]
    [InlineData("disponible", "available")]
    [InlineData("ocupada", "occupied")]
    [InlineData("OCUPADA", "occupied")]
    [InlineData("occupied", "occupied")]
    [InlineData("ocupado", "occupied")]
    [InlineData("reservada", "reserved")]
    [InlineData("RESERVADA", "reserved")]
    [InlineData("reserved", "reserved")]
    [InlineData("reservado", "reserved")]
    [InlineData("cuenta", "waiting_payment")]
    [InlineData("bill", "waiting_payment")]
    [InlineData("esperando pago", "waiting_payment")]
    [InlineData("bloqueada", "blocked")]
    [InlineData("blocked", "blocked")]
    [InlineData("no disponible", "blocked")]
    public void Transform_StatusMapping_MapsCorrectly(string input, string expected)
    {
        // Arrange
        var source = new SRMesa { Numero = "1", Estado = input };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Status.Should().Be(expected);
    }

    [Theory]
    [InlineData(null, "available")]
    [InlineData("", "available")]
    [InlineData("   ", "available")]
    [InlineData("Unknown", "available")]
    public void Transform_NullOrUnknownStatus_ReturnsAvailable(string? input, string expected)
    {
        // Arrange
        var source = new SRMesa { Numero = "1", Estado = input! };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Status.Should().Be(expected);
    }

    #endregion

    #region TransformMany Tests

    [Fact]
    public void TransformMany_MultipleTables_TransformsAll()
    {
        // Arrange
        var sources = new List<SRMesa>
        {
            new() { Numero = "1", Nombre = "Mesa 1" },
            new() { Numero = "2", Nombre = "Mesa 2" },
            new() { Numero = "3", Nombre = "Mesa 3" }
        };

        // Act
        var results = _transformer.TransformMany(sources).ToList();

        // Assert
        results.Should().HaveCount(3);
        results[0].ExternalId.Should().Be("sr-table-1");
        results[1].ExternalId.Should().Be("sr-table-2");
        results[2].ExternalId.Should().Be("sr-table-3");
    }

    [Fact]
    public void TransformMany_EmptyCollection_ReturnsEmpty()
    {
        // Arrange
        var sources = new List<SRMesa>();

        // Act
        var results = _transformer.TransformMany(sources);

        // Assert
        results.Should().BeEmpty();
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void Transform_DefaultValues_HandlesGracefully()
    {
        // Arrange
        var source = new SRMesa();

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Should().NotBeNull();
        result.ExternalId.Should().Be("sr-table-");
        result.Status.Should().Be("available");
        result.IsActive.Should().BeTrue();
    }

    [Fact]
    public void Transform_OccupiedTable_PreservesOccupationInfo()
    {
        // Arrange
        var occupiedAt = DateTime.UtcNow.AddHours(-1);
        var source = new SRMesa
        {
            Numero = "5",
            Estado = "Ocupada",
            OrdenActual = "ORD-123",
            MeseroAsignado = "Juan",
            HoraOcupacion = occupiedAt,
            NumeroComensales = 3
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Status.Should().Be("occupied");
        result.CurrentOrderNumber.Should().Be("ORD-123");
        result.AssignedServer.Should().Be("Juan");
        result.OccupiedAt.Should().Be(occupiedAt);
        result.GuestCount.Should().Be(3);
    }

    #endregion

    #region Helper Methods

    private static SRMesa CreateValidSRMesa()
    {
        return new SRMesa
        {
            Numero = "10",
            Nombre = "Mesa 10",
            Capacidad = 4,
            Seccion = "TERRAZA",
            Estado = "Libre",
            Activo = true,
            Orden = 10,
            PosicionX = 150,
            PosicionY = 300,
            Forma = "Rectangular"
        };
    }

    #endregion
}
