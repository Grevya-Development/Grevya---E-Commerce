import SellerSidebar from "@/components/seller/SellerSidebar";

interface Props {
  children: React.ReactNode;
}

export default function SellerLayout({ children }: Props) {
  return (
    <div className="min-h-screen flex bg-green-50">
      <SellerSidebar />

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
