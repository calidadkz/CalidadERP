
import { StockMovement, SalesOrder, SupplierOrder, Reception, Shipment, MovementStatus, Product, ProductType, OptionVariant, PricingProfile, Currency } from '../types';
import { ApiService } from './api';
import { InventoryService } from './InventoryService';
import { MoneyMath } from './MoneyMath';
import { PricingService } from './PricingService';

export type InventoryEvent = 'Confirmed' | 'Closed' | 'Posted' | 'Reverted' | 'Adjustment';

export class InventoryMediator {
  static getMovementsForEvent(
    docType: StockMovement['documentType'],
    event: InventoryEvent,
    docData: any,
    products: Product[],
    currentMovements: StockMovement[],
    optionVariants: OptionVariant[] = [],
    pricingProfiles: PricingProfile[] = [],
    exchangeRates: Record<Currency, number> = {} as any
  ): StockMovement[] {
    const movements: StockMovement[] = [];
    const docId = docData.id;
    const findProduct = (id: string) => products.find(p => p.id === id);

    switch (docType) {
      case 'Order':
        if (event === 'Confirmed') {
          (docData.items || []).forEach((item: any) => {
            const p = findProduct(item.productId);
            if (p) {
              const mv = this.createBaseMovement('In', 'Order', docId, p, Number(item.quantity), 'Incoming');
              mv.configuration = item.configuration;
              movements.push(mv);
            }
          });
        }
        break;

      case 'SalesOrder':
        if (event === 'Confirmed') {
          (docData.items || []).forEach((item: any) => {
            const p = findProduct(item.productId);
            if (p) {
              const mv = this.createBaseMovement('In', 'SalesOrder', docId, p, Number(item.quantity), 'Reserved');
              mv.configuration = item.configuration;
              movements.push(mv);
            }
          });
        }
        break;

      case 'Reception':
        if (event === 'Posted') {
          (docData.items || []).forEach((item: any) => {
            const p = findProduct(item.productId);
            if (p) {
              const unitCost = Number(item.finalCostUnitKzt) || 0;
              const qty = Number(item.qtyFact) || 0;

              let salesPriceKzt = p.salesPrice || 0;
              if (p.type === ProductType.MACHINE) {
                  const variantIds = (item.configuration || []).map((name: string) => 
                      optionVariants.find(ov => ov.name === name)?.id
                  ).filter(Boolean) as string[];
                  const totalPurchaseForeign = PricingService.calculateBundlePurchasePrice(p, variantIds, optionVariants, exchangeRates);
                  const profile = PricingService.findProfile(p, pricingProfiles);
                  const productVolume = p.packages?.reduce((sum, pkg) => sum + (pkg.volumeM3 || 0), 0) || 0;
                  const economy = PricingService.calculateSmartPrice(p, profile, exchangeRates, productVolume, totalPurchaseForeign);
                  salesPriceKzt = economy.finalPrice;
              }

              const mvPhys = this.createBaseMovement('In', 'Reception', docId, p, qty, 'Physical');
              mvPhys.unitCostKzt = unitCost;
              mvPhys.totalCostKzt = MoneyMath.multiply(qty, unitCost);
              mvPhys.salesPriceKzt = salesPriceKzt;
              mvPhys.totalSalesPriceKzt = MoneyMath.multiply(qty, salesPriceKzt);
              mvPhys.configuration = item.configuration;
              movements.push(mvPhys);

              const mvInc = this.createBaseMovement('Out', 'Reception', docId, p, qty, 'Incoming');
              mvInc.configuration = item.configuration;
              movements.push(mvInc);
            }
          });
        }
        break;

      case 'Shipment':
        if (event === 'Posted') {
          (docData.items || []).forEach((item: any) => {
            const p = findProduct(item.productId);
            if (p) {
              const qty = Number(item.qtyShipped) || 0;
              const fifo = InventoryService.calculateFIFODeduction(p.id, qty, currentMovements, item.configuration);

              // Если FIFO не нашло лотов (пустая история), берем текущую цену товара как fallback
              const finalUnitCost = fifo.unitCostKzt || 0;
              const finalUnitSales = fifo.unitSalesKzt || Number(item.priceKzt) || Number(p.salesPrice) || 0;

              const mvPhys = this.createBaseMovement('Out', 'Shipment', docId, p, qty, 'Physical');
              mvPhys.unitCostKzt = finalUnitCost;
              mvPhys.totalCostKzt = MoneyMath.multiply(qty, finalUnitCost);
              mvPhys.salesPriceKzt = finalUnitSales;
              mvPhys.totalSalesPriceKzt = MoneyMath.multiply(qty, finalUnitSales);
              mvPhys.configuration = item.configuration;
              movements.push(mvPhys);

              const mvRes = this.createBaseMovement('Out', 'Shipment', docId, p, qty, 'Reserved');
              mvRes.configuration = item.configuration;
              movements.push(mvRes);
            }
          });
        }
        break;
        
      case 'Adjustment':
        if (event === 'Adjustment') {
            const p = findProduct(docData.productId);
            if (p) {
                const qty = Math.abs(docData.quantity);
                const type = docData.quantity >= 0 ? 'In' : 'Out';
                const mv = this.createBaseMovement(type, 'Adjustment', docId, p, qty, 'Physical');
                
                if (type === 'In') {
                    mv.unitCostKzt = Number(docData.unitCostKzt) || 0;
                    mv.totalCostKzt = MoneyMath.multiply(qty, mv.unitCostKzt);
                    mv.salesPriceKzt = Number(docData.salesPriceKzt) || Number(p.salesPrice) || 0;
                    mv.totalSalesPriceKzt = MoneyMath.multiply(qty, mv.salesPriceKzt);
                } else {
                    const fifo = InventoryService.calculateFIFODeduction(p.id, qty, currentMovements, docData.configuration);
                    const finalUnitCost = fifo.unitCostKzt || 0;
                    const finalUnitSales = fifo.unitSalesKzt || Number(p.salesPrice) || 0;
                    
                    mv.unitCostKzt = finalUnitCost;
                    mv.totalCostKzt = MoneyMath.multiply(qty, finalUnitCost);
                    mv.salesPriceKzt = finalUnitSales;
                    mv.totalSalesPriceKzt = MoneyMath.multiply(qty, finalUnitSales);
                }
                mv.configuration = docData.configuration;
                mv.description = docData.description;
                movements.push(mv);
            }
        }
        break;
    }

    return movements;
  }

  private static createBaseMovement(
    type: 'In' | 'Out', 
    docType: StockMovement['documentType'], 
    docId: string, 
    p: Product, 
    qty: number, 
    status: MovementStatus
  ): StockMovement {
    return {
      id: ApiService.generateUUID(),
      date: new Date().toISOString(),
      productId: p.id,
      sku: p.sku,
      productName: p.name,
      type,
      quantity: qty,
      unitCostKzt: 0,
      totalCostKzt: 0,
      statusType: status,
      documentType: docType,
      documentId: docId
    };
  }

  static async processEvent(
    docType: StockMovement['documentType'],
    event: InventoryEvent,
    docData: any,
    products: Product[],
    optionVariants: OptionVariant[],
    pricingProfiles: PricingProfile[],
    exchangeRates: Record<Currency, number>,
    currentMovements: StockMovement[],
    onMovementsCreated: (movements: StockMovement[]) => void
  ) {
    const movements = this.getMovementsForEvent(
        docType, event, docData, products, currentMovements, optionVariants, pricingProfiles, exchangeRates
    );
    if (movements.length > 0) {
      await ApiService.createMany('stock_movements', movements);
      onMovementsCreated(movements);
    }
  }
}
