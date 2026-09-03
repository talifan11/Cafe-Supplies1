import { useEffect, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Link, Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  getGetOrderSummaryQueryKey,
  getListOrdersQueryKey,
  getListProductsQueryKey,
  useAdminLogin,
  useAdminLogout,
  useCreateOrder,
  useGetOrderSummary,
  useListCategories,
  useListOrders,
  useListProducts,
  useUpdateOrderStatus,
} from "@workspace/api-client-react";
import type { Order, OrderInput, OrderStatus, Product } from "@workspace/api-client-react";
import { ArrowRight, Check, ChevronDown, ClipboardList, Clock3, Minus, Package, Plus, Search, ShoppingBag, Sparkles, Truck, X } from "lucide-react";
import NotFound from "@/pages/not-found";
import { CatalogManager } from "@/components/catalog-manager";

type CartLine = { product: Product; quantity: number };
type CheckoutForm = Pick<OrderInput, "clientName" | "phone" | "address">;

const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const statusLabels: Record<OrderStatus, string> = { new: "Новый", picking: "На сборке", delivery: "В доставке", completed: "Выполнен" };
const statusIcons: Record<OrderStatus, typeof Clock3> = { new: Clock3, picking: Package, delivery: Truck, completed: Check };

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand" data-testid="link-home">
          <span className="brand-mark"><Sparkles size={18} /></span>
          <span><strong>Поставка</strong><small>расходники для кафе</small></span>
        </Link>
        <nav className="main-nav" aria-label="Основная навигация">
          <Link href="/" className={location === "/" ? "nav-link active" : "nav-link"} data-testid="link-catalog">Каталог</Link>
          <Link href="/admin" className={location === "/admin" ? "nav-link active" : "nav-link"} data-testid="link-admin">Заказы</Link>
        </nav>
        <div className="topbar-note"><span className="online-dot" /> Отгружаем каждый день</div>
      </header>
      {children}
      <footer className="footer"><span>Поставка / 2026</span><span>Всё нужное для рабочей смены</span></footer>
    </div>
  );
}

function ProductCard({ product, onAdd, cartQuantity }: { product: Product; onAdd: (product: Product) => void; cartQuantity: number }) {
  return (
    <article className="product-card" data-testid={`card-product-${product.id}`}>
      <div className={`product-image category-${product.category}`}><img src={product.imageUrl} alt="" /><span>{product.category}</span></div>
      <div className="product-content">
        <div className="stock-line"><span className={product.quantity < 10 ? "stock low" : "stock"}>{product.quantity < 10 ? "Заканчивается" : "В наличии"}</span><span>{product.quantity} шт.</span></div>
        <h3 data-testid={`text-product-name-${product.id}`}>{product.name}</h3>
        {product.description && <p className="product-description">{product.description}</p>}
        <div className="product-bottom"><strong data-testid={`text-price-${product.id}`}>{currency.format(product.price)}</strong><button className={cartQuantity ? "add-button added" : "add-button"} onClick={() => onAdd(product)} data-testid={`button-add-product-${product.id}`}>{cartQuantity ? <><Check size={16} /> В корзине · {cartQuantity}</> : <><Plus size={16} /> В корзину</>}</button></div>
      </div>
    </article>
  );
}

function Cart({ cart, setCart, onCheckout }: { cart: CartLine[]; setCart: Dispatch<SetStateAction<CartLine[]>>; onCheckout: () => void }) {
  const total = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const changeQuantity = (id: number, delta: number) => setCart((lines) => lines.map((line) => line.product.id === id ? { ...line, quantity: Math.min(line.product.quantity, Math.max(0, line.quantity + delta)) } : line).filter((line) => line.quantity > 0));
  return (
    <aside className="cart-panel">
      <div className="cart-heading"><div><span className="eyebrow">Ваш заказ</span><h2>Корзина <em>{itemCount}</em></h2></div><ShoppingBag size={22} /></div>
      {cart.length === 0 ? <div className="cart-empty"><ShoppingBag size={30} /><p>Добавьте товары,<br />которые нужны на смену</p></div> : <div className="cart-lines">
        {cart.map((line) => <div className="cart-line" key={line.product.id} data-testid={`cart-line-${line.product.id}`}><div><strong>{line.product.name}</strong><span>{currency.format(line.product.price)} / шт.</span></div><div className="quantity-control"><button onClick={() => changeQuantity(line.product.id, -1)} aria-label="Уменьшить" data-testid={`button-decrease-${line.product.id}`}><Minus size={13} /></button><span data-testid={`text-quantity-${line.product.id}`}>{line.quantity}</span><button onClick={() => changeQuantity(line.product.id, 1)} aria-label="Увеличить" data-testid={`button-increase-${line.product.id}`}><Plus size={13} /></button></div></div>)}
      </div>}
      <div className="cart-total"><span>Итого</span><strong data-testid="text-cart-total">{currency.format(total)}</strong></div>
      <button className="primary-button cart-checkout" disabled={!cart.length} onClick={onCheckout} data-testid="button-checkout">Оформить заказ <ArrowRight size={17} /></button>
      <p className="cart-caption">Доставка по городу от 5 000 ₽ — бесплатно</p>
    </aside>
  );
}

