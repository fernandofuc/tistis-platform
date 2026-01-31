// =====================================================
// TIS TIS PLATFORM - VentasTransformer Unit Tests
// Comprehensive tests for sales data transformation
// =====================================================

using FluentAssertions;
using TisTis.Agent.Core.Database.Models;
using TisTis.Agent.Core.Sync.Transformers;
using Xunit;

namespace TisTis.Agent.Core.Tests.Sync;

/// <summary>
/// Unit tests for VentasTransformer class.
/// Tests transformation of Soft Restaurant sales to TIS TIS format.
/// </summary>
public class VentasTransformerTests
{
    private readonly VentasTransformer _transformer;

    public VentasTransformerTests()
    {
        _transformer = new VentasTransformer();
    }

    #region Transform Basic Tests

    [Fact]
    public void Transform_ValidSale_TransformsCorrectly()
    {
        // Arrange
        var source = CreateValidSRVenta();

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Should().NotBeNull();
        result.ExternalId.Should().Be("sr-12345");
        result.OrderNumber.Should().Be("ORD-001");
        result.ReceiptNumber.Should().Be("A-001");
        result.Subtotal.Should().Be(100.00m);
        result.TaxTotal.Should().Be(16.00m);
        result.GrandTotal.Should().Be(116.00m);
    }

    [Fact]
    public void Transform_SetsExternalIdWithPrefix()
    {
        // Arrange
        var source = new SRVenta { IdVenta = 99999 };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.ExternalId.Should().Be("sr-99999");
    }

