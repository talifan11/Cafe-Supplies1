import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { Check, Edit3, FolderPlus, ImagePlus, LoaderCircle, Plus, Save, Trash2, X } from "lucide-react";
import {
  getListCategoriesQueryKey,
  getListProductsQueryKey,
  useCreateCategory,
  useCreateProduct,
  useDeleteCategory,
  useDeleteProduct,
  useListCategories,
  useListProducts,
  useUpdateCategory,
  useUpdateProduct,
} from "@workspace/api-client-react";
import type { Category, Product } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { useQueryClient } from "@tanstack/react-query";

type ProductFormValues = {
  name: string;
  description: string;
  price: string;
  quantity: string;
  category: string;
  subcategory: string;
  imageUrl: string;
};

const emptyProduct: ProductFormValues = {
  name: "",
  description: "",
  price: "",
  quantity: "0",
  category: "",
  subcategory: "",
  imageUrl: "",
};

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = error.data;
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") return data.error;
  }
  return fallback;
}

function ProductEditor({ product, categories, onDone }: { product: Product | null; categories: Category[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const [formError, setFormError] = useState("");
  const form = useForm<ProductFormValues>({ defaultValues: emptyProduct });
  const category = form.watch("category");
  const { uploadFile, isUploading, error: uploadError } = useUpload({
    onSuccess: (result) => form.setValue("imageUrl", `/api/storage${result.objectPath}`, { shouldDirty: true }),
  });

  useEffect(() => {
    form.reset(product ? {
      name: product.name,
      description: product.description,
      price: String(product.price),
      quantity: String(product.quantity),
      category: product.category,
      subcategory: product.subcategory,
      imageUrl: product.imageUrl,
    } : emptyProduct);
    setFormError("");
  }, [product, form]);

  const parentCategories = categories.filter((item) => item.parentId === null);
  const subcategories = categories.filter((item) => {
    const parent = categories.find((categoryItem) => categoryItem.id === item.parentId);
    return parent?.name === category;
  });
  const pending = createProduct.isPending || updateProduct.isPending;

  const submit = (values: ProductFormValues) => {
    const price = Number(values.price);
    const quantity = Number(values.quantity);
    if (!values.name.trim() || !values.category || !values.imageUrl || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 0) {
      setFormError("Заполните название, категорию, фото, цену и целое количество.");
      return;
    }
    const data = {
      name: values.name.trim(),
      description: values.description.trim(),
      price,
      quantity,
      category: values.category,
      subcategory: values.subcategory,
      imageUrl: values.imageUrl,
    };
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      onDone();
    };
    if (product) {
      updateProduct.mutate({ id: product.id, data }, { onSuccess, onError: (error) => setFormError(errorMessage(error, "Не удалось обновить товар.")) });
    } else {
      createProduct.mutate({ data }, { onSuccess, onError: (error) => setFormError(errorMessage(error, "Не удалось добавить товар.")) });
    }
  };

  return (
    <form className="catalog-editor" onSubmit={form.handleSubmit(submit)}>
      <div className="editor-title-row">
        <div><span className="eyebrow">{product ? "Редактирование" : "Новый товар"}</span><h3>{product ? product.name : "Добавить в каталог"}</h3></div>
        {product && <button type="button" className="icon-button" onClick={onDone} aria-label="Закрыть редактор"><X size={17} /></button>}
      </div>
      <div className="editor-grid">
        <label>Название<input {...form.register("name")} placeholder="Например, Стаканы 300 мл" /></label>
        <label>Цена, ₽<input {...form.register("price")} inputMode="decimal" placeholder="890" /></label>
        <label>Остаток, шт.<input {...form.register("quantity")} inputMode="numeric" placeholder="50" /></label>
        <label>Категория<select {...form.register("category")}><option value="">Выберите категорию</option>{parentCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
        <label>Подкатегория<select {...form.register("subcategory")} disabled={!category}><option value="">Без подкатегории</option>{subcategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
        <label className="editor-wide">Описание<textarea {...form.register("description")} rows={3} placeholder="Коротко о товаре, размере и назначении" /></label>
        <div className="editor-wide image-upload-field">
          <span className="field-label">Фото товара</span>
          <div className="image-upload-row">
            <div className="image-preview">{form.watch("imageUrl") ? <img src={form.watch("imageUrl")} alt="Предпросмотр товара" /> : <ImagePlus size={23} />}</div>
            <div><input id="product-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file); }} disabled={isUploading} /><label className="outline-button upload-label" htmlFor="product-image">{isUploading ? <><LoaderCircle className="spin" size={15} /> Загружаем...</> : <><ImagePlus size={15} /> Загрузить фото</>}</label><small>JPG, PNG или WebP до 5 МБ</small></div>
          </div>
          {uploadError && <span className="form-error">{uploadError.message}</span>}
        </div>
      </div>
      {formError && <p className="form-error editor-error">{formError}</p>}
      <button className="primary-button" type="submit" disabled={pending || isUploading}>{pending ? <><LoaderCircle className="spin" size={16} /> Сохраняем...</> : product ? <><Save size={16} /> Сохранить изменения</> : <><Plus size={16} /> Добавить товар</>}</button>
    </form>
  );
}

function CategoryManager({ categories }: { categories: Category[] }) {
  const queryClient = useQueryClient();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [message, setMessage] = useState("");
  const parents = categories.filter((item) => item.parentId === null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });

  const addCategory = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    createCategory.mutate({ data: { name: name.trim(), parentId: parentId ? Number(parentId) : null } }, {
      onSuccess: () => { setName(""); setParentId(""); setMessage("Категория добавлена."); refresh(); },
      onError: (error) => setMessage(errorMessage(error, "Не удалось добавить категорию.")),
    });
  };

  const saveCategory = (item: Category) => {
    if (!editingName.trim()) return;
    updateCategory.mutate({ id: item.id, data: { name: editingName.trim() } }, {
      onSuccess: () => { setEditing(null); setMessage("Название обновлено."); refresh(); queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); },
      onError: (error) => setMessage(errorMessage(error, "Не удалось изменить категорию.")),
    });
  };

  return <section className="category-manager">
    <div className="manager-section-heading"><div><span className="eyebrow">Структура каталога</span><h3>Категории и подкатегории</h3></div><FolderPlus size={20} /></div>
    <form className="category-create" onSubmit={addCategory}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Название новой категории" /><select value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">Категория верхнего уровня</option>{parents.map((item) => <option key={item.id} value={item.id}>Подкатегория для: {item.name}</option>)}</select><button className="outline-button" type="submit" disabled={createCategory.isPending}><Plus size={15} /> Добавить</button></form>
    {message && <p className="manager-message">{message}</p>}
    <div className="category-list">{categories.map((item) => <div className={item.parentId === null ? "category-row parent" : "category-row"} key={item.id}><span className="category-dot" />{editing === item.id ? <input className="category-edit-input" value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus /> : <span>{item.parentId === null ? item.name : <><b>{categories.find((parent) => parent.id === item.parentId)?.name} / </b>{item.name}</>}</span>}<div className="row-actions">{editing === item.id ? <button className="icon-button" onClick={() => saveCategory(item)} aria-label="Сохранить"><Check size={15} /></button> : <button className="icon-button" onClick={() => { setEditing(item.id); setEditingName(item.name); }} aria-label="Редактировать"><Edit3 size={15} /></button>}<button className="icon-button danger" onClick={() => { if (window.confirm(`Удалить «${item.name}»? Товары сначала нужно переназначить.`)) deleteCategory.mutate({ id: item.id }, { onSuccess: refresh, onError: (error) => setMessage(errorMessage(error, "Категория используется товарами.")) }); }} aria-label="Удалить"><Trash2 size={15} /></button></div></div>)}</div>
  </section>;
}

