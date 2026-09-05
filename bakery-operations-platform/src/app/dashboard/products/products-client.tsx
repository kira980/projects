"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createCategory,
  createProduct,
  updateProduct,
  setProductActive,
  deleteProduct,
} from "./actions";
import { formatMoney } from "@/lib/format";

export type CategoryRow = { id: string; name: string };
export type ProductRow = {
  id: string;
  name: string;
  name_ar: string;
  category_id: string | null;
  unit_type: string;
  default_price: number;
  is_active: boolean;
};

const UNIT_LABELS: Record<string, string> = {
  unit: "יחידה",
  kg: 'ק"ג',
  tray: "מגש",
  box: "ארגז",
  package: "חבילה",
};

function ProductDialog({
  product,
  categories,
  trigger,
}: {
  product?: ProductRow;
  categories: CategoryRow[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = product
      ? await updateProduct(product.id, formData)
      : await createProduct(formData);
    setPending(false);
    if (result.ok) {
      toast.success(product ? "המוצר עודכן" : "המוצר נוסף");
      setOpen(false);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "עריכת מוצר" : "מוצר חדש"}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4" autoComplete="off">
          <div className="grid gap-2">
            <Label htmlFor="name">שם המוצר *</Label>
            <Input id="name" name="name" defaultValue={product?.name} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name_ar">שם בערבית (למסך ההכנות) *</Label>
            <Input
              id="name_ar"
              name="name_ar"
              dir="rtl"
              lang="ar"
              required
              defaultValue={product?.name_ar ?? ""}
              placeholder="الاسم بالعربية"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>קטגוריה</Label>
              <Select
                name="category_id"
                defaultValue={product?.category_id ?? undefined}
              >
                <SelectTrigger>
                  <SelectValue placeholder="ללא קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>יחידת מידה</Label>
              <Select name="unit_type" defaultValue={product?.unit_type ?? "unit"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(UNIT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="default_price">מחיר ברירת מחדל (₪) *</Label>
            <Input
              id="default_price"
              name="default_price"
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              defaultValue={product?.default_price}
              required
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "שומר..." : "שמירה"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProductsClient({
  products,
  categories,
}: {
  products: ProductRow[];
  categories: CategoryRow[];
}) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  async function onCreateCategory(formData: FormData) {
    setPending(true);
    const result = await createCategory(formData);
    setPending(false);
    if (result.ok) {
      toast.success("הקטגוריה נוספה");
      setCategoryOpen(false);
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  async function onToggleActive(product: ProductRow, next: boolean) {
    const result = await setProductActive(product.id, next);
    if (result.ok) toast.success(next ? "המוצר הופעל" : "המוצר הוסתר");
    else toast.error(result.error ?? "שגיאה");
  }

  async function onDelete(product: ProductRow) {
    if (!confirm(`למחוק את המוצר "${product.name}"? לא ניתן לבטל פעולה זו.`)) return;
    const result = await deleteProduct(product.id);
    if (result.ok) toast.success("המוצר נמחק");
    else toast.error(result.error ?? "שגיאה");
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">מוצרים ותפריט</h1>
        <div className="flex gap-2">
          <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FolderPlus className="size-4" />
                קטגוריה חדשה
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>קטגוריה חדשה</DialogTitle>
              </DialogHeader>
              <form action={onCreateCategory} className="grid gap-4" autoComplete="off">
                <div className="grid gap-2">
                  <Label htmlFor="cat_name">שם הקטגוריה *</Label>
                  <Input id="cat_name" name="name" required />
                </div>
                <Button type="submit" disabled={pending}>
                  {pending ? "שומר..." : "שמירה"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <ProductDialog
            categories={categories}
            trigger={
              <Button>
                <Plus className="size-4" />
                מוצר חדש
              </Button>
            }
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>מוצר</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>יחידה</TableHead>
              <TableHead>מחיר</TableHead>
              <TableHead>פעיל</TableHead>
              <TableHead className="w-28">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  אין מוצרים עדיין — הוסיפו מוצר ראשון
                </TableCell>
              </TableRow>
            )}
            {products.map((p) => (
              <TableRow key={p.id} className={p.is_active ? "" : "opacity-50"}>
                <TableCell className="font-medium">
                  {p.name}
                  {p.name_ar ? (
                    <span className="block text-xs font-normal text-muted-foreground" dir="rtl">
                      {p.name_ar}
                    </span>
                  ) : (
                    // Legacy rows only — the form now requires it.
                    <span className="block text-xs font-normal text-destructive">
                      חסר שם בערבית
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {p.category_id ? (categoryNames.get(p.category_id) ?? "—") : "—"}
                </TableCell>
                <TableCell>{UNIT_LABELS[p.unit_type] ?? p.unit_type}</TableCell>
                <TableCell>{formatMoney(p.default_price)}</TableCell>
                <TableCell>
                  <Switch
                    checked={p.is_active}
                    onCheckedChange={(next) => onToggleActive(p, next)}
                    aria-label="פעיל"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <ProductDialog
                      product={p}
                      categories={categories}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="עריכה">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="מחיקה"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(p)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
