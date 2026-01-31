// =====================================================
// TIS TIS PLATFORM - ProductosTransformer Unit Tests
// Comprehensive tests for product data transformation
// =====================================================

using FluentAssertions;
using TisTis.Agent.Core.Database.Models;
using TisTis.Agent.Core.Sync.Transformers;
using Xunit;

namespace TisTis.Agent.Core.Tests.Sync;

/// <summary>
/// Unit tests for ProductosTransformer class.
/// Tests transformation of Soft Restaurant products to TIS TIS format.
/// </summary>
public class ProductosTransformerTests
{
    private readonly ProductosTransformer _transformer;

    public ProductosTransformerTests()
    {
        _transformer = new ProductosTransformer();
    }

    #region Transform Basic Tests

    [Fact]
    public void Transform_ValidProduct_TransformsCorrectly()
    {
        // Arrange
        var source = CreateValidSRProducto();

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Should().NotBeNull();
        result.ExternalId.Should().Be("sr-PROD-001");
        result.Name.Should().Be("Hamburguesa Clásica");
        result.Description.Should().Be("Deliciosa hamburguesa con todos los ingredientes");
        result.Price.Should().Be(120.00m);
    }

    [Fact]
    public void Transform_SetsExternalIdWithPrefix()
    {
        // Arrange
        var source = new SRProducto { Codigo = "TEST-CODE-123" };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.ExternalId.Should().Be("sr-TEST-CODE-123");
    }