export function CatalogManager() {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  const productsQuery = useListProducts();
  const categoriesQuery = useListCategories();
  const deleteProduct = useDeleteProduct();
  const [message, setMessage] = useState("");
  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const productCountLabel = useMemo(() => `${products.length} ${products.length === 1 ? "товар" : "товаров"}`, [products.length]);

  const remove = (product: Product) => {
    if (!window.confirm(`Удалить товар «${product.name}»?`)) return;
    deleteProduct.mutate({ id: product.id }, {
      onSuccess: () => { setMessage("Товар удалён."); queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); },
      onError: (error) => setMessage(errorMessage(error, "Товар уже используется в заказах и не может быть удалён.")),
    });
  };

  const closeEditor = () => { setCreating(false); setEditingProduct(null); };

  return <section className="catalog-manager">
    <div className="manager-section-heading catalog-manager-heading"><div><span className="eyebrow">Управление ассортиментом</span><h2>Каталог <em>{productCountLabel}</em></h2><p>Добавляйте товары, фото, цены и остатки без обращения к разработчику.</p></div><button className="primary-button" onClick={() => { setCreating(true); setEditingProduct(null); }}><Plus size={16} /> Новый товар</button></div>
    {message && <p className="manager-message">{message}</p>}
    {(creating || editingProduct) && <ProductEditor product={editingProduct} categories={categories} onDone={closeEditor} />}
    {productsQuery.isLoading ? <div className="loading-state">Загружаем каталог...</div> : <div className="product-admin-table"><div className="product-admin-head"><span>Товар</span><span>Категория</span><span>Цена</span><span>Остаток</span><span /></div>{products.map((product) => <div className="product-admin-row" key={product.id}><div className="admin-product-name"><img src={product.imageUrl} alt="" /><span><strong>{product.name}</strong><small>{product.description || "Без описания"}</small></span></div><span>{product.category}{product.subcategory && ` / ${product.subcategory}`}</span><strong>{new Intl.NumberFormat("ru-RU").format(product.price)} ₽</strong><span>{product.quantity} шт.</span><div className="row-actions"><button className="icon-button" onClick={() => { setEditingProduct(product); setCreating(false); }} aria-label={`Редактировать ${product.name}`}><Edit3 size={15} /></button><button className="icon-button danger" onClick={() => remove(product)} aria-label={`Удалить ${product.name}`}><Trash2 size={15} /></button></div></div>)}</div>}
    <CategoryManager categories={categories} />
  </section>;
}