function CheckoutModal({ cart, onClose, onSuccess }: { cart: CartLine[]; onClose: () => void; onSuccess: (id: number) => void }) {
  const mutation = useCreateOrder();
  const form = useForm<CheckoutForm>({ defaultValues: { clientName: "", phone: "", address: "" } });
  const submit = (values: CheckoutForm) => mutation.mutate({ data: { ...values, items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })) } }, { onSuccess: (result) => onSuccess(result.orderId) });
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="checkout-modal"><button className="close-button" onClick={onClose} aria-label="Закрыть" data-testid="button-close-checkout"><X size={18} /></button><span className="eyebrow">Последний шаг</span><h2>Куда привезти заказ?</h2><p className="modal-intro">Оставьте контакты — менеджер подтвердит время доставки по телефону.</p><Form {...form}><form onSubmit={form.handleSubmit(submit)} className="checkout-form">
    <FormField control={form.control} name="clientName" rules={{ required: "Введите имя" }} render={({ field }) => <FormItem><FormLabel>Имя и компания</FormLabel><FormControl><input {...field} placeholder="Например, Анна / Кафе «Листья»" data-testid="input-client-name" /></FormControl><FormMessage /></FormItem>} />
    <FormField control={form.control} name="phone" rules={{ required: "Введите телефон", minLength: { value: 5, message: "Проверьте номер" } }} render={({ field }) => <FormItem><FormLabel>Телефон</FormLabel><FormControl><input {...field} placeholder="+7 (___) ___-__-__" data-testid="input-phone" /></FormControl><FormMessage /></FormItem>} />
    <FormField control={form.control} name="address" rules={{ required: "Введите адрес", minLength: { value: 5, message: "Укажите адрес подробнее" } }} render={({ field }) => <FormItem><FormLabel>Адрес доставки</FormLabel><FormControl><textarea {...field} placeholder="Улица, дом, вход, удобное время" rows={3} data-testid="input-address" /></FormControl><FormMessage /></FormItem>} />
    <button className="primary-button" type="submit" disabled={mutation.isPending} data-testid="button-submit-order">{mutation.isPending ? "Отправляем..." : <>Подтвердить заказ <ArrowRight size={17} /></>}</button>
    {mutation.isError && <p className="form-error">Не удалось оформить заказ. Попробуйте ещё раз.</p>}
  </form></Form></div></div>;
}

function OrderSuccess({ orderId, onContinue }: { orderId: number; onContinue: () => void }) {
  return <div className="success-screen"><div className="success-icon"><Check size={26} /></div><span className="eyebrow">Заказ принят</span><h2>Спасибо! Заказ №{orderId}</h2><p>Менеджер свяжется с вами в ближайшее время и уточнит детали доставки.</p><button className="primary-button" onClick={onContinue} data-testid="button-continue-shopping">Вернуться в каталог <ArrowRight size={17} /></button></div>;
}

