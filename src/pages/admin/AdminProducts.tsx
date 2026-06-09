import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Star, Trash2, RefreshCw, ImagePlus } from "lucide-react";
import AdminLayout from "@/layouts/AdminLayout";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  is_featured: boolean;
  is_hidden: boolean;
  image_url?: string;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "visible" | "hidden"
  >("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,price,stock,category,is_featured,is_hidden,image_url")
      .eq("product_status", "approved")
      .order("name");

    if (error) {
      toast({
        title: "Unable to load products",
        description: error.message,
        variant: "destructive",
      });
      setProducts([]);
    } else if (data) {
      setProducts(data);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const deleteProduct = async (id: string) => {
    const confirmed = window.confirm("Delete this product?");
    if (!confirmed) return;

    setActionLoading(id);
    const { error } = await supabase.from("products").delete().eq("id", id);

    setActionLoading(null);
    if (error) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Product removed",
        description: "The product was deleted successfully.",
      });
      fetchProducts();
    }
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    setActionLoading(id);
    const { error } = await supabase
      .from("products")
      .update({ is_featured: !current })
      .eq("id", id);

    setActionLoading(null);
    if (error) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: current ? "Removed featured" : "Marked featured",
        description: `Product is now ${current ? "regular" : "featured"}.`,
      });
      fetchProducts();
    }
  };

  const toggleHidden = async (id: string, current: boolean) => {
    setActionLoading(id);
    const { error } = await supabase
      .from("products")
      .update({ is_hidden: !current })
      .eq("id", id);

    setActionLoading(null);
    if (error) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: current ? "Product visible" : "Product hidden",
        description: `Product visibility set to ${current ? "visible" : "hidden"}.`,
      });
      fetchProducts();
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = [product.name, product.category]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "visible" && !product.is_hidden) ||
        (statusFilter === "hidden" && product.is_hidden);

      return matchesSearch && matchesStatus;
    });
  }, [products, searchTerm, statusFilter]);

  const totals = useMemo(
    () => ({
      total: products.length,
      featured: products.filter((product) => product.is_featured).length,
      hidden: products.filter((product) => product.is_hidden).length,
      visible: products.filter((product) => !product.is_hidden).length,
    }),
    [products],
  );

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-900">Products</h1>
            <p className="text-gray-600 mt-2">
              Manage approved products, adjust visibility, and feature top
              items.
            </p>
          </div>
          <Button variant="outline" onClick={fetchProducts} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh list
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products..."
          />
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "visible" | "hidden")
            }
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All products</option>
            <option value="visible">Visible only</option>
            <option value="hidden">Hidden only</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-200 bg-white p-5">
            <CardHeader>
              <CardTitle>Total</CardTitle>
              <CardDescription>{totals.total} active products</CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-slate-200 bg-white p-5">
            <CardHeader>
              <CardTitle>Featured</CardTitle>
              <CardDescription>{totals.featured} products</CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-slate-200 bg-white p-5">
            <CardHeader>
              <CardTitle>Visible</CardTitle>
              <CardDescription>{totals.visible} products</CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-slate-200 bg-white p-5">
            <CardHeader>
              <CardTitle>Hidden</CardTitle>
              <CardDescription>{totals.hidden} products</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">
              Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">
              No products match your search or filter.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <Card key={product.id} className="border-slate-200 bg-white">
                  <CardContent className="space-y-4 pt-4">
                    <div className="flex items-center gap-4">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-20 w-20 rounded-3xl object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
                          <ImagePlus className="h-6 w-6" />
                        </div>
                      )}
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {product.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {product.category}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Price
                        </p>
                        <p className="mt-2 font-semibold text-slate-900">
                          ₹{product.price}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Stock
                        </p>
                        <p className="mt-2 font-semibold text-slate-900">
                          {product.stock}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={product.is_featured ? "default" : "secondary"}
                      >
                        {product.is_featured ? "Featured" : "Standard"}
                      </Badge>
                      <Badge
                        variant={product.is_hidden ? "destructive" : "outline"}
                      >
                        {product.is_hidden ? "Hidden" : "Visible"}
                      </Badge>
                    </div>
                  </CardContent>

                  <CardFooter className="flex flex-wrap gap-2">
                    <Link
                      to={`/products/${encodeURIComponent(product.category)}/${encodeURIComponent(
                        product.name,
                      )}`}
                      className="min-w-[105px]"
                    >
                      <Button variant="outline" size="sm" className="w-full">
                        View
                      </Button>
                    </Link>
                    <Button
                      variant={product.is_featured ? "secondary" : "default"}
                      size="sm"
                      onClick={() =>
                        toggleFeatured(product.id, product.is_featured)
                      }
                      disabled={actionLoading === product.id}
                      className="min-w-[105px]"
                    >
                      <Star className="h-4 w-4" />
                      {product.is_featured ? "Unfeature" : "Feature"}
                    </Button>
                    <Button
                      variant={product.is_hidden ? "secondary" : "destructive"}
                      size="sm"
                      onClick={() =>
                        toggleHidden(product.id, product.is_hidden)
                      }
                      disabled={actionLoading === product.id}
                      className="min-w-[105px]"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {product.is_hidden ? "Show" : "Hide"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteProduct(product.id)}
                      disabled={actionLoading === product.id}
                      className="min-w-[105px]"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
