import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Check, CreditCard, IndianRupee } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useCartStore } from "@/store/useCartStore";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabaseClient";

interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface DeliveryForm {
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  city: string;
  pincode: string;
  state: string;
  phone: string;
}

const initialDeliveryForm: DeliveryForm = {
  firstName: "",
  lastName: "",
  email: "",
  address: "",
  city: "",
  pincode: "",
  state: "",
  phone: "",
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to process your order.";

const Checkout = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [processing, setProcessing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<string>("upi");
  const [deliveryForm, setDeliveryForm] =
    useState<DeliveryForm>(initialDeliveryForm);

  const cartItems = useCartStore((state) => state.items);
  const getSubtotal = useCartStore((state) => state.getSubtotal);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = getSubtotal();
  const shipping = subtotal >= 500 ? 0 : 50;
  const total = subtotal + shipping;

  const paymentMethods: PaymentMethod[] = [
    {
      id: "upi",
      name: "UPI Payment",
      description: "Pay using Google Pay, PhonePe, or BHIM UPI",
      icon: <IndianRupee className="h-8 w-8" />,
    },
    {
      id: "card",
      name: "Credit/Debit Card",
      description: "Pay securely with your card",
      icon: <CreditCard className="h-8 w-8" />,
    },
    {
      id: "cod",
      name: "Cash on Delivery",
      description: "Pay with cash when your order arrives",
      icon: <IndianRupee className="h-8 w-8" />,
    },
  ];

  const handleDeliveryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = event.target;
    setDeliveryForm((current) => ({
      ...current,
      [id]: value,
    }));
  };

  const handlePayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.id) {
      toast({
        title: "Login required",
        description: "Please login before checking out.",
        variant: "destructive",
      });
      return;
    }

    if (cartItems.length === 0) {
      toast({
        title: "Cart empty",
        description: "Add some items before checking out.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    toast({
      title: "Processing order",
      description: "Please wait...",
    });

    try {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          total_amount: total,
          shipping_amount: shipping,
          payment_method: selectedPayment,
          status: "pending",
          delivery_info: {
            ...deliveryForm,
            fullName: `${deliveryForm.firstName} ${deliveryForm.lastName}`.trim(),
          },
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map((item) => ({
        order_id: orderData.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Order placed",
        message: "Your order has been placed successfully!",
        type: "order",
      });

      clearCart();
      navigate("/payment-success");
    } catch (error: unknown) {
      console.error("Order processing failed:", error);
      toast({
        title: "Order Failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow bg-cream/30 py-16">
        <div className="container mx-auto px-4">
          <form className="max-w-2xl mx-auto" onSubmit={handlePayment}>
            <h1 className="text-3xl font-bold text-brown-800 mb-8">
              Checkout
            </h1>

            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold text-brown-800 mb-4">
                Delivery Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-brown-600 mb-1"
                  >
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    value={deliveryForm.firstName}
                    onChange={handleDeliveryChange}
                    className="w-full border border-gray-300 rounded-md p-2"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-brown-600 mb-1"
                  >
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    value={deliveryForm.lastName}
                    onChange={handleDeliveryChange}
                    className="w-full border border-gray-300 rounded-md p-2"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-brown-600 mb-1"
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={deliveryForm.email}
                    onChange={handleDeliveryChange}
                    className="w-full border border-gray-300 rounded-md p-2"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label
                    htmlFor="address"
                    className="block text-sm font-medium text-brown-600 mb-1"
                  >
                    Address
                  </label>
                  <input
                    type="text"
                    id="address"
                    value={deliveryForm.address}
                    onChange={handleDeliveryChange}
                    className="w-full border border-gray-300 rounded-md p-2"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="city"
                    className="block text-sm font-medium text-brown-600 mb-1"
                  >
                    City
                  </label>
                  <input
                    type="text"
                    id="city"
                    value={deliveryForm.city}
                    onChange={handleDeliveryChange}
                    className="w-full border border-gray-300 rounded-md p-2"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="pincode"
                    className="block text-sm font-medium text-brown-600 mb-1"
                  >
                    PIN Code
                  </label>
                  <input
                    type="text"
                    id="pincode"
                    value={deliveryForm.pincode}
                    onChange={handleDeliveryChange}
                    className="w-full border border-gray-300 rounded-md p-2"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="state"
                    className="block text-sm font-medium text-brown-600 mb-1"
                  >
                    State
                  </label>
                  <input
                    type="text"
                    id="state"
                    value={deliveryForm.state}
                    onChange={handleDeliveryChange}
                    className="w-full border border-gray-300 rounded-md p-2"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-brown-600 mb-1"
                  >
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={deliveryForm.phone}
                    onChange={handleDeliveryChange}
                    className="w-full border border-gray-300 rounded-md p-2"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold text-brown-800 mb-4">
                Payment Method
              </h2>
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`flex items-center p-4 border rounded-lg cursor-pointer ${
                      selectedPayment === method.id
                        ? "border-green-700 bg-green-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.id}
                      checked={selectedPayment === method.id}
                      onChange={() => setSelectedPayment(method.id)}
                      className="sr-only"
                    />
                    <div className="flex-shrink-0 mr-4 text-green-700">
                      {method.icon}
                    </div>
                    <div className="flex-grow">
                      <div className="font-medium text-brown-800">
                        {method.name}
                      </div>
                      <div className="text-sm text-brown-600">
                        {method.description}
                      </div>
                    </div>
                    {selectedPayment === method.id && (
                      <div className="flex-shrink-0 ml-2 text-green-700">
                        <Check className="h-6 w-6" />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold text-brown-800 mb-4">
                Order Summary
              </h2>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-brown-600">Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brown-600">Shipping</span>
                  <span>
                    {shipping === 0 ? "Free" : `₹${shipping.toFixed(2)}`}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-green-700">₹{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full py-3 text-lg"
              disabled={processing}
            >
              {processing ? "Processing..." : "Complete Payment"}
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;
