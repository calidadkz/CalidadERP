import { Bundle, Product, OptionVariant, OptionType, ActionType } from '../types';

export class BundleExporter {
  static exportToCsv(
    bundle: { 
      name: string; 
      baseProductId: string; 
      selectedVariantIds: string[]; 
      totalPrice: number; 
      description?: string;
    },
    products: Product[],
    optionVariants: OptionVariant[],
    optionTypes: OptionType[],
    addLog: (action: ActionType, docType: string, docId: string, message: string) => void
  ) {
    const headers = ['Параметр', 'Значение'];
    const machine = products.find(p => p.id === bundle.baseProductId);
    
    const rows: string[][] = [
      ['Название комплектации', bundle.name || 'Новая комплектация'],
      ['Модель станка', machine?.name || 'Неизвестно'],
      ['Системный ID станка', bundle.baseProductId]
    ];

    const basePackages = machine?.packages || [];
    const baseVolume = basePackages.reduce((sum, p) => sum + (p.volumeM3 || 0), 0);

    if (basePackages.length > 0) {
      rows.push([
        `Габариты базы (мест: ${basePackages.length})`,
        basePackages.map(p => `${p.lengthMm || 0}x${p.widthMm || 0}x${p.heightMm || 0} (${p.volumeM3 || 0} м³)`).join('; ')
      ]);
    } else {
      rows.push(['Габариты базы', 'Не заданы']);
    }

    const groupedOptions: Record<string, string[]> = {};
    const optionsWithDims: string[] = [];
    let optionsVolume = 0;

    bundle.selectedVariantIds.forEach(vid => {
      const variant = optionVariants.find(v => v.id === vid);
      if (variant) {
        const typeName = optionTypes.find(ot => ot.id === variant.typeId)?.name || 'Прочее';
        if (!groupedOptions[typeName]) groupedOptions[typeName] = [];
        groupedOptions[typeName].push(variant.name);
        
        if ((variant.volumeM3 || 0) > 0) {
          optionsWithDims.push(`${variant.name}: ${variant.lengthMm || 0}x${variant.widthMm || 0}x${variant.heightMm || 0} (${variant.volumeM3 || 0} м³)`);
          optionsVolume += (variant.volumeM3 || 0);
        }
      }
    });

    Object.entries(groupedOptions).forEach(([typeName, variants]) => {
      rows.push([`Опция: ${typeName}`, variants.join(', ')]);
    });

    if (optionsWithDims.length > 0) {
      rows.push(['Габариты опций', optionsWithDims.join('; ')]);
    }

    rows.push(['Суммарный объем', `${(baseVolume + optionsVolume).toFixed(3)} м³`]);

    if (machine && ((machine.workingLengthMm || 0) > 0 || (machine.workingWidthMm || 0) > 0 || (machine.workingHeightMm || 0) > 0)) {
      rows.push(['Рабочие габариты', `${machine.workingLengthMm || 0}x${machine.workingWidthMm || 0}x${machine.workingHeightMm || 0} (${machine.workingVolumeM3 || 0} м³)`]);
    }

    rows.push(['Описание', bundle.description || '—']);
    rows.push(['Цена продажи (KZT)', (bundle.totalPrice || 0).toString()]);
    rows.push(['Дата экспорта', new Date().toLocaleString('ru-RU')]);

    const csvContent = '\uFEFF' + [
      headers.join(';'), 
      ...rows.map(r => r.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bundle_${(bundle.name || 'new').replace(/[^a-z0-9а-яё]/gi, '_')}.csv`;
    link.click();
    
    addLog('Export', 'Комплектации', bundle.baseProductId, `Экспорт комплектации "${bundle.name}" в CSV`);
  }
}