    [Fact]
    public void Transform_PreservesAllAmounts()
    {
        // Arrange
        var source = new SRVenta
        {
            SubtotalSinImpuestos = 500.50m,
            TotalImpuestos = 80.08m,
            TotalDescuentos = 25.00m,
            TotalPropinas = 50.00m,
            Total = 605.58m,
            Moneda = "USD"
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Subtotal.Should().Be(500.50m);
        result.TaxTotal.Should().Be(80.08m);
        result.DiscountTotal.Should().Be(25.00m);
        result.TipTotal.Should().Be(50.00m);
        result.GrandTotal.Should().Be(605.58m);
        result.Currency.Should().Be("USD");
    }

    [Fact]
    public void Transform_PreservesCustomerInfo()
    {
        // Arrange
        var source = new SRVenta
        {
            CodigoCliente = "CUST-001",
            NombreCliente = "Juan Pérez"
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.CustomerId.Should().Be("CUST-001");
        result.CustomerName.Should().Be("Juan Pérez");
    }

    [Fact]
    public void Transform_PreservesServerInfo()
    {
        // Arrange
        var source = new SRVenta
        {
            CodigoMesero = "WAITER-001",
            NombreMesero = "María García"
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.ServerId.Should().Be("WAITER-001");
        result.ServerName.Should().Be("María García");
    }

    [Fact]
    public void Transform_PreservesLocationInfo()
    {
        // Arrange
        var source = new SRVenta
        {
            NumeroMesa = "15",
            Estacion = "POS-01",
            Almacen = "SUCURSAL-CENTRO"
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.TableNumber.Should().Be("15");
        result.StationId.Should().Be("POS-01");
        result.LocationCode.Should().Be("SUCURSAL-CENTRO");
    }

    [Fact]
    public void Transform_IncludesMetadata()
    {
        // Arrange
        var source = new SRVenta
        {
            IdVenta = 12345,
            FolioVenta = "A-001"
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Metadata.Should().ContainKey("source").WhoseValue.Should().Be("soft_restaurant");
        result.Metadata.Should().ContainKey("sr_id_venta").WhoseValue.Should().Be(12345L);
        result.Metadata.Should().ContainKey("sr_folio").WhoseValue.Should().Be("A-001");
    }

    #endregion

    #region Status Tests

    [Fact]
    public void Transform_CancelledSale_StatusIsCancelled()
    {
        // Arrange
        var source = new SRVenta { Cancelada = true };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Status.Should().Be("cancelled");
    }

    [Fact]
    public void Transform_PaidSale_StatusIsCompleted()
    {
        // Arrange
        var source = new SRVenta { Pagada = true, Cancelada = false };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Status.Should().Be("completed");
    }

    [Fact]
    public void Transform_ClosedButNotPaid_StatusIsClosed()
    {
        // Arrange
        var source = new SRVenta
        {
            FechaCierre = DateTime.UtcNow,
            Pagada = false,
            Cancelada = false
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Status.Should().Be("closed");
    }

    [Fact]
    public void Transform_OpenSale_StatusIsOpen()
    {
        // Arrange
        var source = new SRVenta
        {
            FechaCierre = null,
            Pagada = false,
            Cancelada = false
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Status.Should().Be("open");
    }

    [Fact]
    public void Transform_CancelledTakesPrecedence()
    {
        // Arrange - Both cancelled and paid
        var source = new SRVenta { Cancelada = true, Pagada = true };

        // Act
        var result = _transformer.Transform(source);

        // Assert - Cancelled should take precedence
        result.Status.Should().Be("cancelled");
    }

    #endregion

    #region Order Type Tests

    [Theory]
    [InlineData(1, "dine_in")]
    [InlineData(2, "takeout")]
    [InlineData(3, "delivery")]
    [InlineData(4, "drive_thru")]
    [InlineData(0, "dine_in")]   // Default
    [InlineData(99, "dine_in")]  // Unknown
    public void Transform_OrderType_MapsCorrectly(int tipoOrden, string expectedType)
    {
        // Arrange
        var source = new SRVenta { TipoOrden = tipoOrden };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.OrderType.Should().Be(expectedType);
    }

    #endregion

    #region Items Transformation Tests

    [Fact]
    public void Transform_WithItems_TransformsAllItems()
    {
        // Arrange
        var source = new SRVenta
        {
            Detalles = new List<SRVentaDetalle>
            {
                new() { Codigo = "PROD-001", Descripcion = "Pizza", Cantidad = 2, PrecioUnitario = 150.00m },
                new() { Codigo = "PROD-002", Descripcion = "Refresco", Cantidad = 3, PrecioUnitario = 35.00m }
            }
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Items.Should().HaveCount(2);
        result.Items[0].ProductCode.Should().Be("PROD-001");
        result.Items[0].ProductName.Should().Be("Pizza");
        result.Items[0].Quantity.Should().Be(2);
        result.Items[0].UnitPrice.Should().Be(150.00m);
    }

    [Fact]
    public void Transform_ItemWithFullDetails_PreservesAllFields()
    {
        // Arrange
        var source = new SRVenta
        {
            Detalles = new List<SRVentaDetalle>
            {
                new()
                {
                    Codigo = "PROD-001",
                    Descripcion = "Hamburguesa Especial",
                    Cantidad = 1,
                    PrecioUnitario = 120.00m,
                    Importe = 120.00m,
                    Descuento = 10.00m,
                    Impuesto = 17.60m,
                    Modificadores = "Sin cebolla, Extra queso",
                    Notas = "Término medio",
                    CodigoCategoria = "CAT-BURGER",
                    Cancelado = false
                }
            }
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        var item = result.Items.First();
        item.LineTotal.Should().Be(120.00m);
        item.Discount.Should().Be(10.00m);
        item.Tax.Should().Be(17.60m);
        item.Modifiers.Should().Be("Sin cebolla, Extra queso");
        item.Notes.Should().Be("Término medio");
        item.CategoryCode.Should().Be("CAT-BURGER");
        item.IsVoided.Should().BeFalse();
    }

    [Fact]
    public void Transform_VoidedItem_PreservesVoidedFlag()
    {
        // Arrange
        var source = new SRVenta
        {
            Detalles = new List<SRVentaDetalle>
            {
                new() { Cancelado = true }
            }
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Items.First().IsVoided.Should().BeTrue();
    }

    [Fact]
    public void Transform_NullItems_ReturnsEmptyList()
    {
        // Arrange
        var source = new SRVenta { Detalles = null! };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Items.Should().NotBeNull();
        result.Items.Should().BeEmpty();
    }

    [Fact]
    public void Transform_EmptyItems_ReturnsEmptyList()
    {
        // Arrange
        var source = new SRVenta { Detalles = new List<SRVentaDetalle>() };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Items.Should().BeEmpty();
    }

    #endregion

    #region Payments Transformation Tests

    [Fact]
    public void Transform_WithPayments_TransformsAllPayments()
    {
        // Arrange
        var source = new SRVenta
        {
            Pagos = new List<SRPago>
            {
                new() { FormaPago = "Efectivo", Monto = 100.00m },
                new() { FormaPago = "Tarjeta", Monto = 50.00m }
            }
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Payments.Should().HaveCount(2);
    }

    [Fact]
    public void Transform_PaymentWithFullDetails_PreservesAllFields()
    {
        // Arrange
        var source = new SRVenta
        {
            Pagos = new List<SRPago>
            {
                new()
                {
                    FormaPago = "Tarjeta de credito",
                    Monto = 500.00m,
                    Propina = 50.00m,
                    Referencia = "AUTH-123456",
                    Moneda = "MXN",
                    MarcaTarjeta = "Visa",
                    Ultimos4Digitos = "4321"
                }
            }
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        var payment = result.Payments.First();
        payment.Method.Should().Be("card");
        payment.Amount.Should().Be(500.00m);
        payment.Tip.Should().Be(50.00m);
        payment.Reference.Should().Be("AUTH-123456");
        payment.Currency.Should().Be("MXN");
        payment.CardBrand.Should().Be("Visa");
        payment.LastFourDigits.Should().Be("4321");
    }

    [Fact]
    public void Transform_NullPayments_ReturnsEmptyList()
    {
        // Arrange
        var source = new SRVenta { Pagos = null! };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Payments.Should().NotBeNull();
        result.Payments.Should().BeEmpty();
    }

    #endregion

    #region Payment Method Mapping Tests

    [Theory]
    [InlineData("Efectivo", "cash")]
    [InlineData("EFECTIVO", "cash")]
    [InlineData("efectivo", "cash")]
    [InlineData("cash", "cash")]
    [InlineData("Cash", "cash")]
    public void Transform_CashPayments_MapCorrectly(string input, string expected)
    {
        // Arrange
        var source = new SRVenta
        {
            Pagos = new List<SRPago> { new() { FormaPago = input } }
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Payments.First().Method.Should().Be(expected);
    }

    [Theory]
    [InlineData("Tarjeta", "card")]
    [InlineData("tarjeta de credito", "card")]
    [InlineData("Tarjeta de debito", "card")]
    [InlineData("credit", "card")]
    [InlineData("debit", "card")]
    public void Transform_CardPayments_MapCorrectly(string input, string expected)
    {
        // Arrange
        var source = new SRVenta
        {
            Pagos = new List<SRPago> { new() { FormaPago = input } }
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Payments.First().Method.Should().Be(expected);
    }

    [Theory]
    [InlineData("Transferencia", "bank_transfer")]
    [InlineData("transfer", "bank_transfer")]
    public void Transform_BankTransferPayments_MapCorrectly(string input, string expected)
    {
        // Arrange
        var source = new SRVenta
        {
            Pagos = new List<SRPago> { new() { FormaPago = input } }
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Payments.First().Method.Should().Be(expected);
    }

    [Theory]
    [InlineData("Vales", "voucher")]
    [InlineData("voucher", "voucher")]
    public void Transform_VoucherPayments_MapCorrectly(string input, string expected)
    {
        // Arrange
        var source = new SRVenta
        {
            Pagos = new List<SRPago> { new() { FormaPago = input } }
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Payments.First().Method.Should().Be(expected);
    }

    [Theory]
    [InlineData("Cortesia", "courtesy")]
    [InlineData("courtesy", "courtesy")]
    public void Transform_CourtesyPayments_MapCorrectly(string input, string expected)
    {
        // Arrange
        var source = new SRVenta
        {
            Pagos = new List<SRPago> { new() { FormaPago = input } }
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Payments.First().Method.Should().Be(expected);
    }

    [Theory]
    [InlineData("Credito", "credit")]
    [InlineData("Fiado", "credit")]
    public void Transform_CreditPayments_MapCorrectly(string input, string expected)
    {
        // Arrange
        var source = new SRVenta
        {
            Pagos = new List<SRPago> { new() { FormaPago = input } }
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Payments.First().Method.Should().Be(expected);
    }

    [Theory]
    [InlineData(null, "other")]
    [InlineData("", "other")]
    [InlineData("   ", "other")]
    [InlineData("Unknown", "other")]
    [InlineData("Bitcoin", "other")]
    public void Transform_UnknownOrNullPayments_MapToOther(string? input, string expected)
    {
        // Arrange
        var source = new SRVenta
        {
            Pagos = new List<SRPago> { new() { FormaPago = input! } }
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Payments.First().Method.Should().Be(expected);
    }

    #endregion

    #region TransformMany Tests

    [Fact]
    public void TransformMany_MultipleVentas_TransformsAll()
    {
        // Arrange
        var sources = new List<SRVenta>
        {
            new() { IdVenta = 1, NumeroOrden = "ORD-001" },
            new() { IdVenta = 2, NumeroOrden = "ORD-002" },
            new() { IdVenta = 3, NumeroOrden = "ORD-003" }
        };

        // Act
        var results = _transformer.TransformMany(sources).ToList();

        // Assert
        results.Should().HaveCount(3);
        results[0].ExternalId.Should().Be("sr-1");
        results[1].ExternalId.Should().Be("sr-2");
        results[2].ExternalId.Should().Be("sr-3");
    }

    [Fact]
    public void TransformMany_EmptyCollection_ReturnsEmpty()
    {
        // Arrange
        var sources = new List<SRVenta>();

        // Act
        var results = _transformer.TransformMany(sources);

        // Assert
        results.Should().BeEmpty();
    }

    [Fact]
    public void TransformMany_IsLazy()
    {
        // Arrange - Use a list to track when items are accessed
        var accessedIndices = new List<int>();
        var sources = GetLazySourceEnumerable(accessedIndices, 100);

        // Act - Get enumerable but don't iterate
        var results = _transformer.TransformMany(sources);

        // Assert - Source should not have been enumerated yet
        accessedIndices.Should().BeEmpty();

        // Now iterate first 5
        results.Take(5).ToList();
        accessedIndices.Should().HaveCount(5);
        accessedIndices.Should().BeEquivalentTo(new[] { 0, 1, 2, 3, 4 });
    }

    /// <summary>
    /// Helper method that yields SRVenta objects lazily, recording when each is accessed
    /// </summary>
    private static IEnumerable<SRVenta> GetLazySourceEnumerable(List<int> accessedIndices, int count)
    {
        for (int i = 0; i < count; i++)
        {
            accessedIndices.Add(i);
            yield return new SRVenta { IdVenta = i + 1 };
        }
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void Transform_DefaultValues_HandlesGracefully()
    {
        // Arrange
        var source = new SRVenta();

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Should().NotBeNull();
        result.ExternalId.Should().Be("sr-0");
        result.OrderNumber.Should().BeEmpty();
        result.Status.Should().Be("open");
        result.OrderType.Should().Be("dine_in");
        result.Currency.Should().Be("MXN");
    }

    [Fact]
    public void Transform_NullableFieldsAreNull_HandlesGracefully()
    {
        // Arrange
        var source = new SRVenta
        {
            NumeroMesa = null,
            CodigoCliente = null,
            NombreCliente = null,
            CodigoMesero = null,
            NombreMesero = null,
            Observaciones = null
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.TableNumber.Should().BeNull();
        result.CustomerId.Should().BeNull();
        result.CustomerName.Should().BeNull();
        result.ServerId.Should().BeNull();
        result.ServerName.Should().BeNull();
        result.Notes.Should().BeNull();
    }

    [Fact]
    public void Transform_LargeAmounts_PreservesPrecision()
    {
        // Arrange
        var source = new SRVenta
        {
            SubtotalSinImpuestos = 999999999.99m,
            TotalImpuestos = 159999999.99m,
            Total = 1159999999.98m
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Subtotal.Should().Be(999999999.99m);
        result.TaxTotal.Should().Be(159999999.99m);
        result.GrandTotal.Should().Be(1159999999.98m);
    }

    [Fact]
    public void Transform_ZeroAmounts_PreservesZeros()
    {
        // Arrange
        var source = new SRVenta
        {
            SubtotalSinImpuestos = 0m,
            TotalImpuestos = 0m,
            TotalDescuentos = 0m,
            TotalPropinas = 0m,
            Total = 0m
        };

        // Act
        var result = _transformer.Transform(source);

        // Assert
        result.Subtotal.Should().Be(0m);
        result.TaxTotal.Should().Be(0m);
        result.DiscountTotal.Should().Be(0m);
        result.TipTotal.Should().Be(0m);
        result.GrandTotal.Should().Be(0m);
    }

    #endregion

    #region Helper Methods

    private static SRVenta CreateValidSRVenta()
    {
        return new SRVenta
        {
            IdVenta = 12345,
            NumeroOrden = "ORD-001",
            FolioVenta = "A-001",
            Estacion = "POS-01",
            Almacen = "CENTRAL",
            FechaApertura = DateTime.UtcNow.AddHours(-1),
            FechaCierre = DateTime.UtcNow,
            NumeroMesa = "10",
            CodigoCliente = "CUST-001",
            NombreCliente = "Test Customer",
            CodigoMesero = "WAITER-001",
            NombreMesero = "Test Waiter",
            Observaciones = "Test notes",
            SubtotalSinImpuestos = 100.00m,
            TotalImpuestos = 16.00m,
            TotalDescuentos = 0m,
            TotalPropinas = 0m,
            Total = 116.00m,
            Moneda = "MXN",
            Cancelada = false,
            Pagada = true,
            TipoOrden = 1,
            NumeroComensales = 2,
            Detalles = new List<SRVentaDetalle>
            {
                new()
                {
                    Codigo = "PROD-001",
                    Descripcion = "Test Product",
                    Cantidad = 1,
                    PrecioUnitario = 100.00m,
                    Importe = 100.00m,
                    Impuesto = 16.00m
                }
            },
            Pagos = new List<SRPago>
            {
                new()
                {
                    FormaPago = "Efectivo",
                    Monto = 116.00m,
                    Moneda = "MXN"
                }
            }
        };
    }

    #endregion
}
