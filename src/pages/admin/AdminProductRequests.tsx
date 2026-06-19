import { useEffect, useState } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  Eye,
  Calendar,
  DollarSign,
  Package,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  category: string;
  product_status: string;
  seller_id: string;
  seller_name?: string | null;
  price?: number;
  stock?: number;
  description?: string;
  image_url?: string;
  created_at?: string;
}

export default function AdminProductRequests() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectMessage, setRejectMessage] = useState("");
  const [rejectTarget, setRejectTarget] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPendingProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("product_status", "pending");

    if (error || !data) {
      setLoading(false);
      return;
    }

    const productsWithNames = await Promise.all(
      data.map(async (product) => {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", product.seller_id)
            .single();

          return {
            ...product,
            seller_name: profile?.username || null,
          };
        } catch (err) {
          return {
            ...product,
            seller_name: null,
          };
        }
      }),
    );

    setProducts(productsWithNames);
    setLoading(false);
  };

  useEffect(() => {
    fetchPendingProducts();
  }, []);

  const approveProduct = async (id: string) => {
    setActionLoading(id);
    const { error } = await supabase
      .from("products")
      .update({
        product_status: "approved",
        is_hidden: false,
      })
      .eq("id", id);

    if (!error) {
      toast({
        title: "Success",
        description: "Product approved successfully",
      });
      setSelectedProduct(null);
      fetchPendingProducts();
    } else {
      toast({
        title: "Error",
        description: "Failed to approve product",
        variant: "destructive",
      });
    }
    setActionLoading(null);
  };

  // Open rejection dialog (admin can add message to seller)
  const rejectProduct = (product: Product) => {
    setRejectTarget(product);
    setRejectMessage("");
    setRejectDialogOpen(true);
  };

  // Perform rejection and optionally send a notification to the seller
  const performRejectProduct = async (id: string) => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from("products")
        .update({
          // mark as rejected but keep visible to the seller so they can see the reason
          product_status: "rejected",
          is_hidden: false,
        })
        .eq("id", id);

      if (error) throw error;

      // If admin provided a message, insert into notifications for the seller
      if (rejectTarget) {
        // include a product marker in the notification message so seller UI can
        // associate the rejection reason with the product (no schema migration)
        const baseMessage = rejectMessage.trim()
          ? rejectMessage.trim()
          : "Your product was rejected.";
        const notifMessage = `${baseMessage} [product_rejection::${id}]`;

        const { error: notifErr } = await supabase
          .from("notifications")
          .insert({
            user_id: rejectTarget.seller_id,
            title: "Product Rejected",
            message: notifMessage,
            type: "alert",
          });
        if (notifErr) {
          // Show toast but don't fail the whole operation
          toast({
            title: "Error sending notification",
            description:
              notifErr.message || "Permission denied or policy error.",
            variant: "destructive",
          });
        }
      }

      toast({ title: "Success", description: "Product rejected" });
      setRejectDialogOpen(false);
      setRejectTarget(null);
      setSelectedProduct(null);
      fetchPendingProducts();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to reject product",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.seller_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-green-900">
              Product Requests
            </h1>
            <p className="text-gray-600 mt-2">
              Review and approve pending seller products (
              {filteredProducts.length})
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search by product name, seller, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <p className="text-gray-500 text-lg">
              {searchTerm
                ? "No products found matching your search"
                : "No pending product requests"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 overflow-hidden flex flex-col h-full"
              >
                {/* Product Image */}
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      <Package className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    {product.product_status}
                  </div>
                </div>

                {/* Product Details */}
                <div className="p-5 flex-1 flex flex-col">
                  {/* Name */}
                  <h3 className="font-bold text-lg text-gray-900 line-clamp-2 mb-2">
                    {product.name}
                  </h3>

                  {/* Category & Seller */}
                  <div className="space-y-2 mb-4 text-sm">
                    <p className="text-gray-600">
                      <span className="font-medium text-gray-700">
                        Category:
                      </span>{" "}
                      {product.category}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium text-gray-700">Seller:</span>{" "}
                      {product.seller_name || "Unknown"}
                    </p>
                  </div>

                  {/* Price & Stock */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-gray-600">Price</span>
                      </div>
                      <p className="font-bold text-green-700">
                        ₹{product.price || 0}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <Package className="h-4 w-4 text-blue-600" />
                        <span className="text-xs text-gray-600">Stock</span>
                      </div>
                      <p className="font-bold text-blue-700">
                        {product.stock || 0}
                      </p>
                    </div>
                  </div>

                  {/* Description Preview */}
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-1">
                    {product.description || "No description provided"}
                  </p>

                  {/* Created Date */}
                  {product.created_at && (
                    <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(product.created_at).toLocaleDateString()}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-auto">
                    <Button
                      onClick={() => setSelectedProduct(product)}
                      variant="outline"
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      onClick={() => approveProduct(product.id)}
                      disabled={actionLoading === product.id}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => rejectProduct(product)}
                      disabled={actionLoading === product.id}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Product Detail Modal */}
        <Dialog
          open={!!selectedProduct}
          onOpenChange={() => setSelectedProduct(null)}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedProduct && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl">
                    {selectedProduct.name}
                  </DialogTitle>
                  <DialogDescription>
                    Review full product details
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Product Image */}
                  {selectedProduct.image_url && (
                    <div className="bg-gray-100 rounded-lg overflow-hidden h-64 flex items-center justify-center">
                      <img
                        src={selectedProduct.image_url}
                        alt={selectedProduct.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )}

                  {/* Product Info Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Category</p>
                      <p className="font-bold text-gray-900">
                        {selectedProduct.category}
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Price</p>
                      <p className="font-bold text-gray-900">
                        ₹{selectedProduct.price}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Stock</p>
                      <p className="font-bold text-gray-900">
                        {selectedProduct.stock}
                      </p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Seller</p>
                      <p className="font-bold text-gray-900">
                        {selectedProduct.seller_name}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">
                      Description
                    </p>
                    <p className="text-gray-700 leading-relaxed p-4 bg-gray-50 rounded-lg">
                      {selectedProduct.description}
                    </p>
                  </div>

                  {/* Created Date */}
                  {selectedProduct.created_at && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Submitted:</span>{" "}
                      {new Date(selectedProduct.created_at).toLocaleString()}
                    </div>
                  )}
                </div>

                <DialogFooter className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedProduct(null)}
                    className="flex-1"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => rejectProduct(selectedProduct)}
                    disabled={actionLoading === selectedProduct.id}
                    variant="destructive"
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => approveProduct(selectedProduct.id)}
                    disabled={actionLoading === selectedProduct.id}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
        {/* Reject with message Dialog */}
        <Dialog
          open={rejectDialogOpen}
          onOpenChange={() => setRejectDialogOpen(false)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Reject Product</DialogTitle>
              <DialogDescription>
                Optionally send a message to the seller explaining why the
                product was rejected and tips to improve it.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <p className="text-sm text-gray-600">
                Rejecting:{" "}
                <span className="font-medium">{rejectTarget?.name}</span>
              </p>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Message to seller
                </span>
                <textarea
                  value={rejectMessage}
                  onChange={(e) => setRejectMessage(e.target.value)}
                  placeholder="Explain why the product was rejected and give tips to improve it..."
                  rows={6}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                />
                <p className="mt-1 text-xs text-slate-400">
                  {rejectMessage.length}/500
                </p>
              </label>
            </div>

            <DialogFooter className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setRejectDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  rejectTarget && performRejectProduct(rejectTarget.id)
                }
                disabled={!rejectTarget || actionLoading === rejectTarget?.id}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Send & Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