function Catalog() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [cart, setCart] = useState<CartLine[]>(() => { try { return JSON.parse(localStorage.getItem("cafe-cart") || "[]"); } catch { return []; } });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [successId, setSuccessId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const productsQuery = useListProducts({ search: search || undefined, category: category || undefined, subcategory: subcategory || undefined });
  const categoriesQuery = useListCategories();
  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const parentCategories = categories.filter((item) => item.parentId === null);
  const selectedCategory = parentCategories.find((item) => item.name === category);
  const subcategories = selectedCategory ? categories.filter((item) => item.parentId === selectedCategory.id) : [];
  useEffect(() => { localStorage.setItem("cafe-cart", JSON.stringify(cart)); }, [cart]);
  const addProduct = (product: Product) => setCart((lines) => { const found = lines.find((line) => line.product.id === product.id); return found ? lines.map((line) => line.product.id === product.id ? { ...line, quantity: Math.min(product.quantity, line.quantity + 1) } : line) : [...lines, { product, quantity: 1 }]; });
  const selectedCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const onSuccess = (id: number) => { setCart([]); setCheckoutOpen(false); setSuccessId(id); queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetOrderSummaryQueryKey() }); };
  if (successId) return <main className="success-wrap"><OrderSuccess orderId={successId} onContinue={() => setSuccessId(null)} /></main>;
  return <main className="catalog-page"><section className="catalog-hero"><div><span className="eyebrow">Поставка для HoReCa</span><h1>Всё, что нужно<br /><i>для рабочей смены.</i></h1><p>Расходные материалы с доставкой в удобное для вас время. Соберём заказ сегодня — привезём завтра.</p></div><div className="hero-stamp"><span>01</span><small>закажите<br />до 18:00</small></div></section>
     <section className="catalog-layout"><div className="catalog-main"><div className="catalog-toolbar"><div className="search-wrap"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти товар..." aria-label="Поиск товаров" data-testid="input-search" /></div><div className="category-tabs"><button className={!category ? "category-tab active" : "category-tab"} onClick={() => { setCategory(""); setSubcategory(""); }} data-testid="button-category-all">Все товары</button>{parentCategories.map((item) => <button key={item.id} className={category === item.name ? "category-tab active" : "category-tab"} onClick={() => { setCategory(item.name); setSubcategory(""); }} data-testid={`button-category-${item.name}`}>{item.name}</button>)}</div></div>
       {subcategories.length > 0 && <div className="subcategory-panel" aria-label={`Подкатегории раздела ${category}`}><div className="subcategory-heading"><span className="subcategory-marker" /><span><strong>Раздел {category}</strong><small>Выберите, что нужно найти</small></span></div><div className="subcategory-tabs"><button className={!subcategory ? "subcategory-tab active" : "subcategory-tab"} onClick={() => setSubcategory("")} data-testid="button-subcategory-all">Все в разделе</button>{subcategories.map((item) => <button key={item.id} className={subcategory === item.name ? "subcategory-tab active" : "subcategory-tab"} onClick={() => setSubcategory(item.name)} data-testid={`button-subcategory-${item.name}`}>{item.name}</button>)}</div></div>}
       <div className="results-line"><span>{search || category || subcategory ? `Найдено: ${products.length}` : "Популярное для кухни"} </span><span>Обновлено сегодня <span className="online-dot" /></span></div>
      {productsQuery.isLoading ? <div className="loading-state">Загружаем каталог...</div> : products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} onAdd={addProduct} cartQuantity={cart.find((line) => line.product.id === product.id)?.quantity ?? 0} />)}</div> : <div className="empty-state"><Search size={24} /><h3>Ничего не нашли</h3><p>Попробуйте изменить запрос или выбрать другую категорию.</p></div>}
    </div><Cart cart={cart} setCart={setCart} onCheckout={() => setCheckoutOpen(true)} /></section>
    {selectedCount > 0 && <button className="mobile-cart-button" onClick={() => setCheckoutOpen(true)} data-testid="button-mobile-cart"><ShoppingBag size={17} /> Корзина · {selectedCount} <strong>{currency.format(cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0))}</strong></button>}
    {checkoutOpen && <CheckoutModal cart={cart} onClose={() => setCheckoutOpen(false)} onSuccess={onSuccess} />}
  </main>;
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const loginMutation = useAdminLogin();
  const submit = (event: FormEvent) => { event.preventDefault(); setError(""); loginMutation.mutate({ data: { login, password } }, { onSuccess: onLogin, onError: () => setError("Неверный логин или пароль") }); };
  return <main className="admin-login"><div className="login-card"><span className="brand-mark"><Sparkles size={18} /></span><span className="eyebrow">Панель менеджера</span><h1>С возвращением.</h1><p>Войдите, чтобы управлять заказами и каталогом.</p><form onSubmit={submit}><label>Логин<input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" data-testid="input-admin-login" /></label><label>Пароль<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" data-testid="input-admin-password" /></label>{error && <span className="form-error">{error}</span>}<button className="primary-button" type="submit" disabled={loginMutation.isPending} data-testid="button-admin-login">{loginMutation.isPending ? "Проверяем..." : <>Войти <ArrowRight size={17} /></>}</button></form><small>Доступ для менеджера</small></div></main>;
}