    [Fact]
    public void Transform_PreservesAllAmounts()
    {
        // Arrange
        var source = new SRProducto
        {
            Codigo = "PROD",
            Precio = 150.50m,
            PrecioMayoreo = 130.00m,
            Costo = 50.00m,
            TasaImpuesto = 16.00m
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Price.Should().Be(150.50m);
        result.SecondaryPrice.Should().Be(130.00m);
        result.Cost.Should().Be(50.00m);
        result.TaxRate.Should().Be(16.00m);
    }

    [Fact]
    public void Transform_PreservesCategoryInfo()
    {
        // Arrange
        var source = new SRProducto
        {
            Codigo = "PROD",
            Categoria = "Bebidas",
            CodigoCategoria = "CAT-BEBIDAS"
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Category.Should().Be("Bebidas");
        result.CategoryCode.Should().Be("CAT-BEBIDAS");
    }

    [Fact]
    public void Transform_PreservesFlags()
    {
        // Arrange
        var source = new SRProducto
        {
            Codigo = "PROD",
            Activo = true,
            EsReceta = true,
            EsModificador = false
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.IsActive.Should().BeTrue();
        result.IsComposite.Should().BeTrue();
        result.IsModifier.Should().BeFalse();
    }

    [Fact]
    public void Transform_IncludesMetadata()
    {
        // Arrange
        var source = new SRProducto
        {
            Codigo = "META-PROD",
            PrecioIncluyeImpuesto = true,
            Impresora = "COCINA"
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Metadata.Should().ContainKey("source").WhoseValue.Should().Be("soft_restaurant");
        result.Metadata.Should().ContainKey("sr_codigo").WhoseValue.Should().Be("META-PROD");
        result.Metadata.Should().ContainKey("price_includes_tax").WhoseValue.Should().Be(true);
        result.Metadata.Should().ContainKey("printer").WhoseValue.Should().Be("COCINA");
    }

    [Fact]
    public void Transform_NullPrinter_SetsEmptyString()
    {
        // Arrange
        var source = new SRProducto
        {
            Codigo = "PROD",
            Impresora = null
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Metadata["printer"].Should().Be("");
    }

    #endregion

    #region Unit Mapping Tests

    [Theory]
    [InlineData("PZA", "unit")]
    [InlineData("PIEZA", "unit")]
    [InlineData("PIEZAS", "unit")]
    [InlineData("KG", "kg")]
    [InlineData("KILOGRAMO", "kg")]
    [InlineData("KILOGRAMOS", "kg")]
    [InlineData("GR", "g")]
    [InlineData("G", "g")]
    [InlineData("GRAMO", "g")]
    [InlineData("GRAMOS", "g")]
    [InlineData("LT", "l")]
    [InlineData("L", "l")]
    [InlineData("LITRO", "l")]
    [InlineData("LITROS", "l")]
    [InlineData("ML", "ml")]
    [InlineData("MILILITRO", "ml")]
    [InlineData("MILILITROS", "ml")]
    [InlineData("OZ", "oz")]
    [InlineData("ONZA", "oz")]
    [InlineData("ONZAS", "oz")]
    [InlineData("LB", "lb")]
    [InlineData("LIBRA", "lb")]
    [InlineData("LIBRAS", "lb")]
    [InlineData("PORCION", "portion")]
    [InlineData("PORCIONES", "portion")]
    public void Transform_UnitMapping_MapsCorrectly(string input, string expected)
    {
        // Arrange
        var source = new SRProducto { Codigo = "PROD", UnidadMedida = input };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Unit.Should().Be(expected);
    }

    [Theory]
    [InlineData(null, "unit")]
    [InlineData("", "unit")]
    [InlineData("   ", "unit")]
    [InlineData("Unknown", "unit")]
    public void Transform_NullOrEmptyUnit_ReturnsUnit(string? input, string expected)
    {
        // Arrange
        var source = new SRProducto { Codigo = "PROD", UnidadMedida = input! };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Unit.Should().Be(expected);
    }

    [Fact]
    public void Transform_UnitCaseInsensitive_MapsCorrectly()
    {
        // Arrange
        var source = new SRProducto { Codigo = "PROD", UnidadMedida = "kilogramo" };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Unit.Should().Be("kg");
    }

    #endregion

    #region TransformMany Tests

    [Fact]
    public void TransformMany_MultipleProducts_TransformsAll()
    {
        // Arrange
        var sources = new List<SRProducto>
        {
            new() { Codigo = "PROD-001", Descripcion = "Producto 1" },
            new() { Codigo = "PROD-002", Descripcion = "Producto 2" },
            new() { Codigo = "PROD-003", Descripcion = "Producto 3" }
        };

        // Act
        var results = _transformer.TransformMany(sources).ToList();

        // Assert
        results.Should().HaveCount(3);
        results[0].ExternalId.Should().Be("sr-PROD-001");
        results[1].ExternalId.Should().Be("sr-PROD-002");
        results[2].ExternalId.Should().Be("sr-PROD-003");
    }

    [Fact]
    public void TransformMany_EmptyCollection_ReturnsEmpty()
    {
        // Arrange
        var sources = new List<SRProducto>();

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
        var source = new SRProducto();

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Should().NotBeNull();
        result.ExternalId.Should().Be("sr-");
        result.Name.Should().BeEmpty();
        result.Price.Should().Be(0m);
        result.IsActive.Should().BeTrue();
    }

    [Fact]
    public void Transform_AllOptionalFieldsNull_HandlesGracefully()
    {
        // Arrange
        var source = new SRProducto
        {
            Codigo = "PROD",
            Descripcion = "Test",
            PrecioMayoreo = null,
            Costo = null,
            Categoria = null,
            TiempoPreparacion = null,
            Calorias = null,
            Alergenos = null,
            Imagen = null,
            CodigoBarras = null
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.SecondaryPrice.Should().BeNull();
        result.Cost.Should().BeNull();
        result.Category.Should().BeNull();
        result.PrepTimeMinutes.Should().BeNull();
        result.Calories.Should().BeNull();
        result.Allergens.Should().BeNull();
        result.ImageUrl.Should().BeNull();
        result.Barcode.Should().BeNull();
    }

    #endregion

    #region Helper Methods

    private static SRProducto CreateValidSRProducto()
    {
        return new SRProducto
        {
            Codigo = "PROD-001",
            Descripcion = "Hamburguesa Clásica",
            DescripcionMenu = "Deliciosa hamburguesa con todos los ingredientes",
            Precio = 120.00m,
            PrecioMayoreo = 100.00m,
            Costo = 35.00m,
            Categoria = "Hamburguesas",
            CodigoCategoria = "CAT-BURG",
            Activo = true,
            EsReceta = true,
            TiempoPreparacion = 15,
            Calorias = 650,
            UnidadMedida = "PZA",
            TasaImpuesto = 16.00m,
            PrecioIncluyeImpuesto = true,
            Orden = 1,
            Impresora = "COCINA"
        };
    }

    #endregion
}
