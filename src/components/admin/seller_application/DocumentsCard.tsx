import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

interface Props {
  documents: any[];
}

export default function DocumentsCard({ documents }: Props) {
  const openDocument = async (document: any) => {
    const { data, error } = await supabase.storage
      .from(document.storage_bucket)
      .createSignedUrl(document.storage_path, 60); // URL valid for 60 seconds

    if (error) {
      console.error(error);
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  return (
    <div className="rounded-[32px] border border-stone-200 bg-white/95 p-6 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.14)] mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Uploaded documents
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Review uploaded verification files for this seller.
          </p>
        </div>

        <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
          {documents.length} file{documents.length === 1 ? "" : "s"}
        </div>
      </div>

      {documents.length === 0 ? (
        <p className="text-gray-500">No documents uploaded.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col gap-4 rounded-[28px] border border-stone-200 bg-[#FAFAF9] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-semibold text-slate-900 capitalize">
                  {doc.document_type.replace(/_/g, " ")}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {doc.original_file_name}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Uploaded {new Date(doc.uploaded_at).toLocaleString()}
                </p>
              </div>

              <Button variant="outline" onClick={() => openDocument(doc)}>
                View document
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
