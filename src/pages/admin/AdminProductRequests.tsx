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
  ImageOff,
  Loader2,
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

interface ImageLoadState {
  [key: string]: "loading" | "loaded" | "error";
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
  const [imageLoadState, setImageLoadState] = useState<ImageLoadState>({});

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

  const handleImageLoad = (productId: string) => {
    setImageLoadState((prev) => ({
      ...prev,
      [productId]: "loaded",
    }));
  };

  const handleImageError = (productId: string) => {
    setImageLoadState((prev) => ({
      ...prev,
      [productId]: "error",
    }));
  };

  const setImageLoading = (productId: string) => {
    setImageLoadState((prev) => ({
      ...prev,
      [productId]: "loading",
    }));
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-8 border border-green-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold text-green-900">
                Product Requests
              </h1>
              <p className="text-green-700 mt-2 text-lg md:text-xl">
                Review and approve pending seller products
              </p>
            </div>
            <div className="flex flex-col gap-3 md:text-right">
              <div className="flex items-center gap-6">
                <div className="bg-white rounded-lg p-5 border border-green-200 shadow-sm">
                  <p className="text-sm text-gray-600 font-medium">
                    Pending Review
                  </p>
                  <p className="text-4xl font-bold text-orange-600">
                    {filteredProducts.length}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-5 border border-green-200 shadow-sm">
                  <p className="text-sm text-gray-600 font-medium">
                    Total Products
                  </p>
                  <p className="text-4xl font-bold text-green-600">
                    {products.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-md">
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Search by product name, seller, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-5 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition text-base placeholder-gray-400"
            />
            {searchTerm && (
              <div className="flex items-center justify-between">
                <p className="text-base text-gray-700">
                  Found{" "}
                  <span className="font-bold text-green-600">
                    {filteredProducts.length}
                  </span>{" "}
                  results
                </p>
                <button
                  onClick={() => setSearchTerm("")}
                  className="text-base text-green-600 hover:text-green-700 font-semibold hover:underline transition"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden animate-pulse"
              >
                <div className="w-full h-64 bg-gray-300"></div>
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-300 rounded w-4/5"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/5"></div>
                  <div className="flex gap-2 pt-3">
                    <div className="h-9 bg-gray-200 rounded flex-1"></div>
                    <div className="h-9 bg-gray-200 rounded flex-1"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl p-16 text-center shadow-md border border-gray-100">
            <Package className="h-20 w-20 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-700 text-xl font-semibold mb-2">
              {searchTerm
                ? "No products found matching your search"
                : "No pending product requests"}
            </p>
            <p className="text-gray-500 text-base">
              {searchTerm
                ? "Try adjusting your search criteria"
                : "All pending products have been reviewed"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 overflow-hidden flex flex-col h-full group"
              >
                {/* Product Image */}
                <div className="relative w-full h-72 bg-gradient-to-b from-gray-50 to-gray-100 overflow-hidden flex items-center justify-center">
                  {product.image_url ? (
                    <>
                      {imageLoadState[product.id] === "loading" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
                          <Loader2 className="h-10 w-10 text-gray-400 animate-spin" />
                        </div>
                      )}
                      <img
                        src={product.image_url}
                        alt={product.name}
                        onLoad={() => handleImageLoad(product.id)}
                        onError={() => handleImageError(product.id)}
                        onLoadingStateChange={() => setImageLoading(product.id)}
                        className={`w-auto h-auto max-w-[90%] max-h-[85%] object-contain transition-all duration-300 group-hover:scale-105 ${
                          imageLoadState[product.id] === "error" ? "hidden" : ""
                        }`}
                      />
                      {imageLoadState[product.id] === "error" && (
                        <div className="flex flex-col items-center justify-center">
                          <ImageOff className="h-16 w-16 text-gray-300 mb-2" />
                          <span className="text-sm text-gray-500 font-medium">
                            Failed to load image
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <Package className="h-16 w-16 text-gray-300 mb-2" />
                      <span className="text-sm text-gray-500 font-medium">
                        No image available
                      </span>
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg">
                    Pending
                  </div>
                </div>

                {/* Product Details */}
                <div className="p-5 flex-1 flex flex-col space-y-3">
                  {/* Name */}
                  <h3 className="font-bold text-lg text-gray-900 line-clamp-2 group-hover:text-green-700 transition-colors">
                    {product.name}
                  </h3>

                  {/* Category & Seller */}
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-700">
                      <span className="font-semibold text-gray-800">
                        Category:
                      </span>{" "}
                      <span className="text-gray-600">{product.category}</span>
                    </p>
                    <p className="text-gray-700">
                      <span className="font-semibold text-gray-800">
                        Seller:
                      </span>{" "}
                      <span className="text-gray-600">
                        {product.seller_name || "Unknown"}
                      </span>
                    </p>
                  </div>

                  {/* Price & Stock */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                      <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-green-700 font-semibold">
                          Price
                        </span>
                      </div>
                      <p className="font-bold text-green-900 text-lg">
                        ₹{product.price || 0}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                      <div className="flex items-center gap-1 mb-1">
                        <Package className="h-4 w-4 text-blue-600" />
                        <span className="text-xs text-blue-700 font-semibold">
                          Stock
                        </span>
                      </div>
                      <p className="font-bold text-blue-900 text-lg">
                        {product.stock || 0}
                      </p>
                    </div>
                  </div>

                  {/* Description Preview */}
                  <p className="text-sm text-gray-600 line-clamp-2 flex-1 leading-relaxed">
                    {product.description || "No description provided"}
                  </p>

                  {/* Created Date */}
                  {product.created_at && (
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(product.created_at).toLocaleDateString(
                        "en-IN",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-auto pt-2">
                    <button
                      onClick={() => setSelectedProduct(product)}
                      className="flex-1 h-10 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-2 border border-blue-200 hover:border-blue-300"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                    <button
                      onClick={() => approveProduct(product.id)}
                      disabled={actionLoading === product.id}
                      className="flex-1 h-10 px-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => rejectProduct(product)}
                      disabled={actionLoading === product.id}
                      className="flex-1 h-10 px-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
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
                  <DialogTitle className="text-4xl font-bold text-gray-900">
                    {selectedProduct.name}
                  </DialogTitle>
                  <DialogDescription className="text-base text-gray-600 mt-2">
                    Review full product details and make a decision
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-8">
                  {/* Product Image */}
                  {selectedProduct.image_url && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden flex items-center justify-center min-h-96 border-2 border-gray-300">
                      {imageLoadState[selectedProduct.id] === "loading" && (
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="h-12 w-12 text-gray-400 animate-spin" />
                          <p className="text-base text-gray-600 font-medium">
                            Loading image...
                          </p>
                        </div>
                      )}
                      {imageLoadState[selectedProduct.id] === "error" && (
                        <div className="flex flex-col items-center gap-3">
                          <ImageOff className="h-20 w-20 text-gray-300" />
                          <p className="text-base text-gray-600 font-medium">
                            Failed to load image
                          </p>
                        </div>
                      )}
                      {imageLoadState[selectedProduct.id] !== "error" && (
                        <img
                          src={selectedProduct.image_url}
                          alt={selectedProduct.name}
                          onLoad={() => handleImageLoad(selectedProduct.id)}
                          onError={() => handleImageError(selectedProduct.id)}
                          onLoadingStateChange={() =>
                            setImageLoading(selectedProduct.id)
                          }
                          className={`max-h-96 max-w-full object-contain p-6 transition-all duration-300 ${
                            imageLoadState[selectedProduct.id] === "loading"
                              ? "opacity-0"
                              : "opacity-100"
                          }`}
                        />
                      )}
                    </div>
                  )}

                  {/* Product Info Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-5 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-600 mb-2 font-semibold">
                        Category
                      </p>
                      <p className="font-bold text-gray-900 text-lg">
                        {selectedProduct.category}
                      </p>
                    </div>
                    <div className="bg-green-50 p-5 rounded-lg border border-green-200">
                      <p className="text-sm text-gray-600 mb-2 font-semibold">
                        Price
                      </p>
                      <p className="font-bold text-gray-900 text-lg">
                        ₹{selectedProduct.price}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-5 rounded-lg border border-purple-200">
                      <p className="text-sm text-gray-600 mb-2 font-semibold">
                        Stock
                      </p>
                      <p className="font-bold text-gray-900 text-lg">
                        {selectedProduct.stock}
                      </p>
                    </div>
                    <div className="bg-orange-50 p-5 rounded-lg border border-orange-200">
                      <p className="text-sm text-gray-600 mb-2 font-semibold">
                        Seller
                      </p>
                      <p className="font-bold text-gray-900 text-lg">
                        {selectedProduct.seller_name}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <p className="text-base font-semibold text-gray-700 mb-3">
                      Description
                    </p>
                    <p className="text-gray-700 leading-relaxed p-4 bg-gray-50 rounded-lg text-base">
                      {selectedProduct.description}
                    </p>
                  </div>

                  {/* Created Date */}
                  {selectedProduct.created_at && (
                    <div className="text-base text-gray-700 font-medium">
                      <span className="font-semibold">Submitted:</span>{" "}
                      {new Date(selectedProduct.created_at).toLocaleString()}
                    </div>
                  )}
                </div>

                <DialogFooter className="flex gap-3 pt-6">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedProduct(null)}
                    className="flex-1 h-12 text-base font-semibold"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => rejectProduct(selectedProduct)}
                    disabled={actionLoading === selectedProduct.id}
                    variant="destructive"
                    className="flex-1 h-12 text-base font-semibold"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => approveProduct(selectedProduct.id)}
                    disabled={actionLoading === selectedProduct.id}
                    className="flex-1 h-12 text-base font-semibold bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
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
              <DialogTitle className="text-3xl font-bold text-gray-900">
                Reject Product
              </DialogTitle>
              <DialogDescription className="text-base text-gray-600 mt-2">
                Send a message to the seller explaining why the product was
                rejected and suggest improvements.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <p className="text-base text-gray-700 font-medium">
                Rejecting:{" "}
                <span className="font-bold text-rose-600">
                  {rejectTarget?.name}
                </span>
              </p>

              <label className="block">
                <span className="mb-3 block text-base font-semibold text-slate-800">
                  Message to seller
                </span>
                <textarea
                  value={rejectMessage}
                  onChange={(e) =>
                    setRejectMessage(e.target.value.slice(0, 500))
                  }
                  placeholder="Explain why the product was rejected and give tips to improve it..."
                  rows={6}
                  className="w-full resize-none rounded-lg border-2 border-slate-300 px-4 py-3 text-base outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                />
                <p className="mt-2 text-sm text-slate-600 font-medium">
                  {rejectMessage.length}/500
                </p>
              </label>
            </div>

            <DialogFooter className="flex gap-3 pt-6">
              <Button
                variant="outline"
                onClick={() => setRejectDialogOpen(false)}
                className="flex-1 h-12 text-base font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  rejectTarget && performRejectProduct(rejectTarget.id)
                }
                disabled={!rejectTarget || actionLoading === rejectTarget?.id}
                className="flex-1 h-12 text-base font-semibold bg-rose-600 hover:bg-rose-700 text-white"
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