function Admin() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const queryClient = useQueryClient();
  const logoutMutation = useAdminLogout();
  const orderParams = { status: (statusFilter || undefined) as "new" | "picking" | "delivery" | "completed" | undefined };
  const ordersQuery = useListOrders(orderParams, { query: { queryKey: getListOrdersQueryKey(orderParams), enabled: loggedIn } });
  const summaryQuery = useGetOrderSummary({ query: { queryKey: getGetOrderSummaryQueryKey(), enabled: loggedIn } });
  const updateStatus = useUpdateOrderStatus();
  const orders = ordersQuery.data ?? [];
  const summary = summaryQuery.data;
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/session").then((response) => {
      if (active && response.ok) setLoggedIn(true);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!loggedIn) return <AdminLogin onLogin={() => setLoggedIn(true)} />;
  const changeStatus = (order: Order, status: OrderStatus) => updateStatus.mutate({ id: order.id, data: { status } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetOrderSummaryQueryKey() }); } });
  const summaryCards: Array<{ label: string; value: ReactNode; icon: typeof ClipboardList }> = [
    { label: "Всего заказов", value: summary?.totalOrders ?? 0, icon: ClipboardList },
    { label: "Новые", value: summary?.newOrders ?? 0, icon: Clock3 },
    { label: "В работе", value: (summary?.pickingOrders ?? 0) + (summary?.deliveryOrders ?? 0), icon: Truck },
    { label: "Выручка", value: currency.format(summary?.totalRevenue ?? 0), icon: ShoppingBag },
  ];
  return <main className="admin-page"><section className="admin-heading"><div><span className="eyebrow">Операционная панель</span><h1>Заказы</h1><p>Следите за сборкой и доставкой в одном месте.</p></div><button className="outline-button" onClick={() => logoutMutation.mutate(undefined, { onSuccess: () => setLoggedIn(false) })} data-testid="button-admin-logout">Выйти</button></section>
    <section className="summary-grid">{summaryCards.map(({ label, value, icon: Icon }) => <div className="summary-card" key={label}><Icon size={18} /><span>{label}</span><strong data-testid={`summary-${label}`}>{value}</strong></div>)}</section>
    <section className="orders-card"><div className="orders-toolbar"><h2>Все заказы</h2><div className="status-filter">{["", "new", "picking", "delivery", "completed"].map((item) => <button key={item || "all"} className={statusFilter === item ? "filter-pill active" : "filter-pill"} onClick={() => setStatusFilter(item)} data-testid={`button-filter-${item || "all"}`}>{item ? statusLabels[item as OrderStatus] : "Все"}</button>)}</div></div>
      {ordersQuery.isLoading ? <div className="loading-state">Загружаем заказы...</div> : orders.length === 0 ? <div className="empty-state"><ClipboardList size={24} /><h3>Заказов пока нет</h3><p>Новые заказы клиентов появятся здесь.</p></div> : <div className="orders-list">{orders.map((order) => { const Icon = statusIcons[order.status]; return <div className="order-row" key={order.id} data-testid={`row-order-${order.id}`}><div className="order-number">№{String(order.id).padStart(4, "0")}<small>{new Date(order.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}</small></div><div className="order-client"><strong>{order.clientName}</strong><span>{order.phone} · {order.address}</span><small>{order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ")}</small></div><strong className="order-total">{currency.format(order.totalSum)}</strong><div className={`status-badge status-${order.status}`}><Icon size={14} />{statusLabels[order.status]}</div><div className="status-select-wrap"><select value={order.status} onChange={(event) => changeStatus(order, event.target.value as OrderStatus)} disabled={updateStatus.isPending} aria-label={`Статус заказа ${order.id}`} data-testid={`select-status-${order.id}`}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={14} /></div></div>; })}</div>}
     </section><CatalogManager /></main>;
}

function Router() {
  return <AppShell><Switch><Route path="/" component={Catalog} /><Route path="/admin" component={Admin} /><Route component={NotFound} /></Switch></AppShell>;
}

const queryClient = new QueryClient();

export default function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}