import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Package, TrendingUp, TrendingDown, AlertTriangle, Search, Plus, 
  Edit3, Trash2, Save, X, ArrowUpRight, ArrowDownRight, Calendar,
  Filter, Download, RefreshCw
} from 'lucide-react';
import { 
  useListProducts, useListCategories, 
  getListProductsQueryKey, getListCategoriesQueryKey 
} from '@workspace/api-client-react';
import type { Product, Category } from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';

type StockMovement = {
  id: number;
  productId: number;
  productName: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  createdAt: string;
};

type WarehouseFilter = {
  search: string;
  category: string;
  stockStatus: 'all' | 'low' | 'out' | 'normal';
};

const emptyProduct: Partial<Product> = {
  name: '',
  description: '',
  price: 0,
  quantity: 0,
  category: '',
  subcategory: '',
  imageUrl: '',
};

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendValue,
  color = 'primary' 
}: { 
  title: string; 
  value: string | number; 
  icon: any; 
  trend?: 'up' | 'down';
  trendValue?: string;
  color?: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-[#dcebd9] text-[#326342]',
    warning: 'bg-[#fef3c7] text-[#92400e]',
    danger: 'bg-[#fee2e2] text-[#dc2626]',
  };
  
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">{title}</p>
          <p className="mt-2 font-display text-2xl font-bold">{value}</p>
          {trend && trendValue && (
            <div className={`mt-2 flex items-center gap-1 text-xs font-semibold ${trend === 'up' ? 'text-[#326342]' : 'text-[#dc2626]'}`}>
              {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trendValue}
            </div>
          )}
        </div>
        <div className={`grid size-11 place-items-center rounded-lg ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function StockStatusBadge({ quantity }: { quantity: number }) {
  if (quantity === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fee2e2] px-2.5 py-1 text-xs font-semibold text-[#dc2626]">
        <AlertTriangle size={12} /> Нет на складе
      </span>
    );
  }
  if (quantity < 10) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fef3c7] px-2.5 py-1 text-xs font-semibold text-[#92400e]">
        <AlertTriangle size={12} /> Заканчивается ({quantity})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcebd9] px-2.5 py-1 text-xs font-semibold text-[#326342]">
      В наличии ({quantity})
    </span>
  );
}

function ProductStockRow({ 
  product, 
  onEdit,
  onDelete 
}: { 
  product: Product; 
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}) {
  return (
    <div className="group flex items-center gap-4 border-b border-border py-3 last:border-0 hover:bg-muted/30">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="size-full object-cover" />
          ) : (
            <Package size={20} className="text-muted-foreground/40" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{product.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {product.category}{product.subcategory && ` / ${product.subcategory}`}
          </p>
        </div>
      </div>
      <div className="hidden md:block w-32 text-right">
        <p className="font-mono text-sm font-medium">{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(product.price)}</p>
      </div>
      <div className="w-32 text-right">
        <StockStatusBadge quantity={product.quantity} />
      </div>
      <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
        <button 
          onClick={() => onEdit(product)}
          className="grid size-8 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:text-primary"
          aria-label="Редактировать"
        >
          <Edit3 size={14} />
        </button>
        <button 
          onClick={() => onDelete(product)}
          className="grid size-8 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:text-destructive"
          aria-label="Удалить"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function StockMovementForm({ 
  products, 
  onSubmit, 
  onCancel 
}: { 
  products: Product[]; 
  onSubmit: (movement: Omit<StockMovement, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    productId: '',
    type: 'in' as 'in' | 'out' | 'adjustment',
    quantity: '',
    reason: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId || !formData.quantity || !formData.reason) return;
    
    const product = products.find(p => p.id === Number(formData.productId));
    if (!product) return;

    onSubmit({
      productId: Number(formData.productId),
      productName: product.name,
      type: formData.type,
      quantity: Number(formData.quantity),
      reason: formData.reason,
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-primary/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg animate-lift-in rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">Операция со складом</p>
            <h2 className="mt-1 font-display text-xl font-bold">Движение товара</h2>
          </div>
          <button 
            onClick={onCancel}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-bold">Товар</span>
            <select 
              value={formData.productId}
              onChange={e => setFormData({ ...formData, productId: e.target.value })}
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              required
            >
              <option value="">Выберите товар</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (остаток: {p.quantity})</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold">Тип операции</span>
            <select 
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value as any })}
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="in">Приход (поступление)</option>
              <option value="out">Расход (списание)</option>
              <option value="adjustment">Корректировка</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold">Количество, шт.</span>
            <input 
              type="number" 
              min="1"
              value={formData.quantity}
              onChange={e => setFormData({ ...formData, quantity: e.target.value })}
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="0"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold">Причина / Комментарий</span>
            <textarea 
              value={formData.reason}
              onChange={e => setFormData({ ...formData, reason: e.target.value })}
              rows={3}
              className="mt-2 w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Например: поступление от поставщика, списание по акту"
              required
            />
          </label>

          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={onCancel}
              className="flex-1 rounded-md border border-border bg-card py-3 text-sm font-semibold hover:bg-muted"
            >
              Отмена
            </button>
            <button 
              type="submit"
              className="flex-1 rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              Провести операцию
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WarehousePage() {
  const queryClient = useQueryClient();
  const productsQuery = useListProducts();
  const categoriesQuery = useListCategories();
  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  
  const [filter, setFilter] = useState<WarehouseFilter>({
    search: '',
    category: 'all',
    stockStatus: 'all',
  });
  
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([
    { id: 1, productId: 1, productName: 'Стаканы 300мл', type: 'in', quantity: 100, reason: 'Поступление от поставщика', createdAt: new Date().toISOString() },
    { id: 2, productId: 2, productName: 'Крышки 300мл', type: 'out', quantity: 50, reason: 'Отгрузка заказу №1234', createdAt: new Date().toISOString() },
    { id: 3, productId: 3, productName: 'Трубочки бумажные', type: 'adjustment', quantity: -5, reason: 'Инвентаризация', createdAt: new Date().toISOString() },
  ]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = filter.search === '' || 
        product.name.toLowerCase().includes(filter.search.toLowerCase()) ||
        product.description?.toLowerCase().includes(filter.search.toLowerCase());
      
      const matchesCategory = filter.category === 'all' || 
        product.category === filter.category;
      
      let matchesStock = true;
      if (filter.stockStatus === 'low') matchesStock = product.quantity > 0 && product.quantity < 10;
      if (filter.stockStatus === 'out') matchesStock = product.quantity === 0;
      if (filter.stockStatus === 'normal') matchesStock = product.quantity >= 10;
      
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, filter]);

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalValue = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
    const lowStock = products.filter(p => p.quantity > 0 && p.quantity < 10).length;
    const outOfStock = products.filter(p => p.quantity === 0).length;
    
    return { totalProducts, totalValue, lowStock, outOfStock };
  }, [products]);

  const handleAddMovement = (movement: Omit<StockMovement, 'id' | 'createdAt'>) => {
    const newMovement: StockMovement = {
      ...movement,
      id: movements.length + 1,
      createdAt: new Date().toISOString(),
    };
    setMovements([newMovement, ...movements]);
    setShowMovementForm(false);
    
    // Обновляем остатки
    const product = products.find(p => p.id === movement.productId);
    if (product) {
      let newQuantity = product.quantity;
      if (movement.type === 'in') newQuantity += movement.quantity;
      if (movement.type === 'out') newQuantity -= movement.quantity;
      if (movement.type === 'adjustment') newQuantity += movement.quantity;
      
      // Здесь должен быть API вызов для обновления продукта
      console.log(`Обновление остатков для ${product.name}: ${product.quantity} -> ${newQuantity}`);
    }
    
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
  };

  const handleDeleteProduct = (product: Product) => {
    if (window.confirm(`Удалить товар "${product.name}" из каталога?`)) {
      // Здесь должен быть API вызов для удаления
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    }
  };

  const parentCategories = categories.filter(c => c.parentId === null);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-7 md:py-8">
        {/* Header */}
        <div className="animate-lift-in flex flex-col justify-between gap-5 border-b border-border pb-6 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-accent">
              <span className="size-1.5 rounded-full bg-accent" /> Складской учёт
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">Управление складом</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Контролируйте остатки, проводите приход и расход, отслеживайте движение товаров
            </p>
          </div>
          <button 
            onClick={() => setShowMovementForm(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus size={16} /> Операция со складом
          </button>
        </div>

        {/* Stats Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Всего товаров" 
            value={stats.totalProducts} 
            icon={Package} 
            trend="up"
            trendValue="+12% за месяц"
          />
          <StatCard 
            title="Стоимость остатков" 
            value={new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(stats.totalValue)}
            icon={TrendingUp}
            color="success"
            trend="up"
            trendValue="+8.5% за неделю"
          />
          <StatCard 
            title="Заканчиваются" 
            value={stats.lowStock} 
            icon={AlertTriangle}
            color="warning"
            trend="down"
            trendValue="-3 поз."
          />
          <StatCard 
            title="Нет на складе" 
            value={stats.outOfStock} 
            icon={TrendingDown}
            color="danger"
          />
        </div>

        {/* Main Content */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Products Table */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="font-display text-lg font-bold">Остатки на складе</h2>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input 
                        type="search" 
                        value={filter.search}
                        onChange={e => setFilter({ ...filter, search: e.target.value })}
                        placeholder="Поиск товара..."
                        className="h-10 w-full rounded-md border border-input bg-card pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:w-64"
                      />
                    </div>
                    <select 
                      value={filter.category}
                      onChange={e => setFilter({ ...filter, category: e.target.value })}
                      className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    >
                      <option value="all">Все категории</option>
                      {parentCategories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                    <select 
                      value={filter.stockStatus}
                      onChange={e => setFilter({ ...filter, stockStatus: e.target.value as any })}
                      className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    >
                      <option value="all">Все остатки</option>
                      <option value="normal">В наличии</option>
                      <option value="low">Заканчиваются</option>
                      <option value="out">Нет на складе</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-5">
                {productsQuery.isLoading ? (
                  <div className="py-12 text-center text-muted-foreground">Загрузка...</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="py-12 text-center">
                    <Package className="mx-auto size-12 text-muted-foreground/40" />
                    <p className="mt-3 text-sm font-semibold">Товары не найдены</p>
                    <p className="mt-1 text-xs text-muted-foreground">Измените параметры поиска</p>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3 hidden grid-cols-6 gap-4 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
                      <div className="col-span-3">Товар</div>
                      <div className="text-right">Цена</div>
                      <div className="text-right">Остаток</div>
                      <div></div>
                    </div>
                    {filteredProducts.map(product => (
                      <ProductStockRow 
                        key={product.id} 
                        product={product}
                        onEdit={setEditingProduct}
                        onDelete={handleDeleteProduct}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Movements */}
          <div>
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold">Последние операции</h2>
                  <button className="rounded-md p-2 text-muted-foreground hover:bg-muted">
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-border">
                {movements.map(movement => {
                  const iconColors = {
                    in: 'bg-[#dcebd9] text-[#326342]',
                    out: 'bg-[#fef3c7] text-[#92400e]',
                    adjustment: 'bg-muted text-muted-foreground',
                  };
                  const icons = {
                    in: ArrowUpRight,
                    out: ArrowDownRight,
                    adjustment: RefreshCw,
                  };
                  const Icon = icons[movement.type];
                  
                  return (
                    <div key={movement.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`grid size-9 shrink-0 place-items-center rounded-lg ${iconColors[movement.type]}`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{movement.productName}</p>
                          <p className="truncate text-xs text-muted-foreground">{movement.reason}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className={`font-mono text-xs font-bold ${movement.type === 'in' ? 'text-[#326342]' : movement.type === 'out' ? 'text-[#dc2626]' : 'text-muted-foreground'}`}>
                              {movement.type === 'in' ? '+' : movement.type === 'out' ? '-' : ''}{movement.quantity} шт.
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(movement.createdAt).toLocaleDateString('ru-RU')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border p-4">
                <button className="w-full rounded-md border border-border bg-card py-2 text-xs font-semibold hover:bg-muted">
                  Показать все операции
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-display text-base font-bold">Быстрые действия</h3>
              <div className="mt-4 space-y-2">
                <button className="flex w-full items-center gap-3 rounded-md border border-border bg-card p-3 text-left text-sm font-semibold transition hover:bg-muted">
                  <Download size={16} className="text-muted-foreground" />
                  Выгрузить остатки (CSV)
                </button>
                <button className="flex w-full items-center gap-3 rounded-md border border-border bg-card p-3 text-left text-sm font-semibold transition hover:bg-muted">
                  <Calendar size={16} className="text-muted-foreground" />
                  План инвентаризации
                </button>
                <button className="flex w-full items-center gap-3 rounded-md border border-border bg-card p-3 text-left text-sm font-semibold transition hover:bg-muted">
                  <Filter size={16} className="text-muted-foreground" />
                  Настроить автозаказ
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showMovementForm && (
        <StockMovementForm 
          products={products}
          onSubmit={handleAddMovement}
          onCancel={() => setShowMovementForm(false)}
        />
      )}
    </AppShell>
  );
}

export default WarehousePage;
